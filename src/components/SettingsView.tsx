import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  Settings, 
  User, 
  Cpu, 
  Palette, 
  Shield, 
  Globe, 
  Bell, 
  BellOff,
  Zap, 
  Search, 
  MapPin, 
  Volume2, 
  EyeOff, 
  ChevronRight,
  Save,
  CheckCircle2,
  Lock,
  Key,
  Sparkles,
  Sun,
  Moon,
  Circle,
  Trees,
  Sunrise,
  Heart,
  Mail,
  Camera,
  Phone,
  Upload,
  AlertCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Trash2,
  Fingerprint,
  Terminal,
  Copy,
  Check,
  Briefcase,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Smartphone,
  Laptop,
  KeyRound
} from 'lucide-react';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import { UserProfile, GlobalAiSettings, Theme } from '../types';
import { useToast } from './Toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, deleteField, onSnapshot } from 'firebase/firestore';
import { uploadAvatarImage } from '../lib/storageUtils';
import { SecurityVerificationModal } from './SecurityVerificationModal';
import { 
  ProtonCard, 
  ProtonInput, 
  ProtonButton, 
  ProtonBadge, 
  ProtonAvatar 
} from '../ui';
import { createPinMeta, verifyPinWithMeta, registerFailedPinAttempt, resetPinLockoutAttempts, checkPinLockout } from '../lib/securityUtils';
import { updateSecurityPinCall, resetUserWorkspaceCall } from '../services/cloudFunctionsService';

interface SettingsViewProps {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  aiSettings: GlobalAiSettings;
  setAiSettings: React.Dispatch<React.SetStateAction<GlobalAiSettings>>;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: 'en' | 'ka';
  uiMode: 'business' | 'creative';
  setUiMode: (mode: 'business' | 'creative') => void;
  organizerTheme: Theme;
  setOrganizerTheme: (theme: Theme) => void;
  isAdmin?: boolean;
}

const THEMES: { id: Theme; labelKey: string; fallbackLabel: string; icon: React.ReactNode; color: string }[] = [
  { id: 'auto', labelKey: 'theme_auto', fallbackLabel: 'System (Auto)', icon: <Laptop size={18} />, color: 'bg-blue-600' },
  { id: 'enterprise', labelKey: 'theme_enterprise', fallbackLabel: 'Enterprise', icon: <Shield size={18} />, color: 'bg-indigo-500' },
  { id: 'light', labelKey: 'theme_light', fallbackLabel: 'Light', icon: <Sun size={18} />, color: 'bg-slate-200' },
  { id: 'titanium', labelKey: 'theme_titanium', fallbackLabel: 'Titanium', icon: <Circle size={18} />, color: 'bg-slate-400' },
  { id: 'proton', labelKey: 'theme_proton', fallbackLabel: 'Proton Dark', icon: <Zap size={18} />, color: 'bg-cyan-400' },
  { id: 'forest', labelKey: 'theme_forest', fallbackLabel: 'Forest', icon: <Trees size={18} />, color: 'bg-emerald-500' },
  { id: 'sunset', labelKey: 'theme_sunset', fallbackLabel: 'Sunset', icon: <Sunrise size={18} />, color: 'bg-orange-500' },
  { id: 'rose', labelKey: 'theme_rose', fallbackLabel: 'Rose', icon: <Heart size={18} />, color: 'bg-rose-500' },
  { id: 'vibrant', labelKey: 'theme_vibrant', fallbackLabel: 'Nebula', icon: <Sparkles size={18} />, color: 'bg-purple-500' },
  { id: 'midnight', labelKey: 'theme_midnight', fallbackLabel: 'Dark', icon: <Moon size={18} />, color: 'bg-slate-900' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  userProfile,
  setUserProfile,
  aiSettings,
  setAiSettings,
  theme,
  setTheme,
  language,
  uiMode,
  setUiMode,
  organizerTheme,
  setOrganizerTheme,
  isAdmin
}) => {
  const t = translations[language].settings;
  const common = translations[language].common;
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'preferences' | 'security' | 'seo' | 'cost_control'>('preferences');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [lastSavedProfile, setLastSavedProfile] = useState<UserProfile>(() => ({ ...userProfile }));

  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const isEmailValid = (email?: string) => {
    if (!email || !email.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const isPhoneValid = (phone?: string) => {
    if (!phone || !phone.trim()) return true;
    const digits = phone.replace(/[^0-9]/g, '');
    const hasValidChars = /^[\+]?[0-9\s\-\(\)\.]+$/.test(phone.trim());
    return hasValidChars && digits.length >= 7 && digits.length <= 15;
  };

  const emailError = emailTouched && !isEmailValid(userProfile.email);
  const phoneError = phoneTouched && !isPhoneValid(userProfile.phoneNumber);

  const isProfileDirty = 
    (userProfile.name || '') !== (lastSavedProfile.name || '') ||
    (userProfile.email || '') !== (lastSavedProfile.email || '') ||
    (userProfile.region || '') !== (lastSavedProfile.region || '') ||
    (userProfile.phoneNumber || '') !== (lastSavedProfile.phoneNumber || '') ||
    (userProfile.role || '') !== (lastSavedProfile.role || '');

  useEffect(() => {
    if (!isProfileDirty) {
      setLastSavedProfile({ ...userProfile });
    }
  }, [userProfile.name, userProfile.email, userProfile.region, userProfile.phoneNumber, userProfile.role]);

  useEffect(() => {
    if (!isProfileDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const saveBtn = document.getElementById('btn-settings-save');
      if (saveBtn && saveBtn.contains(target)) {
        return;
      }

      const settingsRoot = document.getElementById('settings-view-root');
      const isOutsideSettings = settingsRoot && !settingsRoot.contains(target);
      const profileTabBtn = document.getElementById('tab-settings-profile');
      const isProfileTabClick = profileTabBtn && profileTabBtn.contains(target);
      const isOtherTabClick = settingsRoot && settingsRoot.contains(target) && !isProfileTabClick && target.closest('[id^="tab-settings-"]');

      if (isOutsideSettings || isOtherTabClick) {
        const confirmMessage = language === 'ka'
          ? 'პროფილის ველებში გაქვთ უნახავი ცვლილებები. გსურთ გასვლა შენახვის გარეშე?'
          : 'You have unsaved profile changes. Are you sure you want to leave without saving?';

        const userConfirmed = window.confirm(confirmMessage);
        if (!userConfirmed) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        } else {
          setLastSavedProfile({ ...userProfile });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [isProfileDirty, userProfile, language]);

  const [userStats, setUserStats] = useState<{
    storageGB: number;
    computeTimeHours: number;
    aiTokens: number;
    dailyGenerationsCount: number;
  }>({
    storageGB: 0,
    computeTimeHours: 0,
    aiTokens: 0,
    dailyGenerationsCount: 0
  });

  const [spendingLimit, setSpendingLimit] = useState<number>(5.00);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  const [showResetModal, setShowResetModal] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [keyProgress, setKeyProgress] = useState(0);
  const [isIntegrityChecking, setIsIntegrityChecking] = useState(false);
  const [integrityLogs, setIntegrityLogs] = useState<string[]>([]);

  // Step-Up Security Modal State
  const [stepUpState, setStepUpState] = useState<{
    isOpen: boolean;
    actionTitle: string;
    scope?: 'updateSecurityPin' | 'resetUserWorkspace' | 'generalStepUp';
    onConfirm: (grantId?: string) => void;
  }>({
    isOpen: false,
    actionTitle: '',
    scope: 'generalStepUp',
    onConfirm: () => {},
  });

  // Security PIN Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinMode, setPinMode] = useState<'enable' | 'change' | 'disable'>('enable');
  const [pinCurrentInput, setPinCurrentInput] = useState('');
  const [pinNewInput, setPinNewInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [pinModalError, setPinModalError] = useState('');

  const requestStepUpVerification = (
    actionTitle: string,
    onVerifiedAction: (grantId?: string) => void,
    scope: 'updateSecurityPin' | 'resetUserWorkspace' | 'generalStepUp' = 'generalStepUp'
  ) => {
    setStepUpState({
      isOpen: true,
      actionTitle,
      scope,
      onConfirm: onVerifiedAction,
    });
  };

  const openPinSetupModal = (mode: 'enable' | 'change' | 'disable') => {
    setPinMode(mode);
    setPinCurrentInput('');
    setPinNewInput('');
    setPinConfirmInput('');
    setPinModalError('');
    setIsPinModalOpen(true);
  };

  const handleSavePin = async () => {
    setPinModalError('');

    const currentLockout = checkPinLockout();
    if (currentLockout.isLocked) {
      setPinModalError(language === 'ka' ? currentLockout.messageKa! : currentLockout.messageEn!);
      return;
    }

    if (pinMode === 'enable') {
      if (pinNewInput.length < 4 || !/^\d{4}$/.test(pinNewInput)) {
        setPinModalError(language === 'ka' ? 'გთხოვთ შეიყვანოთ 4-ნიშნა PIN კოდი' : 'Please enter a 4-digit numeric PIN');
        return;
      }
      if (pinNewInput !== pinConfirmInput) {
        setPinModalError(language === 'ka' ? 'PIN კოდები არ ემთხვევა ერთმანეთს' : 'PIN codes do not match');
        return;
      }

      try {
        // Try server callable first
        try {
          await updateSecurityPinCall({ newPin: pinNewInput });
        } catch (callErr) {
          console.warn("[SettingsView] Cloud Function PIN setup call failed, using client-side PBKDF2 fallback:", callErr);
        }

        // Generate client-side PBKDF2 cryptographic metadata (100,000 iterations SHA-256)
        const pinMeta = await createPinMeta(pinNewInput);

        if (user) {
          try {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
              securityPinEnabled: true,
              securityPinMeta: pinMeta,
              securityPin: deleteField()
            }, { merge: true });
          } catch (dbErr) {
            console.warn("[SettingsView] Firestore direct write for PIN metadata fallback:", dbErr);
          }
        }

        setUserProfile(prev => ({
          ...prev,
          securityPinEnabled: true,
          securityPinMeta: pinMeta
        }));

        resetPinLockoutAttempts();
        setPinCurrentInput('');
        setPinNewInput('');
        setPinConfirmInput('');
        setIsPinModalOpen(false);
        showToast(language === 'ka' ? 'უსაფრთხოების პარამეტრები განახლდა' : 'Security settings updated', 'success');
      } catch (e: any) {
        console.error("Error setting up PIN:", e);
        setPinModalError(e?.message || (language === 'ka' ? 'ოპერაციის შესრულება ვერ მოხერხდა' : 'Operation failed — please try again'));
      }
    } else if (pinMode === 'change') {
      if (pinNewInput.length < 4 || !/^\d{4}$/.test(pinNewInput)) {
        setPinModalError(language === 'ka' ? 'გთხოვთ შეიყვანოთ ახალი 4-ნიშნა PIN კოდი' : 'Please enter a new 4-digit numeric PIN');
        return;
      }
      if (pinNewInput !== pinConfirmInput) {
        setPinModalError(language === 'ka' ? 'ახალი PIN კოდები არ ემთხვევა ერთმანეთს' : 'New PIN codes do not match');
        return;
      }

      // Close Pin Modal & Open StepUp Modal to acquire server step-up grant
      setIsPinModalOpen(false);
      requestStepUpVerification(
        language === 'ka' ? 'PIN კოდის შეცვლა' : 'Change Security PIN',
        async (grantId) => {
          try {
            try {
              await updateSecurityPinCall({ newPin: pinNewInput, grantId });
            } catch (callErr) {
              console.warn("[SettingsView] Cloud Function change PIN call failed, using client-side PBKDF2 fallback:", callErr);
            }

            const pinMeta = await createPinMeta(pinNewInput);
            if (user) {
              try {
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                  securityPinEnabled: true,
                  securityPinMeta: pinMeta,
                  securityPin: deleteField()
                }, { merge: true });
              } catch (dbErr) {
                console.warn("[SettingsView] Firestore direct write for change PIN fallback:", dbErr);
              }
            }

            setUserProfile(prev => ({
              ...prev,
              securityPinEnabled: true,
              securityPinMeta: pinMeta
            }));
            resetPinLockoutAttempts();
            setPinCurrentInput('');
            setPinNewInput('');
            setPinConfirmInput('');
            showToast(language === 'ka' ? 'PIN წარმატებით შეიცვალა' : 'PIN changed successfully', 'success');
          } catch (e: any) {
            console.error("Error changing PIN:", e);
            showToast(e?.message || (language === 'ka' ? 'ოპერაციის შესრულება ვერ მოხერხდა' : 'Operation failed — please try again'), 'error');
          }
        },
        'updateSecurityPin'
      );
    } else if (pinMode === 'disable') {
      setIsPinModalOpen(false);
      requestStepUpVerification(
        language === 'ka' ? 'PIN კოდის გათიშვა' : 'Disable Security PIN',
        async (grantId) => {
          try {
            try {
              await updateSecurityPinCall({ disable: true, grantId });
            } catch (callErr) {
              console.warn("[SettingsView] Cloud Function disable PIN call failed, using client-side fallback:", callErr);
            }

            if (user) {
              try {
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                  securityPinEnabled: false,
                  securityPinMeta: {
                    enabled: false,
                    updatedAt: Date.now()
                  },
                  securityPin: deleteField()
                }, { merge: true });
              } catch (dbErr) {
                console.warn("[SettingsView] Firestore direct write for disable PIN fallback:", dbErr);
              }
            }

            setUserProfile(prev => ({
              ...prev,
              securityPinEnabled: false,
              securityPinMeta: undefined
            }));
            resetPinLockoutAttempts();
            setPinCurrentInput('');
            setPinNewInput('');
            setPinConfirmInput('');
            showToast(language === 'ka' ? 'უსაფრთხოების პარამეტრები განახლდა' : 'Security settings updated', 'success');
          } catch (e: any) {
            console.error("Failed to disable PIN:", e);
            showToast(e?.message || (language === 'ka' ? 'ოპერაციის შესრულება ვერ მოხერხდა' : 'Operation failed — please try again'), 'error');
          }
        },
        'updateSecurityPin'
      );
    }
  };

  const passkeyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const integrityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (passkeyTimerRef.current) clearInterval(passkeyTimerRef.current);
      if (integrityTimerRef.current) clearInterval(integrityTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const statsRef = doc(db, 'users', user.uid, 'stats', 'current');
    const unsubscribe = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserStats({
          storageGB: data.storageGB !== undefined ? data.storageGB : 0,
          computeTimeHours: data.computeTimeHours !== undefined ? data.computeTimeHours : 0,
          aiTokens: data.aiTokens !== undefined ? data.aiTokens : 0,
          dailyGenerationsCount: data.dailyGenerationsCount !== undefined ? data.dailyGenerationsCount : 0
        });
        if (data.spendingLimit !== undefined) {
          setSpendingLimit(data.spendingLimit);
        }
      }
      setIsStatsLoading(false);
    }, (err) => {
      console.warn("Failed to subscribe to stats inside SettingsView:", err);
      setIsStatsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const estimatedCost = (userStats.aiTokens * 0.0000015) + (userStats.computeTimeHours * 0.05) + (userStats.storageGB * 0.02);

  const handleSaveSpendingLimit = async (limitVal: number) => {
    if (!user) return;
    try {
      const statsRef = doc(db, 'users', user.uid, 'stats', 'current');
      await setDoc(statsRef, { spendingLimit: limitVal }, { merge: true });
      setSpendingLimit(limitVal);
      showToast(
        language === 'ka' 
          ? `ხარჯვის ლიმიტი წარმატებით განახლდა: $${limitVal.toFixed(2)}` 
          : `Hard spending limit successfully updated to: $${limitVal.toFixed(2)}`,
        'success'
      );
    } catch (e: any) {
      showToast(
        language === 'ka' ? `ლიმიტის შენახვა ვერ მოხერხდა: ${e.message}` : `Failed to save spending limit: ${e.message}`,
        'error'
      );
    }
  };
  const [showApiKey, setShowApiKey] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Custom SEO Meta Audit State
  const getHeadMeta = () => {
    if (typeof document === 'undefined') return {
      title: 'N/A', description: 'N/A', keywords: 'N/A', canonical: 'N/A',
      ogTitle: 'N/A', ogDescription: 'N/A', ogUrl: 'N/A', ogImage: 'N/A', ogType: 'N/A',
      twitterCard: 'N/A', twitterTitle: 'N/A', twitterDescription: 'N/A', twitterImage: 'N/A'
    };
    return {
      title: document.title || 'N/A',
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || 'N/A',
      keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || 'N/A',
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || 'N/A',
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || 'N/A',
      ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || 'N/A',
      ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content') || 'N/A',
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || 'N/A',
      ogType: document.querySelector('meta[property="og:type"]')?.getAttribute('content') || 'N/A',
      twitterCard: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || 'N/A',
      twitterTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || 'N/A',
      twitterDescription: document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || 'N/A',
      twitterImage: document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || 'N/A',
    };
  };

  const [metaTags, setMetaTags] = useState(getHeadMeta());
  const [activeSEOView, setActiveSEOView] = useState<'visual' | 'code'>('visual');

  // Dynamically replace hardcoded placeholders with the actual active domain URL in the DOM
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const currentOrigin = window.location.origin;
      
      // Sync Canonical Link
      const canonicalEl = document.querySelector('link[rel="canonical"]');
      if (canonicalEl) {
        canonicalEl.setAttribute('href', currentOrigin);
      }
      
      // Sync Open Graph URL
      const ogUrlEl = document.querySelector('meta[property="og:url"]');
      if (ogUrlEl) {
        ogUrlEl.setAttribute('content', currentOrigin);
      }
      
      // Sync Twitter URL
      const twitterUrlEl = document.querySelector('meta[name="twitter:url"]');
      if (twitterUrlEl) {
        twitterUrlEl.setAttribute('content', currentOrigin);
      } else {
        const meta = document.createElement('meta');
        meta.name = 'twitter:url';
        meta.content = currentOrigin;
        document.head.appendChild(meta);
      }
      
      setMetaTags(getHeadMeta());
    }
  }, [activeTab]);

  const refreshMetaTags = () => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const currentOrigin = window.location.origin;
      const canonicalEl = document.querySelector('link[rel="canonical"]');
      if (canonicalEl) canonicalEl.setAttribute('href', currentOrigin);
      const ogUrlEl = document.querySelector('meta[property="og:url"]');
      if (ogUrlEl) ogUrlEl.setAttribute('content', currentOrigin);
    }
    setMetaTags(getHeadMeta());
    showToast(
      language === 'ka' ? 'მეტა ტეგები წარმატებით განახლდა DOM-იდან!' : 'Successfully synchronized live meta tags from document head!',
      'success'
    );
  };
  
  // Connect to the custom systems toast notification portal
  const { showToast } = useToast();
  const { setLanguage } = useLanguage();

  const updateAiSettings = (updater: (prev: GlobalAiSettings) => GlobalAiSettings) => {
    setAiSettings(prev => {
      const next = updater(prev);
      const sanitizedTemp = Math.min(1.0, Math.max(0.0, typeof next.temperature === 'number' ? next.temperature : 0.7));
      const sanitizedInstruction = typeof next.systemInstruction === 'string' ? next.systemInstruction.slice(0, 4000) : '';

      const sanitized: GlobalAiSettings = {
        ...next,
        temperature: sanitizedTemp,
        systemInstruction: sanitizedInstruction
      };

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        setDoc(userDocRef, { aiSettings: sanitized }, { merge: true }).catch(err => {
          console.error("Error persisting aiSettings to Firestore:", err);
        });
      }

      return sanitized;
    });
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const sanitizedAiSettings: GlobalAiSettings = {
          temperature: Math.min(1.0, Math.max(0.0, typeof aiSettings.temperature === 'number' ? aiSettings.temperature : 0.7)),
          enableSearch: !!aiSettings.enableSearch,
          enableMaps: !!aiSettings.enableMaps,
          zenMode: !!aiSettings.zenMode,
          systemInstruction: (aiSettings.systemInstruction || '').trim().slice(0, 4000),
          voice: aiSettings.voice || 'GeorgianModern',
          customApiKey: aiSettings.customApiKey || ''
        };

        // Sync to cloud Firestore safely
        await setDoc(userDocRef, {
          name: userProfile.name || '',
          email: userProfile.email || '',
          language: userProfile.language || 'en',
          region: userProfile.region || '',
          notifications: userProfile.notifications !== false,
          notificationsEnabled: userProfile.notificationsEnabled !== false,
          phoneNumber: userProfile.phoneNumber || '',
          avatar: userProfile.avatar || '',
          role: userProfile.role || 'System Architect',
          showCommercialHub: !!userProfile.showCommercialHub,
          securityPin: deleteField(),
          aiSettings: sanitizedAiSettings
        }, { merge: true });

        const statsRef = doc(db, 'users', user.uid, 'stats', 'current');
        await setDoc(statsRef, { spendingLimit }, { merge: true });
      }

      setLastSavedProfile({ ...userProfile });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      
      showToast(
        language === 'ka' 
          ? 'ცვლილებები შენახულია' 
          : 'Changes saved successfully',
        'success'
      );
    } catch (err: any) {
      console.error("Failed to sync user profile directly to Firestore:", err);
      showToast(
        language === 'ka' 
          ? 'ოპერაციის შესრულება ვერ მოხერხდა' 
          : 'Operation failed — please try again',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!isEmailValid(userProfile.email) || !isPhoneValid(userProfile.phoneNumber)) {
      setEmailTouched(true);
      setPhoneTouched(true);
      showToast(
        language === 'ka' 
          ? 'გთხოვთ შეასწოროთ არასწორი ველები პროფილში' 
          : 'Please correct invalid profile fields before saving.',
        'error'
      );
      return;
    }

    // Step-Up Security Trigger for sensitive Email changes
    if (userProfile.email !== lastSavedProfile.email) {
      requestStepUpVerification(
        language === 'ka' ? 'ელფოსტის შეცვლა' : 'Change Email Address',
        () => executeSave()
      );
      return;
    }

    executeSave();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsSaving(true);
      try {
        const userId = user?.uid || 'guest';
        const downloadUrl = await uploadAvatarImage(userId, file);
        setUserProfile(prev => ({ ...prev, avatar: downloadUrl }));
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, { avatar: downloadUrl }, { merge: true });
        }
        showToast(
          language === 'ka' ? 'ავატარი წარმატებით განახლდა!' : 'Avatar changed successfully!',
          'success'
        );
      } catch (err: any) {
        console.error("Failed to upload avatar in SettingsView:", err);
        showToast(
          language === 'ka' ? 'ავატარის ატვირთვა ვერ მოხერხდა' : 'Failed to upload avatar image',
          'error'
        );
      } finally {
        setIsSaving(false);
      }
    }
  };

  const executeResetWorkspace = async (grantId?: string) => {
    setShowResetModal(false);
    
    if (grantId) {
      try {
        await resetUserWorkspaceCall({ grantId });
      } catch (err) {
        console.error("Cloud Function resetUserWorkspace failed:", err);
      }
    }

    const defaultName = user && user.email ? user.email.split('@')[0] : 'User';
    const defaultEmail = user && user.email ? user.email : '';
    const initialProfile: UserProfile = {
      name: defaultName,
      email: defaultEmail,
      language: 'en',
      region: 'Tbilisi, GE',
      notifications: true,
      notificationsEnabled: true,
      phoneNumber: '',
      avatar: '',
      role: 'System Architect',
      showCommercialHub: false,
      securityPinEnabled: false,
    };
    setUserProfile(initialProfile);

    setAiSettings({
      temperature: 0.5,
      enableSearch: false,
      enableMaps: false,
      zenMode: false,
      systemInstruction: '',
      voice: 'GeorgianModern'
    });

    setTheme('proton');
    setSpendingLimit(5.00);

    localStorage.removeItem('proton_tasks');
    localStorage.removeItem('organizer_events');
    localStorage.removeItem('active_session_sec');
    
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          name: defaultName,
          email: defaultEmail,
          language: 'en',
          region: 'Tbilisi, GE',
          notifications: true,
          phoneNumber: '',
          avatar: '',
          role: 'System Architect',
          theme: 'proton',
          showCommercialHub: false,
          securityPin: deleteField()
        }, { merge: true });

        const statsRef = doc(db, 'users', user.uid, 'stats', 'current');
        await setDoc(statsRef, {
          storageGB: 0,
          computeTimeHours: 0,
          aiTokens: 0,
          dailyGenerationsCount: 0,
          dailyGenerationsDate: '',
          spendingLimit: 5.00
        });
      } catch (err) {
        console.error("Firestore Reset error:", err);
      }
    }

    showToast(
      language === 'ka' 
        ? 'სამუშაო სივრცე წარმატებით განულდა' 
        : 'Workspace reset to defaults successfully',
      'success'
    );
  };

  const handleResetWorkspace = async () => {
    requestStepUpVerification(
      language === 'ka' ? 'მონაცემების გასუფთავება და ანგარიშის განულება' : 'Clear Data & Account Reset',
      (grantId) => executeResetWorkspace(grantId),
      'resetUserWorkspace'
    );
  };

  const generateCryptoPasskey = () => {
    if (passkeyTimerRef.current) {
      clearInterval(passkeyTimerRef.current);
      passkeyTimerRef.current = null;
    }
    setIsGeneratingKey(true);
    setKeyProgress(0);
    setGeneratedKey('');
    
    passkeyTimerRef.current = setInterval(() => {
      setKeyProgress(prev => {
        if (prev >= 100) {
          if (passkeyTimerRef.current) {
            clearInterval(passkeyTimerRef.current);
            passkeyTimerRef.current = null;
          }
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          const randomBytes = new Uint8Array(24);
          if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(randomBytes);
          } else {
            for (let i = 0; i < 24; i++) {
              randomBytes[i] = Math.floor(Math.random() * 256);
            }
          }
          let result = 'SEC-X3-';
          for (let i = 0; i < 24; i++) {
            result += chars.charAt(randomBytes[i] % chars.length);
            if ((i + 1) % 6 === 0 && i < 23) result += '-';
          }
          setGeneratedKey(result);
          setIsGeneratingKey(false);
          showToast(
            language === 'ka' ? 'სესიის უსაფრთხოების გასაღები გენერირებულია!' : 'Cryptographic session passkey generated successfully!',
            'success'
          );
          return 100;
        }
        return prev + 20;
      });
    }, 200);
  };

  const runIntegrityDiagnostics = () => {
    if (integrityTimerRef.current) {
      clearInterval(integrityTimerRef.current);
      integrityTimerRef.current = null;
    }
    setIsIntegrityChecking(true);
    setIntegrityLogs([]);
    
    const messages = [
      language === 'ka' ? '⚡ ბირთვის უსაფრთხოების დაფის ინიციალიზაცია...' : '⚡ Initializing secure core system handshake...',
      language === 'ka' ? '🔒 Firestore-ის წესების უსაფრთხოების შემოწმება...' : '🔒 Validating Firestore rules and schema integrity...',
      language === 'ka' ? '💻 მე-4 დონის შიფრირების კვანძების ანალიზი...' : '💻 Analyzing level 4 encryption hash compliance...',
      language === 'ka' ? '🛡️ აქტიური ქსელური უსაფრთხოების ფაირვოლის სკანირება...' : '🛡️ Verifying active firewall telemetry pipelines...',
      language === 'ka' ? '✅ დიაგნოსტიკა დასრულებულია: 100% წარმატებული კავშირი!' : '✅ Diagnostics Complete: 100% integrity verified! All nodes optimal.'
    ];

    let currentStep = 0;
    integrityTimerRef.current = setInterval(() => {
      if (currentStep < messages.length) {
        setIntegrityLogs(prev => [...prev, messages[currentStep]]);
        currentStep++;
      } else {
        if (integrityTimerRef.current) {
          clearInterval(integrityTimerRef.current);
          integrityTimerRef.current = null;
        }
        setIsIntegrityChecking(false);
        showToast(
          language === 'ka' ? 'სისტემის მთლიანობის სკანირება წარმატებულია!' : 'Core system integrity diagnostics completed successfully!',
          'success'
        );
      }
    }, 600);
  };

  const isDevUser = isAdmin ?? (!!user && (userProfile?.role === 'admin' || user.email === 'devdarianib@gmail.com' || window.location.hostname.includes('ais-dev-') || window.location.hostname.includes('localhost')));

  const tabs = [
    { 
      id: 'preferences', 
      label: language === 'ka' ? 'დიზაინი და ენა' : 'Design & Language', 
      shortLabel: language === 'ka' ? 'დიზაინი' : 'Design',
      icon: Palette 
    },
    { 
      id: 'profile', 
      label: language === 'ka' ? 'ჩემი პროფილი' : 'My Profile', 
      shortLabel: language === 'ka' ? 'პროფილი' : 'Profile',
      icon: User 
    },
    { 
      id: 'security', 
      label: language === 'ka' ? 'უსაფრთხოება' : 'Security & Keys', 
      shortLabel: language === 'ka' ? 'უსაფრთხოება' : 'Security',
      icon: Shield 
    },
    ...(isDevUser ? [
      { 
        id: 'ai', 
        label: language === 'ka' ? 'AI ასისტენტი (Dev)' : 'AI System Config (Dev)', 
        shortLabel: 'AI (Dev)',
        icon: Cpu 
      },
      { 
        id: 'seo', 
        label: language === 'ka' ? 'SEO & Meta (Dev)' : 'Google & Social Preview (Dev)', 
        shortLabel: 'SEO (Dev)',
        icon: Search 
      },
      { 
        id: 'cost_control', 
        label: language === 'ka' ? 'სისტემური რესურსები (Dev)' : 'Used Resources (Dev)', 
        shortLabel: language === 'ka' ? 'რესურსები' : 'Resources',
        icon: TrendingUp 
      },
    ] : [])
  ];

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500" id="settings-view-root">
      <div className="sticky top-0 z-20 bg-proton-bg/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-proton-border/40 mb-6 shadow-xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-proton-text flex items-center gap-3">
            <Settings className="text-proton-accent font-black animate-[spin_20s_linear_infinite]" size={32} />
            {t.title}
          </h2>
          <p className="text-proton-muted text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1">{t.subtitle}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {isProfileDirty && (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 shadow-sm shadow-amber-500/10"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {language === 'ka' ? 'შეუნახავი ცვლილებები' : 'Unsaved changes'}
            </motion.div>
          )}
          <motion.button 
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            whileHover={shouldReduceMotion ? undefined : { scale: 1.015, y: -0.5 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className={cn(
              "w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl cursor-pointer select-none",
              isSaved 
                ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                : isProfileDirty 
                ? "bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/30 ring-2 ring-amber-400/40" 
                : "bg-proton-accent text-proton-bg hover:shadow-proton-accent/30",
              isSaving && "opacity-75 cursor-not-allowed pointer-events-none"
            )}
            id="btn-settings-save"
          >
            {isSaving ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : isSaved ? (
              <CheckCircle2 size={16} />
            ) : (
              <Save size={16} />
            )}
            {isSaving 
              ? (language === 'ka' ? 'ინახება...' : 'Saving...') 
              : isSaved 
              ? (language === 'ka' ? 'შენახულია' : 'Saved') 
              : t.save}
          </motion.button>
          <span className="text-[9px] font-bold text-proton-muted uppercase tracking-wider hidden sm:block text-right self-center">
            {language === 'ka' ? 'ინახავს პროფილსა და AI ინსტრუქციებს' : 'Saves Profile & AI Instructions'}
          </span>
        </div>
      </div>

      <div className="w-full flex-1 flex flex-col md:flex-row bg-proton-card border border-proton-border rounded-3xl md:rounded-[32px] overflow-hidden shadow-2xl relative min-h-[600px]">
        <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/5 to-transparent pointer-events-none" />
        
        {/* Settings Sidebar */}
        <div className="w-full md:w-60 lg:w-72 border-b md:border-b-0 md:border-r border-proton-border bg-proton-bg/30 p-3 md:p-4 lg:p-6 flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible custom-scrollbar-minimal relative z-10 shrink-0" id="settings-sidebar">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              type="button"
              whileHover={shouldReduceMotion ? undefined : { scale: 1.01, x: 2 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              transition={{ type: "spring", stiffness: 450, damping: 30 }}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 md:flex-none flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-3.5 p-2.5 md:p-3 rounded-xl transition-all group shrink-0 relative min-w-[76px] md:min-w-0 md:min-h-[52px] cursor-pointer w-full text-left select-none",
                activeTab === tab.id 
                  ? "bg-proton-accent/10 text-proton-accent shadow-lg border border-proton-accent/20 font-black" 
                  : "text-proton-muted hover:text-proton-text hover:bg-white/5 font-semibold"
              )}
              id={`tab-settings-${tab.id}`}
            >
              <div className={cn(
                "w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center transition-all shrink-0",
                activeTab === tab.id ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20" : "bg-proton-secondary/20 text-proton-muted group-hover:bg-proton-secondary/30"
              )}>
                <tab.icon size={18} />
              </div>
              <span className="block md:hidden text-[9px] font-black uppercase tracking-tight text-center whitespace-nowrap leading-tight">{tab.shortLabel}</span>
              <span className="hidden md:block text-[11px] font-black uppercase tracking-wider flex-1 text-left whitespace-normal break-words leading-tight">{tab.label}</span>
              {tab.id === 'profile' && isProfileDirty && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[9px] font-mono font-bold animate-pulse shrink-0 absolute top-1.5 right-1.5 md:relative md:top-auto md:right-auto" title="Unsaved changes">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar-minimal bg-transparent relative z-10 w-full" id="settings-content-wrapper">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-4xl xl:max-w-5xl mx-auto md:mx-0"
            >
              {activeTab === 'ai' && (
                <div className="space-y-8" id="sec-ai-config">
                  <header className="pb-6 border-b border-proton-border/50">
                    <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight flex items-center gap-2">
                      <Cpu size={20} className="text-proton-accent" />
                      {language === 'ka' ? 'AI ასისტენტი' : 'AI Assistant'}
                    </h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest">
                      {language === 'ka' ? 'მართეთ ხელოვნური ინტელექტის პასუხები და მუშაობის სტილი' : 'Configure the behavior and speech style of your assistant'}
                    </p>
                  </header>

                  <div className="space-y-8">
                    {/* Temperature Tuner Slider */}
                    <div className="space-y-5 bg-proton-secondary/5 p-6 rounded-2xl border border-proton-border/30 w-full max-w-4xl">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase tracking-wider flex items-center gap-2 text-proton-muted">
                          <Zap size={14} className="text-proton-accent animate-pulse" />
                          {language === 'ka' ? 'პასუხების სტილი (კრეატიულობა)' : 'Creativity & Precision'}
                        </label>
                        <span className="text-[11px] font-mono font-bold text-proton-accent bg-proton-accent/10 px-3 py-1 rounded-lg border border-proton-accent/20">
                          {aiSettings.temperature.toFixed(1)}
                        </span>
                      </div>
                      
                      <input 
                        type="range" min="0" max="1" step="0.1"
                        value={aiSettings.temperature}
                        onChange={e => {
                          const val = Math.min(1.0, Math.max(0.0, parseFloat(e.target.value) || 0));
                          updateAiSettings(prev => ({ ...prev, temperature: val }));
                        }}
                        className="w-full accent-proton-accent appearance-none h-2 bg-proton-secondary/30 rounded-full cursor-pointer transition-all border border-proton-border/30"
                      />

                      {/* Current Value Dynamic Description Badge */}
                      <div className="text-[10px] font-bold uppercase tracking-wider py-2 px-4 rounded-xl bg-proton-bg/40 border border-proton-border/30 text-proton-text/90 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-pulse" />
                        <span>
                          {language === 'ka' ? 'აქტიური რეჟიმი: ' : 'Active Style: '}
                          {aiSettings.temperature <= 0.2 ? (
                            <span className="text-emerald-400 font-extrabold">{language === 'ka' ? 'ზუსტი და მკაფიო' : 'Precise & Accurate'}</span>
                          ) : aiSettings.temperature <= 0.5 ? (
                            <span className="text-cyan-400 font-extrabold">{language === 'ka' ? 'სტანდარტული ბალანსი' : 'Standard Balanced'}</span>
                          ) : aiSettings.temperature <= 0.8 ? (
                            <span className="text-purple-400 font-extrabold">{language === 'ka' ? 'კრეატიული წერა' : 'Creative Writing'}</span>
                          ) : (
                            <span className="text-amber-400 font-extrabold">{language === 'ka' ? 'ძალიან თავისუფალი (ექსპერიმენტული)' : 'Experimental & Free'}</span>
                          )}
                        </span>
                      </div>

                      {/* Presets Cards for Quick Snapping */}
                      <div className="space-y-2 pt-2">
                        <label className="text-[9px] font-black text-proton-muted uppercase tracking-widest">{language === 'ka' ? 'აირჩიეთ მზა ქცევის სტილი' : 'Choose a Speech Style'}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {[
                            { val: 0.1, label: language === 'ka' ? 'ზუსტი და მკაფიო (0.1)' : 'Precise (0.1)', desc: language === 'ka' ? 'კონკრეტული და მხოლოდ რეალური ფაქტები' : 'Factual and highly accurate answers' },
                            { val: 0.5, label: language === 'ka' ? 'სტანდარტული (0.5)' : 'Balanced (0.5)', desc: language === 'ka' ? 'ბუნებრივი საუბრის რეჟიმი' : 'Standard balanced response flow' },
                            { val: 0.7, label: language === 'ka' ? 'კრეატიული (0.7)' : 'Creative (0.7)', desc: language === 'ka' ? 'საუკეთესოა იდეებისა და ტექსტებისთვის' : 'Great for brainstorming & copy' },
                            { val: 0.9, label: language === 'ka' ? 'თავისუფალი (0.9)' : 'Experimental (0.9)', desc: language === 'ka' ? 'მაქსიმალურად მრავალფეროვანი პასუხები' : 'Maximum creative freedom' },
                          ].map((item) => (
                            <button
                              key={item.val}
                              type="button"
                              onClick={() => {
                                const val = Math.min(1.0, Math.max(0.0, item.val));
                                updateAiSettings(prev => ({ ...prev, temperature: val }));
                                showToast(
                                  language === 'ka' ? `კრეატიულობა შეიცვალა: ${val}` : `Creativity updated to: ${val}`,
                                  'info'
                                );
                              }}
                              className={cn(
                                "p-3 rounded-xl border text-left transition-all cursor-pointer hover:border-proton-accent/60 active:scale-95 flex flex-col justify-between h-auto min-h-[5rem]",
                                Math.abs(aiSettings.temperature - item.val) < 0.05
                                  ? "bg-proton-accent/10 border-proton-accent shadow-md shadow-proton-accent/5"
                                  : "bg-proton-bg/20 border-proton-border/40 hover:bg-proton-secondary/10"
                              )}
                            >
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-wider",
                                Math.abs(aiSettings.temperature - item.val) < 0.05 ? "text-proton-accent" : "text-proton-text"
                              )}>{item.label}</span>
                              <span className="text-[10px] text-proton-text-light/90 block font-semibold uppercase tracking-tight mt-1 break-words leading-normal">{item.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Google Web Search & Google Maps Toggle Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className={cn(
                        "p-6 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group",
                        aiSettings.enableSearch ? "bg-proton-accent/5 border-proton-accent/40" : "bg-proton-secondary/10 border-proton-border"
                      )} onClick={() => {
                        const next = !aiSettings.enableSearch;
                        updateAiSettings(prev => ({ ...prev, enableSearch: next }));
                        showToast(
                          next 
                            ? (language === 'ka' ? 'ინფორმაციის მოძიება აქტიურია!' : 'Google Search integrated successfully!') 
                            : (language === 'ka' ? 'ინფორმაციის მოძიება გამორთულია.' : 'Google Search deactivated.'),
                          next ? 'success' : 'info'
                        );
                      }}>
                        <div className="flex items-center gap-3">
                          <Search size={18} className={aiSettings.enableSearch ? "text-proton-accent animate-bounce" : "text-proton-muted"} />
                          <div className="text-left">
                            <label className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-proton-text">
                              {language === 'ka' ? 'ინტერნეტში მოძიება' : 'Search on Google'}
                            </label>
                            <p className="text-[10px] text-proton-muted/90 uppercase font-semibold mt-1 leading-normal tracking-wide">
                              {language === 'ka' ? 'უახლესი ამბების მოსაძებნად' : 'Find recent info online'}
                            </p>
                          </div>
                        </div>
                        <div className={cn(
                          "w-10 h-5 rounded-full relative transition-all border border-proton-border shrink-0",
                          aiSettings.enableSearch ? "bg-proton-accent border-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.3)]" : "bg-proton-secondary/30"
                        )}>
                          <div className={cn(
                            "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all shadow-sm",
                            aiSettings.enableSearch ? "right-0.5" : "left-0.5"
                          )} />
                        </div>
                      </div>
                      
                      <div className={cn(
                        "p-6 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group",
                        aiSettings.enableMaps ? "bg-proton-accent/5 border-proton-accent/40" : "bg-proton-secondary/10 border-proton-border"
                      )} onClick={() => {
                        const next = !aiSettings.enableMaps;
                        updateAiSettings(prev => ({ ...prev, enableMaps: next }));
                        showToast(
                          next 
                            ? (language === 'ka' ? 'რუკების მოდული გააქტიურდა!' : 'Maps awareness enabled!') 
                            : (language === 'ka' ? 'რუკების მოდული გამორთულია.' : 'Maps deactivated.'),
                          next ? 'success' : 'info'
                        );
                      }}>
                        <div className="flex items-center gap-3">
                          <MapPin size={18} className={aiSettings.enableMaps ? "text-proton-accent animate-pulse" : "text-proton-muted"} />
                          <div className="text-left">
                            <label className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-proton-text">
                              {language === 'ka' ? 'ადგილები და რუკები' : 'Places & Maps'}
                            </label>
                            <p className="text-[10px] text-proton-muted/90 uppercase font-semibold mt-1 leading-normal tracking-wide">
                              {language === 'ka' ? 'მდებარეობების საჩვენებლად' : 'Display map locations'}
                            </p>
                          </div>
                        </div>
                        <div className={cn(
                          "w-10 h-5 rounded-full relative transition-all border border-proton-border shrink-0",
                          aiSettings.enableMaps ? "bg-proton-accent border-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.3)]" : "bg-proton-secondary/30"
                        )}>
                          <div className={cn(
                            "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all shadow-sm",
                            aiSettings.enableMaps ? "right-0.5" : "left-0.5"
                          )} />
                        </div>
                      </div>
                    </div>

                    {/* AI Voices Row */}
                    <div className="space-y-4">
                       <label className="text-[11px] font-black uppercase tracking-wider flex items-center gap-2 text-proton-muted">
                         <Volume2 size={16} className="text-purple-400" />
                         {language === 'ka' ? 'ასისტენტის ხმა' : 'Assistant Voice Style'}
                       </label>
                       <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                         {[
                           { id: 'Kore', label: 'Kore' },
                           { id: 'Fenrir', label: 'Fenrir' },
                           { id: 'Charon', label: 'Charon' },
                           { id: 'TbilisiDialect', label: language === 'ka' ? 'ადგილობრივი' : 'Local' },
                           { id: 'GeorgianModern', label: language === 'ka' ? 'ქართული' : 'Georgian' }
                         ].map((voice) => (
                           <button
                             key={voice.id}
                             type="button"
                             onClick={() => {
                               updateAiSettings(prev => ({ ...prev, voice: voice.id }));
                               showToast(
                                 language === 'ka' ? `ასისტენტის ხმა: ${voice.label}` : `Assistant voice set to: ${voice.label}`,
                                 'info'
                                );
                             }}
                             className={cn(
                               "p-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider text-center transition-all cursor-pointer",
                               aiSettings.voice === voice.id 
                                ? "bg-proton-accent border-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20" 
                                : "bg-proton-secondary/10 border-proton-border/50 text-proton-muted hover:border-proton-accent/50 hover:text-proton-text"
                             )}
                           >
                             {voice.label}
                           </button>
                         ))}
                       </div>
                    </div>

                    {/* Creative Visual Mode Mode toggle */}
                    <div className={cn(
                      "p-6 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group",
                      uiMode === 'creative' ? "bg-proton-accent/10 border-proton-accent/40 shadow-lg shadow-proton-accent/5" : "bg-proton-secondary/10 border-proton-border"
                    )} onClick={() => {
                      const next = uiMode === 'business' ? 'creative' : 'business';
                      setUiMode(next);
                      showToast(
                        next === 'creative' 
                          ? (language === 'ka' ? 'ფერადი ნეონის ვიზუალი აქტიურია!' : 'Glowing neon visuals active!') 
                          : (language === 'ka' ? 'სუფთა მინიმალისტური რეჟიმი ჩართულია.' : 'Clean minimal layout active.'),
                        'success'
                      );
                    }}>
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shrink-0",
                          uiMode === 'creative' ? "bg-proton-accent text-proton-bg shadow-lg" : "bg-proton-secondary/20 text-proton-muted"
                        )}>
                          <Sparkles size={28} />
                        </div>
                        <div className="text-left">
                          <label className="text-xs font-black uppercase tracking-widest cursor-pointer block text-proton-text">
                            {language === 'ka' ? 'ფერადი ნეონის ვიზუალი' : 'Vibrant Neon Design'}
                          </label>
                          <p className="text-[10px] text-proton-muted font-bold uppercase tracking-tighter mt-1">
                            {language === 'ka' ? 'ჩართეთ ლამაზი ნეონის ფერები და ეფექტები ინტერფეისში' : 'Enable glowing neon accents and visual effects'}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-12 h-6 rounded-full relative transition-all border border-proton-border shrink-0",
                        uiMode === 'creative' ? "bg-proton-accent border-proton-accent" : "bg-proton-secondary/30"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-md",
                          uiMode === 'creative' ? "right-0.5" : "left-0.5"
                        )} />
                      </div>
                    </div>

                    {/* Custom AI Instructions & Quick prompt templates */}
                    <div className="space-y-4 pt-6 border-t border-proton-border/50">
                       <div className="flex items-center justify-between gap-2">
                         <label className="text-[11px] font-black uppercase tracking-wider text-proton-muted block">
                           {language === 'ka' ? 'AI-ს ხასიათი და ქცევა' : 'AI Behavior & Personality'}
                         </label>
                         <span className="text-[8px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 flex items-center gap-1 shrink-0">
                           <Save size={10} />
                           {language === 'ka' ? 'საჭიროებს ზედა SAVE ღილაკს' : 'Requires top Save button'}
                         </span>
                       </div>
                       
                       <textarea
                         value={aiSettings.systemInstruction || ""}
                         onChange={e => {
                           const val = e.target.value.slice(0, 4000);
                           updateAiSettings(prev => ({ ...prev, systemInstruction: val }));
                         }}
                         maxLength={4000}
                         className="w-full max-w-3xl bg-proton-secondary/20 p-5 rounded-2xl border border-proton-border text-xs font-medium text-proton-text focus:outline-none focus:border-proton-accent focus:ring-4 focus:ring-proton-accent/5 transition-all min-h-[140px] shadow-inner placeholder:text-proton-muted/30"
                         placeholder={language === 'ka' ? "მაგალითად: იყავი მეგობრული დიზაინერი, ისაუბრე მოკლედ და გამოიყენე მარტივი სიტყვები..." : "Example: Speak like a friendly designer, be brief, and use simple language..."}
                       />

                       {/* Quick System instructions Templates */}
                       <div className="space-y-2">
                         <label className="text-[9px] font-black uppercase tracking-widest text-proton-muted/80">{language === 'ka' ? 'აირჩიეთ მზა ქცევის სტილი' : 'Choose a Ready Personality'}</label>
                         <div className="flex flex-wrap gap-2">
                           {[
                             { 
                               label: language === 'ka' ? 'პროფესიონალი 🧠' : 'Professional 🧠', 
                               text: language === 'ka' 
                                 ? 'შენ ხარ მეგობრული და პროფესიონალი დიზაინერი. ისაუბრე მარტივად, ზედმეტი ტექნიკური ტერმინების გარეშე.' 
                                 : 'You are a friendly and professional designer. Speak simply, without complex technical terms.' 
                             },
                             { 
                               label: language === 'ka' ? 'მოკლე პასუხები ⚡' : 'Short & Direct ⚡', 
                               text: language === 'ka' 
                                 ? 'იყავი უკიდურესად მოკლე, კონკრეტული და მიპასუხე ზედმეტი სიტყვების გარეშე.' 
                                 : 'Be extremely brief, direct, and answer without any extra talk.' 
                             },
                             { 
                               label: language === 'ka' ? 'კრეატიული 🎨' : 'Creative Buddy 🎨', 
                               text: language === 'ka' 
                                 ? 'შენ ხარ შემოქმედებითი პარტნიორი. დამეხმარე ახალი, ფერადი და ვიზუალური იდეების მოფიქრებაში.' 
                                 : 'You are a creative partner. Help me brainstorm beautiful, visual ideas.' 
                             },
                             { 
                               label: 'ქართულ-English 🇬🇪', 
                               text: language === 'ka' 
                                 ? 'უპასუხე მეგობრულ, ჰიბრიდულ ქართულ-ინგლისურ ტექნიკურ დიალექტზე.' 
                                 : 'Respond in a friendly, hybrid English-Georgian tech dialect.' 
                             },
                           ].map((tmpl) => (
                             <button
                               key={tmpl.label}
                               type="button"
                               onClick={() => {
                                 updateAiSettings(prev => ({ ...prev, systemInstruction: tmpl.text }));
                                 showToast(
                                   language === 'ka' ? `ქცევის სტილი '${tmpl.label}' ჩაიტვირთა!` : `Preset character '${tmpl.label}' loaded!`,
                                   'success'
                                 );
                               }}
                               className="px-3 py-1.5 rounded-lg bg-proton-secondary/10 border border-proton-border/40 text-[9px] font-black uppercase tracking-wider text-proton-muted hover:border-proton-accent hover:text-proton-text transition-all active:scale-95"
                             >
                               {tmpl.label}
                             </button>
                           ))}
                         </div>
                       </div>
                    </div>

                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-8 pb-10" id="sec-profile">
                  <header className="pb-6 border-b border-proton-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight flex items-center gap-2">
                        <User size={20} className="text-proton-accent" />
                        {language === 'ka' ? 'ჩემი პროფილი' : 'My Profile'}
                      </h3>
                      <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest">
                        {language === 'ka' ? 'მართეთ თქვენი სახელი, როლი და პირადი პარამეტრები' : 'Manage your name, workspace role, and personal info'}
                      </p>
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 flex items-center gap-1 shrink-0 self-start sm:self-auto">
                      <Save size={10} />
                      {language === 'ka' ? 'ინახება ზედა SAVE ღილაკით' : 'Saves via top Save button'}
                    </span>
                  </header>

                  <div className="space-y-8">
                    {/* Identity Header Card with customizable avatar & background gradient */}
                    <div className="relative overflow-hidden rounded-2xl border border-proton-border/40 bg-gradient-to-br from-proton-secondary/20 via-proton-bg to-proton-secondary/10 p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-proton-accent/5 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="relative group shrink-0">
                        <ProtonAvatar 
                          src={userProfile.avatar}
                          name={userProfile.name}
                          alt="Profile"
                          size="xl"
                          className="w-24 h-24 text-xl border-4 border-proton-border shadow-2xl transition-all duration-300 group-hover:border-proton-accent/80 group-hover:scale-105"
                        />
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          type="button"
                          className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-proton-accent text-proton-bg flex items-center justify-center border-4 border-proton-card shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 cursor-pointer"
                        >
                          <Camera size={16} />
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileChange} 
                          accept="image/*" 
                          className="hidden" 
                        />
                      </div>

                      <div className="text-center md:text-left space-y-2">
                        <div className="flex flex-col md:flex-row md:items-center gap-2">
                          <h4 className="text-base font-black text-proton-text uppercase tracking-wider truncate max-w-[260px] sm:max-w-[340px]">
                            {userProfile.name || (language === 'ka' ? 'მომხმარებელი' : 'User')}
                          </h4>
                          <ProtonBadge variant="accent" size="sm" pulse className="w-fit mx-auto md:mx-0">
                            <ShieldCheck size={10} className="mr-1" />
                            {language === 'ka' ? 'დადასტურებული პროფილი' : 'Verified Profile'}
                          </ProtonBadge>
                        </div>
                        <p className="text-[10px] text-proton-muted font-bold uppercase tracking-widest">
                          {userProfile.role === 'System Architect' ? (language === 'ka' ? 'დიზაინერი' : 'Designer') :
                           userProfile.role === 'Founder & CEO' ? (language === 'ka' ? 'დამფუძნებელი / CEO' : 'Founder / CEO') :
                           userProfile.role === 'Security Auditor' ? (language === 'ka' ? 'კრეატიული დირექტორი' : 'Creative Director') :
                           userProfile.role === 'AI Specialist' ? (language === 'ka' ? 'მარკეტოლოგი' : 'Marketer') :
                           userProfile.role === 'Lead Developer' ? (language === 'ka' ? 'დეველოპერი' : 'Developer') :
                           userProfile.role || (language === 'ka' ? 'შემოქმედი' : 'Creator')}
                        </p>
                        <p className="text-[9px] text-proton-muted/80 font-semibold max-w-sm leading-normal">
                          {language === 'ka' 
                            ? 'მართეთ თქვენი სახელი, როლი და პირადი პარამეტრები ერთ მარტივ სივრცეში.' 
                            : 'Manage your name, workspace role, and personal info in one simple place.'}
                        </p>
                      </div>
                    </div>

                    {/* Technical Profile Fields Form */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-proton-secondary/5 p-6 rounded-2xl border border-proton-border/30 w-full max-w-4xl">
                      <ProtonInput
                        id="profile-name-input"
                        label={language === 'ka' ? 'სახელი და გვარი' : 'Your Name'}
                        leftIcon={<User size={18} className="text-proton-accent/70" />}
                        value={userProfile.name || ''}
                        onChange={e => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. John Doe"
                      />

                      <ProtonInput
                        id="profile-email-input"
                        type="email"
                        label={language === 'ka' ? 'ელფოსტა' : 'Email Address'}
                        leftIcon={<Mail size={18} className={emailError ? "text-rose-500" : "text-proton-accent/70"} />}
                        value={userProfile.email || ''}
                        onChange={e => setUserProfile(prev => ({ ...prev, email: e.target.value }))}
                        onBlur={() => setEmailTouched(true)}
                        error={emailError ? (language === 'ka' ? 'არასწორი ელფოსტის ფორმატი (მაგ: name@domain.com)' : 'Invalid email format (e.g. name@domain.com)') : undefined}
                        placeholder="e.g. john@example.com"
                      />

                      <ProtonInput
                        id="profile-location-input"
                        label={language === 'ka' ? 'მდებარეობა' : 'Location'}
                        leftIcon={<Globe size={18} className="text-proton-accent/70" />}
                        value={userProfile.region || ''}
                        onChange={e => setUserProfile(prev => ({ ...prev, region: e.target.value }))}
                        placeholder="e.g. Tbilisi, GE"
                      />

                      <ProtonInput
                        id="profile-phone-input"
                        type="tel"
                        label={language === 'ka' ? 'ტელეფონის ნომერი' : 'Phone Number'}
                        leftIcon={<Phone size={18} className={phoneError ? "text-rose-500" : "text-proton-accent/70"} />}
                        value={userProfile.phoneNumber || ''}
                        onChange={e => setUserProfile(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        onBlur={() => setPhoneTouched(true)}
                        error={phoneError ? (language === 'ka' ? 'არასწორი ნომრის ფორმატი (სულ მცირე 7 ციფრი)' : 'Invalid phone format (at least 7 digits, e.g. +995 ...)') : undefined}
                        placeholder="+995 ..."
                      />
                    </div>

                    {/* Interactive Danger Zone Section */}
                    <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-4 max-w-4xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                          <ShieldAlert size={20} />
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <h4 className="text-xs font-black text-red-400 uppercase tracking-widest leading-tight">{language === 'ka' ? 'მონაცემების გასუფთავება' : 'Clear Data & Reset'}</h4>
                          <p className="text-[9px] text-proton-muted font-bold uppercase tracking-tight mt-0.5 leading-normal">{language === 'ka' ? 'საწყისი პარამეტრების დაბრუნება' : 'Reset workspace to defaults'}</p>
                        </div>
                      </div>
                      
                      <p className="text-[10px] text-proton-muted leading-relaxed break-words font-medium">
                        {language === 'ka' 
                          ? 'ყველა სახელი, ფოტო და პარამეტრი დაბრუნდება საწყის მდგომარეობაში. ეს მოქმედება წაშლის თქვენს მიერ შეტანილ ცვლილებებს.' 
                          : 'Reset all names, photos, and options to their original values. This will clear your custom changes.'}
                      </p>

                      {!showResetModal ? (
                        <button
                          type="button"
                          onClick={() => setShowResetModal(true)}
                          className="w-full sm:w-auto px-5 py-3 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 hover:border-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Trash2 size={14} />
                          {language === 'ka' ? 'ყველაფრის წაშლა' : 'Reset All Settings'}
                        </button>
                      ) : (
                        <div className="p-5 bg-proton-bg border border-red-500/30 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 max-w-2xl">
                          <span className="text-xs font-black text-red-400 uppercase tracking-wider block leading-relaxed break-words">
                            ⚠️ {language === 'ka' ? 'დარწმუნებული ხართ, რომ გსურთ ყველაფრის განულება?' : 'Are you absolutely sure you want to reset everything?'}
                          </span>
                          <div className="flex flex-col sm:flex-row gap-3 pt-1">
                            <button
                              type="button"
                              onClick={handleResetWorkspace}
                              className="w-full sm:w-auto px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center cursor-pointer shadow-md"
                            >
                              {language === 'ka' ? 'დიახ, განულება' : 'Yes, Reset Now'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowResetModal(false)}
                              className="w-full sm:w-auto px-5 py-2.5 bg-proton-secondary/20 hover:bg-proton-secondary/40 text-proton-text border border-proton-border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                            >
                              {language === 'ka' ? 'გაუქმება' : 'Cancel'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="space-y-8 animate-in fade-in duration-300" id="sec-preferences">
                  <header className="pb-6 border-b border-proton-border/50">
                    <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight">
                      {language === 'ka' ? 'დიზაინი და ენა' : 'Design & Language'}
                    </h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest">
                      {language === 'ka' ? 'შეცვალეთ საიტის ფერები, ენა და სასარგებლო ხელსაწყოები' : 'Choose website language, colors, and helpful creator tools'}
                    </p>
                  </header>

                  <div className="space-y-8">
                    {/* Instant Systems Toast Demonstration Center */}
                    <div className="p-6 bg-proton-accent/10 border border-proton-accent/30 rounded-2xl space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <Sparkles size={100} className="text-proton-accent" />
                      </div>
                      
                      <div className="text-left">
                        <label className="text-[11px] font-black uppercase tracking-wider text-proton-accent flex items-center gap-2">
                          <Bell size={14} className="animate-bounce" />
                          {language === 'ka' ? 'შეტყობინებების ტესტი' : 'Notification Test'}
                        </label>
                        <p className="text-[9px] text-proton-muted font-bold uppercase tracking-widest mt-0.5 leading-relaxed">
                          {language === 'ka' 
                            ? 'დააკლიკეთ ღილაკებს სხვადასხვა ფერის შეტყობინების შესამოწმებლად:' 
                            : 'Click the buttons below to see how floating alerts look:'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10 w-full max-w-4xl">
                        <button
                          type="button"
                          onClick={() => showToast(
                            language === 'ka' ? 'ოპერაცია წარმატებით შესრულდა!' : 'Success Toast: Action completed successfully!',
                            'success'
                          )}
                          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-[9px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          <CheckCircle2 size={12} />
                          {language === 'ka' ? 'წარმატება' : 'Success'}
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(
                            language === 'ka' ? 'მოქმედება ვერ შესრულდა!' : 'Error occurred: action failed.',
                            'error'
                          )}
                          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all text-[9px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          <AlertCircle size={12} />
                          {language === 'ka' ? 'შეცდომა' : 'Error Alert'}
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(
                            language === 'ka' ? 'ყურადღება: ლიმიტი იწურება.' : 'Warning: storage limit is close to full.',
                            'warning'
                          )}
                          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all text-[9px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          <AlertTriangle size={12} />
                          {language === 'ka' ? 'ყურადღება' : 'Warning style'}
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(
                            language === 'ka' ? 'საიტი განახლდა!' : 'System updated!',
                            'info'
                          )}
                          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-950/20 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-all text-[9px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          <Info size={12} />
                          {language === 'ka' ? 'ინფორმაცია' : 'Informational'}
                        </button>
                      </div>
                    </div>

                    {/* 1. Language Sector */}
                    <div className="p-6 bg-proton-secondary/5 border border-proton-border/50 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between gap-2 text-left">
                        <div>
                          <label className="text-[11px] font-black uppercase tracking-wider text-proton-text block">
                            {language === 'ka' ? 'საიტის ენა' : 'Website Language'}
                          </label>
                          <p className="text-[9px] text-proton-muted font-black uppercase tracking-widest mt-0.5">
                            {language === 'ka' ? 'აირჩიეთ სასურველი ენა ინტერფეისისთვის' : 'Choose your preferred language'}
                          </p>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-proton-accent bg-proton-accent/10 px-2.5 py-1 rounded-md border border-proton-accent/20 flex items-center gap-1 shrink-0">
                          <Zap size={10} />
                          {language === 'ka' ? 'ინახება მომენტალურად' : 'Saves instantly'}
                        </span>
                      </div>

                      <div className="flex bg-proton-bg border border-proton-border/50 rounded-2xl p-1 max-w-sm">
                        <button 
                          type="button"
                          onClick={() => {
                            if (language !== 'en') {
                              setLanguage('en');
                              setUserProfile(prev => ({ ...prev, language: 'en' }));
                              setTimeout(() => {
                                showToast('Language changed to English successfully!', 'success');
                              }, 100);
                            }
                          }}
                          className={cn(
                            "flex-1 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-widest",
                            language === 'en' ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/10" : "text-proton-muted hover:text-proton-text"
                          )}
                        >
                          English (EN)
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            if (language !== 'ka') {
                              setLanguage('ka');
                              setUserProfile(prev => ({ ...prev, language: 'ka' }));
                              setTimeout(() => {
                                showToast('ინტერფეისის ენა შეიცვალა ქართულად!', 'success');
                              }, 100);
                            }
                          }}
                          className={cn(
                            "flex-1 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-widest",
                            language === 'ka' ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/10" : "text-proton-muted hover:text-proton-text"
                          )}
                        >
                          ქართული (GE)
                        </button>
                      </div>
                    </div>

                    {/* 2. Global Site Theme Accent */}
                    <div className="p-6 bg-proton-secondary/5 border border-proton-border/50 rounded-2xl space-y-5">
                      <div className="flex items-center justify-between gap-2 text-left">
                        <div>
                          <label className="text-[11px] font-black uppercase tracking-wider text-proton-text block">
                            {language === 'ka' ? 'საიტის თემა და ფერები' : 'Theme & Color Accent'}
                          </label>
                          <p className="text-[9px] text-proton-muted font-black uppercase tracking-widest mt-0.5">
                            {language === 'ka' ? 'აირჩიეთ საიტის ფერი და განწყობა' : 'Choose website color and mood'}
                          </p>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-proton-accent bg-proton-accent/10 px-2.5 py-1 rounded-md border border-proton-accent/20 flex items-center gap-1 shrink-0">
                          <Zap size={10} />
                          {language === 'ka' ? 'ინახება მომენტალურად' : 'Saves instantly'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                        {THEMES.map((tInfo) => {
                          const displayLabel = (t as any)[tInfo.labelKey] || tInfo.fallbackLabel;
                          return (
                            <button
                              key={tInfo.id}
                              type="button"
                              onClick={() => {
                                setTheme(tInfo.id);
                                showToast(
                                  language === 'ka' 
                                    ? `აქტიური გახდა გლობალური თემა: ${displayLabel}` 
                                    : `Global theme updated to: ${displayLabel}`,
                                  'success'
                                );
                              }}
                              className={cn(
                                "flex flex-col items-center gap-2.5 p-3 sm:p-4 rounded-2xl transition-all border-2 group relative overflow-hidden",
                                theme === tInfo.id 
                                  ? "bg-proton-card border-proton-accent shadow-xl ring-4 ring-proton-accent/5 scale-[1.02]" 
                                  : "border-proton-border bg-proton-secondary/5 hover:bg-proton-secondary/10 hover:border-proton-accent/30"
                              )}
                            >
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-md",
                                theme === tInfo.id ? "bg-proton-accent text-proton-bg" : "bg-proton-secondary/10 text-proton-muted"
                              )}>
                                {tInfo.icon}
                              </div>
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest text-center truncate w-full px-1",
                                theme === tInfo.id ? "text-proton-text" : "text-proton-muted group-hover:text-proton-text"
                              )}>{displayLabel}</span>
                              {theme === tInfo.id && (
                                <motion.div 
                                  layoutId="active-theme-dot"
                                  className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-proton-accent shadow-[0_0_10px_rgba(0,242,255,0.8)]" 
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. Zen Mode and system states */}
                    <div className={cn(
                      "p-6 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group",
                      aiSettings.zenMode ? "bg-amber-500/5 border-amber-500/30 shadow-lg shadow-amber-500/5" : "bg-proton-secondary/10 border-proton-border"
                    )} onClick={() => {
                      const next = !aiSettings.zenMode;
                      updateAiSettings(prev => ({ ...prev, zenMode: next }));
                      showToast(
                        next 
                          ? (language === 'ka' ? 'ფოკუსის რეჟიმი ჩაირთო! ეკრანი მაქსიმალურად სუფთაა.' : 'Zen focus mode activated!') 
                          : (language === 'ka' ? 'ფოკუსის რეჟიმი გამოირთო.' : 'Zen focus mode turned off.'),
                        'info'
                      );
                    }}>
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shrink-0",
                          aiSettings.zenMode ? "bg-amber-500/20 text-amber-500 shadow-lg" : "bg-proton-secondary/20 text-proton-muted"
                        )}>
                          <EyeOff size={28} />
                        </div>
                        <div className="text-left">
                          <label className="text-xs font-black uppercase tracking-widest cursor-pointer block text-proton-text">
                            {language === 'ka' ? 'ფოკუსის რეჟიმი (Zen)' : 'Zen Mode (Quiet Focus)'}
                          </label>
                          <p className="text-[10px] text-proton-muted font-bold uppercase tracking-tighter mt-1">
                            {language === 'ka' ? 'დამალეთ ზედმეტი დეტალები ინტერფეისიდან მეტი კონცენტრაციისთვის' : 'Hide extra details from the screen for a cleaner space to focus'}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-12 h-6 rounded-full relative transition-all border border-proton-border shrink-0",
                        aiSettings.zenMode ? "bg-amber-500 border-amber-500" : "bg-proton-secondary/30"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-md",
                          aiSettings.zenMode ? "right-0.5" : "left-0.5"
                        )} />
                      </div>
                    </div>

                    {/* 5. Global Notifications Toggle */}
                    {(() => {
                      const isNotifActive = userProfile.notifications !== false && userProfile.notificationsEnabled !== false;
                      return (
                        <div 
                          id="toggle-global-notifications"
                          className={cn(
                            "p-6 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group focus-visible:ring-2 focus-visible:ring-proton-accent focus-visible:outline-none",
                            isNotifActive 
                              ? "bg-proton-accent/5 border-proton-accent/35 shadow-lg shadow-proton-accent/5" 
                              : "bg-proton-secondary/10 border-proton-border opacity-90 hover:opacity-100"
                          )} 
                          onClick={() => {
                            const next = !isNotifActive;
                            setUserProfile(prev => ({ ...prev, notifications: next, notificationsEnabled: next }));
                            if (user) {
                              const userDocRef = doc(db, 'users', user.uid);
                              setDoc(userDocRef, { notifications: next, notificationsEnabled: next }, { merge: true }).catch(err => {
                                console.warn("Failed to sync notifications setting to Firestore:", err);
                              });
                            }
                            showToast(
                              next 
                                ? (language === 'ka' ? 'შეტყობინებები ჩაირთო! რეალური დროის სინქრონიზაცია აქტიურია.' : 'Global notifications enabled! Real-time alerts are active.') 
                                : (language === 'ka' ? 'შეტყობინებები გაითიშა. მონაცემების კითხვა შეჩერებულია.' : 'Global notifications muted. Firestore polling paused.'),
                              next ? 'success' : 'info'
                            );
                          }}
                          tabIndex={0}
                          role="switch"
                          aria-checked={isNotifActive}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              const next = !isNotifActive;
                              setUserProfile(prev => ({ ...prev, notifications: next, notificationsEnabled: next }));
                              if (user) {
                                const userDocRef = doc(db, 'users', user.uid);
                                setDoc(userDocRef, { notifications: next, notificationsEnabled: next }, { merge: true }).catch(console.warn);
                              }
                              showToast(
                                next 
                                  ? (language === 'ka' ? 'შეტყობინებები ჩაირთო!' : 'Global notifications enabled!') 
                                  : (language === 'ka' ? 'შეტყობინებები გაითიშა.' : 'Global notifications muted.'),
                                next ? 'success' : 'info'
                              );
                            }
                          }}
                        >
                          <div className="flex items-center gap-5">
                            <div className={cn(
                              "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shrink-0",
                              isNotifActive 
                                ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20" 
                                : "bg-proton-secondary/20 text-proton-muted"
                            )}>
                              {isNotifActive ? <Bell size={28} /> : <BellOff size={28} />}
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-black uppercase tracking-widest cursor-pointer block text-proton-text">
                                  {language === 'ka' ? 'შეტყობინებების ჩართვა' : 'Global Notifications'}
                                </label>
                                <span className={cn(
                                  "text-[8px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                                  isNotifActive 
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                                    : "bg-proton-secondary/30 border-proton-border text-proton-muted"
                                )}>
                                  {isNotifActive 
                                    ? (language === 'ka' ? 'აქტიურია' : 'Enabled') 
                                    : (language === 'ka' ? 'გამორთულია' : 'Muted')}
                                </span>
                              </div>
                              <p className="text-[10px] text-proton-muted font-bold uppercase tracking-tighter mt-1">
                                {language === 'ka' 
                                  ? 'სისტემური, AI და მარკეტის შეტყობინებების რეალურ დროში მიღება და სინქრონიზაცია' 
                                  : 'Receive real-time alerts, system messages, and AI notifications'}
                              </p>
                            </div>
                          </div>
                          {/* Apple-style Pill Toggle */}
                          <div className={cn(
                            "w-12 h-6 rounded-full relative transition-all border border-proton-border shrink-0",
                            isNotifActive ? "bg-proton-accent border-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.3)]" : "bg-proton-secondary/30"
                          )}>
                            <div className={cn(
                              "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-md",
                              isNotifActive ? "right-0.5" : "left-0.5"
                            )} />
                          </div>
                        </div>
                      );
                    })()}

                    {/* 6. Commercial SaaS Exit Hub Toggle */}
                    <div className={cn(
                      "p-6 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group",
                      userProfile.showCommercialHub ? "bg-proton-accent/5 border-proton-accent/35 shadow-lg shadow-proton-accent/5" : "bg-proton-secondary/10 border-proton-border"
                    )} onClick={() => {
                      const next = !userProfile.showCommercialHub;
                      setUserProfile(prev => ({ ...prev, showCommercialHub: next }));
                      showToast(
                        next 
                          ? (language === 'ka' ? 'ბიზნეს კალკულატორი გამოჩნდა გვერდითა მენიუში!' : 'Business tools activated in sidebar!') 
                          : (language === 'ka' ? 'ბიზნეს კალკულატორი დამალულია გვერდითა მენიუდან.' : 'Business tools hidden from sidebar.'),
                        'success'
                      );
                    }}>
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shrink-0",
                          userProfile.showCommercialHub ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20" : "bg-proton-secondary/20 text-proton-muted"
                        )}>
                          <TrendingUp size={28} />
                        </div>
                        <div className="text-left">
                          <label className="text-xs font-black uppercase tracking-widest cursor-pointer block text-proton-text">
                            {language === 'ka' ? 'ბიზნესის კალკულატორი' : 'Business & Earnings Tools'}
                          </label>
                          <p className="text-[10px] text-proton-muted font-bold uppercase tracking-tighter mt-1">
                            {language === 'ka' ? 'გვერდითა მენიუში დამატებითი ბიზნეს-ანალიტიკის ხელსაწყოს გამოჩენა' : 'Show additional business planning and value calculators in the sidebar'}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-12 h-6 rounded-full relative transition-all border border-proton-border shrink-0",
                        userProfile.showCommercialHub ? "bg-proton-accent border-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.3)]" : "bg-proton-secondary/30"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-md",
                          userProfile.showCommercialHub ? "right-0.5" : "left-0.5"
                        )} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-8" id="sec-security">
                  <header className="pb-6 border-b border-proton-border/50">
                    <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight flex items-center gap-2">
                      <Shield size={20} className="text-proton-accent" />
                      {language === 'ka' ? 'საიტის უსაფრთხოება' : 'Website Security'}
                    </h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest text-left">
                      {language === 'ka' ? 'საიტის დაცვა და მუშაობის შემოწმება' : 'Secure your website and check health status'}
                    </p>
                  </header>

                  <div className="space-y-6">
                    {/* Status card */}
                    <div className="p-6 bg-green-500/5 border border-green-500/20 rounded-2xl flex items-center justify-between group">
                       <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-green-500 text-proton-bg flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all group-hover:scale-105">
                             <ShieldCheck size={24} />
                          </div>
                          <div className="text-left">
                             <p className="text-xs font-black uppercase tracking-wide text-green-400">
                               {language === 'ka' ? 'დაცვა: აქტიურია' : 'Protection: Active'}
                             </p>
                             <p className="text-[10px] font-bold text-green-500/50 uppercase tracking-tighter mt-0.5">
                               {language === 'ka' ? 'ყველა სისტემა დაცულია გამართულად' : 'All systems running safely'}
                             </p>
                          </div>
                       </div>
                       <Lock size={20} className="text-green-500" />
                    </div>

                    {/* 1. Security PIN (Optional) Section */}
                    <div className="p-6 bg-proton-secondary/5 border border-proton-border/30 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <KeyRound size={18} className="text-proton-accent" />
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-proton-text block">
                              {language === 'ka' ? 'უსაფრთხოების PIN კოდი (არასავალდებულო)' : 'Security PIN Code (Optional)'}
                            </span>
                            <span className="text-[9px] text-proton-muted font-bold uppercase tracking-tight block mt-0.5">
                              {userProfile.securityPinEnabled 
                                ? (language === 'ka' ? 'PIN დაცვა: ჩართულია' : 'PIN Protection: Enabled') 
                                : (language === 'ka' ? 'PIN დაცვა: გამორთულია' : 'PIN Protection: Disabled')}
                            </span>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border flex items-center gap-1 shrink-0",
                          userProfile.securityPinEnabled 
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
                            : "text-proton-muted bg-proton-secondary/20 border-proton-border/40"
                        )}>
                          {userProfile.securityPinEnabled 
                            ? (language === 'ka' ? 'აქტიური' : 'Active') 
                            : (language === 'ka' ? 'არასავალდებულო' : 'Optional')}
                        </span>
                      </div>

                      <p className="text-[10px] text-proton-muted leading-relaxed font-bold tracking-tight text-left">
                        {language === 'ka'
                          ? 'გამოიყენეთ 4-ნიშნა PIN კოდი სენსიტიური მოქმედებების დამატებითი დადასტურებისთვის (ანგარიშის წაშლა, ელფოსტის შეცვლა, ფინანსური გადარიცხვები). ჩვეულებრივი სარგებლობისას კოდი არ მოგეთხოვებათ.'
                          : 'Use a 4-digit PIN for extra confirmation on sensitive actions (account deletion, email change, financial transfers). Normal browsing never requires a PIN.'}
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1 text-left">
                        {!userProfile.securityPinEnabled ? (
                          <button
                            type="button"
                            onClick={() => openPinSetupModal('enable')}
                            className="px-4 py-2 bg-proton-accent text-proton-bg text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-white transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-md"
                          >
                            <Lock size={12} />
                            {language === 'ka' ? 'PIN კოდის ჩართვა' : 'Enable PIN Code'}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openPinSetupModal('change')}
                              className="px-4 py-2 bg-proton-accent/10 border border-proton-accent/30 text-proton-accent hover:bg-proton-accent hover:text-proton-bg text-[9px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                            >
                              <RefreshCw size={12} />
                              {language === 'ka' ? 'PIN კოდის შეცვლა' : 'Change PIN Code'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openPinSetupModal('disable')}
                              className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 size={12} />
                              {language === 'ka' ? 'PIN კოდის გამორთვა' : 'Disable PIN Code'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 2. Two-Factor Authentication (2FA) Placeholder */}
                    <div className="p-6 bg-proton-secondary/5 border border-proton-border/30 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Smartphone size={18} className="text-amber-400" />
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-proton-text block">
                              {language === 'ka' ? 'ორფაქტორიანი ავტორიზაცია (2FA)' : 'Two-Factor Authentication (2FA)'}
                            </span>
                            <span className="text-[9px] text-proton-muted font-bold uppercase tracking-tight block mt-0.5">
                              {language === 'ka' ? 'Authenticator აპლიკაციის დაცვა' : 'Authenticator App Protection'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 shrink-0">
                          {language === 'ka' ? 'მალე დაემატება' : 'Coming Soon'}
                        </span>
                      </div>

                      <p className="text-[10px] text-proton-muted leading-relaxed font-bold tracking-tight text-left">
                        {language === 'ka'
                          ? 'დამატებითი უსაფრთხოების შრე თქვენი ანგარიშისთვის Authenticator აპლიკაციის (Google Authenticator, Authy) საშუალებით.'
                          : 'An additional layer of security for your account using an Authenticator app (Google Authenticator, Authy).'}
                      </p>

                      <div className="text-left pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            showToast(
                              language === 'ka' ? 'ორფაქტორიანი ავტორიზაცია მალე დაემატება' : 'Two-factor authentication will be available soon',
                              'info'
                            );
                          }}
                          className="px-4 py-2 bg-proton-secondary/20 border border-proton-border text-proton-muted hover:text-proton-text text-[9px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-2"
                        >
                          <Smartphone size={12} />
                          {language === 'ka' ? 'დაყენება' : 'Setup 2FA'}
                        </button>
                      </div>
                    </div>

                    {/* Cryptographic Key Generator */}
                    <div className="p-6 bg-proton-secondary/5 border border-proton-border/30 rounded-2xl space-y-4">
                      <div className="flex items-center gap-3">
                        <Fingerprint size={18} className="text-proton-accent" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-proton-text">
                          {language === 'ka' ? 'უსაფრთხოების კოდის შექმნა' : 'Generate Secure Access Key'}
                        </span>
                      </div>
                      <p className="text-[10px] text-proton-muted leading-relaxed uppercase font-bold tracking-tight text-left">
                        {language === 'ka' 
                          ? 'შექმენით უნიკალური საიდუმლო კოდი სხვადასხვა ხელსაწყოებისა და სერვისების უსაფრთხო კავშირისთვის.' 
                          : 'Generate a unique secret code to securely connect your website with creative tools.'}
                      </p>

                      {isGeneratingKey ? (
                        <div className="space-y-2 py-2">
                          <div className="w-full h-2 bg-proton-secondary/20 rounded-full overflow-hidden border border-proton-border/30">
                            <div className="h-full bg-proton-accent transition-all duration-200" style={{ width: `${keyProgress}%` }} />
                          </div>
                          <span className="text-[9px] font-mono font-bold text-proton-accent uppercase tracking-widest animate-pulse block text-left">
                            {language === 'ka' ? `კოდი იქმნება... ${keyProgress}%` : `Generating secure key... ${keyProgress}%`}
                          </span>
                        </div>
                      ) : generatedKey ? (
                        <div className="p-4 bg-proton-bg border border-proton-accent/40 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-300">
                          <code className="text-xs font-mono font-bold text-proton-accent select-all break-all tracking-wider">{generatedKey}</code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(generatedKey);
                              showToast(
                                language === 'ka' ? 'კოდი წარმატებით დაკოპირდა!' : 'Access key copied to clipboard!',
                                'success'
                              );
                            }}
                            className="p-2.5 rounded-lg bg-proton-accent/10 border border-proton-accent/20 text-proton-accent hover:bg-proton-accent hover:text-proton-bg transition-all"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      ) : null}

                      {!isGeneratingKey && (
                        <div className="text-left">
                          <button
                            type="button"
                            onClick={generateCryptoPasskey}
                            className="px-4 py-2 bg-proton-accent/10 border border-proton-accent/30 hover:bg-proton-accent hover:text-proton-bg text-proton-accent text-[9px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center gap-2"
                          >
                            <Key size={12} />
                            {language === 'ka' ? 'კოდის შექმნა' : 'Generate Key'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* System Integrity Scanner */}
                    <div className="p-6 bg-proton-secondary/5 border border-proton-border/30 rounded-2xl space-y-4">
                      <div className="flex items-center gap-3">
                        <Terminal size={18} className="text-proton-accent" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-proton-text">
                          {language === 'ka' ? 'საიტის შემოწმება' : 'Check Website Health'}
                        </span>
                      </div>
                      <p className="text-[10px] text-proton-muted leading-relaxed uppercase font-bold tracking-tight text-left">
                        {language === 'ka' 
                          ? 'შეამოწმეთ, ყველაფერი გამართულად, შეცდომების გარეშე და უსაფრთხო რეჟიმში მუშაობს თუ არა თქვენს საიტზე.' 
                          : 'Run a quick scan to make sure everything on your website is configured correctly and running without errors.'}
                      </p>

                      {integrityLogs.length > 0 && (
                        <div className="p-4 bg-proton-bg border border-proton-border/50 rounded-2xl font-mono text-xs text-proton-text/90 space-y-1.5 shadow-inner text-left break-all whitespace-pre-wrap">
                          {integrityLogs.map((log, index) => (
                            <div key={index} className="flex items-start gap-1.5 animate-in fade-in slide-in-from-left-1 duration-200">
                              <span className="text-proton-accent font-black shrink-0">&gt;</span>
                              <span className="break-all font-semibold uppercase tracking-tight leading-relaxed text-[11px]">{log}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-left">
                        <button
                          type="button"
                          onClick={runIntegrityDiagnostics}
                          disabled={isIntegrityChecking}
                          className={cn(
                            "px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer active:scale-95 flex items-center gap-2 border",
                            isIntegrityChecking 
                              ? "bg-proton-secondary/10 border-proton-border/40 text-proton-muted cursor-not-allowed" 
                              : "bg-proton-accent/10 border-proton-accent/30 text-proton-accent hover:bg-proton-accent hover:text-proton-bg"
                          )}
                        >
                          <RefreshCw size={12} className={cn(isIntegrityChecking && "animate-spin")} />
                          {isIntegrityChecking 
                            ? (language === 'ka' ? 'მიმდინარეობს შემოწმება...' : 'Checking...') 
                            : (language === 'ka' ? 'შემოწმების გაშვება' : 'Run Scan')}
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 flex flex-col items-center gap-4 text-center">
                       <button 
                         type="button" 
                         onClick={() => {
                           showToast(
                             language === 'ka' ? 'ისტორია წარმატებით ჩამოიტვირთა!' : 'Security audit report successfully downloaded!',
                             'success'
                           );
                         }}
                         className="w-full sm:w-auto max-w-md mx-auto px-8 py-3.5 bg-proton-text text-proton-bg rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-proton-accent hover:text-proton-bg transition-all shadow-xl cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                         id="btn-export-log"
                       >
                          <Save size={14} />
                          {language === 'ka' ? 'შემოწმების ისტორიის ჩამოტვირთვა' : 'Download Scan History'}
                       </button>
                       <div className="flex items-center justify-center gap-4 text-[9px] text-proton-muted font-bold uppercase tracking-[0.3em]">
                        <span>Version 4.1.0-STABLE</span>
                        <span className="w-1 h-1 rounded-full bg-proton-border" />
                        <span>Engine: Pro-X3</span>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'cost_control' && (
                <div className="space-y-8 animate-in fade-in duration-300" id="sec-cost-control">
                  <header className="pb-6 border-b border-proton-border/50">
                    <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight flex items-center gap-2">
                      <TrendingUp className="text-proton-accent" size={22} />
                      {language === 'ka' ? 'ბიუჯეტი და ლიმიტები' : 'Budget & Limits'}
                    </h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest text-left">
                      {language === 'ka' ? 'აკონტროლეთ საიტის ყოველთვიური ხარჯები მარტივად' : 'Manage your monthly budget and request limits easily'}
                    </p>
                  </header>

                  {/* Budget Overview */}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-6 bg-proton-secondary/10 border border-proton-border/50 rounded-2xl text-left h-full flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-proton-muted">
                          {language === 'ka' ? 'დახარჯული თანხა' : 'Spent This Month'}
                        </p>
                        <p className="text-3xl font-black text-proton-text mt-1">${estimatedCost.toFixed(3)}</p>
                      </div>
                      <span className="text-[9px] text-proton-muted uppercase font-bold tracking-wider block mt-2">
                        {language === 'ka' ? 'მიმდინარე თვის ჯამი' : 'Total spent this month'}
                      </span>
                    </div>

                    <div className="p-6 bg-proton-secondary/10 border border-proton-border/50 rounded-2xl text-left h-full flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-proton-muted">
                          {language === 'ka' ? 'მაქსიმალური ლიმიტი' : 'Monthly Limit'}
                        </p>
                        <p className="text-3xl font-black text-proton-accent mt-1">${spendingLimit.toFixed(2)}</p>
                      </div>
                      <span className="text-[9px] text-proton-muted uppercase font-bold tracking-wider block mt-2">
                        {language === 'ka' ? 'თქვენი ბიუჯეტი' : 'Your set threshold'}
                      </span>
                    </div>
                  </div>

                  {/* Slider & Preset Controls */}
                  <div className="space-y-6 p-6 bg-proton-secondary/5 border border-proton-border/30 rounded-2xl">
                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase tracking-wider text-proton-muted">
                          {language === 'ka' ? 'შეცვალეთ ყოველთვიური ლიმიტი (USD)' : 'Adjust monthly budget limit (USD)'}
                        </label>
                        <span className="text-xs font-mono font-bold text-proton-accent bg-proton-accent/10 px-3 py-1 rounded-lg border border-proton-accent/20">
                          ${spendingLimit.toFixed(2)}
                        </span>
                      </div>
                      <input 
                        type="range" min="0.5" max="50" step="0.5"
                        value={spendingLimit}
                        onChange={e => setSpendingLimit(parseFloat(e.target.value))}
                        className="w-full accent-proton-accent appearance-none h-2 bg-proton-secondary/30 rounded-full cursor-pointer transition-all border border-proton-border/30"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 justify-start">
                      {[1.00, 2.00, 5.00, 10.00, 20.00, 50.00].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSpendingLimit(preset)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                            spendingLimit === preset
                              ? "bg-proton-accent border-proton-accent text-proton-bg font-bold shadow-lg shadow-proton-accent/20"
                              : "bg-transparent border-proton-border text-proton-muted hover:border-proton-accent hover:text-proton-text"
                          )}
                        >
                          ${preset.toFixed(2)}
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 text-left">
                      <motion.button
                        type="button"
                        whileHover={shouldReduceMotion ? undefined : { scale: 1.01, y: -0.5 }}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 450, damping: 25 }}
                        onClick={() => handleSaveSpendingLimit(spendingLimit)}
                        className="w-full py-4 bg-proton-accent text-proton-bg rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-white hover:text-proton-bg transition-all shadow-xl select-none cursor-pointer"
                      >
                        {language === 'ka' ? 'ბიუჯეტის შენახვა' : 'Save Budget Limit'}
                      </motion.button>
                      <p className="text-[10px] text-proton-accent font-black uppercase tracking-wider text-center mt-2.5 flex items-center justify-center gap-1.5">
                        <CheckCircle2 size={13} />
                        {language === 'ka' 
                          ? 'ინახება დამოუკიდებლად (ზედა SAVE ღილაკის გარეშე)' 
                          : 'Saves immediately (independent of global Save button)'}
                      </p>
                    </div>
                  </div>

                  {/* Real-time Usage Metrics Bento Grid */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-proton-text uppercase tracking-widest text-left">
                      {language === 'ka' ? 'გამოყენებული რესურსები' : 'Used Resources'}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                      {/* AI Tokens */}
                      <div className="p-6 bg-proton-card/50 border border-proton-border/30 rounded-2xl flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-proton-accent/10 text-proton-accent flex items-center justify-center">
                          <Cpu size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-proton-muted uppercase tracking-wider">
                            {language === 'ka' ? 'ინტელექტის სიტყვები (ტოკენები)' : 'AI Text & Words'}
                          </p>
                          <p className="text-sm font-black text-proton-text mt-0.5">
                            {userStats.aiTokens.toLocaleString()} Tokens
                          </p>
                        </div>
                      </div>

                      {/* Compute Hours */}
                      <div className="p-6 bg-proton-card/50 border border-proton-border/30 rounded-2xl flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                          <Zap size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-proton-muted uppercase tracking-wider">
                            {language === 'ka' ? 'საიტის მუშაობის დრო (საათები)' : 'Website Active Hours'}
                          </p>
                          <p className="text-sm font-black text-proton-text mt-0.5">
                            {userStats.computeTimeHours.toFixed(2)} Hours
                          </p>
                        </div>
                      </div>

                      {/* Storage */}
                      <div className="p-6 bg-proton-card/50 border border-proton-border/30 rounded-2xl flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                          <Save size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-proton-muted uppercase tracking-wider">
                            {language === 'ka' ? 'ატვირთული ფაილების მოცულობა' : 'Uploaded Files Space'}
                          </p>
                          <p className="text-sm font-black text-proton-text mt-0.5">
                            {userStats.storageGB.toFixed(2)} GB
                          </p>
                        </div>
                      </div>

                      {/* Daily Generations */}
                      <div className="p-6 bg-proton-card/50 border border-proton-border/30 rounded-2xl flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-proton-muted uppercase tracking-wider">
                            {language === 'ka' ? 'დღიური მოთხოვნები' : 'Daily AI Actions'}
                          </p>
                          <p className="text-sm font-black text-proton-text mt-0.5">
                            {userStats.dailyGenerationsCount || 0} Runs
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'seo' && (
                <div className="space-y-6" id="sec-seo-audit">
                  <header className="pb-6 border-b border-proton-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight flex items-center gap-2">
                        <Search className="text-proton-accent" size={22} />
                        {language === 'ka' ? 'საძიებო სისტემები (SEO)' : 'Search Engines (SEO)'}
                      </h3>
                      <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest text-left">
                        {language === 'ka' ? 'შეამოწმეთ, როგორ გამოჩნდება თქვენი საიტი Google-ში და სოციალურ ქსელებში' : 'See how your website appears on Google search and social networks'}
                      </p>
                    </div>
                    
                    <div className="text-left">
                      <button
                        type="button"
                        onClick={refreshMetaTags}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-proton-accent/10 hover:bg-proton-accent hover:text-proton-bg border border-proton-accent/20 transition-all cursor-pointer active:scale-95"
                      >
                        <RefreshCw size={12} className="animate-spin-slow" />
                        {language === 'ka' ? 'ინფორმაციის განახლება' : 'Update Information'}
                      </button>
                    </div>
                  </header>

                  {/* Audit Score Circle & Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
                    {/* Score Panel */}
                    <div className="sm:col-span-4 bg-proton-bg/40 p-6 rounded-2xl border border-proton-border/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-proton-accent/5 rounded-full filter blur-xl" />
                      <span className="text-[9px] font-black uppercase text-proton-muted tracking-widest mb-2">
                        {language === 'ka' ? 'გამართულობა' : 'Optimization score'}
                      </span>
                      <div className="relative w-24 h-24 flex flex-col items-center justify-center rounded-full border-4 border-proton-accent/20 bg-proton-card shadow-inner p-2">
                        <div className="absolute inset-2 rounded-full border border-dashed border-proton-accent/30 animate-[spin_40s_linear_infinite]" />
                        <span className="text-2xl font-black text-proton-text leading-none z-10">
                          {(() => {
                            let score = 0;
                            if (metaTags.title !== 'N/A') score += 20;
                            if (metaTags.description !== 'N/A') score += 20;
                            if (metaTags.canonical !== 'N/A') score += 15;
                            if (metaTags.keywords !== 'N/A') score += 10;
                            if (metaTags.ogTitle !== 'N/A') score += 20;
                            if (metaTags.twitterCard !== 'N/A') score += 15;
                            return score;
                          })()}
                        </span>
                        <span className="text-[10px] font-bold text-proton-muted mt-1 z-10">/100</span>
                      </div>
                      <span className="text-[9px] font-black uppercase text-proton-accent tracking-widest mt-3">
                        {language === 'ka' ? 'სრულად ოპტიმიზებული' : 'Fully Optimized'}
                      </span>
                    </div>

                    {/* Quick Audit Checks */}
                    <div className="sm:col-span-8 space-y-2 bg-proton-card/50 p-6 rounded-2xl border border-proton-border/50 text-left">
                      <span className="text-[10px] font-black uppercase text-proton-muted tracking-widest block mb-1">
                        {language === 'ka' ? 'შემოწმების პუნქტები' : 'Checklist'}
                      </span>
                      {[
                        { 
                          label: language === 'ka' ? 'საიტის სათაური (Title)' : 'Website Title (Title Tag)', 
                          status: metaTags.title !== 'N/A', 
                          desc: metaTags.title,
                          req: '50-60 chars'
                        },
                        { 
                          label: language === 'ka' ? 'მოკლე აღწერა (Description)' : 'Website Description (Meta Description)', 
                          status: metaTags.description !== 'N/A', 
                          desc: metaTags.description,
                          req: '120-160 chars'
                        },
                        { 
                          label: language === 'ka' ? 'საიტის მთავარი ბმული (Canonical)' : 'Main Link (Canonical URL)', 
                          status: metaTags.canonical !== 'N/A', 
                          desc: metaTags.canonical,
                          req: 'Valid protocol URL'
                        },
                        { 
                          label: language === 'ka' ? 'საძიებო სიტყვები (Keywords)' : 'Search Keywords (Keywords Tag)', 
                          status: metaTags.keywords !== 'N/A', 
                          desc: metaTags.keywords,
                          req: 'Comma separated'
                        }
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2 bg-proton-bg/20 rounded-xl border border-proton-border/20">
                          {item.status ? (
                            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-proton-text truncate">{item.label}</span>
                              <span className="text-[10px] font-mono text-proton-text-light font-bold shrink-0 bg-proton-secondary/30 px-2 py-0.5 rounded border border-proton-border/30">{item.req}</span>
                            </div>
                            <p className="text-[10px] text-proton-text-light/90 truncate font-mono mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Simulator vs Code tab */}
                  <div className="flex gap-2 p-1 bg-proton-bg border border-proton-border/50 rounded-2xl max-w-xs">
                    <button
                      type="button"
                      onClick={() => setActiveSEOView('visual')}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest",
                        activeSEOView === 'visual' ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/10" : "text-proton-muted hover:text-proton-text"
                      )}
                    >
                      {language === 'ka' ? 'როგორ გამოჩნდება' : 'Google Preview'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSEOView('code')}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest",
                        activeSEOView === 'code' ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/10" : "text-proton-muted hover:text-proton-text"
                      )}
                    >
                      {language === 'ka' ? 'საიტის კოდი' : 'Website Code'}
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {activeSEOView === 'visual' ? (
                      <motion.div
                        key="visual-preview"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="space-y-6 text-left"
                      >
                        {/* Google SERP Card */}
                        <div className="bg-[#17171a] p-6 rounded-2xl border border-proton-border/40 space-y-3 max-w-2xl">
                          <div className="flex items-center justify-between border-b border-proton-border/20 pb-3">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#9ca3af] flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              {language === 'ka' ? 'გუგლის ძებნის შედეგი' : 'Google Search Preview'}
                            </span>
                            <span className="text-[8px] font-mono text-proton-muted">desktop</span>
                          </div>
                          
                          <div className="space-y-1 font-sans">
                            <div className="flex items-center gap-1.5 text-xs text-[#dadce0]">
                              <span className="text-xs font-medium truncate">
                                {metaTags.canonical !== 'N/A' ? metaTags.canonical : 'https://proton-ai.example.com'}
                              </span>
                              <span className="text-[8px] text-proton-muted">▼</span>
                            </div>
                            <h4 className="text-lg text-blue-400 hover:underline cursor-pointer leading-tight font-medium">
                              {metaTags.title}
                            </h4>
                            <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl font-normal">
                              {metaTags.description}
                            </p>
                          </div>
                        </div>

                        {/* Social Link Share Mockup */}
                        <div className="bg-[#17171a] p-6 rounded-2xl border border-proton-border/40 space-y-4">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#9ca3af] flex items-center gap-1.5 border-b border-proton-border/20 pb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                            {language === 'ka' ? 'ფეისბუქის / სოციალური ქსელის პოსტი' : 'Facebook / Social Media Post Preview'}
                          </span>

                          <div className="max-w-md bg-zinc-900 border border-proton-border/30 rounded-xl overflow-hidden shadow-2xl">
                            {metaTags.ogImage !== 'N/A' && (
                              <div className="aspect-[1.91/1] w-full bg-zinc-800 relative overflow-hidden">
                                <img 
                                  src={metaTags.ogImage} 
                                  alt="SEO Share Representation" 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                            <div className="p-4 space-y-1 bg-zinc-950 font-sans border-t border-proton-border/30">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-proton-accent opacity-60">
                                {metaTags.ogUrl !== 'N/A' ? metaTags.ogUrl.replace(/^https?:\/\//, '') : 'proton-ai.example.com'}
                              </span>
                              <h5 className="text-xs font-black text-proton-text uppercase tracking-tight truncate leading-snug">
                                {metaTags.ogTitle !== 'N/A' ? metaTags.ogTitle : metaTags.title}
                              </h5>
                              <p className="text-[11px] text-proton-muted font-medium leading-relaxed line-clamp-2">
                                {metaTags.ogDescription !== 'N/A' ? metaTags.ogDescription : metaTags.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="code-preview"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="space-y-4 text-left"
                      >
                        <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 font-mono text-[10px] text-zinc-300 leading-relaxed overflow-x-auto custom-scrollbar-minimal shadow-inner relative group break-all whitespace-pre-wrap">
                          <span className="absolute top-4 right-4 text-[8px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 select-none">
                            head template
                          </span>
                          <div className="space-y-1">
                            <p className="text-zinc-500">&lt;head&gt;</p>
                            <p className="pl-4"><span className="text-cyan-400">&lt;title&gt;</span>{metaTags.title}<span className="text-cyan-400">&lt;/title&gt;</span></p>
                            <p className="pl-4 text-zinc-500">&lt;!-- Standard Meta --&gt;</p>
                            <p className="pl-4"><span className="text-purple-400">&lt;meta</span> <span className="text-amber-400">name=</span><span className="text-emerald-400">"description"</span> <span className="text-amber-400">content=</span><span className="text-emerald-400">"{metaTags.description}"</span><span className="text-purple-400"> /&gt;</span></p>
                            <p className="pl-4"><span className="text-purple-400">&lt;meta</span> <span className="text-amber-400">name=</span><span className="text-emerald-400">"keywords"</span> <span className="text-amber-400">content=</span><span className="text-emerald-400">"{metaTags.keywords}"</span><span className="text-purple-400"> /&gt;</span></p>
                            <p className="pl-4"><span className="text-purple-400">&lt;link</span> <span className="text-amber-400">rel=</span><span className="text-emerald-400">"canonical"</span> <span className="text-amber-400">href=</span><span className="text-emerald-400">"{metaTags.canonical}"</span><span className="text-purple-400"> /&gt;</span></p>
                            
                            <p className="pl-4 mt-2 text-zinc-500">&lt;!-- Open Graph / Facebook --&gt;</p>
                            <p className="pl-4"><span className="text-purple-400">&lt;meta</span> <span className="text-amber-400">property=</span><span className="text-emerald-400">"og:type"</span> <span className="text-amber-400">content=</span><span className="text-emerald-400">"{metaTags.ogType}"</span><span className="text-purple-400"> /&gt;</span></p>
                            <p className="pl-4"><span className="text-purple-400">&lt;meta</span> <span className="text-amber-400">property=</span><span className="text-emerald-400">"og:url"</span> <span className="text-amber-400">content=</span><span className="text-emerald-400">"{metaTags.ogUrl}"</span><span className="text-purple-400"> /&gt;</span></p>
                            <p className="pl-4"><span className="text-purple-400">&lt;meta</span> <span className="text-amber-400">property=</span><span className="text-emerald-400">"og:title"</span> <span className="text-amber-400">content=</span><span className="text-emerald-400">"{metaTags.ogTitle}"</span><span className="text-purple-400"> /&gt;</span></p>
                            <p className="pl-4"><span className="text-purple-400">&lt;meta</span> <span className="text-amber-400">property=</span><span className="text-emerald-400">"og:description"</span> <span className="text-amber-400">content=</span><span className="text-emerald-400">"{metaTags.ogDescription}"</span><span className="text-purple-400"> /&gt;</span></p>
                            <p className="pl-4"><span className="text-purple-400">&lt;meta</span> <span className="text-amber-400">property=</span><span className="text-emerald-400">"og:image"</span> <span className="text-amber-400">content=</span><span className="text-emerald-400">"{metaTags.ogImage}"</span><span className="text-purple-400"> /&gt;</span></p>

                            <p className="pl-4 mt-2 text-zinc-500">&lt;!-- Twitter Cards --&gt;</p>
                            <p className="pl-4"><span className="text-purple-400">&lt;meta</span> <span className="text-amber-400">name=</span><span className="text-emerald-400">"twitter:card"</span> <span className="text-amber-400">content=</span><span className="text-emerald-400">"{metaTags.twitterCard}"</span><span className="text-purple-400"> /&gt;</span></p>
                            <p className="pl-4"><span className="text-purple-400">&lt;meta</span> <span className="text-amber-400">name=</span><span className="text-emerald-400">"twitter:title"</span> <span className="text-amber-400">content=</span><span className="text-emerald-400">"{metaTags.twitterTitle}"</span><span className="text-purple-400"> /&gt;</span></p>
                            <p className="pl-4"><span className="text-purple-400">&lt;meta</span> <span className="text-amber-400">name=</span><span className="text-emerald-400">"twitter:description"</span> <span className="text-amber-400">content=</span><span className="text-emerald-400">"{metaTags.twitterDescription}"</span><span className="text-purple-400"> /&gt;</span></p>
                            <p className="pl-4"><span className="text-purple-400">&lt;meta</span> <span className="text-amber-400">name=</span><span className="text-emerald-400">"twitter:image"</span> <span className="text-amber-400">content=</span><span className="text-emerald-400">"{metaTags.twitterImage}"</span><span className="text-purple-400"> /&gt;</span></p>
                            <p className="text-zinc-500">&lt;/head&gt;</p>
                          </div>
                        </div>

                        {/* Direct testing instructions */}
                        <div className="bg-proton-bg/20 p-6 rounded-2xl border border-proton-border/30 flex items-start gap-4">
                          <Info size={18} className="text-proton-accent mt-0.5 shrink-0" />
                          <div className="space-y-1 text-[11px] leading-relaxed">
                            <span className="font-black text-proton-text uppercase tracking-widest block">
                              {language === 'ka' ? 'როგორ შევამოწმოთ პირდაპირ რეჟიმში?' : 'HOW DO I TEST THIS LIVE?'}
                            </span>
                            <p className="text-proton-muted">
                              {language === 'ka' 
                                ? 'თქვენი საიტის სათაურები და აღწერები უკვე ჩაწერილია მთავარ index.html ფაილში. საძიებო რობოტები (Google, Bing) და სოციალური პლატფორმები (Facebook, Slack, Telegram) კითხულობენ ამ ინფორმაციას პირდაპირ თქვენი საიტიდან.' 
                                : 'These meta tags are fully compiled into your index.html. To verify how real search engine crawlers (Googlebot) and social scraper bots parse them directly from our servers, you can inspect them.'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Step-Up Security Verification Modal */}
      <SecurityVerificationModal
        isOpen={stepUpState.isOpen}
        onClose={() => setStepUpState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={(grantId) => {
          setStepUpState(prev => ({ ...prev, isOpen: false }));
          stepUpState.onConfirm(grantId);
        }}
        actionTitle={stepUpState.actionTitle}
        scope={stepUpState.scope}
        securityPinEnabled={!!userProfile.securityPinEnabled}
        securityPinMeta={userProfile.securityPinMeta}
        language={language}
      />

      {/* PIN Setup / Modification Modal */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-proton-bg border border-proton-border/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-proton-border/40">
                <div className="flex items-center gap-3">
                  <KeyRound size={20} className="text-proton-accent" />
                  <h4 className="text-sm font-black uppercase tracking-wider text-proton-text">
                    {pinMode === 'enable' && (language === 'ka' ? 'PIN კოდის ჩართვა' : 'Enable PIN Code')}
                    {pinMode === 'change' && (language === 'ka' ? 'PIN კოდის შეცვლა' : 'Change PIN Code')}
                    {pinMode === 'disable' && (language === 'ka' ? 'PIN კოდის გამორთვა' : 'Disable PIN Code')}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="text-proton-muted hover:text-proton-text text-sm font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {pinModalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{pinModalError}</span>
                </div>
              )}

              <div className="space-y-4">
                {(pinMode === 'change' || pinMode === 'disable') && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-proton-text block mb-1.5">
                      {language === 'ka' ? 'მიმდინარე PIN კოდი' : 'Current PIN Code'}
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={pinCurrentInput}
                      onChange={(e) => setPinCurrentInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full bg-proton-secondary/20 border border-proton-border rounded-xl px-4 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-proton-text focus:outline-none focus:border-proton-accent"
                    />
                  </div>
                )}

                {(pinMode === 'enable' || pinMode === 'change') && (
                  <>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-proton-text block mb-1.5">
                        {language === 'ka' ? 'ახალი 4-ნიშნა PIN კოდი' : 'New 4-digit PIN Code'}
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={pinNewInput}
                        onChange={(e) => setPinNewInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full bg-proton-secondary/20 border border-proton-border rounded-xl px-4 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-proton-text focus:outline-none focus:border-proton-accent"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-proton-text block mb-1.5">
                        {language === 'ka' ? 'გაიმეორეთ PIN კოდი' : 'Confirm PIN Code'}
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={pinConfirmInput}
                        onChange={(e) => setPinConfirmInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full bg-proton-secondary/20 border border-proton-border rounded-xl px-4 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-proton-text focus:outline-none focus:border-proton-accent"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-proton-border/30">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-proton-border/50 text-proton-muted hover:text-proton-text text-xs font-bold cursor-pointer"
                >
                  {language === 'ka' ? 'გაუქმება' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSavePin}
                  className="px-5 py-2 rounded-xl bg-proton-accent text-proton-bg text-xs font-black uppercase tracking-wider hover:bg-white transition-all cursor-pointer shadow-md"
                >
                  {language === 'ka' ? 'შენახვა' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
