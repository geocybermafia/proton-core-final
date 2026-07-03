import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  ShieldCheck, 
  Globe, 
  Users, 
  ArrowRight, 
  Cpu, 
  Workflow, 
  Layout, 
  Activity,
  ChevronRight,
  Star,
  BookOpen,
  Boxes,
  HelpCircle,
  Terminal,
  Sparkles,
  ShoppingBag,
  UserCheck,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { translations } from '../translations';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
  language: 'en' | 'ka';
  onLanguageChange: (lang: 'en' | 'ka') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin, language, onLanguageChange }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mockActiveTab, setMockActiveTab] = useState<'dashboard' | 'assistants' | 'blueprints' | 'marketplace' | 'translator' | 'organizer'>('dashboard');
  const [scrolled, setScrolled] = useState(false);
  const currentLang = language;

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // @ts-ignore
  const t = translations[currentLang].landing;

  // Comprehensive localized content for detailed sections
  const localContent = {
    en: {
      platform_title: "Explore Features",
      platform_subtitle: "Proton brings together four essential tools designed to work in beautiful harmony under your guiding hand.",
      
      modules: [
        {
          title: "AI Helpers & Companions",
          desc: "Create and chat with specialized assistants. From writing emails to preparing lists, they are configured to help you solve physical or digital tasks securely.",
          icon: Sparkles,
          color: "text-amber-400 border-amber-500/20 bg-amber-500/5"
        },
        {
          title: "Simple Marketplace",
          desc: "Easily sell or buy products, craft items, or professional services. Connect with people around you, track orders, and build trust in your neighborhood.",
          icon: ShoppingBag,
          color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
        },
        {
          title: "Visual Process Planners",
          desc: "Create simple chains of tasks and rules. Make triggers to automate routines, coordinate your schedule, and coordinate steps without any coding experience.",
          icon: Workflow,
          color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5"
        },
        {
          title: "Personal Cabinet & Stats",
          desc: "Keep an eye on active listings, orders, daily stats, and regional settings. A comfortable dashboard where you are in complete control of your workspace.",
          icon: UserCheck,
          color: "text-purple-400 border-purple-500/20 bg-purple-500/5"
        }
      ],

      how_it_works_title: "How Proton Simplifies Your Day",
      how_it_works_subtitle: "A completely transparent, secure, and friendly three-step process built to guide your growth.",
      steps: [
        {
          num: "01",
          title: "Enter Your Workspace",
          desc: "Sign up and build your personal profile. Set your preferred language and operating region so your dashboard instantly feels familiar and cozy."
        },
        {
          num: "02",
          title: "Choose Your Tools",
          desc: "Activate helpful AI assistants and organize your routine tasks visually with our friendly process planners. No complicated settings required."
        },
        {
          num: "03",
          title: "Connect & Grow",
          desc: "Offer your goods or services on the local market, track incoming orders, and let your AI helpers summarize texts or handle daily reminders in the background."
        }
      ],

      faqs_title: "Frequently Asked Questions",
      faqs_subtitle: "Everything you need to know about Proton platforms and capabilities.",
      faqs: [
        {
          q: "What is Proton?",
          a: "Proton is a warm, simple, and fully responsive digital home designed to bring helpful AI assistants, task organizers, and neighborhood trade onto a single screen."
        },
        {
          q: "Who is this platform designed for?",
          a: "It is built for local makers, freelance designers, modern team managers, and anyone who wants to automate daily tasks, list products, and connect in a friendly space."
        },
        {
          q: "Is technical experience required to use these tools?",
          a: "Not at all. Proton offers intuitive visual boards where you can speak to AI, manage items, and design task logic using plain everyday language."
        },
        {
          q: "How safe are orders in the Marketplace?",
          a: "Every transaction and listing is recorded directly in Firestore. Sells and updates are fully synchronized in real-time so both parties have perfect transparency."
        },
        {
          q: "Can I use it on mobile or other languages?",
          a: "Yes! Proton works beautifully on your smartphone, tablet, or desktop. It lets you switch instantly between Georgian (KA) and English (EN) while saving your preferences safely."
        }
      ],

      cta_bottom_title: "Ready to feel at home in your digital workspace?",
      cta_bottom_desc: "Join the Proton community today to organize, automate, and share your project goals with total clarity and absolute ease.",
      cta_bottom_btn: "Open Your Workspace"
    },
    ka: {
      platform_title: "აღმოაჩინე ძირითადი ხელსაწყოები",
      platform_subtitle: "Proton-ი აერთიანებს ოთხ უმნიშვნელოვანეს მოდულს, რომლებიც მუშაობენ სრულ ჰარმონიაში თქვენი ხელმძღვანელობით.",
      
      modules: [
        {
          title: "AI დამხმარეები",
          desc: "შექმენით და გაესაუბრეთ სპეციალიზებულ ასისტენტებს. მეილების წერიდან დაწყებული სიების მომზადებით, ისინი მზად არიან დაგეხმარონ ნებისმიერ საქმეში.",
          icon: Sparkles,
          color: "text-amber-400 border-amber-500/20 bg-amber-500/5"
        },
        {
          title: "მარტივი მარკეტი",
          desc: "განათავსეთ ან შეიძინეთ პროდუქტები, მომსახურება თუ ნივთები. დაუკავშირდით ადამიანებს თქვენს გარშემო და აკონტროლეთ შეკვეთები გამჭვირვალედ.",
          icon: ShoppingBag,
          color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
        },
        {
          title: "მარტივი ორგანიზატორი",
          desc: "მოაწესრიგეთ თქვენი ყოველდღიური საქმეები და გეგმები სულ რაღაც წამებში. შექმენით დავალებების ჯაჭვები ყოველგვარი კოდის წერის გარეშე.",
          icon: Workflow,
          color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5"
        },
        {
          title: "პირადი კაბინეტი და სტატუსი",
          desc: "აკონტროლეთ თქვენი აქტიური განცხადებები, შეკვეთები და ყოველდღიური სტატისტიკა ერთიან, სუფთა და თბილ მართვის სივრცეში.",
          icon: UserCheck,
          color: "text-purple-400 border-purple-500/20 bg-purple-500/5"
        }
      ],

      how_it_works_title: "როგორ გვიმარტივებს Proton ყოველდღიურობას",
      how_it_works_subtitle: "სრულიად გამჭვირვალე, საიმედო და მეგობრული 3-საფეხურიანი გზა თქვენი მიზნების მისაღწევად.",
      steps: [
        {
          num: "01",
          title: "შედი სამუშაო სივრცეში",
          desc: "დარეგისტრირდი და შექმენი პირადი პროფილი. აირჩიე შენთვის საყვარელი ენა და რეგიონი, რათა დეშბორდზე თავი მყუდროდ იგრძნო."
        },
        {
          num: "02",
          title: "აირჩიე შენი ხელსაწყოები",
          desc: "გაააქტიურე მეგობრული AI ასისტენტები და დაგეგმე დავალებები მარტივი ორგანიზატორის საშუალებით, ზედმეტი სირთულეების გარეშე."
        },
        {
          num: "03",
          title: "დაუკავშირდი და განვითარდი",
          desc: "განათავსე შენი ნივთები თუ მომსახურება უბნის მარკეტზე, ადევნე თვალი შეკვეთებს, ხოლო AI დამხმარეები ფონურ რეჟიმში შეგახსენებენ უმნიშვნელოვანეს საქმეებს."
        }
      ],

      faqs_title: "ხშირად დასმული კითხვები",
      faqs_subtitle: "ყველაფერი, რაც გსურს იცოდე Proton პლატფორმისა და შესაძლებლობების შესახებ.",
      faqs: [
        {
          q: "რა არის Proton?",
          a: "Proton არის თბილი, მოსახერხებელი და სრულად ადაპტირებული ციფრული სახლი, რომელიც აერთიანებს AI დამხმარეებს, საქმეების ორგანიზატორსა და მეგობრულ სავაჭრო მარკეტს ერთ ეკრანზე."
        },
        {
          q: "ვისთვის არის განკუთვნილი ეს პლატფორმა?",
          a: "იგი შექმნილია ადგილობრივი ხელოსნებისთვის, დიზაინერებისთვის, გუნდის მენეჯერებისთვის და ნებისმიერი ადამიანისთვის, ვისაც სურს დავალებების გაწერა და კომფორტულ გარემოში კომუნიკაცია."
        },
        {
          q: "საჭიროა თუ არა ტექნიკური გამოცდილება ამ ხელსაწყოების გამოსაყენებლად?",
          a: "სულაც არა. Proton-ი გთავაზობს ინტუიციურ ვიზუალურ დაფებს, სადაც შეგიძლიათ ესაუბროთ AI-ს და დაალაგოთ შეკვეთები უბრალო, სასაუბრო ენით."
        },
        {
          q: "რამდენად უსაფრთხოა მარკეტის შეკვეთები?",
          a: "ყოველი ტრანზაქცია და განცხადება იწერება პირდაპირ Firestore-ში რეალურ დროში, რაც სრულ გამჭვირვალობასა და სიმშვიდეს ანიჭებს როგორც მყიდველს, ისე გამყიდველს."
        },
        {
          q: "შესაძლებელია თუ არა მისი გამოყენება ტელეფონით ან სხვადასხვა ენაზე?",
          a: "დიახ! Proton-ი არაჩვეულებრივად მუშაობს თქვენს სმარტფონში, პლანშეტში თუ კომპიუტერზე, და საშუალებას გაძლევთ წამში გადახვიდეთ ქართულ (KA) ან ინგლისურ (EN) ენაზე."
        }
      ],

      cta_bottom_title: "მზად ხარ იგრძნო თავი საკუთარ სახლში?",
      cta_bottom_desc: "შეუერთდი Proton-ის მეგობრულ საზოგადოებას დღესვე, რათა დაგეგმო, გააერთიანო და განახორციელო შენი მიზნები სრული სიმარტივით.",
      cta_bottom_btn: "გახსენი სამუშაო სივრცე"
    }
  };

  const currentLocalContent = localContent[currentLang] || localContent.en;

  const features = [
    {
      icon: Users,
      title: t.feature_1_title,
      description: t.feature_1_desc,
      color: "text-amber-400",
      bg: "bg-amber-500/10"
    },
    {
      icon: Globe,
      title: t.feature_2_title,
      description: t.feature_2_desc,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10"
    },
    {
      icon: Workflow,
      title: t.feature_3_title,
      description: t.feature_3_desc,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10"
    }
  ];

  return (
    <div id="landing-container" className="min-h-screen bg-proton-bg text-proton-text font-sans overflow-x-hidden selection:bg-proton-accent selection:text-proton-bg">
      {/* Navigation with dynamic scrolled styles */}
      <nav 
        id="landing-navbar" 
        className={cn(
          "fixed top-0 w-full z-[100] transition-all duration-300",
          scrolled 
            ? "border-b border-proton-border/80 bg-proton-bg/95 backdrop-blur-xl h-16 shadow-[0_10px_30px_rgba(0,0,0,0.4)]" 
            : "border-b border-transparent bg-transparent h-24"
        )}
      >
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-proton-accent flex items-center justify-center text-proton-bg shadow-lg shadow-proton-accent/20">
              <Zap size={22} fill="currentColor" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase whitespace-nowrap">Proton AI</span>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Language Switcher */}
            <div id="lang-switcher-row" className="flex bg-proton-card rounded-lg p-1 border border-proton-border">
              <button 
                id="btn-lang-en"
                onClick={() => onLanguageChange('en')}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-black rounded-md transition-all cursor-pointer",
                  language === 'en' ? "bg-proton-accent text-proton-bg" : "text-proton-muted hover:text-proton-text"
                )}
              >
                EN
              </button>
              <button 
                id="btn-lang-ka"
                onClick={() => onLanguageChange('ka')}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-black rounded-md transition-all cursor-pointer",
                  language === 'ka' ? "bg-proton-accent text-proton-bg" : "text-proton-muted hover:text-proton-text"
                )}
              >
                KA
              </button>
            </div>

            <button 
              id="nav-login-btn"
              onClick={onLogin}
              className="text-sm font-bold uppercase tracking-widest text-proton-muted hover:text-proton-text transition-colors cursor-pointer hidden sm:block"
            >
              {t.cta_login}
            </button>
            <button 
              id="nav-start-btn"
              onClick={onGetStarted}
              className="px-6 py-2.5 bg-proton-accent text-proton-bg rounded-xl text-sm font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg shadow-proton-accent/20"
            >
              {t.cta_start}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero-section" className="relative pt-48 pb-24 px-6 overflow-hidden">
        {/* Animated Background Gradients & Grids Container */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{
              scale: [1, 1.15, 1],
              x: [0, 30, 0],
              y: [0, -30, 0],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              repeatType: 'mirror',
              ease: "easeInOut"
            }}
            className="absolute top-0 right-0 w-[320px] h-[320px] sm:w-[800px] sm:h-[800px] bg-proton-accent/5 rounded-full blur-[50px] sm:blur-[160px] -mr-40 -mt-40 pointer-events-none" 
            style={{ willChange: "transform", transform: "translateZ(0)" }}
          />
          <motion.div 
            animate={{
              scale: [1, 1.2, 1],
              x: [0, -40, 0],
              y: [0, 40, 0],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              repeatType: 'mirror',
              ease: "easeInOut"
            }}
            className="absolute bottom-0 left-0 w-[240px] h-[240px] sm:w-[600px] sm:h-[600px] bg-emerald-500/5 rounded-full blur-[40px] sm:blur-[140px] -ml-40 -mb-40 pointer-events-none" 
            style={{ willChange: "transform", transform: "translateZ(0)" }}
          />

          {/* Abstract Glowing Grid Background */}
          <div className="absolute inset-x-0 top-0 h-[600px] bg-[linear-gradient(225deg,rgba(0,242,255,0.03)_0%,transparent_70%)] pointer-events-none" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl"
          >
            <motion.div 
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-proton-accent/10 border border-proton-accent/20 text-proton-accent mb-8 shadow-inner shadow-proton-accent/5 backdrop-blur-md cursor-default select-none"
            >
              <Sparkles size={13} className="animate-pulse text-proton-accent" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em]">
                {t.badge_text}
              </span>
            </motion.div>
            
            <h1 className="text-4xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8 uppercase text-proton-text bg-gradient-to-br from-proton-text via-proton-text to-proton-accent/70 bg-clip-text text-transparent drop-shadow-sm select-none">
              {t.hero_title}
            </h1>
            
            <p className="text-lg md:text-2xl text-proton-muted mb-12 leading-relaxed max-w-3xl mx-auto font-medium">
              {t.hero_subtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <motion.button 
                id="hero-cta-btn"
                onClick={onGetStarted}
                whileHover={{ 
                  scale: 1.05, 
                  boxShadow: "0 20px 40px rgba(0, 242, 255, 0.25)",
                  borderColor: "rgba(0, 242, 255, 0.5)"
                }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto px-10 py-5 bg-proton-accent text-proton-bg rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 cursor-pointer shadow-2xl shadow-proton-accent/30 group border border-proton-accent transition-all duration-300"
              >
                <span>{t.cta_start}</span>
                <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform" />
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Dashboard Preview Overlay */}
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="max-w-5xl mx-auto mt-16 relative px-4"
        >
          <div className="relative group">
            <div 
              className="absolute inset-0 bg-proton-accent/20 blur-[30px] md:blur-[100px] opacity-10 pointer-events-none" 
              style={{ willChange: "transform", transform: "translateZ(0)" }}
            />
            <div className="relative bg-proton-card border border-proton-border rounded-[40px] shadow-2xl overflow-hidden aspect-video">
              <div className="h-12 border-b border-proton-border bg-proton-bg/50 px-6 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/30" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/30" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/30" />
                </div>
                <div className="mx-auto bg-proton-bg/80 px-4 py-1 rounded-lg border border-proton-border/50 text-[10px] font-mono text-proton-muted">
                  app.proton-systems.pro/dashboard
                </div>
              </div>
              
              {/* Mock Interface Content */}
              <div className="p-4 sm:p-6 lg:p-8 flex flex-col sm:grid sm:grid-cols-12 gap-4 lg:gap-6 h-full select-none text-left">
                {/* Mobile Tab bar with dynamic slider background */}
                <div id="mock-mobile-tabs" className="flex sm:hidden overflow-x-auto gap-2 pb-2 border-b border-proton-border/30 whitespace-nowrap scrollbar-none scroll-smooth">
                  {[
                    { id: 'dashboard', nameEn: 'Dashboard', nameKa: 'სახლი' },
                    { id: 'assistants', nameEn: 'AI Agents', nameKa: 'აგენტები' },
                    { id: 'blueprints', nameEn: 'Blueprints', nameKa: 'სქემები' },
                    { id: 'marketplace', nameEn: 'Market', nameKa: 'მარკეტი' },
                    { id: 'translator', nameEn: 'Translator', nameKa: 'მთარგმნელი' },
                    { id: 'organizer', nameEn: 'Cabinet', nameKa: 'კაბინეტი' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setMockActiveTab(item.id as any)}
                      className={cn(
                        "relative px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                        mockActiveTab === item.id 
                          ? "text-proton-bg font-black" 
                          : "bg-proton-card/45 text-proton-muted border border-proton-border"
                      )}
                    >
                      {mockActiveTab === item.id && (
                        <motion.div 
                          layoutId="activeMockTabMobile"
                          className="absolute inset-0 bg-proton-accent rounded-lg"
                          transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        />
                      )}
                      <span className="relative z-10">{language === 'ka' ? item.nameKa : item.nameEn}</span>
                    </button>
                  ))}
                </div>

                {/* Sidebar Mockup (Desktop) */}
                <div className="col-span-3 border-r border-proton-border/40 pr-4 space-y-2 hidden sm:block">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-proton-accent animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-proton-text">SYSTEM CONSOLE</span>
                  </div>
                  {[
                    { id: 'dashboard', name: 'Dashboard' },
                    { id: 'assistants', name: 'AI Assistants' },
                    { id: 'blueprints', name: 'Process Blueprints' },
                    { id: 'marketplace', name: 'Marketplace' },
                    { id: 'translator', name: 'Translation Hub' },
                    { id: 'organizer', name: 'Organizer System' },
                  ].map((item) => (
                    <button 
                      key={item.id} 
                      onClick={() => setMockActiveTab(item.id as any)}
                      className={cn(
                        "relative w-full px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer text-left border border-transparent bg-transparent overflow-hidden",
                        mockActiveTab === item.id 
                          ? "text-proton-accent font-black" 
                          : "text-proton-muted hover:text-proton-text"
                      )}
                    >
                      {mockActiveTab === item.id && (
                        <motion.div 
                          layoutId="activeMockTabDesktop"
                          className="absolute inset-0 bg-proton-accent/10 border border-proton-accent/20 rounded-xl"
                          transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        />
                      )}
                      <span className="relative z-10">
                        {language === 'ka' 
                          ? (item.name === 'Dashboard' ? 'დეშბორდი' : 
                            item.name === 'AI Assistants' ? 'AI ასისტენტები' :
                            item.name === 'Process Blueprints' ? 'ვიზუალური ბლუპრინტები' :
                            item.name === 'Marketplace' ? 'მარკეტპლეისი' :
                            item.name === 'Translation Hub' ? 'მთარგმნელი' : 'კაბინეტი')
                          : item.name
                        }
                      </span>
                      {mockActiveTab === item.id && (
                        <motion.div 
                          layoutId="activeMockTabDotDesktop"
                          className="relative z-10 w-1.5 h-1.5 rounded-full bg-proton-accent shadow-[0_0_10px_#00f2ff]" 
                          transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        />
                      )}
                    </button>
                  ))}
                  
                  <div className="pt-4">
                    <div className="p-3 bg-proton-accent/5 border border-proton-accent/10 rounded-xl">
                      <p className="text-[8px] font-mono text-proton-accent uppercase tracking-widest mb-1">SYSTEM STATE</p>
                      <p className="text-[9px] font-black text-proton-text uppercase">● SECURED BY FIREBASE</p>
                    </div>
                  </div>
                </div>

                {/* Dashboard Area Mockup */}
                <div className="col-span-12 sm:col-span-9 flex flex-col justify-between space-y-4 min-h-[340px]">
                  
                  {/* TAB 1: DASHBOARD PREVIEW */}
                  {mockActiveTab === 'dashboard' && (
                    <div className="space-y-4 flex flex-col justify-between h-full flex-1">
                      {/* Top Stats Cards */}
                      <div className="grid grid-cols-3 gap-3 md:gap-4">
                        {[
                          { label: language === 'ka' ? 'აქტიური აგენტები' : 'Active Agents', value: '4 Personas', color: 'text-amber-400 border-amber-500/10 bg-amber-500/5' },
                          { label: language === 'ka' ? 'შეკვეთები' : 'Live Orders', value: '12 Active', color: 'text-emerald-400 border-emerald-500/10 bg-emerald-500/5' },
                          { label: language === 'ka' ? 'ბლუპრინტები' : 'Node Workflows', value: '8 Graphs', color: 'text-cyan-400 border-cyan-500/10 bg-cyan-500/5' },
                        ].map((stat, i) => (
                          <div key={i} className="p-2 md:p-3 rounded-xl border border-proton-border/30 bg-proton-card/50">
                            <p className="text-[8px] font-mono uppercase tracking-widest text-proton-muted mb-1">{stat.label}</p>
                            <p className={cn("text-[10px] md:text-xs font-black tracking-tight uppercase", stat.color)}>{stat.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex-1 bg-proton-bg border border-proton-border/60 rounded-[24px] p-4 flex flex-col justify-between gap-3">
                        <div className="flex items-center justify-between border-b border-proton-border/30 pb-2">
                          <div className="flex items-center gap-2">
                            <Terminal size={12} className="text-proton-accent" />
                            <span className="text-[9px] font-mono uppercase tracking-widest text-proton-muted">{language === 'ka' ? 'AI აგენტის ლოგი' : 'AI Agent Terminal Logs'}</span>
                          </div>
                          <span className="text-[9px] font-mono text-proton-accent">Gemini-2.5-Pro</span>
                        </div>

                        <div className="space-y-2 font-mono flex-1 text-[9px] leading-relaxed select-text py-1">
                          <div className="flex gap-2">
                            <span className="text-proton-accent font-black">PROMPT &gt;</span>
                            <span className="text-proton-text font-medium">
                              {language === 'ka' 
                                ? 'გააანალიზე დღევანდელი გაყიდვების სტატისტიკა და მოამზადე სარეკომენდაციო გეგმა.'
                                : 'Analyze today\'s sales activity and generate an automated tactical growth matrix.'
                              }
                            </span>
                          </div>
                          <div className="flex gap-2 text-proton-muted animate-pulse">
                            <span className="text-proton-accent">&gt;&gt;</span>
                            <span>[Processing node cycles using Gemini agent...]</span>
                          </div>
                          <div className="p-2 bg-proton-accent/5 border border-proton-accent/10 rounded-lg text-proton-accent leading-loose">
                            {language === 'ka' 
                              ? '✓ ანალიზი დასრულებულია. მომხმარებლის აქტივობა გაიზარდა 14%-ით. ბაზაში დაფიქსირდა 12 ახალი შეკვეთა.'
                              : '✓ Analysis complete. Total activity metrics expanded by 14%. 12 new orders verified in secure Firestore.'
                            }
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[8px] font-mono text-proton-muted border-t border-proton-border/30 pt-2">
                          <span>STATUS: ONLINE</span>
                          <span>RESPONSE: 240ms</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: AI ASSISTANTS PREVIEW */}
                  {mockActiveTab === 'assistants' && (
                    <div className="flex flex-col h-full justify-between flex-1 gap-4">
                      <div className="flex items-center justify-between border-b border-proton-border/30 pb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-amber-400" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-proton-text">
                            {language === 'ka' ? 'AI პერსონების სიმულატორი' : 'AI Persona Interactive Space'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-400/20">AGENT ONLINE</span>
                      </div>

                      <div className="grid grid-cols-12 gap-3 flex-1 items-stretch">
                        {/* Personas Sidebar */}
                        <div className="col-span-4 border-r border-proton-border/30 pr-2 space-y-2 hidden sm:block">
                          {[
                            { name: 'Marketing Guru', active: true },
                            { name: 'System Architect', active: false },
                            { name: 'Legal Copywriter', active: false },
                          ].map((persona, i) => (
                            <div key={i} className={cn("p-2 rounded-xl text-[9px] font-bold uppercase tracking-wider text-left border cursor-pointer transition-all", persona.active ? "bg-amber-400/10 text-amber-400 border-amber-400/30 font-black" : "text-proton-muted border-transparent hover:text-proton-text")}>
                              {persona.name}
                            </div>
                          ))}
                        </div>

                        {/* Personas Chat Area */}
                        <div className="col-span-12 sm:col-span-8 flex flex-col justify-between bg-proton-bg-secondary p-3 rounded-2xl border border-proton-border/40 min-h-[180px]">
                          <div className="space-y-3 flex-1 overflow-y-auto max-h-[160px] text-[10px]">
                            {/* Message 1 */}
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] font-mono text-proton-muted mb-0.5">{language === 'ka' ? 'შენ (მომხმარებელი)' : 'You (User)'}</span>
                              <div className="bg-proton-accent/15 border border-proton-accent/30 text-proton-text px-3 py-2 rounded-2xl rounded-tr-none text-right max-w-[85%]">
                                {language === 'ka' ? 'დაგვიწერე მოკლე და მიმზიდველი სლოგანი Proton-ისთვის.' : 'Write a short & attractive ad slogan for Proton systems.'}
                              </div>
                            </div>
                            {/* Message 2 */}
                            <div className="flex flex-col items-start">
                              <span className="text-[8px] font-mono text-proton-accent mb-0.5">Marketing Specialist</span>
                              <div className="bg-proton-card border border-proton-border text-proton-text px-3 py-2 rounded-2xl rounded-tl-none text-left max-w-[85%] leading-relaxed font-semibold">
                                {language === 'ka' 
                                  ? '💡 "Proton - მართე შენი საქმეები მარტივად: ჭკვიანი AI ასისტენტები, მარტივი დაფები და თბილი მარკეტი!"'
                                  : '💡 "Proton - Manage your day-to-day with total ease: Smart AI helpers, visual task planners, & a cozy marketplace!"'
                                }
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-2 text-[8px] font-mono text-proton-muted text-center border-t border-proton-border/30 pt-2 animate-pulse">
                            {language === 'ka' ? '✓ კავშირი Gemini API-სთან სტაბილურია და დაცულია' : '✓ Direct connection to Gemini API is fully operational & encrypted'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: PROCESS BLUEPRINTS PREVIEW */}
                  {mockActiveTab === 'blueprints' && (
                    <div className="flex flex-col h-full justify-between flex-1 gap-4">
                      <div className="flex items-center justify-between border-b border-proton-border/30 pb-2">
                        <div className="flex items-center gap-2">
                          <Workflow size={14} className="text-cyan-400" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-proton-text">
                            {language === 'ka' ? 'ბლუპრინტების ვიზუალური ნოდები' : 'Visual Process Blueprint Visualizer'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono bg-cyan-400/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-400/20">COMPILED SUCCESS</span>
                      </div>

                      {/* Canvas Simulator */}
                      <div className="bg-proton-bg border border-proton-border/50 rounded-2xl p-4 relative min-h-[180px] flex flex-col justify-center items-center overflow-hidden">
                        
                        {/* Background Grid Pattern */}
                        <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#00f2ff_1px,transparent_1px),linear-gradient(to_bottom,#00f2ff_1px,transparent_1px)] bg-[size:20px_20px]" />

                        <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full justify-around max-w-lg">
                          
                          {/* Node 1 */}
                          <div className="p-2 md:p-3 bg-proton-card border border-proton-border hover:border-cyan-400/50 rounded-xl flex items-center gap-2 shadow-lg min-w-[110px] transition-transform duration-300 hover:scale-105">
                            <div className="w-5 h-5 rounded bg-amber-400 flex items-center justify-center text-proton-bg">
                              <span className="text-[9px] font-black">GET</span>
                            </div>
                            <div className="text-left">
                              <p className="text-[7px] font-mono text-proton-muted">TRIGGER</p>
                              <p className="text-[9px] font-bold text-proton-text">{language === 'ka' ? 'შეკვეთისას' : 'New Order'}</p>
                            </div>
                          </div>

                          {/* Connection Arrow 1 */}
                          <div className="w-4 h-4 text-cyan-400 rotate-90 sm:rotate-0 flex items-center justify-center">
                            <ArrowRight size={14} className="animate-pulse" />
                          </div>

                          {/* Node 2 */}
                          <div className="p-2 md:p-3 bg-proton-card border border-cyan-400/40 hover:border-cyan-400 rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-400/5 min-w-[110px] transition-transform duration-300 hover:scale-105">
                            <div className="w-5 h-5 rounded bg-cyan-400 flex items-center justify-center text-proton-bg">
                              <Cpu size={12} fill="currentColor" />
                            </div>
                            <div className="text-left">
                              <p className="text-[7px] font-mono text-cyan-400 font-bold">AI DECISION</p>
                              <p className="text-[9px] font-bold text-proton-text">{language === 'ka' ? 'ავტო-მთარგმნელი' : 'Auto-Translate'}</p>
                            </div>
                          </div>

                          {/* Connection Arrow 2 */}
                          <div className="w-4 h-4 text-cyan-400 rotate-90 sm:rotate-0 flex items-center justify-center">
                            <ArrowRight size={14} className="animate-pulse" />
                          </div>

                          {/* Node 3 */}
                          <div className="p-2 md:p-3 bg-proton-card border border-proton-border hover:border-cyan-400/50 rounded-xl flex items-center gap-2 shadow-lg min-w-[110px] transition-transform duration-300 hover:scale-105">
                            <div className="w-5 h-5 rounded bg-emerald-400 flex items-center justify-center text-proton-bg">
                              <ShoppingBag size={12} fill="currentColor" />
                            </div>
                            <div className="text-left">
                              <p className="text-[7px] font-mono text-proton-muted">ACTION</p>
                              <p className="text-[9px] font-bold text-proton-text">{language === 'ka' ? 'ინვენტარი' : 'Sync Inventory'}</p>
                            </div>
                          </div>

                        </div>
                        
                        <div className="absolute bottom-2 left-2 right-2 text-center text-[8px] font-mono text-proton-muted bg-proton-card/90 py-1.5 px-3 rounded-lg border border-proton-border/30">
                          {language === 'ka' 
                            ? "💡 ეს არის ვიზუალური სამუშაო სექცია, სადაც შენი სურვილისამებრ აკავშირებ ავტომატიზებულ სლოტებს."
                            : "💡 This is a no-code blueprint engine. Drag trigger items and connect them to Gemini-AI decision blocks."
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: MARKETPLACE PREVIEW */}
                  {mockActiveTab === 'marketplace' && (
                    <div className="flex flex-col h-full justify-between flex-1 gap-4">
                      <div className="flex items-center justify-between border-b border-proton-border/30 pb-2">
                        <div className="flex items-center gap-2">
                          <ShoppingBag size={14} className="text-emerald-400" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-proton-text">
                            {language === 'ka' ? 'გლობალური სავაჭრო მარკეტი' : 'Built-in Global Secure Marketplace'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono bg-emerald-400/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-400/20">FIRESTORE SYNC</span>
                      </div>

                      {/* Mock Product Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                        {[
                          { title: 'Intellectual AI Analytics Bot', titleGe: 'ინტელექტუალური საანალიზო ბოტი', price: '45.00', currency: 'USD', category: 'Software' },
                          { title: 'Responsive Design Templates Suite', titleGe: 'საიტების დიზაინების ნაკრები', price: '120.00', currency: 'GEL', category: 'Design' },
                        ].map((prod, idx) => (
                          <div key={idx} className="p-3 bg-proton-card border border-proton-border hover:border-emerald-400/30 rounded-2xl flex flex-col justify-between gap-2 text-left group transition-all duration-300">
                            <div>
                              <div className="flex justify-between items-start mb-1">
                                <span className="px-1.5 py-0.5 rounded bg-proton-bg text-proton-muted text-[7px] font-bold uppercase tracking-widest">{prod.category}</span>
                                <span className="text-emerald-400 text-[10px] font-black">{prod.price} {prod.currency}</span>
                              </div>
                              <h4 className="text-[10px] font-bold text-proton-text group-hover:text-emerald-400 transition-colors uppercase leading-tight line-clamp-1">
                                {language === 'ka' ? prod.titleGe : prod.title}
                              </h4>
                              <p className="text-[8px] text-proton-muted leading-tight mt-1">
                                {language === 'ka' ? 'დადასტურებულია რეალური ვაჭრობითა და მოქმედი რეიტინგებით.' : 'Complete technical file and operational instructions included.'}
                              </p>
                            </div>
                            <button 
                              onClick={() => alert(language === 'ka' ? "როლური მოდელი: დააჭირეთ დაწყებას რეალური შესყიდვების გამოსაცდელად!" : "Simulator Notice: Access the workspace to initialize direct sales flow!")}
                              className="w-full py-1 bg-proton-bg hover:bg-emerald-400/10 border border-proton-border hover:border-emerald-400/30 text-[8px] font-black uppercase tracking-wider text-proton-text rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <ShoppingBag size={10} />
                              {language === 'ka' ? 'ნივთის შეკვეთა' : 'Purchase Item'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: TRANSLATOR PREVIEW */}
                  {mockActiveTab === 'translator' && (
                    <div className="flex flex-col h-full justify-between flex-1 gap-4">
                      <div className="flex items-center justify-between border-b border-proton-border/30 pb-2">
                        <div className="flex items-center gap-2">
                          <Globe size={14} className="text-proton-accent" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-proton-text">
                            {language === 'ka' ? 'ბილინგვური დოკუმენტების მთარგმნელი' : 'Bilingual Document & Text Translation Suite'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono bg-proton-accent/10 text-proton-accent px-2 py-0.5 rounded-full border border-proton-accent/20">AUTOMATED EN &hArr; KA</span>
                      </div>

                      {/* Side-by-Side Dual Translation Display */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                        <div className="p-3 bg-proton-bg rounded-xl border border-proton-border/60 text-left flex flex-col justify-between">
                          <p className="text-[8px] font-mono text-proton-muted uppercase tracking-widest mb-1">ENGLISH (SOURCE)</p>
                          <p className="text-[10px] font-medium leading-relaxed text-proton-text">
                            "Proton offers complete system operations, specialized AI instruction layers, and unified peer-to-peer commerce under strict client guidelines."
                          </p>
                        </div>
                        <div className="p-3 bg-proton-accent/5 rounded-xl border border-proton-accent/20 text-left flex flex-col justify-between">
                          <p className="text-[8px] font-mono text-proton-accent uppercase tracking-widest mb-1">GEORGIAN (TRANSLATED BACKEND)</p>
                          <p className="text-[10px] font-semibold leading-relaxed text-proton-text">
                            "Proton გთავაზობთ სრულ სისტემურ ოპერაციებს, სპეციალიზებულ AI ინსტრუქციების შრეებსა და ერთიან სავაჭრო მარკეტს მომხმარებლის მკაცრი კონტროლის ქვეშ."
                          </p>
                        </div>
                      </div>
                      <div className="text-center text-[8px] font-mono text-proton-muted bg-proton-card py-1 rounded-lg border border-proton-border">
                        {language === 'ka' ? "✓ მხარდაჭერილია ავტომატური ორმხრივი თარგმნა Firestore შენახვით" : "✓ Active bidirectional text translation with Firebase database caching for zero redundancy"}
                      </div>
                    </div>
                  )}

                  {/* TAB 6: CABIN/ORGANIZER PREVIEW */}
                  {mockActiveTab === 'organizer' && (
                    <div className="flex flex-col h-full justify-between flex-1 gap-4">
                      <div className="flex items-center justify-between border-b border-proton-border/30 pb-2">
                        <div className="flex items-center gap-2">
                          <UserCheck size={14} className="text-purple-400" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-proton-text">
                            {language === 'ka' ? 'სისტემური კაბინეტი & შეკვეთები' : 'Personal Cabinet & Live Task Organizer'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono bg-purple-400/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-400/20">PERSISTENT ACCOUNT</span>
                      </div>

                      <div className="bg-proton-card/40 border border-proton-border/50 rounded-2xl p-3 flex-1">
                        <div className="flex items-center gap-4 mb-3 pb-2 border-b border-proton-border/30 justify-around text-center">
                          <div>
                            <p className="text-[8px] font-mono text-proton-muted uppercase">{language === 'ka' ? 'ჩემი ნივთები' : 'My Listings'}</p>
                            <p className="text-[10px] font-black text-proton-text">3 ACTIVE</p>
                          </div>
                          <div className="w-px h-6 bg-proton-border/40" />
                          <div>
                            <p className="text-[8px] font-mono text-proton-muted uppercase">{language === 'ka' ? 'შემოსული მოთხოვნები' : 'Incoming Orders'}</p>
                            <p className="text-[10px] font-black text-purple-400">4 INCOMING</p>
                          </div>
                          <div className="w-px h-6 bg-proton-border/40" />
                          <div>
                            <p className="text-[8px] font-mono text-proton-muted uppercase">{language === 'ka' ? 'ჩემი შესყიდვები' : 'Outbound Purchases'}</p>
                            <p className="text-[10px] font-black text-proton-accent">2 REVIEWS</p>
                          </div>
                        </div>

                        <div className="space-y-2 text-[9px] text-left">
                          <div className="p-2 bg-proton-bg border border-proton-border rounded-xl flex items-center justify-between">
                            <div className="space-y-0.5">
                              <p className="font-extrabold text-proton-text leading-tight">MacBook Air M2 8GB 256GB</p>
                              <p className="text-proton-muted text-[8px] font-mono">ORDER ID: pr_82df2a &bull; BUYER: Davit D.</p>
                            </div>
                            <span className="px-2 py-0.5 bg-amber-400/10 text-amber-500 rounded text-[8px] border border-amber-400/20 font-bold uppercase tracking-widest">{language === 'ka' ? 'მომზადებაშია' : 'In Progress'}</span>
                          </div>
                          <div className="p-2 bg-proton-bg border border-proton-border rounded-xl flex items-center justify-between">
                            <div className="space-y-0.5">
                              <p className="font-extrabold text-proton-text leading-tight">Enterprise Cloud Deploy Package</p>
                              <p className="text-proton-muted text-[8px] font-mono">ORDER ID: pr_cf418 &bull; BUYER: Mary S.</p>
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-400/10 text-emerald-500 rounded text-[8px] border border-emerald-400/20 font-bold uppercase tracking-widest">{language === 'ka' ? 'მიწოდებულია' : 'Delivered'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* NEW SYSTEM HIGHLIGHTS GRID (Provides Complete Info) */}
      <section id="ecosystem-highlights-section" className="py-24 px-6 relative bg-proton-bg-secondary/40 border-t border-proton-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-proton-text mb-4">
              {currentLocalContent.platform_title}
            </h2>
            <div className="w-24 h-1 bg-proton-accent mx-auto mb-6 rounded-full" />
            <p className="text-proton-muted max-w-2xl mx-auto text-base md:text-lg">
              {currentLocalContent.platform_subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {currentLocalContent.modules.map((m, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: idx * 0.08 }}
                whileHover={{ 
                  y: -6, 
                  scale: 1.015,
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)"
                }}
                className={cn(
                  "p-8 rounded-[32px] border flex flex-col justify-between relative group overflow-hidden transition-all duration-500", 
                  m.color
                )}
              >
                {/* Visual Accent Glow Backdrop on Hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                
                <div className="relative z-10">
                  <motion.div 
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                    className="w-14 h-14 rounded-2xl flex items-center justify-center bg-proton-bg/60 mb-6 border border-proton-border/80 group-hover:border-proton-accent/30 group-hover:shadow-[0_0_20px_rgba(0,242,255,0.05)] transition-all duration-300"
                  >
                    <m.icon className="w-7 h-7 text-proton-text group-hover:text-proton-accent transition-colors duration-300" />
                  </motion.div>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-proton-text mb-4 group-hover:text-proton-accent transition-colors duration-300">
                    {m.title}
                  </h3>
                  <p className="text-sm font-medium leading-relaxed text-proton-muted group-hover:text-proton-text/90 transition-colors duration-500">
                    {m.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works-section" className="py-24 px-6 border-t border-proton-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-proton-text mb-4">
              {currentLocalContent.how_it_works_title}
            </h2>
            <p className="text-proton-muted max-w-xl mx-auto text-base font-medium">
              {currentLocalContent.how_it_works_subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Visual connector line for desktop */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-proton-border/30 -translate-y-1/2 z-0" />
            
            {currentLocalContent.steps.map((step, idx) => (
              <div key={idx} className="relative z-10 flex flex-col items-center text-center group">
                <div className="w-20 h-20 rounded-full bg-proton-card border-2 border-proton-accent/80 flex items-center justify-center text-proton-accent text-2xl font-black shadow-xl group-hover:scale-110 transition-transform duration-300 mb-8">
                  {step.num}
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-proton-text mb-3">
                  {step.title}
                </h3>
                <p className="text-sm text-proton-muted leading-relaxed max-w-sm">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXPANDABLE FAQ SECTION (Gives Complete Direct Answers) */}
      <section id="faqs-section" className="py-24 px-6 border-t border-proton-border/50 bg-proton-card/20 select-none">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-proton-accent/10 text-proton-accent mb-4 border border-proton-accent/20">
              <HelpCircle size={22} />
            </div>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-proton-text mb-4">
              {currentLocalContent.faqs_title}
            </h2>
            <p className="text-proton-muted font-medium text-sm md:text-base">
              {currentLocalContent.faqs_subtitle}
            </p>
          </div>

          <div className="space-y-4">
            {currentLocalContent.faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx}
                  className="rounded-2xl border border-proton-border bg-proton-card overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-proton-bg/20 transition-colors"
                  >
                    <span className="text-base font-bold text-proton-text uppercase tracking-tight leading-snug">
                      {faq.q}
                    </span>
                    <div className={cn("p-1.5 rounded-lg border border-proton-border text-proton-muted transition-transform duration-300", isOpen && "rotate-180 bg-proton-accent/10 border-proton-accent/30 text-proton-accent")}>
                      <ChevronDown size={18} />
                    </div>
                  </button>

                  <motion.div 
                    initial={false}
                    animate={{ 
                      height: isOpen ? "auto" : 0,
                      opacity: isOpen ? 1 : 0
                    }}
                    transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                    className="overflow-hidden bg-proton-bg/40 border-proton-border"
                  >
                    <div className="px-6 py-5 border-t border-proton-border/70">
                      <p className="text-sm font-medium leading-relaxed text-proton-muted">
                        {faq.a}
                      </p>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HIGH-CONVERSION CTA FOOTER BANNER */}
      <section id="bottom-cta-banner" className="py-24 px-6 relative overflow-hidden border-t border-proton-border/50">
        <div 
          className="absolute inset-0 bg-proton-accent/5 opacity-40 blur-[40px] md:blur-[120px] pointer-events-none" 
          style={{ willChange: "transform", transform: "translateZ(0)" }}
        />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter text-proton-text mb-6">
            {currentLocalContent.cta_bottom_title}
          </h2>
          <p className="text-base md:text-lg text-proton-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            {currentLocalContent.cta_bottom_desc}
          </p>

          <motion.button
            id="bottom-cta-btn"
            onClick={onGetStarted}
            whileHover={{ 
              scale: 1.05, 
              boxShadow: "0 20px 40px rgba(0, 242, 255, 0.25)",
              borderColor: "rgba(0, 242, 255, 0.5)"
            }}
            whileTap={{ scale: 0.98 }}
            className="px-10 py-5 bg-proton-accent text-proton-bg rounded-2xl font-black uppercase tracking-widest text-sm cursor-pointer shadow-xl shadow-proton-accent/20 border border-proton-accent transition-all duration-300"
          >
            {currentLocalContent.cta_bottom_btn}
          </motion.button>
        </div>
      </section>

      {/* Footer */}
      <footer id="landing-footer" className="py-12 border-t border-proton-border/30 text-center px-6 bg-proton-bg-secondary/40">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 opacity-30 grayscale">
            <div className="w-8 h-8 rounded-lg bg-proton-accent flex items-center justify-center text-proton-bg">
              <Zap size={18} fill="currentColor" />
            </div>
            <span className="text-sm font-black tracking-tighter uppercase whitespace-nowrap">Proton Systems</span>
          </div>
          <p className="text-xs text-proton-muted font-mono uppercase tracking-[0.2em]">
            {t.footer_text}
          </p>
        </div>
      </footer>
    </div>
  );
};
