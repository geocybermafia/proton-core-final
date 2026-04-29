
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Lock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import { UserProfile, GlobalAiSettings, Theme } from '../types';

interface SettingsViewProps {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  aiSettings: GlobalAiSettings;
  setAiSettings: React.Dispatch<React.SetStateAction<GlobalAiSettings>>;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: 'en' | 'ka';
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userProfile,
  setUserProfile,
  aiSettings,
  setAiSettings,
  theme,
  setTheme,
  language
}) => {
  const t = translations[language].settings;
  const common = translations[language].common;
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'appearance' | 'security'>('ai');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const tabs = [
    { id: 'ai', label: t.ai_config || 'AI Assistant', icon: Cpu },
    { id: 'profile', label: t.profile || 'Profile', icon: User },
    { id: 'appearance', label: t.appearance || 'Design', icon: Palette },
    { id: 'security', label: t.security || 'Security', icon: Shield },
  ];

  const themes: { id: Theme; color: string; label: string }[] = [
    { id: 'proton', color: 'bg-[#00F2FF]', label: 'Proton' },
    { id: 'light', color: 'bg-white border border-gray-200', label: 'Light' },
    { id: 'vibrant', color: 'bg-purple-600', label: 'Vibrant' },
    { id: 'midnight', color: 'bg-slate-900', label: 'Midnight' },
  ];

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto py-4 md:py-8 px-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-proton-text flex items-center gap-3">
            <Settings className="text-proton-accent" size={32} />
            {t.title}
          </h2>
          <p className="text-proton-muted text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1">{t.subtitle}</p>
        </div>
        
        <button 
          onClick={handleSave}
          className={cn(
            "w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95",
            isSaved ? "bg-green-500 text-white" : "bg-proton-accent text-proton-bg hover:shadow-proton-accent/30"
          )}
        >
          {isSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {isSaved ? (language === 'ka' ? 'შენახულია' : 'Saved') : t.save}
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row bg-proton-card border border-proton-border rounded-[40px] overflow-hidden shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/5 to-transparent pointer-events-none" />
        
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-proton-border bg-proton-bg/30 p-4 md:p-6 flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible custom-scrollbar-minimal relative z-10">
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
        <div className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar-minimal bg-transparent relative z-10">
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
                <div className="space-y-8">
                  <header className="pb-6 border-b border-proton-border/50">
                    <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight">{t.ai_config}</h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest">{t.ai_desc}</p>
                  </header>

                  <div className="space-y-8">
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase tracking-wider flex items-center gap-2 text-proton-muted">
                          <Zap size={14} className="text-amber-500" />
                          {t.temperature}
                        </label>
                        <span className="text-[11px] font-mono font-bold text-proton-accent bg-proton-accent/10 px-3 py-1 rounded-lg border border-proton-accent/20">{aiSettings.temperature.toFixed(1)}</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.1"
                        value={aiSettings.temperature}
                        onChange={e => setAiSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                        className="w-full accent-proton-accent appearance-none h-2 bg-proton-secondary/30 rounded-full cursor-pointer transition-all border border-proton-border/30"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className={cn(
                        "p-5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group",
                        aiSettings.enableSearch ? "bg-proton-accent/5 border-proton-accent/40" : "bg-proton-secondary/10 border-proton-border"
                      )} onClick={() => setAiSettings(prev => ({ ...prev, enableSearch: !prev.enableSearch }))}>
                        <div className="flex items-center gap-3">
                          <Search size={18} className={aiSettings.enableSearch ? "text-proton-accent" : "text-proton-muted"} />
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
                      )} onClick={() => setAiSettings(prev => ({ ...prev, enableMaps: !prev.enableMaps }))}>
                        <div className="flex items-center gap-3">
                          <MapPin size={18} className={aiSettings.enableMaps ? "text-proton-accent" : "text-proton-muted"} />
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
                             onClick={() => setAiSettings(prev => ({ ...prev, voice: voice.id }))}
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
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-8">
                  <header className="pb-6 border-b border-proton-border/50">
                    <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight">{t.profile || 'Profile'}</h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest">{t.profile_desc}</p>
                  </header>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted">{t.region}</label>
                        <div className="relative group">
                          <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-accent/50 transition-colors group-focus-within:text-proton-accent" />
                          <input 
                            value={userProfile.region || ''}
                            onChange={e => setUserProfile(prev => ({ ...prev, region: e.target.value }))}
                            className="w-full bg-proton-secondary/20 pl-12 pr-4 py-4 rounded-2xl border border-proton-border text-sm font-bold text-proton-text focus:outline-none focus:border-proton-accent transition-all placeholder:text-proton-muted/50"
                            placeholder="e.g. Tbilisi, GE"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted">{t.phone}</label>
                        <div className="relative group">
                          <Volume2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-accent/50 transition-colors group-focus-within:text-proton-accent" />
                          <input 
                            value={userProfile.phoneNumber || ''}
                            onChange={e => setUserProfile(prev => ({ ...prev, phoneNumber: e.target.value }))}
                            className="w-full bg-proton-secondary/20 pl-12 pr-4 py-4 rounded-2xl border border-proton-border text-sm font-bold text-proton-text focus:outline-none focus:border-proton-accent transition-all placeholder:text-proton-muted/50"
                            placeholder="+995 ..."
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-10 bg-proton-secondary/10 border border-dashed border-proton-border rounded-[32px] flex flex-col items-center justify-center text-center group">
                       <div className="w-20 h-20 rounded-full bg-proton-bg border border-proton-border flex items-center justify-center text-proton-accent mb-4 shadow-xl group-hover:scale-110 transition-transform">
                        <User size={40} />
                       </div>
                       <p className="text-[10px] text-proton-muted font-black uppercase tracking-[0.2em] mt-2">Biometric Data Matrix Secure</p>
                       <p className="text-[8px] text-proton-accent opacity-50 font-black uppercase tracking-widest mt-1">E2E Encryption Level 4</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="space-y-8">
                  <header className="pb-6 border-b border-proton-border/50">
                    <h3 className="text-xl font-black text-proton-text mb-1 uppercase tracking-tight">{t.appearance}</h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest">{t.appearance_desc}</p>
                  </header>

                  <div className="space-y-8">
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-wider mb-5 block text-proton-muted">Color Palette</label>
                      <div className="grid grid-cols-2 gap-4">
                        {themes.map((t_item) => (
                          <button
                            key={t_item.id}
                            onClick={() => setTheme(t_item.id)}
                            className={cn(
                              "flex items-center gap-4 p-5 rounded-3xl transition-all border-2",
                              theme === t_item.id 
                                ? "bg-proton-accent/10 border-proton-accent shadow-[0_0_20px_rgba(0,242,255,0.1)]" 
                                : "border-proton-border bg-proton-secondary/10 hover:bg-proton-secondary/20"
                            )}
                          >
                            <div className={cn("w-12 h-12 rounded-xl shadow-lg", t_item.color)} />
                            <span className={cn(
                              "text-xs font-black uppercase tracking-widest",
                              theme === t_item.id ? "text-proton-accent" : "text-proton-text"
                            )}>{t_item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={cn(
                      "p-7 rounded-[32px] border flex items-center justify-between transition-all cursor-pointer group",
                      aiSettings.zenMode ? "bg-amber-500/5 border-amber-500/30 shadow-lg shadow-amber-500/5" : "bg-proton-secondary/10 border-proton-border"
                    )} onClick={() => setAiSettings(prev => ({ ...prev, zenMode: !prev.zenMode }))}>
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                          aiSettings.zenMode ? "bg-amber-500/20 text-amber-500 shadow-lg" : "bg-proton-secondary/20 text-proton-muted"
                        )}>
                          <EyeOff size={28} />
                        </div>
                        <div>
                          <label className="text-xs font-black uppercase tracking-widest cursor-pointer block text-proton-text">{t.zen || 'Zen Mode'}</label>
                          <p className="text-[10px] text-proton-muted font-bold uppercase tracking-tighter mt-1">De-clutter the interface matrix</p>
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
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-8">
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
                            <p className="text-xs font-black uppercase tracking-wide text-green-400">Core Sync: Active</p>
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
                       <button className="w-full py-5 bg-proton-text text-proton-bg rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-proton-accent hover:text-proton-bg transition-all shadow-xl active:scale-95">
                          Export Data Log
                       </button>
                       <div className="flex items-center justify-center gap-4 text-[9px] text-proton-muted font-bold uppercase tracking-[0.3em]">
                        <span>Version 4.1.0-STABLE</span>
                        <span className="w-1 h-1 rounded-full bg-proton-border" />
                        <span>Core: Pro-X3</span>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
