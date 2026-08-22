import { useState, useEffect, useCallback, useMemo } from 'react';
import { Theme, ThemeSchedule, UserProfile } from '../types';
import { safeStorage } from '../lib/safeStorage';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

export const DEFAULT_THEME_SCHEDULE: ThemeSchedule = {
  enabled: false,
  dayStart: '09:00',
  dayEnd: '19:00',
  dayTheme: 'light',
  nightTheme: 'enterprise',
};

export function isDaytime(start: string, end: string, date = new Date()): boolean {
  const [startH, startM] = (start || '09:00').split(':').map(Number);
  const [endH, endM] = (end || '19:00').split(':').map(Number);

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = (isNaN(startH) ? 9 : startH) * 60 + (isNaN(startM) ? 0 : startM);
  const endMinutes = (isNaN(endH) ? 19 : endH) * 60 + (isNaN(endM) ? 0 : endM);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Crosses midnight (e.g., 20:00 to 06:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export function useThemeSchedule(user: User | null, userProfile?: UserProfile) {
  const [schedule, setScheduleState] = useState<ThemeSchedule>(() => {
    try {
      const saved = safeStorage.get('proton_theme_schedule');
      if (saved) {
        const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
        return { ...DEFAULT_THEME_SCHEDULE, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_THEME_SCHEDULE;
  });

  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  // Periodically check time for day/night transitions
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // check every 15s

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setCurrentTime(new Date());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Sync profile's themeSchedule if available
  useEffect(() => {
    if (userProfile?.themeSchedule) {
      setScheduleState((prev) => {
        const next = { ...DEFAULT_THEME_SCHEDULE, ...userProfile.themeSchedule };
        if (JSON.stringify(prev) !== JSON.stringify(next)) {
          safeStorage.set('proton_theme_schedule', JSON.stringify(next));
          return next;
        }
        return prev;
      });
    }
  }, [userProfile?.themeSchedule]);

  const updateSchedule = useCallback(
    (newScheduleOrFn: ThemeSchedule | ((prev: ThemeSchedule) => ThemeSchedule)) => {
      setScheduleState((prev) => {
        const next = typeof newScheduleOrFn === 'function' ? newScheduleOrFn(prev) : newScheduleOrFn;
        safeStorage.set('proton_theme_schedule', JSON.stringify(next));

        if (user?.uid) {
          const userRef = doc(db, 'users', user.uid);
          setDoc(userRef, { themeSchedule: next }, { merge: true }).catch((err) => {
            if (err.code !== 'unavailable') {
              console.warn('Could not sync themeSchedule to Firestore:', err);
            }
          });
        }
        return next;
      });
    },
    [user]
  );

  const isDay = useMemo(() => {
    return isDaytime(schedule.dayStart, schedule.dayEnd, currentTime);
  }, [schedule.dayStart, schedule.dayEnd, currentTime]);

  const scheduledTargetTheme = useMemo<Theme>(() => {
    if (!schedule.enabled) return 'auto';
    return isDay ? schedule.dayTheme : schedule.nightTheme;
  }, [schedule.enabled, isDay, schedule.dayTheme, schedule.nightTheme]);

  return {
    schedule,
    updateSchedule,
    isDay,
    scheduledTargetTheme,
    currentTime,
  };
}
