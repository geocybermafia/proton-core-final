import React from 'react';
import { 
  Users, Workflow, Calendar, Wallet, ArrowRight, Sparkles, 
  Clock, Activity, CheckSquare, Layers, Shield, Briefcase
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

interface BusinessHubViewProps {
  language: 'en' | 'ka';
  setActiveView: (view: any) => void;
  personasCount?: number;
  workflowsCount?: number;
  tasksCount?: number;
  userEmail?: string;
}

export default function BusinessHubView({
  language,
  setActiveView,
  personasCount = 0,
  workflowsCount = 0,
  tasksCount = 0,
  userEmail = ''
}: BusinessHubViewProps) {
  const isKa = language === 'ka';

  const stats = [
    {
      label: isKa ? 'აქტიური აგენტები' : 'Active Agents',
      value: personasCount,
      icon: Users,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10'
    },
    {
      label: isKa ? 'სამუშაო პროცესები' : 'Active Workflows',
      value: workflowsCount,
      icon: Workflow,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10'
    },
    {
      label: isKa ? 'აქტიური ამოცანები' : 'Pending Tasks',
      value: tasksCount,
      icon: CheckSquare,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10'
    }
  ];

  const modules = [
    {
      id: 'personas',
      title: isKa ? 'ბიზნეს აგენტები და როლები' : 'Business Agents & Chat',
      desc: isKa 
        ? 'კომუნიკაცია თქვენს პერსონალურ AI ასისტენტებთან. შექმენით ახალი როლები სპეციფიკური ამოცანებისთვის.'
        : 'Chat with customized AI agent personas. Create tailored roles to delegate specific operations.',
      badge: isKa ? 'ინტელექტუალური ასისტენტები' : 'AI Multi-Agents',
      icon: Users,
      color: 'cyan',
      glowClass: 'border-cyan-500/20 hover:border-cyan-500/80 shadow-cyan-500/5 hover:shadow-cyan-500/20',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      iconClass: 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black',
    },
    {
      id: 'blueprints',
      title: isKa ? 'სამუშაო პროცესები' : 'Workflows & Blueprints',
      desc: isKa 
        ? 'ავტომატური სამუშაო სცენარების, პროცესებისა და ამოცანების სქემების მართვა და ვიზუალური რედაქტირება.'
        : 'Design, manage, and visually audit automated multi-step scheduling workflows and blueprints.',
      badge: isKa ? 'ავტომატიზაცია' : 'Workflow Automation',
      icon: Workflow,
      color: 'emerald',
      glowClass: 'border-emerald-500/20 hover:border-emerald-500/80 shadow-emerald-500/5 hover:shadow-emerald-500/20',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      iconClass: 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black',
    },
    {
      id: 'organizer',
      title: isKa ? 'ამოცანების მმართველი' : 'Task Organizer',
      desc: isKa 
        ? 'ყოველდღიური დაგეგმარება, პრიორიტეტები, ენერგიის კონტროლი და კალენდარული განრიგი.'
        : 'Coordinate daily tasks, map personal schedules, set priorities, and manage your calendar.',
      badge: isKa ? 'განრიგი და საქმეები' : 'Agenda & Scheduling',
      icon: Calendar,
      color: 'purple',
      glowClass: 'border-purple-500/20 hover:border-purple-500/80 shadow-purple-500/5 hover:shadow-purple-500/20',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      iconClass: 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-black',
    },
    {
      id: 'finance',
      title: isKa ? 'ფინანსების მართვა' : 'Finance Tracker',
      desc: isKa 
        ? 'ბიუჯეტირება, Web3 ინტეგრაცია, ტრანზაქციების ისტორია და ბალანსის სიმულაციები.'
        : 'Track global budgets, monitor real-time transaction ledgers, simulate flows, and link Web3 wallets.',
      badge: isKa ? 'EVM საფულე და რეესტრი' : 'EVM Wallet & Ledger',
      icon: Wallet,
      color: 'amber',
      glowClass: 'border-amber-500/20 hover:border-amber-500/80 shadow-amber-500/5 hover:shadow-amber-500/20',
      badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      iconClass: 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-black',
    }
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-2">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-proton-border bg-proton-card/40 backdrop-blur-md p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-proton-accent/5 rounded-full blur-[80px] pointer-events-none -mr-20 -mt-20" />
        
        <div className="space-y-3 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-900 border border-zinc-800 text-proton-accent">
            <Briefcase size={12} />
            {isKa ? 'ბიზნეს პორტალი' : 'Business Portal'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-proton-text uppercase">
            {isKa ? 'მართვის ცენტრი' : 'Control Center'}
          </h1>
          <p className="text-proton-muted text-sm sm:text-base max-w-xl">
            {isKa 
              ? 'მოგესალმებით თქვენს სამუშაო სივრცეში. აირჩიეთ სასურველი მოდული, რათა მართოთ ბიზნეს როლები, პროცესები, ყოველდღიური ამოცანები და ფინანსები.'
              : 'Welcome to your premium business environment. Select a gateway below to coordinate agent roles, schedule workflows, manage tasks, or monitor finances.'}
          </p>
          {userEmail && (
            <div className="text-[11px] font-mono text-proton-muted/60 flex items-center gap-1.5 mt-2">
              <Shield size={12} className="text-proton-accent/80" />
              <span>{isKa ? 'ავტორიზებული მომხმარებელი' : 'Authorized User'}:</span>
              <span className="text-proton-text/80">{userEmail}</span>
            </div>
          )}
        </div>

        {/* Stats Summary Widget */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:w-auto w-full z-10 shrink-0">
          {stats.map((stat, i) => (
            <div 
              key={i} 
              className="bg-zinc-950/60 border border-zinc-900/60 rounded-2xl p-4 flex flex-col items-start gap-1.5 min-w-[140px] md:min-w-[160px]"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-bold text-proton-muted uppercase tracking-wider">
                  {stat.label}
                </span>
                <div className={cn("p-1.5 rounded-lg", stat.bg)}>
                  <stat.icon size={14} className={stat.color} />
                </div>
              </div>
              <span className="text-2xl font-black text-proton-text font-mono">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid of Modules */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xs font-mono font-black uppercase tracking-[0.3em] text-proton-accent">
            {isKa ? 'სამუშაო მოდულები' : 'Workspace Modules'}
          </h2>
          <p className="text-[10px] text-proton-muted font-mono uppercase tracking-widest mt-1">
            {isKa ? 'სასურველი სექციის სწრაფი არჩევანი' : 'Quickly pivot to any target workflow sector'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((mod) => (
            <div
              key={mod.id}
              onClick={() => setActiveView(mod.id)}
              className={cn(
                "group relative overflow-hidden rounded-3xl border bg-proton-card/30 backdrop-blur-sm p-6 sm:p-8 cursor-pointer transition-all duration-500 flex flex-col justify-between min-h-[220px]",
                mod.glowClass
              )}
            >
              {/* Card top banner/badge */}
              <div className="flex items-start justify-between gap-4">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-mono font-black uppercase tracking-widest border",
                  mod.badgeClass
                )}>
                  {mod.badge}
                </span>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                  mod.iconClass
                )}>
                  <mod.icon size={22} className="stroke-[1.8]" />
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2 mt-4 flex-1">
                <h3 className="text-lg font-black uppercase tracking-tight text-proton-text group-hover:text-proton-accent transition-colors duration-300">
                  {mod.title}
                </h3>
                <p className="text-xs text-proton-muted leading-relaxed font-medium">
                  {mod.desc}
                </p>
              </div>

              {/* Card Footer action indicator */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-black uppercase tracking-widest text-proton-muted group-hover:text-proton-accent transition-colors duration-300 mt-4 pt-4 border-t border-zinc-900/40">
                <span>{isKa ? 'გახსნა' : 'Enter Module'}</span>
                <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
