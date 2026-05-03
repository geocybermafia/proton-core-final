import React, { useState, useMemo } from 'react';
import { 
  Wallet, Workflow, Cpu, FileText, Settings, LogIn, Zap, CheckCircle2, Bell, LogOut, 
  Grid, Layers, Shield, Activity, Database, History, ChevronRight, ArrowRight, 
  ShieldCheck, Fingerprint, Download, ShieldAlert, Key, UserCheck, Circle,
  Mail, MapPin, Phone, Globe, CreditCard, RefreshCw, Smartphone, Star, Clock, Lock, User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import { UserProfile, PersonaHistory } from '../types';

interface CabinetViewProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  history: PersonaHistory;
  customAvatars: { [id: string]: string };
  personas: any[];
  user: any;
  onSignIn: () => void;
  onSignOut: () => void;
  uiMode: 'business' | 'creative';
  setUiMode: React.Dispatch<React.SetStateAction<'business' | 'creative'>>;
  stats: { storageGB: number, workHours: number, aiEnergy: number, productivity?: number, node_id?: string };
  onNavigate: (view: any) => void;
}

const CabinetView: React.FC<CabinetViewProps> = ({ 
  profile, 
  setProfile, 
  history,
  user,
  onSignIn,
  onSignOut,
  uiMode,
  setUiMode,
  stats: userStats,
  onNavigate
}) => {
  const language = profile.language;
  const common = translations[language].common;
  const cab = translations[language].cabinet;
  const t = translations[language].cabinet;
  
  const personal = {
    title: language === 'ka' ? 'პირადი სამუშაო სივრცე' : 'Personal Workspace',
    overview: language === 'ka' ? 'ოპერაციული მიმოხილვა' : 'Operational Overview',
    dash_title: language === 'ka' ? 'მართვის ჰაბი' : 'Control Hub'
  };

  const [cabinetTab, setCabinetTab] = useState<'overview' | 'modules' | 'security' | 'settings'>('overview');

  const mainModules = [
    { id: 'finance', icon: Wallet, label: language === 'ka' ? 'ფინანსები' : 'Finance', desc: t.finance_desc, color: 'text-blue-500', border: 'border-blue-500/20', bg: 'bg-blue-500/5', badge: language === 'ka' ? 'აქტიური' : 'Active' },
    { id: 'blueprints', icon: Workflow, label: language === 'ka' ? 'პროცესები' : 'Workflows', desc: t.blueprints_desc, color: 'text-proton-accent', border: 'border-proton-accent/20', bg: 'bg-proton-accent/5', badge: language === 'ka' ? 'Beta' : 'Beta' },
    { id: 'device', icon: Cpu, label: language === 'ka' ? 'მოწყობილობა' : 'Hardware', desc: language === 'ka' ? 'სისტემური რესურსების მართვა' : 'System resources management', color: 'text-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-500/5', badge: 'v2.4' },
    { id: 'documentation', icon: FileText, label: language === 'ka' ? 'დოკუმენტაცია' : 'Docs', desc: language === 'ka' ? 'სისტემური სახელმძღვანელო' : 'System documentation', color: 'text-emerald-500', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
    { id: 'settings', icon: Settings, label: language === 'ka' ? 'პარამეტრები' : 'Settings', desc: language === 'ka' ? 'ინტერფეისის კონფიგურაცია' : 'Interface configuration', color: 'text-slate-500', border: 'border-slate-500/20', bg: 'bg-slate-500/5' },
    { id: 'personas', icon: UserCheck, label: language === 'ka' ? 'აგენტები' : 'Agents', desc: language === 'ka' ? 'ხელოვნური ინტელექტის მართვა' : 'AI agents management', color: 'text-red-500', border: 'border-red-500/20', bg: 'bg-red-500/5' },
  ];

  const quickActions = [
    { id: 'translate', icon: Globe, label: language === 'ka' ? 'თარგმნა' : 'Translate', color: 'bg-blue-500' },
    { id: 'studio', icon: Layers, label: language === 'ka' ? 'სტუდია' : 'Studio', color: 'bg-purple-500' },
    { id: 'finance', icon: CreditCard, label: language === 'ka' ? 'საფულე' : 'Wallet', color: 'bg-green-500' },
    { id: 'settings', icon: Settings, label: language === 'ka' ? 'გამართვა' : 'Setup', color: 'bg-orange-500' },
  ];

  const formattedJoinDate = useMemo(() => {
     if (!user?.metadata?.creationTime) return language === 'ka' ? 'აპრილი 2024' : 'APRIL 2024';
     const date = new Date(user.metadata.creationTime);
     return date.toLocaleDateString(language === 'ka' ? 'ka-GE' : 'en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  }, [user, language]);

  const recentActivity = [
    { id: 1, type: 'login', label: language === 'ka' ? 'ავტორიზაცია' : 'Session Start', time: '10:42', date: '28 APR', icon: LogIn, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 2, type: 'module', label: language === 'ka' ? 'ფინანსური მოდული' : 'Finance Access', time: '09:15', date: '28 APR', icon: Wallet, color: 'text-green-500', bg: 'bg-green-50' },
    { id: 3, type: 'ai', label: language === 'ka' ? 'AI გენერაცია' : 'AI Generation', time: '14:20', date: '27 APR', icon: Zap, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  const handleModeChange = (mode: 'business' | 'creative') => {
    setUiMode(mode);
  };

  const profileStrength = useMemo(() => {
    let score = 20;
    if (user?.displayName) score += 20;
    if (user?.photoURL) score += 20;
    if (user?.emailVerified) score += 20;
    if (profile.phoneNumber) score += 20;
    return score;
  }, [user, profile]);

  return (
    <div className="max-w-6xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000 px-2 sm:px-4">
      {/* Professional Header */}
      <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6 md:gap-8 mb-8 md:mb-12 pt-4 md:pt-8 bg-proton-card/30 p-6 sm:p-8 rounded-[40px] border border-proton-border/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-proton-accent/5 via-transparent to-transparent opacity-50" />
        
        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left relative z-10">
          <div className="relative group">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-[40px] bg-proton-bg border border-gray-200/10 flex items-center justify-center overflow-hidden shadow-2xl group-hover:shadow-proton-accent/20 transition-all duration-700 group-hover:rotate-6">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-gray-400">{(user?.displayName || 'U').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 border-4 border-proton-bg rounded-full shadow-lg" />
          </div>
          <div>
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 mb-1">
              <h1 className="text-3xl md:text-5xl font-black text-proton-text tracking-tighter uppercase italic">
                {user?.displayName || (language === 'ka' ? 'მომხმარებელი' : 'User')}
              </h1>
              {user && <CheckCircle2 size={24} className="text-proton-accent animate-pulse" />}
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <p className="text-proton-muted font-bold text-sm md:text-base font-mono">
                {user?.email || (language === 'ka' ? 'სისტემური იდენტიფიკატორი' : 'System ID')}
              </p>
              {user && (
                <span className="px-3 py-1 bg-proton-accent/10 text-[9px] font-black text-proton-accent rounded-full uppercase tracking-[0.2em] border border-proton-accent/20 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-proton-accent shadow-[0_0_8px_rgba(0,242,255,0.8)]" />
                  ID: {userStats.node_id || user.uid.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-center relative z-10">
          <button className="p-4 rounded-2xl bg-proton-bg border border-proton-border text-proton-muted hover:text-proton-accent hover:border-proton-accent transition-all relative group">
            <Bell size={20} />
            <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-proton-bg" />
          </button>
          {!user ? (
            <button onClick={onSignIn} className="flex-1 md:flex-none px-8 py-4 bg-proton-accent text-proton-bg rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-proton-accent/20 active:scale-95">
              {common.signin}
            </button>
          ) : (
            <button onClick={onSignOut} className="flex-1 md:flex-none px-8 py-4 bg-proton-bg border border-red-500/30 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500/10 transition-all flex items-center justify-center gap-3 active:scale-95">
              <LogOut size={18} />
              {common.signout}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 mb-8 bg-proton-card/20 p-1.5 rounded-2xl border border-proton-border/30 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: language === 'ka' ? 'მიმოხილვა' : 'Overview', icon: Grid },
          { id: 'modules', label: language === 'ka' ? 'ინსტრუმენტები' : 'Modules', icon: Layers },
          { id: 'settings', label: language === 'ka' ? 'პროფილი' : 'Profile', icon: Settings },
          { id: 'security', label: language === 'ka' ? 'უსაფრთხოება' : 'Security', icon: Shield },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setCabinetTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              cabinetTab === tab.id 
                ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20" 
                : "text-proton-muted hover:text-proton-text hover:bg-white/5"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {cabinetTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Stats Summary */}
            <div className="lg:col-span-2 space-y-8">
              {/* SYSTEM MODE SELECTOR */}
              <div className="proton-glass p-8 rounded-[40px] border border-proton-border/50 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-8">
                   <div>
                      <h3 className="text-xl font-black text-proton-text uppercase italic tracking-tight">{language === 'ka' ? 'სამუშაო რეჟიმი' : 'System Work Mode'}</h3>
                      <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest mt-1">{language === 'ka' ? 'აირჩიეთ თქვენი მიმართულება' : 'Choose your direction'}</p>
                   </div>
                   <div className="flex bg-proton-bg p-1.5 rounded-2xl border border-proton-border">
                      <button 
                        onClick={() => handleModeChange('business')}
                        className={cn(
                          "px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                          uiMode === 'business' ? "bg-blue-500 text-white shadow-lg" : "text-proton-muted hover:text-proton-text"
                        )}
                      >
                         {language === 'ka' ? 'ბიზნესი' : 'BUSINESS'}
                      </button>
                      <button 
                        onClick={() => handleModeChange('creative')}
                        className={cn(
                          "px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                          uiMode === 'creative' ? "bg-proton-accent text-proton-bg shadow-lg" : "text-proton-muted hover:text-proton-text"
                        )}
                      >
                         {language === 'ka' ? 'შემოქმედება' : 'CREATIVE'}
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className={cn(
                     "p-6 rounded-3xl border transition-all",
                     uiMode === 'business' ? "bg-blue-500/5 border-blue-500/20" : "bg-proton-bg/20 border-proton-border/50 opacity-40"
                   )}>
                      <div className="flex items-center gap-3 mb-4">
                         <Activity className="text-blue-500" size={20} />
                         <h4 className="text-sm font-black text-proton-text uppercase tracking-tight">{language === 'ka' ? 'ბიზნესი და მართვა' : 'Business & Management'}</h4>
                      </div>
                      <p className="text-[10px] text-proton-muted font-bold leading-relaxed uppercase tracking-wide">
                        {language === 'ka' 
                          ? 'ფოკუსირებულია პროცესების მართვაზე, მასშტაბირებაზე და ავტომატიზაციაზე.' 
                          : 'Focused on process management, scaling, and automation.'}
                      </p>
                   </div>
                   <div className={cn(
                     "p-6 rounded-3xl border transition-all",
                     uiMode === 'creative' ? "bg-proton-accent/5 border-proton-accent/20" : "bg-proton-bg/20 border-proton-border/50 opacity-40"
                   )}>
                      <div className="flex items-center gap-3 mb-4">
                         <Zap className="text-proton-accent" size={20} />
                         <h4 className="text-sm font-black text-proton-text uppercase tracking-tight">{language === 'ka' ? 'შემოქმედება და ხარისხი' : 'Creation & Quality'}</h4>
                      </div>
                      <p className="text-[10px] text-proton-muted font-bold leading-relaxed uppercase tracking-wide">
                        {language === 'ka' 
                          ? 'ფოკუსირებულია დეტალურ მუშაობაზე, პრეციზიასა და ინდივიდუალურ შემოქმედებაზე.' 
                          : 'Focused on detailed execution, precision, and individual creativity.'}
                      </p>
                   </div>
                </div>
              </div>

              <div className="proton-glass p-8 rounded-[40px] border border-proton-border/50 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/5 to-transparent pointer-events-none" />
                <div className="flex flex-col sm:flex-row items-center justify-between mb-10 relative z-10 gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-proton-text uppercase tracking-tight italic">{personal.title}</h2>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-[0.3em] font-mono mt-1">{personal.overview}</p>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 bg-proton-accent/10 rounded-2xl border border-proton-accent/20">
                    <Activity size={18} className="text-proton-accent animate-pulse" />
                    <span className="text-[9px] font-black text-proton-accent uppercase tracking-widest">{personal.dash_title}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
                  {/* Storage */}
                  <div className="space-y-3 group">
                    <div className="flex items-center gap-3 text-proton-muted group-hover:text-blue-400 transition-colors">
                      <Database size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{cab.storage}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-proton-text italic tracking-tighter">{userStats.storageGB.toFixed(2)}</span>
                      <span className="text-xs font-black text-proton-muted uppercase tracking-widest italic">GB</span>
                    </div>
                    <div className="h-2 w-full bg-proton-bg/60 rounded-full overflow-hidden border border-proton-border/30">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                        style={{ width: `${Math.min((userStats.storageGB / 5) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>

                  {/* Work Time */}
                  <div className="space-y-3 group">
                    <div className="flex items-center gap-3 text-proton-muted group-hover:text-amber-400 transition-colors">
                      <Clock size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{cab.work_time}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-proton-text italic tracking-tighter">{userStats.workHours.toFixed(1)}</span>
                      <span className="text-xs font-black text-proton-muted uppercase tracking-widest italic">H</span>
                    </div>
                    <div className="h-2 w-full bg-proton-bg/60 rounded-full overflow-hidden border border-proton-border/30">
                      <div className="h-full bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: '72%' }} />
                    </div>
                  </div>

                  {/* Productivity */}
                  <div className="space-y-3 group">
                    <div className="flex items-center gap-3 text-proton-muted group-hover:text-proton-accent transition-colors">
                      <Zap size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{language === 'ka' ? 'ეფექტურობა' : 'Efficiency'}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-proton-text italic tracking-tighter">{userStats.productivity || 0}</span>
                      <span className="text-xs font-black text-proton-muted uppercase tracking-widest italic">%</span>
                    </div>
                    <div className="h-2 w-full bg-proton-bg/60 rounded-full overflow-hidden border border-proton-border/30">
                      <div className="h-full bg-proton-accent rounded-full shadow-[0_0_10px_rgba(0,242,255,0.5)]" style={{ width: `${userStats.productivity || 0}%` }} />
                    </div>
                  </div>
                </div>

                {/* MODES & ROADMAP ENHANCEMENT */}
                <div className="mt-12 p-8 rounded-[32px] bg-proton-bg/20 border border-proton-border/30 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    {uiMode === 'operator' ? <Activity size={120} /> : <Zap size={120} />}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-between mb-8 relative z-10 gap-4">
                    <div>
                      <h3 className="text-lg font-black text-proton-text uppercase tracking-tight italic">
                        {uiMode === 'business' ? t.business_roadmap : t.creative_roadmap}
                      </h3>
                      <p className="text-[9px] text-proton-muted font-bold uppercase tracking-widest mt-1 opacity-70">
                        {t.roadmap_desc}
                      </p>
                    </div>
                    <div className={cn(
                      "px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest",
                      uiMode === 'business' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" : "bg-proton-accent/10 border-proton-accent/20 text-proton-accent"
                    )}>
                      {uiMode === 'business' ? "Scale Phase: Growth" : "Craft Phase: Mastery"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
                    {(uiMode === 'business' ? t.business_features : t.creative_features).map((feature: string, i: number) => (
                      <div key={i} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-proton-text uppercase tracking-wider">{feature}</span>
                          <span className="text-[10px] font-mono text-proton-muted">{15 + i * 25}%</span>
                        </div>
                        <div className="h-1 w-full bg-proton-bg/60 rounded-full overflow-hidden">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${15 + i * 25}%` }}
                             className={cn("h-full rounded-full", uiMode === 'business' ? "bg-blue-500" : "bg-proton-accent")}
                           />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* STRATEGIC ADVANCEMENT PLAN */}
                <div className="proton-glass p-8 rounded-[40px] border border-proton-border/50 relative overflow-hidden">
                   <div className="flex items-center gap-4 mb-10">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-xl">
                         <Star size={24} className="fill-current animate-pulse" />
                      </div>
                      <div>
                         <h3 className="text-xl font-black text-proton-text uppercase italic tracking-tight">
                            {language === 'ka' ? 'განვითარების გეგმა' : 'Growth & Mastery Plan'}
                         </h3>
                         <p className="text-[10px] text-proton-muted font-black uppercase tracking-[0.2em] mt-1">
                            {language === 'ka' ? 'თქვენი შემდეგი ეტაპები' : 'Your next major milestones'}
                         </p>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                         {[
                           { label: uiMode === 'business' ? (language === 'ka' ? 'კაპიტალის მობილიზება' : 'Capital Sourcing') : (language === 'ka' ? 'ახალი იარაღები' : 'Digital Crafting Tools'), desc: uiMode === 'business' ? (language === 'ka' ? 'ახალი ფინანსური არხების და რესურსების გახსნა.' : 'Unlock new funding channels and resources.') : (language === 'ka' ? 'მაღალი სიზუსტის ციფრული ხელსაწყოების შეძენა.' : 'Acquire high-precision digital tools.'), status: 'upcoming' },
                           { label: uiMode === 'business' ? (language === 'ka' ? 'პროცესების სინთეზი' : 'Workflow Synthesis') : (language === 'ka' ? 'სტილის დასრულება' : 'Signature Refinement'), desc: uiMode === 'business' ? (language === 'ka' ? 'რამდენიმე სამუშაო პროცესის ერთიან ნაკადად გაერთიანება.' : 'Combine multiple workflows into a single stream.') : (language === 'ka' ? 'თქვენი უნიკალური ნამუშევრების ხარისხის გაუმჯობესება.' : 'Enhance the unique fingerprint of your work.'), status: 'active' },
                         ].map((goal, i) => (
                           <div key={i} className="p-6 rounded-3xl bg-proton-bg/40 border border-proton-border/50 relative group hover:border-proton-accent/30 transition-all">
                              <div className="flex items-start justify-between gap-4">
                                 <div>
                                    <h4 className="text-sm font-black text-proton-text uppercase tracking-tight mb-2">{goal.label}</h4>
                                    <p className="text-[10px] text-proton-muted font-bold tracking-wide uppercase leading-relaxed">{goal.desc}</p>
                                 </div>
                                 <div className={cn(
                                   "px-2 py-1 rounded text-[8px] font-black uppercase whitespace-nowrap",
                                   goal.status === 'active' ? "bg-proton-accent/10 text-proton-accent" : "bg-proton-bg border border-proton-border text-proton-muted"
                                 )}>
                                   {goal.status}
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                      <div className="p-8 rounded-[40px] bg-proton-accent/5 border border-proton-accent/10 flex flex-col items-center justify-center text-center">
                         <div className="w-20 h-20 rounded-full bg-proton-bg border border-proton-accent flex items-center justify-center text-proton-accent mb-6 shadow-2xl relative">
                            <div className="absolute inset-0 bg-proton-accent/20 rounded-full animate-ping" />
                            <Zap size={32} />
                         </div>
                         <h4 className="text-lg font-black text-proton-text uppercase italic tracking-tight mb-3">
                           {language === 'ka' ? 'სტრატეგიული ნახტომი' : 'Next Strategic Jump'}
                         </h4>
                         <p className="text-xs text-proton-muted font-bold tracking-tight uppercase leading-relaxed max-w-[200px] mb-8 opacity-70">
                           {uiMode === 'business' 
                             ? (language === 'ka' ? 'მიაღწიეთ 1,000 ავტომატიზირებულ ციკლს ახალი შესაძლებლობებისთვის.' : 'Reach 1,000 automated cycles to unlock new features.') 
                             : (language === 'ka' ? 'დაასრულეთ 5 პრემიუმ პროექტი ოსტატის სტატუსის მისაღებად.' : 'Complete 5 premium projects to reach Master status.')}
                         </p>
                         <button className={cn(
                           "px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95",
                           uiMode === 'operator' ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-proton-accent text-proton-bg hover:scale-105"
                         )}>
                            {language === 'ka' ? 'გეგმის გააქტიურება' : 'Deploy Next Step'}
                         </button>
                      </div>
                   </div>
                </div>

                {/* Quick Actions Hub */}
                <div className="mt-12">
                   <h3 className="text-[10px] font-black text-proton-muted uppercase tracking-[0.3em] mb-4">{language === 'ka' ? 'სწრაფი წვდომა' : 'Quick Actions'}</h3>
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {quickActions.map(action => (
                         <button 
                           key={action.id}
                           onClick={() => onNavigate(action.id)}
                           className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-proton-bg/40 border border-proton-border/50 hover:bg-proton-accent/5 hover:border-proton-accent transition-all group"
                         >
                            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/20 group-hover:scale-110 transition-all", action.color)}>
                               <action.icon size={20} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-proton-text">{action.label}</span>
                         </button>
                      ))}
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* Activity Feed */}
                 <div className="proton-glass p-8 rounded-[40px] border border-proton-border/50">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">{t.activity}</h3>
                       <History size={18} className="text-proton-muted" />
                    </div>
                    <div className="space-y-4">
                       {recentActivity.map(act => (
                          <div key={act.id} className="flex items-center justify-between p-4 rounded-2xl border border-proton-border/30 hover:border-proton-accent/30 hover:bg-proton-accent/5 transition-all group">
                             <div className="flex items-center gap-4 text-left">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", act.bg.replace('50', '500/10'), act.color.replace('500', '500'))}>
                                   <act.icon size={18} />
                                </div>
                                <div>
                                   <p className="text-[11px] font-black text-proton-text uppercase tracking-tight">{act.label}</p>
                                   <p className="text-[9px] text-proton-muted font-bold uppercase tracking-widest font-mono">{act.date} • {act.time}</p>
                                </div>
                             </div>
                             <ChevronRight size={14} className="text-proton-muted group-hover:text-proton-accent transition-colors" />
                          </div>
                       ))}
                    </div>
                 </div>

                 {/* Profile Progress */}
                 <div className="proton-glass p-8 rounded-[40px] border border-proton-border/50 flex flex-col justify-between">
                    <div>
                       <div className="flex items-center justify-between mb-8">
                          <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">{t.profile_strength}</h3>
                          <Shield size={18} className="text-proton-accent" />
                       </div>
                       <div className="relative pt-1 mb-6">
                          <div className="flex mb-3 items-center justify-between">
                             <span className="text-[9px] font-black inline-block py-1 px-3 uppercase rounded-full text-proton-accent bg-proton-accent/10 border border-proton-accent/20 tracking-widest">
                                {profileStrength === 100 ? (language === 'ka' ? 'დასრულებული' : 'Complete') : (language === 'ka' ? 'მიმდინარეობს' : 'In Progress')}
                             </span>
                             <span className="text-xl font-black italic text-proton-accent">
                                {profileStrength}%
                             </span>
                          </div>
                          <div className="flex h-1.5 overflow-hidden bg-proton-bg/60 rounded-full border border-proton-border/30">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${profileStrength}%` }}
                               transition={{ duration: 1.5, ease: 'easeOut' }}
                               className="flex flex-col justify-center text-center text-white bg-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.6)] whitespace-nowrap"
                             />
                          </div>
                       </div>
                       <p className="text-[10px] text-proton-muted font-bold uppercase tracking-wider leading-relaxed text-left">
                          {language === 'ka' 
                            ? 'დაასრულეთ თქვენი პროფილი პერსონალიზებული AI გამოცდილების მისაღებად და კვანძების ოპტიმიზაციისთვის.' 
                            : 'Complete your profile to unlock more personalized AI interactions and better service distribution.'}
                       </p>
                    </div>
                    <button 
                      onClick={() => setCabinetTab('settings')}
                      className="mt-8 py-4 bg-proton-bg border border-proton-border rounded-2xl text-[10px] font-black text-proton-text uppercase tracking-[0.2em] hover:border-proton-accent hover:text-proton-accent transition-all active:scale-95 shadow-inner"
                    >
                       {language === 'ka' ? 'პროფილის რედაქტირება' : 'Edit Profile'}
                    </button>
                 </div>
              </div>
            </div>

            {/* Side Column: Identity & Health */}
            <div className="space-y-8">
              <div className="bg-proton-text p-8 sm:p-10 rounded-[40px] text-proton-bg shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-40 h-40 bg-proton-accent/20 rounded-full -translate-y-20 translate-x-20 group-hover:scale-150 transition-transform duration-1000 blur-2xl" />
                <div className="relative z-10 text-left">
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-proton-bg/60">{language === 'ka' ? 'ვერიფიცირებული კვანძი' : 'VERIFIED NODE'}</span>
                    <ShieldCheck size={28} className="text-proton-accent" />
                  </div>
                  <div className="mb-10">
                    <p className="text-proton-bg/60 text-[10px] font-black uppercase tracking-widest mb-1">{t.member_since}</p>
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter">{formattedJoinDate}</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 bg-proton-bg/10 rounded-2xl border border-proton-bg/10 backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <Fingerprint size={18} className="text-proton-accent" />
                        <span className="text-[10px] font-black uppercase tracking-wider">{cab.two_factor}</span>
                      </div>
                      <div className="w-10 h-6 bg-proton-accent rounded-full flex items-center px-1 border border-proton-accent/40 shadow-lg shadow-proton-accent/20">
                        <div className="w-4 h-4 bg-proton-bg rounded-full ml-auto shadow-sm" />
                      </div>
                    </div>
                    <button className="w-full py-5 bg-proton-bg text-proton-text rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] hover:scale-105 transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95 group">
                      <Download size={18} className="group-hover:scale-110 transition-transform" />
                      {language === 'ka' ? 'იდენტობის ექსპორტი' : 'Export Identity'}
                    </button>
                  </div>
                </div>
              </div>

              {/* System Health Status */}
              <div className="proton-glass p-8 rounded-[40px] border border-proton-border/50 text-left">
                 <div className="flex items-center justify-between mb-10">
                    <h3 className="text-xs font-black text-proton-text uppercase tracking-[0.3em] italic">{t.health}</h3>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Active</span>
                    </div>
                 </div>
                 <div className="space-y-6">
                    <div className="flex items-center justify-between group">
                       <span className="text-[10px] font-black text-proton-muted uppercase tracking-wider group-hover:text-proton-accent transition-colors">Response Time</span>
                       <span className="text-sm font-black text-proton-text font-mono italic">14ms</span>
                    </div>
                    <div className="flex items-center justify-between group">
                       <span className="text-[10px] font-black text-proton-muted uppercase tracking-wider group-hover:text-proton-accent transition-colors">Node Integrity</span>
                       <span className="text-sm font-black text-proton-text font-mono italic">Secure</span>
                    </div>
                    <div className="flex items-center justify-between group">
                       <span className="text-[10px] font-black text-proton-muted uppercase tracking-wider group-hover:text-proton-accent transition-colors">Uptime Target</span>
                       <span className="text-sm font-black text-green-500 font-mono italic">99.9%</span>
                    </div>
                    <button className="w-full mt-6 py-4 rounded-2xl bg-proton-bg/40 border border-proton-border/50 text-[9px] font-black text-proton-muted uppercase tracking-widest hover:border-proton-accent hover:text-proton-accent transition-all shadow-inner">
                       {language === 'ka' ? 'სრული დიაგნოსტიკა' : 'Full Diagnostics'}
                    </button>
                 </div>
              </div>
            </div>
          </motion.div>
        )}

        {cabinetTab === 'modules' && (
          <motion.div 
            key="modules"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {mainModules.map((module) => (
              <button 
                key={module.id} 
                onClick={() => onNavigate(module.id)}
                className="proton-glass p-8 rounded-[40px] border border-proton-border/50 text-left group transition-all relative overflow-hidden hover:border-proton-accent hover:shadow-[0_0_30px_rgba(0,242,255,0.05)] h-full flex flex-col items-start justify-between"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="w-full relative z-10">
                  <div className="flex justify-between items-start mb-8">
                    <div className={cn("w-16 h-16 rounded-[28px] border flex items-center justify-center group-hover:rotate-12 transition-all duration-500 shadow-xl", module.bg, module.border, module.color)}>
                      <module.icon size={28} />
                    </div>
                    {module.badge && (
                      <span className="px-3 py-1 rounded-full bg-proton-accent/10 border border-proton-accent/20 text-[8px] font-black text-proton-accent uppercase tracking-widest italic">{module.badge}</span>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-proton-text mb-2 italic uppercase tracking-tighter">{module.label}</h3>
                  <p className="text-[11px] text-proton-muted font-bold tracking-wide leading-relaxed mb-10 opacity-70 group-hover:opacity-100 transition-opacity">{module.desc}</p>
                </div>
                
                <div className="w-full pt-6 border-t border-proton-border/30 relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.25em] text-proton-accent group-hover:scale-105 transition-transform origin-left">
                    {language === 'ka' ? 'მოდულის გახსნა' : 'Access Hub'}
                    <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform h-3 w-3" />
                  </div>
                  <div className="w-2 h-2 rounded-full bg-proton-accent/20 group-hover:bg-proton-accent transition-colors shadow-sm" />
                </div>
              </button>
            ))}
          </motion.div>
        )}

        {cabinetTab === 'settings' && (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Profile Overview */}
            <div className="lg:col-span-2 space-y-8">
               <div className="proton-glass p-8 sm:p-10 rounded-[40px] border border-proton-border/50 text-left">
                  <h3 className="text-xl font-black text-proton-text uppercase italic tracking-tight mb-8">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-proton-muted uppercase tracking-widest block ml-1">Display Name</label>
                        <div className="flex items-center gap-4 p-5 rounded-2xl bg-proton-bg/40 border border-proton-border/50 group focus-within:border-proton-accent transition-all">
                           <UserIcon size={18} className="text-proton-muted group-focus-within:text-proton-accent" />
                           <span className="text-sm font-black text-proton-text">{user?.displayName || 'Not Set'}</span>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-proton-muted uppercase tracking-widest block ml-1">System Email</label>
                        <div className="flex items-center gap-4 p-5 rounded-2xl bg-proton-bg/40 border border-proton-border/50">
                           <Mail size={18} className="text-proton-muted" />
                           <span className="text-sm font-black text-proton-text truncate">{user?.email || 'N/A'}</span>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-proton-muted uppercase tracking-widest block ml-1">Phone Number</label>
                        <div className="flex items-center gap-4 p-5 rounded-2xl bg-proton-bg/40 border border-proton-border/50">
                           <Phone size={18} className="text-proton-muted" />
                           <span className="text-sm font-black text-proton-text">{profile.phoneNumber || (language === 'ka' ? 'დაუმატებელი' : 'Not Provided')}</span>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-proton-muted uppercase tracking-widest block ml-1">Timezone / Location</label>
                        <div className="flex items-center gap-4 p-5 rounded-2xl bg-proton-bg/40 border border-proton-border/50">
                           <Globe size={18} className="text-proton-muted" />
                           <span className="text-sm font-black text-proton-text italic">UTC+4 / Tbilisi, Georgia</span>
                        </div>
                     </div>
                  </div>
                  <button 
                    onClick={() => onNavigate('settings')}
                    className="mt-12 px-10 py-5 bg-proton-accent text-proton-bg rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:scale-105 transition-all shadow-xl shadow-proton-accent/20 flex items-center gap-3 active:scale-95"
                  >
                     <Settings size={18} />
                     {language === 'ka' ? 'პარამეტრების მართვა' : 'Advanced Configuration'}
                  </button>
               </div>
            </div>

            {/* Account Status Card */}
            <div className="space-y-8 text-left">
               <div className="proton-glass p-8 rounded-[40px] border border-proton-border/50">
                  <div className="flex items-center gap-4 mb-8">
                     <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 border border-proton-accent/20 flex items-center justify-center text-proton-accent">
                        <Star size={24} className="fill-current" />
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">{cab.subscription}</h3>
                        <p className="text-[10px] text-proton-accent font-black uppercase tracking-widest leading-none">PRIME NODE</p>
                     </div>
                  </div>
                  <div className="space-y-4 mb-8">
                     <div className="flex items-center justify-between p-4 rounded-xl bg-proton-bg/30 border border-proton-border/30">
                        <span className="text-[10px] font-black text-proton-muted uppercase tracking-wider">Storage Tier</span>
                        <span className="text-xs font-black text-proton-text italic">Gold Plus</span>
                     </div>
                     <div className="flex items-center justify-between p-4 rounded-xl bg-proton-bg/30 border border-proton-border/30">
                        <span className="text-[10px] font-black text-proton-muted uppercase tracking-wider">AI Priority</span>
                        <span className="text-xs font-black text-proton-text italic">High</span>
                     </div>
                  </div>
                  <button className="w-full py-4 bg-proton-text text-proton-bg rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] transition-all shadow-xl active:scale-95">
                     {language === 'ka' ? 'აბონემენტის შეცვლა' : 'Upgrade Plan'}
                  </button>
               </div>
            </div>
          </motion.div>
        )}

        {cabinetTab === 'security' && (
          <motion.div 
            key="security"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left"
          >
            {/* Security Controls */}
             <div className="proton-glass p-8 sm:p-10 rounded-[40px] border border-proton-border/50 space-y-8">
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-lg shadow-red-500/10">
                      <ShieldAlert size={24} />
                   </div>
                   <div>
                      <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">Access Control</h3>
                      <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest leading-none">System Security</p>
                   </div>
                </div>
                <div className="space-y-4">
                   {[
                     { label: 'Cloud Wallet Auth', active: true, icon: Key },
                     { label: 'Agent Verification', active: true, icon: UserCheck },
                     { label: 'Device Multi-link', active: false, icon: Smartphone },
                     { label: 'Privacy Shield', active: false, icon: Shield },
                   ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-proton-bg/40 border border-proton-border/50 hover:bg-proton-bg transition-colors">
                         <div className="flex items-center gap-4 text-proton-text">
                            <item.icon size={20} className={item.active ? "text-proton-accent" : "text-proton-muted"} />
                            <span className="text-[11px] font-black uppercase tracking-wider">{item.label}</span>
                         </div>
                         <div className={cn("w-12 h-6 rounded-full flex items-center px-1 border transition-all cursor-pointer", item.active ? "bg-proton-accent/20 border-proton-accent/40" : "bg-proton-bg border-proton-border")}>
                            <div className={cn("w-4 h-4 rounded-full shadow-sm transition-all duration-300", item.active ? "translate-x-6 bg-proton-accent shadow-[0_0_8px_rgba(0,242,255,0.8)]" : "bg-proton-muted")} />
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             <div className="proton-glass p-8 sm:p-10 rounded-[40px] border border-proton-border/50 flex flex-col justify-between">
                <div className="space-y-6">
                   <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">Identity Cryptography</h3>
                   <p className="text-[11px] text-proton-muted font-bold leading-relaxed mb-6 italic">
                      Your decentralized identity is secured via a multi-layered cryptographic shield. You can rotate keys or export your full node reputation at any time.
                   </p>
                   <div className="p-6 rounded-3xl bg-proton-accent/5 border border-proton-accent/10 space-y-4">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 text-proton-accent">
                            <Circle size={12} className="fill-current" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Active Keys: 3/3</span>
                         </div>
                         <span className="text-[8px] font-bold text-proton-muted font-mono">ED25519</span>
                      </div>
                      <div className="flex items-center gap-3 text-green-500">
                         <Circle size={12} className="fill-current animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Node Reputation: Excellent</span>
                      </div>
                   </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-12">
                   <button className="flex-1 py-5 px-6 rounded-2xl bg-proton-bg border border-proton-border text-[9px] font-black uppercase tracking-[0.25em] hover:border-proton-accent hover:text-proton-accent transition-all text-center flex items-center justify-center gap-2 active:scale-95">
                      <RefreshCw size={16} />
                      Rotate Keys
                   </button>
                   <button className="flex-1 py-5 px-6 rounded-2xl bg-proton-text text-proton-bg text-[9px] font-black uppercase tracking-[0.25em] hover:opacity-90 transition-all shadow-xl active:scale-95 text-center flex items-center justify-center gap-2">
                      <Lock size={16} />
                      Lock Node
                   </button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CabinetView;
