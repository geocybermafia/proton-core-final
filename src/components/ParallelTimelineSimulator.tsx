
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GitBranch, GitMerge, Activity, Zap, Play, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

export const ParallelTimelineSimulator = ({ language }: { language: 'en' | 'ka' }) => {
  const [activePath, setActivePath] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('running');
  
  const paths = [
    { 
      id: 0, 
      name: language === 'ka' ? 'ოპტიმალური ზრდა' : 'Optimal Growth', 
      color: 'text-cyan-400', 
      secondary: 'bg-cyan-400/20',
      desc: language === 'ka' ? 'ბალანსირებული განვითარება და რისკების მინიმიზაცია.' : 'Balanced development with focused risk minimization.'
    },
    { 
      id: 1, 
      name: language === 'ka' ? 'აგრესიული სკალირება' : 'Aggressive Scale', 
      color: 'text-purple-400', 
      secondary: 'bg-purple-400/20',
      desc: language === 'ka' ? 'მაქსიმალური ზრდა მაღალი რესურსების ხარჯზე.' : 'Maximum growth leveraging high resource throughput.'
    },
    { 
      id: 2, 
      name: language === 'ka' ? 'რისკ-მიტიგაცია' : 'Risk Mitigation', 
      color: 'text-amber-400', 
      secondary: 'bg-amber-400/20',
      desc: language === 'ka' ? 'უსაფრთხოებაზე ორიენტირებული სტაბილური სეგმენტაცია.' : 'Safety-first approach with stable market segmentation.'
    }
  ];

  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) return 0;
        return p + 0.5;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [status]);

  const toggleSimulation = () => {
    setStatus(prev => prev === 'running' ? 'paused' : 'running');
  };

  const resetSimulation = () => {
    setProgress(0);
    setStatus('paused');
  };

  const metrics = [
    { label: language === 'ka' ? 'სიზუსტე' : 'Accuracy', value: '98.2%', desc: language === 'ka' ? 'მოდელის სიზუსტის მაჩვენებელი' : 'Model accuracy rating' },
    { label: language === 'ka' ? 'რისკი' : 'Risk', value: `${(2.1 + progress/40).toFixed(1)}%`, desc: language === 'ka' ? 'სავარაუდო რისკ-ფაქტორი' : 'Estimated risk factor' },
    { label: language === 'ka' ? 'ეფექტი' : 'Impact', value: 'High', desc: language === 'ka' ? 'ბიზნეს გავლენის ხარისხი' : 'Level of business impact' }
  ];

  return (
    <div className="bg-proton-card p-8 rounded-[40px] border border-proton-border shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
        <GitBranch size={120} />
      </div>
      
      <div className="relative z-10 space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-2xl font-black tracking-tighter text-proton-text flex items-center gap-3">
              <Zap className="text-proton-accent" size={24} />
              {language === 'ka' ? 'სტრატეგიული სცენარების ანალიზატორი' : 'Strategic Scenario Analyzer'}
            </h3>
            <p className="text-[10px] font-black text-proton-muted uppercase tracking-[0.2em]">Business Forecast Analysis</p>
          </div>
          
          <div className="flex gap-2 p-1.5 bg-proton-bg/50 rounded-2xl border border-proton-border">
            {paths.map(path => (
              <button
                key={path.id}
                onClick={() => {
                  setActivePath(path.id);
                  setProgress(0);
                  setStatus('running');
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                  activePath === path.id ? "bg-proton-accent text-proton-bg shadow-lg" : "text-proton-muted hover:text-proton-text"
                )}
              >
                {path.name}
              </button>
            ))}
          </div>
        </div>

        <div className="relative h-72 bg-proton-bg/40 rounded-[32px] border border-proton-border p-8 flex items-center justify-between overflow-hidden">
          {/* Futuristic Timeline Visualization */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/20" />
            <div className="grid grid-cols-12 h-full gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-r border-white/10 h-full w-full" />
              ))}
            </div>
          </div>

          <div className="relative flex-1 space-y-10">
            <div className={cn("space-y-4 transition-all duration-700", paths[activePath].color)}>
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-500", status === 'running' && "scale-110", paths[activePath].secondary)}>
                  <Activity size={24} className={cn(status === 'running' && "animate-pulse")} />
                </div>
                <div>
                  <p className="text-3xl font-black tracking-tighter">{(90 + progress/10).toFixed(1)}%</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Confidence Level</p>
                </div>
              </div>
              
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${progress}%` }}
                   className={cn("h-full", paths[activePath].secondary.replace('/20', ''))} 
                />
              </div>
              <p className="text-[10px] font-medium italic opacity-70">{paths[activePath].desc}</p>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {metrics.map((m, i) => (
                <div key={i} className="space-y-1 group/metric relative">
                   <p className="text-[9px] font-black text-proton-muted uppercase tracking-[0.2em]">{m.label}</p>
                   <p className="text-sm font-bold text-proton-text">{m.value}</p>
                   <div className="absolute top-full left-0 mt-2 p-2 bg-proton-card border border-proton-border rounded-lg shadow-xl opacity-0 invisible group-hover/metric:opacity-100 group-hover/metric:visible transition-all z-20 w-32">
                     <p className="text-[8px] font-bold text-proton-text leading-tight">{m.desc}</p>
                   </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden md:flex flex-col gap-3 ml-8">
            <button 
              onClick={resetSimulation}
              className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
               <RotateCcw size={20} />
            </button>
            <button 
              onClick={toggleSimulation}
              className={cn(
                "p-4 rounded-2xl border transition-all",
                status === 'running' 
                  ? "bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20" 
                  : "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20"
              )}
            >
               {status === 'running' ? <Play size={20} className="rotate-90" /> : <Play size={20} />}
            </button>
          </div>
        </div>

        <div className="p-6 rounded-[32px] bg-proton-secondary/5 border border-proton-secondary/10 flex items-center gap-6">
            <div className="w-12 h-12 rounded-2xl bg-proton-secondary/10 flex items-center justify-center text-proton-secondary">
               <GitMerge size={24} />
            </div>
            <div className="flex-1 space-y-1">
               <p className="text-xs font-bold text-proton-text">
                 {language === 'ka' 
                   ? 'სისტემა ამჟამად აანალიზებს 124 პარალელურ შესაძლებლობას.' 
                   : 'System is currently synthesizing 124 parallel probabilistic outcomes.'}
               </p>
               <p className="text-[10px] text-proton-muted font-medium uppercase tracking-[0.1em]">Neural Convergence level: High</p>
            </div>
        </div>
      </div>
    </div>
  );
};
