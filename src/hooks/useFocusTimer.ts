import { useState, useEffect, useRef, useCallback } from 'react';
import { safeStorage } from '../lib/safeStorage';
import { Task } from '../types';
import { notifyFocusEvent, playFocusChime } from '../lib/focusAudio';

export interface FocusTimerStateJSON {
  isRunning: boolean;
  startTimestamp: number;
  remainingSeconds: number;
  totalSeconds: number;
  mode: 'pomodoro' | 'stopwatch';
  focusMode: 'work' | 'break';
  activeTaskId: string | null;
  selectedMinutes: number;
  completedSessions: number;
  soundEnabled: boolean;
  voiceEnabled: boolean;
  lastCompletedStart?: number;
}

export interface UseFocusTimerProps {
  tasks: Task[];
  onEditTask: (id: string, updates: Partial<Task>) => void;
  language: 'en' | 'ka';
}

export interface FocusTimerReturn {
  isTimerRunning: boolean;
  activeTimerTaskId: string | null;
  timerPresentationMode: 'pomodoro' | 'stopwatch';
  focusMode: 'work' | 'break';
  pomodoroRemainingSeconds: number;
  pomodoroTotalSeconds: number;
  pomodoroSelectedMinutes: number;
  completedSessions: number;
  soundEnabled: boolean;
  voiceEnabled: boolean;
  localTimerSeconds: { [taskId: string]: number };
  setActiveTimerTaskId: (id: string | null) => void;
  handleToggleTimer: (id: string) => void;
  handleToggleFocusTimerRunning: (fallbackTaskId?: string | null) => void;
  handleResetFocusTimer: () => void;
  handleModeSwitch: (mode: 'work' | 'break') => void;
  handleApplyDuration: (minutes: number) => void;
  handleToggleSound: () => void;
  handleToggleVoice: () => void;
  handleToggleTimerMode: (mode: 'stopwatch' | 'pomodoro') => void;
  handleToggleTaskWithTimer: (id: string, onToggleTask: (id: string) => void) => void;
  flushActiveTimerTaskTime: () => void;
}

export function useFocusTimer({
  tasks,
  onEditTask,
  language
}: UseFocusTimerProps): FocusTimerReturn {
  // 1. Initial State from safeStorage (supporting both unified JSON and legacy keys)
  const [selectedMinutes, setSelectedMinutes] = useState<number>(() => {
    const saved = safeStorage.get('proton_focus_minutes');
    return saved ? Math.max(1, parseInt(saved, 10)) : 25;
  });

  const [completedSessions, setCompletedSessions] = useState<number>(() => {
    const saved = safeStorage.get('proton_focus_completed_sessions');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = safeStorage.get('proton_focus_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    const saved = safeStorage.get('proton_focus_voice_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [timerPresentationMode, setTimerPresentationMode] = useState<'pomodoro' | 'stopwatch'>('pomodoro');
  const [focusMode, setFocusMode] = useState<'work' | 'break'>('work');
  const [pomodoroRemainingSeconds, setPomodoroRemainingSeconds] = useState<number>(() => selectedMinutes * 60);
  const [pomodoroTotalSeconds, setPomodoroTotalSeconds] = useState<number>(() => selectedMinutes * 60);
  const [localTimerSeconds, setLocalTimerSeconds] = useState<{ [taskId: string]: number }>({});

  // Refs for timestamp-based drift-free calculation & throttling resilience
  const timerStartTimestampRef = useRef<number>(0);
  const baseRemainingSecondsRef = useRef<number>(selectedMinutes * 60);
  const baseTaskElapsedRef = useRef<number>(0);
  const lastCompletedStartRef = useRef<number>(0);
  const localTimerSecondsRef = useRef<{ [taskId: string]: number }>({});
  localTimerSecondsRef.current = localTimerSeconds;

  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;

  // Persist unified JSON snapshot for complete compatibility
  const persistTimerSnapshot = useCallback((overrides: Partial<FocusTimerStateJSON> = {}) => {
    try {
      const snapshot: FocusTimerStateJSON = {
        isRunning: isTimerRunning,
        startTimestamp: timerStartTimestampRef.current,
        remainingSeconds: pomodoroRemainingSeconds,
        totalSeconds: pomodoroTotalSeconds,
        mode: timerPresentationMode,
        focusMode,
        activeTaskId: activeTimerTaskId,
        selectedMinutes,
        completedSessions,
        soundEnabled,
        voiceEnabled,
        lastCompletedStart: lastCompletedStartRef.current,
        ...overrides
      };
      safeStorage.set('proton_focus_timer_state', JSON.stringify(snapshot));
    } catch {
      // Safe storage fallback
    }
  }, [
    isTimerRunning,
    pomodoroRemainingSeconds,
    pomodoroTotalSeconds,
    timerPresentationMode,
    focusMode,
    activeTimerTaskId,
    selectedMinutes,
    completedSessions,
    soundEnabled,
    voiceEnabled
  ]);

  // Flush active task elapsed time to persistence
  const flushActiveTimerTaskTime = useCallback(() => {
    if (activeTimerTaskId) {
      const currentSec = localTimerSecondsRef.current[activeTimerTaskId];
      if (currentSec !== undefined) {
        onEditTask(activeTimerTaskId, { elapsedTime: currentSec });
      }
    }
  }, [activeTimerTaskId, onEditTask]);

  // Core Pomodoro completion handler (guaranteed exactly-once execution per session)
  const completePomodoroSession = useCallback((sessionStart: number) => {
    if (lastCompletedStartRef.current === sessionStart) {
      return; // Deduplication: already completed this session
    }
    lastCompletedStartRef.current = sessionStart;

    setIsTimerRunning(false);
    timerStartTimestampRef.current = 0;
    safeStorage.remove('proton_active_timer_running');
    safeStorage.remove('proton_active_timer_start');

    // Flush active task accumulated elapsed time
    if (activeTimerTaskId) {
      const currentSec = localTimerSecondsRef.current[activeTimerTaskId];
      if (currentSec !== undefined) {
        onEditTask(activeTimerTaskId, { elapsedTime: currentSec });
      }
    }

    if (focusMode === 'work') {
      const nextSessions = completedSessions + 1;
      setCompletedSessions(nextSessions);
      safeStorage.set('proton_focus_completed_sessions', String(nextSessions));

      notifyFocusEvent('complete', 'work', language, soundEnabled, voiceEnabled);

      setFocusMode('break');
      const breakSec = 5 * 60;
      setPomodoroTotalSeconds(breakSec);
      setPomodoroRemainingSeconds(breakSec);
      baseRemainingSecondsRef.current = breakSec;

      persistTimerSnapshot({
        isRunning: false,
        startTimestamp: 0,
        remainingSeconds: breakSec,
        totalSeconds: breakSec,
        focusMode: 'break',
        completedSessions: nextSessions,
        lastCompletedStart: sessionStart
      });
    } else {
      notifyFocusEvent('complete', 'break', language, soundEnabled, voiceEnabled);

      setFocusMode('work');
      const workSec = selectedMinutes * 60;
      setPomodoroTotalSeconds(workSec);
      setPomodoroRemainingSeconds(workSec);
      baseRemainingSecondsRef.current = workSec;

      persistTimerSnapshot({
        isRunning: false,
        startTimestamp: 0,
        remainingSeconds: workSec,
        totalSeconds: workSec,
        focusMode: 'work',
        lastCompletedStart: sessionStart
      });
    }
  }, [
    activeTimerTaskId,
    focusMode,
    completedSessions,
    language,
    soundEnabled,
    voiceEnabled,
    selectedMinutes,
    onEditTask,
    persistTimerSnapshot
  ]);

  // Timestamp-based reconciliation (runs on interval tick, tab visibility change, or page reload)
  const reconcileTimerState = useCallback(() => {
    const start = timerStartTimestampRef.current;
    if (!start || start <= 0) return;

    const now = Date.now();
    const elapsedSec = Math.max(0, Math.floor((now - start) / 1000));

    if (timerPresentationMode === 'pomodoro') {
      const targetSec = baseRemainingSecondsRef.current;
      const remaining = Math.max(0, targetSec - elapsedSec);
      setPomodoroRemainingSeconds(remaining);

      // Accumulate task elapsed time if a task is bound
      if (activeTimerTaskId) {
        const initialTaskSec = baseTaskElapsedRef.current;
        const currentTaskSec = initialTaskSec + elapsedSec;
        setLocalTimerSeconds(prev => ({ ...prev, [activeTimerTaskId]: currentTaskSec }));
      }

      if (remaining <= 0) {
        completePomodoroSession(start);
      }
    } else {
      // Stopwatch mode
      if (activeTimerTaskId) {
        const initialTaskSec = baseTaskElapsedRef.current;
        const currentTaskSec = initialTaskSec + elapsedSec;
        setLocalTimerSeconds(prev => ({ ...prev, [activeTimerTaskId]: currentTaskSec }));
      }
    }
  }, [timerPresentationMode, activeTimerTaskId, completePomodoroSession]);

  // Initial mount recovery from safeStorage (page reload / tab restore)
  useEffect(() => {
    // 1. Try unified JSON state first
    let unified: FocusTimerStateJSON | null = null;
    const rawState = safeStorage.get('proton_focus_timer_state');
    if (rawState) {
      try {
        unified = JSON.parse(rawState);
      } catch {
        unified = null;
      }
    }

    const wasRunning = unified ? unified.isRunning : safeStorage.get('proton_active_timer_running') === 'true';
    const savedStart = unified ? unified.startTimestamp : parseInt(safeStorage.get('proton_active_timer_start') || '0', 10);
    const savedTaskId = unified ? unified.activeTaskId : (safeStorage.get('proton_active_timer_task_id') || null);
    const savedMode = unified ? unified.mode : ((safeStorage.get('proton_active_timer_mode') as 'pomodoro' | 'stopwatch') || 'pomodoro');
    const savedFocusMode = unified ? unified.focusMode : ((safeStorage.get('proton_active_focus_mode') as 'work' | 'break') || 'work');
    const savedRemaining = unified ? unified.remainingSeconds : parseInt(safeStorage.get('proton_active_timer_remaining') || '0', 10);
    const savedLastCompleted = unified?.lastCompletedStart || 0;

    if (savedLastCompleted > 0) {
      lastCompletedStartRef.current = savedLastCompleted;
    }

    setTimerPresentationMode(savedMode);
    setFocusMode(savedFocusMode);

    if (savedTaskId) {
      const found = tasksRef.current.find(t => t.id === savedTaskId);
      if (found && !found.completed) {
        setActiveTimerTaskId(savedTaskId);
        baseTaskElapsedRef.current = found.elapsedTime || 0;
      }
    }

    if (savedMode === 'pomodoro') {
      const total = savedFocusMode === 'work' ? selectedMinutes * 60 : 5 * 60;
      setPomodoroTotalSeconds(total);

      if (wasRunning && savedStart > 0) {
        const deltaSec = Math.max(0, Math.floor((Date.now() - savedStart) / 1000));
        if (savedRemaining > deltaSec) {
          const remaining = savedRemaining - deltaSec;
          setPomodoroRemainingSeconds(remaining);
          timerStartTimestampRef.current = savedStart;
          baseRemainingSecondsRef.current = savedRemaining;
          setIsTimerRunning(true);
        } else {
          // Completed while tab was closed/reloading
          setPomodoroRemainingSeconds(0);
          setIsTimerRunning(false);
          safeStorage.remove('proton_active_timer_running');
          safeStorage.remove('proton_active_timer_start');
          // Deduplicated completion recording
          if (lastCompletedStartRef.current !== savedStart) {
            completePomodoroSession(savedStart);
          }
        }
      } else {
        const initialRemaining = savedRemaining > 0 ? savedRemaining : total;
        setPomodoroRemainingSeconds(initialRemaining);
        baseRemainingSecondsRef.current = initialRemaining;
      }
    } else {
      // Stopwatch mode
      if (wasRunning && savedStart > 0) {
        const deltaSec = Math.max(0, Math.floor((Date.now() - savedStart) / 1000));
        timerStartTimestampRef.current = savedStart;
        if (savedTaskId) {
          const initialSec = baseTaskElapsedRef.current + deltaSec;
          setLocalTimerSeconds(prev => ({ ...prev, [savedTaskId]: initialSec }));
        }
        setIsTimerRunning(true);
      }
    }
  }, [selectedMinutes, completePomodoroSession]);

  // The SINGLE, authoritative App-level timing interval
  useEffect(() => {
    if (!isTimerRunning) return;

    let tickCount = 0;
    const interval = setInterval(() => {
      tickCount++;
      reconcileTimerState();

      // Periodic batch persistence to Firestore every 30 seconds for Stopwatch
      if (tickCount % 30 === 0 && activeTimerTaskId) {
        const currentSec = localTimerSecondsRef.current[activeTimerTaskId];
        if (currentSec !== undefined) {
          onEditTask(activeTimerTaskId, { elapsedTime: currentSec });
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isTimerRunning, reconcileTimerState, activeTimerTaskId, onEditTask]);

  // Browser visibility change & focus listeners (instantly catches up on throttled/suspended tabs)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && isTimerRunning) {
        reconcileTimerState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isTimerRunning, reconcileTimerState]);

  // Control Handlers
  const handleToggleTimer = useCallback((id: string) => {
    if (activeTimerTaskId === id) {
      if (isTimerRunning) {
        // Pause active stopwatch
        flushActiveTimerTaskTime();
        setIsTimerRunning(false);
        timerStartTimestampRef.current = 0;
        safeStorage.remove('proton_active_timer_running');
        safeStorage.remove('proton_active_timer_start');
        persistTimerSnapshot({ isRunning: false, startTimestamp: 0 });
      } else {
        // Resume active stopwatch
        const now = Date.now();
        const curTask = tasksRef.current.find(t => t.id === id);
        const curElapsed = localTimerSecondsRef.current[id] ?? curTask?.elapsedTime ?? 0;
        baseTaskElapsedRef.current = curElapsed;
        timerStartTimestampRef.current = now;

        setTimerPresentationMode('stopwatch');
        setIsTimerRunning(true);
        safeStorage.set('proton_active_timer_running', 'true');
        safeStorage.set('proton_active_timer_start', now.toString());
        safeStorage.set('proton_active_timer_task_id', id);
        safeStorage.set('proton_active_timer_mode', 'stopwatch');

        persistTimerSnapshot({
          isRunning: true,
          startTimestamp: now,
          activeTaskId: id,
          mode: 'stopwatch'
        });
      }
    } else {
      // Switching stopwatch to a new task
      flushActiveTimerTaskTime();
      const nextTask = tasksRef.current.find(tk => tk.id === id);
      const nextSeconds = nextTask ? (nextTask.elapsedTime || 0) : 0;
      setLocalTimerSeconds(prev => ({
        ...prev,
        [id]: prev[id] !== undefined ? prev[id] : nextSeconds
      }));

      const now = Date.now();
      baseTaskElapsedRef.current = nextSeconds;
      timerStartTimestampRef.current = now;
      setActiveTimerTaskId(id);
      setTimerPresentationMode('stopwatch');
      setIsTimerRunning(true);

      safeStorage.set('proton_active_timer_running', 'true');
      safeStorage.set('proton_active_timer_start', now.toString());
      safeStorage.set('proton_active_timer_task_id', id);
      safeStorage.set('proton_active_timer_mode', 'stopwatch');

      persistTimerSnapshot({
        isRunning: true,
        startTimestamp: now,
        activeTaskId: id,
        mode: 'stopwatch'
      });
    }
  }, [activeTimerTaskId, isTimerRunning, flushActiveTimerTaskTime, persistTimerSnapshot]);

  const handleToggleFocusTimerRunning = useCallback((fallbackTaskId?: string | null) => {
    if (isTimerRunning) {
      flushActiveTimerTaskTime();
      setIsTimerRunning(false);
      timerStartTimestampRef.current = 0;
      safeStorage.remove('proton_active_timer_running');
      safeStorage.remove('proton_active_timer_start');
      if (soundEnabled) playFocusChime('click');
      persistTimerSnapshot({ isRunning: false, startTimestamp: 0 });
    } else {
      const now = Date.now();
      timerStartTimestampRef.current = now;
      baseRemainingSecondsRef.current = pomodoroRemainingSeconds;

      // Bind fallback task if none selected
      let targetTaskId = activeTimerTaskId;
      if (!targetTaskId && fallbackTaskId) {
        const fbTask = tasksRef.current.find(t => t.id === fallbackTaskId);
        if (fbTask && !fbTask.completed) {
          targetTaskId = fallbackTaskId;
          setActiveTimerTaskId(fallbackTaskId);
          baseTaskElapsedRef.current = fbTask.elapsedTime || 0;
          setLocalTimerSeconds(prev => ({
            ...prev,
            [fallbackTaskId]: prev[fallbackTaskId] !== undefined ? prev[fallbackTaskId] : (fbTask.elapsedTime || 0)
          }));
        }
      } else if (targetTaskId) {
        const curTask = tasksRef.current.find(t => t.id === targetTaskId);
        baseTaskElapsedRef.current = localTimerSecondsRef.current[targetTaskId] ?? curTask?.elapsedTime ?? 0;
      }

      setIsTimerRunning(true);
      safeStorage.set('proton_active_timer_running', 'true');
      safeStorage.set('proton_active_timer_start', now.toString());
      safeStorage.set('proton_active_timer_task_id', targetTaskId || '');
      safeStorage.set('proton_active_timer_mode', timerPresentationMode);
      safeStorage.set('proton_active_focus_mode', focusMode);
      safeStorage.set('proton_active_timer_remaining', pomodoroRemainingSeconds.toString());

      persistTimerSnapshot({
        isRunning: true,
        startTimestamp: now,
        activeTaskId: targetTaskId,
        mode: timerPresentationMode,
        focusMode,
        remainingSeconds: pomodoroRemainingSeconds
      });

      notifyFocusEvent('start', focusMode, language, soundEnabled, voiceEnabled);
    }
  }, [
    isTimerRunning,
    activeTimerTaskId,
    pomodoroRemainingSeconds,
    timerPresentationMode,
    focusMode,
    language,
    soundEnabled,
    voiceEnabled,
    flushActiveTimerTaskTime,
    persistTimerSnapshot
  ]);

  const handleResetFocusTimer = useCallback(() => {
    flushActiveTimerTaskTime();
    setIsTimerRunning(false);
    timerStartTimestampRef.current = 0;
    safeStorage.remove('proton_active_timer_running');
    safeStorage.remove('proton_active_timer_start');

    if (timerPresentationMode === 'pomodoro') {
      const sec = selectedMinutes * 60;
      setPomodoroRemainingSeconds(sec);
      setPomodoroTotalSeconds(sec);
      baseRemainingSecondsRef.current = sec;
      setFocusMode('work');

      persistTimerSnapshot({
        isRunning: false,
        startTimestamp: 0,
        remainingSeconds: sec,
        totalSeconds: sec,
        focusMode: 'work'
      });
    }

    if (soundEnabled) playFocusChime('click');
  }, [flushActiveTimerTaskTime, timerPresentationMode, selectedMinutes, soundEnabled, persistTimerSnapshot]);

  const handleModeSwitch = useCallback((mode: 'work' | 'break') => {
    flushActiveTimerTaskTime();
    setFocusMode(mode);
    const sec = mode === 'work' ? selectedMinutes * 60 : 5 * 60;
    setPomodoroRemainingSeconds(sec);
    setPomodoroTotalSeconds(sec);
    baseRemainingSecondsRef.current = sec;

    if (isTimerRunning) {
      const now = Date.now();
      timerStartTimestampRef.current = now;
      safeStorage.set('proton_active_focus_mode', mode);
      safeStorage.set('proton_active_timer_remaining', sec.toString());
      safeStorage.set('proton_active_timer_start', now.toString());

      persistTimerSnapshot({
        startTimestamp: now,
        focusMode: mode,
        remainingSeconds: sec,
        totalSeconds: sec
      });
    } else {
      persistTimerSnapshot({
        focusMode: mode,
        remainingSeconds: sec,
        totalSeconds: sec
      });
    }
  }, [flushActiveTimerTaskTime, selectedMinutes, isTimerRunning, persistTimerSnapshot]);

  const handleApplyDuration = useCallback((minutes: number) => {
    setSelectedMinutes(minutes);
    safeStorage.set('proton_focus_minutes', String(minutes));

    if (focusMode === 'work') {
      const sec = minutes * 60;
      setPomodoroRemainingSeconds(sec);
      setPomodoroTotalSeconds(sec);
      baseRemainingSecondsRef.current = sec;

      if (isTimerRunning) {
        const now = Date.now();
        timerStartTimestampRef.current = now;
        safeStorage.set('proton_active_timer_remaining', sec.toString());
        safeStorage.set('proton_active_timer_start', now.toString());
        persistTimerSnapshot({
          startTimestamp: now,
          selectedMinutes: minutes,
          remainingSeconds: sec,
          totalSeconds: sec
        });
      } else {
        persistTimerSnapshot({
          selectedMinutes: minutes,
          remainingSeconds: sec,
          totalSeconds: sec
        });
      }
    }
  }, [focusMode, isTimerRunning, persistTimerSnapshot]);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      safeStorage.set('proton_focus_sound_enabled', String(next));
      persistTimerSnapshot({ soundEnabled: next });
      return next;
    });
  }, [persistTimerSnapshot]);

  const handleToggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const next = !prev;
      safeStorage.set('proton_focus_voice_enabled', String(next));
      persistTimerSnapshot({ voiceEnabled: next });
      return next;
    });
  }, [persistTimerSnapshot]);

  const handleToggleTimerMode = useCallback((mode: 'stopwatch' | 'pomodoro') => {
    setTimerPresentationMode(mode);
    if (isTimerRunning) {
      safeStorage.set('proton_active_timer_mode', mode);
      persistTimerSnapshot({ mode });
    }
  }, [isTimerRunning, persistTimerSnapshot]);

  const handleToggleTaskWithTimer = useCallback((id: string, onToggleTask: (taskId: string) => void) => {
    if (activeTimerTaskId === id) {
      const currentSec = localTimerSecondsRef.current[id];
      if (currentSec !== undefined) {
        onEditTask(id, { elapsedTime: currentSec });
      }
      setIsTimerRunning(false);
      setActiveTimerTaskId(null);
      timerStartTimestampRef.current = 0;
      safeStorage.remove('proton_active_timer_running');
      safeStorage.remove('proton_active_timer_start');
      persistTimerSnapshot({ isRunning: false, startTimestamp: 0, activeTaskId: null });
    }
    onToggleTask(id);
  }, [activeTimerTaskId, onEditTask, persistTimerSnapshot]);

  return {
    isTimerRunning,
    activeTimerTaskId,
    timerPresentationMode,
    focusMode,
    pomodoroRemainingSeconds,
    pomodoroTotalSeconds,
    pomodoroSelectedMinutes: selectedMinutes,
    completedSessions,
    soundEnabled,
    voiceEnabled,
    localTimerSeconds,
    setActiveTimerTaskId,
    handleToggleTimer,
    handleToggleFocusTimerRunning,
    handleResetFocusTimer,
    handleModeSwitch,
    handleApplyDuration,
    handleToggleSound,
    handleToggleVoice,
    handleToggleTimerMode,
    handleToggleTaskWithTimer,
    flushActiveTimerTaskTime
  };
}
