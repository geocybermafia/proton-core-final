import React, { useState } from 'react';
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
import { Persona, View, GlobalAiSettings, Theme, GeminiMetadata } from '../types';
import { SystemStatusBadge } from './SystemStatusBadge';
import { SystemHealthState } from '../hooks/useSystemHealth';
import { 
  ProtonCard, 
  ProtonButton, 
  ProtonInput, 
  ProtonBadge, 
  ProtonIconBox 
} from '../ui';

export const DashboardView = React.memo(({ 
  setActiveView, 
  language = 'en',
  setUiMode,
  aiSettings,
  setAiSettings,
  personas = [],
  systemHealth
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
  setAiSettings: React.Dispatch<React.SetStateAction<GlobalAiSettings>>,
  systemHealth?: SystemHealthState
}) => {
  const t = translations[language];

  // Quick Command Search State
  const [quickQuery, setQuickQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
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

  // Telemetry Chart Datasets
  const telemetryDataMap = {
    '24h': [
      { time: '00:00', requests: 14, tokens: 2800, latency: 22 },
      { time: '04:00', requests: 9, tokens: 1900, latency: 20 },
      { time: '08:00', requests: 42, tokens: 8900, latency: 31 },
      { time: '12:00', requests: 78, tokens: 16200, latency: 27 },
      { time: '16:00', requests: 95, tokens: 22100, latency: 34 },
      { time: '20:00', requests: 61, tokens: 13400, latency: 25 },
      { time: '23:59', requests: 48, tokens: 10200, latency: 23 },
    ],
    '7d': [
      { time: 'Mon', requests: 280, tokens: 58000, latency: 26 },
      { time: 'Tue', requests: 340, tokens: 72000, latency: 24 },
      { time: 'Wed', requests: 410, tokens: 89000, latency: 29 },
      { time: 'Thu', requests: 390, tokens: 84000, latency: 27 },
      { time: 'Fri', requests: 480, tokens: 104000, latency: 30 },
      { time: 'Sat', requests: 220, tokens: 46000, latency: 21 },
      { time: 'Sun', requests: 190, tokens: 39000, latency: 20 },
    ],
    '30d': [
      { time: 'W1', requests: 1800, tokens: 390000, latency: 25 },
      { time: 'W2', requests: 2200, tokens: 480000, latency: 28 },
      { time: 'W3', requests: 2600, tokens: 570000, latency: 26 },
      { time: 'W4', requests: 2950, tokens: 630000, latency: 24 },
    ]
  };

  const currentChartData = telemetryDataMap[chartTimeframe];

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
• Neural analysis completed across active workspace nodes.
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
      >
        <ProtonCard
          variant="default"
          padding="none"
          className="p-6 md:p-8 sm:rounded-3xl bg-gradient-to-br from-proton-card via-proton-card/90 to-proton-accent/5 shadow-2xl space-y-6 duration-300"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-proton-accent/10 rounded-full blur-[100px] pointer-events-none -mr-20 -mt-20" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-6 relative z-10">
            <div className="space-y-3 text-left flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <ProtonBadge variant="surface-accent" size="md" ping>
                  {language === 'ka' ? 'ციფრული სამუშაო სივრცე' : 'DIGITAL WORKSPACE'}
                </ProtonBadge>
                {systemHealth && (
                  <SystemStatusBadge 
                    status={systemHealth.status} 
                    latency={systemHealth.latency} 
                    language={language}
                    size="sm"
                    onClick={() => systemHealth.checkHealth()}
                  />
                )}
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
            <ProtonInput 
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder={language === 'ka' 
                ? 'ჩაწერეთ შეკითხვა AI-სთვის ან მოძებნეთ ფუნქცია...' 
                : 'Ask AI anything or launch a workflow...'}
              leftIcon={<Sparkles className="text-proton-accent animate-pulse" size={18} />}
              className="pr-28 py-3.5 bg-proton-bg/80 border-proton-accent/30 shadow-inner"
              rightElement={
                <ProtonButton 
                  type="submit"
                  size="sm"
                  leftIcon={<Zap size={14} />}
                >
                  {language === 'ka' ? 'გაგზავნა' : 'Ask'}
                </ProtonButton>
              }
            />

            {/* Quick Action Chips */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-[10px] font-mono uppercase text-proton-muted font-bold mr-1">
                {language === 'ka' ? 'სწრაფი ბრძანებები:' : 'Quick Shortcuts:'}
              </span>
              <ProtonButton 
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => setActiveView('personas')}
                leftIcon={<Bot size={11} />}
                className="py-1 px-2.5 text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20"
              >
                {language === 'ka' ? 'AI ჩატი' : 'AI Assistant'}
              </ProtonButton>
              <ProtonButton 
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => setUiMode('creative', 'image')}
                leftIcon={<Image size={11} />}
                className="py-1 px-2.5 text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
              >
                {language === 'ka' ? 'სურათის შექმნა' : 'Generate Visual'}
              </ProtonButton>
              <ProtonButton 
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => setActiveView('organizer')}
                leftIcon={<CalendarIcon size={11} />}
                className="py-1 px-2.5 text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20"
              >
                {language === 'ka' ? 'დავალებები' : 'Tasks'}
              </ProtonButton>
              <ProtonButton 
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => setActiveView('clips')}
                leftIcon={<Video size={11} />}
                className="py-1 px-2.5 text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
              >
                {language === 'ka' ? 'კლიპები' : 'Clips'}
              </ProtonButton>
            </div>
          </form>

          {/* Live Instant AI Response Box */}
          <AnimatePresence>
            {(isAiThinking || aiResponse) && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="pt-4 border-t border-proton-border/30"
              >
                <ProtonCard variant="glass" padding="default" className="relative space-y-3 border-proton-accent/40 bg-proton-card/90 backdrop-blur-xl">
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
                    <div className="flex items-center gap-3 py-4 text-xs font-mono text-proton-muted">
                      <span className="w-2 h-2 rounded-full bg-proton-accent animate-ping" />
                      <span>Analyzing system telemetry, neural memory nodes, and context...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs font-mono text-proton-text whitespace-pre-line leading-relaxed p-3 bg-proton-bg/60 rounded-xl border border-proton-border/40">
                        {aiResponse}
                      </div>
                      
                      <div className="flex items-center justify-end pt-1">
                        <ProtonButton
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setAiResponse(null);
                            setActiveView('personas');
                          }}
                          rightIcon={<ArrowRight size={13} />}
                          className="text-xs py-1.5 font-mono uppercase tracking-wider"
                        >
                          {language === 'ka' ? 'გადადი AI ასისტენტებში' : 'Navigate to AI Companions'}
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

      {/* Live Workspace Overview Metrics Bar */}
      <motion.div 
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0 }
        }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        <ProtonCard 
          variant="interactive"
          padding="compact"
          onClick={() => setActiveView('personas')}
          className="flex items-center gap-3.5"
        >
          <ProtonIconBox variant="accent" size="md" className="group-hover:scale-110">
            <Bot size={20} />
          </ProtonIconBox>
          <div>
            <div className="text-[10px] font-mono uppercase font-bold text-proton-muted">
              {language === 'ka' ? 'AI ასისტენტები' : 'AI Companions'}
            </div>
            <div className="text-base font-extrabold text-proton-text flex items-center gap-1.5 mt-0.5">
              <span>{personas.length || 8}</span>
              <ProtonBadge variant="emerald" size="sm">
                {language === 'ka' ? 'აქტიური' : 'Active'}
              </ProtonBadge>
            </div>
          </div>
        </ProtonCard>

        <ProtonCard 
          variant="subtle" 
          padding="compact" 
          className="flex items-center gap-3.5 cursor-pointer hover:border-proton-accent/40 transition-all"
          onClick={() => systemHealth?.checkHealth()}
        >
          <ProtonIconBox 
            variant={systemHealth?.status === 'optimal' ? 'emerald' : systemHealth?.status === 'degraded' ? 'amber' : 'rose'} 
            size="md"
          >
            <Activity size={20} />
          </ProtonIconBox>
          <div>
            <div className="text-[10px] font-mono uppercase font-bold text-proton-muted">
              {language === 'ka' ? 'სისტემის სტატუსი' : 'System Health'}
            </div>
            <div className="text-sm font-extrabold text-proton-text flex items-center gap-1.5 mt-0.5">
              <SystemStatusBadge 
                status={systemHealth?.status || 'optimal'} 
                latency={systemHealth?.latency} 
                language={language}
                size="sm"
              />
            </div>
          </div>
        </ProtonCard>

        <ProtonCard 
          variant="interactive"
          padding="compact"
          onClick={() => setActiveView('organizer')}
          className="flex items-center gap-3.5"
        >
          <ProtonIconBox variant="purple" size="md" className="group-hover:scale-110">
            <CalendarIcon size={20} />
          </ProtonIconBox>
          <div>
            <div className="text-[10px] font-mono uppercase font-bold text-proton-muted">
              {language === 'ka' ? 'დავალებები' : 'Task Manager'}
            </div>
            <div className="text-sm font-extrabold text-proton-text flex items-center gap-1 mt-0.5">
              <span>{language === 'ka' ? 'ორგანიზატორი' : 'Organizer'}</span>
              <ArrowRight size={12} className="text-proton-muted group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </ProtonCard>

        <ProtonCard 
          variant="interactive"
          padding="compact"
          onClick={() => setActiveView('clips')}
          className="flex items-center gap-3.5"
        >
          <ProtonIconBox variant="rose" size="md" className="group-hover:scale-110">
            <Video size={20} />
          </ProtonIconBox>
          <div>
            <div className="text-[10px] font-mono uppercase font-bold text-proton-muted">
              {language === 'ka' ? 'ვიდეო ჰაბი' : 'Clips Hub'}
            </div>
            <div className="text-sm font-extrabold text-proton-text flex items-center gap-1 mt-0.5">
              <span>{language === 'ka' ? 'კლიპების ლენტა' : 'Video Feed'}</span>
              <ArrowRight size={12} className="text-proton-muted group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
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

