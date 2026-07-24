import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Search, 
  Languages, 
  FileText, 
  ImageIcon, 
  Users, 
  Briefcase, 
  LayoutDashboard, 
  X, 
  ArrowRight,
  HelpCircle,
  Zap,
  Globe
} from 'lucide-react';
import { View } from '../types';

interface FriendlyAssistantWidgetProps {
  language: 'en' | 'ka';
  activeView: View;
  uiMode: 'business' | 'creative' | 'market';
  onNavigate: (view: View) => void;
  onSetLanguage: (lang: 'en' | 'ka') => void;
  onSetUiMode: (mode: 'business' | 'creative' | 'market', targetView?: View) => void;
}

export const FriendlyAssistantWidget: React.FC<FriendlyAssistantWidgetProps> = ({
  language,
  activeView,
  uiMode,
  onNavigate,
  onSetLanguage,
  onSetUiMode,
}) => {
  const isKa = language === 'ka';
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const quickActions = [
    {
      id: 'creative-studio' as View,
      mode: 'creative' as const,
      title: isKa ? 'კრეატიული სტუდია' : 'Creative Studio',
      desc: isKa ? 'ბრენდინგის და მარკეტინგის ინსტრუმენტები' : 'Branding & AI Marketing hub',
      icon: Sparkles,
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
    },
    {
      id: 'copywriting' as View,
      mode: 'creative' as const,
      title: isKa ? 'სარეკლამო კოპირაიტინგი' : 'AI Copywriter',
      desc: isKa ? 'მაღალი კონვერსიის სარეკლამო ტექსტები' : 'High-converting ad copy generator',
      icon: FileText,
      color: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30',
    },
    {
      id: 'translator' as View,
      mode: 'creative' as const,
      title: isKa ? 'ხმოვანი თარჯიმანი' : 'Voice & Text Translator',
      desc: isKa ? 'მყისიერი ქართულ-ინგლისური თარგმანი' : 'Instant dual-language translation',
      icon: Languages,
      color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30',
    },
    {
      id: 'image' as View,
      mode: 'creative' as const,
      title: isKa ? 'AI სურათების სტუდია' : 'AI Image Generator',
      desc: isKa ? 'ვიზუალური კონტენტის შექმნა Imagen AI-ით' : 'Visual content generation with Imagen AI',
      icon: ImageIcon,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'personas' as View,
      mode: 'business' as const,
      title: isKa ? 'AI ასისტენტები და პერსონები' : 'AI Personas Hub',
      desc: isKa ? 'სპეციალიზებული ექსპერტი AI კონსულტანტები' : 'Specialized expert AI consultants',
      icon: Users,
      color: 'from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30',
    },
    {
      id: 'business-hub' as View,
      mode: 'business' as const,
      title: isKa ? 'ბიზნეს მართვის ჰაბი' : 'Business Management Hub',
      desc: isKa ? 'პროექტების და ავტომატიზაციის მართვა' : 'Project & workflow automation hub',
      icon: Briefcase,
      color: 'from-slate-500/20 to-zinc-500/20 text-slate-300 border-slate-500/30',
    },
    {
      id: 'dashboard' as View,
      mode: 'business' as const,
      title: isKa ? 'მთავარი მართვის პანელი' : 'Main Project Dashboard',
      desc: isKa ? 'დავალებები, სტატისტიკა და მიმოხილვა' : 'Tasks, statistics and active project overview',
      icon: LayoutDashboard,
      color: 'from-sky-500/20 to-blue-500/20 text-sky-400 border-sky-500/30',
    },
  ];

  const filteredActions = quickActions.filter(
    (action) =>
      action.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      action.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getContextHelpTip = () => {
    switch (activeView) {
      case 'creative-studio':
        return isKa
          ? '💡 რჩევა: გამოიყენეთ სარეკლამო კოპირაიტინგის ინსტრუმენტი Facebook და Instagram პოსტების დასაგენერირებლად.'
          : '💡 Tip: Use the Ad Copywriting tool to generate high-converting text for Facebook & Instagram.';
      case 'translator':
        return isKa
          ? '💡 რჩევა: დააჭირეთ მიკროფონის ღილაკს ხმოვანი თარგმანისთვის ან გამოიყენეთ სწრაფი ფრაზების შაბლონები.'
          : '💡 Tip: Click the microphone icon for voice translation or use the quick preset phrasing chips.';
      case 'copywriting':
        return isKa
          ? '💡 რჩევა: აირჩიეთ „ორენოვანი“ რეჟიმი ქართული და ინგლისური სარეკლამო ტექსტების ერთდროულად მისაღებად.'
          : '💡 Tip: Select "Both" languages to receive Georgian and English ad variations simultaneously.';
      case 'image':
        return isKa
          ? '💡 რჩევა: აღწერეთ სასურველი ვიზუალი დეტალურად საუკეთესო შედეგისთვის.'
          : '💡 Tip: Describe your visual concept with detail for optimal Imagen AI results.';
      default:
        return isKa
          ? '💡 რჩევა: გამოიყენეთ Ctrl+K კლავიშების კომბინაცია სწრაფი ნავიგაციის მენიუს ნებისმიერ დროს გახსნისთვის.'
          : '💡 Tip: Press Ctrl+K anytime to open this Quick Navigation and AI Assistant launcher.';
    }
  };

  return (
    <>
      {/* Floating Trigger Button at Bottom Right */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-proton-accent via-cyan-500 to-blue-600 text-proton-bg font-black text-xs shadow-2xl shadow-proton-accent/25 hover:shadow-proton-accent/40 transition-all border border-white/20 group"
        title={isKa ? 'სწრაფი ასისტენტი და ნავიგაცია (Ctrl+K)' : 'Quick AI Assistant & Nav (Ctrl+K)'}
        id="friendly-assistant-trigger"
      >
        <Sparkles className="w-4 h-4 text-proton-bg group-hover:rotate-12 transition-transform duration-300" />
        <span className="hidden sm:inline uppercase tracking-wider">
          {isKa ? 'ასისტენტი' : 'Assistant'}
        </span>
        <span className="px-1.5 py-0.5 rounded-md bg-black/20 text-[9px] font-mono font-bold text-proton-bg/90">
          ⌘K
        </span>
      </motion.button>

      {/* Modal Quick Launcher */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />

            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 15 }}
              className="relative w-full max-w-2xl bg-proton-card rounded-3xl border border-proton-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              id="friendly-assistant-modal"
            >
              {/* Top Banner */}
              <div className="p-6 bg-gradient-to-r from-proton-accent/15 via-purple-500/10 to-blue-500/15 border-b border-proton-border/60 relative">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-proton-accent text-proton-bg flex items-center justify-center shadow-lg shadow-proton-accent/20">
                      <Zap size={22} />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold tracking-tight text-proton-text flex items-center gap-2">
                        {isKa ? 'Proton AI ასისტენტი' : 'Proton AI Assistant & Hub'}
                      </h3>
                      <p className="text-xs text-proton-muted font-medium">
                        {isKa ? 'სწრაფი ნავიგაცია და ინსტრუმენტების ცენტრი' : 'Instant search & quick action tool launcher'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl border border-proton-border/50 hover:bg-proton-secondary/20 text-proton-muted hover:text-proton-text transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Quick Search Input */}
                <div className="mt-4 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proton-muted" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isKa ? 'მოძებნეთ ინსტრუმენტი ან ფუნქცია...' : 'Search tools, generators, or settings...'}
                    className="w-full bg-proton-bg/90 border border-proton-border/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-proton-text placeholder-proton-muted focus:outline-none focus:border-proton-accent transition-all shadow-inner"
                    autoFocus
                  />
                </div>
              </div>

              {/* Action List Scrollable Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold text-proton-muted uppercase tracking-wider">
                  <span>{isKa ? 'ხელმისაწვდომი ინსტრუმენტები' : 'Available Tools'}</span>
                  <span>{filteredActions.length} {isKa ? 'შედეგი' : 'items'}</span>
                </div>

                {filteredActions.map((action) => {
                  const IconComp = action.icon;
                  const isActive = activeView === action.id;

                  return (
                    <motion.button
                      key={action.id}
                      whileHover={{ x: 4 }}
                      onClick={() => {
                        onSetUiMode(action.mode, action.id);
                        onNavigate(action.id);
                        setIsOpen(false);
                      }}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-4 group ${
                        isActive
                          ? 'bg-proton-accent/10 border-proton-accent/40 shadow-sm'
                          : 'bg-proton-bg/50 border-proton-border/40 hover:bg-proton-secondary/20 hover:border-proton-border'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center bg-gradient-to-br ${action.color}`}>
                          <IconComp size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-proton-text flex items-center gap-2">
                            {action.title}
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-proton-accent/20 text-proton-accent text-[9px] font-extrabold uppercase">
                                {isKa ? 'აქტიური' : 'Active'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-proton-muted font-medium mt-0.5">
                            {action.desc}
                          </p>
                        </div>
                      </div>

                      <ArrowRight size={16} className="text-proton-muted group-hover:text-proton-accent group-hover:translate-x-1 transition-all shrink-0" />
                    </motion.button>
                  );
                })}
              </div>

              {/* Bottom Context Help Tip & Language Switcher */}
              <div className="p-4 bg-proton-bg/80 border-t border-proton-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-proton-muted font-medium text-[11px]">
                  <HelpCircle size={14} className="text-proton-accent shrink-0" />
                  <span>{getContextHelpTip()}</span>
                </div>

                {/* Direct Language Switcher */}
                <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto bg-proton-card p-1 rounded-xl border border-proton-border">
                  <Globe size={12} className="text-proton-muted ml-1" />
                  <button
                    onClick={() => onSetLanguage('ka')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      isKa ? 'bg-proton-accent text-proton-bg' : 'text-proton-muted hover:text-proton-text'
                    }`}
                  >
                    ქართული
                  </button>
                  <button
                    onClick={() => onSetLanguage('en')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      !isKa ? 'bg-proton-accent text-proton-bg' : 'text-proton-muted hover:text-proton-text'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
