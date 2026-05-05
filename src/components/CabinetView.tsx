import React, { useState, useMemo } from 'react';
import { 
  Wallet, Workflow, Cpu, FileText, Settings, LogIn, Zap, CheckCircle2, Bell, LogOut, 
  Grid, Layers, Shield, Activity, Database, History, ChevronRight, ArrowRight, 
  ShieldCheck, Fingerprint, Download, ShieldAlert, Key, UserCheck, Circle,
  Mail, MapPin, Phone, Globe, CreditCard, RefreshCw, Smartphone, Star, Clock, Lock, User as UserIcon, Sparkles
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
  stats: { storageGB: number, workHours: number, aiEnergy: number, productivity?: number, node_id?: string, aiTokens: number, computeTimeHours: number };
  onNavigate: (view: any) => void;
  gelRate: number;
}

const CabinetView: React.FC<CabinetViewProps> = ({ 
  profile, 
  setProfile, 
  history,
  customAvatars,
  personas,
  user,
  onSignIn,
  onSignOut,
  uiMode,
  setUiMode,
  stats: userStats,
  onNavigate,
  gelRate
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
    { id: 'device', icon: Cpu, label: language === 'ka' ? 'ინფრასტრუქტურა' : 'Infrastructure', desc: language === 'ka' ? 'სისტემური რესურსების მართვა' : 'System resources management', color: 'text-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-500/5', badge: 'v2.4' },
    { id: 'documentation', icon: FileText, label: language === 'ka' ? 'სახელმძღვანელო' : 'Knowledge', desc: language === 'ka' ? 'სისტემური სახელმძღვანელო' : 'Platform documentation', color: 'text-emerald-500', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
    { id: 'settings', icon: Settings, label: language === 'ka' ? 'გამართვა' : 'Preferences', desc: language === 'ka' ? 'ინტერფეისის კონფიგურაცია' : 'System preferences', color: 'text-slate-500', border: 'border-slate-500/20', bg: 'bg-slate-500/5' },
    { id: 'personas', icon: UserCheck, label: language === 'ka' ? 'გუნდი' : 'Teams', desc: language === 'ka' ? 'ასისტენტების მართვა' : 'Business agents management', color: 'text-red-500', border: 'border-red-500/20', bg: 'bg-red-500/5' },
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
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-[40px] bg-proton-bg border border-proton-border/30 flex items-center justify-center overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-700">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-proton-accent/20">{(user?.displayName || 'U').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 border-4 border-proton-bg rounded-full shadow-lg" />
          </div>
          <div>
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 mb-1">
              <h1 className="text-3xl md:text-5xl font-black text-proton-text tracking-tighter uppercase italic">
                {user?.displayName || (language === 'ka' ? 'მომხმარებელი' : 'User')}
              </h1>
              {user && <CheckCircle2 size={24} className="text-proton-accent" />}
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <p className="text-proton-muted font-bold text-sm md:text-base font-mono">
                {user?.email || (language === 'ka' ? 'სისტემური იდენტიფიკატორი' : 'System ID')}
              </p>
              {user && (
                <span className="px-3 py-1 bg-proton-accent/5 text-[9px] font-black text-proton-accent rounded-full uppercase tracking-[0.2em] border border-proton-border flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-proton-accent" />
                  Account: {userStats.node_id || user.uid.slice(0, 8)}
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
      <div className="flex items-center gap-2 mb-8 bg-proton-card/20 p-1.5 rounded-3xl border border-proton-border/30 overflow-x-auto no-scrollbar relative z-10">
        {[
          { id: 'overview', label: language === 'ka' ? 'მიმოხილვა' : 'Strategic Overview', icon: Grid },
          { id: 'modules', label: language === 'ka' ? 'ხელსაწყოები' : 'Business Management', icon: Layers },
          { id: 'settings', label: language === 'ka' ? 'პროფილი' : 'Individual Profile', icon: Settings },
          { id: 'security', label: language === 'ka' ? 'უსაფრთხოება' : 'Trust & Security', icon: Shield },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setCabinetTab(tab.id as any)}
            className={cn(
              "flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap",
              cabinetTab === tab.id
                ? "bg-proton-text text-proton-bg shadow-xl"
                : "text-proton-muted hover:text-proton-text hover:bg-proton-text/5"
            )}
          >
            <tab.icon size={16} className={cn(cabinetTab === tab.id ? "text-proton-bg" : "text-proton-muted")} />
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
            className="space-y-10"
          >
            {/* TOP ROW: DAILY SUMMARY & SYSTEM MODE */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Daily Summary Card */}
              <div className="lg:col-span-2 bg-proton-card/50 backdrop-blur-md p-8 rounded-[40px] border border-proton-border/30 relative overflow-hidden group">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 flex items-center justify-center text-proton-accent">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-proton-text uppercase italic tracking-tight">{t.daily_summary}</h3>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest mt-1">{t.ai_overview}</p>
                  </div>
                </div>
                
                <div className="prose prose-invert max-w-none">
                  <p className="text-sm text-proton-text/90 italic font-medium leading-relaxed bg-proton-bg/30 p-6 rounded-[32px] border border-proton-border/20">
                    {language === 'ka' 
                      ? `მოგესალმებით, ${user?.displayName || 'მომხმარებელო'}. დღევანდელი ანალიზი აჩვენებს ${userStats.productivity || 0}%-იან ეფექტურობას. თქვენი ფინანსური ბალანსი სტაბილურია ($${(profile.balance || 0).toLocaleString()}), ხოლო რესურსების გამოყენება ოპტიმალურ ფარგლებშია. რეკომენდირებულია გადახედოთ ბოლო დავალებებს და დაასრულოთ სინქრონიზაციის პროცესი.`
                      : `Welcome back, ${user?.displayName || 'User'}. Today's AI analysis shows a ${userStats.productivity || 0}% efficiency rating. Your financial balance is stable at $${(profile.balance || 0).toLocaleString()}, and resource utilization is within optimal parameters. We recommend reviewing your latest tasks and finalizing the sync process.`}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between">
                   <div className="flex -space-x-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-proton-bg bg-proton-accent/20 flex items-center justify-center text-[10px] font-bold text-proton-accent">
                          {i}
                        </div>
                      ))}
                   </div>
                   <button className="text-[10px] font-black uppercase tracking-widest text-proton-accent hover:underline">
                      View full analysis →
                   </button>
                </div>
              </div>

              {/* System Work Mode */}
              <div className="bg-proton-card/50 backdrop-blur-md p-8 rounded-[40px] border border-proton-border/30 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight mb-2">{language === 'ka' ? 'სამუშაო რეჟიმი' : 'System Work Mode'}</h3>
                  <p className="text-[10px] text-proton-muted font-bold uppercase tracking-widest mb-8">{language === 'ka' ? 'აირჩიეთ მიმართულება' : 'Operational Focus'}</p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => handleModeChange('business')}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all",
                        uiMode === 'business' ? "bg-blue-500/10 border-blue-500/30 text-blue-500" : "bg-proton-bg/20 border-proton-border/50 text-proton-muted grayscale hover:grayscale-0"
                      )}
                    >
                       <div className="flex items-center gap-3">
                          <Activity size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ka' ? 'ბიზნესი' : 'Business'}</span>
                       </div>
                       {uiMode === 'business' && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                    </button>
                    <button 
                      onClick={() => handleModeChange('creative')}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all",
                        uiMode === 'creative' ? "bg-proton-accent/10 border-proton-accent/30 text-proton-accent" : "bg-proton-bg/20 border-proton-border/50 text-proton-muted grayscale hover:grayscale-0"
                      )}
                    >
                       <div className="flex items-center gap-3">
                          <Zap size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ka' ? 'კრეატივი' : 'Creative'}</span>
                       </div>
                       {uiMode === 'creative' && <div className="w-2 h-2 rounded-full bg-proton-accent shadow-[0_0_8px_rgba(0,242,255,0.5)]" />}
                    </button>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-proton-border/20">
                   <p className="text-[9px] text-proton-muted font-medium italic">
                      {uiMode === 'business' 
                        ? (language === 'ka' ? 'ოპტიმიზირებულია ანალიტიკისთვის' : 'Optimized for business analytics')
                        : (language === 'ka' ? 'ოპტიმიზირებულია შემოქმედებისთვის' : 'Optimized for creative workflows')}
                   </p>
                </div>
              </div>
            </div>

            {/* ZONE 1: FINANCIALS & STORAGE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Balance Card */}
              <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-proton-accent/5 rounded-full -translate-y-16 translate-x-16 blur-2xl" />
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-proton-accent/10 rounded-xl">
                      <Wallet size={18} className="text-proton-accent" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-proton-muted">Net Liquidity</span>
                  </div>
                  <div className="px-3 py-1 bg-proton-accent/5 rounded-full border border-proton-border text-[8px] font-black text-proton-accent uppercase tracking-widest">USD Asset</div>
                </div>
                <div className="space-y-2 mb-8 relative z-10">
                  <h4 className="text-5xl font-black text-proton-text italic tracking-tighter leading-none">
                    ${(profile.balance || 0).toLocaleString()}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-proton-accent italic">≈ {( (profile.balance || 0) * gelRate ).toLocaleString()}</span>
                    <span className="text-[10px] font-black text-proton-muted uppercase tracking-widest opacity-60">GEL (NBG Sync)</span>
                  </div>
                </div>
                <div className="flex gap-3 relative z-10">
                   <button className="flex-1 py-4 bg-proton-text text-proton-bg rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] transition-all active:scale-95 shadow-lg">Deposit</button>
                   <button className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[9px] font-black text-proton-text uppercase tracking-[0.2em] hover:bg-white/10 transition-all active:scale-95">Withdraw</button>
                </div>
              </div>

              {/* Resource Usage */}
              <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 relative group overflow-hidden">
                <div className="flex items-center gap-3 mb-10">
                  <div className="p-2 bg-blue-500/10 rounded-xl">
                    <Database size={18} className="text-blue-500" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-proton-muted">{t.resource_usage}</span>
                </div>
                <div className="space-y-8">
                  <div>
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-[10px] font-black text-proton-text uppercase tracking-widest">{t.storage}</span>
                      <span className="text-sm font-black text-proton-text font-mono italic">{userStats.storageGB.toFixed(1)} <span className="text-[9px] text-proton-muted">GB</span></span>
                    </div>
                    <div className="h-2 w-full bg-proton-bg/60 rounded-full overflow-hidden border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((userStats.storageGB / 5) * 100, 100)}%` }}
                        className="h-full bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)]" 
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-[10px] font-black text-proton-text uppercase tracking-widest">{t.activity_time}</span>
                      <span className="text-sm font-black text-proton-text font-mono italic">{userStats.workHours.toFixed(1)} <span className="text-[9px] text-proton-muted">H</span></span>
                    </div>
                    <div className="h-2 w-full bg-proton-bg/60 rounded-full overflow-hidden border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '65%' }}
                        className="h-full bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.3)]" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Health */}
              <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 flex flex-col justify-between relative group overflow-hidden">
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-green-500/5 rounded-full translate-y-16 translate-x-16 blur-2xl" />
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="p-2 bg-green-500/10 rounded-xl">
                    <ShieldCheck size={18} className="text-green-500" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-proton-muted">{t.account_health}</span>
                </div>
                <div className="text-center py-6 relative z-10 shadow-inner rounded-[32px] bg-white/5 border border-white/5">
                  <div className="text-5xl font-black text-proton-text italic tracking-tighter mb-1">
                    {profileStrength}%
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500">Tier: Enterprise</p>
                  </div>
                </div>
                <div className="mt-6 relative z-10">
                   <p className="text-[9px] text-proton-muted font-bold uppercase tracking-widest text-center opacity-60 italic">Your account is fully optimized</p>
                </div>
              </div>
            </div>

            {/* ZONE 2: STRATEGIC GROWTH & MASTERY */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                 <h3 className="text-[10px] font-black text-proton-muted uppercase tracking-[0.3em]">{language === 'ka' ? 'სტრატეგიული ზრდა' : 'Strategic Growth & Mastery'}</h3>
                 <span className="text-[9px] font-black text-proton-accent uppercase tracking-widest italic">{language === 'ka' ? 'მიმდინარე ფაზა: ექსპანსია' : 'Current Phase: Expansion'}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 {[
                   { label: language === 'ka' ? 'ბაზრის წილი' : 'Market Presence', progress: 15, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                   { label: language === 'ka' ? 'ავტომატიზაცია' : 'Automation Level', progress: 40, color: 'text-proton-accent', bg: 'bg-proton-accent/10' },
                   { label: language === 'ka' ? 'გუნდის ძალა' : 'Team Synergy', progress: 65, color: 'text-green-500', bg: 'bg-green-500/10' },
                   { label: language === 'ka' ? 'ინოვაცია' : 'Innovation Index', progress: 85, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                 ].map((stat, i) => (
                   <div key={i} className="bg-white/5 backdrop-blur-sm p-6 rounded-[32px] border border-white/5 hover:border-white/20 transition-all group">
                      <div className="flex justify-between items-start mb-4">
                         <span className="text-[9px] font-black text-proton-muted uppercase tracking-widest leading-none">{stat.label}</span>
                         <span className={cn("text-lg font-black italic leading-none", stat.color)}>{stat.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-proton-bg/60 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${stat.progress}%` }}
                          className={cn("h-full rounded-full shadow-[0_0_10px_rgba(255,255,255,0.1)]", stat.bg.replace('/10', ''))}
                        />
                      </div>
                   </div>
                 ))}
              </div>
            </div>

            {/* ZONE 3: CORE ACTIONS */}
            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-proton-muted uppercase tracking-[0.3em] ml-2">{language === 'ka' ? 'მთავარი მოქმედებები' : 'Core Business Units'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { id: 'image', icon: Layers, label: language === 'ka' ? 'სტუდია' : 'Creative Studio', desc: t.studio_desc, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                  { id: 'finance', icon: CreditCard, label: language === 'ka' ? 'ფინანსები' : 'Financial Hub', desc: t.finance_desc, color: 'text-green-500', bg: 'bg-green-500/10' },
                  { id: 'translator', icon: Globe, label: language === 'ka' ? 'თარგმნა' : 'Global Comms', desc: language === 'ka' ? 'მულტილინგვალური კომუნიკაცია' : 'Multilingual Communication', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                ].map(action => (
                  <button 
                    key={action.id}
                    onClick={() => onNavigate(action.id)}
                    className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 hover:border-proton-accent/50 transition-all group text-left flex flex-col justify-between h-64 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-700" />
                    <div className="relative z-10">
                      <div className={cn("w-16 h-16 rounded-[24px] flex items-center justify-center mb-6 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-xl shadow-black/20", action.bg, action.color)}>
                        <action.icon size={28} />
                      </div>
                      <h4 className="text-2xl font-black text-proton-text uppercase italic tracking-tighter mb-2">{action.label}</h4>
                      <p className="text-[11px] text-proton-muted font-bold leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">{action.desc}</p>
                    </div>
                    <div className="relative z-10 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-proton-accent group-hover:gap-4 transition-all pt-4 border-t border-white/5 mt-4">
                       Launch Unit
                       <ArrowRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ZONE 4: RECENT ACTIVITY & SYSTEM STATUS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Activity Feed */}
              <div className="lg:col-span-2 bg-white/5 backdrop-blur-md p-8 rounded-[40px] border border-white/10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <History size={20} className="text-proton-muted" />
                    <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">{t.activity}</h3>
                  </div>
                  <span className="text-[9px] font-black text-proton-muted uppercase tracking-widest">{language === 'ka' ? 'ბოლო 5 ქმედება' : 'Last 5 Actions'}</span>
                </div>
                <div className="space-y-3">
                  {[...recentActivity, { id: 4, label: t.tasks_completed, time: '18:30', date: '26 APR', icon: CheckCircle2, color: 'text-proton-accent', bg: 'bg-proton-accent/10' }, { id: 5, label: language === 'ka' ? 'სისტემური განახლება' : 'System Sync', time: '17:45', date: '26 APR', icon: RefreshCw, color: 'text-amber-500', bg: 'bg-amber-500/10' }].map(act => (
                    <div key={act.id} className="flex items-center justify-between p-4 rounded-[28px] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", act.bg, act.color)}>
                          <act.icon size={20} />
                        </div>
                        <div>
                          <p className="text-[12px] font-black text-proton-text uppercase tracking-tight">{act.label}</p>
                          <p className="text-[10px] text-proton-muted font-bold font-mono opacity-60">{act.time} • {act.date}</p>
                        </div>
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-proton-bg/40 border border-white/5 text-[8px] font-black text-proton-muted uppercase tracking-widest group-hover:text-proton-accent group-hover:border-proton-accent/30 transition-all">
                         View Details
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Stats (Refined Jargon) */}
              <div className="bg-white/5 backdrop-blur-md p-8 rounded-[40px] border border-white/10">
                 <div className="flex items-center justify-between mb-10">
                    <h3 className="text-xs font-black text-proton-text uppercase tracking-[0.3em] italic">{t.health}</h3>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                       <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">{cab.connected || 'Live'}</span>
                    </div>
                 </div>
                 <div className="space-y-6">
                    <div className="p-5 rounded-3xl bg-white/5 border border-white/5 space-y-4">
                       <div className="flex items-center justify-between group">
                          <span className="text-[10px] font-black text-proton-muted uppercase tracking-widest transition-colors">{t.health}</span>
                          <span className="text-sm font-black text-proton-text font-mono italic">Optimal</span>
                       </div>
                       <div className="flex items-center justify-between group">
                          <span className="text-[10px] font-black text-proton-muted uppercase tracking-widest transition-colors">{t.tasks_completed}</span>
                          <span className="text-sm font-black text-proton-text font-mono italic">1,240</span>
                       </div>
                       <div className="flex items-center justify-between group">
                          <span className="text-[10px] font-black text-proton-muted uppercase tracking-widest transition-colors">{t.account_health}</span>
                          <span className="text-sm font-black text-green-500 font-mono italic">Secure</span>
                       </div>
                    </div>
                    
                    <div className="pt-2">
                       <button className="w-full py-4 rounded-2xl bg-proton-text text-proton-bg text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] transition-all shadow-xl active:scale-95">
                          {language === 'ka' ? 'სრული დიაგნოსტიკა' : 'Full System Audit'}
                       </button>
                    </div>
                 </div>
                 
                 <div className="mt-8 p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-proton-accent/10 flex items-center justify-center text-proton-accent">
                       <Shield size={16} />
                    </div>
                    <p className="text-[9px] text-proton-muted font-bold leading-tight uppercase tracking-tight">Your data is secured by enterprise-grade encryption protocols.</p>
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
                
                <div className="w-full pt-6 border-t border-white/10 relative z-10 flex items-center justify-between">
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
               <div className="bg-white/5 backdrop-blur-xl p-8 sm:p-10 rounded-[40px] border border-white/10 text-left">
                  <h3 className="text-xl font-black text-proton-text uppercase italic tracking-tight mb-8">Account Profile</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-proton-muted uppercase tracking-widest block ml-1">Full Name</label>
                        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 group focus-within:border-proton-accent transition-all shadow-inner">
                           <UserIcon size={18} className="text-proton-muted group-focus-within:text-proton-accent" />
                           <span className="text-sm font-black text-proton-text">{user?.displayName || 'Not Set'}</span>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-proton-muted uppercase tracking-widest block ml-1">Work Email</label>
                        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 shadow-inner">
                           <Mail size={18} className="text-proton-muted" />
                           <span className="text-sm font-black text-proton-text truncate">{user?.email || 'N/A'}</span>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-proton-muted uppercase tracking-widest block ml-1">Contact Number</label>
                        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 shadow-inner">
                           <Phone size={18} className="text-proton-muted" />
                           <span className="text-sm font-black text-proton-text">{profile.phoneNumber || (language === 'ka' ? 'დაუმატებელი' : 'Not Provided')}</span>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-proton-muted uppercase tracking-widest block ml-1">Primary Location</label>
                        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 shadow-inner">
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
                     {language === 'ka' ? 'პარამეტრების მართვა' : 'System Configuration'}
                  </button>
               </div>
            </div>

            {/* Account Status Card */}
            <div className="space-y-8 text-left">
               <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10">
                  <div className="flex items-center gap-4 mb-8">
                     <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 border border-proton-accent/20 flex items-center justify-center text-proton-accent">
                        <Star size={24} className="fill-current" />
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">{cab.subscription}</h3>
                        <p className="text-[10px] text-proton-accent font-black uppercase tracking-widest leading-none">PRIME SESSION</p>
                     </div>
                  </div>
                  <div className="space-y-4 mb-8">
                     <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                        <span className="text-[10px] font-black text-proton-muted uppercase tracking-wider">Service Tier</span>
                        <span className="text-xs font-black text-proton-text italic">Premium Plus</span>
                     </div>
                     <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                        <span className="text-[10px] font-black text-proton-muted uppercase tracking-wider">AI Support</span>
                        <span className="text-xs font-black text-proton-text italic">Priority</span>
                     </div>
                  </div>
                  <button className="w-full py-4 bg-proton-text text-proton-bg rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] transition-all shadow-xl active:scale-95">
                     {language === 'ka' ? 'აბონემენტის შეცვლა' : 'Update Subscription'}
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
             <div className="bg-white/5 backdrop-blur-xl p-8 sm:p-10 rounded-[40px] border border-white/10 space-y-8">
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-lg shadow-red-500/10">
                      <ShieldAlert size={24} />
                   </div>
                   <div>
                      <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">Access Control</h3>
                      <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest leading-none">Account Privacy</p>
                   </div>
                </div>
                <div className="space-y-4">
                   {[
                     { label: 'Cloud Wallet Auth', active: true, icon: Key },
                     { label: 'Identity Verification', active: true, icon: UserCheck },
                     { label: 'Device Synergy', active: false, icon: Smartphone },
                     { label: 'Privacy Shield', active: false, icon: Shield },
                   ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
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

             <div className="bg-white/5 backdrop-blur-xl p-8 sm:p-10 rounded-[40px] border border-white/10 flex flex-col justify-between">
                <div className="space-y-6">
                   <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">Security Credentials</h3>
                   <p className="text-[11px] text-proton-muted font-bold leading-relaxed mb-6 italic">
                      Your identity is protected by industry-standard encryption. You can refresh your security credentials or export your account audit history at any time.
                   </p>
                   <div className="p-6 rounded-3xl bg-proton-accent/5 border border-proton-accent/10 space-y-4">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 text-proton-accent">
                            <Circle size={12} className="fill-current" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Active Sessions: 3</span>
                         </div>
                         <span className="text-[8px] font-bold text-proton-muted font-mono">SECURED</span>
                      </div>
                      <div className="flex items-center gap-3 text-green-500">
                         <Circle size={12} className="fill-current animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Account Health: Excellent</span>
                      </div>
                   </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-12">
                   <button className="flex-1 py-5 px-6 rounded-2xl bg-white/5 border border-white/10 text-[9px] font-black text-proton-text uppercase tracking-[0.25em] hover:bg-white/10 transition-all text-center flex items-center justify-center gap-2 active:scale-95">
                      <RefreshCw size={16} />
                      Refresh Access
                   </button>
                   <button className="flex-1 py-5 px-6 rounded-2xl bg-proton-text text-proton-bg text-[9px] font-black uppercase tracking-[0.25em] hover:opacity-90 transition-all shadow-xl active:scale-95 text-center flex items-center justify-center gap-2">
                       <Lock size={16} />
                       Lock Account
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
