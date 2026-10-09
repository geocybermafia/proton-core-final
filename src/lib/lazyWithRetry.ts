import React, { lazy } from 'react';

const CHUNK_RETRY_PREFIX = 'proton_chunk_retry_';
const LAST_RELOAD_KEY = 'proton_last_chunk_reload_ts';
const RELOAD_COOLDOWN_MS = 25000; // 25 seconds cooldown between automatic full-page reloads

/**
 * Checks if an error is caused by a failed dynamic import or missing chunk
 * (common when a new version has been deployed and old chunk hashes are purged).
 */
export function isChunkLoadError(error: any): boolean {
  if (!error) return false;
  const message = (error?.message || (typeof error === 'string' ? error : String(error))).toLowerCase();
  const name = error?.name || '';

  return (
    // Vite / Chromium / WebKit dynamic import errors
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('loading chunk') ||
    message.includes('loading css chunk') ||
    // Safari / Firefox module script errors
    message.includes('failed to load module script') ||
    message.includes('importing a module script failed') ||
    message.includes('error resolving module specifier') ||
    message.includes('mime type') ||
    name === 'ChunkLoadError'
  );
}

/**
 * Determine if a safe, single-time page reload can be triggered without risking an infinite loop.
 */
function canTriggerSafeReload(componentKey: string): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }

  try {
    const now = Date.now();
    const lastReloadStr = window.sessionStorage.getItem(LAST_RELOAD_KEY);
    if (lastReloadStr) {
      const lastReload = parseInt(lastReloadStr, 10);
      if (!isNaN(lastReload) && now - lastReload < RELOAD_COOLDOWN_MS) {
        // Within cooldown window: do not reload again to avoid infinite reload loop
        return false;
      }
    }

    const componentRetry = window.sessionStorage.getItem(`${CHUNK_RETRY_PREFIX}${componentKey}`);
    if (componentRetry === 'true') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Record that a reload was performed for this module/deployment.
 */
function recordSafeReload(componentKey: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
      window.sessionStorage.setItem(`${CHUNK_RETRY_PREFIX}${componentKey}`, 'true');
    }
  } catch {
    // Ignore storage quota or security errors
  }
}

/**
 * Clear retry flag for a successfully loaded module.
 */
export function clearChunkRetryFlag(componentKey: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(`${CHUNK_RETRY_PREFIX}${componentKey}`);
    }
  } catch {
    // Ignore storage quota or security errors
  }
}

/**
 * Clear all chunk reload flags (e.g. after manual user update action).
 */
export function clearAllChunkRetryFlags(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(LAST_RELOAD_KEY);
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(CHUNK_RETRY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => window.sessionStorage.removeItem(k));
    }
  } catch {
    // Ignore
  }
}

/**
 * Global initialization of listeners for Vite preload errors and module rejections.
 */
export function initGlobalChunkErrorHandler(): void {
  if (typeof window === 'undefined') return;

  // Listen to Vite's native preload error event
  window.addEventListener('vite:preloadError', (event: any) => {
    console.warn('[Proton Reliability] vite:preloadError event caught:', event);
    event.preventDefault(); // Stop Vite from throwing an uncaught window error

    if (canTriggerSafeReload('vite_preload')) {
      recordSafeReload('vite_preload');
      console.log('[Proton Reliability] Reloading to fetch updated application bundle...');
      window.location.reload();
    }
  });
}

// Automatically register once on module load
initGlobalChunkErrorHandler();

/**
 * Robust React.lazy wrapper with:
 * 1. Intelligent deployment-version mismatch detection (stale chunk hash recovery)
 * 2. Loop-protected single-shot page reload for updated deployments
 * 3. Exponential backoff retry for transient network dropouts
 * 4. Graceful error boundary propagation if offline or persistent
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | { [key: string]: any }>,
  componentName = 'Module',
  retries = 2,
  baseDelay = 600
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const module = await componentImport();
        // Successful import - clear flag for this component
        clearChunkRetryFlag(componentName);

        if (module && typeof module === 'object' && 'default' in module && module.default) {
          return module as { default: T };
        }
        return { default: module } as { default: T };
      } catch (error: any) {
        lastError = error;
        const isChunkError = isChunkLoadError(error);

        console.warn(
          `[Proton Reliability] Module load attempt ${attempt + 1}/${retries + 1} for "${componentName}" failed:`,
          error
        );

        if (isChunkError) {
          // If this is a chunk loading error (e.g., hash changed on server due to a new deployment):
          if (canTriggerSafeReload(componentName)) {
            console.warn(
              `[Proton Reliability] Stale module version detected for "${componentName}". Reloading page to fetch latest deployment...`
            );
            recordSafeReload(componentName);

            // Trigger reload to fetch latest index.html with new asset hashes
            window.location.reload();

            // Return pending promise so React stays in Suspense rather than flashing an error state
            return new Promise<never>(() => {});
          } else {
            console.error(
              `[Proton Reliability] Safe reload already attempted or on cooldown for "${componentName}". Aborting reload to prevent loop.`
            );
            // Break early so we don't delay the inevitable fallback UI
            break;
          }
        }

        // For transient network errors, retry with exponential backoff
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(1.5, attempt)));
        }
      }
    }

    console.error(`[Proton Reliability] Dynamic module "${componentName}" load permanently failed:`, lastError);
    throw lastError;
  });
}
