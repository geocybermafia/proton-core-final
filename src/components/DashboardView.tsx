import React, { useState } from 'react';
import { safeStorage } from '../lib/safeStorage';
import { motion } from 'framer-motion';
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
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import { Persona, View, GlobalAiSettings, Theme, GeminiMetadata } from '../types';

export const DashboardView = React.memo(({ 
  setActiveView, 
  language = 'en',
  setUiMode,
  aiSettings,
  setAiSettings,
  personas = []
}: { 
  personas?: Persona[], 
  activeView: View, 
  setActiveView: (v: View) => void,
  chatHistory?: any,
  language: 'en' | 'ka',
  user?: any,
  uiMode: 'business' | 'creative' | 'market',
  setUiMode: (m: 'business' | 'creative' | 'market', targetView?: View) => void,
  aiSettings: GlobalAiSettings,
  setLastGeminiMetadata?: (m: GeminiMetadata | null) => void,
  trackFirestore?: <T>(promise: Promise<T>) => Promise<T>,
  isCreativeMode?: boolean,
  theme?: Theme,
  setTheme?: (t: Theme) => void,
  isSystemActive?: boolean,
  setAiSettings: React.Dispatch<React.SetStateAction<GlobalAiSettings>>
}) => {
  const t = translations[language];

  // Quick Command Search State
  const [quickQuery, setQuickQuery] = useState('');

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
      // Always keep at least one widget visible
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

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim()) return;
    setActiveView('personas');
  };

  // Beautiful curated titles & metrics for the Gateways
  const gateways = [
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
      badge: language === 'ka' ? 'ელ-კომერცია' : 'E-Commerce Marketplace',
      desc: language === 'ka'
        ? 'განათავსეთ განცხადებები, შეიძინეთ ან გაყიდეთ ნივთები და მომსახურებები.'
        : 'Publish listings, buy or sell items and services, and manage your orders.',
      icon: ShoppingBag,
      color: 'emerald',
      glowClass: 'border-emerald-500/20 hover:border-emerald-500/80 shadow-emerald-500/5 hover:shadow-emerald-500/20',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      iconClass: 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'მარკეტის დათვალიერება' : 'Browse listings', view: 'market-hub' }
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
      badge: language === 'ka' ? 'ბიუჯეტი და ფინანსები' : 'Personal & Business Budgeting',
      desc: language === 'ka'
        ? 'აკონტროლეთ შემოსავლები და გასავლები, მართეთ ბიუჯეტი და ტრანზაქციების ისტორია.'
        : 'Track income and expenses, manage your budget, and review transaction history.',
      icon: TrendingUp,
      color: 'amber',
      glowClass: 'border-amber-500/20 hover:border-amber-500/80 shadow-amber-500/5 hover:shadow-amber-500/20',
      badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      iconClass: 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'ფინანსების დაფა' : 'Budget Dashboard', view: 'finance' }
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
  ];

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
      {/* Elegantly Crafted Hub Hero Section */}
      <motion.div 
        variants={{
          hidden: { opacity: 0, y: 30 },
          visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
        }}
        className="p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-proton-border bg-gradient-to-br from-proton-card via-proton-card/90 to-proton-accent/5 shadow-2xl relative overflow-hidden transition-all duration-300 space-y-6"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-proton-accent/10 rounded-full blur-[100px] pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-6 relative z-10">
          <div className="space-y-3 text-left flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-proton-bg/80 text-proton-accent border border-proton-accent/30 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-ping" />
              {language === 'ka' ? 'ციფრული სამუშაო სივრცე' : 'DIGITAL WORKSPACE'}
            </div>
            
            <h1 className="font-extrabold tracking-tight uppercase leading-none text-3xl sm:text-4xl md:text-5xl text-proton-text">
              {language === 'ka' ? 'კეთილი იყოს შენი მობრძანება' : 'WELCOME TO PROTON'}
            </h1>
            
            <p className="text-proton-muted font-normal max-w-2xl text-sm sm:text-base leading-relaxed">
              {language === 'ka' 
                ? 'ეს არის შენი პერსონალური ციფრული სივრცე. აქ შეგიძლია გაესაუბრო ჭკვიან AI ასისტენტებს, შექმნა კრეატიული ხელოვნება, გაყიდო ან შეიძინო ნივთები ადგილობრივ მარკეტზე და მართო ყოველდღიური საქმეები მარტივად.'
                : 'This is your personal digital workspace. Chat with smart AI companions, design visual graphics, trade items in the marketplace, and track your daily tasks or workflows effortlessly.'}
            </p>
          </div>
          
          <div className="hidden md:flex items-center shrink-0">
            <motion.div 
              whileHover={{ scale: 1.08, rotate: 45 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-proton-accent/10 flex items-center justify-center border border-proton-accent/20 backdrop-blur-sm shadow-inner cursor-pointer"
            >
              <Grid className="text-proton-accent" size={30} />
            </motion.div>
          </div>
        </div>

        {/* Quick AI Command / Search Input Box */}
        <form onSubmit={handleQuickSubmit} className="relative z-10 pt-2">
          <div className="relative flex items-center">
            <Sparkles className="absolute left-4 text-proton-accent animate-pulse" size={18} />
            <input 
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder={language === 'ka' 
                ? 'ჩაწერეთ შეკითხვა AI-სთვის ან მოძებნეთ ფუნქცია...' 
                : 'Ask AI anything or launch a workflow...'}
              className="w-full pl-11 pr-28 py-3.5 rounded-xl bg-proton-bg/80 border border-proton-accent/30 text-proton-text placeholder-proton-muted text-sm font-medium focus:outline-none focus:border-proton-accent focus:ring-1 focus:ring-proton-accent/50 shadow-inner transition-all"
            />
            <button 
              type="submit"
              className="absolute right-2 px-4 py-2 rounded-lg bg-proton-accent hover:bg-proton-accent/90 text-proton-bg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Zap size={14} />
              {language === 'ka' ? 'გაგზავნა' : 'Ask'}
            </button>
          </div>

          {/* Quick Action Chips */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[10px] font-mono uppercase text-proton-muted font-bold mr-1">
              {language === 'ka' ? 'სწრაფი ბრძანებები:' : 'Quick Shortcuts:'}
            </span>
            <button 
              type="button"
              onClick={() => setActiveView('personas')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <Bot size={11} />
              {language === 'ka' ? 'AI ჩატი' : 'AI Assistant'}
            </button>
            <button 
              type="button"
              onClick={() => setUiMode('creative', 'image')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <Image size={11} />
              {language === 'ka' ? 'სურათის შექმნა' : 'Generate Visual'}
            </button>
            <button 
              type="button"
              onClick={() => setActiveView('organizer')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <CalendarIcon size={11} />
              {language === 'ka' ? 'დავალებები' : 'Tasks'}
            </button>
            <button 
              type="button"
              onClick={() => setActiveView('clips')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <Video size={11} />
              {language === 'ka' ? 'კლიპები' : 'Clips'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Live Workspace Overview Metrics Bar */}
      <motion.div 
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0 }
        }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        <div 
          onClick={() => setActiveView('personas')}
          className="p-4 rounded-xl border border-proton-border bg-proton-card/30 hover:bg-proton-card/70 transition-all cursor-pointer group flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Bot size={20} />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase font-bold text-proton-muted">
              {language === 'ka' ? 'AI ასისტენტები' : 'AI Companions'}
            </div>
            <div className="text-base font-extrabold text-proton-text flex items-center gap-1.5 mt-0.5">
              <span>{personas.length || 8}</span>
              <span className="text-[9px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {language === 'ka' ? 'აქტიური' : 'Active'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-proton-border bg-proton-card/30 transition-all flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Cpu size={20} />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase font-bold text-proton-muted">
              {language === 'ka' ? 'AI მოდელი' : 'AI Engine'}
            </div>
            <div className="text-sm font-extrabold text-proton-text flex items-center gap-1.5 mt-0.5">
              <span>Gemini 2.5</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>
        </div>

        <div 
          onClick={() => setActiveView('organizer')}
          className="p-4 rounded-xl border border-proton-border bg-proton-card/30 hover:bg-proton-card/70 transition-all cursor-pointer group flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <CalendarIcon size={20} />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase font-bold text-proton-muted">
              {language === 'ka' ? 'დავალებები' : 'Task Manager'}
            </div>
            <div className="text-sm font-extrabold text-proton-text flex items-center gap-1 mt-0.5">
              <span>{language === 'ka' ? 'ორგანიზატორი' : 'Organizer'}</span>
              <ArrowRight size={12} className="text-proton-muted group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        <div 
          onClick={() => setActiveView('clips')}
          className="p-4 rounded-xl border border-proton-border bg-proton-card/30 hover:bg-proton-card/70 transition-all cursor-pointer group flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Video size={20} />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase font-bold text-proton-muted">
              {language === 'ka' ? 'ვიდეო ჰაბი' : 'Clips Hub'}
            </div>
            <div className="text-sm font-extrabold text-proton-text flex items-center gap-1 mt-0.5">
              <span>{language === 'ka' ? 'კლიპების ლენტა' : 'Video Feed'}</span>
              <ArrowRight size={12} className="text-proton-muted group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
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
          
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border active:scale-95 cursor-pointer",
              showConfig 
                ? "bg-proton-accent text-proton-bg border-proton-accent font-black" 
                : "bg-proton-card/50 hover:bg-proton-card border-proton-border text-proton-muted hover:text-proton-text font-bold"
            )}
          >
            <SlidersHorizontal size={12} />
            {language === 'ka' ? 'ვიჯეტების მორგება' : 'Customize Widgets'}
          </button>
        </div>

        {/* Dynamic Widget Customizer Panel */}
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-5 rounded-3xl border border-proton-border bg-proton-card/20 backdrop-blur-md space-y-4 overflow-hidden"
          >
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
                <button
                  type="button"
                  onClick={showAllWidgets}
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[9px] font-bold text-proton-accent uppercase tracking-wider transition-all cursor-pointer"
                >
                  {language === 'ka' ? 'ყველა' : 'Show All'}
                </button>
                <button
                  type="button"
                  onClick={showEssentialOnly}
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[9px] font-bold text-proton-muted hover:text-proton-text uppercase tracking-wider transition-all cursor-pointer"
                >
                  {language === 'ka' ? 'ძირითადი' : 'Essential Only'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {gateways.map((gate) => {
                const isVisible = visibleWidgets.includes(gate.id);
                const GateIcon = gate.icon;
                return (
                  <button
                    key={gate.id}
                    type="button"
                    onClick={() => toggleWidget(gate.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all text-left group active:scale-95 cursor-pointer",
                      isVisible 
                        ? "bg-proton-accent/5 border-proton-accent/40 text-proton-text" 
                        : "bg-transparent border-proton-border/40 text-proton-muted hover:border-proton-border"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0",
                      isVisible 
                        ? "bg-proton-accent/10 border-proton-accent/20 text-proton-accent" 
                        : "bg-zinc-900 border-zinc-800 text-zinc-600"
                    )}>
                      <GateIcon size={16} />
                    </div>
                    
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
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gateways.filter(gate => visibleWidgets.includes(gate.id)).map((gate) => {
            const IconComponent = gate.icon;
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
                  boxShadow: "0 25px 40px rgba(0,0,0,0.4)"
                }}
                whileTap={{ scale: 0.985 }}
                className={cn(
                  "bg-proton-card/40 hover:bg-proton-card/80 border rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 group shadow-lg cursor-pointer overflow-hidden relative",
                  gate.glowClass
                )}
                onClick={gate.action}
              >
                {/* Visual Accent glow line */}
                <div className={cn(
                  "absolute top-0 left-0 w-full h-1 bg-gradient-to-r opacity-50 transition-opacity duration-300 group-hover:opacity-100",
                  gate.color === 'cyan' ? 'from-cyan-500/50 to-transparent' :
                  gate.color === 'amber' ? 'from-amber-500/50 to-transparent' :
                  gate.color === 'emerald' ? 'from-emerald-500/50 to-transparent' :
                  gate.color === 'purple' ? 'from-purple-500/50 to-transparent' :
                  'from-proton-accent/50 to-transparent'
                )} />

                <div className="space-y-4 w-full">
                  <div className="flex items-center justify-between w-full">
                    {/* Mode Tag */}
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                      gate.badgeClass
                    )}>
                      {gate.badge}
                    </span>

                    <ArrowUpRight className="text-proton-muted group-hover:text-proton-text group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" size={16} />
                  </div>

                  {/* Header Title & Icon */}
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0 border border-transparent",
                      gate.iconClass
                    )}>
                      <IconComponent size={24} />
                    </div>
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
                <div className="mt-6 pt-4 border-t border-proton-border/30 flex flex-wrap gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                  {gate.shortcuts.map((sc, i) => (
                    <motion.button
                      key={i}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (gate.id === 'business' || gate.id === 'creative' || gate.id === 'market') {
                          setUiMode(gate.id, sc.view as any);
                        } else {
                          setActiveView(sc.view as any);
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm border transition-all cursor-pointer",
                        gate.color === 'cyan' ? 'bg-cyan-500/5 text-cyan-400 border-cyan-500/10 hover:bg-cyan-500 hover:text-black' :
                        gate.color === 'amber' ? 'bg-amber-500/5 text-amber-400 border-amber-500/10 hover:bg-amber-500 hover:text-black' :
                        gate.color === 'emerald' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10 hover:bg-emerald-500 hover:text-black' :
                        gate.color === 'purple' ? 'bg-purple-500/5 text-purple-400 border-purple-500/10 hover:bg-purple-500 hover:text-white' :
                        'bg-proton-accent/5 text-proton-accent border-proton-accent/10 hover:bg-proton-accent hover:text-proton-on-accent'
                      )}
                    >
                      {sc.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
});

DashboardView.displayName = 'DashboardView';

