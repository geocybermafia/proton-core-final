import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

export type Language = 'en' | 'ka';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read active language from existing 'user-profile' or default to 'en'
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('user-profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.language === 'en' || parsed.language === 'ka')) {
          return parsed.language;
        }
      }
    } catch (e) {
      console.error("Error parsing user-profile language:", e);
    }
    return 'en';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    
    // Update existing localStorage schema so it matches perfectly
    try {
      const saved = localStorage.getItem('user-profile');
      let profile: any = {};
      if (saved) {
        try {
          profile = JSON.parse(saved);
        } catch {
          profile = {};
        }
      }
      profile.language = lang;
      localStorage.setItem('user-profile', JSON.stringify(profile));
    } catch (e) {
      console.error("Error writing user-profile to localStorage:", e);
    }

    // Dispatch a custom event so other active instances of the hook get notified
    window.dispatchEvent(new CustomEvent('proton-language-changed', { detail: lang }));
  }, []);

  // Sync state across multiple uses of the provider if any, or general storage sync bounds
  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail && (customEvent.detail === 'en' || customEvent.detail === 'ka')) {
        setLanguageState(customEvent.detail);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'user-profile' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && (parsed.language === 'en' || parsed.language === 'ka')) {
            setLanguageState(parsed.language);
          }
        } catch {}
      }
    };

    window.addEventListener('proton-language-changed', handleEvent);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('proton-language-changed', handleEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const value = useMemo(() => ({
    language,
    setLanguage,
  }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
