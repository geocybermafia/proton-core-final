import React from 'react';
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
  Star
} from 'lucide-react';
import { cn } from '../lib/utils';
import { translations } from '../translations';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
  language: 'en' | 'ka';
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin, language }) => {
  const currentLang = (language === 'ka' || language === 'en') ? language : 'en';
  // @ts-ignore
  const t = translations[currentLang].landing;
  const navT = translations[currentLang].nav;

  const features = [
    {
      icon: Users,
      title: t.feature_1_title,
      description: t.feature_1_desc,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      icon: Globe,
      title: t.feature_2_title,
      description: t.feature_2_desc,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    },
    {
      icon: Workflow,
      title: t.feature_3_title,
      description: t.feature_3_desc,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10"
    }
  ];

  return (
    <div className="min-h-screen bg-proton-bg text-proton-text font-sans overflow-x-hidden selection:bg-proton-accent selection:text-proton-bg">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-[100] border-b border-proton-border/50 bg-proton-bg/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-proton-accent flex items-center justify-center text-proton-bg shadow-lg shadow-proton-accent/20">
              <Zap size={22} fill="currentColor" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase">Proton</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm font-bold uppercase tracking-widest">
            <button 
              onClick={onLogin}
              className="text-proton-muted hover:text-proton-text transition-colors hidden sm:block"
            >
              {t.cta_login}
            </button>
            <button 
              onClick={onGetStarted}
              className="px-6 py-2.5 bg-proton-accent text-proton-bg rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-proton-accent/20"
            >
              {t.cta_start}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-proton-accent/5 rounded-full blur-[150px] -mr-40 -mt-40 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[150px] -ml-40 -mb-40 pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-proton-accent/10 border border-proton-accent/20 text-proton-accent mb-8">
                <Star size={14} fill="currentColor" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Next Generation AI Platform</span>
              </div>
              
              <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8 uppercase">
                {t.hero_title}
              </h1>
              
              <p className="text-xl text-proton-muted mb-12 leading-relaxed max-w-2xl">
                {t.hero_subtitle}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <button 
                  onClick={onGetStarted}
                  className="w-full sm:w-auto px-10 py-5 bg-proton-accent text-proton-bg rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-proton-accent/30 group"
                >
                  {t.cta_start}
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="flex items-center -space-x-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-12 h-12 rounded-full border-4 border-proton-bg bg-proton-card flex items-center justify-center overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="User" />
                    </div>
                  ))}
                  <div className="pl-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-proton-text">Trusted by</p>
                    <p className="text-xs text-proton-muted">5,000+ Business Owners</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Dashboard Preview Overlay */}
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="max-w-7xl mx-auto mt-20 relative px-4"
        >
          <div className="relative group">
            <div className="absolute inset-0 bg-proton-accent/20 blur-[100px] opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="relative bg-proton-card border border-proton-border rounded-[40px] shadow-2xl overflow-hidden aspect-video">
              <div className="h-12 border-b border-proton-border bg-proton-bg/50 px-6 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/30" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/30" />
                  <div className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-500/30" />
                </div>
                <div className="mx-auto bg-proton-bg/80 px-4 py-1 rounded-lg border border-proton-border/50 text-[10px] font-mono text-proton-muted">
                  app.proton-systems.pro/dashboard
                </div>
              </div>
              
              {/* Mock Interface Content */}
              <div className="p-8 grid grid-cols-12 gap-6 h-full">
                <div className="col-span-3 space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-10 bg-proton-bg rounded-xl border border-proton-border/30" />
                  ))}
                </div>
                <div className="col-span-9 space-y-6">
                  <div className="grid grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-32 bg-proton-bg rounded-3xl border border-proton-border/30" />
                    ))}
                  </div>
                  <div className="flex-1 bg-proton-bg rounded-3xl border border-proton-border/30 h-64" />
                </div>
              </div>
              
              <div className="absolute inset-0 bg-gradient-to-t from-proton-bg via-transparent to-transparent opacity-40 pointer-events-none" />
            </div>
            
            {/* Float Floating Elements */}
            <motion.div 
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-10 -right-10 w-64 p-6 bg-proton-card border border-proton-border rounded-3xl shadow-2xl hidden lg:block"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-proton-accent/20 flex items-center justify-center text-proton-accent">
                  <Users size={20} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Team Sync Active</span>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-proton-bg rounded-full overflow-hidden">
                  <div className="h-full w-[80%] bg-proton-accent" />
                </div>
                <div className="h-1.5 w-[60%] bg-proton-bg rounded-full overflow-hidden">
                  <div className="h-full w-[40%] bg-proton-accent opacity-50" />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 border-t border-proton-border/50 bg-proton-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">Enterprise Grade Infrastructure</h2>
            <p className="text-proton-muted max-w-xl mx-auto font-medium">Built for professionals who demand speed, security, and intelligence in every operation.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 rounded-[32px] bg-proton-card border border-proton-border hover:border-proton-accent/30 transition-all group"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-8 shadow-inner transition-transform group-hover:-rotate-6", feature.bg, feature.color)}>
                  <feature.icon size={28} />
                </div>
                <h3 className="text-xl font-bold mb-4 uppercase tracking-tight">{feature.title}</h3>
                <p className="text-proton-muted leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto rounded-[40px] bg-gradient-to-br from-proton-accent to-blue-600 p-12 text-proton-bg flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="space-y-4 max-w-lg">
            <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">Ready to automate your future?</h2>
            <p className="text-proton-bg/80 font-medium">Join thousands of entrepreneurs who have scaled their operations using our neural workspace.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 shrink-0">
            <div className="p-6 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 text-center">
              <p className="text-3xl font-black">99.9%</p>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Uptime</p>
            </div>
            <div className="p-6 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 text-center">
              <p className="text-3xl font-black">500k+</p>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Tasks Ran</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-proton-border/30 text-center px-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 grayscale opacity-50">
            <div className="w-8 h-8 rounded-lg bg-proton-accent flex items-center justify-center text-proton-bg">
              <Zap size={18} fill="currentColor" />
            </div>
            <span className="text-sm font-black tracking-tighter uppercase">Proton</span>
          </div>
          <p className="text-xs text-proton-muted font-mono uppercase tracking-[0.2em]">
            {t.footer_text}
          </p>
        </div>
      </footer>
    </div>
  );
};
