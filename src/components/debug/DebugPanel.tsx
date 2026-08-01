import React, { useState, useEffect } from 'react';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface ProtonDebugDetail {
  type: 'auth' | 'storage-progress' | 'storage-error' | 'storage-success';
  user?: { uid: string; email: string | null; isAnonymous: boolean } | null;
  path?: string;
  progress?: number;
  code?: string;
  message?: string;
  downloadUrl?: string;
}

export const DebugPanel: React.FC = () => {
  if (!import.meta.env.DEV) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [authState, setAuthState] = useState<{
    uid: string;
    email: string | null;
    isAnonymous: boolean;
  } | null>(null);

  const [storageProgress, setStorageProgress] = useState<{
    path: string;
    progress: number;
  } | null>(null);

  const [lastError, setLastError] = useState<{
    path?: string;
    code: string;
    message: string;
    timestamp: string;
  } | null>(null);

  const [lastSuccess, setLastSuccess] = useState<{
    path?: string;
    downloadUrl: string;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    // Direct Firebase auth state listener for reliable initial state
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setAuthState(
        user
          ? {
              uid: user.uid,
              email: user.email,
              isAnonymous: user.isAnonymous,
            }
          : null
      );
    });

    // Custom window event listener for decoupled debug events
    const handleDebugEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ProtonDebugDetail>;
      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.type === 'auth') {
        setAuthState(detail.user || null);
      } else if (detail.type === 'storage-progress') {
        if (detail.path !== undefined && detail.progress !== undefined) {
          setStorageProgress({
            path: detail.path,
            progress: detail.progress,
          });
        }
      } else if (detail.type === 'storage-error') {
        setStorageProgress(null);
        setLastError({
          path: detail.path,
          code: detail.code || 'UNKNOWN_ERROR',
          message: detail.message || 'An unknown storage error occurred.',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else if (detail.type === 'storage-success') {
        setStorageProgress({ path: detail.path || '', progress: 100 });
        setLastSuccess({
          path: detail.path,
          downloadUrl: detail.downloadUrl || '',
          timestamp: new Date().toLocaleTimeString(),
        });
        setTimeout(() => setStorageProgress(null), 3000);
      }
    };

    window.addEventListener('proton-debug-event', handleDebugEvent);

    return () => {
      unsubscribeAuth();
      window.removeEventListener('proton-debug-event', handleDebugEvent);
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-mono text-xs select-none">
      {/* Collapsed Badge Trigger */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 text-slate-200 px-3 py-2 rounded-full shadow-2xl backdrop-blur-md hover:bg-slate-800 transition-all cursor-pointer"
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                lastError ? 'bg-red-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                lastError ? 'bg-red-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="font-bold text-[11px] uppercase tracking-wider text-slate-300">
            Proton Debug
          </span>
          {storageProgress !== null && (
            <span className="bg-purple-900/80 text-purple-200 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {storageProgress.progress}%
            </span>
          )}
          {lastError && (
            <span className="bg-red-900/80 text-red-200 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              ERR
            </span>
          )}
        </button>
      )}

      {/* Expanded Debug Panel Card */}
      {isOpen && (
        <div className="w-80 bg-slate-950/95 border border-slate-800 text-slate-200 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-bold text-[11px] uppercase tracking-wider text-slate-100">
                Proton Dev Debugger
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Body Content */}
          <div className="p-3.5 space-y-3 max-h-96 overflow-y-auto">
            {/* Auth Section */}
            <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/60 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between">
                <span>Auth State</span>
                <span
                  className={
                    authState ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'
                  }
                >
                  {authState ? 'AUTHENTICATED' : 'ANONYMOUS / OUT'}
                </span>
              </div>
              <div className="text-slate-300 text-[11px] truncate">
                {authState ? (
                  <>
                    <p className="truncate font-semibold text-slate-100">
                      {authState.email || 'No email provided'}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate font-mono">
                      UID: {authState.uid}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-400 italic text-[11px]">No active Firebase user</p>
                )}
              </div>
            </div>

            {/* Storage Progress Section */}
            <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/60 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between">
                <span>Storage Upload</span>
                <span className="text-purple-400 font-bold">
                  {storageProgress ? `${storageProgress.progress}%` : 'IDLE'}
                </span>
              </div>

              {storageProgress ? (
                <div className="space-y-1">
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-500 h-full transition-all duration-200"
                      style={{ width: `${storageProgress.progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 truncate font-mono">
                    {storageProgress.path}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No active upload</p>
              )}
            </div>

            {/* Storage Error Section */}
            {lastError && (
              <div className="bg-red-950/40 p-2.5 rounded-xl border border-red-800/50 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex justify-between items-center">
                  <span>Last Error</span>
                  <span className="text-[9px] text-red-400/80 font-normal">{lastError.timestamp}</span>
                </div>
                <p className="text-red-300 font-bold text-[11px] break-all font-mono">
                  [{lastError.code}]
                </p>
                <p className="text-red-200 text-[10px] leading-tight break-words">
                  {lastError.message}
                </p>
                {lastError.path && (
                  <p className="text-[9px] text-red-400/70 truncate font-mono">
                    Path: {lastError.path}
                  </p>
                )}
              </div>
            )}

            {/* Storage Success Section */}
            {lastSuccess && !lastError && (
              <div className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-800/40 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex justify-between">
                  <span>Last Success</span>
                  <span className="text-[9px] text-emerald-400/70">{lastSuccess.timestamp}</span>
                </div>
                {lastSuccess.path && (
                  <p className="text-[10px] text-emerald-200/90 truncate font-mono">
                    {lastSuccess.path}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="px-3.5 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Decoupled CustomEvents</span>
            {lastError && (
              <button
                onClick={() => setLastError(null)}
                className="text-red-400 hover:text-red-300 font-bold transition-all cursor-pointer"
              >
                Clear Error
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
