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
  const [isClaiming, setIsClaiming] = React.useState(false);
  const [claimed, setClaimed] = React.useState(false);

  if (!profile) return null;
  const lang = profile.language || 'en';
  const t = translations[lang].cabinet;

  const handleClaimReward = async () => {
    if (claimed || isClaiming) return;
    setIsClaiming(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser!.uid);
      await updateDoc(userRef, {
        balance: increment(50)
      });
      setClaimed(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsClaiming(false);
    }
  };

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
         
         <div className="relative p-4 px-6 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative shrink-0">
               <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-proton-accent to-blue-600 p-[1.5px]">
                  <div className="w-full h-full bg-proton-bg rounded-[10px] flex items-center justify-center overflow-hidden">
                     {profile.avatar && isUrl(profile.avatar) ? (
                        <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     ) : (
                        <span className="text-lg font-black text-proton-accent">{profile.name.charAt(0)}</span>
                     )}
                  </div>
               </div>
               <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded flex items-center justify-center border border-proton-card shadow-lg text-white">
                  <Shield size={6} />
               </div>
            </div>

            <div className="flex-1 text-center md:text-left min-w-0">
               <h2 className="text-lg md:text-xl font-black tracking-tight uppercase text-proton-text truncate">{profile.name}</h2>
               <div className="flex items-center justify-center md:justify-start gap-2 text-proton-muted font-bold text-[9px] mt-0.5">
                  <span className="flex items-center gap-1 opacity-70"><Mail size={10} className="text-proton-accent" /> {profile.email}</span>
               </div>
               <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1.5">
                  <div className="px-1.5 py-0.5 bg-proton-accent/10 border border-proton-accent/20 text-proton-accent text-[7px] font-black rounded uppercase tracking-wider">
                     {t.verified}
                  </div>
               </div>
            </div>

            <div className="w-full md:w-auto">
               <div className="bg-proton-bg/40 backdrop-blur-xl p-2 px-5 rounded-lg border border-white/5 shadow-inner flex flex-col items-center justify-center gap-0">
                  <span className="text-[7px] font-black text-proton-muted uppercase tracking-widest opacity-60">{t.balance_label}</span>
                  <div className="text-lg font-black tracking-tighter text-proton-text flex items-center gap-1">
                     <span className="text-proton-accent font-medium text-sm">{lang === 'ka' ? '₾' : '$'}</span>
                     {profile.balance || 0}
                  </div>
               </div>
            </div>
         </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         {/* 1.5 ENGAGEMENT ALGORITHM: DAILY PULSE */}
         <section className="bg-proton-card border border-proton-border rounded-xl p-5 px-6 space-y-4 shadow-sm overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl -mr-10 -mt-10 group-hover:bg-amber-500/20 transition-all duration-700" />
            
            <div className="flex items-center justify-between relative z-10">
               <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                     <Gift size={16} />
                  </div>
                  <div>
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-proton-text">{(t as any).daily_reward_title}</h3>
                     <p className="text-[8px] text-proton-muted font-bold uppercase tracking-tighter opacity-60">{(t as any).daily_reward_desc}</p>
                  </div>
               </div>
            </div>

            <div className="relative z-10 flex items-center gap-4">
               <div className="flex-1 h-1.5 bg-proton-bg/40 rounded-full overflow-hidden border border-proton-border/30">
                  <motion.div 
                     initial={{ width: "0%" }}
                     animate={{ width: claimed ? "100%" : "35%" }}
                     className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                  />
               </div>
               <button 
                  onClick={handleClaimReward}
                  disabled={claimed || isClaiming}
                  className={cn(
                     "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                     claimed 
                        ? "bg-proton-bg/40 text-proton-muted border border-proton-border cursor-not-allowed" 
                        : "bg-amber-500 text-black hover:scale-105 active:scale-95 shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
                  )}
               >
                  {isClaiming ? "..." : claimed ? (t as any).claimed : (t as any).claim_button}
               </button>
            </div>
         </section>

         {/* 1.6 SMART INSIGHTS / ALGORITHM FEED */}
         <section className="bg-proton-card border border-proton-border rounded-xl p-5 px-6 space-y-4 shadow-sm overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-proton-accent/10 blur-3xl -mr-10 -mt-10 group-hover:bg-proton-accent/20 transition-all duration-700" />
            
            <div className="flex items-center justify-between relative z-10">
               <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-proton-accent/10 text-proton-accent">
                     <TrendingUp size={16} />
                  </div>
                  <div>
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-proton-text">{(t as any).insights_title}</h3>
                     <p className="text-[8px] text-proton-accent font-bold uppercase tracking-tighter animate-pulse">{(t as any).insights_growth}</p>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-2 relative z-10">
               <div className="p-2 rounded-lg bg-proton-bg/40 border border-proton-border/30">
                  <div className="flex items-center justify-between mb-1">
                     <span className="text-[7px] font-black text-proton-muted uppercase">Retention</span>
                     <span className="text-[8px] text-emerald-400 font-mono">+4.2%</span>
                  </div>
                  <div className="h-1 bg-proton-border/20 rounded-full overflow-hidden">
                     <div className="h-full w-[85%] bg-emerald-500" />
                  </div>
               </div>
               <div className="p-2 rounded-lg bg-proton-bg/40 border border-proton-border/30">
                  <div className="flex items-center justify-between mb-1">
                     <span className="text-[7px] font-black text-proton-muted uppercase">Ad Value</span>
                     <span className="text-[8px] text-amber-400 font-mono">1.2x</span>
                  </div>
                  <div className="h-1 bg-proton-border/20 rounded-full overflow-hidden">
                     <div className="h-full w-[65%] bg-amber-500" />
                  </div>
               </div>
            </div>
         </section>

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
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-proton-text">{(t as any).design_title}</h3>
                     <p className="text-[8px] text-proton-muted font-bold uppercase tracking-tighter opacity-60">
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
                                    "text-[10px] font-black uppercase tracking-widest leading-none",
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

         {/* 3. MONETIZATION / BILLING */}
         <section className="bg-proton-card border border-proton-border rounded-xl p-5 px-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <CreditCard size={14} className="text-emerald-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-proton-text">{(t as any).billing_title}</h3>
               </div>
               <div className={cn(
                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                  profile.isPro ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" : "bg-proton-muted/20 text-proton-muted border border-proton-border"
               )}>
                  {profile.isPro ? (t as any).pro_active : "BASIC"}
               </div>
            </div>

            <div className="space-y-3">
               {/* Balance Display */}
               <div className="bg-proton-bg/40 border border-proton-border rounded-lg p-3 flex items-center justify-between">
                  <div>
                     <p className="text-[9px] text-proton-muted font-bold uppercase tracking-widest">{(t as any).credits_balance}</p>
                     <p className="text-lg font-mono font-bold text-proton-accent">{profile.balance || 0} ⚡</p>
                  </div>
                  <button className="p-2 px-3 rounded-lg bg-proton-accent text-proton-bg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
                     <Wallet size={12} />
                     {(t as any).add_credits}
                  </button>
               </div>

               {/* Membership Upgrade */}
               {!profile.isPro && (
                  <button className="w-full group relative overflow-hidden p-3 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent hover:from-amber-500/20 transition-all">
                     <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2">
                           <Star size={14} className="text-amber-500 fill-amber-500 animate-pulse" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{(t as any).get_pro}</span>
                        </div>
                        <ExternalLink size={12} className="text-amber-500/50" />
                     </div>
                     <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
               )}
            </div>
         </section>

         {/* 4. PARTNER HUB / AD SPACE */}
         <section className="bg-proton-card border border-proton-border rounded-xl p-5 px-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <Globe size={14} className="text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-proton-text">{(t as any).partners_title}</h3>
               </div>
               <span className="text-[8px] text-proton-muted font-bold uppercase tracking-widest opacity-60">PROMOTED</span>
            </div>

            <div className="space-y-2">
               {/* AD CARD 1 */}
               <div className="group cursor-pointer rounded-lg border border-proton-border bg-proton-bg/20 p-3 hover:border-proton-accent/30 transition-all">
                  <div className="flex gap-3">
                     <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Zap size={18} className="text-blue-400" />
                     </div>
                     <div className="space-y-1">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-proton-text flex items-center gap-2">
                           CyberVPN Pro
                           <span className="px-1 py-0.5 rounded-sm bg-blue-500/20 text-blue-400 text-[6px]">OFFER</span>
                        </h4>
                        <p className="text-[9px] text-proton-muted font-medium line-clamp-1">Secure your neural uplink with 256-bit encryption.</p>
                     </div>
                  </div>
               </div>

               {/* GENERIC AD SPACE */}
               <div className="rounded-lg border border-dashed border-proton-border p-3 text-center transition-colors hover:bg-proton-bg/30">
                  <p className="text-[8px] text-proton-muted font-bold uppercase tracking-wider italic">{(t as any).ad_sample}</p>
               </div>
            </div>
         </section>

         {/* 5. SETTINGS */}
         <section className="bg-proton-card border border-proton-border rounded-xl p-4 px-6 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
               <Settings size={12} className="text-amber-500" />
               <h3 className="text-[10px] font-black uppercase tracking-widest text-proton-text">{t.config_title}</h3>
            </div>

            <div className="grid grid-cols-1 gap-2">
               <div className="flex items-center justify-between p-2.5 bg-proton-bg/20 rounded-lg border border-proton-border">
                  <div className="space-y-0 text-[10px]">
                     <div className="font-black uppercase text-proton-text leading-tight">{t.language_label}</div>
                     <div className="text-[8px] text-proton-muted font-bold opacity-60">{t.language_desc}</div>
                  </div>
                  <select 
                     value={profile.language}
                     onChange={(e) => handleUpdate('language', e.target.value)}
                     className="bg-proton-bg border border-proton-border rounded-md px-2 py-1 text-[9px] font-black text-proton-text focus:outline-none focus:border-proton-accent cursor-pointer"
                  >
                     <option value="en">EN</option>
                     <option value="ka">KA</option>
                  </select>
               </div>

               <div className="flex items-center justify-between p-2.5 bg-proton-bg/20 rounded-lg border border-proton-border">
                  <div className="space-y-0 text-[10px]">
                     <div className="font-black uppercase text-proton-text leading-tight">{t.notifications_label}</div>
                     <div className="text-[8px] text-proton-muted font-bold opacity-60">{t.notifications_desc}</div>
                  </div>
                  <button 
                     onClick={() => handleUpdate('notifications', !profile.notifications)}
                     className={cn(
                        "w-7 h-3.5 rounded-full transition-all relative flex items-center",
                        profile.notifications ? "bg-proton-accent" : "bg-white/10"
                     )}
                  >
                     <motion.div 
                        animate={{ x: profile.notifications ? 16 : 2 }}
                        className={cn("w-2.5 h-2.5 rounded-full bg-white shadow-sm", profile.notifications ? "bg-black" : "bg-proton-muted")} 
                     />
                  </button>
               </div>
            </div>
         </section>

         {/* 4. NETWORK */}
         <section className="bg-proton-card border border-proton-border rounded-xl p-4 px-6 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <Globe size={12} className="text-green-500" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-proton-text">{t.connection_title}</h3>
               </div>
               <button className="text-proton-muted hover:text-proton-accent transition-colors">
                  <RefreshCw size={10} />
               </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
               <div className="p-2 bg-proton-bg/20 border border-proton-border rounded-lg">
                  <span className="text-[7px] font-black text-proton-muted uppercase tracking-widest block mb-0.5">{t.region_label}</span>
                  <div className="text-[9px] font-mono font-bold text-white">UK-LON</div>
               </div>
               <div className="p-2 bg-proton-bg/20 border border-proton-border rounded-lg">
                  <span className="text-[7px] font-black text-proton-muted uppercase tracking-widest block mb-0.5">{t.status_label}</span>
                  <div className="flex items-center gap-1">
                     <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                     <span className="text-[8px] text-green-500 font-black uppercase">{t.optimal}</span>
                  </div>
               </div>
            </div>
         </section>
      </div>
    </div>
  );
}

