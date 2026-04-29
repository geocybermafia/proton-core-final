
import React, { useState } from 'react';
import { motion, Reorder } from 'motion/react';
import { Target, CheckCircle2, Circle, Sparkles, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { cn } from '../lib/utils';

export const ObjectiveCenter = ({ language }: { language: 'en' | 'ka' }) => {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [objectives, setObjectives] = useState([
    {
      id: 'obj-1',
      title: language === 'ka' ? 'ბაზრის დომინაცია' : 'Market Domination',
      progress: 68,
      status: 'active',
      subtasks: [
        { label: language === 'ka' ? 'კონკურენტების ანალიზი' : 'Competitor Sync', completed: true },
        { label: language === 'ka' ? 'ფასების ოპტიმიზაცია' : 'Price Refactoring', completed: true },
        { label: language === 'ka' ? 'ახალი რეგიონების ათვისება' : 'Regional Expansion', completed: false }
      ]
    },
    {
      id: 'obj-2',
      title: language === 'ka' ? 'ნეირონული ეფექტურობა' : 'Neural Efficiency',
      progress: 42,
      status: 'calibrating',
      subtasks: [
        { label: 'Token Reduction', completed: true },
        { label: 'Latency Optimization', completed: false },
        { label: 'Memory Mirroring', completed: false }
      ]
    },
    {
      id: 'obj-3',
      title: language === 'ka' ? 'ბრენდის არქიტექტურა' : 'Brand Architecture',
      progress: 91,
      status: 'complete',
      subtasks: [
        { label: 'Visual ID', completed: true },
        { label: 'Messaging Matrix', completed: true },
        { label: 'Investor Deck 4.0', completed: true }
      ]
    }
  ]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <Target className="text-proton-accent" size={32} />
             <h2 className="text-3xl font-black tracking-tighter text-proton-text uppercase">
                {language === 'ka' ? 'ავტონომიური მიზნების ცენტრი' : 'Autonomous Objective Center'}
             </h2>
          </div>
          <p className="text-[10px] font-black text-proton-muted uppercase tracking-[0.3em]">Neural Goal Breakdown Engine</p>
        </div>

        <div className="flex bg-proton-card p-1.5 rounded-2xl border border-proton-border shadow-sm">
           <button 
             onClick={() => setView('grid')}
             className={cn("p-2 rounded-xl transition-all", view === 'grid' ? "bg-proton-accent text-proton-bg" : "text-proton-muted hover:bg-white/5")}
           >
              <LayoutGrid size={18} />
           </button>
           <button 
             onClick={() => setView('list')}
             className={cn("p-2 rounded-xl transition-all", view === 'list' ? "bg-proton-accent text-proton-bg" : "text-proton-muted hover:bg-white/5")}
           >
              <List size={18} />
           </button>
        </div>
      </div>

      <div className={cn(
        "grid gap-6",
        view === 'grid' ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1"
      )}>
        {objectives.map((obj, i) => (
          <motion.div 
            key={obj.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-proton-card rounded-[40px] border border-proton-border shadow-xl hover:border-proton-accent/40 transition-all group relative overflow-hidden"
          >
             <div className="p-8 space-y-8 relative z-10">
                <div className="flex items-start justify-between">
                   <div className="space-y-1">
                      <h3 className="text-xl font-bold text-proton-text truncate">{obj.title}</h3>
                      <div className="flex items-center gap-2">
                         <div className={cn(
                           "w-1.5 h-1.5 rounded-full animate-pulse",
                           obj.status === 'complete' ? "bg-green-400" : obj.status === 'active' ? "bg-proton-accent" : "bg-amber-400"
                         )} />
                         <span className="text-[10px] font-black uppercase tracking-widest text-proton-muted">{obj.status}</span>
                      </div>
                   </div>
                   <div className="w-12 h-12 rounded-2xl bg-proton-secondary/10 flex items-center justify-center text-proton-secondary group-hover:bg-proton-accent group-hover:text-proton-bg transition-all duration-500">
                      {obj.status === 'complete' ? <CheckCircle2 size={24} /> : <Sparkles size={24} />}
                   </div>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-proton-muted">
                      <span>{language === 'ka' ? 'პროგრესი' : 'Progress'}</span>
                      <span className="text-proton-accent">{obj.progress}%</span>
                   </div>
                   <div className="h-2 w-full bg-proton-bg/40 rounded-full overflow-hidden border border-proton-border/30">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${obj.progress}%` }}
                        className="h-full bg-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.4)]" 
                      />
                   </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-proton-border/50">
                  {obj.subtasks.map((task, j) => (
                    <div key={j} className="flex items-center gap-3 group/task">
                       {task.completed ? (
                         <CheckCircle2 size={16} className="text-proton-accent" />
                       ) : (
                         <Circle size={16} className="text-proton-muted group-hover/task:text-proton-accent transition-colors" />
                       )}
                       <span className={cn(
                         "text-xs font-medium",
                         task.completed ? "text-proton-muted line-through" : "text-proton-text"
                       )}>
                         {task.label}
                       </span>
                    </div>
                  ))}
                </div>

                <button className={cn(
                  "w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                  obj.status === 'complete' ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-proton-accent text-proton-bg"
                )}>
                   {language === 'ka' ? 'ანალიზის გაფართოება' : 'Expand Analysis'}
                   <ChevronRight size={14} />
                </button>
             </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
