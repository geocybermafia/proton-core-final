import { useState, useEffect } from 'react';
import { projectSyncService, ProjectSyncState } from '../lib/projectSyncService';

export function useProjectSyncStatus(): ProjectSyncState {
  const [syncState, setSyncState] = useState<ProjectSyncState>(() => projectSyncService.getState());

  useEffect(() => {
    const unsubscribe = projectSyncService.subscribe(setSyncState);
    return unsubscribe;
  }, []);

  return syncState;
}
