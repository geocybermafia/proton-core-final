// Universal safe storage wrapper with in-memory fallback to prevent crashes in restricted browser environments or storage quota errors.

const memoryStorage: Record<string, string> = {};

export const safeStorage = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return memoryStorage[key] ?? null;
    }
  },

  set: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
      memoryStorage[key] = value;
    } catch (e: any) {
      memoryStorage[key] = value;
      if (e?.name === 'QuotaExceededError' || e?.code === 22 || e?.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn(`Storage quota exceeded when setting ${key}. Falling back to memory storage.`);
        try {
          const chatHistoryStr = localStorage.getItem('proton_chat_history');
          if (chatHistoryStr) {
            const history = JSON.parse(chatHistoryStr);
            let pruned = false;
            for (const personaId in history) {
              if (Array.isArray(history[personaId]) && history[personaId].length > 10) {
                history[personaId] = history[personaId].slice(-10);
                pruned = true;
              }
            }
            if (pruned) {
              localStorage.setItem('proton_chat_history', JSON.stringify(history));
              localStorage.setItem(key, value);
            }
          }
        } catch (pruneErr) {
          console.warn("Could not prune chat history:", pruneErr);
        }
      }
    }
  },

  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Ignore errors
    }
    delete memoryStorage[key];
  },

  getJSON: <T>(key: string, fallback: T): T => {
    const raw = safeStorage.get(key);
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (e) {
      console.warn(`Failed to parse JSON for storage key "${key}". Using fallback.`, e);
      return fallback;
    }
  }
};
