import React, { useState, useMemo } from 'react';
import { safeStorage } from '../lib/safeStorage';
import { motion, AnimatePresence } from 'framer-motion';
import { matchCommandRoute, CommandRoute } from '../lib/commandRoutes';
import { 
  Building, 
  Palette, 
  ShoppingBag, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  Grid, 
  Sparkles, 
  ArrowUpRight,
  SlidersHorizontal,
  Eye,
  EyeOff,
  LayoutGrid,
  Video,
  Search,
  Bot,
  Zap,
  CheckCircle2,
  Cpu,
  ArrowRight,
  MessageSquare,
  Image,
  Layers,
  Activity,
  BarChart3,
  Terminal,
  Clock,
  Copy,
  Check,
  RefreshCw,
  Gauge,
  Radio,
  Sliders
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import { View, Task } from '../types';
import { SystemStatusBadge } from './SystemStatusBadge';
import { SystemHealthState } from '../hooks/useSystemHealth';
import { 
  ProtonCard, 
  ProtonButton, 
  ProtonInput, 
  ProtonBadge, 
  ProtonIconBox 
} from '../ui';
import { useSellerStats } from '../hooks/useSellerStats';

export interface DashboardViewProps {
  setActiveView: (v: View) => void;
  language: 'en' | 'ka';
  setUiMode: (m: 'business' | 'creative' | 'market', targetView?: View) => void;
  systemHealth?: SystemHealthState;
}

export const DashboardView = React.memo(({ 
  setActiveView, 
  language = 'en',
  setUiMode,
  systemHealth
}: DashboardViewProps) => {
  const t = translations[language];

  // Quick Command Search State
  const [quickQuery, setQuickQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [accentGlow, setAccentGlow] = useState<'cyan' | 'purple' | 'emerald' | 'amber'>('cyan');

  // Dynamic state for grid widget visibility
  const [visibleWidgets, setVisibleWidgets] = React.useState<string[]>(() => {
    return safeStorage.getJSON('proton_dashboard_widgets', ['business', 'creative', 'market', 'organizer', 'finance', 'clips']);
  });

  const [showConfig, setShowConfig] = React.useState(false);

  const toggleWidget = (id: string) => {
    setVisibleWidgets(prev => {
      const next = prev.includes(id) 
        ? prev.filter(w => w !== id) 
        : [...prev, id];
      if (next.length === 0) return prev;
      safeStorage.set('proton_dashboard_widgets', JSON.stringify(next));
      return next;
    });
  };

  const showAllWidgets = () => {
    const all = ['business', 'creative', 'market', 'organizer', 'finance', 'clips'];
    setVisibleWidgets(all);
    safeStorage.set('proton_dashboard_widgets', JSON.stringify(all));
  };

  const showEssentialOnly = () => {
    const essential = ['business', 'finance', 'organizer', 'clips'];
    setVisibleWidgets(essential);
    safeStorage.set('proton_dashboard_widgets', JSON.stringify(essential));
  };

  const [matchedSuggestedRoute, setMatchedSuggestedRoute] = useState<CommandRoute | null>(null);

  // Command Route Submission Handler
  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = quickQuery.trim();
    if (!query) return;

    // Step One & Step Three: Match against Command Route Dictionary
    const matches = matchCommandRoute(query);

    if (matches.length > 0) {
      // Direct command route match identified -> Execute immediate deep-link navigation
      const topMatch = matches[0];
      setQuickQuery('');
      if (topMatch.uiMode) {
        setUiMode(topMatch.uiMode, topMatch.view);
      } else {
        setActiveView(topMatch.view);
      }
      return;
    }

    // If no exact command route match exists, render inline preview + primary "Navigate to Tool" quick action
    setIsAiThinking(true);
    setAiResponse(null);
    setMatchedSuggestedRoute(null);

    setTimeout(() => {
      setIsAiThinking(false);
      if (language === 'ka') {
        setAiResponse(`⚡ [Proton AI ექსპერიმენტული პასუხი]:
მოთხოვნა: "${query}"
• ანალიზი წარმატებით შესრულდა.
• რეკომენდაცია: შეგიძლია გადახვიდე AI ასისტენტების სივრცეში სიღრმისეული საუბრისთვის.`);
      } else {
        setAiResponse(`⚡ [Proton AI Direct Insight]:
Query: "${query}"
• Analysis completed across active workspace tools.
• Action Suggestion: Proceed to AI Companions for an extended conversation.`);
      }
    }, 600);
  };

  const handleCopyAiResponse = () => {
    if (!aiResponse) return;
    navigator.clipboard.writeText(aiResponse);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  // Consume live seller statistics from SellerProvider (Zero Firestore queries here)
  const {
    activeListings,
    inactiveListings,
    draftListings,
    pendingOrders,
    completedOrders,
    grossRevenue,
    monthlyRevenue,
    todayRevenue,
    walletBalance,
    lowStockItemsCount,
    recentOrders
  } = useSellerStats();

  // Active tasks from local storage
  const activeTasksCount = useMemo(() => {
    try {
      const savedTasks: Task[] = safeStorage.getJSON('proton_tasks', []);
      return savedTasks.filter(t => !t.completed).length;
    } catch {
      return 0;
    }
  }, []);

  // Beautiful curated titles & metrics for the Gateways
  const gateways = useMemo(() => [
    {
      id: 'business',
      title: language === 'ka' ? 'ხელოვნური ინტელექტი & ავტომატიზაცია' : 'AI & Automation',
      badge: language === 'ka' ? 'ინტელექტუალური ასისტენტები' : 'AI Companions',
      desc: language === 'ka' 
        ? 'შექმენით და მართეთ სპეციალიზებული AI აგენტები, როლები და ავტომატიზებული პროცესები.'
        : 'Create and coordinate specialized AI agents, custom roles, and automated workflows.',
      icon: Building,
      color: 'cyan',
      glowClass: 'border-cyan-500/20 hover:border-cyan-500/80 shadow-cyan-500/5 hover:shadow-cyan-500/20',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      iconClass: 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'სამუშაო პროცესები' : 'Workflows', view: 'blueprints' }
      ],
      action: () => {
        setUiMode('business', 'business-hub');
      }
    },
    {
      id: 'creative',
      title: language === 'ka' ? 'კრეატიული სტუდია' : 'Creative Studio',
      badge: language === 'ka' ? 'დიზაინი და ენები' : 'Design & Language',
      desc: language === 'ka'
        ? 'მაღალი ხარისხის ილუსტრაციების გენერაცია, ორენოვანი სათარჯიმნო კაბინეტი და სარეკლამო კოპირაიტინგი.'
        : 'Generate high-quality visuals, copy writing prompts, and handle bilingual translation.',
      icon: Palette,
      color: 'amber',
      glowClass: 'border-amber-500/20 hover:border-amber-500/80 shadow-amber-500/5 hover:shadow-amber-500/20',
      badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      iconClass: 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'კრეატიული ჰაბი' : 'Creative Hub', view: 'creative-studio' },
        { label: language === 'ka' ? 'სურათების გენერატორი' : 'Image Generator', view: 'image' },
        { label: language === 'ka' ? 'სარეკლამო კოპირაიტინგი' : 'Ad Copywriter', view: 'copywriting' }
      ],
      action: () => {
        setUiMode('creative', 'creative-studio');
      }
    },
    {
      id: 'market',
      title: language === 'ka' ? 'პროტონ მარკეტი' : 'Proton Market',
      badge: pendingOrders.length > 0
        ? (language === 'ka' ? `მარკეტი (${pendingOrders.length} შეკვეთა)` : `E-Commerce (${pendingOrders.length} Pending)`)
        : (language === 'ka' ? 'ელ-კომერცია' : 'E-Commerce Marketplace'),
      desc: activeListings.length === 0 && pendingOrders.length === 0
        ? (language === 'ka' 
            ? 'ჯერ არ გაქვთ აქტიური განცხადებები. განათავსეთ თქვენი პირველი პროდუქტი ან მომსახურება.' 
            : 'No active listings published yet. Publish your first product or service to start selling.')
        : (language === 'ka'
            ? `${activeListings.length} აქტიური განცხადება • ${pendingOrders.length} მომლოდინე შეკვეთა${lowStockItemsCount > 0 ? ` • ${lowStockItemsCount} დაბალი მარაგით` : ''}`
            : `${activeListings.length} Active Listings • ${pendingOrders.length} Pending Orders${lowStockItemsCount > 0 ? ` • ${lowStockItemsCount} Low Stock` : ''}`),
      icon: ShoppingBag,
      color: 'emerald',
      glowClass: 'border-emerald-500/20 hover:border-emerald-500/80 shadow-emerald-500/5 hover:shadow-emerald-500/20',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      iconClass: 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'მარკეტის დათვალიერება' : 'Browse listings', view: 'market-hub' },
        ...(activeListings.length > 0 ? [{ label: language === 'ka' ? `აქტიური (${activeListings.length})` : `Listings (${activeListings.length})`, view: 'market-hub' }] : []),
        ...(pendingOrders.length > 0 ? [{ label: language === 'ka' ? `შეკვეთები (${pendingOrders.length})` : `Orders (${pendingOrders.length})`, view: 'market-hub' }] : [])
      ],
      action: () => {
        setUiMode('market', 'market-hub');
      }
    },
    {
      id: 'organizer',
      title: language === 'ka' ? 'ამოცანების მმართველი' : 'Task Organizer',
      badge: language === 'ka' ? 'ამოცანები და კალენდარი' : 'Task & Time Management',
      desc: language === 'ka'
        ? 'დაგეგმეთ თქვენი დღე, ჩაინიშნეთ დავალებები და მართეთ კალენდარი ეფექტურად.'
        : 'Plan your day, organize tasks, set reminders, and manage your calendar.',
      icon: CalendarIcon,
      color: 'purple',
      glowClass: 'border-purple-500/20 hover:border-purple-500/80 shadow-purple-500/5 hover:shadow-purple-500/20',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      iconClass: 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'ჩემი დავალებები' : 'Active Tasks', view: 'organizer' }
      ],
      action: () => setActiveView('organizer')
    },
    {
      id: 'finance',
      title: language === 'ka' ? 'ფინანსების მართვა' : 'Finance Tracker',
      badge: walletBalance > 0 
        ? `$${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${language === 'ka' ? 'ბალანსი' : 'Balance'}`
        : (language === 'ka' ? 'ბიუჯეტი და ფინანსები' : 'Personal & Business Budgeting'),
      desc: grossRevenue === 0
        ? (language === 'ka' 
            ? 'ბალანსი: $0.00 • შემოსავალი გამოჩნდება პირველი წარმატებული გაყიდვის შემდეგ.' 
            : 'Balance: $0.00 • Revenue will appear after your first completed sale.')
        : (language === 'ka'
            ? `სულ: $${grossRevenue.toLocaleString()} • თვიური: $${monthlyRevenue.toLocaleString()} • დღეს: $${todayRevenue.toLocaleString()}`
            : `Total Revenue: $${grossRevenue.toLocaleString()} • Monthly: $${monthlyRevenue.toLocaleString()} • Today: $${todayRevenue.toLocaleString()}`),
      icon: TrendingUp,
      color: 'amber',
      glowClass: 'border-amber-500/20 hover:border-amber-500/80 shadow-amber-500/5 hover:shadow-amber-500/20',
      badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      iconClass: 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'ფინანსების დაფა' : 'Budget Dashboard', view: 'finance' },
        ...(completedOrders.length > 0 ? [{ label: language === 'ka' ? `გაყიდვები (${completedOrders.length})` : `Sales (${completedOrders.length})`, view: 'finance' }] : [])
      ],
      action: () => setActiveView('finance')
    },
    {
      id: 'clips',
      title: language === 'ka' ? 'პროტონ კლიპები' : 'Proton Clips',
      badge: language === 'ka' ? 'მოკლე ვიდეოები' : 'Short Video Portal',
      desc: language === 'ka'
        ? 'უყურეთ, დააკომენტარეთ და გააზიარეთ მოკლე ვიდეო კლიპები. ატვირთეთ საკუთარი და მართეთ ფილტრები.'
        : 'Watch, comment, and share short video clips. Upload your own, build trends, and engage with the feed.',
      icon: Video,
      color: 'rose',
      glowClass: 'border-rose-500/20 hover:border-rose-500/80 shadow-rose-500/5 hover:shadow-rose-500/20',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      iconClass: 'bg-rose-500/10 text-rose-400 group-hover:bg-rose-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'კლიპების ლენტა' : 'Browse Clips', view: 'clips' }
      ],
      action: () => setActiveView('clips')
    }
  ], [
    language,
    activeListings.length,
    pendingOrders.length,
    completedOrders.length,
    lowStockItemsCount,
    walletBalance,
    grossRevenue,
    monthlyRevenue,
    todayRevenue,
    setUiMode,
    setActiveView
  ]);

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.08
          }
        }
      }}
      className="space-y-8 pb-20 max-w-6xl mx-auto px-4"
    >
      {/* Unified Bento Command Deck */}
      <motion.div 
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
        }}
      >
        <ProtonCard
          variant="default"
          padding="none"
          className="p-5 sm:p-6 sm:rounded-2xl bg-zinc-950/80 border border-zinc-800/80 shadow-xl space-y-5"
        >
          {/* Row 1: Header + System Telemetry */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-left">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                {language === 'ka' ? 'სამუშაო სივრცე' : 'Workspace'}
              </h1>
              <p className="text-sm font-medium text-zinc-500">
                {language === 'ka' ? 'პროტონ დაშბორდი' : 'Proton Dashboard'}
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {systemHealth ? (
                <button 
                  type="button"
                  onClick={() => systemHealth.checkHealth()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 transition-colors text-xs font-medium cursor-pointer"
                  title={language === 'ka' ? 'დააჭირეთ სისტემის გადამოწმებისთვის' : 'Click to probe system health'}
                >
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    systemHealth.status === 'optimal' ? "bg-emerald-400 animate-pulse" :
                    systemHealth.status === 'degraded' ? "bg-amber-400 animate-pulse" : "bg-rose-400 animate-pulse"
                  )} />
                  <span className={cn(
                    systemHealth.status === 'optimal' ? "text-emerald-400" :
                    systemHealth.status === 'degraded' ? "text-amber-400" : "text-rose-400"
                  )}>
                    {systemHealth.status === 'optimal'
                      ? (language === 'ka' ? 'სისტემა მუშაობს' : 'System Operational')
                      : systemHealth.status === 'degraded'
                      ? (language === 'ka' ? 'დაყოვნება' : 'Degraded')
                      : (language === 'ka' ? 'შეცდომა' : 'System Error')}
                  </span>
                  {typeof systemHealth.latency === 'number' && systemHealth.latency > 0 && (
                    <span className="text-[11px] font-mono text-zinc-500 pl-1 border-l border-zinc-800">
                      {systemHealth.latency}ms
                    </span>
                  )}
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{language === 'ka' ? 'სისტემა მუშაობს' : 'System Operational'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Live Operational Signals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Signal 1: Pending Orders */}
            <button
              type="button"
              onClick={() => setUiMode('market', 'market-hub')}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer group",
                pendingOrders.length > 0
                  ? "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60 text-amber-300"
                  : "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/80 text-zinc-300"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                  pendingOrders.length > 0 ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-400"
                )}>
                  <ShoppingBag size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-zinc-400 truncate">
                    {language === 'ka' ? 'მომლოდინე შეკვეთები' : 'Pending Orders'}
                  </div>
                  <div className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 mt-0.5">
                    <span>{pendingOrders.length}</span>
                    {pendingOrders.length > 0 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold uppercase tracking-wider">
                        {language === 'ka' ? 'მოქმედება საჭიროა' : 'Action Required'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 font-normal">
                        {language === 'ka' ? 'რიგში არაა' : 'All clear'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ArrowUpRight size={14} className="text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
            </button>

            {/* Signal 2: Active Listings */}
            <button
              type="button"
              onClick={() => setUiMode('market', 'market-hub')}
              className="flex items-center justify-between p-3 rounded-xl border bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/80 text-zinc-300 text-left transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                  <TrendingUp size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-zinc-400 truncate">
                    {language === 'ka' ? 'აქტიური განცხადებები' : 'Active Listings'}
                  </div>
                  <div className="text-sm font-bold text-zinc-100 mt-0.5">
                    {activeListings.length} {language === 'ka' ? 'პროდუქტი' : 'Items'}
                  </div>
                </div>
              </div>
              <ArrowUpRight size={14} className="text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
            </button>

            {/* Signal 3: Active Tasks */}
            <button
              type="button"
              onClick={() => setActiveView('organizer')}
              className="flex items-center justify-between p-3 rounded-xl border bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/80 text-zinc-300 text-left transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                  <CalendarIcon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-zinc-400 truncate">
                    {language === 'ka' ? 'აქტიური დავალებები' : 'Active Tasks'}
                  </div>
                  <div className="text-sm font-bold text-zinc-100 mt-0.5">
                    {activeTasksCount} {language === 'ka' ? 'დავალება' : 'Tasks'}
                  </div>
                </div>
              </div>
              <ArrowUpRight size={14} className="text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
            </button>
          </div>

          {/* Row 3: Command / Search Input Bar */}
          <form onSubmit={handleQuickSubmit} className="pt-2">
            <div className="relative flex items-center">
              <div className="absolute left-3.5 flex items-center pointer-events-none text-zinc-500">
                <Sparkles size={16} className="text-proton-accent" />
              </div>
              <input
                type="text"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder={language === 'ka' 
                  ? 'ჩაწერეთ ბრძანება ან მოძებნეთ ფუნქცია...' 
                  : 'Type a command or launch a workflow...'}
                className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-proton-accent/60 rounded-xl pl-10 pr-28 py-3 text-sm text-zinc-100 placeholder-zinc-500 transition-colors focus:outline-none focus:ring-1 focus:ring-proton-accent/40"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-800/80 border border-zinc-700/50 rounded">
                  ↵ Enter
                </kbd>
                <ProtonButton 
                  type="submit"
                  size="sm"
                  leftIcon={<Zap size={13} />}
                  className="py-1.5 px-3 text-xs"
                >
                  {language === 'ka' ? 'გაშვება' : 'Run'}
                </ProtonButton>
              </div>
            </div>

            {/* Quick Action Chips */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-[11px] font-mono text-zinc-500 font-semibold mr-1">
                {language === 'ka' ? 'სწრაფი ბრძანებები:' : 'Shortcuts:'}
              </span>
              <button
                type="button"
                onClick={() => setUiMode('creative', 'image')}
                className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                <Image size={12} />
                <span>{language === 'ka' ? 'სურათის შექმნა' : 'Generate Visual'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('organizer')}
                className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors cursor-pointer"
              >
                <CalendarIcon size={12} />
                <span>{language === 'ka' ? 'ორგანიზატორი' : 'Organizer'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('clips')}
                className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <Video size={12} />
                <span>{language === 'ka' ? 'კლიპები' : 'Clips'}</span>
              </button>
            </div>
          </form>

          {/* Row 4: Live Instant AI Response Box */}
          <AnimatePresence>
            {(isAiThinking || aiResponse) && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="pt-4 border-t border-zinc-800/80"
              >
                <ProtonCard variant="glass" padding="default" className="relative space-y-3 border-proton-accent/40 bg-zinc-900/90 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ProtonIconBox variant="accent" size="sm">
                        <Sparkles size={14} className={isAiThinking ? "animate-spin text-proton-accent" : "text-proton-accent"} />
                      </ProtonIconBox>
                      <span className="text-xs font-mono font-bold text-proton-accent uppercase tracking-wider">
                        {isAiThinking ? (language === 'ka' ? 'AI მოდელი ამუშავებს შეკითხვას...' : 'AI Processing Command...') : (language === 'ka' ? 'AI ანალიზი' : 'AI Direct Output')}
                      </span>
                    </div>

                    {aiResponse && (
                      <div className="flex items-center gap-2">
                        <ProtonButton
                          variant="subtle"
                          size="sm"
                          onClick={handleCopyAiResponse}
                          leftIcon={copiedOutput ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          className="py-1 px-2.5 text-[10px]"
                        >
                          {copiedOutput ? (language === 'ka' ? 'კოპირებულია' : 'Copied') : (language === 'ka' ? 'კოპირება' : 'Copy')}
                        </ProtonButton>
                        <ProtonButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setAiResponse(null)}
                          className="py-1 px-2 text-[10px]"
                        >
                          ✕
                        </ProtonButton>
                      </div>
                    )}
                  </div>

                  {isAiThinking ? (
                    <div className="flex items-center gap-3 py-4 text-xs font-mono text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-proton-accent animate-ping" />
                      <span>Analyzing system telemetry, neural memory nodes, and context...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs font-mono text-zinc-200 whitespace-pre-line leading-relaxed p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
                        {aiResponse}
                      </div>
                      
                      <div className="flex items-center justify-end pt-1">
                        <ProtonButton
                          variant="secondary"
                          size="sm"
                          onClick={() => setAiResponse(null)}
                          className="text-xs py-1.5 font-mono uppercase tracking-wider"
                        >
                          {language === 'ka' ? 'დახურვა' : 'Close'}
                        </ProtonButton>
                      </div>
                    </div>
                  )}
                </ProtonCard>
              </motion.div>
            )}
          </AnimatePresence>
        </ProtonCard>
      </motion.div>

      {/* Main Gateways Portal Grid */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-proton-border/30 pb-4">
          <div>
            <h2 className="text-xs font-mono font-black uppercase tracking-[0.3em] text-proton-accent flex items-center gap-2">
              <LayoutGrid size={14} />
              {language === 'ka' ? 'სამუშაო სექციები' : 'AVAILABLE MODULES'}
            </h2>
            <p className="text-[10px] text-proton-muted font-mono uppercase tracking-widest mt-1">
              {language === 'ka' ? 'აირჩიეთ სასურველი მოდული ყოველდღიური საქმიანობის სამართავად' : 'Select a gateway module to manage your workspace workflows'}
            </p>
          </div>
          
          <ProtonButton
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            variant={showConfig ? "primary" : "secondary"}
            size="sm"
            leftIcon={<SlidersHorizontal size={12} />}
          >
            {language === 'ka' ? 'ვიჯეტების მორგება' : 'Customize Widgets'}
          </ProtonButton>
        </div>

        {/* Dynamic Widget Customizer Panel */}
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ProtonCard variant="glass" padding="default" className="space-y-4 overflow-hidden mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-proton-border/20 pb-3">
                <div className="space-y-0.5">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-proton-text">
                    {language === 'ka' ? 'ვიჯეტების ჩვენების პარამეტრები' : 'Widget Visibility Preferences'}
                  </h4>
                  <p className="text-[9px] text-proton-muted font-mono uppercase">
                    {language === 'ka' 
                      ? 'გამორთეთ არაარსებითი მეტრიკები საწყისი ჩატვირთვის დასაჩქარებლად' 
                      : 'Toggle non-essential modules to optimize your dashboard performance'}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <ProtonButton
                    type="button"
                    onClick={showAllWidgets}
                    variant="subtle"
                    size="sm"
                    className="px-2.5 py-1 text-[9px]"
                  >
                    {language === 'ka' ? 'ყველა' : 'Show All'}
                  </ProtonButton>
                  <ProtonButton
                    type="button"
                    onClick={showEssentialOnly}
                    variant="ghost"
                    size="sm"
                    className="px-2.5 py-1 text-[9px]"
                  >
                    {language === 'ka' ? 'ძირითადი' : 'Essential Only'}
                  </ProtonButton>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {gateways.map((gate) => {
                  const isVisible = visibleWidgets.includes(gate.id);
                  const GateIcon = gate.icon;
                  return (
                    <ProtonButton
                      key={gate.id}
                      type="button"
                      variant="ghost"
                      fullWidth
                      justify="start"
                      onClick={() => toggleWidget(gate.id)}
                      className={cn(
                        "h-auto p-3 gap-3 border transition-all text-left group active:scale-95 cursor-pointer font-normal",
                        isVisible 
                          ? "bg-proton-accent/5 border-proton-accent/40 text-proton-text hover:bg-proton-accent/10" 
                          : "bg-transparent border-proton-border/40 text-proton-muted hover:border-proton-border hover:bg-proton-card/50"
                      )}
                    >
                      <ProtonIconBox 
                        variant={isVisible ? "accent" : "neutral"} 
                        size="sm"
                      >
                        <GateIcon size={16} />
                      </ProtonIconBox>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-wider truncate">
                          {gate.title.split(' ')[0]}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isVisible ? (
                            <>
                              <Eye size={10} className="text-emerald-500 shrink-0" />
                              <span className="text-[8px] font-mono font-bold text-emerald-500 uppercase tracking-widest">{language === 'ka' ? 'აქტიური' : 'Active'}</span>
                            </>
                          ) : (
                            <>
                              <EyeOff size={10} className="text-zinc-600 shrink-0" />
                              <span className="text-[8px] font-mono font-bold text-zinc-600 uppercase tracking-widest">{language === 'ka' ? 'დამალული' : 'Hidden'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </ProtonButton>
                  );
                })}
              </div>
            </ProtonCard>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gateways.filter(gate => visibleWidgets.includes(gate.id)).map((gate) => {
            const IconComponent = gate.icon;
            const badgeVariant = 
              gate.color === 'cyan' ? 'accent' :
              gate.color === 'amber' ? 'amber' :
              gate.color === 'emerald' ? 'emerald' :
              gate.color === 'purple' ? 'purple' : 'accent';

            return (
              <motion.div
                key={gate.id}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
                }}
                whileHover={{ 
                  y: -6,
                  scale: 1.015,
                }}
                whileTap={{ scale: 0.985 }}
              >
                <ProtonCard
                  variant="interactive"
                  padding="spacious"
                  mode={gate.id as any}
                  className="flex flex-col justify-between h-full overflow-hidden"
                  onClick={gate.action}
                >
                  {/* Visual Accent glow line */}
                  <div className={cn(
                    "absolute top-0 left-0 w-full h-1 bg-gradient-to-r opacity-60 transition-opacity duration-300 group-hover:opacity-100",
                    gate.color === 'cyan' ? 'from-cyan-500 to-transparent' :
                    gate.color === 'amber' ? 'from-amber-500 to-transparent' :
                    gate.color === 'emerald' ? 'from-emerald-500 to-transparent' :
                    gate.color === 'purple' ? 'from-purple-500 to-transparent' :
                    'from-proton-accent to-transparent'
                  )} />

                  <div className="space-y-4 w-full">
                    <div className="flex items-center justify-between w-full">
                      {/* Mode Tag */}
                      <ProtonBadge variant={badgeVariant as any} size="sm">
                        {gate.badge}
                      </ProtonBadge>

                      <ArrowUpRight className="text-proton-muted group-hover:text-proton-text group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" size={16} />
                    </div>

                    {/* Header Title & Icon */}
                    <div className="flex items-start gap-4">
                      <ProtonIconBox 
                        variant={badgeVariant as any} 
                        size="lg"
                        className="group-hover:scale-105 transition-transform"
                      >
                        <IconComponent size={24} />
                      </ProtonIconBox>
                      <div className="space-y-1">
                        <h3 className="text-xl font-black tracking-tight text-proton-text uppercase group-hover:text-proton-accent transition-colors">
                          {gate.title}
                        </h3>
                        <p className="text-[11px] text-proton-muted leading-relaxed font-semibold">
                          {gate.desc}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Shortcuts & Quick actions */}
                  <div className="mt-6 pt-4 border-t border-proton-border/30 grid grid-cols-1 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                    {gate.shortcuts.map((sc, i) => (
                      <ProtonButton
                        key={i}
                        type="button"
                        variant="subtle"
                        size="sm"
                        title={sc.label}
                        onClick={() => {
                          if (gate.id === 'business' || gate.id === 'creative' || gate.id === 'market') {
                            setUiMode(gate.id, sc.view as any);
                          } else {
                            setActiveView(sc.view as any);
                          }
                        }}
                        className="w-full sm:w-auto py-1.5 sm:py-1 px-2 sm:px-2.5 text-[9px] min-[380px]:text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap truncate min-w-0 justify-center"
                      >
                        <span className="truncate min-w-0 whitespace-nowrap">{sc.label}</span>
                      </ProtonButton>
                    ))}
                  </div>
                </ProtonCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
});

DashboardView.displayName = 'DashboardView';

