import React from 'react';
import { motion } from 'framer-motion';
import { 
  Building, 
  Palette, 
  ShoppingBag, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  Grid, 
  Sparkles, 
  ArrowUpRight 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import { Persona, View, GlobalAiSettings, Theme, GeminiMetadata } from '../types';

export const DashboardView = React.memo(({ 
  setActiveView, 
  language = 'en',
  setUiMode,
  aiSettings,
  setAiSettings
}: { 
  personas: Persona[], 
  activeView: View, 
  setActiveView: (v: View) => void,
  chatHistory: any,
  language: 'en' | 'ka',
  user: any,
  uiMode: 'business' | 'creative' | 'market',
  setUiMode: (m: 'business' | 'creative' | 'market', targetView?: View) => void,
  aiSettings: GlobalAiSettings,
  setLastGeminiMetadata: (m: GeminiMetadata | null) => void,
  trackFirestore: <T>(promise: Promise<T>) => Promise<T>,
  isCreativeMode: boolean,
  theme: Theme,
  setTheme: (t: Theme) => void,
  isSystemActive: boolean,
  setAiSettings: React.Dispatch<React.SetStateAction<GlobalAiSettings>>
}) => {
  const t = translations[language];

  // Beautiful curated titles & metrics for the 5 Gateways
  const gateways = [
    {
      id: 'business',
      title: language === 'ka' ? 'ბიზნეს პორტალი' : 'Business Suite',
      badge: language === 'ka' ? 'ბიზნესის მართვა' : 'Business Management',
      desc: language === 'ka' 
        ? 'ბიზნეს პროცესების მართვა, სტრატეგიული გეგმები და გუნდური როლები.'
        : 'Manage business processes, strategic planning, and customized team roles.',
      icon: Building,
      color: 'cyan',
      glowClass: 'border-cyan-500/20 hover:border-cyan-500/80 shadow-cyan-500/5 hover:shadow-cyan-500/20',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      iconClass: 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'როლები და აგენტები' : 'Roles & Agents', view: 'personas' },
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
      className="space-y-12 pb-20 max-w-6xl mx-auto px-4"
    >
      {/* Elegantly Crafted Hub Hero Section */}
      <motion.div 
        variants={{
          hidden: { opacity: 0, y: 30 },
          visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
        }}
        className="p-8 md:p-12 rounded-[40px] border border-proton-border bg-gradient-to-br from-proton-accent/5 via-transparent to-transparent shadow-2xl relative overflow-hidden transition-all duration-500 animate-in fade-in"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-proton-accent/10 rounded-full blur-[100px] pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col md:flex-row items-center justify-between w-full gap-8 relative z-10">
          <div className="space-y-3 text-center md:text-left flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-mono font-black uppercase tracking-[0.2em] bg-zinc-900 text-proton-accent border border-zinc-800">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              {language === 'ka' ? 'სამუშაო სივრცის მართვის დაფა' : 'WORKSPACE OVERVIEW PANEL'}
            </div>
            
            <h1 className="font-black tracking-tighter uppercase leading-none text-4xl sm:text-5xl md:text-6xl text-proton-text">
              {language === 'ka' ? 'PROTON WORKSPACE HUB' : 'PROTON WORKSPACE HUB'}
            </h1>
            
            <p className="text-proton-muted font-medium max-w-2xl text-sm sm:text-base leading-relaxed">
              {language === 'ka' 
                ? 'მოგესალმებით თქვენს პერსონალურ სამუშაო სივრცეში. მართეთ ბიზნეს აგენტები, კრეატიული სტუდია, პროდუქტების ბაზარი, ყოველდღიური ამოცანები და ფინანსები ერთიან, დაცულ გარემოში.'
                : 'Welcome to your multi-functional workspace. Coordinate business agents, explore creative design studios, trade in the peer-to-peer market, organize your daily tasks, and track financial ledgers.'}
            </p>
          </div>
          
          <div className="flex items-center shrink-0">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 90 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-proton-accent/5 flex items-center justify-center border border-proton-accent/10 backdrop-blur-sm shadow-inner cursor-pointer"
            >
              <Grid className="text-proton-accent animate-spin" style={{ animationDuration: '40s' }} size={32} />
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Main Gateways Portal Grid */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-mono font-black uppercase tracking-[0.3em] text-proton-accent">
            {language === 'ka' ? 'სამუშაო სექციები' : 'AVAILABLE MODULES'}
          </h2>
          <p className="text-[10px] text-proton-muted font-mono uppercase tracking-widest mt-1">
            {language === 'ka' ? 'აირჩიეთ სასურველი მოდული ყოველდღიური საქმიანობის სამართავად' : 'Select a gateway module to manage your workspace workflows'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gateways.map((gate) => {
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
                  "bg-proton-card/30 hover:bg-proton-card/70 border rounded-[36px] p-6 flex flex-col justify-between transition-all duration-300 group shadow-lg cursor-pointer overflow-hidden relative",
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

      {/* Interactive AI Simulation / Settings footer */}
      <div className={cn(
        "p-6 rounded-[32px] border transition-all select-none relative overflow-hidden shadow-xl flex flex-col md:flex-row items-center justify-between gap-6",
        aiSettings.useSimulatedAi 
          ? "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/40 shadow-amber-500/5" 
          : "bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent border-proton-border/80"
      )}>
        <div className="flex items-center gap-5">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0",
            aiSettings.useSimulatedAi ? "bg-amber-500 text-proton-bg shadow-lg shadow-amber-500/25" : "bg-cyan-500 text-proton-bg shadow-lg shadow-cyan-500/25"
          )}>
            <Sparkles className={cn(aiSettings.useSimulatedAi && "animate-pulse")} size={22} />
          </div>
          <div className="space-y-1 text-left">
            <h4 className="text-sm font-black uppercase tracking-wider text-proton-text flex items-center gap-2">
              {language === 'ka' ? 'AI ასისტენტის რეჟიმი' : 'AI Assistant Mode'}
              <span className={cn(
                "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                aiSettings.useSimulatedAi 
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                  : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
              )}>
                {aiSettings.useSimulatedAi ? (language === 'ka' ? 'სიმულაცია' : 'Simulation Mode') : (language === 'ka' ? 'ღრუბლოვანი' : 'Cloud Live')}
              </span>
            </h4>
            <p className="text-[11px] text-proton-muted font-bold leading-relaxed max-w-xl">
              {aiSettings.useSimulatedAi 
                ? (language === 'ka' 
                  ? 'აქტიურია პორტატული საცდელი რეჟიმი. პასუხები გენერირდება ლოკალურად — API კვოტების შეზღუდვისა და დაყოვნების გარეშე.' 
                  : 'Playground Active. AI responses are processed locally with 0 delay, completely avoiding quota rate limits.')
                : (language === 'ka' 
                   ? 'აქტიურია Google Gemini ღრუბლოვანი სერვერი. თუ მიიღებთ 429 შეცდომას, შეგიძლიათ ნებისმიერ დროს გადახვიდეთ სიმულაციურ რეჟიმში.' 
                   : 'Direct Google Gemini cloud API connection. If you experience quota exhaustion, toggle simulation mode to resume instantly.')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAiSettings(prev => ({ ...prev, useSimulatedAi: !prev.useSimulatedAi }))}
          className={cn(
            "w-full md:w-auto px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 active:scale-95 shadow-md",
            aiSettings.useSimulatedAi 
              ? "bg-amber-500 border-amber-500 text-proton-bg hover:bg-amber-600 shadow-amber-500/20"
              : "bg-transparent border-proton-border text-proton-muted hover:border-cyan-405 hover:text-cyan-400"
          )}
        >
          {aiSettings.useSimulatedAi 
            ? (language === 'ka' ? 'გადართე Live რეჟიმში' : 'Switch to Live Cloud') 
            : (language === 'ka' ? 'ჩართე საცდელი რეჟიმი' : 'Enable Simulation')}
        </button>
      </div>
    </motion.div>
  );
});

DashboardView.displayName = 'DashboardView';
