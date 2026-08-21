import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Task } from '../types';
import { safeStorage } from './safeStorage';

export type TaskSyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error' | 'offline';

export interface TaskSyncState {
  status: TaskSyncStatus;
  pendingCount: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}

type SyncListener = (state: TaskSyncState) => void;

interface PendingMutation {
  type: 'upsert' | 'delete';
  task?: Task;
  timestamp: number;
  timerId?: any;
}

function sanitizeTaskForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeTaskForFirestore).filter(v => v !== undefined);
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeTaskForFirestore(value);
    }
  }
  return clean;
}

class TaskSyncService {
  private static instance: TaskSyncService;
  private pendingQueue: Map<string, PendingMutation> = new Map();
  private listeners: Set<SyncListener> = new Set();
  private debounceMs = 500;
  private maxWaitMs = 3000;
  private firstQueuedAt: Map<string, number> = new Map();
  private activeWritesCount = 0;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private state: TaskSyncState = {
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

  public static getInstance(): TaskSyncService {
    if (!TaskSyncService.instance) {
      TaskSyncService.instance = new TaskSyncService();
    }
    return TaskSyncService.instance;
  }

  private handleOnline = () => {
    this.isOnline = true;
    console.log('[TaskSyncService] Network restored. Flushing pending debounced task syncs...');
    this.updateState({ status: this.pendingQueue.size > 0 ? 'pending' : 'idle', lastError: null });
    this.flushAll();
  };

  private handleOffline = () => {
    this.isOnline = false;
    console.warn('[TaskSyncService] Network offline. Changes will be buffered locally in safeStorage.');
    this.updateState({ status: 'offline' });
  };

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): TaskSyncState {
    return { ...this.state };
  }

  private updateState(partial: Partial<TaskSyncState>) {
    this.state = {
      ...this.state,
      ...partial,
      pendingCount: this.pendingQueue.size
    };
    this.listeners.forEach(fn => {
      try {
        fn(this.state);
      } catch (err) {
        console.error('[TaskSyncService] Listener error:', err);
      }
    });
  }

  /**
   * Immediately updates local tasks in safeStorage to guarantee 0ms UI latency
   */
  private updateLocalCache(mutatedTask?: Task, deletedTaskId?: string) {
    try {
      const stored = safeStorage.get('proton_tasks');
      let tasks: Task[] = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(tasks)) tasks = [];

      if (deletedTaskId) {
        tasks = tasks.filter(t => t.id !== deletedTaskId);
      } else if (mutatedTask) {
        const index = tasks.findIndex(t => t.id === mutatedTask.id);
        if (index !== -1) {
          tasks[index] = mutatedTask;
        } else {
          tasks.unshift(mutatedTask);
        }
      }
      safeStorage.set('proton_tasks', JSON.stringify(tasks));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.warn('[TaskSyncService] Failed to update local cache:', e);
    }
  }

  /**
   * Debounces a task upsert (create or update).
   * Coalesces rapid keystrokes or state changes into a single debounced Firestore write.
   */
  public queueTaskUpsert(userId: string | undefined | null, task: Task, debounceDuration = this.debounceMs) {
    if (!task || !task.id) return;

    // 1. Immediately persist to localStorage for 0ms crash-resilience
    this.updateLocalCache(task);

    if (!userId) {
      this.updateState({ status: 'idle', pendingCount: 0 });
      return;
    }

    if (!this.isOnline) {
      this.updateState({ status: 'offline', pendingCount: this.pendingQueue.size + 1 });
      this.pendingQueue.set(task.id, {
        type: 'upsert',
        task,
        timestamp: Date.now()
      });
      return;
    }

    // 2. Clear existing debounce timer for this taskId
    const existing = this.pendingQueue.get(task.id);
    if (existing?.timerId) {
      clearTimeout(existing.timerId);
    }

    const now = Date.now();
    const firstQueued = this.firstQueuedAt.get(task.id) || now;
    this.firstQueuedAt.set(task.id, firstQueued);

    // Max wait guard: if too many edits happen consecutively, force flush
    const timeSinceFirstQueued = now - firstQueued;
    const effectiveDelay = timeSinceFirstQueued >= this.maxWaitMs ? 0 : debounceDuration;

    this.updateState({ status: 'pending' });

    const timerId = setTimeout(() => {
      this.commitTaskWrite(userId, task.id);
    }, effectiveDelay);

    this.pendingQueue.set(task.id, {
      type: 'upsert',
      task,
      timestamp: now,
      timerId
    });

    this.updateState({ pendingCount: this.pendingQueue.size });
  }

  /**
   * Queues a task deletion and cancels any pending debounced updates for it.
   */
  public queueTaskDelete(userId: string | undefined | null, taskId: string) {
    if (!taskId) return;

    // 1. Immediately remove from local storage
    this.updateLocalCache(undefined, taskId);

    // 2. Clear pending upsert timer if any
    const existing = this.pendingQueue.get(taskId);
    if (existing?.timerId) {
      clearTimeout(existing.timerId);
    }
    this.firstQueuedAt.delete(taskId);

    if (!userId) {
      this.pendingQueue.delete(taskId);
      this.updateState({ status: 'idle', pendingCount: 0 });
      return;
    }

    if (!this.isOnline) {
      this.pendingQueue.set(taskId, {
        type: 'delete',
        timestamp: Date.now()
      });
      this.updateState({ status: 'offline' });
      return;
    }

    this.updateState({ status: 'pending' });

    // For delete, we trigger promptly with a tiny debounce (100ms) to coalesce in case of rapid clicks
    const timerId = setTimeout(() => {
      this.commitTaskDelete(userId, taskId);
    }, 100);

    this.pendingQueue.set(taskId, {
      type: 'delete',
      timestamp: Date.now(),
      timerId
    });

    this.updateState({ pendingCount: this.pendingQueue.size });
  }

  /**
   * Commits an individual debounced task upsert to Firestore
   */
  private async commitTaskWrite(userId: string, taskId: string) {
    const mutation = this.pendingQueue.get(taskId);
    if (!mutation || mutation.type !== 'upsert' || !mutation.task) {
      this.pendingQueue.delete(taskId);
      this.firstQueuedAt.delete(taskId);
      return;
    }

    this.pendingQueue.delete(taskId);
    this.firstQueuedAt.delete(taskId);
    this.activeWritesCount++;
    this.updateState({ status: 'syncing' });

    try {
      const docRef = doc(db, 'users', userId, 'tasks', taskId);
      const sanitized = sanitizeTaskForFirestore(mutation.task);
      await setDoc(docRef, sanitized, { merge: true });

      this.activeWritesCount--;
      const isQueueEmpty = this.pendingQueue.size === 0 && this.activeWritesCount === 0;
      this.updateState({
        status: isQueueEmpty ? 'synced' : 'syncing',
        lastSyncedAt: Date.now(),
        lastError: null
      });

      if (isQueueEmpty) {
        // Return to idle status after 1.5 seconds
        setTimeout(() => {
          if (this.pendingQueue.size === 0 && this.activeWritesCount === 0) {
            this.updateState({ status: 'idle' });
          }
        }, 1500);
      }
    } catch (err: any) {
      this.activeWritesCount--;
      console.warn(`[TaskSyncService] Debounced write failed for task ${taskId}:`, err?.message || err);
      
      // If error is permission or network, update status
      this.updateState({
        status: 'error',
        lastError: err?.message || 'Sync failed'
      });

      // Re-queue for next sync attempt if network-related
      if (this.isOnline && err?.code !== 'permission-denied') {
        this.pendingQueue.set(taskId, mutation);
      }
    }
  }

  /**
   * Commits an individual task deletion to Firestore
   */
  private async commitTaskDelete(userId: string, taskId: string) {
    const mutation = this.pendingQueue.get(taskId);
    if (!mutation || mutation.type !== 'delete') {
      this.pendingQueue.delete(taskId);
      return;
    }

    this.pendingQueue.delete(taskId);
    this.activeWritesCount++;
    this.updateState({ status: 'syncing' });

    try {
      const docRef = doc(db, 'users', userId, 'tasks', taskId);
      await deleteDoc(docRef);

      this.activeWritesCount--;
      const isQueueEmpty = this.pendingQueue.size === 0 && this.activeWritesCount === 0;
      this.updateState({
        status: isQueueEmpty ? 'synced' : 'syncing',
        lastSyncedAt: Date.now(),
        lastError: null
      });

      if (isQueueEmpty) {
        setTimeout(() => {
          if (this.pendingQueue.size === 0 && this.activeWritesCount === 0) {
            this.updateState({ status: 'idle' });
          }
        }, 1500);
      }
    } catch (err: any) {
      this.activeWritesCount--;
      console.warn(`[TaskSyncService] Delete failed for task ${taskId}:`, err?.message || err);
      this.updateState({
        status: 'error',
        lastError: err?.message || 'Delete sync failed'
      });
    }
  }

  /**
   * Flushes all pending mutations synchronously or asynchronously (useful on beforeunload or manual flush)
   */
  public async flushAll(userId?: string) {
    if (this.pendingQueue.size === 0) return;

    const entries = Array.from(this.pendingQueue.entries());
    for (const [taskId, mutation] of entries) {
      if (mutation.timerId) {
        clearTimeout(mutation.timerId);
      }
      if (userId) {
        if (mutation.type === 'upsert' && mutation.task) {
          await this.commitTaskWrite(userId, taskId);
        } else if (mutation.type === 'delete') {
          await this.commitTaskDelete(userId, taskId);
        }
      }
    }
  }

  private flushAllSync() {
    if (this.pendingQueue.size === 0) return;
    // Clear all pending timers to avoid background execution post-unload
    this.pendingQueue.forEach(m => {
      if (m.timerId) clearTimeout(m.timerId);
    });
  }
}

export const taskSyncService = TaskSyncService.getInstance();
