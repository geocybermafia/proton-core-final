import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, CheckCircle2, Circle, Sparkles, ChevronRight, LayoutGrid, List, RotateCcw, X, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { generateStrategicObjective, expandObjectiveAnalysis } from '../lib/gemini';
import Markdown from 'react-markdown';

interface Subtask {
  label: string;
  completed: boolean;
}

interface Objective {
  id: string;
  title: string;
  progress: number;
  status: 'active' | 'complete' | 'calibrating';
  priority: 'low' | 'medium' | 'high';
  category: 'Infrastructure' | 'System' | 'Interface' | 'Security' | 'Intelligence';
  subtasks: Subtask[];
  analysis?: string; // Cached Gemini strategic analysis
}

const safeStorage = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore
    }
  }
};

const getDefaultObjectives = (language: 'en' | 'ka'): Objective[] => [
  {
    id: 'obj-1',
    title: language === 'ka' ? 'სისტემის არქიტექტურა' : 'System Architecture',
    progress: 68,
    status: 'active',
    priority: 'high',
    category: 'Infrastructure',
    subtasks: [
      { label: language === 'ka' ? 'მონაცემთა ბაზის მიგრაცია' : 'Database Migration', completed: true },
      { label: language === 'ka' ? 'API ენდპოინტების ოპტიმიზაცია' : 'API Optimization', completed: true },
      { label: language === 'ka' ? 'უსაფრთხოების აუდიტი' : 'Security Audit', completed: false }
    ]
  },
  {
    id: 'obj-2',
    title: language === 'ka' ? 'ინტერფეისის განახლება' : 'Interface Refactoring',
    progress: 33,
    status: 'active',
    priority: 'medium',
    category: 'System',
    subtasks: [
      { label: language === 'ka' ? 'კომპონენტების ბიბლიოთეკა' : 'Component Library', completed: true },
      { label: language === 'ka' ? 'რესპონსიული დიზაინი' : 'Responsive Overhaul', completed: false },
      { label: language === 'ka' ? 'ხელმისაწვდომობა' : 'Accessibility Sync', completed: false }
    ]
  },
  {
    id: 'obj-3',
    title: language === 'ka' ? 'ნეირონული ქსელის ტრენინგი' : 'Neural Training',
    progress: 100,
    status: 'complete',
    priority: 'high',
    category: 'Intelligence',
    subtasks: [
      { label: language === 'ka' ? 'მონაცემთა წინასწარი დამუშავება' : 'Data Preprocessing', completed: true },
      { label: language === 'ka' ? 'წონების კალიბრაცია' : 'Weight Calibration', completed: true },
      { label: language === 'ka' ? 'დაყოვნების ტესტირება' : 'Latency Testing', completed: true }
    ]
  }
];

export const ObjectiveCenter = ({ language, user }: { language: 'en' | 'ka'; user: any }) => {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'progress'>('priority');

  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analyzingObjId, setAnalyzingObjId] = useState<string | null>(null);
  
  // Selected objective for the detailed analysis view
  const [activeAnalysisObj, setActiveAnalysisObj] = useState<Objective | null>(null);

  const categories = ['Infrastructure', 'System', 'Interface', 'Security', 'Intelligence'];
  const priorities = ['low', 'medium', 'high'];
  const priorityWeight = { high: 3, medium: 2, low: 1 };

  // 1. Fetch initial objectives on mount or auth change
  useEffect(() => {
    let active = true;
    const loadObjectives = async () => {
      setIsLoading(true);
      if (user) {
        try {
          const ref = collection(db, 'users', user.uid, 'objectives');
          const snap = await getDocs(ref);
          if (!active) return;
          if (snap && snap.docs.length > 0) {
            const list = snap.docs.map(d => d.data() as Objective);
            setObjectives(list);
          } else {
            const defaults = getDefaultObjectives(language);
            for (const obj of defaults) {
              await setDoc(doc(db, 'users', user.uid, 'objectives', obj.id), obj);
            }
            if (active) setObjectives(defaults);
          }
        } catch (e) {
          console.error("Firestore load error for objectives", e);
          // Fallback to safeStorage on failure
          const saved = safeStorage.get('proton_objectives');
          if (active) setObjectives(saved ? JSON.parse(saved) : getDefaultObjectives(language));
        }
      } else {
        try {
          const saved = safeStorage.get('proton_objectives');
          if (active) {
            if (saved) {
              setObjectives(JSON.parse(saved));
            } else {
              const defaults = getDefaultObjectives(language);
              safeStorage.set('proton_objectives', JSON.stringify(defaults));
              setObjectives(defaults);
            }
          }
        } catch {
          if (active) setObjectives(getDefaultObjectives(language));
        }
      }
      if (active) setIsLoading(false);
    };

    loadObjectives();
    return () => {
      active = false;
    };
  }, [user, language]);

  // 2. Persist local offline state changes whenever objectives change
  const saveObjectives = async (updatedList: Objective[]) => {
    setObjectives(updatedList);
    if (user) {
      // In firestore, we write each item individually to avoid huge document updates
      try {
        for (const obj of updatedList) {
          await setDoc(doc(db, 'users', user.uid, 'objectives', obj.id), obj);
        }
      } catch (e) {
        console.error("Error synchronizing objectives to Firestore", e);
      }
    } else {
      safeStorage.set('proton_objectives', JSON.stringify(updatedList));
    }
  };

  // 3. Toggle a subtask
  const toggleSubtask = async (objId: string, taskIndex: number) => {
    const updatedList = objectives.map(obj => {
      if (obj.id !== objId) return obj;
      const newSubtasks = [...obj.subtasks];
      newSubtasks[taskIndex].completed = !newSubtasks[taskIndex].completed;
      
      const completedCount = newSubtasks.filter(t => t.completed).length;
      const newProgress = Math.round((completedCount / newSubtasks.length) * 100);
      
      return { 
        ...obj, 
        subtasks: newSubtasks, 
        progress: newProgress,
        status: newProgress === 100 ? ('complete' as const) : newProgress > 0 ? ('active' as const) : ('calibrating' as const)
      };
    });
    await saveObjectives(updatedList);
  };

  // 4. Generate a new strategic objective using Gemini
  const handleGenerateObjective = async () => {
    setIsGenerating(true);
    try {
      const generated = await generateStrategicObjective(language);
      const newObj: Objective = {
        id: `obj-${Date.now()}`,
        title: generated.title,
        priority: generated.priority,
        category: generated.category,
        subtasks: generated.subtasks,
        progress: 0,
        status: 'calibrating'
      };
      
      const newList = [newObj, ...objectives];
      await saveObjectives(newList);
    } catch (e) {
      console.error("Failed to generate strategic objective", e);
    } finally {
      setIsGenerating(false);
    }
  };

  // 5. Expand and analyze with Gemini
  const handleExpandAnalysis = async (obj: Objective) => {
    // If we already have cached analysis, just open it
    if (obj.analysis) {
      setActiveAnalysisObj(obj);
      return;
    }

    setAnalyzingObjId(obj.id);
    try {
      const analysisMarkdown = await expandObjectiveAnalysis(obj.title, obj.category, language);
      const updatedList = objectives.map(item => {
        if (item.id === obj.id) {
          const updated = { ...item, analysis: analysisMarkdown };
          // If we are currently selecting this one, keep active view in sync
          setActiveAnalysisObj(updated);
          return updated;
        }
        return item;
      });
      await saveObjectives(updatedList);
    } catch (e) {
      console.error("Failed to perform strategic analysis expansion", e);
    } finally {
      setAnalyzingObjId(null);
    }
  };

  // 6. Delete an objective
  const handleDeleteObjective = async (objId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedList = objectives.filter(o => o.id !== objId);
    setObjectives(updatedList);
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'objectives', objId));
      } catch (err) {
        console.error("Error deleting objective from Firestore", err);
      }
    } else {
      safeStorage.set('proton_objectives', JSON.stringify(updatedList));
    }
  };

  const filteredAndSortedObjectives = objectives
    .filter(obj => (filterCategory === 'all' || obj.category === filterCategory))
    .filter(obj => (filterPriority === 'all' || obj.priority === filterPriority))
    .sort((a, b) => {
      if (sortBy === 'priority') {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      return b.progress - a.progress;
    });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Target className="text-proton-accent" size={32} />
            <h2 className="text-3xl font-black tracking-tighter text-proton-text uppercase">
              {language === 'ka' ? 'სტრატეგიული მიზნების დაფა' : 'Strategic Goals Dashboard'}
            </h2>
          </div>
          <p className="text-[10px] font-black text-proton-muted uppercase tracking-[0.3em]">
            {language === 'ka' ? 'ბიზნეს მიზნების ავტომატური მონიტორინგი' : 'Business Objective Monitoring'}
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-proton-card border border-proton-border text-proton-text text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl focus:outline-none focus:border-proton-accent"
            >
              <option value="all">{language === 'ka' ? 'ყველა კატეგორია' : 'All Categories'}</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>

            <select 
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-proton-card border border-proton-border text-proton-text text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl focus:outline-none focus:border-proton-accent"
            >
              <option value="all">{language === 'ka' ? 'ყველა პრიორიტეტი' : 'All Priorities'}</option>
              {priorities.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>

            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'priority' | 'progress')}
              className="bg-proton-card border border-proton-border text-proton-text text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl focus:outline-none focus:border-proton-accent"
            >
              <option value="priority">{language === 'ka' ? 'სორტირება: პრიორიტეტი' : 'Sort: Priority'}</option>
              <option value="progress">{language === 'ka' ? 'სორტირება: პროგრესი' : 'Sort: Progress'}</option>
            </select>
          </div>

          <button 
            onClick={handleGenerateObjective}
            disabled={isGenerating}
            className="px-6 py-3 bg-proton-accent text-proton-bg rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {language === 'ka' ? 'ახალი მიზნის გენერაცია' : 'Generate New Objective'}
          </button>

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
      </div>

      {/* Main Grid View */}
      {isLoading ? (
        <div className="h-[300px] flex flex-col items-center justify-center text-proton-muted/60 font-mono text-xs gap-3">
          <Loader2 className="animate-spin text-proton-accent" size={32} />
          <span className="uppercase tracking-widest">Synchronizing business goals...</span>
        </div>
      ) : filteredAndSortedObjectives.length === 0 ? (
        <div className="h-[250px] border border-dashed border-proton-border bg-proton-card/20 rounded-[40px] flex flex-col items-center justify-center text-proton-muted/50 font-mono text-xs gap-2">
          <Target size={36} className="text-proton-muted/30" />
          <span className="uppercase tracking-widest">No matching objectives found</span>
        </div>
      ) : (
        <div className={cn(
          "grid gap-6",
          view === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        )}>
          {filteredAndSortedObjectives.map((obj, i) => (
            <motion.div 
              key={obj.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-proton-card rounded-[40px] border border-proton-border shadow-xl hover:border-proton-accent/40 transition-all group relative overflow-hidden flex flex-col justify-between"
            >
              {/* Strategic card header */}
              <div className="p-8 space-y-6 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border",
                        obj.priority === 'high' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        obj.priority === 'medium' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      )}>
                        {language === 'ka' ? (
                          obj.priority === 'high' ? 'მაღალი' : 
                          obj.priority === 'medium' ? 'საშუალო' : 'დაბალი'
                        ) : obj.priority.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-proton-accent/10 border border-proton-accent/20 text-proton-accent text-[8px] font-black uppercase tracking-wider">
                        {language === 'ka' ? (
                          obj.category === 'Infrastructure' ? 'ინფრასტრუქტურა' :
                          obj.category === 'System' ? 'სისტემა' :
                          obj.category === 'Interface' ? 'ინტერფეისი' :
                          obj.category === 'Security' ? 'უსაფრთხოება' :
                          obj.category === 'Intelligence' ? 'ინტელექტი' : obj.category
                        ) : obj.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-proton-text line-clamp-2 leading-tight">{obj.title}</h3>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse",
                        obj.status === 'complete' ? "bg-green-400" : obj.status === 'active' ? "bg-proton-accent" : "bg-amber-400"
                      )} />
                      <span className="text-[9px] font-black uppercase tracking-widest text-proton-muted">{obj.status}</span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteObjective(obj.id, e)}
                    className="p-2 rounded-xl text-proton-muted hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                    title={language === 'ka' ? 'მიზნის წაშლა' : 'Delete objective'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-proton-muted">
                    <span>{language === 'ka' ? 'პროგრესი' : 'Progress'}</span>
                    <span className="text-proton-accent">{obj.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-proton-bg/40 rounded-full overflow-hidden border border-proton-border/30">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${obj.progress}%` }}
                      className="h-full bg-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.4)]" 
                    />
                  </div>
                </div>

                {/* Checklist subtasks */}
                <div className="space-y-3 pt-4 border-t border-proton-border/50">
                  {obj.subtasks.map((task, j) => (
                    <button 
                      key={j} 
                      onClick={() => toggleSubtask(obj.id, j)}
                      className="flex items-start gap-3 group/task w-full text-left py-0.5"
                    >
                      {task.completed ? (
                        <CheckCircle2 size={15} className="text-proton-accent shrink-0 mt-0.5" />
                      ) : (
                        <Circle size={15} className="text-proton-muted group-hover/task:text-proton-accent transition-colors shrink-0 mt-0.5" />
                      )}
                      <span className={cn(
                        "text-xs transition-all",
                        task.completed ? "text-proton-muted line-through" : "text-proton-text"
                      )}>
                        {task.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Expansion Button */}
              <div className="p-8 pt-0">
                <button 
                  onClick={() => handleExpandAnalysis(obj)}
                  disabled={analyzingObjId === obj.id}
                  className={cn(
                    "w-full py-3.5 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border",
                    obj.status === 'complete' 
                      ? "bg-green-500/5 text-green-400 border-green-500/10 hover:bg-green-500/10" 
                      : "bg-proton-secondary/20 hover:bg-proton-accent hover:text-proton-bg text-proton-accent border-proton-accent/20"
                  )}
                >
                  {analyzingObjId === obj.id ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>{language === 'ka' ? 'მიმდინარეობს ანალიზი...' : 'Analyzing strategy...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{language === 'ka' ? 'სტრატეგიული ანალიზი' : 'Strategic Analysis'}</span>
                      <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Strategic Analysis Modal Container */}
      <AnimatePresence>
        {activeAnalysisObj && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-proton-bg/85 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-proton-card border border-proton-border w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal header */}
              <div className="p-6 sm:p-8 border-b border-proton-border/80 flex items-start justify-between gap-6 bg-proton-bg/40">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-proton-accent/10 border border-proton-accent/20 text-proton-accent text-[8px] font-black uppercase tracking-wider">
                      {activeAnalysisObj.category}
                    </span>
                    <span className="text-[10px] font-mono text-proton-muted">
                      {activeAnalysisObj.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-proton-text leading-tight">{activeAnalysisObj.title}</h3>
                </div>
                <button 
                  onClick={() => setActiveAnalysisObj(null)}
                  className="p-2 rounded-xl text-proton-muted hover:text-proton-text hover:bg-white/5 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal body (Markdown Strategic Content) */}
              <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
                <div className="markdown-body text-sm text-proton-text/90 leading-relaxed space-y-4">
                  <Markdown>{activeAnalysisObj.analysis || ''}</Markdown>
                </div>
              </div>

              {/* Modal footer */}
              <div className="p-6 sm:p-8 border-t border-proton-border/80 bg-proton-bg/20 flex justify-end">
                <button 
                  onClick={() => setActiveAnalysisObj(null)}
                  className="px-6 py-3 bg-proton-accent text-proton-bg rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                >
                  {language === 'ka' ? 'დახურვა' : 'Close Analysis'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
