import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { 
  Play, 
  Pause, 
  Check, 
  Edit2, 
  Save, 
  X, 
  Clock, 
  Trash2, 
  Search, 
  Layers, 
  Repeat, 
  Zap, 
  Plus, 
  ChevronDown, 
  Info,
  Calendar as CalendarIcon,
  Tag,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  Grid,
  AlertTriangle
} from 'lucide-react';
import { Task, Workflow, Theme } from '../types';
import { translations } from '../translations';
import { cn } from '../lib/utils';

type OrganizerTheme = Theme;

interface OrganizerViewProps {
  language: 'en' | 'ka';
  workflows: Workflow[];
  tasks: Task[];
  onAddTask: (
    content: string, 
    priority: 'low' | 'medium' | 'high', 
    category?: string,
    description?: string,
    dueDate?: number,
    recurring?: 'none' | 'daily' | 'weekly' | 'monthly',
    energyCost?: 'low' | 'medium' | 'high',
    estimatedTime?: number
  ) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string, updates: Partial<Task>) => void;
  onAiSuggest: () => void;
  uiMode: 'business' | 'creative';
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const OrganizerView = ({
  language,
  workflows,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onAiSuggest,
  uiMode,
  theme,
  setTheme,
}: OrganizerViewProps) => {
  const t = translations[language].organizer;
  const commonT = translations[language].common || { add: language === 'ka' ? 'დამატება' : 'Add' };

  // Task form states
  const [newTaskInput, setNewTaskInput] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState<Date | null>(null);
  const [taskRecurring, setTaskRecurring] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [taskEnergy, setTaskEnergy] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskEstTime, setTaskEstTime] = useState<number>(30);
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskCategory, setTaskCategory] = useState('');

  // UI Toggles & Filter states
  const [energyFilter, setEnergyFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showAdvancedAdd, setShowAdvancedAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [viewLayout, setViewLayout] = useState<'list' | 'grouped'>('grouped');

  // Task inline editing states
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingPriority, setEditingPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editingCategory, setEditingCategory] = useState('');

  // Timer/Stopwatch states - optimized to batch Firestore updates to avoid lagging on slow hardware
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [localTimerSeconds, setLocalTimerSeconds] = useState<{ [taskId: string]: number }>({});
  const tasksRef = useRef<Task[]>(tasks);

  // Sync tasks ref for background timer checks
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Stopwatch ticking logic
  useEffect(() => {
    if (!activeTimerTaskId) return;

    // Load initial task time if not already tracked locally
    const initialTask = tasksRef.current.find(tk => tk.id === activeTimerTaskId);
    const initialSeconds = initialTask ? (initialTask.elapsedTime || 0) : 0;
    
    setLocalTimerSeconds(prev => ({
      ...prev,
      [activeTimerTaskId]: prev[activeTimerTaskId] !== undefined ? prev[activeTimerTaskId] : initialSeconds
    }));

    console.log(`[Stress Test Logs] Starting optimized local timer tick for task: ${activeTimerTaskId}. Current accumulated: ${initialSeconds}s`);

    let tickCount = 0;
    const interval = setInterval(() => {
      setLocalTimerSeconds(prev => {
        const nextSec = (prev[activeTimerTaskId] || 0) + 1;
        
        // Every 30 seconds, perform a silent database flush as a backup safety fallback
        tickCount++;
        if (tickCount >= 30) {
          tickCount = 0;
          console.log(`[Stress Test Logs] Periodic safety backup save of active task stopwatch: ${activeTimerTaskId} with ${nextSec} seconds.`);
          onEditTask(activeTimerTaskId, { elapsedTime: nextSec });
        }
        
        return {
          ...prev,
          [activeTimerTaskId]: nextSec
        };
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [activeTimerTaskId, onEditTask]);

  const themes = {
    light: {
      container: "bg-[#f8fafc] text-slate-900",
      card: "bg-white border-slate-200 shadow-xl rounded-[32px] border",
      accent: "text-blue-600 bg-blue-50 border-blue-100",
      button: "bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-slate-800",
      input: "bg-white border-slate-200 text-slate-900 focus:border-blue-500 rounded-2xl border-2",
      label: "text-slate-500 font-bold tracking-tight",
      muted: "text-slate-400",
      calendar: `
        .react-calendar { background: transparent !important; border: none !important; width: 100% !important; }
        .react-calendar__navigation button { color: #0f172a !important; font-weight: bold !important; min-width: 44px !important; }
        .react-calendar__month-view__weekdays { text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: #94a3b8; }
        .react-calendar__tile { padding: 0.8em 0.1em !important; font-size: 0.8rem !important; color: #1e293b !important; border-radius: 12px; transition: all 0.2s; }
        .react-calendar__tile:hover { background: #f1f5f9 !important; }
        .react-calendar__tile--now { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; }
        .react-calendar__tile--active { background: #0f172a !important; color: white !important; font-weight: bold; }
      `
    },
    titanium: {
      container: "bg-slate-950 text-slate-100",
      card: "bg-slate-900 border-slate-800 shadow-2xl rounded-3xl border",
      accent: "text-slate-300 bg-slate-400/10 border-slate-400/20",
      button: "bg-slate-100 text-slate-900 rounded-2xl font-black shadow-lg hover:bg-slate-200",
      input: "bg-slate-950/50 border-slate-700 text-slate-100 focus:border-slate-500 rounded-2xl border-2",
      label: "text-slate-500 font-black uppercase tracking-widest",
      muted: "text-slate-500",
      calendar: `.react-calendar { background: transparent !important; border: none !important; width: 100% !important; } .react-calendar__tile--active { background: #f1f5f9 !important; color: #0f172a !important; }`
    },
    proton: {
      container: "bg-black text-cyan-400",
      card: "bg-black border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.1)] rounded-[32px] border",
      accent: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
      button: "bg-cyan-500 text-black rounded-2xl font-black shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:bg-cyan-400",
      input: "bg-black/80 border-cyan-900 text-cyan-400 focus:border-cyan-400 rounded-2xl border-2",
      label: "text-cyan-400/60 font-mono italic",
      muted: "text-cyan-900",
      calendar: `.react-calendar { background: transparent !important; border: none !important; width: 100% !important; } .react-calendar__tile { color: #22d3ee !important; } .react-calendar__tile--active { background: #22d3ee !important; color: black !important; font-weight: bold; }`
    },
    forest: {
      container: "bg-[#022c22] text-emerald-100",
      card: "bg-emerald-950/40 border-emerald-500/15 shadow-2xl rounded-[32px] border",
      accent: "text-emerald-400 bg-emerald-400/15 border-emerald-400/15",
      button: "bg-emerald-600 text-white rounded-2xl shadow-emerald-500/20 hover:bg-emerald-500",
      input: "bg-emerald-950/50 border-emerald-900 text-emerald-100 focus:border-emerald-500 rounded-2xl border-2",
      label: "text-emerald-500/60 font-black uppercase tracking-tight",
      muted: "text-emerald-800",
      calendar: `.react-calendar { background: transparent !important; border: none !important; width: 100% !important; } .react-calendar__tile--active { background: #10b981 !important; color: white !important; }`
    },
    sunset: {
      container: "bg-[#431407] text-orange-100",
      card: "bg-black/20 border-orange-500/15 shadow-2xl rounded-[32px] border",
      accent: "text-orange-400 bg-orange-400/15 border-orange-400/15",
      button: "bg-orange-600 text-white rounded-2xl shadow-orange-500/20 hover:bg-orange-500",
      input: "bg-black/30 border-orange-900 text-orange-100 focus:border-orange-500 rounded-2xl border-2",
      label: "text-orange-500/60 font-black uppercase tracking-tight",
      muted: "text-orange-900",
      calendar: `.react-calendar { background: transparent !important; border: none !important; width: 100% !important; } .react-calendar__tile--active { background: #f97316 !important; color: white !important; }`
    },
    rose: {
      container: "bg-[#2d0611] text-rose-100",
      card: "bg-black/20 border-rose-500/15 shadow-2xl rounded-[32px] border",
      accent: "text-rose-400 bg-rose-400/15 border-rose-400/15",
      button: "bg-rose-600 text-white rounded-2xl shadow-rose-500/20 hover:bg-rose-500",
      input: "bg-black/30 border-rose-900 text-rose-100 focus:border-rose-500 rounded-2xl border-2",
      label: "text-rose-500/60 font-black uppercase tracking-tight",
      muted: "text-rose-900",
      calendar: `.react-calendar { background: transparent !important; border: none !important; width: 100% !important; } .react-calendar__tile--active { background: #e11d48 !important; color: white !important; }`
    },
    midnight: {
      container: "bg-black text-white",
      card: "bg-zinc-900 border-white/5 shadow-2xl rounded-[32px] border",
      accent: "text-zinc-400 bg-zinc-800 border-white/5",
      button: "bg-white text-black rounded-2xl font-black shadow-lg hover:bg-zinc-200",
      input: "bg-black border-zinc-800 text-white focus:border-white rounded-2xl border-2",
      label: "text-zinc-600 font-black uppercase tracking-widest",
      muted: "text-zinc-800",
      calendar: `.react-calendar { background: transparent !important; border: none !important; width: 100% !important; } .react-calendar__tile { color: white !important; } .react-calendar__tile--active { background: white !important; color: black !important; font-weight: bold; }`
    },
    vibrant: {
      container: "bg-[#160e2e] text-purple-100",
      card: "bg-black/30 border-purple-500/10 shadow-2xl rounded-[32px] border",
      accent: "text-purple-400 bg-purple-400/15 border-purple-400/15",
      button: "bg-purple-600 text-white rounded-2xl shadow-purple-500/20 hover:bg-purple-500",
      input: "bg-black/30 border-purple-900 text-purple-100 focus:border-purple-500 rounded-2xl border-2",
      label: "text-purple-500/60 font-black uppercase tracking-tight",
      muted: "text-purple-900",
      calendar: `.react-calendar { background: transparent !important; border: none !important; width: 100% !important; } .react-calendar__tile--active { background: #8b5cf6 !important; color: white !important; }`
    }
  };

  const currentTheme = (themes as Record<string, any>)[theme] || themes.midnight;

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    
    onAddTask(
      newTaskInput.trim(), 
      taskPriority, 
      taskCategory.trim() || undefined, 
      taskDescription || undefined, 
      taskDueDate ? taskDueDate.getTime() : undefined,
      taskRecurring,
      taskEnergy,
      taskEstTime
    );

    setNewTaskInput('');
    setTaskDescription('');
    setTaskDueDate(null);
    setTaskRecurring('none');
    setTaskEnergy('medium');
    setTaskEstTime(30);
    setTaskPriority('medium');
    setTaskCategory('');
    setShowAdvancedAdd(false);
  };

  // Pre-configured offline business templates
  const offlineTemplates = [
    {
      titleEn: "Draft Local Marketing Strategy",
      titleKa: "ლოკალური მარკეტინგის დაგეგმვა",
      category: "Marketing",
      priority: "medium",
      est: 45
    },
    {
      titleEn: "Reconcile Budget & Cash Flow Sheet",
      titleKa: "ბიუჯეტისა და ხარჯების მონიტორინგი",
      category: "Finance",
      priority: "high",
      est: 60
    },
    {
      titleEn: "Design Social Media Promo Visuals",
      titleKa: "საინფორმაციო ფლაერის დიზაინი",
      category: "Design",
      priority: "low",
      est: 90
    },
    {
      titleEn: "Setup standard workspace checklists",
      titleKa: "სამუშაო ინსტრუქციების გაწერა",
      category: "Operations",
      priority: "medium",
      est: 30
    }
  ];

  const handleAddOfflineTemplate = (tpl: typeof offlineTemplates[0]) => {
    onAddTask(
      language === 'ka' ? tpl.titleKa : tpl.titleEn,
      tpl.priority as 'low' | 'medium' | 'high',
      tpl.category,
      language === 'ka' ? "ინტუიციური, ლოკალური შაბლონით შექმნილი საქმე" : "Quickly spawned local workspace task",
      undefined,
      'none',
      'medium',
      tpl.est
    );
  };

  const handleToggleTimer = (id: string) => {
    // If there is an active timer running, save its accumulated elapsed time to database
    if (activeTimerTaskId) {
      const activeSeconds = localTimerSeconds[activeTimerTaskId];
      if (activeSeconds !== undefined) {
        console.log(`[Stress Test Logs] Toggling timer off or switching. Flushing ${activeSeconds}s to Firestore for task: ${activeTimerTaskId}`);
        onEditTask(activeTimerTaskId, { elapsedTime: activeSeconds });
      }
    }

    if (activeTimerTaskId === id) {
      setActiveTimerTaskId(null);
    } else {
      // Load current time of next task
      const nextTask = tasks.find(tk => tk.id === id);
      const nextSeconds = nextTask ? (nextTask.elapsedTime || 0) : 0;
      setLocalTimerSeconds(prev => ({
        ...prev,
        [id]: nextSeconds
      }));
      setActiveTimerTaskId(id);
    }
  };

  // Convert elapsed seconds into MM:SS or HH:MM:SS
  const formatElapsedTime = (sec?: number) => {
    if (!sec) return '00:00';
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    
    const pad = (n: number) => String(n).padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const startEditMode = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingContent(language === 'ka' ? (task.contentGe || task.content) : task.content);
    setEditingDescription(language === 'ka' ? (task.descriptionGe || task.description || '') : (task.description || ''));
    setEditingPriority(task.priority || 'medium');
    setEditingCategory(task.category || '');
  };

  const saveEditMode = (id: string) => {
    if (!editingContent.trim()) return;
    onEditTask(id, {
      content: editingContent.trim(),
      contentGe: editingContent.trim(),
      description: editingDescription.trim() || undefined,
      descriptionGe: editingDescription.trim() || undefined,
      priority: editingPriority,
      category: editingCategory.trim() || undefined
    });
    setEditingTaskId(null);
  };

  const cancelEditMode = () => {
    setEditingTaskId(null);
  };

  // Master filter application
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchText = (language === 'ka' ? (task.contentGe || task.content) : task.content).toLowerCase();
      const contentMatch = matchText.includes(searchQuery.toLowerCase());
      
      const statusMatch = filterStatus === 'all' 
        ? true 
        : filterStatus === 'completed' ? task.completed : !task.completed;
      
      const energyMatch = energyFilter === 'all'
        ? true
        : task.energyCost === energyFilter;

      const categoryMatch = categoryFilter === null
        ? true
        : task.category?.toLowerCase() === categoryFilter.toLowerCase();
      
      return contentMatch && statusMatch && energyMatch && categoryMatch;
    });
  }, [tasks, searchQuery, filterStatus, language, energyFilter, categoryFilter]);

  // Grouped layout logic (Today/Tomorrow, Upcoming Week, Overdue/Urgent, Someday/No Deadline)
  const groupedTasks = useMemo(() => {
    const overdueAndUrgent: Task[] = [];
    const todayAndTomorrow: Task[] = [];
    const upcomingWeek: Task[] = [];
    const somedayNoDate: Task[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowEnd = todayStart + (2 * 24 * 60 * 60 * 1000) - 1;
    const weekEnd = todayStart + (8 * 24 * 60 * 60 * 1000) - 1;

    filteredTasks.forEach(task => {
      if (task.completed) return; // Render completed separately at bottom or ignore in groups
      
      if (task.priority === 'high' || (task.dueDate && task.dueDate < todayStart)) {
        overdueAndUrgent.push(task);
      } else if (task.dueDate && task.dueDate >= todayStart && task.dueDate <= tomorrowEnd) {
        todayAndTomorrow.push(task);
      } else if (task.dueDate && task.dueDate > tomorrowEnd && task.dueDate <= weekEnd) {
        upcomingWeek.push(task);
      } else {
        somedayNoDate.push(task);
      }
    });

    return {
      overdueAndUrgent,
      todayAndTomorrow,
      upcomingWeek,
      somedayNoDate
    };
  }, [filteredTasks]);

  // Extract all unique categories present in tasks to show quick tag filters
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    tasks.forEach(t => {
      if (t.category?.trim()) cats.add(t.category.trim());
    });
    return Array.from(cats);
  }, [tasks]);

  return (
    <div className={cn("space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 transition-colors duration-500", currentTheme.container)}>
      
      {/* Header controls */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6 pb-2">
        <div className="text-center xl:text-left">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase">
            {language === 'ka' ? 'საქმეების ორგანიზატორი' : 'Workspace Organizer'}
          </h2>
          <p className={cn("mt-1 font-medium text-xs md:text-sm uppercase tracking-wider", currentTheme.muted)}>
            {language === 'ka' ? 'დაგეგმეთ, აკონტროლეთ დრო და განახორციელეთ იდეები ოფლაინ' : 'Organize, track elapsed time and run offline templates'}
          </p>
        </div>

        {/* Visual theme customizer for organizer workspace */}
        <div className="flex flex-wrap items-center gap-4 justify-center md:justify-end">
          {/* Compact Vibe / Accent Roller */}
          <div className="flex items-center gap-1.5 bg-black/30 p-2 px-3.5 rounded-2xl border border-white/5 shadow-inner shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-60 mr-1 select-none">
              {language === 'ka' ? 'აქცენტი:' : 'Theme:'}
            </span>
            {[
              { id: 'light', bg: 'bg-white border-slate-300', title: 'Light' },
              { id: 'titanium', bg: 'bg-slate-400 border-slate-500', title: 'Titanium' },
              { id: 'proton', bg: 'bg-cyan-400 border-cyan-500', title: 'Cyber' },
              { id: 'forest', bg: 'bg-emerald-500 border-emerald-600', title: 'Forest' },
              { id: 'sunset', bg: 'bg-orange-500 border-orange-600', title: 'Sunset' },
              { id: 'rose', bg: 'bg-rose-500 border-rose-600', title: 'Rose' },
              { id: 'vibrant', bg: 'bg-indigo-500 border-purple-600', title: 'Nebula' },
              { id: 'midnight', bg: 'bg-zinc-800 border-zinc-900', title: 'Dark' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id as Theme)}
                title={item.title}
                className={cn(
                  "w-4 h-4 rounded-full transition-all hover:scale-125 border shadow-sm active:scale-90 relative",
                  item.bg,
                  theme === item.id ? "ring-2 ring-proton-accent scale-110 z-10" : "opacity-60 hover:opacity-100"
                )}
              />
            ))}
          </div>

          <div className="relative group shrink-0">
            <Search size={14} className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", currentTheme.muted, "group-focus-within:text-proton-accent")} />
            <input 
              type="text"
              placeholder={language === 'ka' ? 'ძიება...' : 'Search tasks...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={cn("pl-11 pr-4 py-3 text-xs font-black uppercase tracking-widest rounded-2xl border-2 focus:outline-none transition-all w-48 bg-black/20", currentTheme.input)}
            />
          </div>
        </div>
      </div>

      {/* Primary stats widget row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={cn("p-6 rounded-[32px] transition-all duration-500 flex items-center justify-between", currentTheme.card)}>
          <div>
            <p className={cn("text-[9px] font-black uppercase tracking-widest mb-1", currentTheme.muted)}>
              {language === 'ka' ? 'შესრულებული საქმეები' : 'Completed Tasks'}
            </p>
            <h4 className="text-3xl font-black">
              {tasks.filter(t => t.completed).length}
              <span className="text-xs opacity-40 ml-2">/ {tasks.length}</span>
            </h4>
          </div>
          <div className={cn("p-3.5 rounded-2xl shrink-0", currentTheme.accent)}>
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className={cn("p-6 rounded-[32px] transition-all duration-500 flex items-center justify-between", currentTheme.card)}>
          <div>
            <p className={cn("text-[9px] font-black uppercase tracking-widest mb-1", currentTheme.muted)}>
              {language === 'ka' ? 'აქტიური ტაიმერი' : 'Active Stopwatch'}
            </p>
            <h4 className={cn("text-xl font-black font-mono", activeTimerTaskId ? "text-amber-500 animate-pulse" : "opacity-40")}>
              {activeTimerTaskId ? formatElapsedTime(localTimerSeconds[activeTimerTaskId] ?? tasks.find(tk => tk.id === activeTimerTaskId)?.elapsedTime) : (language === 'ka' ? 'გამორთულია' : 'Idle')}
            </h4>
          </div>
          <div className={cn("p-3.5 rounded-2xl shrink-0", activeTimerTaskId ? "bg-amber-500/10 text-amber-400" : currentTheme.accent)}>
            <Clock size={24} className={cn(activeTimerTaskId && "animate-spin")} />
          </div>
        </div>

        <div className={cn("p-6 rounded-[32px] transition-all duration-500 flex flex-col justify-center", currentTheme.card, "lg:col-span-2")}>
          <div className="flex items-center justify-between">
            <div className="mr-4">
              <p className={cn("text-[9px] font-black uppercase tracking-widest mb-1", currentTheme.muted)}>
                {language === 'ka' ? 'პროგრესის ინდიკატორი' : 'Efficiency Buffer'}
              </p>
              <h4 className="text-base font-black uppercase tracking-tight">
                {language === 'ka' ? 'სამუშაოს შესრულების ტემპი' : 'Completed Tasks Percent'}
              </h4>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-black">
                {tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0}%
              </span>
              <div className="h-2 w-32 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-proton-accent transition-all duration-1000" 
                  style={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.completed).length / tasks.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main split dashboard structure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Form + Tasks */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Flat List vs Grouped view toggles */}
          <div className="flex bg-proton-secondary/10 p-1 rounded-2xl border border-proton-border/30 gap-1 select-none overflow-hidden h-fit">
            <button
              onClick={() => setViewLayout('grouped')}
              className={cn(
                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2",
                viewLayout === 'grouped' ? "bg-proton-text text-proton-bg font-black" : "text-proton-muted hover:text-proton-text"
              )}
            >
              <Layers size={14} />
              {language === 'ka' ? 'სპეციალური განლაგება (Deadlines)' : 'Grouped (Deadlines)'}
            </button>
            <button
              onClick={() => setViewLayout('list')}
              className={cn(
                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2",
                viewLayout === 'list' ? "bg-proton-text text-proton-bg font-black" : "text-proton-muted hover:text-proton-text"
              )}
            >
              <Grid size={14} />
              {language === 'ka' ? 'სრული სია' : 'Flat List View'}
            </button>
          </div>

          {/* Quick Task Creation Card */}
          <div className={cn("p-8 rounded-[40px] shadow-sm transition-all duration-500", currentTheme.card)}>
            <h3 className="font-black text-lg flex items-center gap-3 uppercase tracking-tighter mb-6">
              <PlusCircle size={20} className="text-proton-accent" />
              {language === 'ka' ? 'ახალი დავალების დამატება' : 'Register New Task / Objective'}
            </h3>

            <form onSubmit={handleAddTaskSubmit} className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative group">
                  <input 
                    type="text"
                    required
                    placeholder={language === 'ka' ? 'განსაზღვრეთ დავალების სათაური...' : 'Specify task title / goal...'}
                    value={newTaskInput}
                    onChange={e => setNewTaskInput(e.target.value)}
                    className={cn("w-full rounded-2xl px-6 py-4 text-xs font-bold focus:outline-none transition-all", currentTheme.input)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowAdvancedAdd(!showAdvancedAdd)}
                    className={cn("absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all", showAdvancedAdd ? "bg-proton-accent text-proton-bg" : currentTheme.muted)}
                  >
                     <ChevronDown size={14} className={cn("transition-transform duration-300", showAdvancedAdd && "rotate-180")} />
                  </button>
                </div>
                <button type="submit" className={cn("px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl", currentTheme.button)}>
                  {language === 'ka' ? 'დამატება' : 'Add Task'}
                </button>
              </div>

              {/* Advanced creation drawer */}
              <AnimatePresence>
                {showAdvancedAdd && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-6 overflow-hidden pt-2"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-proton-border/20 pt-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className={cn("text-[9px] uppercase tracking-[0.1em] block ml-1", currentTheme.label)}>
                            {language === 'ka' ? 'დეტალური აღწერა' : 'Task Details / Description'}
                          </label>
                          <textarea 
                            placeholder={language === 'ka' ? 'ჩაწერეთ დამატებითი დეტალები...' : 'Enter secondary notes or reminders...'}
                            value={taskDescription}
                            onChange={e => setTaskDescription(e.target.value)}
                            className={cn("w-full rounded-2xl px-5 py-3.5 text-xs font-medium focus:outline-none transition-all min-h-[90px] resize-none", currentTheme.input)}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className={cn("text-[9px] uppercase tracking-[0.1em] block ml-1", currentTheme.label)}>
                            {language === 'ka' ? 'კატეგორია / ტეგი' : 'Category Tag / Project'}
                          </label>
                          <div className="relative">
                            <Tag size={12} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-proton-text" />
                            <input 
                              type="text"
                              placeholder={language === 'ka' ? 'მაგ: მარკეტინგი, პირადი, ფინანსები...' : 'e.g. Marketing, Personal, Kakheti...'}
                              value={taskCategory}
                              onChange={e => setTaskCategory(e.target.value)}
                              className={cn("w-full pl-10 pr-4 py-3 text-xs font-bold focus:outline-none transition-all", currentTheme.input)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className={cn("text-[9px] uppercase tracking-[0.1em] block ml-1", currentTheme.label)}>{t.due_date}</label>
                            <input 
                              type="date"
                              onChange={e => setTaskDueDate(e.target.value ? new Date(e.target.value) : null)}
                              className={cn("w-full rounded-2xl px-4 py-3 text-xs font-bold focus:outline-none transition-all", currentTheme.input)}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className={cn("text-[9px] uppercase tracking-[0.1em] block ml-1", currentTheme.label)}>{t.estimated_time}</label>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number"
                                value={taskEstTime}
                                onChange={e => setTaskEstTime(parseInt(e.target.value) || 0)}
                                className={cn("w-full rounded-2xl px-4 py-3 text-xs font-bold focus:outline-none transition-all", currentTheme.input)}
                              />
                              <span className="text-[10px] font-black opacity-40">MIN</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className={cn("text-[9px] uppercase tracking-[0.1em] block ml-1", currentTheme.label)}>{t.priority}</label>
                          <div className="flex gap-2">
                            {(['low', 'medium', 'high'] as const).map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setTaskPriority(p)}
                                className={cn(
                                  "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                  taskPriority === p 
                                    ? (p === 'high' ? "bg-red-500 border-red-500 text-white" : p === 'medium' ? "bg-amber-500 border-amber-500 text-white" : "bg-blue-500 border-blue-500 text-white")
                                    : "border-proton-border/40 text-proton-text opacity-50 hover:bg-white/5"
                                )}
                              >
                                {t[p]}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className={cn("text-[9px] uppercase tracking-[0.1em] block ml-1", currentTheme.label)}>{t.recurring}</label>
                          <div className="flex gap-2">
                            {(['none', 'daily', 'weekly', 'monthly'] as const).map(r => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setTaskRecurring(r)}
                                className={cn(
                                  "flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                                  taskRecurring === r 
                                    ? "bg-proton-text text-proton-bg"
                                    : "border-proton-border/40 text-proton-text opacity-50 hover:bg-white/5"
                                )}
                              >
                                {r === 'none' ? (language === 'ka' ? 'ერთხელ' : 'Once') : 
                                 r === 'daily' ? (language === 'ka' ? 'დღიური' : 'Daily') : 
                                 r === 'weekly' ? (language === 'ka' ? 'კვირაში' : 'Weekly') : (language === 'ka' ? 'თვეში' : 'Monthly')}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>

          {/* Tag filters panel */}
          {uniqueCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-4 bg-proton-secondary/5 border border-proton-border/10 rounded-3xl">
              <span className={cn("text-[9px] font-black uppercase tracking-widest mr-2", currentTheme.muted)}>
                {language === 'ka' ? 'ფილტრი ტეგით:' : 'Filter by Tag:'}
              </span>
              <button
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                  categoryFilter === null ? "bg-proton-accent text-proton-bg" : "bg-white/5 hover:bg-white/10 opacity-70"
                )}
              >
                {language === 'ka' ? 'ყველა' : 'All Tags'}
              </button>
              {uniqueCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wide transition-all flex items-center gap-1",
                    categoryFilter?.toLowerCase() === cat.toLowerCase()
                      ? "bg-proton-accent text-proton-bg font-black"
                      : "bg-white/5 hover:bg-white/10 opacity-70"
                  )}
                >
                  <Tag size={8} />
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Quick status selection row */}
          <div className="flex bg-proton-secondary/10 p-1 rounded-2xl border border-proton-border/20 gap-1.5">
            {(['all', 'pending', 'completed'] as const).map(status => (
              <button
                key={status}
                onClick={() => {
                  setFilterStatus(status);
                  setCategoryFilter(null); // Reset tag filter on global tab swap
                }}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filterStatus === status 
                    ? "bg-proton-text text-proton-bg"
                    : "text-proton-muted hover:text-proton-text hover:bg-white/5"
                )}
              >
                {status === 'all' ? (language === 'ka' ? 'სრული ბუფერი' : 'All Tasks') : 
                 status === 'pending' ? (language === 'ka' ? 'შესასრულებელი' : 'To Do Pending') :
                 (language === 'ka' ? 'შესრულებული' : 'Done & Logged')}
              </button>
            ))}
          </div>

          {/* Task Render Section */}
          <div className="space-y-4">
             {viewLayout === 'list' ? (
                // Flat simple list layout
                filteredTasks.length === 0 ? (
                  <div className={cn("p-16 rounded-[40px] text-center space-y-3", currentTheme.card)}>
                     <p className="font-bold text-xs uppercase tracking-widest opacity-60">
                       {language === 'ka' ? 'დავალებები არ მოიძებნა' : 'No tasks match your chosen filters'}
                     </p>
                     <p className="text-[10px] uppercase opacity-40 font-semibold tracking-wider">
                       {language === 'ka' ? 'დაამატეთ ახალი საქმე ან შეცვალეთ ძებნის პარამეტრები' : 'Create a task or clear filters to start'}
                     </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTasks.map(task => renderTaskCard(task))}
                  </div>
                )
             ) : (
                // Complex Grouped view by deadlines
                <div className="space-y-8">
                  {/* Category 1: Overdue & Urgent */}
                  {(groupedTasks.overdueAndUrgent.length > 0) && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-red-500 font-black text-xs uppercase tracking-widest block ml-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        {language === 'ka' ? 'სასწრაფო და ვადაგადაცილებული' : 'Urgent or Overdue'}
                        <span className="text-[10px] font-bold opacity-60 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                          {groupedTasks.overdueAndUrgent.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {groupedTasks.overdueAndUrgent.map(task => renderTaskCard(task))}
                      </div>
                    </div>
                  )}

                  {/* Category 2: Today & Tomorrow */}
                  {(groupedTasks.todayAndTomorrow.length > 0 || Object.values(groupedTasks).every(arr => arr.length === 0)) && (
                    <div className="space-y-4">
                      <div className="text-amber-500 font-black text-xs uppercase tracking-widest block ml-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        {language === 'ka' ? 'დღეს და ხვალ' : 'Due Today & Tomorrow'}
                        <span className="text-[10px] font-bold opacity-60 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                          {groupedTasks.todayAndTomorrow.length}
                        </span>
                      </div>
                      {groupedTasks.todayAndTomorrow.length === 0 ? (
                        <div className="p-6 text-center text-[10px] uppercase tracking-wider opacity-30 border border-dashed border-proton-border/35 rounded-3xl">
                           {language === 'ka' ? 'დღეს და ხვალ დაგეგმილი საქმეები არ გაქვთ.' : 'No items scheduled for today or tomorrow.'}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {groupedTasks.todayAndTomorrow.map(task => renderTaskCard(task))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Category 3: Next 7 Days */}
                  {groupedTasks.upcomingWeek.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-cyan-400 font-black text-xs uppercase tracking-widest block ml-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        {language === 'ka' ? 'მომდევნო კვირაში' : 'Upcoming Next 7 Days'}
                        <span className="text-[10px] font-bold opacity-60 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                          {groupedTasks.upcomingWeek.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {groupedTasks.upcomingWeek.map(task => renderTaskCard(task))}
                      </div>
                    </div>
                  )}

                  {/* Category 4: Someday / No Deadline */}
                  {groupedTasks.somedayNoDate.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-proton-muted font-black text-xs uppercase tracking-widest block ml-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-proton-border" />
                        {language === 'ka' ? 'სამომავლოდ / უვადო' : 'Someday / No Date'}
                        <span className="text-[10px] font-bold opacity-60 px-2 py-0.5 rounded-full bg-proton-secondary/20 border border-proton-border/20">
                          {groupedTasks.somedayNoDate.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {groupedTasks.somedayNoDate.map(task => renderTaskCard(task))}
                      </div>
                    </div>
                  )}

                  {/* Render completed tasks at the bottom if filtering for more than pending */}
                  {filterStatus === 'all' && tasks.filter(t => t.completed).length > 0 && (
                    <div className="space-y-3 border-t border-proton-border/10 pt-6">
                      <div className="text-emerald-500 font-black text-xs uppercase tracking-widest block ml-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {language === 'ka' ? 'შესრულებული დავალებები' : 'Completed Log'}
                        <span className="text-[10px] font-bold opacity-60 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          {tasks.filter(t => t.completed).length}
                        </span>
                      </div>
                      <div className="space-y-3 opacity-60">
                        {tasks.filter(t => t.completed).map(task => renderTaskCard(task))}
                      </div>
                    </div>
                  )}
                </div>
             )}
          </div>
        </div>

        {/* Right Column: Calendar + Templates Pool */}
        <div className="space-y-8">
          
          {/* Simple Clean Non-Cosmic Calendar */}
          <div className={cn("p-3 sm:p-6 md:p-8 rounded-[40px] shadow-sm transition-all duration-500", currentTheme.card)}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-lg flex items-center gap-3 uppercase tracking-tighter">
                <CalendarIcon size={20} className={currentTheme.muted} />
                {language === 'ka' ? 'კალენდარი' : 'Workspace Calendar'}
              </h3>
            </div>
            <div className="w-full overflow-hidden">
              <style>{`
                ${currentTheme.calendar}
                .react-calendar { width: 100% !important; max-width: 100% !important; }
                .react-calendar__viewContainer { width: 100% !important; }
                .react-calendar__month-view { width: 100% !important; }
                .react-calendar__month-view__days { display: grid !important; grid-template-columns: repeat(7, 1fr) !important; width: 100% !important; }
                .react-calendar__tile { 
                  aspect-ratio: 1; 
                  display: flex !important; 
                  align-items: center; 
                  justify-content: center; 
                  padding: 4px !important; 
                  font-size: 0.75rem !important; 
                  min-width: 0 !important; 
                  overflow: hidden !important; 
                }
                @media (min-width: 640px) {
                  .react-calendar__tile { 
                    font-size: 0.875rem !important; 
                    padding: 0.8em 0.1em !important; 
                  }
                }
              `}</style>
              <Calendar className="mx-auto" />
            </div>
          </div>

          {/* Quick Offline Templates Pool (Quota Bypass) */}
          <div className={cn("p-8 rounded-[40px] shadow-sm transition-all duration-500 border border-transparent", currentTheme.card)}>
            <div className="mb-6">
              <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <Zap size={16} className="text-amber-500 animate-pulse" />
                {language === 'ka' ? 'სწრაფი საქმეების შაბლონები' : 'Bypass Quotas: Local Task Ideas'}
              </h3>
              <p className={cn("text-[9px] font-black uppercase tracking-wider mt-1.5 leading-relaxed", currentTheme.muted)}>
                {language === 'ka' 
                  ? 'დაამატეთ საქმეები ადგილობრივი შაბლონებით - სერვერის API-ს გარეშე' 
                  : 'Add pre-defined localized tasks without exhausting any Gemini AI quota limits'}
              </p>
            </div>

            <div className="space-y-3">
              {offlineTemplates.map((tpl, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-4 bg-proton-secondary/5 rounded-2xl border border-proton-border/20 group hover:border-proton-accent/40 hover:bg-proton-accent/5 transition-all"
                >
                  <div className="space-y-1 pr-4 min-w-0">
                    <p className="text-[11px] font-bold text-proton-text truncate">
                      {language === 'ka' ? tpl.titleKa : tpl.titleEn}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black uppercase bg-proton-secondary/20 px-1.5 py-0.5 rounded-md text-proton-muted">
                        {tpl.category}
                      </span>
                      <span className="text-[8px] font-bold text-proton-muted">
                        ⏰ {tpl.est}m
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddOfflineTemplate(tpl)}
                    className="p-2 bg-proton-text text-proton-bg hover:scale-110 active:scale-95 transition-all text-[8px] font-black rounded-lg shrink-0"
                    title={language === 'ka' ? 'საქმის დამატება' : 'Insert Task'}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Modular helper to render a single task card
  function renderTaskCard(task: Task) {
    const isEditing = editingTaskId === task.id;

    if (isEditing) {
      return (
        <div 
          key={task.id} 
          className={cn("p-6 rounded-[24px] border transition-all flex flex-col gap-4 relative", currentTheme.card)}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className={cn("text-[8px] font-black uppercase tracking-widest", currentTheme.label)}>
                {language === 'ka' ? 'სათაური' : 'Task Goal Text'}
              </label>
              <input 
                type="text"
                value={editingContent}
                onChange={e => setEditingContent(e.target.value)}
                className={cn("w-full px-4 py-2 text-xs font-semibold rounded-lg focus:outline-none focus:border-proton-accent transition-all", currentTheme.input)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={cn("text-[8px] font-black uppercase tracking-widest", currentTheme.label)}>
                {language === 'ka' ? 'აღწერა' : 'Notes/Description'}
              </label>
              <textarea 
                value={editingDescription}
                onChange={e => setEditingDescription(e.target.value)}
                className={cn("w-full px-4 py-2 text-xs font-medium rounded-lg h-16 resize-none focus:outline-none focus:border-proton-accent transition-all", currentTheme.input)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className={cn("text-[8px] font-black uppercase tracking-widest", currentTheme.label)}>
                  {language === 'ka' ? 'პრიორიტეტი' : 'Priority'}
                </label>
                <select
                  value={editingPriority}
                  onChange={e => setEditingPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className={cn("w-full px-3 py-2 text-xs font-semibold rounded-lg focus:outline-none focus:border-proton-accent bg-black border-2 border-proton-border/30", currentTheme.input)}
                >
                  <option value="low">{t.low}</option>
                  <option value="medium">{t.medium}</option>
                  <option value="high">{t.high}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className={cn("text-[8px] font-black uppercase tracking-widest", currentTheme.label)}>
                  {language === 'ka' ? 'კატეგორია / ტეგი' : 'Tag'}
                </label>
                <input 
                  type="text"
                  value={editingCategory}
                  placeholder="e.g. Marketing"
                  onChange={e => setEditingCategory(e.target.value)}
                  className={cn("w-full px-4 py-2 text-xs font-semibold rounded-lg focus:outline-none focus:border-proton-accent transition-all", currentTheme.input)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-proton-border/20 pt-4 mt-2">
            <button
              onClick={cancelEditMode}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-proton-border/40 text-proton-text opacity-70 hover:opacity-100 flex items-center gap-1.5"
            >
              <X size={12} />
              {language === 'ka' ? 'გაუქმება' : 'Cancel'}
            </button>
            <button
              onClick={() => saveEditMode(task.id)}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-proton-accent text-proton-bg hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Save size={12} />
              {language === 'ka' ? 'შენახვა' : 'Save'}
            </button>
          </div>
        </div>
      );
    }

    const hasTimerTicking = activeTimerTaskId === task.id;
    const isOverdue = task.dueDate ? (!task.completed && Date.now() > task.dueDate) : false;

    return (
      <motion.div 
        layout
        key={task.id} 
        className={cn(
          "p-6 rounded-[24px] border transition-all group flex flex-col gap-4 relative overflow-hidden", 
          currentTheme.card, 
          task.completed && "opacity-40 select-none border-proton-border/20",
          isOverdue && "border-red-500/40 bg-red-500/[0.02] shadow-[0_0_15px_rgba(239,68,68,0.05)]"
        )}
      >
        {/* Overdue left accent bar */}
        {isOverdue && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 shadow-[2px_0_10px_rgba(239,68,68,0.4)] z-20 animate-pulse" />
        )}

        {/* Priority background accent layer */}
        <div className={cn("absolute -right-4 -top-4 w-20 h-20 blur-3xl opacity-10 pointer-events-none", 
          task.priority === 'high' ? "bg-red-500" : task.priority === 'medium' ? "bg-amber-500" : "bg-blue-500"
        )} />
        
        <div className="flex items-start gap-4 relative z-10">
          {/* Checkbox button */}
          <button 
            type="button"
            onClick={() => {
              if (hasTimerTicking) {
                setActiveTimerTaskId(null);
              }
              onToggleTask(task.id);
            }}
            className={cn(
              "w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 mt-1.5 shadow-sm active:scale-90",
              task.completed 
                ? "bg-emerald-500 border-emerald-500 text-white" 
                : "border-proton-border/30 hover:border-proton-accent"
            )}
          >
            {task.completed && <Check size={16} strokeWidth={4} />}
          </button>
            
          {/* Content field */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-xs md:text-sm font-black tracking-tight leading-relaxed", task.completed && "line-through grayscale opacity-50")}>
                {language === 'ka' ? (task.contentGe || task.content) : task.content}
              </span>
              {task.recurring && task.recurring !== 'none' && (
                <Repeat size={10} className={cn("opacity-40 animate-spin", hasTimerTicking && "text-amber-500")} />
              )}
            </div>
            
            {(task.description || task.descriptionGe) && (
              <p className={cn("text-xs font-semibold mt-1Brightness-90 leading-normal", currentTheme.muted)}>
                 {language === 'ka' ? (task.descriptionGe || task.description) : task.description}
              </p>
            )}
            
            {/* Tag indicators and dynamic elapsed time row */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {isOverdue && (
                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border border-red-500/20 bg-red-500/10 text-red-500 flex items-center gap-1 animate-pulse">
                  <AlertTriangle size={8} />
                  {language === 'ka' ? 'ვადაგადაცილებული' : 'OVERDUE'}
                </span>
              )}
              {task.priority && (
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                  task.priority === 'high' ? "text-red-500 border-red-500/20 bg-red-500/5 font-black" : task.priority === 'medium' ? "text-amber-500 border-amber-500/20 bg-amber-500/5 font-bold" : "text-blue-400 border-blue-400/20 bg-blue-400/5 font-semibold"
                )}>
                  {t[task.priority]}
                </span>
              )}
              {task.category && (
                <span 
                  onClick={() => setCategoryFilter(task.category || null)}
                  className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border border-proton-accent/20 bg-proton-accent/5 text-proton-accent flex items-center gap-1 cursor-pointer hover:bg-proton-accent hover:text-proton-bg transition-all"
                >
                  <Tag size={8} />
                  {task.category}
                </span>
              )}
              {task.estimatedTime && (
                <span className="text-[8px] font-black uppercase tracking-widest flex items-center gap-1 opacity-40">
                  <Clock size={8} />
                  {task.estimatedTime}m (Est)
                </span>
              )}
              {task.dueDate && (
                <span className={cn("text-[8px] font-black uppercase tracking-widest flex items-center gap-1", Date.now() > task.dueDate && !task.completed ? "text-red-400" : currentTheme.muted)}>
                  <CalendarIcon size={8} />
                  {new Date(task.dueDate).toLocaleDateString(language === 'ka' ? 'ka-GE' : 'en-US', { day: 'numeric', month: 'short' })}
                </span>
              )}

              {/* Ticking Elapsed stopwatch badge */}
              {(!task.completed) && (
                <div className={cn(
                  "text-[8px] font-black uppercase tracking-normal px-2.5 py-0.5 rounded-md flex items-center gap-1.5 transition-all",
                  hasTimerTicking 
                    ? "bg-amber-500 text-proton-bg font-black animate-pulse shadow-md" 
                    : (task.elapsedTime ? "bg-proton-secondary/20 text-proton-muted border border-proton-border/10" : "hidden")
                )}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                  ⏱️ {formatElapsedTime(activeTimerTaskId === task.id ? (localTimerSeconds[task.id] ?? task.elapsedTime) : task.elapsedTime)}
                </div>
              )}
            </div>
          </div>

          {/* Stopwatch control button and utility operations button */}
          <div className="flex items-center gap-2 pr-1 select-none">
            {(!task.completed) && (
              <button 
                type="button"
                onClick={() => handleToggleTimer(task.id)}
                className={cn(
                  "p-2 rounded-xl border transition-all active:scale-95.2 flex items-center justify-center shrink-0",
                  hasTimerTicking 
                    ? "bg-amber-500 border-amber-500 text-proton-bg" 
                    : "border-proton-border/40 text-proton-text opacity-50 hover:opacity-100 hover:border-amber-500/50 hover:bg-amber-500/5"
                )}
                title={hasTimerTicking ? (language === 'ka' ? 'დააპაუზე დრო' : 'Pause stopwatch') : (language === 'ka' ? 'ჩართე დრო' : 'Start stopwatch')}
              >
                {hasTimerTicking ? <Pause size={12} strokeWidth={3} /> : <Play size={12} strokeWidth={3} />}
              </button>
            )}

            <button 
              type="button"
              onClick={() => startEditMode(task)} 
              className={cn("p-2 rounded-xl transition-all hover:scale-110 opacity-0 group-hover:opacity-100 text-proton-text hover:text-proton-accent")}
              title={language === 'ka' ? 'რედაქტირება' : 'Edit Task'}
            >
              <Edit2 size={12} />
            </button>
            <button 
              type="button"
              onClick={() => onDeleteTask(task.id)} 
              className={cn("p-2 rounded-xl transition-all hover:scale-110 opacity-0 group-hover:opacity-100 text-proton-text hover:text-red-500")}
              title={language === 'ka' ? 'წაშლა' : 'Delete Task'}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Subtask handling logic */}
        <div className="ml-11 border-l-2 border-proton-border/20 pl-4 space-y-2 relative z-10 select-none">
           {task.subtasks?.map(sub => (
             <div key={sub.id} className="flex items-center gap-3 group/sub">
               <button 
                 type="button"
                 onClick={() => {
                   const newSubtasks = task.subtasks?.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s);
                   onEditTask(task.id, { subtasks: newSubtasks });
                 }}
                 className={cn("w-4.5 h-4.5 rounded border flex items-center justify-center transition-all", sub.completed ? "bg-proton-accent border-proton-accent text-proton-bg" : "border-proton-border/30 hover:border-proton-accent")}
               >
                 {sub.completed && <Check size={10} strokeWidth={4} />}
               </button>
               <span className={cn("text-[10px] font-semibold transition-all", sub.completed ? "opacity-30 line-through" : "opacity-80")}>
                 {sub.content}
               </span>
               <button 
                 type="button"
                 onClick={() => {
                   const newSubtasks = task.subtasks?.filter(s => s.id !== sub.id);
                   onEditTask(task.id, { subtasks: newSubtasks });
                 }}
                 className="opacity-0 group-hover/sub:opacity-100 p-1 text-white/20 hover:text-red-500 transition-all ml-auto"
               >
                 <X size={10} />
               </button>
             </div>
           ))}
           
           {/* Add subtask input row */}
           <div className="flex items-center gap-2 pt-1 max-w-xs">
             <input 
               type="text"
               placeholder={language === 'ka' ? 'მონიშნეთ ნაბიჯი...' : 'Add step...'}
               className="bg-transparent border-b border-proton-border/20 text-[10px] py-1 px-1 flex-1 focus:outline-none focus:border-proton-accent/50 transition-all text-proton-text"
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                   const content = (e.target as HTMLInputElement).value.trim();
                   const newSubtasks = [...(task.subtasks || []), { id: `sub-${Date.now()}`, content, completed: false }];
                   onEditTask(task.id, { subtasks: newSubtasks });
                   (e.target as HTMLInputElement).value = '';
                 }
               }}
             />
           </div>

           {/* Nested progress display */}
           {task.subtasks && task.subtasks.length > 0 && (
             <div className="space-y-1 pt-2 mr-4">
                <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                   <span className={currentTheme.muted}>
                     {language === 'ka' ? 'საქმის პროგრესი' : 'Workflow Steps Progress'}
                   </span>
                   <span className="text-proton-accent font-black">
                     {Math.round((task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100)}%
                   </span>
                </div>
                <div className="h-1 w-full bg-proton-secondary/20 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-proton-accent transition-all duration-500"
                     style={{ width: `${(task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100}%` }}
                   />
                </div>
             </div>
           )}
        </div>
      </motion.div>
    );
  }
};
