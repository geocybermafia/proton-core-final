import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  ChevronDown,
  MapPin,
  RotateCcw,
  CheckCircle,
  MessageSquare,
  Plus,
  Coins,
  Eye
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
          a: "Every transaction and listing is secured using advanced cloud encryption, secure communication channels, and real-time state verification. This ensures absolute transparency, safety, and peace of mind for both buyers and sellers."
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
          a: "ყოველი ტრანზაქცია და განცხადება დაცულია თანამედროვე ღრუბლოვანი ტექნოლოგიებით, დაშიფრული არხებითა და ორმხრივი ვერიფიკაციით რეალურ დროში. ეს უზრუნველყოფს სრულ გამჭვირვალობას, უსაფრთხოებასა და სიმშვიდეს როგორც მყიდველისთვის, ისე გამყიდველისთვის."
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
          
          <div className="flex items-center gap-2 sm:gap-6">
            {/* Language Switcher */}
            <div id="lang-switcher-row" className="flex bg-proton-card/60 rounded-lg p-0.5 border border-proton-border/80 backdrop-blur-sm">
              <button 
                id="btn-lang-en"
                onClick={() => onLanguageChange('en')}
                className={cn(
                  "px-2.5 py-1 text-[10px] sm:text-xs font-black rounded-md transition-all cursor-pointer h-7 sm:h-8 min-w-[32px] sm:min-w-[36px] flex items-center justify-center uppercase tracking-wider",
                  language === 'en' ? "bg-proton-accent text-proton-bg shadow-sm" : "text-proton-muted hover:text-proton-text"
                )}
              >
                EN
              </button>
              <button 
                id="btn-lang-ka"
                onClick={() => onLanguageChange('ka')}
                className={cn(
                  "px-2.5 py-1 text-[10px] sm:text-xs font-black rounded-md transition-all cursor-pointer h-7 sm:h-8 min-w-[32px] sm:min-w-[36px] flex items-center justify-center uppercase tracking-wider",
                  language === 'ka' ? "bg-proton-accent text-proton-bg shadow-sm" : "text-proton-muted hover:text-proton-text"
                )}
              >
                KA
              </button>
            </div>

            <button 
              id="nav-login-btn"
              onClick={onLogin}
              className="text-xs sm:text-sm font-bold uppercase tracking-wider sm:tracking-widest text-proton-muted hover:text-proton-text transition-colors cursor-pointer"
            >
              {t.cta_login}
            </button>
            <button 
              id="nav-start-btn"
              onClick={onGetStarted}
              className="px-3 py-2 sm:px-6 sm:py-2.5 bg-proton-accent text-proton-bg rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider sm:tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg shadow-proton-accent/20"
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
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-proton-accent/5 border border-proton-accent/15 text-[10px] font-black uppercase tracking-widest text-proton-accent mb-4">
              <Zap size={10} className="text-proton-accent animate-pulse" />
              {language === 'ka' ? 'როგორ მუშაობს' : 'Platform Walkthrough'}
            </div>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-proton-text mb-4">
              {currentLocalContent.how_it_works_title}
            </h2>
            <p className="text-proton-muted max-w-xl mx-auto text-base font-medium">
              {currentLocalContent.how_it_works_subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch relative">
            {/* Visual connector lines for desktop */}
            <div className="hidden md:block absolute top-[60px] left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-proton-accent/10 via-proton-accent/30 to-proton-accent/10 z-0 pointer-events-none" />

            {currentLocalContent.steps.map((step, idx) => {
              // Custom icon selection based on step index
              const StepIcon = idx === 0 ? UserCheck : idx === 1 ? Workflow : ShoppingBag;
              
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: idx * 0.15 }}
                  whileHover={{ 
                    y: -6, 
                    boxShadow: "0 20px 40px -15px rgba(0,0,0,0.5)"
                  }}
                  className="bg-proton-card/20 border border-proton-border/50 hover:border-proton-accent/30 rounded-[32px] p-8 relative overflow-hidden group transition-all duration-300 flex flex-col justify-between z-10"
                >
                  {/* Subtle hover gradient glow */}
                  <div className="absolute inset-0 bg-gradient-to-b from-proton-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  <div>
                    {/* Top Step Index / Icon Row */}
                    <div className="flex items-center justify-between mb-8">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-proton-bg/80 border border-proton-border group-hover:border-proton-accent/40 group-hover:text-proton-accent transition-all duration-300">
                        <StepIcon className="w-5 h-5 text-proton-text group-hover:text-proton-accent transition-colors duration-300" />
                      </div>
                      <span className="text-4xl font-black font-mono text-proton-muted/20 group-hover:text-proton-accent/20 tracking-tighter transition-colors duration-300">
                        {step.num}
                      </span>
                    </div>

                    {/* Step Content */}
                    <h3 className="text-xl font-black uppercase tracking-wider text-proton-text mb-3 group-hover:text-proton-accent transition-colors duration-300">
                      {step.title}
                    </h3>
                    <p className="text-sm text-proton-muted/90 font-medium leading-relaxed group-hover:text-proton-text transition-colors duration-300">
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
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
