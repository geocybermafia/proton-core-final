import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Project } from '../types';
import { safeStorage } from './safeStorage';

export type ProjectSyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error' | 'offline';

export interface ProjectSyncState {
  status: ProjectSyncStatus;
  pendingCount: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}

type SyncListener = (state: ProjectSyncState) => void;

interface PendingMutation {
  type: 'upsert' | 'delete';
  project?: Project;
  timestamp: number;
  timerId?: any;
}

function sanitizeProjectForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeProjectForFirestore).filter(v => v !== undefined);
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeProjectForFirestore(value);
    }
  }
  return clean;
}

class ProjectSyncService {
  private static instance: ProjectSyncService;
  private pendingQueue: Map<string, PendingMutation> = new Map();
  private listeners: Set<SyncListener> = new Set();
  private debounceMs = 400;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private state: ProjectSyncState = {
    status: 'idle',
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null
  };

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      window.addEventListener('beforeunload', () => this.flushAllSync());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushAll();
        }
      });
    }
  }

  public static getInstance(): ProjectSyncService {
    if (!ProjectSyncService.instance) {
      ProjectSyncService.instance = new ProjectSyncService();
    }
    return ProjectSyncService.instance;
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.updateState({ status: this.pendingQueue.size > 0 ? 'pending' : 'idle', lastError: null });
    this.flushAll();
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.updateState({ status: 'offline' });
  };

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): ProjectSyncState {
    return { ...this.state };
  }

  private updateState(partial: Partial<ProjectSyncState>) {
    this.state = {
      ...this.state,
      ...partial,
      pendingCount: this.pendingQueue.size
    };
    this.listeners.forEach(fn => {
      try {
        fn(this.state);
      } catch (err) {
        console.error('[ProjectSyncService] Listener error:', err);
      }
    });
  }

  /**
   * Reads safely from local cache
   */
  public getLocalProjects(): Project[] {
    try {
      const stored = safeStorage.get('proton_projects');
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Fetches projects from Firestore under users/{userId}/projects with safe fallback to local cache
   */
  public async fetchProjects(userId: string): Promise<Project[]> {
    if (!userId) {
      return this.getLocalProjects();
    }

    try {
      this.updateState({ status: 'syncing' });
      const projectsRef = collection(db, 'users', userId, 'projects');
      const snap = await getDocs(projectsRef);
      const loaded: Project[] = [];

      snap.forEach(d => {
        const data = d.data();
        if (data && data.id && data.name) {
          loaded.push({
            id: String(data.id),
            name: String(data.name),
            nameGe: data.nameGe ? String(data.nameGe) : undefined,
            description: data.description ? String(data.description) : undefined,
            descriptionGe: data.descriptionGe ? String(data.descriptionGe) : undefined,
            color: data.color ? String(data.color) : undefined,
            icon: data.icon ? String(data.icon) : undefined,
            targetDate: typeof data.targetDate === 'number' ? data.targetDate : undefined,
            notes: data.notes ? String(data.notes) : undefined,
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
            updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : undefined
          });
        }
      });

      // Update local cache
      safeStorage.set('proton_projects', JSON.stringify(loaded));
      this.updateState({
        status: 'idle',
        lastSyncedAt: Date.now(),
        lastError: null
      });

      return loaded;
    } catch (err: any) {
      console.warn('[ProjectSyncService] fetchProjects failed, falling back to local cache:', err);
      this.updateState({
        status: 'error',
        lastError: err?.message || 'Failed to fetch projects'
      });
      return this.getLocalProjects();
    }
  }

  /**
   * Immediately updates local projects in safeStorage to guarantee 0ms UI latency
   */
  private updateLocalCache(mutatedProject?: Project, deletedProjectId?: string) {
    try {
      const stored = safeStorage.get('proton_projects');
      let projects: Project[] = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(projects)) projects = [];

      if (deletedProjectId) {
        projects = projects.filter(p => p.id !== deletedProjectId);
      } else if (mutatedProject) {
        const index = projects.findIndex(p => p.id === mutatedProject.id);
        if (index !== -1) {
          projects[index] = mutatedProject;
        } else {
          projects.unshift(mutatedProject);
        }
      }
      safeStorage.set('proton_projects', JSON.stringify(projects));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.warn('[ProjectSyncService] Failed to update local cache:', e);
    }
  }

  public queueProjectUpsert(userId: string | undefined | null, project: Project, debounceDuration = this.debounceMs) {
    if (!project || !project.id) return;

    this.updateLocalCache(project);

    if (!userId) {
      this.updateState({ status: 'idle', pendingCount: 0 });
      return;
    }

    if (!this.isOnline) {
      this.updateState({ status: 'offline', pendingCount: this.pendingQueue.size + 1 });
      this.pendingQueue.set(project.id, {
        type: 'upsert',
        project,
        timestamp: Date.now()
      });
      return;
    }

    const existing = this.pendingQueue.get(project.id);
    if (existing?.timerId) {
      clearTimeout(existing.timerId);
    }

    this.updateState({ status: 'pending' });

    const timerId = setTimeout(() => {
      this.commitProjectWrite(userId, project.id);
    }, debounceDuration);

    this.pendingQueue.set(project.id, {
      type: 'upsert',
      project,
      timestamp: Date.now(),
      timerId
    });

    this.updateState({ pendingCount: this.pendingQueue.size });
  }

  public queueProjectDelete(userId: string | undefined | null, projectId: string) {
    if (!projectId) return;

    this.updateLocalCache(undefined, projectId);

    const existing = this.pendingQueue.get(projectId);
    if (existing?.timerId) {
      clearTimeout(existing.timerId);
    }

    if (!userId) {
      this.pendingQueue.delete(projectId);
      this.updateState({ status: 'idle', pendingCount: 0 });
      return;
    }

    if (!this.isOnline) {
      this.pendingQueue.set(projectId, {
        type: 'delete',
        timestamp: Date.now()
      });
      this.updateState({ status: 'offline' });
      return;
    }

    this.updateState({ status: 'pending' });

    const timerId = setTimeout(() => {
      this.commitProjectDelete(userId, projectId);
    }, 100);

    this.pendingQueue.set(projectId, {
      type: 'delete',
      timestamp: Date.now(),
      timerId
    });

    this.updateState({ pendingCount: this.pendingQueue.size });
  }

  private async commitProjectWrite(userId: string, projectId: string) {
    const mutation = this.pendingQueue.get(projectId);
    if (!mutation || mutation.type !== 'upsert' || !mutation.project) {
      this.pendingQueue.delete(projectId);
      return;
    }

    this.updateState({ status: 'syncing' });

    try {
      const sanitized = sanitizeProjectForFirestore(mutation.project);
      const docRef = doc(db, 'users', userId, 'projects', projectId);
      await setDoc(docRef, sanitized, { merge: true });

      this.pendingQueue.delete(projectId);
      const isQueueEmpty = this.pendingQueue.size === 0;
      this.updateState({
        status: isQueueEmpty ? 'synced' : 'syncing',
        lastSyncedAt: Date.now(),
        lastError: null
      });

      if (isQueueEmpty) {
        setTimeout(() => {
          if (this.pendingQueue.size === 0) {
            this.updateState({ status: 'idle' });
          }
        }, 1500);
      }
    } catch (err: any) {
      console.warn(`[ProjectSyncService] Write failed for project ${projectId}:`, err?.message || err);
      this.updateState({
        status: 'error',
        lastError: err?.message || 'Write sync failed'
      });
    }
  }

  private async commitProjectDelete(userId: string, projectId: string) {
    const mutation = this.pendingQueue.get(projectId);
    if (!mutation || mutation.type !== 'delete') {
      this.pendingQueue.delete(projectId);
      return;
    }

    this.pendingQueue.delete(projectId);
    this.updateState({ status: 'syncing' });

    try {
      const docRef = doc(db, 'users', userId, 'projects', projectId);
      await deleteDoc(docRef);

      const isQueueEmpty = this.pendingQueue.size === 0;
      this.updateState({
        status: isQueueEmpty ? 'synced' : 'syncing',
        lastSyncedAt: Date.now(),
        lastError: null
      });

      if (isQueueEmpty) {
        setTimeout(() => {
          if (this.pendingQueue.size === 0) {
            this.updateState({ status: 'idle' });
          }
        }, 1500);
      }
    } catch (err: any) {
      console.warn(`[ProjectSyncService] Delete failed for project ${projectId}:`, err?.message || err);
      this.updateState({
        status: 'error',
        lastError: err?.message || 'Delete sync failed'
      });
    }
  }

  public async flushAll(userId?: string) {
    if (this.pendingQueue.size === 0) return;
    const entries = Array.from(this.pendingQueue.entries());
    for (const [projectId, mutation] of entries) {
      if (mutation.timerId) clearTimeout(mutation.timerId);
      if (userId) {
        if (mutation.type === 'upsert' && mutation.project) {
          await this.commitProjectWrite(userId, projectId);
        } else if (mutation.type === 'delete') {
          await this.commitProjectDelete(userId, projectId);
        }
      }
    }
  }

  private flushAllSync() {
    if (this.pendingQueue.size === 0) return;
    this.pendingQueue.forEach(m => {
      if (m.timerId) clearTimeout(m.timerId);
    });
  }
}

export const projectSyncService = ProjectSyncService.getInstance();
