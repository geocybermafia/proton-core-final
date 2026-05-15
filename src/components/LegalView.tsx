import React from 'react';
import { motion } from 'motion/react';
import { Shield, FileText, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface LegalViewProps {
  type: 'privacy' | 'terms';
  language: 'en' | 'ka';
  t: any;
  currentTheme: any;
  onBack: () => void;
}

export function LegalView({ type, language, t, currentTheme, onBack }: LegalViewProps) {
  const content = type === 'privacy' ? t.market.legal.privacy_content : t.market.legal.terms_content;
  const title = type === 'privacy' ? t.market.legal.privacy_policy : t.market.legal.terms_of_service;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 lg:py-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <button 
        onClick={onBack}
        className={cn(
          "flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] mb-12 hover:translate-x-[-4px] transition-transform",
          currentTheme.accent
        )}
      >
        <ArrowLeft size={16} />
        {language === 'ka' ? 'უკან დაბრუნება' : 'Back to Market'}
      </button>

      <div className={cn("p-12 md:p-20 rounded-[48px] border", currentTheme.card)}>
        <div className="flex items-center gap-6 mb-12">
          <div className={cn("p-5 rounded-3xl bg-white/5", currentTheme.accent)}>
            {type === 'privacy' ? <Shield size={32} /> : <FileText size={32} />}
          </div>
          <div>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white">
              {title}
            </h1>
            <p className={cn("text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mt-2", currentTheme.muted)}>
              {language === 'ka' ? 'ოფიციალური დოკუმენტაცია' : 'Official Documentation'}
            </p>
          </div>
        </div>

        <div className="space-y-8 leading-relaxed">
          <p className={cn("text-lg font-medium opacity-80", currentTheme.muted)}>
            {content}
          </p>
          <div className="pt-8 border-t border-white/5">
            <h3 className="text-white font-black uppercase text-xs mb-4 tracking-widest">
              {language === 'ka' ? 'ბოლო განახლება' : 'Last Updated'}
            </h3>
            <p className={cn("text-xs font-bold", currentTheme.muted)}>
              {new Date().toLocaleDateString(language === 'ka' ? 'ka-GE' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
