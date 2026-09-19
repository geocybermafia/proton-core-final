import { useEffect } from 'react';
import { Theme } from '../types';

export function useThemeSync(
  setTheme: React.Dispatch<React.SetStateAction<Theme>>
) {
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'proton_theme' && e.newValue) {
        setTheme(e.newValue as Theme);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [setTheme]);
}

