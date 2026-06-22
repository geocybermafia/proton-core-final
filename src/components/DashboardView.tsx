import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building, 
  Palette, 
  ShoppingBag, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  Grid, 
  Sparkles, 
  Terminal, 
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
  chatHistory: any[],
  language: 'en' | 'ka',
  user: any,
  uiMode: 'business' | 'creative' | 'market',
  setUiMode: (m: 'business' | 'creative' | 'market') => void,
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

  // Forensic Telemetry Diagnostics & Threat Audit State
  const [forensicLogs, setForensicLogs] = useState<{ id: string; timestamp: string; category: string; message: string; severity: 'info' | 'warn' | 'success' | 'alert' }[]>([
    { id: '1', timestamp: new Date().toISOString().slice(11, 19), category: 'SYS_INT', message: 'VFS Cryptographic Integrity check: 100% UNCOMPROMISED', severity: 'success' },
    { id: '2', timestamp: new Date().toISOString().slice(11, 19), category: 'AUTH_LEDG', message: 'Federated security credentials rotation event logged successfully', severity: 'info' },
    { id: '3', timestamp: new Date().toISOString().slice(11, 19), category: 'NET_GATE', message: 'Gemini security conduit handshake fully synchronized with host', severity: 'success' },
    { id: '4', timestamp: new Date().toISOString().slice(11, 19), category: 'INTELL', message: 'Continuous deep-forensic packet sniffing and threat matrix diagnostics active', severity: 'info' }
  ]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [nodePing, setNodePing] = useState(25);

  const triggerAudit = useCallback(() => {
    if (isAuditing) return;
    setIsAuditing(true);
    setNodePing(Math.floor(Math.random() * 10) + 12);
    
    const logsToAdd = [
      { category: 'MEM_TRACE', message: language === 'ka' ? 'RAM დიაგნოსტიკა: რეგისტრის ადრესაცია [0x7FFA8301B] დადასტურებულია' : 'Volatile memory registers traced: core register address [0x7FFA8301B] confirmed.', severity: 'info' as const },
      { category: 'PORT_MON', message: language === 'ka' ? 'დესკტოპის პორტ 3000-ის უსაფრთხო თრაფიკის ტესტირება: OK' : 'Local port 3000 ingress transit validation passed securely.', severity: 'success' as const },
      { category: 'SHA_CHCK', message: language === 'ka' ? 'Blueprints ბიბლიოთეკის მთლიანობის შემოწმება (SHA-256 ვერიფიცირებულია)' : 'Workspace blueprint library cryptographic signature matched (SHA-256 hash valid).', severity: 'success' as const },
      { category: 'CRIT_SEC', message: language === 'ka' ? 'უსაფრთხოების კონტური: შემოწმება დასრულებულია, უცხო ძალების კვალი არ არის' : 'Tactical security scan completed: zero malicious intrusion vectors identified.', severity: 'alert' as const }
    ];

    logsToAdd.forEach((log, index) => {
      setTimeout(() => {
        setForensicLogs(prev => [
          {
            id: String(Date.now() + index),
            timestamp: new Date().toISOString().slice(11, 19),
            ...log
          },
          ...prev.slice(0, 5)
        ]);
        if (index === logsToAdd.length - 1) {
          setIsAuditing(false);
        }
      }, (index + 1) * 750);
    });
  }, [isAuditing, language]);

  // Beautiful curated titles & metrics for the 5 Gateways
  const gateways = [
    {
      id: 'business',
      title: language === 'ka' ? 'ბიზნეს პორტალი' : 'Business Suite',
      badge: 'Multi-Agent & Automation',
      desc: language === 'ka' 
        ? 'ბიზნეს აგენტების მართვა, სტრატეგიული ანალიზი და ავტომატიზებული სამუშაო ხაზები (Workflows).'
        : 'Enterprise multi-agent coordinate, automated workflows, strategic blueprints, and target plans.',
      icon: Building,
      color: 'cyan',
      glowClass: 'border-cyan-500/20 hover:border-cyan-500/80 shadow-cyan-500/5 hover:shadow-cyan-500/20',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      iconClass: 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'აგენტების კატალოგი' : 'AI Agents', view: 'personas' },
        { label: language === 'ka' ? 'სამუშაო პროცესები' : 'Blueprints', view: 'blueprints' }
      ],
      action: () => setUiMode('business')
    },
    {
      id: 'creative',
      title: language === 'ka' ? 'კრეატიული სტუდია' : 'Creative Studio',
      badge: 'Visual Arts & Localization',
      desc: language === 'ka'
        ? 'მაღალი ხარისხის ილუსტრაციების გენერაცია, ორენოვანი სათარჯიმნო კაბინეტი და სარეკლამო კოპირაიტინგი.'
        : 'Generate vector arts, copy poetic branding prompts, and launch modular face-to-face translation screens.',
      icon: Palette,
      color: 'amber',
      glowClass: 'border-amber-500/20 hover:border-amber-500/80 shadow-amber-500/5 hover:shadow-amber-500/20',
      badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      iconClass: 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'ვიზუალური გენერატორი' : 'Art Studio', view: 'image' },
        { label: language === 'ka' ? 'ორენოვანი მთარგმნელი' : 'Live Translator', view: 'translator' }
      ],
      action: () => {
        setUiMode('creative');
        setActiveView('image');
      }
    },
    {
      id: 'market',
      title: language === 'ka' ? 'პროტონ მარკეტი' : 'Proton Market',
      badge: 'P2P Trading & Registry',
      desc: language === 'ka'
        ? 'განათავსეთ განცხადებები, მართეთ მომსახურებების რეესტრი, შეიძინეთ ან გაყიდეთ ნივთები.'
        : 'Post dynamic listings, browse regional services or goods, track active ledger transactions, and trade.',
      icon: ShoppingBag,
      color: 'emerald',
      glowClass: 'border-emerald-500/20 hover:border-emerald-500/80 shadow-emerald-500/5 hover:shadow-emerald-500/20',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      iconClass: 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'მარკეტის დათვალიერება' : 'Browse listings', view: 'market-hub' }
      ],
      action: () => {
        setUiMode('market');
        setActiveView('market-hub');
      }
    },
    {
      id: 'organizer',
      title: language === 'ka' ? 'ამოცანების მმართველი' : 'Task Organizer',
      badge: 'Smart Agenda & Calendar',
      desc: language === 'ka'
        ? 'აკონტროლეთ ყოველდღიური საქმეები, მართეთ ენერგეტიკული ბალანსი და სამუშაო კალენდარი.'
        : 'Organize daily tasks, log personal workflows, set priorities, and track active work schedules.',
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
      title: language === 'ka' ? 'ფინანსური პორტალი' : 'Finance Ledger',
      badge: 'Capital Flow & Distribution',
      desc: language === 'ka'
        ? 'გაანაწილეთ კაპიტალი, აწარმოეთ ტრანზაქციების ჟურნალი და თვალი ადევნეთ საინვესტიციო აქტივებს.'
        : 'Track global currency balances, record transaction vouchers, and trace localized investment progress.',
      icon: TrendingUp,
      color: 'amber',
      glowClass: 'border-amber-500/20 hover:border-amber-500/80 shadow-amber-500/5 hover:shadow-amber-500/20',
      badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      iconClass: 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-black',
      shortcuts: [
        { label: language === 'ka' ? 'ფინანსების მართვა' : 'Ledger view', view: 'finance' }
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
              {language === 'ka' ? 'ცენტრალური კრიპტო-საკონტროლო სადგური' : 'CENTRAL FORENSICS CONSOLE'}
            </div>
            
            <h1 className="font-black tracking-tighter uppercase leading-none text-4xl sm:text-5xl md:text-6xl text-proton-text">
              {language === 'ka' ? 'PROTON OPERATIONAL HUB' : 'PROTON CORE SYSTEM'}
            </h1>
            
            <p className="text-proton-muted font-medium max-w-2xl text-sm sm:text-base leading-relaxed">
              {language === 'ka' 
                ? 'ავტორიზებული კავშირი დამყარებულია. მართეთ შეღწევადობის კვანძები, ანალიტიკური აგენტები და ადგილობრივი მონაცემთა ნაკადები კლინიკური სიზუსტით.'
                : 'Authenticated uplink stabilized. Execute complex cybersecurity analytics, direct system agents, and govern state ledgers with tactical precision.'}
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
            {language === 'ka' ? 'საოპერაციო კარიბჭეები' : 'TACTICAL SECTORS AVAILABLE'}
          </h2>
          <p className="text-[10px] text-proton-muted font-mono uppercase tracking-widest mt-1">
            {language === 'ka' ? 'იდენტიფიცირებული დაცული არხები' : 'Garded communication channels and integrated workflows'}
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
                      onClick={() => setActiveView(sc.view as any)}
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

      {/* Cyber-Forensics Clinical Diagnostics & Integrity Ledger */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-mono font-black uppercase tracking-[0.3em] text-proton-accent">
              {language === 'ka' ? 'უსაფრთხოების დიაგნოსტიკა და კრიპტოგრაფიული ტერმინალი' : 'SECURITY DIAGNOSTICS & CRYPTO TERMINAL'}
            </h2>
            <p className="text-[10px] text-proton-muted font-mono uppercase tracking-widest mt-1">
              {language === 'ka' ? 'ცენტრალური კვანძების მთლიანობის უწყვეტი მონიტორი' : 'Continuous cryptographic event tracking'}
            </p>
          </div>
          
          <button
            onClick={triggerAudit}
            disabled={isAuditing}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[9px] font-mono font-black uppercase tracking-wider border select-none transition-all active:scale-95 flex items-center gap-2",
              isAuditing 
                ? "bg-proton-accent/5 text-proton-accent/50 border-proton-accent/20 cursor-wait" 
                : "bg-proton-accent/10 text-proton-accent border-proton-accent/20 hover:bg-proton-accent hover:text-proton-bg"
            )}
          >
            <Terminal size={14} className={cn(isAuditing && "animate-spin")} />
            {isAuditing 
              ? (language === 'ka' ? 'მიმდინარეობს ანალიზი...' : 'Executing forensic trace...')
              : (language === 'ka' ? 'უსაფრთხოების ტესტირება' : 'Run Tactical Audit')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Diagnostic Metrics Matrix */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-4">
            <div className="bg-proton-card/10 border border-proton-border p-5 rounded-3xl flex flex-col justify-between">
              <div className="text-[9px] font-mono font-black text-proton-muted uppercase tracking-widest">
                {language === 'ka' ? 'სისტემის დაცულობა' : 'CORE INTEGRITY'}
              </div>
              <div className="mt-4">
                <div className="text-2xl font-black font-mono tracking-tight text-emerald-400">
                  99.98%
                </div>
                <div className="text-[9px] font-mono text-proton-muted uppercase tracking-wide mt-1">
                  {language === 'ka' ? 'სტაბილური / დაცული' : 'STATUS: SECURE'}
                </div>
              </div>
            </div>

            <div className="bg-proton-card/10 border border-proton-border p-5 rounded-3xl flex flex-col justify-between">
              <div className="text-[9px] font-mono font-black text-proton-muted uppercase tracking-widest">
                {language === 'ka' ? 'კონდუიტის შეყოვნება' : 'API LATENCY'}
              </div>
              <div className="mt-4">
                <div className="text-2xl font-black font-mono tracking-tight text-cyan-400">
                  {nodePing}ms
                </div>
                <div className="text-[9px] font-mono text-proton-muted uppercase tracking-wide mt-1">
                  {language === 'ka' ? 'ოპტიმალური' : 'GATEWAY DELAY'}
                </div>
              </div>
            </div>

            <div className="bg-proton-card/10 border border-proton-border p-5 rounded-3xl flex flex-col justify-between">
              <div className="text-[9px] font-mono font-black text-proton-muted uppercase tracking-widest">
                {language === 'ka' ? 'აქტიური პორტი' : 'COMMS PORT'}
              </div>
              <div className="mt-4">
                <div className="text-2xl font-black font-mono tracking-tight text-amber-500">
                  3000
                </div>
                <div className="text-[9px] font-mono text-proton-muted uppercase tracking-wide mt-1">
                  {language === 'ka' ? 'შიდა NGINX' : 'HOST TUNNEL'}
                </div>
              </div>
            </div>

            <div className="bg-proton-card/10 border border-proton-border p-5 rounded-3xl flex flex-col justify-between">
              <div className="text-[9px] font-mono font-black text-proton-muted uppercase tracking-widest">
                {language === 'ka' ? 'VFS ჰეში' : 'VFS SIGNATURE'}
              </div>
              <div className="mt-4">
                <div className="text-xs font-black font-mono tracking-tight text-purple-400 truncate">
                  SHA-256//VALID
                </div>
                <div className="text-[9px] font-mono text-proton-muted uppercase tracking-wide mt-1">
                  {language === 'ka' ? 'VFS გარემო სტაბილურია' : 'LOCAL CACHE UNPERMUTED'}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Forensics Log */}
          <div className="lg:col-span-8 bg-black/90 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] border border-proton-border p-6 rounded-[36px] font-mono text-xs text-proton-muted/90 flex flex-col justify-between min-h-[220px] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-proton-accent/5 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex items-center justify-between border-b border-proton-border/30 pb-3 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-proton-accent animate-ping" />
                <span className="text-[10px] uppercase font-black tracking-widest text-proton-accent">OPERATIVE FORENSIC TRAFFIC FEED</span>
              </div>
              <span className="text-[9px] text-proton-muted/40 font-bold uppercase tracking-widest">ACTIVE PORT SNIFFING</span>
            </div>

            <div className="space-y-2 flex-grow overflow-y-auto max-h-[160px] custom-scrollbar-minimal pr-1">
              <AnimatePresence initial={false}>
                {forensicLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-3 select-text py-0.5 border-b border-white/[0.02]"
                  >
                    <span className="text-proton-muted/40 font-bold shrink-0">{log.timestamp}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest shrink-0 uppercase",
                      log.severity === 'success' ? "bg-emerald-500/10 text-emerald-400" :
                      log.severity === 'alert' ? "bg-red-500/10 text-red-400" :
                      log.severity === 'warn' ? "bg-amber-500/10 text-amber-500" :
                      "bg-cyan-500/10 text-cyan-400"
                    )}>
                      {log.category}
                    </span>
                    <span className="text-[11px] font-bold text-zinc-300 leading-relaxed break-all">
                      {log.message}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
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
              {language === 'ka' ? 'ინტელექტის მართვის რეჟიმი' : 'AI Intelligence Engine'}
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
