import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { safeStorage } from '../lib/safeStorage';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  Sparkles, 
  Plus, 
  Check, 
  ArrowRight,
  Package,
  Image as ImageIcon,
  MessageSquare,
  CornerDownLeft,
  Clock,
  Layout,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  Store,
  Palette,
  CheckSquare,
  Play,
  Pause,
  RotateCcw,
  Copy,
  Send,
  Trash2,
  FileText,
  Tag,
  ExternalLink,
  Flame,
  Search,
  SlidersHorizontal,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { View, Task, Listing, Order } from '../types';
import { SystemHealthState } from '../hooks/useSystemHealth';
import { useSeller } from '../contexts/SellerContext';
import { useAuth } from '../contexts/AuthContext';
import { PERSONAS, chatWithPersona } from '../lib/gemini';

export interface DashboardViewProps {
  setActiveView: (v: View) => void;
  language: 'en' | 'ka';
  setUiMode: (m: 'business' | 'creative' | 'market', targetView?: View) => void;
  systemHealth?: SystemHealthState;
}

interface RecentActivityItem {
  id: string;
  title: string;
  category?: string;
  timestamp: number;
  type: 'task' | 'order' | 'listing' | 'image' | 'ai';
}

const isErrorMessage = (text: string): boolean => {
  if (!text) return true;
  const lower = text.toLowerCase();
  return (
    text.startsWith('⚠️') ||
    lower.includes('gemini api') ||
    lower.includes('api_key') ||
    lower.includes('api key') ||
    lower.includes('error') ||
    lower.includes('quota') ||
    lower.includes('პრობლემა შეიქმნა') ||
    lower.includes('შეცდომა') ||
    lower.includes('status: 400') ||
    lower.includes('status: 403') ||
    lower.includes('status: 500')
  );
};

export const DashboardView = React.memo(({ 
  setActiveView, 
  language = 'en',
  setUiMode
}: DashboardViewProps) => {
  const { user } = useAuth();
  const { allListings, sellerOrders } = useSeller();

  // ---------------------------------------------------------------------------
  // 1. AUTHENTICATED USER IDENTITY & LIVE CLOCK
  // ---------------------------------------------------------------------------
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userName = useMemo(() => {
    if (user?.displayName && user.displayName.trim()) {
      return user.displayName;
    }
    try {
      const profileRaw = localStorage.getItem('user-profile');
      if (profileRaw) {
        const parsed = JSON.parse(profileRaw);
        if (parsed?.displayName && parsed.displayName.trim()) {
          return parsed.displayName.trim();
        }
      }
    } catch {
      // ignore
    }
    if (user?.email) {
      const prefix = user.email.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return language === 'ka' ? 'მომხმარებელი' : 'Friend';
  }, [user, language]);

  const greetingHeadline = useMemo(() => {
    const hour = currentTime.getHours();
    if (language === 'ka') {
      if (hour < 12) return `დილა მშვიდობისა`;
      if (hour < 18) return `გამარჯობა`;
      return `საღამო მშვიდობისა`;
    } else {
      if (hour < 12) return `Good morning`;
      if (hour < 18) return `Good afternoon`;
      return `Good evening`;
    }
  }, [currentTime, language]);

  const formattedDate = useMemo(() => {
    try {
      return currentTime.toLocaleDateString(language === 'ka' ? 'ka-GE' : 'en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return '';
    }
  }, [currentTime, language]);

  const formattedClock = useMemo(() => {
    try {
      return currentTime.toLocaleTimeString(language === 'ka' ? 'ka-GE' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return '';
    }
  }, [currentTime, language]);

  // ---------------------------------------------------------------------------
  // 2. LIVE FOCUS TIMER (POMODORO / WORK SESSION)
  // ---------------------------------------------------------------------------
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [isFocusRunning, setIsFocusRunning] = useState(false);
  const [focusMode, setFocusMode] = useState<'work' | 'break'>('work');

  useEffect(() => {
    let interval: any = null;
    if (isFocusRunning && focusSeconds > 0) {
      interval = setInterval(() => setFocusSeconds(prev => prev - 1), 1000);
    } else if (focusSeconds === 0 && isFocusRunning) {
      setIsFocusRunning(false);
      // Auto-switch mode
      if (focusMode === 'work') {
        setFocusMode('break');
        setFocusSeconds(5 * 60);
      } else {
        setFocusMode('work');
        setFocusSeconds(25 * 60);
      }
    }
    return () => clearInterval(interval);
  }, [isFocusRunning, focusSeconds, focusMode]);

  const toggleFocusTimer = () => setIsFocusRunning(prev => !prev);
  const resetFocusTimer = () => {
    setIsFocusRunning(false);
    setFocusSeconds(focusMode === 'work' ? 25 * 60 : 5 * 60);
  };
  const switchFocusMode = (mode: 'work' | 'break') => {
    setIsFocusRunning(false);
    setFocusMode(mode);
    setFocusSeconds(mode === 'work' ? 25 * 60 : 5 * 60);
  };

  const formattedTimer = useMemo(() => {
    const m = Math.floor(focusSeconds / 60);
    const s = focusSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, [focusSeconds]);

  // ---------------------------------------------------------------------------
  // 3. LIVE AI COPILOT INTERACTION
  // ---------------------------------------------------------------------------
  const [selectedPersonaId, setSelectedPersonaId] = useState('creative-guide');
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotResponse, setCopilotResponse] = useState<string | null>(null);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [copilotCopied, setCopilotCopied] = useState(false);

  const selectedPersona = useMemo(() => {
    return PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0];
  }, [selectedPersonaId]);

  const quickPromptChips = useMemo(() => {
    if (language === 'ka') {
      return [
        { label: '💡 ბიზნეს იდეა', text: 'მომეცი 3 ინოვაციური ბიზნეს იდეა ქართულ ბაზარზე ციფრული პროდუქტებისთვის.' },
        { label: '✍️ მარკეტინგული პოსტი', text: 'დამიწერე მიმზიდველი სოციალური მედია პოსტი ახალი ონლაინ მაღაზიის გასაშვებად.' },
        { label: '🛍️ პროდუქტის აღწერა', text: 'შექმენი პროდუქტის პროფესიონალური აღწერა ელექტრონული კომერციისთვის.' },
        { label: '⚡ დღის გეგმა', text: 'დამეხმარე დღევანდელი სამუშაო გეგმის პრიორიტეტიზაციაში მაქსიმალური პროდუქტიულობისთვის.' }
      ];
    }
    return [
      { label: '💡 Product Idea', text: 'Give me 3 innovative digital product ideas for modern creators and makers.' },
      { label: '✍️ Marketing Copy', text: 'Write an engaging social media announcement for launching a new digital store.' },
      { label: '🛍️ Listing Description', text: 'Draft a high-converting product description for an online marketplace.' },
      { label: '⚡ Daily Priorities', text: 'Help me prioritize my daily tasks for maximum creator velocity.' }
    ];
  }, [language]);

  const handleRunCopilot = async (promptOverride?: string) => {
    const textToSend = promptOverride || copilotInput;
    if (!textToSend.trim() || isCopilotLoading) return;

    setIsCopilotLoading(true);
    setCopilotResponse(null);

    try {
      const res = await chatWithPersona(
        selectedPersona,
        textToSend,
        [],
        'gemini-2.5-flash',
        false,
        true,
        0.8,
        undefined,
        language
      );
      if (res && res.text) {
        setCopilotResponse(res.text);
      } else {
        setCopilotResponse(language === 'ka' ? 'პასუხის მიღება ვერ მოხერხდა.' : 'Could not generate a response.');
      }
    } catch (err: any) {
      console.error("Copilot error:", err);
      setCopilotResponse(
        language === 'ka' 
          ? `შეცდომა: ${err?.message || 'AI კავშირი შეფერხდა'}` 
          : `Error: ${err?.message || 'Failed to reach AI'}`
      );
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const handleCopyCopilot = () => {
    if (copilotResponse) {
      navigator.clipboard.writeText(copilotResponse);
      setCopilotCopied(true);
      setTimeout(() => setCopilotCopied(false), 2000);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. REAL TASK MANAGEMENT & PERSISTENCE
  // ---------------------------------------------------------------------------
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const stored = safeStorage.getJSON('proton_tasks', []);
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const [taskInputValue, setTaskInputValue] = useState('');
  const [taskCategory, setTaskCategory] = useState<string>('Workspace');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [activeTaskFilter, setActiveTaskFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  const syncTasks = useCallback((updated: Task[]) => {
    setTasks(updated);
    safeStorage.set('proton_tasks', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  }, []);

  const handleToggleTask = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTasks(prev => {
      const updated = prev.map(task => {
        if (task.id === id) {
          const completed = !task.completed;
          return { 
            ...task, 
            completed, 
            completedAt: completed ? Date.now() : undefined 
          };
        }
        return task;
      });
      safeStorage.set('proton_tasks', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      return updated;
    });
  }, []);

  const handleDeleteTask = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      safeStorage.set('proton_tasks', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      return updated;
    });
  }, []);

  const handleCreateTask = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = taskInputValue.trim();
    if (!trimmed) return;

    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      content: trimmed,
      completed: false,
      priority: taskPriority,
      timestamp: Date.now(),
      category: taskCategory
    };

    const updated = [newTask, ...tasks];
    syncTasks(updated);
    setTaskInputValue('');
  }, [taskInputValue, taskPriority, taskCategory, tasks, syncTasks]);

  const handleAddCopilotAsTask = () => {
    if (!copilotResponse) return;
    const firstLine = copilotResponse.split('\n')[0].replace(/^[#*-\s]+/, '').slice(0, 80);
    const newTask: Task = {
      id: `task_${Date.now()}_ai`,
      content: firstLine || (language === 'ka' ? 'AI რჩევის იმპლემენტაცია' : 'Implement AI output'),
      completed: false,
      priority: 'high',
      timestamp: Date.now(),
      category: 'AI Advisory'
    };
    syncTasks([newTask, ...tasks]);
  };

  // ---------------------------------------------------------------------------
  // 5. LIVE SCRATCHPAD (QUICK NOTES) WITH AUTOSAVE
  // ---------------------------------------------------------------------------
  const [scratchpad, setScratchpad] = useState<string>(() => {
    try {
      return localStorage.getItem('proton_quick_notes') || '';
    } catch {
      return '';
    }
  });

  const handleScratchpadChange = (val: string) => {
    setScratchpad(val);
    try {
      localStorage.setItem('proton_quick_notes', val);
    } catch {
      // ignore
    }
  };

  const handleConvertNotesToTasks = () => {
    if (!scratchpad.trim()) return;
    const lines = scratchpad.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    if (lines.length === 0) return;

    const newTasks: Task[] = lines.map((line, idx) => ({
      id: `task_${Date.now()}_${idx}`,
      content: line.replace(/^[•*-]\s*/, ''),
      completed: false,
      priority: 'medium',
      timestamp: Date.now() + idx,
      category: 'Notes'
    }));

    syncTasks([...newTasks, ...tasks]);
    handleScratchpadChange('');
  };

  // ---------------------------------------------------------------------------
  // 6. REAL RESUMABLE DRAFTS & ACTIVE ORDERS
  // ---------------------------------------------------------------------------
  const [productDraft, setProductDraft] = useState<{
    title: string;
    category?: string;
    price?: number;
    description?: string;
  } | null>(null);

  useEffect(() => {
    try {
      const savedDraftRaw = localStorage.getItem('proton_markethub_draft_form_data');
      if (savedDraftRaw) {
        const parsed = JSON.parse(savedDraftRaw);
        if (parsed?.data) {
          const title = parsed.data.title || parsed.data.titleGe;
          if (title && title.trim()) {
            setProductDraft({
              title: title.trim(),
              category: parsed.data.category || parsed.data.categoryGe,
              price: parsed.data.price ? Number(parsed.data.price) : undefined,
              description: parsed.data.description || parsed.data.descriptionGe
            });
          }
        }
      }
    } catch {
      setProductDraft(null);
    }
  }, []);

  const pendingOrders = useMemo(() => {
    return sellerOrders.filter(o => o.status === 'pending' || o.status === 'booked');
  }, [sellerOrders]);

  // ---------------------------------------------------------------------------
  // 7. REAL MARKETPLACE LISTINGS EXPLORER
  // ---------------------------------------------------------------------------
  const [marketSearch, setMarketSearch] = useState('');
  const [marketCategory, setMarketCategory] = useState('all');

  const filteredMarketListings = useMemo(() => {
    let list = Array.isArray(allListings) ? allListings : [];
    if (marketCategory !== 'all') {
      list = list.filter(l => (l.category || '').toLowerCase() === marketCategory.toLowerCase());
    }
    if (marketSearch.trim()) {
      const q = marketSearch.toLowerCase();
      list = list.filter(l => 
        (l.title || '').toLowerCase().includes(q) || 
        (l.description || '').toLowerCase().includes(q)
      );
    }
    return list.slice(0, 6);
  }, [allListings, marketCategory, marketSearch]);

  // ---------------------------------------------------------------------------
  // 8. RECENT ACTIVITY LIST (ONLY REAL EVENTS)
  // ---------------------------------------------------------------------------
  const recentActivities = useMemo<RecentActivityItem[]>(() => {
    const list: RecentActivityItem[] = [];

    // Real completed tasks
    tasks
      .filter(t => t.completed)
      .forEach(t => {
        const time = (t as any).completedAt || t.timestamp || Date.now();
        list.push({
          id: `act_task_${t.id}`,
          title: language === 'ka' ? `ამოცანა შესრულდა: ${t.content}` : `Task completed: ${t.content}`,
          category: t.category,
          timestamp: time,
          type: 'task'
        });
      });

    // Real fulfilled orders
    sellerOrders.filter(o => o.status === 'completed').forEach(o => {
      const time = typeof o.createdAt === 'number' ? o.createdAt : (o.createdAt?.seconds ? o.createdAt.seconds * 1000 : Date.now());
      list.push({
        id: `act_order_${o.id}`,
        title: language === 'ka' ? `შეკვეთა დასრულდა: ${o.itemTitle || o.id}` : `Order fulfilled: ${o.itemTitle || o.id}`,
        timestamp: time,
        type: 'order'
      });
    });

    // Real studio image generations
    try {
      const savedImagesRaw = localStorage.getItem('proton_image_history');
      if (savedImagesRaw) {
        const imagesList = JSON.parse(savedImagesRaw);
        if (Array.isArray(imagesList)) {
          imagesList.slice(0, 3).forEach((img: any) => {
            if (img.timestamp) {
              list.push({
                id: `act_img_${img.id || img.timestamp}`,
                title: language === 'ka' 
                  ? `ვიზუალი შეიქმნა: ${img.prompt ? img.prompt.slice(0, 32) + '...' : 'სტუდია'}` 
                  : `Visual generated: ${img.prompt ? img.prompt.slice(0, 32) + '...' : 'Studio'}`,
                timestamp: img.timestamp,
                type: 'image'
              });
            }
          });
        }
      }
    } catch {
      // ignore
    }

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  }, [tasks, sellerOrders, language]);

  const filteredTasks = useMemo(() => {
    if (activeTaskFilter === 'pending') return tasks.filter(t => !t.completed);
    if (activeTaskFilter === 'completed') return tasks.filter(t => t.completed);
    return tasks;
  }, [tasks, activeTaskFilter]);

  const completedCount = useMemo(() => tasks.filter(t => t.completed).length, [tasks]);
  const totalTaskCount = tasks.length;
  const progressPercent = totalTaskCount > 0 ? Math.round((completedCount / totalTaskCount) * 100) : 0;

  const formatTimeAgo = (ts: number): string => {
    try {
      const diffMs = Date.now() - ts;
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return language === 'ka' ? 'ახლახან' : 'just now';
      if (mins < 60) return language === 'ka' ? `${mins} წთ წინ` : `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return language === 'ka' ? `${hours} სთ წინ` : `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return language === 'ka' ? `${days} დღის წინ` : `${days}d ago`;
    } catch {
      return '';
    }
  };

  const formatCurrency = (val: number | undefined | null): string => {
    const num = typeof val === 'number' && !isNaN(val) ? val : 0;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-zinc-100"
    >
      {/* ========================================================================= */}
      {/* 1. DYNAMIC HEADER WITH LIVE CLOCK & FOCUS TIMER                          */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900/80 border border-zinc-800 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* User Greeting & Real Clock */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-zinc-950/80 border border-zinc-800 text-xs font-mono text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-zinc-200 font-bold">{formattedClock}</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400 capitalize">{formattedDate}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-sans">
              {greetingHeadline}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">{userName}</span>
            </h1>
            <p className="text-sm text-zinc-400">
              {language === 'ka' 
                ? 'ინტელექტუალური სამუშაო სივრცე: შეასრულეთ ამოცანები, გაუშვით AI კოპილოტი და მართეთ პროდუქტები.' 
                : 'Intelligent workspace: execute tasks, prompt your AI copilot, and manage real commerce.'}
            </p>
          </div>

          {/* Interactive Focus Mode / Pomodoro Widget */}
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 shadow-inner shrink-0">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isFocusRunning ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'}`} />
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  {focusMode === 'work' ? (language === 'ka' ? 'ფოკუს რეჟიმი' : 'Focus Mode') : (language === 'ka' ? 'შესვენება' : 'Break')}
                </span>
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-white mt-0.5">
                {formattedTimer}
              </div>
            </div>

            <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
              <button
                type="button"
                onClick={toggleFocusTimer}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  isFocusRunning 
                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold' 
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                }`}
                title={isFocusRunning ? 'Pause' : 'Start'}
              >
                {isFocusRunning ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button
                type="button"
                onClick={resetFocusTimer}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Reset Timer"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. LIVE AI COPILOT COMMAND BAR (DIRECT GEMINI GENERATOR)                 */}
      {/* ========================================================================= */}
      <div className="relative rounded-2xl bg-gradient-to-b from-indigo-950/40 via-zinc-900/90 to-zinc-950 border border-indigo-500/30 p-5 sm:p-6 shadow-xl space-y-4 backdrop-blur-md">
        
        {/* Header: Persona Selector & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                <span>{language === 'ka' ? 'პროტონ AI კოპილოტი' : 'Proton AI Copilot'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Gemini Live
                </span>
              </h2>
            </div>
          </div>

          {/* Persona selector pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PERSONAS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPersonaId(p.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedPersonaId === p.id 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                    : 'bg-zinc-950/70 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                <span>{p.avatar}</span>
                <span>{language === 'ka' ? p.nameGe || p.name : p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Prompt Suggestions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {quickPromptChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setCopilotInput(chip.text);
                handleRunCopilot(chip.text);
              }}
              className="px-3 py-1 rounded-full bg-zinc-950/80 hover:bg-indigo-950/60 border border-zinc-800 hover:border-indigo-500/40 text-zinc-300 hover:text-white text-xs font-sans transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{chip.label}</span>
            </button>
          ))}
        </div>

        {/* Real Live Prompt Input Form */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleRunCopilot();
          }}
          className="relative flex items-center w-full rounded-xl bg-zinc-950 border border-indigo-500/40 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-all"
        >
          <input
            type="text"
            value={copilotInput}
            onChange={(e) => setCopilotInput(e.target.value)}
            placeholder={
              language === 'ka' 
                ? `დაუსვი კითხვა ${selectedPersona.nameGe || selectedPersona.name}-ს...` 
                : `Ask ${selectedPersona.name} anything...`
            }
            className="w-full bg-transparent px-4 py-3 pr-28 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-sans"
          />
          <div className="absolute right-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={!copilotInput.trim() || isCopilotLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md cursor-pointer"
            >
              {isCopilotLoading ? (
                <span className="animate-spin text-xs">⚡</span>
              ) : (
                <>
                  <span>{language === 'ka' ? 'გაშვება' : 'Run'}</span>
                  <Send size={11} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Copilot Response Output Box */}
        <AnimatePresence>
          {copilotResponse && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 p-4 rounded-xl bg-zinc-950/90 border border-indigo-500/30 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-2 text-xs text-indigo-300 font-mono">
                  <span>{selectedPersona.avatar}</span>
                  <span className="font-bold">{language === 'ka' ? selectedPersona.nameGe || selectedPersona.name : selectedPersona.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCopilot}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs transition-colors cursor-pointer border border-zinc-700"
                  >
                    <Copy size={11} />
                    <span>{copilotCopied ? (language === 'ka' ? 'დაკოპირდა!' : 'Copied!') : (language === 'ka' ? 'კოპირება' : 'Copy')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCopilotAsTask}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 text-xs transition-colors cursor-pointer border border-indigo-700/60"
                  >
                    <Plus size={11} />
                    <span>{language === 'ka' ? '+ ამოცანად შენახვა' : '+ Add as Task'}</span>
                  </button>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans max-h-60 overflow-y-auto pr-1">
                {copilotResponse}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ========================================================================= */}
      {/* 3. RESUMABLE PRODUCT DRAFTS & PENDING ORDERS                             */}
      {/* ========================================================================= */}
      {productDraft && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/90 to-zinc-950 border border-emerald-500/40 p-5 sm:p-6 shadow-xl group hover:border-emerald-500/60 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ShoppingBag size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase font-semibold">
                    {language === 'ka' ? 'დაუსრულებელი მონახაზი' : 'Draft in Progress'}
                  </span>
                  {productDraft.category && (
                    <span className="text-xs text-zinc-400 font-medium truncate">
                      {productDraft.category}
                    </span>
                  )}
                </div>
                
                <h3 className="text-lg font-bold text-white mt-1 truncate group-hover:text-emerald-300 transition-colors">
                  {productDraft.title}
                </h3>
                
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
                  {productDraft.description || (language === 'ka' ? 'დაასრულეთ პროდუქტის რედაქტირება და გამოაქვეყნეთ მარკეტზე' : 'Resume editing details and publish to marketplace')}
                </p>

                {productDraft.price !== undefined && productDraft.price > 0 && (
                  <div className="mt-1 text-sm font-mono font-bold text-emerald-400">
                    {formatCurrency(productDraft.price)}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setUiMode('market', 'market-hub')}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <span>{language === 'ka' ? 'მონახაზის გაგრძელება' : 'Continue Editing'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Pending Orders Alerts */}
      {pendingOrders.length > 0 && (
        <div className="rounded-2xl bg-amber-950/30 border border-amber-500/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-300 flex items-center gap-2">
              <ShoppingBag size={14} />
              <span>{language === 'ka' ? 'მომლოდინე შეკვეთები' : 'Pending Customer Orders'}</span>
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
              {pendingOrders.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingOrders.map(order => (
              <div 
                key={order.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-zinc-100 truncate">
                    {order.itemTitle || (language === 'ka' ? `შეკვეთა #${order.id?.slice(0, 6)}` : `Order #${order.id?.slice(0, 6)}`)}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {order.buyerName || 'Customer'} • {formatCurrency(order.amount)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUiMode('market', 'market-hub')}
                  className="shrink-0 ml-3 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  {language === 'ka' ? 'დამუშავება' : 'Fulfill'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MAIN INTERACTIVE WORKSPACE: TASKS + LIVE SCRATCHPAD                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* --------------------------------------------------------------------- */}
        {/* LEFT: Task Execution Board (7 cols)                                   */}
        {/* --------------------------------------------------------------------- */}
        <div className="lg:col-span-7 rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 sm:p-6 space-y-5 backdrop-blur-md shadow-xl">
          
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white font-sans">
                  {language === 'ka' ? 'ამოცანების ორგანიზატორი' : 'Task Organizer'}
                </h2>
                <div className="text-xs text-zinc-400">
                  {completedCount} / {totalTaskCount} {language === 'ka' ? 'შესრულებული' : 'completed'} ({progressPercent}%)
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTaskFilter('pending')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  activeTaskFilter === 'pending' 
                    ? 'bg-zinc-800 text-white font-medium shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {language === 'ka' ? 'აქტიური' : 'Pending'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTaskFilter('all')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  activeTaskFilter === 'all' 
                    ? 'bg-zinc-800 text-white font-medium shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {language === 'ka' ? 'ყველა' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTaskFilter('completed')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  activeTaskFilter === 'completed' 
                    ? 'bg-zinc-800 text-white font-medium shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {language === 'ka' ? 'დასრულებული' : 'Done'}
              </button>
            </div>
          </div>

          {/* Visual Progress Bar */}
          {totalTaskCount > 0 && (
            <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-800/60">
              <div 
                className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 h-full transition-all duration-300 ease-out" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Interactive Task List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {filteredTasks.length > 0 ? (
              <AnimatePresence initial={false}>
                {filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all group ${
                      task.completed 
                        ? 'bg-zinc-950/40 border-zinc-800/40 text-zinc-500' 
                        : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700 text-zinc-200'
                    }`}
                  >
                    <div 
                      onClick={(e) => handleToggleTask(task.id, e)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                        task.completed 
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                          : 'border-zinc-700 group-hover:border-zinc-500 text-transparent'
                      }`}>
                        <Check size={12} className={task.completed ? 'opacity-100' : 'opacity-0 group-hover:opacity-30'} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className={`text-xs sm:text-sm font-medium transition-all ${
                          task.completed ? 'line-through text-zinc-500' : 'text-zinc-200'
                        }`}>
                          {task.content}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {task.category && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 hidden sm:inline-block">
                          {task.category}
                        </span>
                      )}
                      
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        task.priority === 'high' 
                          ? 'bg-rose-500' 
                          : task.priority === 'medium' 
                          ? 'bg-amber-400' 
                          : 'bg-zinc-600'
                      }`} />

                      <button
                        type="button"
                        onClick={(e) => handleDeleteTask(task.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-all cursor-pointer"
                        title="Delete Task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <div className="py-8 text-center text-xs text-zinc-500 font-sans space-y-2">
                <CheckCircle2 size={24} className="mx-auto text-zinc-600" />
                <p>{language === 'ka' ? 'ამოცანები არ არის. ჩაწერეთ ქვემოთ ახლის დასამატებლად.' : 'No tasks here. Type below to create one.'}</p>
              </div>
            )}
          </div>

          {/* Unified Fast Task Creator Bar */}
          <form 
            onSubmit={handleCreateTask}
            className="space-y-2 pt-2 border-t border-zinc-800"
          >
            <div className="relative flex items-center w-full rounded-xl bg-zinc-950 border border-zinc-800 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
              <input
                type="text"
                value={taskInputValue}
                onChange={(e) => setTaskInputValue(e.target.value)}
                placeholder={language === 'ka' ? '+ ჩაწერეთ ამოცანა ან იდეა...' : '+ Add a task or idea...'}
                className="w-full bg-transparent px-4 py-3 pr-24 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-sans"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="submit"
                  disabled={!taskInputValue.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shadow-sm"
                >
                  <span>{language === 'ka' ? 'დამატება' : 'Add'}</span>
                  <CornerDownLeft size={11} />
                </button>
              </div>
            </div>

            {/* Quick Priority & Category selectors */}
            <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
              <div className="flex items-center gap-2">
                <span>{language === 'ka' ? 'პრიორიტეტი:' : 'Priority:'}</span>
                <button
                  type="button"
                  onClick={() => setTaskPriority('high')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer ${taskPriority === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {language === 'ka' ? 'მაღალი' : 'High'}
                </button>
                <button
                  type="button"
                  onClick={() => setTaskPriority('medium')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer ${taskPriority === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {language === 'ka' ? 'საშუალო' : 'Med'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span>{language === 'ka' ? 'კატეგორია:' : 'Tag:'}</span>
                <select
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-[11px] text-zinc-300 focus:outline-none"
                >
                  <option value="Workspace">Workspace</option>
                  <option value="Market">Market</option>
                  <option value="Creative">Creative</option>
                  <option value="Dev">Dev</option>
                </select>
              </div>
            </div>
          </form>

        </div>

        {/* --------------------------------------------------------------------- */}
        {/* RIGHT: Live Autosaving Scratchpad & Activity Feed (5 cols)           */}
        {/* --------------------------------------------------------------------- */}
        <div className="lg:col-span-5 space-y-6">

          {/* Interactive Live Autosaving Scratchpad */}
          <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-3 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-amber-400" />
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-200">
                  {language === 'ka' ? 'სწრაფი ჩანიშვნები' : 'Live Scratchpad'}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                {language === 'ka' ? 'ავტომატური შენახვა' : 'Autosaved'}
              </span>
            </div>

            <textarea
              value={scratchpad}
              onChange={(e) => handleScratchpadChange(e.target.value)}
              placeholder={
                language === 'ka' 
                  ? 'ჩაინიშნეთ იდეები, კოდი ან ტექსტი... შემდეგ 1 კლიკით გადააქციეთ ამოცანებად.' 
                  : 'Write thoughts, quick notes, or clipboard snippets... 1-click convert into tasks.'
              }
              rows={4}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 resize-none font-sans"
            />

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleConvertNotesToTasks}
                disabled={!scratchpad.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <Plus size={12} />
                <span>{language === 'ka' ? 'გადაიტანე ამოცანებში' : 'Convert to Tasks'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (scratchpad.trim()) {
                    setCopilotInput(`Analyze and improve these notes:\n${scratchpad}`);
                    handleRunCopilot(`Analyze and improve these notes:\n${scratchpad}`);
                  }
                }}
                disabled={!scratchpad.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <Sparkles size={12} className="text-indigo-400" />
                <span>{language === 'ka' ? 'AI ანალიზი' : 'AI Summary'}</span>
              </button>
            </div>
          </div>

          {/* Recent Chronological Activity Feed (Only Real Events) */}
          <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-4 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-zinc-400" />
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-400">
                  {language === 'ka' ? 'ბოლო აქტივობა' : 'Recent Activity'}
                </h3>
              </div>
            </div>

            {recentActivities.length > 0 ? (
              <div className="divide-y divide-zinc-800/60 max-h-64 overflow-y-auto pr-1">
                {recentActivities.map((act) => (
                  <div 
                    key={act.id}
                    className="flex items-start justify-between gap-3 py-2.5 text-xs"
                  >
                    <span className="text-zinc-300 font-medium leading-snug line-clamp-2">
                      {act.title}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500 shrink-0 mt-0.5">
                      {formatTimeAgo(act.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-zinc-500 font-sans space-y-2">
                <Clock size={20} className="mx-auto text-zinc-600" />
                <p>{language === 'ka' ? 'აქტივობები ავტომატურად ჩაიწერება ამოცანების შესრულებისას.' : 'Activity stream will populate as tasks and orders are completed.'}</p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 5. LIVE MARKETPLACE EXPLORER (REAL PRODUCTS FROM MARKET HUB)             */}
      {/* ========================================================================= */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-6 space-y-5 backdrop-blur-md shadow-xl">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Store size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-sans">
                {language === 'ka' ? 'მარკეტის რეალური პროდუქტები' : 'Live Marketplace Explorer'}
              </h2>
              <p className="text-xs text-zinc-400">
                {language === 'ka' ? 'გამოიკვლიეთ და მართეთ ციფრული და ფიზიკური პროდუქტები' : 'Browse and manage verified marketplace products'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                placeholder={language === 'ka' ? 'ძიება მარკეტზე...' : 'Search listings...'}
                className="bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setUiMode('market', 'market-hub')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors cursor-pointer shrink-0"
            >
              <span>{language === 'ka' ? 'მარკეტჰაბი' : 'Open Market'}</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>

        {/* Real Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMarketListings.length > 0 ? (
            filteredMarketListings.map((listing) => (
              <div
                key={listing.id}
                onClick={() => setUiMode('market', 'market-hub')}
                className="group p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-950 transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-emerald-400 border border-emerald-500/20 uppercase font-semibold">
                      {listing.category || 'Product'}
                    </span>
                    <span className="text-xs font-mono font-bold text-white">
                      {formatCurrency(listing.price)}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors line-clamp-1">
                    {listing.title}
                  </h4>

                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {listing.description || 'Verified product listing in Proton Ecosystem.'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-xs">
                  <span className="text-zinc-500 text-[11px]">
                    {listing.sellerName || 'Merchant'}
                  </span>
                  <span className="text-emerald-400 font-semibold inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>{language === 'ka' ? 'ნახვა' : 'View'}</span>
                    <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-xs text-zinc-500">
              {language === 'ka' ? 'პროდუქტები ვერ მოიძებნა.' : 'No matching products found.'}
            </div>
          )}
        </div>

      </div>

    </motion.div>
  );
});

DashboardView.displayName = 'DashboardView';
