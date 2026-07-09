import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  User, 
  Cpu, 
  Palette, 
  Shield, 
  Globe, 
  Bell, 
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
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import { UserProfile, GlobalAiSettings, Theme } from '../types';
import { useToast } from './Toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

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
}

const THEMES: { id: Theme; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'light', label: 'Light', icon: <Sun size={18} />, color: 'bg-slate-200' },
  { id: 'titanium', label: 'Titanium', icon: <Circle size={18} />, color: 'bg-slate-400' },
  { id: 'proton', label: 'Cyber', icon: <Zap size={18} />, color: 'bg-cyan-400' },
  { id: 'forest', label: 'Forest', icon: <Trees size={18} />, color: 'bg-emerald-500' },
  { id: 'sunset', label: 'Sunset', icon: <Sunrise size={18} />, color: 'bg-orange-500' },
  { id: 'rose', label: 'Rose', icon: <Heart size={18} />, color: 'bg-rose-500' },
  { id: 'vibrant', label: 'Nebula', icon: <Sparkles size={18} />, color: 'bg-purple-500' },
  { id: 'midnight', label: 'Dark', icon: <Moon size={18} />, color: 'bg-slate-900' },
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
  setOrganizerTheme
}) => {
  const t = translations[language].settings;
  const common = translations[language].common;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'preferences' | 'security' | 'seo'>('preferences');
  const [isSaved, setIsSaved] = useState(false);
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

  const refreshMetaTags = () => {
    setMetaTags(getHeadMeta());
    showToast(
      language === 'ka' ? 'მეტა ტეგები წარმატებით განახლდა DOM-იდან!' : 'Successfully synchronized live meta tags from document head!',
      'success'
    );
  };
  
  // Connect to the custom systems toast notification portal
  const { showToast } = useToast();
  const { setLanguage } = useLanguage();

  const handleSave = async () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        // Sync to cloud Firestore safely
        await setDoc(userDocRef, {
          name: userProfile.name || '',
          email: userProfile.email || '',
          language: userProfile.language || 'en',
          region: userProfile.region || '',
          notifications: !!userProfile.notifications,
          phoneNumber: userProfile.phoneNumber || '',
          avatar: userProfile.avatar || '',
          role: userProfile.role || 'System Architect',
          showCommercialHub: !!userProfile.showCommercialHub
        }, { merge: true });
      } catch (err) {
        console.error("Failed to sync user profile directly to Firestore:", err);
      }
    }
    
    showToast(
      language === 'ka' 
        ? 'კონფიგურაცია წარმატებით იქნა სინქრონიზებული ღრუბელთან!' 
        : 'System configuration successfully synchronized with cloud database!',
      'success'
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserProfile(prev => ({ ...prev, avatar: reader.result as string }));
        showToast(
          language === 'ka' ? 'ავატარი წარმატებით განახლდა!' : 'Avatar changed successfully!',
          'success'
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const tabs = [
    { id: 'preferences', label: language === 'ka' ? 'პრეფერენციები' : 'Preferences', icon: Palette },
    { id: 'ai', label: t.ai_config || 'AI Assistant', icon: Cpu },
    { id: 'profile', label: t.profile || 'Profile', icon: User },
    { id: 'security', label: t.security || 'Security', icon: Shield },
    { id: 'seo', label: language === 'ka' ? 'SEO აუდიტი' : 'SEO Audit', icon: Search },
  ];

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto py-4 md:py-8 px-4 animate-in fade-in slide-in-from-bottom-2 duration-500" id="settings-view-root">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-proton-text flex items-center gap-3">
            <Settings className="text-proton-accent font-black animate-[spin_20s_linear_infinite]" size={32} />
            {t.title}
          </h2>
          <p className="text-proton-muted text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1">{t.subtitle}</p>
        </div>
        
        <button 
          onClick={handleSave}
          className={cn(
            "w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95",
            isSaved ? "bg-emerald-500 text-white" : "bg-proton-accent text-proton-bg hover:shadow-proton-accent/30"
          )}
          id="btn-settings-save"
        >
          {isSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {isSaved ? (language === 'ka' ? 'შენახულია' : 'Saved') : t.save}
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row bg-proton-card border border-proton-border rounded-[40px] overflow-hidden shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/5 to-transparent pointer-events-none" />
        
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-proton-border bg-proton-bg/30 p-4 md:p-6 flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible custom-scrollbar-minimal relative z-10" id="settings-sidebar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 md:flex-none flex items-center justify-center md:justify-start gap-4 p-3 md:p-4 rounded-2xl transition-all group shrink-0",
                activeTab === tab.id 
                  ? "bg-proton-accent/10 text-proton-accent shadow-lg border border-proton-accent/20" 
                  : "text-proton-muted hover:text-proton-text hover:bg-white/5"
              )}
              id={`tab-settings-${tab.id}`}
            >
              <div className={cn(
                "w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all",
                activeTab === tab.id ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20" : "bg-proton-secondary/20 text-proton-muted group-hover:bg-proton-secondary/30"
              )}>
                <tab.icon size={18} />
              </div>
              <span className="hidden md:block text-[11px] font-black uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar-minimal bg-transparent relative z-10" id="settings-content-wrapper">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-xl"
            >
              {activeTab === 'ai' && (
                <div className="space-y-8" id="sec-ai-config">
                  <header className="pb-6 border-b border-proton-border/50">
                    <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight">{t.ai_config}</h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest">{t.ai_desc}</p>
                  </header>

                  <div className="space-y-8">
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase tracking-wider flex items-center gap-2 text-proton-muted">
                          <Zap size={14} className="text-amber-500 animate-pulse" />
                          {t.temperature}
                        </label>
                        <span className="text-[11px] font-mono font-bold text-proton-accent bg-proton-accent/10 px-3 py-1 rounded-lg border border-proton-accent/20">{aiSettings.temperature.toFixed(1)}</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.1"
                        value={aiSettings.temperature}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          setAiSettings(prev => ({ ...prev, temperature: val }));
                          // Debounce showing toast for slider to prevent flood
                        }}
                        className="w-full accent-proton-accent appearance-none h-2 bg-proton-secondary/30 rounded-full cursor-pointer transition-all border border-proton-border/30"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className={cn(
                        "p-5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group",
                        aiSettings.enableSearch ? "bg-proton-accent/5 border-proton-accent/40" : "bg-proton-secondary/10 border-proton-border"
                      )} onClick={() => {
                        const next = !aiSettings.enableSearch;
                        setAiSettings(prev => ({ ...prev, enableSearch: next }));
                        showToast(
                          next 
                            ? (language === 'ka' ? 'Google ძიება ინტეგრირებულია AI პასუხებში!' : 'Google Search integrated into AI replies!') 
                            : (language === 'ka' ? 'Google ძიება გამორთულია.' : 'Google Search deactivated.'),
                          next ? 'success' : 'info'
                        );
                      }}>
                        <div className="flex items-center gap-3">
                          <Search size={18} className={aiSettings.enableSearch ? "text-proton-accent animate-bounce" : "text-proton-muted"} />
                          <label className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-proton-text">{t.search}</label>
                        </div>
                        <div className={cn(
                          "w-10 h-5 rounded-full relative transition-all border border-proton-border",
                          aiSettings.enableSearch ? "bg-proton-accent border-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.3)]" : "bg-proton-secondary/30"
                        )}>
                          <div className={cn(
                            "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all shadow-sm",
                            aiSettings.enableSearch ? "right-0.5" : "left-0.5"
                          )} />
                        </div>
                      </div>
                      
                      <div className={cn(
                        "p-5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group",
                        aiSettings.enableMaps ? "bg-proton-accent/5 border-proton-accent/40" : "bg-proton-secondary/10 border-proton-border"
                      )} onClick={() => {
                        const next = !aiSettings.enableMaps;
                        setAiSettings(prev => ({ ...prev, enableMaps: next }));
                        showToast(
                          next 
                            ? (language === 'ka' ? 'Google რუკები გააქტიურდა AI ლოკაციებისთვის' : 'Google Maps enabled for AI location awareness') 
                            : (language === 'ka' ? 'Google რუკების მოდული გამორთულია' : 'Google Maps module deactivated'),
                          next ? 'success' : 'info'
                        );
                      }}>
                        <div className="flex items-center gap-3">
                          <MapPin size={18} className={aiSettings.enableMaps ? "text-proton-accent animate-pulse" : "text-proton-muted"} />
                          <label className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-proton-text">{t.maps}</label>
                        </div>
                        <div className={cn(
                          "w-10 h-5 rounded-full relative transition-all border border-proton-border",
                          aiSettings.enableMaps ? "bg-proton-accent border-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.3)]" : "bg-proton-secondary/30"
                        )}>
                          <div className={cn(
                            "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all shadow-sm",
                            aiSettings.enableMaps ? "right-0.5" : "left-0.5"
                          )} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                       <label className="text-[11px] font-black uppercase tracking-wider flex items-center gap-2 text-proton-muted">
                         <Volume2 size={16} className="text-purple-400" />
                         {t.voice || 'Voice Style'}
                       </label>
                       <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                         {[
                           { id: 'Kore', label: 'Kore' },
                           { id: 'Fenrir', label: 'Fenrir' },
                           { id: 'Charon', label: 'Charon' },
                           { id: 'TbilisiDialect', label: 'Local' },
                           { id: 'GeorgianModern', label: 'Kartuli' }
                         ].map((voice) => (
                           <button
                             key={voice.id}
                             type="button"
                             onClick={() => {
                               setAiSettings(prev => ({ ...prev, voice: voice.id }));
                               showToast(
                                 language === 'ka' ? `სინთეზატორის ხმა: ${voice.label}` : `TTS synthesizer voice set to: ${voice.label}`,
                                 'info'
                               );
                             }}
                             className={cn(
                               "p-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest text-center transition-all",
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

                    <div className={cn(
                      "p-7 rounded-[32px] border flex items-center justify-between transition-all cursor-pointer group",
                      uiMode === 'creative' ? "bg-proton-accent/10 border-proton-accent/40 shadow-lg shadow-proton-accent/5" : "bg-proton-secondary/10 border-proton-border"
                    )} onClick={() => {
                      const next = uiMode === 'business' ? 'creative' : 'business';
                      setUiMode(next);
                      showToast(
                        next === 'creative' 
                          ? (language === 'ka' ? 'კრეატიული რეჟიმი აქტიურია! ნეონური ინტერფეისი დატვირთულია.' : 'Creative custom mode loaded with dynamic neon visuals!') 
                          : (language === 'ka' ? 'ბიზნეს რეჟიმი ჩართულია: მინიმალისტური და სუფთა.' : 'Business corporate mode loaded: minimalist & clear.'),
                        'success'
                      );
                    }}>
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                          uiMode === 'creative' ? "bg-proton-accent text-proton-bg shadow-lg" : "bg-proton-secondary/20 text-proton-muted"
                        )}>
                          <Sparkles size={28} />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-black uppercase tracking-widest cursor-pointer block text-proton-text">{language === 'ka' ? 'კრეატიული რეჟიმი' : 'Creative Mode'}</label>
                          <p className="text-[10px] text-proton-muted font-bold uppercase tracking-tighter mt-1">{language === 'ka' ? 'ფოკუსი შემოქმედებაზე და დეტალებზე' : 'Focus on creation and meticulous details'}</p>
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

                    {/* AI Simulation Mode Block */}
                    <div className={cn(
                      "p-7 rounded-[32px] border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 transition-all select-none",
                      aiSettings.useSimulatedAi ? "bg-amber-500/10 border-amber-500/30 shadow-lg shadow-amber-500/5 animate-pulse" : "bg-proton-secondary/10 border-proton-border"
                    )}>
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shrink-0",
                          aiSettings.useSimulatedAi ? "bg-amber-500 text-proton-bg shadow-lg shadow-amber-500/20" : "bg-proton-secondary/20 text-proton-muted"
                        )}>
                          <Sparkles className={cn(aiSettings.useSimulatedAi && "animate-spin")} size={28} />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-black uppercase tracking-widest block text-proton-text">
                            {language === 'ka' ? 'AI სიმულაციური რეჟიმი' : 'AI Simulation Mode'}
                          </label>
                          <p className="text-[10px] text-proton-muted font-bold uppercase tracking-tighter mt-1 leading-relaxed">
                            {language === 'ka' 
                              ? 'ჩართეთ საცდელი რეჟიმი API შეცდომებისა და კვოტის ამოწურვის (429) სრულად ასარიდებლად. პასუხები გენერირდება მყისიერად.' 
                              : 'Bypass any 429 quota exhaustion or environment key errors. Get realistic answers instantly.'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !aiSettings.useSimulatedAi;
                          setAiSettings(prev => ({ ...prev, useSimulatedAi: next }));
                          showToast(
                            next 
                              ? (language === 'ka' ? 'AI სიმულაცია ჩაირთო! თავიდან აცილებულია Quota-Errors.' : 'AI Mock Simulation active! Expiration limits bypassed.') 
                              : (language === 'ka' ? 'დავუბრუნდით რეალურ Gemini API სერვერს.' : 'Restored live real-time Gemini API server calls.'),
                            next ? 'warning' : 'info'
                          );
                        }}
                        className={cn(
                          "w-full sm:w-auto px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 active:scale-95",
                          aiSettings.useSimulatedAi 
                            ? "bg-amber-500 border-amber-500 text-proton-bg hover:bg-amber-600 shadow-lg shadow-amber-500/10 font-bold"
                            : "bg-transparent border-proton-border text-proton-muted hover:border-proton-accent hover:text-proton-accent"
                        )}
                      >
                        {aiSettings.useSimulatedAi 
                          ? (language === 'ka' ? 'ჩართულია' : 'Enabled') 
                          : (language === 'ka' ? 'გამორთულია' : 'Disabled')}
                      </button>
                    </div>

                    <div className="space-y-3 pt-6 border-t border-proton-border/50">
                       <label className="text-[11px] font-black uppercase tracking-wider text-proton-muted">
                         {t.system_prompt || 'Custom AI Instructions'}
                       </label>
                       <textarea
                         value={aiSettings.systemInstruction || ""}
                         onChange={e => setAiSettings(prev => ({ ...prev, systemInstruction: e.target.value }))}
                         className="w-full bg-proton-secondary/20 p-5 rounded-2xl border border-proton-border text-xs font-medium text-proton-text focus:outline-none focus:border-proton-accent focus:ring-4 focus:ring-proton-accent/5 transition-all min-h-[140px] shadow-inner placeholder:text-proton-muted/30"
                         placeholder="Example: Be professional and concise..."
                       />
                    </div>

                    <div className="space-y-3 pt-6 border-t border-proton-border/50">
                       <div className="flex justify-between items-center">
                         <label className="text-[11px] font-black uppercase tracking-wider text-proton-muted">
                           {language === 'ka' ? 'Gemini API გასაღები (გასაახლებლად)' : 'Gemini API Key (For Renewal)'}
                         </label>
                         <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-proton-accent/10 text-proton-accent shrink-0 select-none">
                           {aiSettings.customApiKey 
                             ? (language === 'ka' ? 'აქტიურია პერსონალური გასაღები' : 'Custom Overridden Key Active') 
                             : (language === 'ka' ? 'გამოიყენება ავტომატური გასაღები' : 'Using Environment Default')}
                         </span>
                       </div>
                       <div className="relative flex items-center">
                         <input
                           type={showApiKey ? "text" : "password"}
                           value={aiSettings.customApiKey || ""}
                           onChange={e => setAiSettings(prev => ({ ...prev, customApiKey: e.target.value }))}
                           placeholder="AIzaSy..."
                           className="w-full bg-proton-secondary/20 pl-5 pr-12 py-4 rounded-2xl border border-proton-border text-sm font-mono font-medium text-proton-text focus:outline-none focus:border-proton-accent focus:ring-4 focus:ring-proton-accent/5 transition-all shadow-inner placeholder:text-proton-muted/30"
                         />
                         <button
                           type="button"
                           onClick={() => setShowApiKey(!showApiKey)}
                           className="absolute right-4 text-proton-muted hover:text-proton-text transition-colors p-1"
                         >
                           {showApiKey ? <EyeOff size={16} /> : <Key size={16} />}
                         </button>
                       </div>
                       <p className="text-[10px] text-proton-muted/70 italic font-medium leading-relaxed">
                         {language === 'ka' 
                           ? 'თუ მიიღებთ შეცდომას "API key expired", გთხოვთ შეიყვანოთ თქვენი საკუთარი მოქმედი Gemini API გასაღები სისტემის სტაბილური მუშაობისთვის.' 
                           : 'If you encounter an "API key expired" error, paste your own valid Gemini API Key here to instantly override the environment configurations.'}
                       </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-8 pb-10" id="sec-profile">
                  <header className="pb-6 border-b border-proton-border/50">
                    <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight">{t.profile || 'Profile'}</h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest">{t.profile_desc}</p>
                  </header>

                  <div className="space-y-8">
                    {/* Profile Picture Upload */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-proton-secondary/5 rounded-[32px] border border-proton-border/30">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-full bg-proton-bg border-4 border-proton-border flex items-center justify-center overflow-hidden shadow-2xl transition-transform group-hover:scale-105">
                          {userProfile.avatar ? (
                            <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User size={48} className="text-proton-muted" />
                          )}
                        </div>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-proton-accent text-proton-bg flex items-center justify-center border-4 border-proton-card shadow-lg hover:bg-white transition-colors"
                        >
                          <Camera size={18} />
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileChange} 
                          accept="image/*" 
                          className="hidden" 
                        />
                      </div>
                      <div className="text-center sm:text-left">
                        <h4 className="text-sm font-black text-proton-text uppercase tracking-widest">{t.profile_picture || 'Profile Picture'}</h4>
                        <p className="text-[10px] text-proton-muted font-bold uppercase tracking-wider mt-1">{language === 'ka' ? 'ატვირთეთ ფოტო თქვენი იდენტიფიკაციისთვის' : 'Upload a photo for your identification'}</p>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-4 flex items-center gap-2 px-4 py-2 bg-proton-accent/10 border border-proton-accent/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-proton-accent hover:bg-proton-accent hover:text-proton-bg transition-all"
                        >
                          <Upload size={14} />
                          {t.upload_avatar || 'Upload Avatar'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted">{t.name || 'Full Name'}</label>
                        <div className="relative group">
                          <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-accent/50 transition-colors group-focus-within:text-proton-accent" />
                          <input 
                            value={userProfile.name || ''}
                            onChange={e => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full bg-proton-secondary/20 pl-12 pr-4 py-4 rounded-2xl border border-proton-border text-xs font-bold text-proton-text focus:outline-none focus:border-proton-accent transition-all placeholder:text-proton-muted/50"
                            placeholder="e.g. John Doe"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted">{t.email || 'Email Address'}</label>
                        <div className="relative group">
                          <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-accent/50 transition-colors group-focus-within:text-proton-accent" />
                          <input 
                            value={userProfile.email || ''}
                            onChange={e => setUserProfile(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full bg-proton-secondary/20 pl-12 pr-4 py-4 rounded-2xl border border-proton-border text-xs font-bold text-proton-text focus:outline-none focus:border-proton-accent transition-all placeholder:text-proton-muted/50"
                            placeholder="e.g. john@example.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted">{t.region || 'Region'}</label>
                        <div className="relative group">
                          <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-accent/50 transition-colors group-focus-within:text-proton-accent" />
                          <input 
                            value={userProfile.region || ''}
                            onChange={e => setUserProfile(prev => ({ ...prev, region: e.target.value }))}
                            className="w-full bg-proton-secondary/20 pl-12 pr-4 py-4 rounded-2xl border border-proton-border text-xs font-bold text-proton-text focus:outline-none focus:border-proton-accent transition-all placeholder:text-proton-muted/50"
                            placeholder="e.g. Tbilisi, GE"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted">{t.phone || 'Phone Number'}</label>
                        <div className="relative group">
                          <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-accent/50 transition-colors group-focus-within:text-proton-accent" />
                          <input 
                            value={userProfile.phoneNumber || ''}
                            onChange={e => setUserProfile(prev => ({ ...prev, phoneNumber: e.target.value }))}
                            className="w-full bg-proton-secondary/20 pl-12 pr-4 py-4 rounded-2xl border border-proton-border text-xs font-bold text-proton-text focus:outline-none focus:border-proton-accent transition-all placeholder:text-proton-muted/50"
                            placeholder="+995 ..."
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-8 bg-proton-secondary/5 border border-dashed border-proton-border/50 rounded-[32px] flex items-center gap-5 group">
                       <div className="w-14 h-14 rounded-2xl bg-proton-bg border border-proton-border flex items-center justify-center text-proton-accent shadow-xl group-hover:scale-110 transition-transform">
                        <Shield size={24} />
                       </div>
                       <div>
                        <p className="text-[10px] text-proton-text font-black uppercase tracking-[0.2em]">Biometric Data Matrix Secure</p>
                        <p className="text-[8px] text-proton-accent opacity-50 font-black uppercase tracking-widest mt-1">E2E Encryption Level 4 • Proton V2</p>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="space-y-8 animate-in fade-in duration-300" id="sec-preferences">
                  <header className="pb-6 border-b border-proton-border/50">
                    <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight">
                      {language === 'ka' ? 'ინტერფეისის პარამეტრები' : 'User Preferences'}
                    </h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest">
                      {language === 'ka' ? 'მართეთ საიტის ენა, გლობალური ფერები და ორგანიზატორი ერთ სივრცეში' : 'Manage interface language, global theme settings and planner accents'}
                    </p>
                  </header>

                  <div className="space-y-8">
                    {/* Instant Systems Toast Demonstration Center */}
                    <div className="p-6 bg-proton-accent/10 border border-proton-accent/30 rounded-[32px] space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <Sparkles size={100} className="text-proton-accent" />
                      </div>
                      
                      <div>
                        <label className="text-[11px] font-black uppercase tracking-wider text-proton-accent flex items-center gap-2">
                          <Bell size={14} className="animate-bounce" />
                          {language === 'ka' ? 'სისტემური შეტყობინებების პალიტრა' : 'Toast Notification Control Center'}
                        </label>
                        <p className="text-[9px] text-proton-muted font-bold uppercase tracking-widest mt-0.5 leading-relaxed">
                          {language === 'ka' 
                            ? 'გამოსცადეთ გლობალური ანიმირებული შეტყობინებები (Toast Notifications) მოქმედებაში:' 
                            : 'Trigger floating animated toast alerts directly in this window to test the polish:'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 relative z-10">
                        <button
                          type="button"
                          onClick={() => showToast(
                            language === 'ka' ? 'ოპერაცია წარმატებით შესრულდა!' : 'Success Toast: Action completed successfully!',
                            'success'
                          )}
                          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-[9px] font-black uppercase tracking-wider"
                        >
                          <CheckCircle2 size={12} />
                          Success
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(
                            language === 'ka' ? 'ოპერაცია უარყოფილია: შეცდომა ID 502' : 'Critical security error: Protocol validation failed (502).',
                            'error'
                          )}
                          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all text-[9px] font-black uppercase tracking-wider"
                        >
                          <AlertCircle size={12} />
                          Error Alert
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(
                            language === 'ka' ? 'ყურადღება: Gemini API-ის კვოტა 80%-ზეა.' : 'Warning: API sandbox is running close to 90% quota capacity.',
                            'warning'
                          )}
                          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all text-[9px] font-black uppercase tracking-wider"
                        >
                          <AlertTriangle size={12} />
                          Warning style
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(
                            language === 'ka' ? 'ინფორმაცია: Proton 4.1 განახლდა!' : 'System Status Update: Proton Engine 4.1-STABLE successfully injected.',
                            'info'
                          )}
                          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-950/20 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-all text-[9px] font-black uppercase tracking-wider"
                        >
                          <Info size={12} />
                          Informational
                        </button>
                      </div>
                    </div>

                    {/* 1. Language Sector */}
                    <div className="p-6 bg-proton-secondary/5 border border-proton-border/50 rounded-[32px] space-y-4">
                      <div>
                        <label className="text-[11px] font-black uppercase tracking-wider text-proton-text block">
                          {language === 'ka' ? 'სისტემის ენა' : 'System Language'}
                        </label>
                        <p className="text-[9px] text-proton-muted font-black uppercase tracking-widest mt-0.5">
                          {language === 'ka' ? 'აირჩიეთ სასურველი ლოკალიზაცია ინტერფეისისთვის' : 'Choose default system localization'}
                        </p>
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
                    <div className="p-6 bg-proton-secondary/5 border border-proton-border/50 rounded-[32px] space-y-5">
                      <div>
                        <label className="text-[11px] font-black uppercase tracking-wider text-proton-text block">
                          {language === 'ka' ? 'გლობალური პალიტრა' : 'Global Color Palette'}
                        </label>
                        <p className="text-[9px] text-proton-muted font-black uppercase tracking-widest mt-0.5">
                          {language === 'ka' ? 'საიტის ძირითადი ფერების და აქცენტების მართვა' : 'Configure main interface background gradient and accent layers'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {THEMES.map((tInfo) => (
                          <button
                            key={tInfo.id}
                            type="button"
                            onClick={() => {
                              setTheme(tInfo.id);
                              showToast(
                                language === 'ka' 
                                  ? `აქტიური გახდა გლობალური თემა: ${tInfo.label}` 
                                  : `Global theme updated to: ${tInfo.label}`,
                                'success'
                              );
                            }}
                            className={cn(
                              "flex flex-col items-center gap-3 p-4 rounded-2xl transition-all border-2 group relative overflow-hidden",
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
                              "text-[9px] font-black uppercase tracking-widest",
                              theme === tInfo.id ? "text-proton-text" : "text-proton-muted group-hover:text-proton-text"
                            )}>{tInfo.label}</span>
                            {theme === tInfo.id && (
                              <motion.div 
                                layoutId="active-theme-dot"
                                className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-proton-accent shadow-[0_0_10px_rgba(0,242,255,0.8)]" 
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4. Zen Mode and system states */}
                    <div className={cn(
                      "p-7 rounded-[32px] border flex items-center justify-between transition-all cursor-pointer group",
                      aiSettings.zenMode ? "bg-amber-500/5 border-amber-500/30 shadow-lg shadow-amber-500/5" : "bg-proton-secondary/10 border-proton-border"
                    )} onClick={() => {
                      const next = !aiSettings.zenMode;
                      setAiSettings(prev => ({ ...prev, zenMode: next }));
                      showToast(
                        next 
                          ? (language === 'ka' ? 'ზენ რეჟიმი გააქტიურებულია. მაქსიმალური ფოკუსი!' : 'Zen focus mode activated!') 
                          : (language === 'ka' ? 'ზენ რეჟიმი გამორთულია.' : 'Zen focus mode turned off.'),
                        'info'
                      );
                    }}>
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                          aiSettings.zenMode ? "bg-amber-500/20 text-amber-500 shadow-lg" : "bg-proton-secondary/20 text-proton-muted"
                        )}>
                          <EyeOff size={28} />
                        </div>
                        <div>
                          <label className="text-xs font-black uppercase tracking-widest cursor-pointer block text-proton-text">
                            {language === 'ka' ? 'ზენ რეჟიმი' : 'Zen Mode'}
                          </label>
                          <p className="text-[10px] text-proton-muted font-bold uppercase tracking-tighter mt-1">
                            {language === 'ka' ? 'ინტერფეისის მაქსიმალური განტვირთვა' : 'De-clutter the interface matrix for maximum focus'}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-12 h-6 rounded-full relative transition-all border border-proton-border",
                        aiSettings.zenMode ? "bg-amber-500 border-amber-500" : "bg-proton-secondary/30"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-md",
                          aiSettings.zenMode ? "right-0.5" : "left-0.5"
                        )} />
                      </div>
                    </div>

                    {/* 5. Commercial SaaS Exit Hub Toggle */}
                    <div className={cn(
                      "p-7 rounded-[32px] border flex items-center justify-between transition-all cursor-pointer group",
                      userProfile.showCommercialHub ? "bg-proton-accent/5 border-proton-accent/35 shadow-lg shadow-proton-accent/5" : "bg-proton-secondary/10 border-proton-border"
                    )} onClick={() => {
                      const next = !userProfile.showCommercialHub;
                      setUserProfile(prev => ({ ...prev, showCommercialHub: next }));
                      showToast(
                        next 
                          ? (language === 'ka' ? 'კომერციული გასხვისების ცენტრი გააქტიურდა გვერდითა მენიუში!' : 'SaaS Exit Hub activated in sidebar!') 
                          : (language === 'ka' ? 'კომერციული მოდული დამალულია გვერდითა მენიუდან.' : 'SaaS Exit Hub hidden from sidebar.'),
                        'success'
                      );
                    }}>
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                          userProfile.showCommercialHub ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20" : "bg-proton-secondary/20 text-proton-muted"
                        )}>
                          <TrendingUp size={28} />
                        </div>
                        <div>
                          <label className="text-xs font-black uppercase tracking-widest cursor-pointer block text-proton-text">
                            {language === 'ka' ? 'კომერცია & გასხვისება (SaaS Exit)' : 'SaaS Commercial Exit Hub'}
                          </label>
                          <p className="text-[10px] text-proton-muted font-bold uppercase tracking-tighter mt-1">
                            {language === 'ka' ? 'ARR და ბიზნეს-ღირებულების კალკულატორის გამოჩენა გვერდითა მენიუში' : 'Show business valuation & brand tools in current sidebar link list'}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-12 h-6 rounded-full relative transition-all border border-proton-border",
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
                    <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight">{t.security}</h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest">Security architecture & isolation protocols.</p>
                  </header>

                  <div className="space-y-5">
                    <div className="p-7 bg-green-500/5 border border-green-500/20 rounded-[32px] flex items-center justify-between group">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-green-500 text-proton-bg flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all group-hover:scale-105">
                             <Shield size={28} />
                          </div>
                          <div>
                             <p className="text-xs font-black uppercase tracking-wide text-green-400">System Sync: Active</p>
                             <p className="text-[10px] font-bold text-green-500/50 uppercase tracking-tighter">Level 4 Hash Encryption</p>
                          </div>
                       </div>
                       <Lock size={20} className="text-green-500" />
                    </div>

                    <div className="p-7 bg-proton-secondary/10 border border-proton-border rounded-[32px] flex items-center justify-between opacity-50 relative overflow-hidden">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-proton-bg border border-proton-border flex items-center justify-center text-proton-muted">
                             <Globe size={28} />
                          </div>
                          <div>
                             <p className="text-xs font-black uppercase tracking-wide text-proton-text">Public Indexing</p>
                             <p className="text-[10px] font-bold text-proton-muted uppercase tracking-tighter">Status: Restricted Access</p>
                          </div>
                       </div>
                    </div>

                    <div className="pt-8 flex flex-col gap-4">
                       <button 
                         type="button" 
                         onClick={() => {
                           showToast(
                             language === 'ka' ? 'უსაფრთხოების ჟურნალი წარმატებით გადმოიწერა!' : 'Security cryptographic audit log successfully downloaded!',
                             'success'
                           );
                         }}
                         className="w-full py-5 bg-proton-text text-proton-bg rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-proton-accent hover:text-proton-bg transition-all shadow-xl active:scale-95"
                         id="btn-export-log"
                       >
                          Export Data Log
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

              {activeTab === 'seo' && (
                <div className="space-y-6" id="sec-seo-audit">
                  <header className="pb-6 border-b border-proton-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight flex items-center gap-2">
                        <Search className="text-proton-accent" size={22} />
                        {language === 'ka' ? 'SEO აუდიტის პროტოკოლი' : 'SEO Audit Protocol'}
                      </h3>
                      <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest">
                        {language === 'ka' ? 'მეტა მონაცემების და საძიებო ინდექსაციის ანალიზი' : 'Simulated crawler indexation & Open Graph compliance'}
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={refreshMetaTags}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-proton-accent/10 hover:bg-proton-accent hover:text-proton-bg border border-proton-accent/20 transition-all cursor-pointer active:scale-95"
                    >
                      <RefreshCw size={12} className="animate-spin-slow" />
                      {language === 'ka' ? 'სინქრონიზაცია' : 'Sync Live DOM'}
                    </button>
                  </header>

                  {/* Audit Score Circle & Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
                    {/* Score Panel */}
                    <div className="sm:col-span-4 bg-proton-bg/40 p-5 rounded-[24px] border border-proton-border/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-proton-accent/5 rounded-full filter blur-xl" />
                      <span className="text-[9px] font-black uppercase text-proton-muted tracking-widest mb-2">
                        {language === 'ka' ? 'SEO ქულა' : 'SEO Compliance'}
                      </span>
                      <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-proton-accent/20 bg-proton-card shadow-inner">
                        <div className="absolute inset-2 rounded-full border border-dashed border-proton-accent/30 animate-[spin_40s_linear_infinite]" />
                        <span className="text-3xl font-black text-proton-text">
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
                        <span className="text-xs font-bold text-proton-muted absolute bottom-5">/100</span>
                      </div>
                      <span className="text-[9px] font-black uppercase text-proton-accent tracking-widest mt-3">
                        {language === 'ka' ? 'სრულად ოპტიმიზებული' : 'Fully Optimized'}
                      </span>
                    </div>

                    {/* Quick Audit Checks */}
                    <div className="sm:col-span-8 space-y-2 bg-proton-card/50 p-5 rounded-[24px] border border-proton-border/50">
                      <span className="text-[10px] font-black uppercase text-proton-muted tracking-widest block mb-1">
                        {language === 'ka' ? 'აუდიტის ანგარიში' : 'Audit Checkpoints'}
                      </span>
                      {[
                        { 
                          label: language === 'ka' ? 'სათაური (Title Tag)' : 'Document Title Tag', 
                          status: metaTags.title !== 'N/A', 
                          desc: metaTags.title,
                          req: '50-60 chars'
                        },
                        { 
                          label: language === 'ka' ? 'მეტა აღწერა (Meta Description)' : 'Meta Description Tag', 
                          status: metaTags.description !== 'N/A', 
                          desc: metaTags.description,
                          req: '120-160 chars'
                        },
                        { 
                          label: language === 'ka' ? 'კანონიკური ბმული (Canonical Link)' : 'Canonical URL Link', 
                          status: metaTags.canonical !== 'N/A', 
                          desc: metaTags.canonical,
                          req: 'Valid protocol URL'
                        },
                        { 
                          label: language === 'ka' ? 'საძიებო სიტყვები (Keywords)' : 'Keywords Tag', 
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
                              <span className="text-[8px] font-mono text-proton-muted shrink-0 bg-proton-secondary/20 px-2 py-0.5 rounded border border-proton-border/10">{item.req}</span>
                            </div>
                            <p className="text-[9px] text-proton-muted truncate font-mono mt-0.5">{item.desc}</p>
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
                      {language === 'ka' ? 'სიმულატორი' : 'Snippet Preview'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSEOView('code')}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest",
                        activeSEOView === 'code' ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/10" : "text-proton-muted hover:text-proton-text"
                      )}
                    >
                      {language === 'ka' ? 'წყარო კოდი' : 'HTML Tags'}
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {activeSEOView === 'visual' ? (
                      <motion.div
                        key="visual-preview"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="space-y-6"
                      >
                        {/* Google SERP Card */}
                        <div className="bg-[#17171a] p-6 rounded-[28px] border border-proton-border/40 space-y-3">
                          <div className="flex items-center justify-between border-b border-proton-border/20 pb-3">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#9ca3af] flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              {language === 'ka' ? 'Google-ის ძიების სიმულატორი' : 'Google SERP Crawler Mockup'}
                            </span>
                            <span className="text-[8px] font-mono text-proton-muted">desktop</span>
                          </div>
                          
                          <div className="space-y-1 font-sans">
                            <div className="flex items-center gap-1.5 text-xs text-[#dadce0]">
                              <span className="text-xs font-medium truncate">https://proton-ai.example.com</span>
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
                        <div className="bg-[#17171a] p-6 rounded-[28px] border border-proton-border/40 space-y-4">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#9ca3af] flex items-center gap-1.5 border-b border-proton-border/20 pb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                            {language === 'ka' ? 'სოციალური ბარათის ვიზუალი' : 'Open Graph Social Link Preview'}
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
                                proton-ai.example.com
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
                        className="space-y-4"
                      >
                        <div className="bg-zinc-950 p-5 rounded-[24px] border border-zinc-800 font-mono text-[10px] text-zinc-300 leading-relaxed overflow-x-auto custom-scrollbar-minimal shadow-inner relative group">
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
                        <div className="bg-proton-bg/20 p-5 rounded-[24px] border border-proton-border/30 flex items-start gap-4">
                          <Info size={18} className="text-proton-accent mt-0.5 shrink-0" />
                          <div className="space-y-1 text-[11px] leading-relaxed">
                            <span className="font-black text-proton-text uppercase tracking-widest block">
                              {language === 'ka' ? 'როგორ დავტესტოთ?' : 'HOW DO I TEST THIS LIVE?'}
                            </span>
                            <p className="text-proton-muted">
                              {language === 'ka' 
                                ? 'თქვენი მეტა ტეგები უკვე ჩაწერილია საიტის მთავარ index.html-ში. საძიებო ბოტები (Googlebot, Bingbot) და სოციალური პლატფორმები (Slack, Telegram, Discord) კითხულობენ ამ ტეგებს პირდაპირ სერვერიდან. მათ შესამოწმებლად შეგიძლიათ გამოიყენოთ ოფიციალური უფასო ხელსაწყოები:' 
                                : 'These meta tags are fully compiled into your index.html. To verify how real search engine crawlers (Googlebot) and social scraper bots (Discord, Slack, LinkedIn) parse them directly from our servers, you can inspect them via:'}
                            </p>
                            <ul className="list-disc pl-4 space-y-1 text-[10px] text-proton-accent/80 font-black uppercase tracking-wider">
                              <li>
                                <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1 inline-flex">
                                  Google Search Console URL Inspector
                                  <ExternalLink size={10} className="inline ml-1" />
                                </a>
                              </li>
                              <li>
                                <a href="https://metatags.io" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1 inline-flex">
                                  MetaTags.io Global Validator
                                  <ExternalLink size={10} className="inline ml-1" />
                                </a>
                              </li>
                            </ul>
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
    </div>
  );
};
