import { useState, useEffect } from 'react';
import { taskSyncService, TaskSyncState } from '../lib/taskSyncService';

export function useTaskSyncStatus(): TaskSyncState {
  const [syncState, setSyncState] = useState<TaskSyncState>(() => taskSyncService.getState());

  useEffect(() => {
    const unsubscribe = taskSyncService.subscribe(setSyncState);
    return unsubscribe;
  }, []);

  return syncState;
}
