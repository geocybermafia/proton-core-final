import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Clock, 
  Sparkles, 
  Settings, 
  Maximize2, 
  X, 
  CheckCircle2, 
  Coffee, 
  Zap, 
  Sliders,
  Flame,
  Volume1,
  Target
} from 'lucide-react';
import { cn } from '../lib/utils';
import { notifyFocusEvent, playFocusChime, speakFocusMessage } from '../lib/focusAudio';
import { Task } from '../types';

export interface FocusTimerWidgetProps {
  language: 'en' | 'ka';
  className?: string;
  variant?: 'compact' | 'expanded';
  onExpandZen?: () => void;
  // Controlled props for unified timer engine
  activeTask?: Task | null;
  isRunning?: boolean;
  timerMode?: 'stopwatch' | 'pomodoro';
  pomodoroMode?: 'work' | 'break';
  displaySeconds?: number;
  totalSeconds?: number;
  selectedMinutes?: number;
  completedSessions?: number;
  soundEnabled?: boolean;
  voiceEnabled?: boolean;
  onToggleRunning?: () => void;
  onReset?: () => void;
  onModeSwitch?: (mode: 'work' | 'break') => void;
  onApplyDuration?: (minutes: number) => void;
  onToggleSound?: () => void;
  onToggleVoice?: () => void;
  onToggleTimerMode?: (mode: 'stopwatch' | 'pomodoro') => void;
}

export const FocusTimerWidget: React.FC<FocusTimerWidgetProps> = ({
  language,
  className,
  variant = 'compact',
  onExpandZen,
  activeTask,
  isRunning: propIsRunning,
  timerMode: propTimerMode,
  pomodoroMode: propPomodoroMode,
  displaySeconds: propDisplaySeconds,
  totalSeconds: propTotalSeconds,
  selectedMinutes: propSelectedMinutes,
  completedSessions: propCompletedSessions,
  soundEnabled: propSoundEnabled,
  voiceEnabled: propVoiceEnabled,
  onToggleRunning,
  onReset,
  onModeSwitch,
  onApplyDuration,
  onToggleSound,
  onToggleVoice,
  onToggleTimerMode
}) => {
  // Determine if widget is operating in controlled mode via OrganizerView's unified timer engine
  const isControlled = propIsRunning !== undefined && propDisplaySeconds !== undefined && onToggleRunning !== undefined;

  // ---------------------------------------------------------------------------
  // 1. PERSISTENT SETTINGS & LOCAL FALLBACK STATE
  // ---------------------------------------------------------------------------
  const [localSelectedMinutes, setLocalSelectedMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('proton_focus_minutes');
      return saved ? Math.max(1, parseInt(saved, 10)) : 25;
    } catch {
      return 25;
    }
  });

  const [localFocusMode, setLocalFocusMode] = useState<'work' | 'break'>('work');
  const [localFocusSeconds, setLocalFocusSeconds] = useState<number>(() => localSelectedMinutes * 60);
  const [localTotalSeconds, setLocalTotalSeconds] = useState<number>(() => localSelectedMinutes * 60);
  const [localIsRunning, setLocalIsRunning] = useState<boolean>(false);
  const [localCompletedSessions, setLocalCompletedSessions] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('proton_focus_completed_sessions');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Audio & Voice Preferences
  const [localSoundEnabled, setLocalSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('proton_focus_sound_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [localVoiceEnabled, setLocalVoiceEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('proton_focus_voice_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Modals & Panels
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [customInputVal, setCustomInputVal] = useState<string>(String(propSelectedMinutes ?? localSelectedMinutes));
  const [isZenOpen, setIsZenOpen] = useState<boolean>(false);
  const [zenTaskNote, setZenTaskNote] = useState<string>('');

  // Effective unified states
  const effectiveIsRunning = isControlled ? propIsRunning : localIsRunning;
  const effectiveDisplaySeconds = isControlled ? propDisplaySeconds : localFocusSeconds;
  const effectiveTotalSeconds = isControlled ? (propTotalSeconds ?? 1500) : localTotalSeconds;
  const effectiveFocusMode = isControlled ? (propPomodoroMode ?? 'work') : localFocusMode;
  const effectiveSelectedMinutes = isControlled ? (propSelectedMinutes ?? 25) : localSelectedMinutes;
  const effectiveCompletedSessions = isControlled ? (propCompletedSessions ?? 0) : localCompletedSessions;
  const effectiveSoundEnabled = isControlled && propSoundEnabled !== undefined ? propSoundEnabled : localSoundEnabled;
  const effectiveVoiceEnabled = isControlled && propVoiceEnabled !== undefined ? propVoiceEnabled : localVoiceEnabled;
  const effectiveTimerMode = propTimerMode ?? 'pomodoro';

  // ---------------------------------------------------------------------------
  // 2. TIMERS & TICKS (ONLY ACTIVE IF UNCONTROLLED)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // When controlled by OrganizerView, ZERO timer intervals run inside FocusTimerWidget!
    if (isControlled) return;

    let interval: NodeJS.Timeout | null = null;
    if (localIsRunning && localFocusSeconds > 0) {
      interval = setInterval(() => {
        setLocalFocusSeconds((prev) => {
          if (prev <= 1) {
            setLocalIsRunning(false);
            if (localFocusMode === 'work') {
              setLocalCompletedSessions((cnt) => {
                const next = cnt + 1;
                try {
                  localStorage.setItem('proton_focus_completed_sessions', String(next));
                } catch {}
                return next;
              });
              notifyFocusEvent('complete', 'work', language, localSoundEnabled, localVoiceEnabled);
              setLocalFocusMode('break');
              const breakSec = 5 * 60;
              setLocalTotalSeconds(breakSec);
              return breakSec;
            } else {
              notifyFocusEvent('complete', 'break', language, localSoundEnabled, localVoiceEnabled);
              setLocalFocusMode('work');
              const workSec = localSelectedMinutes * 60;
              setLocalTotalSeconds(workSec);
              return workSec;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isControlled, localIsRunning, localFocusSeconds, localFocusMode, localSelectedMinutes, language, localSoundEnabled, localVoiceEnabled]);

  // Sync to local storage for uncontrolled fallback
  useEffect(() => {
    if (!isControlled) {
      try {
        localStorage.setItem('proton_focus_sound_enabled', String(localSoundEnabled));
      } catch {}
    }
  }, [isControlled, localSoundEnabled]);

  useEffect(() => {
    if (!isControlled) {
      try {
        localStorage.setItem('proton_focus_voice_enabled', String(localVoiceEnabled));
      } catch {}
    }
  }, [isControlled, localVoiceEnabled]);

  useEffect(() => {
    if (!isControlled) {
      try {
        localStorage.setItem('proton_focus_minutes', String(localSelectedMinutes));
      } catch {}
    }
  }, [isControlled, localSelectedMinutes]);

  // Keep customInputVal in sync with selected minutes
  useEffect(() => {
    setCustomInputVal(String(effectiveSelectedMinutes));
  }, [effectiveSelectedMinutes]);

  // ---------------------------------------------------------------------------
  // 3. ACTION HANDLERS
  // ---------------------------------------------------------------------------
  const handleStartPause = () => {
    if (isControlled && onToggleRunning) {
      onToggleRunning();
      return;
    }
    if (!localIsRunning) {
      setLocalIsRunning(true);
      notifyFocusEvent('start', localFocusMode, language, localSoundEnabled, localVoiceEnabled, localFocusMode === 'work' ? Math.ceil(localFocusSeconds / 60) : undefined);
    } else {
      setLocalIsRunning(false);
      playFocusChime('click');
    }
  };

  const handleReset = () => {
    if (isControlled && onReset) {
      onReset();
      return;
    }
    setLocalIsRunning(false);
    playFocusChime('click');
    const resetSec = (localFocusMode === 'work' ? localSelectedMinutes : 5) * 60;
    setLocalFocusSeconds(resetSec);
    setLocalTotalSeconds(resetSec);
  };

  const applyCustomDuration = (minutes: number) => {
    const mins = Math.max(1, Math.min(360, minutes));
    setCustomInputVal(String(mins));
    setIsSettingsOpen(false);
    if (isControlled && onApplyDuration) {
      onApplyDuration(mins);
      return;
    }
    setLocalSelectedMinutes(mins);
    setLocalIsRunning(false);
    setLocalFocusMode('work');
    const newSec = mins * 60;
    setLocalFocusSeconds(newSec);
    setLocalTotalSeconds(newSec);
    playFocusChime('start');
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customInputVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      applyCustomDuration(parsed);
    }
  };

  const handleQuickPreset = (mins: number) => {
    applyCustomDuration(mins);
  };

  const handleModeSwitch = (mode: 'work' | 'break') => {
    if (isControlled && onModeSwitch) {
      onModeSwitch(mode);
      return;
    }
    setLocalIsRunning(false);
    playFocusChime('click');
    setLocalFocusMode(mode);
    const secs = (mode === 'work' ? localSelectedMinutes : 5) * 60;
    setLocalFocusSeconds(secs);
    setLocalTotalSeconds(secs);
  };

  const handleToggleSound = () => {
    if (isControlled && onToggleSound) {
      onToggleSound();
      return;
    }
    setLocalSoundEnabled(!localSoundEnabled);
  };

  const handleToggleVoice = () => {
    if (isControlled && onToggleVoice) {
      onToggleVoice();
      return;
    }
    setLocalVoiceEnabled(!localVoiceEnabled);
  };

  // Test voice handler
  const handleTestVoice = () => {
    playFocusChime('start');
    setTimeout(() => {
      speakFocusMessage(
        language === 'ka' 
          ? 'ხმოვანი შეტყობინება აქტიურია. წარმატებულ ფოკუსს გისურვებთ!' 
          : 'Voice notification is active and working properly!',
        language
      );
    }, 400);
  };

  // ---------------------------------------------------------------------------
  // 4. FORMATTERS & PERCENTAGE
  // ---------------------------------------------------------------------------
  const formattedTimer = useMemo(() => {
    const hours = Math.floor(effectiveDisplaySeconds / 3600);
    const minutes = Math.floor((effectiveDisplaySeconds % 3600) / 60);
    const seconds = effectiveDisplaySeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [effectiveDisplaySeconds]);

  const progressPercent = useMemo(() => {
    if (effectiveTotalSeconds <= 0) return 0;
    if (effectiveTimerMode === 'stopwatch') {
      return Math.min(100, ((effectiveDisplaySeconds % 3600) / 3600) * 100);
    }
    const elapsed = effectiveTotalSeconds - effectiveDisplaySeconds;
    return Math.min(100, Math.max(0, (elapsed / effectiveTotalSeconds) * 100));
  }, [effectiveDisplaySeconds, effectiveTotalSeconds, effectiveTimerMode]);

  return (
    <>
      {/* ========================================================================= */}
      {/* COMPACT DASHBOARD FOCUS WIDGET                                            */}
      {/* ========================================================================= */}
      <div className={cn(
        "relative rounded-2xl bg-zinc-950/90 border border-zinc-800/90 p-3 sm:p-3.5 shadow-xl transition-all",
        effectiveIsRunning && "border-amber-500/40 shadow-amber-500/5 ring-1 ring-amber-500/20",
        className
      )}>
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          
          {/* Status, Mode Pill & Digital Clock */}
          <div className="flex items-center gap-3">
            {/* Progress Circular Accent or Icon */}
            <div 
              onClick={() => handleModeSwitch(effectiveFocusMode === 'work' ? 'break' : 'work')}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all border shrink-0 relative group",
                effectiveTimerMode === 'stopwatch'
                  ? (effectiveIsRunning ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-zinc-900 text-amber-400/80 border-zinc-800 hover:border-amber-500/30")
                  : effectiveFocusMode === 'work' 
                    ? (effectiveIsRunning ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-zinc-900 text-amber-400/80 border-zinc-800 hover:border-amber-500/30") 
                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              )}
              title={effectiveTimerMode === 'stopwatch'
                ? (language === 'ka' ? 'წამმზომი (დროის ზრდადი აღრიცხვა)' : 'Stopwatch (Count Up)')
                : (language === 'ka' ? 'დააკლიკეთ რეჟიმის შესაცვლელად (ფოკუსი / შესვენება)' : 'Click to toggle Work / Break')}
            >
              {effectiveTimerMode === 'stopwatch' ? (
                <Clock size={18} className={cn(effectiveIsRunning && "animate-pulse text-amber-400")} />
              ) : effectiveFocusMode === 'work' ? (
                <Flame size={18} className={cn(effectiveIsRunning && "animate-pulse text-amber-400")} />
              ) : (
                <Coffee size={18} className="text-emerald-400" />
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  effectiveIsRunning 
                    ? (effectiveTimerMode === 'stopwatch' || effectiveFocusMode === 'work' ? "bg-amber-400 animate-ping" : "bg-emerald-400 animate-ping") 
                    : "bg-zinc-600"
                )} />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  {effectiveTimerMode === 'stopwatch'
                    ? (language === 'ka' ? 'წამმზომი' : 'Stopwatch')
                    : effectiveFocusMode === 'work' 
                      ? (language === 'ka' ? 'ფოკუსი' : 'Focus Mode') 
                      : (language === 'ka' ? 'შესვენება' : 'Break')}
                  <span className="text-zinc-600">·</span>
                  {effectiveTimerMode === 'pomodoro' ? (
                    <button 
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="text-amber-400 hover:text-amber-300 font-black cursor-pointer underline decoration-amber-500/40 hover:decoration-amber-400 transition-colors"
                      title={language === 'ka' ? 'დააკლიკეთ დროის შესაცვლელად' : 'Click to change time'}
                    >
                      {effectiveSelectedMinutes}m ⚙️
                    </button>
                  ) : (
                    <span className="text-zinc-400 font-mono text-[9px] lowercase">
                      {language === 'ka' ? 'ზრდადი' : 'count up'}
                    </span>
                  )}
                </span>
                {onToggleTimerMode && (
                  <button
                    type="button"
                    onClick={() => onToggleTimerMode(effectiveTimerMode === 'pomodoro' ? 'stopwatch' : 'pomodoro')}
                    className="ml-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-zinc-800 hover:border-zinc-700 bg-zinc-900/80 text-zinc-400 hover:text-amber-400 transition-all cursor-pointer"
                    title={language === 'ka' ? 'რეჟიმის შეცვლა (პომოდორო / წამმზომი)' : 'Toggle Pomodoro / Stopwatch'}
                  >
                    {effectiveTimerMode === 'pomodoro' ? '⏱️ Stopwatch' : '⏳ Pomodoro'}
                  </button>
                )}
              </div>

              <div className="text-2xl font-black font-mono tracking-tight text-white flex items-center gap-2">
                <span>{formattedTimer}</span>
                {effectiveCompletedSessions > 0 && effectiveTimerMode === 'pomodoro' && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold" title={language === 'ka' ? `${effectiveCompletedSessions} დასრულებული სესია` : `${effectiveCompletedSessions} completed sessions`}>
                    ★ {effectiveCompletedSessions}
                  </span>
                )}
              </div>

              {/* Active Targeted Task Pill */}
              {activeTask && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400/90 font-bold truncate max-w-[200px] sm:max-w-[260px] mt-0.5" title={activeTask.content}>
                  <Target size={11} className="shrink-0 text-amber-400" />
                  <span className="truncate">{language === 'ka' ? (activeTask.contentGe || activeTask.content) : activeTask.content}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-2.5 sm:pl-3">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={handleStartPause}
              className={cn(
                "p-2.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-95",
                effectiveIsRunning 
                  ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black shadow-amber-500/20" 
                  : "bg-zinc-800 hover:bg-zinc-700 text-white"
              )}
              title={effectiveIsRunning ? (language === 'ka' ? 'დაპაუზება' : 'Pause') : (language === 'ka' ? 'დაწყება' : 'Start Focus')}
            >
              {effectiveIsRunning ? <Pause size={15} className="fill-current" /> : <Play size={15} className="fill-current" />}
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={handleReset}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer active:scale-95"
              title={language === 'ka' ? 'განულება' : 'Reset Timer'}
            >
              <RotateCcw size={14} />
            </button>

            {/* Custom Time & Sound Settings Trigger */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-2 rounded-xl transition-all cursor-pointer relative active:scale-95 border",
                isSettingsOpen 
                  ? "bg-amber-500 text-zinc-950 border-amber-400 font-bold shadow-md shadow-amber-500/20" 
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 border-zinc-800"
              )}
              title={language === 'ka' ? 'დროის მითითება და ხმის პარამეტრები' : 'Custom Duration & Audio'}
            >
              <Sliders size={14} />
              <span className="text-[10px] font-bold hidden md:inline">
                {language === 'ka' ? 'დრო & ხმა' : 'Time & Sound'}
              </span>
              {(effectiveSoundEnabled || effectiveVoiceEnabled) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>

            {/* Expand Fullscreen Zen Space */}
            <button
              type="button"
              onClick={() => {
                if (onExpandZen) {
                  onExpandZen();
                } else {
                  setIsZenOpen(true);
                }
              }}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer hidden sm:flex active:scale-95"
              title={language === 'ka' ? 'სრული ეკრანის ზენ რეჟიმი' : 'Full Zen Screen'}
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* Mini progress bar below widget */}
        <div className="w-full h-1 bg-zinc-900 rounded-full mt-2.5 overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-500 rounded-full",
              effectiveTimerMode === 'stopwatch'
                ? "bg-amber-400"
                : effectiveFocusMode === 'work' ? "bg-amber-400" : "bg-emerald-400"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* ========================================================================= */}
        {/* CUSTOM TIME & AUDIO DIALOG / MODAL (CENTERED & FULLY VISIBLE)             */}
        {/* ========================================================================= */}
        {isSettingsOpen && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setIsSettingsOpen(false)}
          >
            <div 
              className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl bg-[#0e1322] border border-amber-500/30 p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-200 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h4 className="text-base font-black uppercase tracking-wider text-white">
                      {language === 'ka' ? 'ფოკუსის პარამეტრები' : 'Focus Duration & Audio'}
                    </h4>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      {language === 'ka' ? 'დროის თავისუფალი მითითება და შეტყობინებები' : 'Custom interval & voice announcements'}
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2.5 mb-6">
                <label className="text-[11px] font-black uppercase tracking-widest text-amber-400/90 block">
                  {language === 'ka' ? 'სწრაფი პროფილები (Preset)' : 'Quick Presets'}
                </label>
                <div className="grid grid-cols-4 gap-2.5">
                  {[
                    { mins: 15, label: '15 წთ', sub: 'Sprint' },
                    { mins: 25, label: '25 წთ', sub: 'Classic' },
                    { mins: 45, label: '45 წთ', sub: 'Deep' },
                    { mins: 60, label: '60 წთ', sub: 'Power' },
                  ].map((item) => (
                    <button
                      key={item.mins}
                      type="button"
                      onClick={() => handleQuickPreset(item.mins)}
                      className={cn(
                        "py-3 px-2 rounded-2xl text-xs font-black transition-all border cursor-pointer text-center active:scale-95 shadow-sm",
                        effectiveSelectedMinutes === item.mins && effectiveFocusMode === 'work'
                          ? "bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/30"
                          : "bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white hover:bg-zinc-800"
                      )}
                    >
                      <div className="text-sm font-bold leading-tight">{item.label}</div>
                      <div className="text-[9px] opacity-70 uppercase font-mono mt-1">{item.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Minutes Input */}
              <form onSubmit={handleCustomSubmit} className="space-y-2.5 mb-6 pb-6 border-b border-zinc-800/80">
                <label className="text-[11px] font-black uppercase tracking-widest text-amber-400/90 block">
                  {language === 'ka' ? 'მორგებული დრო (წუთები)' : 'Custom Time (Minutes)'}
                </label>
                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      max="360"
                      value={customInputVal}
                      onChange={(e) => setCustomInputVal(e.target.value)}
                      placeholder={language === 'ka' ? 'მაგ. 35 ან 90' : 'e.g. 35 or 90'}
                      className="w-full bg-zinc-900/90 border border-zinc-700 text-white font-mono font-bold text-base px-4 py-3 rounded-2xl focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-zinc-400 uppercase">
                      {language === 'ka' ? 'წუთი' : 'min'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#dfb257] hover:bg-[#dfb257]/90 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md hover:shadow-amber-500/20 active:scale-95 shrink-0 cursor-pointer"
                  >
                    {language === 'ka' ? 'დაყენება' : 'Set Time'}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 font-mono pt-1">
                  <span>{language === 'ka' ? '1-დან 360 წუთამდე' : '1 to 360 minutes'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 font-bold">{language === 'ka' ? 'სწრაფი:' : 'Quick:'}</span>
                    {[5, 10, 30, 90].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => applyCustomDuration(m)}
                        className="text-amber-400 hover:text-amber-300 font-black underline cursor-pointer"
                      >
                        +{m}m
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              {/* Audio & Voice Notification Settings */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-widest text-amber-400/90">
                    {language === 'ka' ? 'აუდიო და ხმოვანი შეტყობინებები' : 'Audio & Voice Alerts'}
                  </span>
                  <button
                    type="button"
                    onClick={handleTestVoice}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline uppercase cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                  >
                    <span>🔔</span>
                    <span>{language === 'ka' ? 'ხმის ტესტი' : 'Test Sound'}</span>
                  </button>
                </div>

                {/* Chime Sound Toggle */}
                <div 
                  onClick={handleToggleSound}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={cn(
                      "p-2.5 rounded-xl text-xs",
                      effectiveSoundEnabled ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-500"
                    )}>
                      {effectiveSoundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        {language === 'ka' ? 'მედიტაციური ზარის ხმა' : 'Zen Chime Sound'}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {language === 'ka' ? 'ჰარმონიული აუდიო სიგნალი სესიის დასრულებისას' : 'Harmonic chime at session milestones'}
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "w-11 h-6 rounded-full p-0.5 transition-colors relative shrink-0",
                    effectiveSoundEnabled ? "bg-amber-500" : "bg-zinc-800"
                  )}>
                    <div className={cn(
                      "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                      effectiveSoundEnabled ? "translate-x-5" : "translate-x-0"
                    )} />
                  </div>
                </div>

                {/* Spoken Voice Announcement Toggle */}
                <div 
                  onClick={handleToggleVoice}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={cn(
                      "p-2.5 rounded-xl text-xs",
                      effectiveVoiceEnabled ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 text-zinc-500"
                    )}>
                      <Volume1 size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        {language === 'ka' ? 'ხმოვანი შეტყობინება (AI Voice)' : 'Voice Announcements'}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {language === 'ka' ? 'ქართული/ინგლისური ხმოვანი გაფრთხილება დაწყება/დასრულებაზე' : 'Spoken audio alert on start & completion'}
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "w-11 h-6 rounded-full p-0.5 transition-colors relative shrink-0",
                    effectiveVoiceEnabled ? "bg-indigo-500" : "bg-zinc-800"
                  )}>
                    <div className={cn(
                      "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                      effectiveVoiceEnabled ? "translate-x-5" : "translate-x-0"
                    )} />
                  </div>
                </div>
              </div>

              {/* Close Button at bottom */}
              <div className="mt-6 pt-4 border-t border-zinc-800/80 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-2xl uppercase tracking-wider transition-colors cursor-pointer shadow-md"
                >
                  {language === 'ka' ? 'დახურვა & შენახვა' : 'Close & Save'}
                </button>
              </div>

            </div>
          </div>,
          document.body
        )}
      </div>

      {/* ========================================================================= */}
      {/* FULLSCREEN ZEN FOCUS MATRIX (IMMERSIVE CONCENTRATION SPACE)               */}
      {/* ========================================================================= */}
      {isZenOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999999] bg-[#070a12]/98 backdrop-blur-3xl text-white flex flex-col items-center justify-between p-6 sm:p-12 overflow-y-auto animate-in fade-in duration-300">
          
          {/* Zen Header */}
          <div className="w-full max-w-4xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  effectiveIsRunning ? "bg-amber-400 animate-ping" : "bg-zinc-600"
                )} />
                <span className="text-amber-400 uppercase tracking-widest font-black">
                  {effectiveTimerMode === 'stopwatch'
                    ? (language === 'ka' ? 'წამმზომი' : 'Stopwatch')
                    : effectiveFocusMode === 'work' ? (language === 'ka' ? 'ღრმა ფოკუსი' : 'Deep Work') : (language === 'ka' ? 'განტვირთვა' : 'Rest Break')}
                </span>
              </div>
              {onToggleTimerMode && (
                <button
                  type="button"
                  onClick={() => onToggleTimerMode(effectiveTimerMode === 'pomodoro' ? 'stopwatch' : 'pomodoro')}
                  className="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Clock size={14} />
                  <span>{effectiveTimerMode === 'pomodoro' ? 'Stopwatch' : 'Pomodoro'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleSound}
                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title={effectiveSoundEnabled ? 'Mute Sound' : 'Enable Sound'}
              >
                {effectiveSoundEnabled ? <Volume2 size={16} className="text-amber-400" /> : <VolumeX size={16} />}
              </button>

              <button
                type="button"
                onClick={() => setIsZenOpen(false)}
                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Exit Fullscreen"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Central Mega Timer & Objective */}
          <div className="my-auto text-center max-w-xl w-full space-y-8">
            
            {/* Scratchpad note / Main target */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                {language === 'ka' ? 'მიმდინარე მიზანი' : 'Current Single Objective'}
              </p>
              {activeTask ? (
                <div className="text-xl sm:text-2xl font-bold text-amber-400 py-2 flex items-center justify-center gap-2">
                  <Target size={20} className="text-amber-400 shrink-0" />
                  <span>{language === 'ka' ? (activeTask.contentGe || activeTask.content) : activeTask.content}</span>
                </div>
              ) : (
                <input
                  type="text"
                  value={zenTaskNote}
                  onChange={(e) => setZenTaskNote(e.target.value)}
                  placeholder={language === 'ka' ? 'რა არის თქვენი მთავარი ამოცანა ამ სესიაზე?...' : 'What is your primary focus for this block?...'}
                  className="w-full text-center bg-transparent border-b border-zinc-800 focus:border-amber-400/80 text-xl sm:text-2xl font-bold text-white placeholder-zinc-700 py-2 focus:outline-none transition-colors"
                />
              )}
            </div>

            {/* Giant Digits */}
            <div className="relative py-4">
              <div className="text-7xl sm:text-9xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-500 drop-shadow-2xl">
                {formattedTimer}
              </div>
              <div className="w-48 h-1.5 bg-zinc-900 rounded-full mx-auto mt-4 overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500", 
                    effectiveTimerMode === 'stopwatch'
                      ? "bg-amber-400"
                      : effectiveFocusMode === 'work' ? "bg-amber-400" : "bg-emerald-400"
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleStartPause}
                className={cn(
                  "px-8 sm:px-12 py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all shadow-2xl active:scale-95 cursor-pointer",
                  effectiveIsRunning 
                    ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-amber-500/20" 
                    : "bg-white text-zinc-950 hover:bg-zinc-200"
                )}
              >
                {effectiveIsRunning ? (
                  <>
                    <Pause size={18} className="fill-current" />
                    <span>{language === 'ka' ? 'დაპაუზება' : 'Pause'}</span>
                  </>
                ) : (
                  <>
                    <Play size={18} className="fill-current" />
                    <span>{language === 'ka' ? 'დაწყება' : 'Start Focus'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Reset"
              >
                <RotateCcw size={18} />
              </button>
            </div>

            {/* Duration switcher in Zen mode (only in Pomodoro mode) */}
            {effectiveTimerMode === 'pomodoro' && (
              <div className="flex items-center justify-center gap-2 pt-4">
                {[15, 25, 45, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => applyCustomDuration(m)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border",
                      effectiveSelectedMinutes === m 
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40" 
                        : "bg-zinc-900/80 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                    )}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            )}

          </div>

          {/* Zen Footer */}
          <div className="w-full max-w-4xl text-center text-xs text-zinc-600 font-mono">
            {language === 'ka' 
              ? 'Proton Focus Space · ყველა შეტყობინება და მენიუ დროებით დაბლოკილია თქვენი კონცენტრაციისთვის'
              : 'Proton Focus Space · Distraction-free deep work zone'}
          </div>

        </div>,
        document.body
      )}
    </>
  );
};
