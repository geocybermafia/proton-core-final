import React, { useState, useMemo } from 'react';
import { 
  Workflow, Cpu, FileText, Settings, Zap, CheckCircle2, Bell, LogOut, 
  Grid, Layers, Shield, Activity, Database, History, ArrowRight, 
  ShieldCheck, UserCheck, CreditCard, Sparkles, User as UserIcon, Star, Lock, Phone, Mail, Globe,
  Fingerprint, ShieldAlert
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
  const t = translations[language].cabinet;
  
  const personal = {
    title: language === 'ka' ? 'პირადი სამუშაო სივრცე' : 'Personal Workspace',
    overview: language === 'ka' ? 'ოპერაციული მიმოხილვა' : 'Operational Overview',
    dash_title: language === 'ka' ? 'მართვის ჰაბი' : 'Control Hub'
  };

  const [cabinetTab, setCabinetTab] = useState<'overview' | 'modules' | 'security' | 'settings'>('overview');

  const isBusiness = uiMode === 'business';

  const businessModules = [
    { id: 'blueprints', icon: Workflow, label: language === 'ka' ? 'პროცესები' : 'Workflows', desc: t.blueprints_desc, color: 'text-white', border: 'border-white/20', bg: 'bg-white/5', badge: language === 'ka' ? 'Beta' : 'Beta' },
    { id: 'device', icon: Cpu, label: language === 'ka' ? 'ინფრასტრუქტურა' : 'Infrastructure', desc: language === 'ka' ? 'სისტემური რესურსების მართვა' : 'System resources management', color: 'text-white', border: 'border-white/20', bg: 'bg-white/5' },
    { id: 'documentation', icon: FileText, label: language === 'ka' ? 'სახელმძღვანელო' : 'Knowledge', desc: language === 'ka' ? 'სისტემური სახელმძღვანელო' : 'Platform documentation', color: 'text-white', border: 'border-white/20', bg: 'bg-white/5' },
  ];

  const creativeModules = [
    { id: 'image', icon: Layers, label: language === 'ka' ? 'სტუდია' : 'Studio', desc: t.studio_desc, color: 'text-proton-accent', border: 'border-proton-accent/20', bg: 'bg-proton-accent/5', badge: 'PRO' },
    { id: 'personas', icon: UserCheck, label: language === 'ka' ? 'გუნდი' : 'Teams', desc: language === 'ka' ? 'ასისტენტების მართვა' : 'AI Business Agents', color: 'text-proton-accent', border: 'border-proton-accent/20', bg: 'bg-proton-accent/5' },
    { id: 'documentation', icon: FileText, label: language === 'ka' ? 'სახელმძღვანელო' : 'Library', desc: language === 'ka' ? 'სისტემური სახელმძღვანელო' : 'Creative Resources', color: 'text-proton-accent', border: 'border-proton-accent/20', bg: 'bg-proton-accent/5' },
    { id: 'settings', icon: Settings, label: language === 'ka' ? 'გამართვა' : 'Preferences', desc: language === 'ka' ? 'ინტერფეისის კონფიგურაცია' : 'Workspace settings', color: 'text-proton-accent', border: 'border-proton-accent/20', bg: 'bg-proton-accent/5' },
  ];

  const mainModules = isBusiness ? businessModules : creativeModules;

  const quickActions = isBusiness ? [
    { id: 'blueprints', icon: Workflow, label: language === 'ka' ? 'პროცესები' : 'Scripts', color: 'bg-slate-200' },
    { id: 'device', icon: Cpu, label: language === 'ka' ? 'ინფრასტრუქტურა' : 'Nodes', color: 'bg-slate-300' },
  ] : [
    { id: 'studio', icon: Layers, label: language === 'ka' ? 'სტუდია' : 'Studio', color: 'bg-proton-accent' },
    { id: 'personas', icon: UserCheck, label: language === 'ka' ? 'გუნდი' : 'Agents', color: 'bg-cyan-400' },
  ];

  const businessActivity = [
    { id: 1, type: 'system', label: language === 'ka' ? 'სისტემური სინქრონიზაცია' : 'System Core Sync', time: '10:42', date: '28 APR', icon: Workflow, color: 'text-white', bg: 'bg-white/10' },
    { id: 2, type: 'module', label: language === 'ka' ? 'სისტემური აუდიტი' : 'System Integrity Audit', time: '09:15', date: '28 APR', icon: ShieldCheck, color: 'text-white', bg: 'bg-white/10' },
    { id: 3, type: 'system', label: language === 'ka' ? 'სარეზერვო ასლი' : 'Infrastructure Backup', time: '14:20', date: '27 APR', icon: Database, color: 'text-white', bg: 'bg-white/10' },
  ];

  const creativeActivity = [
    { id: 1, type: 'ai', label: language === 'ka' ? 'AI გენერაცია' : 'Neural Core Push', time: '10:42', date: '28 APR', icon: Zap, color: 'text-proton-accent', bg: 'bg-proton-accent/10' },
    { id: 2, type: 'studio', label: language === 'ka' ? 'დიზაინის ექსპორტი' : 'Studio Asset Render', time: '09:15', date: '28 APR', icon: Layers, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    { id: 3, type: 'persona', label: language === 'ka' ? 'აგენტის სინქრონიზაცია' : 'Agent Persona Sync', time: '14:20', date: '27 APR', icon: Sparkles, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  ];

  const recentActivity = isBusiness ? businessActivity : creativeActivity;

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
      <div className={cn(
        "flex items-center gap-2 mb-8 p-1.5 rounded-3xl border overflow-x-auto no-scrollbar relative z-10",
        isBusiness ? "bg-white/5 border-white/10" : "bg-proton-card/20 border-proton-border/30"
      )}>
        {[
          { id: 'overview', label: isBusiness ? (language === 'ka' ? 'მიმოხილვა' : 'Strategic Overview') : (language === 'ka' ? 'ჰაბი' : 'Creative Hub'), icon: isBusiness ? Grid : Sparkles },
          { id: 'modules', label: isBusiness ? (language === 'ka' ? 'ბიზნეს მენეჯმენტი' : 'Asset Management') : (language === 'ka' ? 'სტუდია' : 'Studio Engine'), icon: Layers },
          { id: 'settings', label: isBusiness ? (language === 'ka' ? 'პროფილი' : 'Corporate Identity') : (language === 'ka' ? 'პროფილი' : 'Creator Profile'), icon: Settings },
          { id: 'security', label: isBusiness ? (language === 'ka' ? 'უსაფრთხოება' : 'Risk & Trust') : (language === 'ka' ? 'უსაფრთხოება' : 'Secure Core'), icon: Shield },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setCabinetTab(tab.id as any)}
            className={cn(
              "flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap",
              cabinetTab === tab.id
                ? (isBusiness ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "bg-proton-text text-proton-bg shadow-xl")
                : (isBusiness ? "text-white/40 hover:text-white hover:bg-white/5" : "text-proton-muted hover:text-proton-text hover:bg-proton-text/5")
            )}
          >
            <tab.icon size={16} className={cn(cabinetTab === tab.id ? (isBusiness ? "text-black" : "text-proton-bg") : "text-proton-muted")} />
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Display Card */}
              <div className={cn(
                "lg:col-span-2 p-8 rounded-[40px] border relative overflow-hidden group transition-all duration-700",
                isBusiness 
                  ? "bg-white text-black border-white shadow-[0_0_50px_rgba(255,255,255,0.05)]" 
                  : "bg-proton-card/50 backdrop-blur-md border-proton-border/30 text-proton-text"
              )}>
                <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    isBusiness ? "bg-black text-white" : "bg-proton-accent/10 text-proton-accent"
                  )}>
                    {isBusiness ? <Activity size={24} /> : <Sparkles size={24} />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tight">{isBusiness ? (language === 'ka' ? 'ბიზნეს რეზიუმე' : 'Executive Summary') : t.daily_summary}</h3>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest mt-1", isBusiness ? "text-black/40" : "text-proton-muted")}>
                      {isBusiness ? (language === 'ka' ? 'ოპერაციული ანალიზი' : 'Performance Metrics') : t.ai_overview}
                    </p>
                  </div>
                </div>
                
                <div className="prose prose-invert max-w-none relative z-10">
                  <p className={cn(
                    "text-sm italic font-medium leading-relaxed p-6 rounded-[32px] border transition-all",
                    isBusiness 
                      ? "bg-black/5 border-black/10 text-black leading-loose" 
                      : "bg-proton-bg/30 border-proton-border/20 text-proton-text/90"
                  )}>
                    {isBusiness 
                      ? (language === 'ka' 
                        ? `სალამი, ${user?.displayName || 'მომხმარებელო'}. კვარტალური ანალიზის მიხედვით თქვენი სისტემური ეფექტურობა გაზრდილია 12.4%-ით. ინფრასტრუქტურა მზად არის ახალი პროცესებისა და აუდიტისთვის. დაფიქსირებულია ოპტიმალური სტაბილურობა.`
                        : `Executive Update, ${user?.displayName || 'User'}. Quarterly performance metrics indicate a 12.4% surge in operational efficiency. Your system infrastructure remains optimal. The core is primed for new workflow management and platform audits.`)
                      : (language === 'ka' 
                        ? `მოგესალმებით, ${user?.displayName || 'მომხმარებელო'}. თქვენი შემოქმედებითი ენერგია მაქსიმალურ ნიშნულზეა. AI გენერაციის ეფექტურობა შეადგენს ${userStats.productivity || 0}%-ს. Persona-ების სინქრონიზაცია დასრულებულია. სტუდია მზად არის ახალი პროექტებისთვის.`
                        : `Welcome back, ${user?.displayName || 'User'}. Your creative flow is at its peak. AI synergy rating is currently ${userStats.productivity || 0}%. Persona synchronization is complete. The Studio is ready for your next high-impact project.`)}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between relative z-10">
                   <div className="flex -space-x-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={cn(
                          "w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold",
                          isBusiness ? "bg-black border-white text-white" : "border-proton-bg bg-proton-accent/20 text-proton-accent"
                        )}>
                          {i}
                        </div>
                      ))}
                   </div>
                   <button className={cn(
                     "text-[10px] font-black uppercase tracking-widest hover:underline",
                     isBusiness ? "text-black" : "text-proton-accent"
                   )}>
                      {isBusiness ? 'Full Report →' : 'View full analysis →'}
                   </button>
                </div>
              </div>

              {/* Mode Toggle & System Info */}
              <div className={cn(
                "p-8 rounded-[40px] border flex flex-col justify-between transition-all duration-700",
                isBusiness 
                  ? "bg-slate-100 border-black/20" 
                  : "bg-proton-card/50 backdrop-blur-md border-proton-border/30"
              )}>
                <div>
                  <h3 className={cn("text-lg font-black uppercase italic tracking-tight mb-2", isBusiness ? "text-black" : "text-proton-text")}>
                    {language === 'ka' ? 'სისტემური რეჟიმი' : 'Operational Focus'}
                  </h3>
                  <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-8", isBusiness ? "text-black/40" : "text-proton-muted")}>
                    {language === 'ka' ? 'მიმდინარე პრიორიტეტი' : 'Active Priority'}
                  </p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => handleModeChange('business')}
                      className={cn(
                        "flex items-center justify-between p-5 rounded-2xl border transition-all",
                        uiMode === 'business' 
                          ? "bg-black border-black text-white shadow-xl translate-x-2" 
                          : "bg-white/40 border-black/5 text-black/40 grayscale hover:grayscale-0 hover:border-black/20"
                      )}
                    >
                       <div className="flex items-center gap-3">
                          <CreditCard size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ka' ? 'ბიზნესი' : 'Business Terminal'}</span>
                       </div>
                       {uiMode === 'business' && <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />}
                    </button>
                    <button 
                      onClick={() => handleModeChange('creative')}
                      className={cn(
                        "flex items-center justify-between p-5 rounded-2xl border transition-all",
                        uiMode === 'creative' 
                          ? "bg-proton-accent text-proton-bg border-proton-accent shadow-[0_0_20px_rgba(0,242,255,0.3)] -translate-x-2" 
                          : "bg-proton-bg/20 border-proton-border/50 text-proton-muted grayscale hover:grayscale-0 hover:border-proton-accent/30"
                      )}
                    >
                       <div className="flex items-center gap-3">
                          <Sparkles size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ka' ? 'კრეატივი' : 'Creative Studio'}</span>
                       </div>
                       {uiMode === 'creative' && <div className="w-2 h-2 rounded-full bg-proton-bg shadow-[0_0_10px_rgba(0,242,255,0.8)]" />}
                    </button>
                  </div>
                </div>

                <div className={cn("mt-8 pt-6 border-t", isBusiness ? "border-black/5" : "border-proton-border/20")}>
                   <p className={cn("text-[9px] font-bold italic uppercase tracking-wider", isBusiness ? "text-black/60" : "text-proton-muted")}>
                      {uiMode === 'business' 
                        ? (language === 'ka' ? 'ბიზნესის ავტომატიზაცია: ჩართულია' : 'Process Automation: Active')
                        : (language === 'ka' ? 'კრეატიული ჰაბი: აქტიური' : 'Creative Engine: Online')}
                   </p>
                </div>
              </div>
            </div>

            {/* ZONE 1: PRIMARY METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {isBusiness ? (
                <>
                  <div className="bg-white p-8 rounded-[40px] border border-black group overflow-hidden shadow-[10px_10px_0px_0px_#000]">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-black rounded-xl text-white">
                          <Cpu size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black">Core Compute</span>
                      </div>
                      <div className="px-3 py-1 bg-black text-white rounded-full text-[8px] font-black uppercase tracking-widest">ACTIVE</div>
                    </div>
                    <div className="space-y-2 mb-8">
                      <h4 className="text-6xl font-black text-black italic tracking-tighter leading-none pulse-strong">
                        {userStats.computeTimeHours.toFixed(1)}H
                      </h4>
                      <p className="text-[10px] font-black text-black/40 uppercase tracking-widest">Platform Allocation</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => onNavigate('device')} className="flex-1 py-4 bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-95">Monitor</button>
                       <button onClick={() => onNavigate('blueprints')} className="flex-1 py-4 bg-white border border-black rounded-xl text-[9px] font-black text-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all active:scale-95">Optimize</button>
                    </div>
                  </div>

                  <div className="bg-slate-100 p-8 rounded-[40px] border border-black/10 flex flex-col justify-between">
                     <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-black/5 rounded-xl">
                          <Globe size={18} className="text-black" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/60">Node Status</span>
                     </div>
                     <div className="space-y-6">
                        <div>
                           <div className="flex justify-between mb-2">
                              <span className="text-[10px] font-black uppercase tracking-widest">Efficiency</span>
                              <span className="text-xs font-black italic">Peak Performance</span>
                           </div>
                           <div className="h-1 bg-black/10 rounded-full overflow-hidden">
                              <div className="h-full bg-black w-[85%]" />
                           </div>
                        </div>
                        <div>
                           <div className="flex justify-between mb-2">
                              <span className="text-[10px] font-black uppercase tracking-widest">Stability</span>
                              <span className="text-xs font-black italic">Stable</span>
                           </div>
                           <div className="h-1 bg-black/10 rounded-full overflow-hidden">
                              <div className="h-full bg-black w-[60%]" />
                           </div>
                        </div>
                     </div>
                     <div className="mt-8 text-[9px] font-black text-black/30 uppercase tracking-[0.2em] italic">System Sync: Real-time</div>
                  </div>

                  <div className="bg-black p-8 rounded-[40px] border border-white/20 text-white flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
                     <div className="flex items-center gap-3 mb-6">
                        <ShieldCheck size={20} className="text-white" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Security Integrity</span>
                     </div>
                     <div className="text-center py-6">
                        <div className="text-5xl font-black italic tracking-tighter mb-1 text-white">SECURE</div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Verified Infrastructure</p>
                     </div>
                     <button className="w-full py-4 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-[0.2em] font-mono">Verify Identity</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 relative group overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-proton-accent/20 rounded-full -translate-y-16 translate-x-16 blur-2xl" />
                    <div className="flex items-center justify-between mb-8 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-proton-accent/20 rounded-xl shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                          <Zap size={18} className="text-proton-accent" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-proton-muted">Creative Energy</span>
                      </div>
                      <div className="px-3 py-1 bg-proton-accent/5 rounded-full border border-proton-border text-[8px] font-black text-proton-accent uppercase tracking-widest">Neural Link</div>
                    </div>
                    <div className="space-y-2 mb-8 relative z-10">
                      <h4 className="text-6xl font-black text-proton-text italic tracking-tighter leading-none">
                        {userStats.aiTokens.toLocaleString()}
                      </h4>
                      <p className="text-[10px] font-black text-proton-accent uppercase tracking-widest">Active Sync Units</p>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 mt-4">
                       <motion.div animate={{ width: '75%' }} className="h-full bg-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.5)]" />
                    </div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 relative group">
                    <div className="flex items-center gap-3 mb-10">
                      <div className="p-2 bg-cyan-500/10 rounded-xl">
                        <Database size={18} className="text-cyan-500" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-proton-muted">Core Resources</span>
                    </div>
                    <div className="space-y-8">
                      <div>
                        <div className="flex justify-between items-end mb-3">
                          <span className="text-[10px] font-black text-proton-text uppercase tracking-widest">Neural Cache</span>
                          <span className="text-sm font-black text-proton-text font-mono italic">{userStats.storageGB.toFixed(1)} GB</span>
                        </div>
                        <div className="h-2 w-full bg-proton-bg/60 rounded-full overflow-hidden border border-white/5">
                          <motion.div animate={{ width: `${Math.min((userStats.storageGB / 5) * 100, 100)}%` }} className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-end mb-3">
                          <span className="text-[10px] font-black text-proton-text uppercase tracking-widest">Compute Time</span>
                          <span className="text-sm font-black text-proton-text font-mono italic">{userStats.computeTimeHours.toFixed(1)} H</span>
                        </div>
                        <div className="h-2 w-full bg-proton-bg/60 rounded-full overflow-hidden border border-white/5">
                          <motion.div animate={{ width: '45%' }} className="h-full bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 flex flex-col justify-between relative group overflow-hidden">
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-proton-accent/5 rounded-full translate-y-16 translate-x-16 blur-2xl" />
                    <div className="flex items-center gap-3 mb-6 relative z-10">
                      <div className="p-2 bg-green-500/10 rounded-xl">
                        <Sparkles size={18} className="text-green-500" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-proton-muted">Persona Synergy</span>
                    </div>
                    <div className="text-center py-6 relative z-10 rounded-[32px] bg-white/5 border border-white/5 shadow-inner">
                      <div className="text-5xl font-black text-proton-text italic tracking-tighter mb-1">
                        {profileStrength}%
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500">Tier: Creator Professional</p>
                      </div>
                    </div>
                    <button className="w-full mt-6 py-4 bg-proton-accent text-proton-bg rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] shadow-[0_10px_20px_rgba(0,242,255,0.2)]">Level Up Hub</button>
                  </div>
                </>
              )}
            </div>

            {/* ZONE 2: LOGS & GRIDS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               {isBusiness ? (
                 <div className="lg:col-span-3 bg-white p-8 rounded-[40px] border border-black shadow-[10px_10px_0px_0px_#000]">
                    <div className="flex items-center justify-between mb-8 border-b border-black/5 pb-6">
                       <div>
                          <h3 className="text-2xl font-black italic uppercase tracking-tighter">System Blueprint Logs</h3>
                          <p className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Operational History & Logic Audits</p>
                       </div>
                       <button onClick={() => onNavigate('blueprints')} className="px-6 py-3 border border-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">Audit Workspace</button>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full text-left">
                          <thead>
                             <tr className="border-b border-black/10">
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/50">Unit</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/50">Operation</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/50">Status</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/50">Performance</th>
                                <th className="pb-4 text-right text-[10px] font-black uppercase tracking-widest text-black/50">Timestamp</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-black/5">
                             {[
                               { unit: 'Compute-01', op: 'Resource Allocation', status: 'Success', performance: '100%', time: 'HH:42:01' },
                               { unit: 'Infra-Node', op: 'System Sync', status: 'Pending', performance: '98%', time: 'HH:15:20' },
                               { unit: 'Strategy-AI', op: 'Workflow Analysis', status: 'Success', performance: 'Optimum', time: 'HH:05:11' },
                             ].map((row, i) => (
                               <tr key={i} className="hover:bg-black/5 transition-colors group">
                                  <td className="py-4 font-black italic text-sm">{row.unit}</td>
                                  <td className="py-4 font-black uppercase text-[10px] tracking-tight">{row.op}</td>
                                  <td className="py-4">
                                     <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase",
                                        row.status === 'Success' ? "bg-black text-white" : "bg-slate-200 text-black/40"
                                     )}>{row.status}</span>
                                  </td>
                                  <td className="py-4 font-mono text-[10px] font-bold">{row.performance}</td>
                                  <td className="py-4 text-right font-mono text-[9px] text-black/40">{row.time}</td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>
               ) : (
                  <div className="lg:col-span-3 space-y-8">
                     <div className="flex items-center justify-between px-2">
                        <h3 className="text-[10px] font-black text-proton-muted uppercase tracking-[0.3em]">Active AI Personas</h3>
                        <button onClick={() => onNavigate('personas')} className="text-[10px] font-black text-proton-accent uppercase tracking-widest italic hover:underline flex items-center gap-2">
                           Direct Management <ArrowRight size={14} />
                        </button>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {personas.slice(0, 4).map((p, i) => (
                          <div key={i} className="bg-white/5 backdrop-blur-xl p-6 rounded-[32px] border border-white/10 group hover:border-proton-accent/50 transition-all text-center">
                             <div className="relative w-16 h-16 mx-auto mb-4">
                                <div className="absolute inset-0 bg-proton-accent/20 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                                <img 
                                  src={customAvatars[p.id] || p.avatar} 
                                  className="w-16 h-16 rounded-2xl object-cover relative z-10 border border-white/20 group-hover:rotate-6 transition-all" 
                                  alt={p.name} 
                                />
                             </div>
                             <h4 className="text-xs font-black text-proton-text uppercase tracking-widest mb-1">{p.name}</h4>
                             <p className="text-[9px] text-proton-muted font-bold italic mb-4">{p.role}</p>
                             <div className="flex items-center justify-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                <span className="text-[8px] font-black text-proton-muted uppercase tracking-widest italic">Stable Link</span>
                             </div>
                          </div>
                        ))}
                        <button onClick={() => onNavigate('personas')} className="bg-white/5 border border-dashed border-white/20 rounded-[32px] flex flex-col items-center justify-center gap-2 group hover:border-proton-accent/50 transition-all min-h-[180px]">
                           <div className="w-10 h-10 rounded-full bg-proton-accent/10 flex items-center justify-center text-proton-accent group-hover:scale-110 transition-transform">
                              <Sparkles size={20} />
                           </div>
                           <span className="text-[10px] font-black text-proton-muted uppercase tracking-widest">Spawn Agent</span>
                        </button>
                     </div>
                  </div>
               )}
            </div>

            {/* ZONE 3: QUICK ACTIONS */}
            <div className="space-y-6">
              <h3 className={cn("text-[10px] font-black uppercase tracking-[0.3em] ml-2", isBusiness ? "text-black/40" : "text-proton-muted")}>
                {isBusiness ? 'Platform Units' : 'Creative Modules'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(isBusiness ? [
                  { id: 'blueprints', icon: Workflow, label: 'Logic Sync', desc: 'Coordinate corporate workflows and logic schemas.', color: 'text-black', bg: 'bg-white' },
                  { id: 'device', icon: Cpu, label: 'Resources', desc: 'Monitor infrastructure health and unit allocation.', color: 'text-white', bg: 'bg-black' },
                  { id: 'documentation', icon: FileText, label: 'Knowledge', desc: 'Browse system documentation and platform resources.', color: 'text-black', bg: 'bg-slate-200' },
                ] : [
                  { id: 'studio', icon: Layers, label: 'Studio Base', desc: 'Generate multi-modal content and visual assets.', color: 'text-proton-accent', bg: 'bg-proton-accent/10' },
                  { id: 'personas', icon: UserCheck, label: 'Persona Hub', desc: 'Configure and communicate with your AI agents.', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
                  { id: 'documentation', icon: FileText, label: 'Knowledge Base', desc: 'Browse creative documentation and library assets.', color: 'text-purple-400', bg: 'bg-purple-400/10' },
                ]).map(action => (
                  <button 
                    key={action.id}
                    onClick={() => onNavigate(action.id)}
                    className={cn(
                      "p-8 rounded-[40px] border group text-left flex flex-col justify-between h-64 relative overflow-hidden transition-all duration-500",
                      isBusiness 
                        ? "bg-white border-black hover:shadow-[10px_10px_0px_0px_#000] hover:-translate-y-1 hover:-translate-x-1" 
                        : "bg-white/5 backdrop-blur-xl border-white/10 hover:border-proton-accent/50"
                    )}
                  >
                    <div className="relative z-10">
                      <div className={cn(
                        "w-16 h-16 rounded-[24px] flex items-center justify-center mb-6 transition-transform group-hover:scale-110",
                        action.bg, action.color, isBusiness && "border border-black"
                      )}>
                        <action.icon size={28} />
                      </div>
                      <h4 className={cn("text-2xl font-black uppercase italic tracking-tighter mb-2", isBusiness ? "text-black" : "text-proton-text")}>{action.label}</h4>
                      <p className={cn("text-[11px] font-bold leading-relaxed opacity-60", isBusiness ? "text-black" : "text-proton-muted")}>{action.desc}</p>
                    </div>
                    <div className={cn(
                      "relative z-10 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] transition-all pt-4 border-t mt-4",
                      isBusiness ? "text-black border-black/5" : "text-proton-accent border-white/5"
                    )}>
                       {isBusiness ? 'Enter Unit' : 'Launch Engine'}
                       <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ZONE 4: ACTIVITY SUMMARY */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className={cn(
                 "lg:col-span-2 p-8 rounded-[40px] border transition-all duration-700",
                 isBusiness ? "bg-white border-black" : "bg-white/5 border-white/10"
               )}>
                  <div className="flex items-center justify-between mb-8">
                     <h3 className={cn("text-lg font-black uppercase italic tracking-tight", isBusiness ? "text-black" : "text-proton-text")}>Operational Logs</h3>
                     <span className={cn("text-[8px] font-black uppercase tracking-widest", isBusiness ? "text-black/40" : "text-proton-muted")}>Chronological Order</span>
                  </div>
                  <div className="space-y-3">
                     {recentActivity.map(act => (
                        <div key={act.id} className={cn(
                          "flex items-center justify-between p-5 rounded-[28px] border transition-all group",
                          isBusiness ? "bg-slate-50 border-black/5 hover:bg-slate-100" : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06]"
                        )}>
                           <div className="flex items-center gap-5">
                              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", act.bg, act.color, isBusiness && "border border-black")}>
                                 <act.icon size={20} />
                              </div>
                              <div>
                                 <p className={cn("text-xs font-black uppercase tracking-tight", isBusiness ? "text-black" : "text-proton-text")}>{act.label}</p>
                                 <p className={cn("text-[9px] font-bold font-mono opacity-40 uppercase", isBusiness ? "text-black" : "text-proton-muted")}>{act.time} || {act.date}</p>
                              </div>
                           </div>
                           <button className={cn(
                             "px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all",
                             isBusiness ? "bg-black text-white hover:opacity-80" : "bg-white/5 text-proton-muted group-hover:text-proton-accent group-hover:border-proton-accent/30 border border-transparent"
                           )}>Detail Insight</button>
                        </div>
                     ))}
                  </div>
               </div>

               <div className={cn(
                 "p-8 rounded-[40px] border flex flex-col justify-between transition-all duration-700",
                 isBusiness ? "bg-slate-100 border-black" : "bg-white/5 border-white/10"
               )}>
                  <div className="space-y-8">
                     <h3 className={isBusiness ? "text-black font-black uppercase tracking-widest text-xs" : "text-proton-text font-black uppercase tracking-widest text-xs"}>Status Check</h3>
                     <div className={cn("p-6 rounded-3xl space-y-4", isBusiness ? "bg-white border border-black" : "bg-white/5 border border-white/5")}>
                        <div className="flex items-center justify-between">
                           <span className={cn("text-[10px] font-black uppercase", isBusiness ? "text-black/40" : "text-proton-muted")}>Infrastructure</span>
                           <span className={cn("text-xs font-black italic", isBusiness ? "text-black" : "text-green-500")}>Stable</span>
                        </div>
                        <div className="flex items-center justify-between">
                           <span className={cn("text-[10px] font-black uppercase", isBusiness ? "text-black/40" : "text-proton-muted")}>Encryption</span>
                           <span className={cn("text-xs font-black italic", isBusiness ? "text-black" : "text-green-500")}>Verified</span>
                        </div>
                        <div className="flex items-center justify-between">
                           <span className={cn("text-[10px] font-black uppercase", isBusiness ? "text-black/40" : "text-proton-muted")}>Latency</span>
                           <span className={cn("text-xs font-black italic", isBusiness ? "text-black" : "text-green-500")}>12ms</span>
                        </div>
                     </div>
                  </div>
                  <button className={cn(
                    "w-full py-5 rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] mt-8 transition-all active:scale-95",
                    isBusiness ? "bg-black text-white" : "bg-proton-text text-proton-bg"
                  )}>Refresh Audit</button>
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

            <div className="space-y-8 text-left">
               <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10">
                  <div className="flex items-center gap-4 mb-8">
                     <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 border border-proton-accent/20 flex items-center justify-center text-proton-accent">
                        <Star size={24} className="fill-current" />
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">{translations[language].cabinet.subscription}</h3>
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
            className="space-y-8 text-left"
          >
             <div className="bg-white/5 backdrop-blur-xl p-8 sm:p-10 rounded-[40px] border border-white/10">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-black text-proton-text uppercase italic tracking-tight">Security Core</h3>
                   <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[8px] font-black text-green-500 uppercase tracking-widest">Environment Secured</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-6">
                      <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5">
                         <div className="w-10 h-10 rounded-xl bg-proton-accent/10 flex items-center justify-center text-proton-accent">
                            <Fingerprint size={20} />
                         </div>
                         <div>
                            <p className="text-sm font-black text-proton-text">Biometric Link</p>
                            <p className="text-[10px] text-proton-muted uppercase tracking-widest">Active & Verified</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5">
                         <div className="w-10 h-10 rounded-xl bg-proton-accent/10 flex items-center justify-center text-proton-accent">
                            <ShieldAlert size={20} />
                         </div>
                         <div>
                            <p className="text-sm font-black text-proton-text">Two-Factor Auth</p>
                            <p className="text-[10px] text-proton-muted uppercase tracking-widest">Enabled via System</p>
                         </div>
                      </div>
                   </div>
                   <div className="bg-proton-bg/40 p-6 rounded-3xl border border-white/5 flex flex-col justify-between">
                      <div className="space-y-4">
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-proton-muted uppercase tracking-widest">Data Encryption</span>
                            <span className="text-[10px] font-black text-green-500 uppercase">AES-256</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-proton-muted uppercase tracking-widest">Session Logic</span>
                            <span className="text-[10px] font-black text-green-500 uppercase">Authenticated</span>
                         </div>
                      </div>
                      <button className="w-full py-4 mt-6 bg-proton-accent/10 text-proton-accent border border-proton-accent/20 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-proton-accent hover:text-proton-bg transition-all">Download Audit Report</button>
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CabinetView;
