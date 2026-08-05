import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, ArrowRight, CornerDownLeft, Command, Bot, ShoppingBag, Video, Settings, Calendar, Briefcase, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { View } from '../types';
import { COMMAND_ROUTES, matchCommandRoute, CommandRoute } from '../lib/commandRoutes';
import { ProtonBadge, ProtonButton } from '../ui';

interface HeaderQuickSearchProps {
  language: 'en' | 'ka';
  setActiveView: (view: View) => void;
  setUiMode: (mode: 'business' | 'creative' | 'market', targetView?: View) => void;
  className?: string;
}

export const HeaderQuickSearch: React.FC<HeaderQuickSearchProps> = ({
  language = 'en',
  setActiveView,
  setUiMode,
  className
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const matchedRoutes = matchCommandRoute(query);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
    if (query.trim()) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [query]);

  const executeRoute = (route: CommandRoute) => {
    setQuery('');
    setIsOpen(false);
    if (route.uiMode) {
      setUiMode(route.uiMode, route.view);
    } else {
      setActiveView(route.view);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (matchedRoutes.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % matchedRoutes.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matchedRoutes.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + matchedRoutes.length) % matchedRoutes.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matchedRoutes.length > 0 && matchedRoutes[selectedIndex]) {
        executeRoute(matchedRoutes[selectedIndex]);
      } else if (query.trim()) {
        setQuery('');
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getCategoryIcon = (category: CommandRoute['category']) => {
    switch (category) {
      case 'ai': return <Bot size={14} className="text-cyan-400" />;
      case 'creative': return <Sparkles size={14} className="text-amber-400" />;
      case 'business': return <Briefcase size={14} className="text-emerald-400" />;
      case 'core': return <Calendar size={14} className="text-purple-400" />;
      default: return <Settings size={14} className="text-proton-muted" />;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-xs sm:max-w-sm md:max-w-md", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 text-proton-muted pointer-events-none" size={15} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            language === 'ka' 
              ? 'მოძებნეთ გვერდი ან ბრძანება (მაგ. მარკეტი, ჩატი, პარამეტრები)...' 
              : 'Quick search command (e.g. market, chat, settings)...'
          }
          className="w-full bg-proton-bg/80 border border-proton-border focus:border-proton-accent/60 rounded-xl pl-9 pr-16 py-1.5 text-xs text-proton-text placeholder:text-proton-muted/60 focus:outline-none focus:ring-1 focus:ring-proton-accent/30 transition-all font-mono shadow-inner"
        />
        <div className="absolute right-2 flex items-center gap-1 pointer-events-none">
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-proton-card border border-proton-border text-[9px] font-mono text-proton-muted">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Dropdown Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-proton-card/95 border border-proton-border rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar-minimal"
          >
            {matchedRoutes.length > 0 ? (
              <div className="p-2 space-y-1">
                <div className="px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-proton-muted flex items-center justify-between">
                  <span>{language === 'ka' ? 'ნაპოვნი ბრძანებები' : 'Matched Quick Routes'}</span>
                  <span>{matchedRoutes.length} {language === 'ka' ? 'შედეგი' : 'results'}</span>
                </div>
                {matchedRoutes.map((route, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => executeRoute(route)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left cursor-pointer group",
                        isSelected 
                          ? "bg-proton-accent/15 border border-proton-accent/30 text-proton-text shadow-sm" 
                          : "hover:bg-proton-card/80 text-proton-muted border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-proton-bg border border-proton-border/60 shrink-0">
                          {getCategoryIcon(route.category)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-proton-text truncate flex items-center gap-2">
                            <span>{language === 'ka' ? route.titleKa : route.titleEn}</span>
                            <span className="text-[9px] font-mono text-proton-muted opacity-60">
                              ({route.view})
                            </span>
                          </div>
                          <div className="text-[10px] text-proton-muted truncate font-mono mt-0.5">
                            {language === 'ka' ? route.descriptionKa : route.descriptionEn}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isSelected && (
                          <span className="text-[9px] font-mono font-bold text-proton-accent uppercase tracking-wider flex items-center gap-1">
                            {language === 'ka' ? 'გადავლა' : 'Go'}
                            <CornerDownLeft size={10} />
                          </span>
                        )}
                        <ArrowRight size={12} className={cn("transition-transform", isSelected ? "text-proton-accent translate-x-0.5" : "text-proton-muted")} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs text-proton-muted font-mono">
                  {language === 'ka' ? `ბრძანება "${query}" ვერ მოიძებნა მარშრუტების სიაში.` : `No direct route found for "${query}".`}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
