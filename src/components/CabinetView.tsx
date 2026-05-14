import React from 'react';
import { UserProfile, Theme } from '../types';
import { User as UserIcon, Mail, Globe, Bell, Shield, Wallet, Save, RefreshCw, Layers, Settings, Palette, Sun, Moon, Zap, Sparkles, Circle, CreditCard, Star, ExternalLink, ZapOff, Gift, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import { translations } from '../translations';

interface CabinetViewProps {
  profile: UserProfile | null;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const THEME_OPTIONS: { id: Theme; label: string; icon: any; color: string; bg: string }[] = [
  { id: 'light', label: 'Light', icon: Sun, color: 'bg-slate-200', bg: 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-800' },
  { id: 'titanium', label: 'Titanium', icon: Circle, color: 'bg-sky-400', bg: 'bg-gradient-to-br from-slate-700 to-slate-900 border-slate-500' },
  { id: 'proton', label: 'Cyber', icon: Zap, color: 'bg-cyan-400', bg: 'bg-[radial-gradient(circle_at_50%_50%,#0d1117_0%,#010409_100%)] border-cyan-500/20' },
  { id: 'forest', label: 'Forest', icon: Layers, color: 'bg-emerald-500', bg: 'bg-gradient-to-br from-emerald-900 via-emerald-950 to-black border-emerald-500/20' },
  { id: 'sunset', label: 'Sunset', icon: Sparkles, color: 'bg-orange-400', bg: 'bg-gradient-to-br from-orange-900 via-red-950 to-black border-orange-500/20' },
  { id: 'rose', label: 'Rose', icon: Sparkles, color: 'bg-rose-500', bg: 'bg-gradient-to-br from-rose-900 via-rose-950 to-black border-rose-500/20' },
  { id: 'vibrant', label: 'Nebula', icon: Sparkles, color: 'bg-purple-500', bg: 'bg-gradient-to-br from-indigo-900 via-purple-950 to-black border-purple-500/20' },
  { id: 'midnight', label: 'Dark', icon: Moon, color: 'bg-slate-900', bg: 'bg-gradient-to-br from-neutral-900 to-black border-neutral-800' },
];

export default function CabinetView({ profile, theme, setTheme }: CabinetViewProps) {
  const [isDesignOpen, setIsDesignOpen] = React.useState(false);

  if (!profile) return null;
  const lang = profile.language || 'en';
  const t = translations[lang].cabinet;

  const handleUpdate = async (field: string, value: any) => {
    if (!auth.currentUser) return;
    const docRef = doc(db, 'users', auth.currentUser.uid);
    try {
      await updateDoc(docRef, { [field]: value });
    } catch (e) {
      console.error("Update failed", e);
    }
  };

  const isUrl = (str: string) => str.startsWith('http') || str.startsWith('data:image');

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-16">
      {/* 1. COMPACT HEADER */}
      <section className="relative overflow-hidden">
         <div className="absolute inset-0 bg-proton-card border border-proton-border rounded-xl shadow-md" />
         
         <div className="relative p-6 px-8 flex flex-col md:flex-row gap-6 items-center">
            <div className="relative shrink-0">
               <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-proton-accent to-blue-600 p-[2px]">
                  <div className="w-full h-full bg-proton-bg rounded-[14px] flex items-center justify-center overflow-hidden">
                     {profile.avatar && isUrl(profile.avatar) ? (
                        <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     ) : (
                        <span className="text-2xl font-black text-proton-accent">{profile.name.charAt(0)}</span>
                     )}
                  </div>
               </div>
               <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center border-2 border-proton-card shadow-lg text-white">
                  <Shield size={10} />
               </div>
            </div>

            <div className="flex-1 text-center md:text-left min-w-0">
               <h2 className="text-2xl md:text-3xl font-black tracking-tight uppercase text-proton-text truncate">{profile.name}</h2>
               <div className="flex items-center justify-center md:justify-start gap-2 text-proton-muted font-bold text-xs mt-1">
                  <span className="flex items-center gap-1.5 opacity-80"><Mail size={14} className="text-proton-accent" /> {profile.email}</span>
               </div>
               <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3">
                  <div className="px-2 py-1 bg-proton-accent/10 border border-proton-accent/20 text-proton-accent text-xs font-black rounded uppercase tracking-wider">
                     {t.verified}
                  </div>
               </div>
            </div>
         </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {/* 2. DESIGN / THEME SWITCHER - COLLAPSIBLE */}
         <section className="bg-proton-card border border-proton-border rounded-xl shadow-sm lg:col-span-2 overflow-hidden transition-all duration-300">
            <button 
               onClick={() => setIsDesignOpen(!isDesignOpen)}
               className="w-full flex items-center justify-between p-4 px-6 hover:bg-proton-bg/20 transition-colors"
            >
               <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-proton-accent/10 text-proton-accent transition-transform duration-300", isDesignOpen && "rotate-12")}>
                     <Palette size={16} />
                  </div>
                  <div className="text-left">
                     <h3 className="text-xs font-black uppercase tracking-widest text-proton-text">{(t as any).design_title}</h3>
                     <p className="text-[10px] text-proton-muted font-bold uppercase tracking-tight opacity-70">
                        {isDesignOpen ? (lang === 'ka' ? 'აირჩიეთ ფერი' : 'CHOOSE A MOOD') : (t as any).design_desc}
                     </p>
                  </div>
               </div>
               <motion.div
                  animate={{ rotate: isDesignOpen ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-proton-muted"
               >
                  <Settings size={14} />
               </motion.div>
            </button>
            
            <AnimatePresence>
               {isDesignOpen && (
                  <motion.div
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                     <div className="p-6 pt-0">
                        <div className="h-px bg-gradient-to-r from-transparent via-proton-border to-transparent mb-6 opacity-50" />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           {THEME_OPTIONS.map((opt) => (
                              <button
                                 key={opt.id}
                                 onClick={() => setTheme(opt.id)}
                                 className={cn(
                                    "p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border group relative overflow-hidden",
                                    theme === opt.id 
                                       ? "border-proton-accent shadow-[0_0_20px_rgba(0,242,255,0.05)] ring-2 ring-proton-accent/20" 
                                       : "border-proton-border hover:border-proton-accent/30",
                                    opt.bg
                                 )}
                              >
                                 <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center mb-1 transition-all duration-300", 
                                    theme === opt.id ? "bg-proton-accent text-proton-bg scale-110" : "bg-white/10 group-hover:bg-white/20"
                                 )}>
                                    <opt.icon size={20} />
                                 </div>
                                 <span className={cn(
                                    "text-xs font-black uppercase tracking-widest leading-none",
                                    theme === opt.id ? "text-proton-accent" : "text-white/60 group-hover:text-white"
                                 )}>
                                    {(t as any)[`theme_${opt.id}`] || opt.label}
                                 </span>
                                 
                                 {theme === opt.id && (
                                    <motion.div 
                                       layoutId="theme-active-indicator"
                                       className="absolute top-2 right-2"
                                    >
                                       <div className="w-1.5 h-1.5 bg-proton-accent rounded-full shadow-[0_0_8px_var(--proton-accent)]" />
                                    </motion.div>
                                 )}
                              </button>
                           ))}
                        </div>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>
         </section>

         {/* 5. SETTINGS */}
         <section className="bg-proton-card border border-proton-border rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
               <Settings size={16} className="text-amber-500" />
               <h3 className="text-xs font-black uppercase tracking-widest text-proton-text">{t.config_title}</h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
               <div className="flex items-center justify-between p-4 bg-proton-bg/20 rounded-xl border border-proton-border">
                  <div className="space-y-1">
                     <div className="text-xs font-black uppercase text-proton-text leading-tight">{t.language_label}</div>
                     <div className="text-[10px] text-proton-muted font-bold opacity-70">{t.language_desc}</div>
                  </div>
                  <select 
                     value={profile.language}
                     onChange={(e) => handleUpdate('language', e.target.value)}
                     className="bg-proton-bg border border-proton-border rounded-lg px-3 py-1.5 text-xs font-black text-proton-text focus:outline-none focus:border-proton-accent cursor-pointer"
                  >
                     <option value="en">EN</option>
                     <option value="ka">KA</option>
                  </select>
               </div>

               <div className="flex items-center justify-between p-4 bg-proton-bg/20 rounded-xl border border-proton-border">
                  <div className="space-y-1">
                     <div className="text-xs font-black uppercase text-proton-text leading-tight">{t.notifications_label}</div>
                     <div className="text-[10px] text-proton-muted font-bold opacity-70">{t.notifications_desc}</div>
                  </div>
                  <button 
                     onClick={() => handleUpdate('notifications', !profile.notifications)}
                     className={cn(
                        "w-10 h-5 rounded-full transition-all relative flex items-center",
                        profile.notifications ? "bg-proton-accent" : "bg-white/10"
                     )}
                  >
                     <motion.div 
                        animate={{ x: profile.notifications ? 22 : 2 }}
                        className={cn("w-4 h-4 rounded-full bg-white shadow-sm flex items-center justify-center")}
                     >
                        <div className={cn("w-1.5 h-1.5 rounded-full", profile.notifications ? "bg-proton-bg" : "bg-proton-muted")} />
                     </motion.div>
                  </button>
               </div>
            </div>
         </section>

         {/* 4. NETWORK */}
         <section className="bg-proton-card border border-proton-border rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <Globe size={16} className="text-green-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-proton-text">{t.connection_title}</h3>
               </div>
               <button className="text-proton-muted hover:text-proton-accent transition-colors p-1">
                  <RefreshCw size={12} />
               </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
               <div className="p-3 bg-proton-bg/20 border border-proton-border rounded-xl">
                  <span className="text-[10px] font-black text-proton-muted uppercase tracking-widest block mb-1 opacity-70">{t.region_label}</span>
                  <div className="text-xs font-mono font-bold text-white tracking-wider">UK-LON</div>
               </div>
               <div className="p-3 bg-proton-bg/20 border border-proton-border rounded-xl">
                  <span className="text-[10px] font-black text-proton-muted uppercase tracking-widest block mb-1 opacity-70">{t.status_label}</span>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                     <span className="text-xs text-green-500 font-black uppercase tracking-wide">{t.optimal}</span>
                  </div>
               </div>
            </div>
         </section>
      </div>
    </div>
  );
}

