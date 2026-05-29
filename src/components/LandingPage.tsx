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
  const currentLang = language;
  
  // @ts-ignore
  const t = translations[currentLang].landing;

  // Comprehensive localized content for detailed sections
  const localContent = {
    en: {
      platform_title: "Core Ecosystem Modules",
      platform_subtitle: "Proton integrates four main systems working in perfect synergy under your control.",
      
      modules: [
        {
          title: "Autonomous AI Workspace",
          desc: "Create and chat with specialized business personas. From technical architects to marketing strategists, configure custom instruction sets and execute advanced reasoning with the power of Gemini.",
          icon: Sparkles,
          color: "text-amber-400 border-amber-500/20 bg-amber-500/5"
        },
        {
          title: "Global Asset Marketplace",
          desc: "List products, materials, services, or software solutions. Reach global or local buyers, manage order cycles, view live ratings, and build a trusted vendor profile with built-in escrow flow.",
          icon: ShoppingBag,
          color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
        },
        {
          title: "Visual Process Blueprints",
          desc: "Define operations as visual Node Graphs. Create triggers, set parameters, organize action blocks, and orchestrate complex business flows without writing a single line of backend code.",
          icon: Workflow,
          color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5"
        },
        {
          title: "Professional Cabinet",
          desc: "Monitor live resources in real time. Track your AI tokens, computed node cycles, local database storage, seller incoming requests, buyer orders, and account status in a dense unified panel.",
          icon: UserCheck,
          color: "text-purple-400 border-purple-500/20 bg-purple-500/5"
        }
      ],

      how_it_works_title: "How Proton Transforms Business",
      how_it_works_subtitle: "A simple, highly secure three-step cycle to automate and trade globally.",
      steps: [
        {
          num: "01",
          title: "Initialize Your Workspace",
          desc: "Sign up and configure your system profile. Specify your operating region, language, and primary business objectives to automatically optimize your dashboard layout."
        },
        {
          num: "02",
          title: "Configure Agents & Workflows",
          desc: "Activate specialized AI personas and map your routine operations visually using our blueprint builder. Connect trigger inputs to automate repetitive strategic task matrices."
        },
        {
          num: "03",
          title: "Deploy & Engage",
          desc: "Publish your assets on the global marketplace, process incoming service contracts, and let your background AI agents handle customer diagnostics or translate documentation instantly."
        }
      ],

      faqs_title: "Frequently Asked Questions",
      faqs_subtitle: "Everything you need to know about Proton Core platforms and capabilities.",
      faqs: [
        {
          q: "What is Proton Core?",
          a: "Proton Core is a dense, responsive workspace designed to centralize AI autonomy, strategic business planning, document translation, visual software blueprint architecture, and listing trade workflows into one single-screen application context."
        },
        {
          q: "Who is this platform designed for?",
          a: "It is built for digital entrepreneurs, modern managers, freelance consultants, and systems architects who need to streamline complex operations, coordinate digital products, automate translation workflows, and list items in an aligned professional community."
        },
        {
          q: "Is developer knowledge required to use workflows and AI?",
          a: "No. Proton provides simple interactive visual tools. You can customize AI instructions, create digital listings, and model workflow templates through friendly inputs and drop-down selectors built with direct state persistence."
        },
        {
          q: "How does the Marketplace ordering system work?",
          a: "When a user orders your listing, an order block is immediately recorded in Firestore to guarantee transparency. The status is managed in the seller's incoming panel and the buyer's tracking cabinet, enabling seamless, transparent interactions."
        },
        {
          q: "Can I use multiple devices or languages?",
          a: "Yes. The workspace is fully responsive and auto-translates all interface elements between English (EN) and Georgian (KA) dynamically. All your listing states, user parameters, and task trackers are persisted securely in Firebase."
        }
      ],

      cta_bottom_title: "Ready to elevate your business operations?",
      cta_bottom_desc: "Join the Proton ecosystem today and manage your resources with next-generation intelligence. Real-time sync, unified dashboard, and complete workspace freedom.",
      cta_bottom_btn: "Access Workspace NOW"
    },
    ka: {
      platform_title: "ეკოსისტემის ძირითადი მოდულები",
      platform_subtitle: "Proton აერთიანებს ოთხ უმსხვილეს სისტემას, რომლებიც მუშაობენ სრულ სინერგიაში შენი კონტროლის ქვეშ.",
      
      modules: [
        {
          title: "ავტონომიური AI სივრცე",
          desc: "შექმენი და დაუკავშირდი სპეციალიზებულ ბიზნეს-პერსონებს. ტექნიკური არქიტექტორებიდან დაწყებული მარკეტინგის სტრატეგებით დამთავრებული, მოახდინე ინსტრუქციების კონფიგურაცია და გაუშვი რთული ოპერაციები Gemini-ს საშუალებით.",
          icon: Sparkles,
          color: "text-amber-400 border-amber-500/20 bg-amber-500/5"
        },
        {
          title: "გლობალური აქტივების მარკეტი",
          desc: "განათავსე პროდუქტები, სერვისები თუ პროგრამული გადაწყვეტილებები. მიაღწიე გლობალურ თუ ადგილობრივ მყიდველებს, მართე შეკვეთის ციკლები, ნახე რეიტინგები და შექმენი სანდო გამყიდველის პროფილი.",
          icon: ShoppingBag,
          color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
        },
        {
          title: "ვიზუალური პროცესების ბლუპრინტები",
          desc: "განსაზღვრე ოპერაციები ვიზუალური ნოდური გრაფების სახით. შექმენი ტრიგერები, პარამეტრები, საოპერაციო ბლოკები და დააორკესტრირე ბიზნეს-ლოგიკა კოდის წერის გარეშე.",
          icon: Workflow,
          color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5"
        },
        {
          title: "პროფესიონალური კაბინეტი",
          desc: "აკონტროლე რესურსები რეალურ დროში. თვალი ადევნე შენს გამოყოფილ AI ტოკენებს, გამოთვლით ციკლებს, ლოკალურ საცავს, შემოსულ მოთხოვნებს, აქტიურ შეკვეთებსა და სტატუსს ერთიან პანელში.",
          icon: UserCheck,
          color: "text-purple-400 border-purple-500/20 bg-purple-500/5"
        }
      ],

      how_it_works_title: "როგორ მუშაობს Proton-ი?",
      how_it_works_subtitle: "მარტივი, უსაფრთხო და მაღალეფექტური სამსაფეხურიანი ციკლი პროცესების მართვისთვის.",
      steps: [
        {
          num: "01",
          title: "სამუშაო სივრცის ინიციალიზაცია",
          desc: "დარეგისტრირდი და შექმენი შენი სისტემური პროფილი. მიუთითე რეგიონი, ენა და ძირითადი ბიზნეს მიზნები, რათა ავტომატურად მოხდეს დეშბორდის ოპტიმიზაცია."
        },
        {
          num: "02",
          title: "აგენტებისა და პროცესების მართვა",
          desc: "გაააქტიურე სპეციალიზებული ხელოვნური ინტელექტის აგენტები და გამოსახე ყოველდღიური რუტინული ოპერაციები ვიზუალური ბლუპრინტების საშუალებით."
        },
        {
          num: "03",
          title: "გაშვება და რეალური ვაჭრობა",
          desc: "განათავსე აქტივები გლობალურ მარკეტზე, მიიღე სერვისული შეკვეთები და მიანდე ფონურ AI აგენტებს დოკუმენტაციის თარგმნა ან პროდუქტების დიაგნოსტიკა."
        }
      ],

      faqs_title: "ხშირად დასმული კითხვები",
      faqs_subtitle: "აქ იპოვი ამომწურავ პასუხებს Proton Core-ის შესაძლებლობების შესახებ.",
      faqs: [
        {
          q: "რა არის Proton Core?",
          a: "Proton Core არის მაღალტექნოლოგიური სამუშაო სივრცე, რომელიც აერთიანებს AI ასისტენტებს, სტრატეგიულ დაგეგმვას, დოკუმენტების თარგმნას, ვიზუალურ ბლუპრინტებსა და თავისუფალ სავაჭრო მარკეტს ერთიან სისტემაში."
        },
        {
          q: "ვისთვის არის განკუთვნილი ეს პლატფორმა?",
          a: "პლატფორმა შექმნილია ციფრული მეწარმეებისთვის, მენეჯერებისთვის, კონსულტანტებისთვის და სისტემური არქიტექტორებისთვის, რომლებსაც სურთ პროცესების ავტომატიზაცია და აქტივების ეფექტური მართვა."
        },
        {
          q: "მჭირდება თუ არა კოდირების ცოდნა ბლუპრინტებისა და AI-ს გამოსაყენებლად?",
          a: "არა. Proton-ი გთავაზობს მარტივ ვიზუალურ ინსტრუმენტებს. შენ შეგიძლია დააკონფიგურირო AI ინსტრუქციები, შექმნა განცხადებები და მართო დავალებები ჩაშენებული მენიუებით."
        },
        {
          q: "როგორ მუშაობს მარკეტზე ყიდვა-გაყიდვის სისტემა?",
          a: "როდესაც მომხმარებელი ირჩევს შენს ნივთს, შეკვეთა მომენტალურად იწერება Firestore-ში. შეკვეთის სტატუსის მართვა ხდება გამყიდველის შემოსულ პანელში და მყიდველის თრექინგ სისტემაში, რაც უზრუნველყოფს სრულ გამჭვირვალობას."
        },
        {
          q: "შესაძლებელია თუ არა პლატფორმის გამოყენება ქართულად?",
          a: "დიახ. სამუშაო სივრცე სრულად ადაპტირებადია და მხარს უჭერს როგორც ქართულ (KA), ისე ინგლისურ (EN) ენებს. მონაცემები საიმედოდ ინახება Firebase-ის რეალურ მონაცემთა ბაზაში."
        }
      ],

      cta_bottom_title: "მზად ხარ ბიზნესის ახალ საფეხურზე გადასაყვანად?",
      cta_bottom_desc: "შეუერთდი Proton-ის ეკოსისტემას დღესვე და მართე შენი რესურსები ჭკვიანურად. რეალურ დროში სინქრონიზაცია, ერთიანი დეშბორდი და სრული თავისუფლება.",
      cta_bottom_btn: "გადადი სამუშაო სივრცეში"
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
      {/* Navigation */}
      <nav id="landing-navbar" className="fixed top-0 w-full z-[100] border-b border-proton-border/50 bg-proton-bg/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-proton-accent flex items-center justify-center text-proton-bg shadow-lg shadow-proton-accent/20">
              <Zap size={22} fill="currentColor" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase whitespace-nowrap">Proton Core</span>
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
      <section id="hero-section" className="relative pt-40 pb-20 px-6 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-proton-accent/5 rounded-full blur-[150px] -mr-40 -mt-40 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] -ml-40 -mb-40 pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            className="max-w-4xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-proton-accent/10 border border-proton-accent/20 text-proton-accent mb-8">
              <Star size={14} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                {t.badge_text}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-[0.95] mb-8 uppercase text-proton-text">
              {t.hero_title}
            </h1>
            
            <p className="text-lg md:text-xl text-proton-muted mb-12 leading-relaxed max-w-2xl mx-auto">
              {t.hero_subtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button 
                id="hero-cta-btn"
                onClick={onGetStarted}
                className="w-full sm:w-auto px-10 py-5 bg-proton-accent text-proton-bg rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xl shadow-proton-accent/30 group"
              >
                {t.cta_start}
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
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
            <div className="absolute inset-0 bg-proton-accent/20 blur-[100px] opacity-10" />
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
              <div className="p-4 sm:p-6 lg:p-8 grid grid-cols-12 gap-4 lg:gap-6 h-full select-none text-left">
                {/* Sidebar Mockup */}
                <div className="col-span-3 border-r border-proton-border/40 pr-4 space-y-3 hidden sm:block">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-proton-accent animate-ping" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-proton-text">CORE CONSOLE</span>
                  </div>
                  {[
                    { name: 'Dashboard', active: true },
                    { name: 'AI Assistants', active: false },
                    { name: 'Process Blueprints', active: false },
                    { name: 'Marketplace', active: false },
                    { name: 'Translation Hub', active: false },
                    { name: 'Organizer System', active: false },
                  ].map((item, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-between",
                        item.active 
                          ? "bg-proton-accent/10 border border-proton-accent/20 text-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.05)]" 
                          : "text-proton-muted hover:text-proton-text border border-transparent"
                      )}
                    >
                      {language === 'ka' 
                        ? (item.name === 'Dashboard' ? 'დეშბორდი' : 
                          item.name === 'AI Assistants' ? 'AI ასისტენტები' :
                          item.name === 'Process Blueprints' ? 'ვიზუალური ბლუპრინტები' :
                          item.name === 'Marketplace' ? 'მარკეტპლეისი' :
                          item.name === 'Translation Hub' ? 'მთარგმნელი' : 'კაბინეტი')
                        : item.name
                      }
                      {item.active && <div className="w-1.5 h-1.5 rounded-full bg-proton-accent shadow-[0_0_8px_#00f2ff]" />}
                    </div>
                  ))}
                  
                  <div className="pt-2">
                    <div className="p-3 bg-proton-accent/5 border border-proton-accent/10 rounded-xl">
                      <p className="text-[8px] font-mono text-proton-accent uppercase tracking-widest mb-1">SYSTEM STATE</p>
                      <p className="text-[9px] font-black text-proton-text uppercase">● SECURED BY FIREBASE</p>
                    </div>
                  </div>
                </div>

                {/* Dashboard Area Mockup */}
                <div className="col-span-12 sm:col-span-9 flex flex-col justify-between space-y-4">
                  {/* Top Stats Cards */}
                  <div className="grid grid-cols-3 gap-3 md:gap-4">
                    {[
                      { label: language === 'ka' ? 'აქტიური აგენტები' : 'Active Agents', value: '4 Personas', color: 'text-amber-400 border-amber-500/10 bg-amber-500/5' },
                      { label: language === 'ka' ? 'შეკვეთები' : 'Live Orders', value: '12 Active', color: 'text-emerald-400 border-emerald-500/10 bg-emerald-500/5' },
                      { label: language === 'ka' ? 'ბლუპრინტები' : 'Node Workflows', value: '8 Graphs', color: 'text-cyan-400 border-cyan-500/10 bg-cyan-500/5' },
                    ].map((stat, i) => (
                      <div key={i} className={cn("p-3 md:p-4 rounded-2xl border transition-all duration-300 hover:scale-105", stat.color)}>
                        <p className="text-[8px] font-mono uppercase tracking-widest text-proton-muted mb-1">{stat.label}</p>
                        <p className="text-sm md:text-lg font-black tracking-tight text-proton-text uppercase">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Main Preview Component (Visual Flow or Interaction Log) */}
                  <div className="flex-1 bg-proton-bg border border-proton-border/60 rounded-[24px] p-4 flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between border-b border-proton-border/30 pb-2">
                      <div className="flex items-center gap-2">
                        <Terminal size={12} className="text-proton-accent" />
                        <span className="text-[9px] font-mono uppercase tracking-widest text-proton-muted">{language === 'ka' ? 'AI აგენტის ლოგი' : 'AI Agent Terminal Logs'}</span>
                      </div>
                      <span className="text-[9px] font-mono text-proton-accent">Gemini-2.5-Pro</span>
                    </div>

                    <div className="space-y-2 font-mono flex-1 text-[9px] leading-relaxed select-text py-2">
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
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={cn("p-8 rounded-[32px] border flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 shadow-lg", m.color)}
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-proton-bg/40 mb-6 border border-proton-border">
                    <m.icon className="w-6 h-6 text-proton-text" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-proton-text mb-4">
                    {m.title}
                  </h3>
                  <p className="text-sm font-medium leading-relaxed text-proton-muted">
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

                  <div 
                    className={cn(
                      "transition-all duration-300 ease-in-out border-t border-proton-border bg-proton-bg/40 px-6 overflow-hidden",
                      isOpen ? "py-5 max-h-[300px] opacity-100" : "py-0 max-h-0 opacity-0 border-t-transparent"
                    )}
                  >
                    <p className="text-sm font-medium leading-relaxed text-proton-muted">
                      {faq.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HIGH-CONVERSION CTA FOOTER BANNER */}
      <section id="bottom-cta-banner" className="py-24 px-6 relative overflow-hidden border-t border-proton-border/50">
        <div className="absolute inset-0 bg-proton-accent/5 opacity-40 blur-[120px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter text-proton-text mb-6">
            {currentLocalContent.cta_bottom_title}
          </h2>
          <p className="text-base md:text-lg text-proton-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            {currentLocalContent.cta_bottom_desc}
          </p>

          <button
            id="bottom-cta-btn"
            onClick={onGetStarted}
            className="px-10 py-5 bg-proton-accent text-proton-bg rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xl shadow-proton-accent/20"
          >
            {currentLocalContent.cta_bottom_btn}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer id="landing-footer" className="py-12 border-t border-proton-border/30 text-center px-6 bg-proton-bg-secondary/40">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 opacity-30 grayscale">
            <div className="w-8 h-8 rounded-lg bg-proton-accent flex items-center justify-center text-proton-bg">
              <Zap size={18} fill="currentColor" />
            </div>
            <span className="text-sm font-black tracking-tighter uppercase whitespace-nowrap">Proton Core Systems</span>
          </div>
          <p className="text-xs text-proton-muted font-mono uppercase tracking-[0.2em]">
            {t.footer_text}
          </p>
        </div>
      </footer>
    </div>
  );
};
