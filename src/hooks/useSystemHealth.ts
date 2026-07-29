import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../components/Toast';

export type SystemHealthStatus = 'optimal' | 'degraded' | 'offline';

export interface SystemHealthState {
  status: SystemHealthStatus;
  latency: number | null;
  isOnline: boolean;
  isFirestoreConnected: boolean;
  lastChecked: number | null;
  checkHealth: () => Promise<SystemHealthStatus>;
}

export function useSystemHealth(language: 'en' | 'ka' = 'en'): SystemHealthState {
  const { showToast } = useToast();
  
  const [status, setStatus] = useState<SystemHealthStatus>(() => {
    return typeof window !== 'undefined' && navigator.onLine ? 'optimal' : 'offline';
  });
  const [latency, setLatency] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? navigator.onLine : true;
  });
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const prevStatusRef = useRef<SystemHealthStatus>(status);
  const isCheckingRef = useRef<boolean>(false);

  const checkHealth = useCallback(async (): Promise<SystemHealthStatus> => {
    if (isCheckingRef.current) return status;
    isCheckingRef.current = true;

    const online = typeof window !== 'undefined' ? navigator.onLine : true;
    setIsOnline(online);

    if (!online) {
      setIsFirestoreConnected(false);
      setLatency(null);
      setStatus('offline');
      setLastChecked(Date.now());
      isCheckingRef.current = false;
      return 'offline';
    }

    const start = performance.now();
    let newStatus: SystemHealthStatus = 'optimal';
    let measuredLatency: number | null = null;
    let firestoreConnected = false;

    try {
      // Light ping to Firestore server to verify actual connection and measure latency
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 4000)
      );

      const pingDocRef = doc(db, 'system', 'config');
      const pingPromise = getDocFromServer(pingDocRef);

      await Promise.race([pingPromise, timeoutPromise]);
      
      measuredLatency = Math.round(performance.now() - start);
      setLatency(measuredLatency);
      firestoreConnected = true;

      if (measuredLatency > 1500) {
        newStatus = 'degraded';
      } else {
        newStatus = 'optimal';
      }
    } catch (err: any) {
      // If server ping fails or times out
      measuredLatency = Math.round(performance.now() - start);
      setLatency(measuredLatency);
      
      if (err?.message === 'timeout' || err?.code === 'unavailable') {
        firestoreConnected = false;
        // If network is online but firestore timed out or unavailable -> degraded or offline
        newStatus = online ? 'degraded' : 'offline';
      } else {
        // Permission errors or document missing still mean server responded
        firestoreConnected = true;
        newStatus = measuredLatency > 1500 ? 'degraded' : 'optimal';
      }
    } finally {
      setIsFirestoreConnected(firestoreConnected);
      setStatus(newStatus);
      setLastChecked(Date.now());
      isCheckingRef.current = false;
    }

    return newStatus;
  }, [status]);

  // Handle status transition toasts
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev !== status) {
      prevStatusRef.current = status;

      if (status === 'offline') {
        showToast(
          language === 'ka' 
            ? '⚠️ კავშირი გაწყდა: ოპერაციები ხორციელდება ოფლაინ ლოკალურ რეჟიმში' 
            : '⚠️ System Connection Lost: Operating in offline cache mode',
          'error',
          5000
        );
      } else if (status === 'degraded') {
        showToast(
          language === 'ka'
            ? '⚡ სისტემის დაყოვნება გაიზარდა: სტატუსი შეფერხებულია'
            : '⚡ Network Latency Elevated: System status degraded',
          'warning',
          4000
        );
      } else if (status === 'optimal' && (prev === 'offline' || prev === 'degraded')) {
        showToast(
          language === 'ka'
            ? '✅ სისტემური კავშირი აღდგენილია: სტატუსი ოპტიმალურია'
            : '✅ System Connection Restored: Status optimal',
          'success',
          4000
        );
      }
    }
  }, [status, language, showToast]);

  // Network Online/Offline Listeners & Interval Heartbeat
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkHealth();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsFirestoreConnected(false);
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial health check
    checkHealth();

    // Check periodically every 25 seconds
    const interval = setInterval(() => {
      checkHealth();
    }, 25000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkHealth]);

  return {
    status,
    latency,
    isOnline,
    isFirestoreConnected,
    lastChecked,
    checkHealth
  };
}
