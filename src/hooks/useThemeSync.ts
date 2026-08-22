import { useEffect } from 'react';
import { Theme } from '../types';

export function useThemeSync(
  setTheme: React.Dispatch<React.SetStateAction<Theme>>,
  setOrganizerTheme?: React.Dispatch<React.SetStateAction<Theme>>
) {
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'proton_theme' && e.newValue) {
        setTheme(e.newValue as Theme);
        if (setOrganizerTheme) {
          setOrganizerTheme(e.newValue as Theme);
        }
      } else if (e.key === 'proton_organizer_theme' && e.newValue) {
        if (setOrganizerTheme) {
          setOrganizerTheme(e.newValue as Theme);
        }
        setTheme(e.newValue as Theme);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [setTheme, setOrganizerTheme]);
}

