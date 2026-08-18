import React, { useState, useMemo, useCallback } from 'react';
import { safeStorage } from '../lib/safeStorage';
import { motion } from 'framer-motion';
import { 
  ShoppingBag, 
  Sparkles, 
  Plus, 
  Check, 
  ListTodo, 
  AlertTriangle,
  ArrowRight,
  Package,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';
import { View, Task, Listing, Order } from '../types';
import { SystemHealthState } from '../hooks/useSystemHealth';
import { useSellerStats } from '../hooks/useSellerStats';
import { useAuth } from '../contexts/AuthContext';

export interface DashboardViewProps {
  setActiveView: (v: View) => void;
  language: 'en' | 'ka';
  setUiMode: (m: 'business' | 'creative' | 'market', targetView?: View) => void;
  systemHealth?: SystemHealthState;
}

interface ActionQueueItem {
  id: string;
  type: 'order' | 'task' | 'low_stock';
  priorityRank: 1 | 2 | 3;
  title: string;
  subtitle: string;
  amount?: number;
  currency?: string;
  badgeText: string;
  badgeVariant: 'amber' | 'blue' | 'rose';
  rawItem: Order | Task | Listing;
}

export const DashboardView = React.memo(({ 
  setActiveView, 
  language = 'en',
  setUiMode
}: DashboardViewProps) => {
  const { user } = useAuth();

  // 1. Task Persistence & Real-time State Synchronization
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const stored = safeStorage.getJSON('proton_tasks', []);
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const [newTaskInput, setNewTaskInput] = useState('');
  const [showAllQueue, setShowAllQueue] = useState(false);

  const syncTasks = useCallback((updated: Task[]) => {
    setTasks(updated);
    safeStorage.set('proton_tasks', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  }, []);

  const handleToggleTask = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTasks(prev => {
      const updated = prev.map(task => 
        task.id === id ? { ...task, completed: !task.completed } : task
      );
      safeStorage.set('proton_tasks', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      return updated;
    });
  }, []);

  const handleCreateQuickTask = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskInput.trim();
    if (!trimmed) return;

    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      content: trimmed,
      completed: false,
      priority: 'high',
      timestamp: Date.now(),
      category: 'Workspace'
    };

    const updated = [newTask, ...tasks];
    syncTasks(updated);
    setNewTaskInput('');
  }, [newTaskInput, tasks, syncTasks]);

  // 2. Consume 100% Authoritative Business Telemetry from SellerProvider
  const {
    activeListings,
    pendingOrders,
    loading: statsLoading
  } = useSellerStats();

  // 3. Derived Operational States
  const activeTasks = useMemo(() => {
    return tasks.filter(t => !t.completed);
  }, [tasks]);

  const lowStockListings = useMemo(() => {
    return activeListings.filter(l => l.stock !== undefined && l.stock <= 2);
  }, [activeListings]);

  // 4. Construct Unified Operational Action Queue (Priority: Orders > Tasks > Low Stock)
  const actionQueueItems = useMemo<ActionQueueItem[]>(() => {
    const items: ActionQueueItem[] = [];

    // Priority 1: Pending & Unfulfilled Customer Orders
    pendingOrders.forEach(order => {
      const buyerLabel = order.buyerName || order.buyerId || (language === 'ka' ? 'მომხმარებელი' : 'Customer');
      items.push({
        id: `order_${order.id}`,
        type: 'order',
        priorityRank: 1,
        title: order.itemTitle || (language === 'ka' ? `შეკვეთა #${order.id?.slice(0, 6)}` : `Order #${order.id?.slice(0, 6)}`),
        subtitle: `${language === 'ka' ? 'მყიდველი:' : 'Buyer:'} ${buyerLabel}`,
        amount: order.amount,
        currency: order.currency || 'USD',
        badgeText: language === 'ka' ? 'შეკვეთა' : 'Order',
        badgeVariant: 'amber',
        rawItem: order
      });
    });

    // Priority 2: Incomplete & Overdue Tasks
    // Sort high priority first
    const sortedTasks = [...activeTasks].sort((a, b) => {
      const rankA = a.priority === 'high' ? 3 : a.priority === 'medium' ? 2 : 1;
      const rankB = b.priority === 'high' ? 3 : b.priority === 'medium' ? 2 : 1;
      return rankB - rankA;
    });

    sortedTasks.forEach(task => {
      items.push({
        id: `task_${task.id}`,
        type: 'task',
        priorityRank: 2,
        title: task.content,
        subtitle: task.category ? `${task.category}` : (language === 'ka' ? 'სამუშაო დავალება' : 'Workspace Task'),
        badgeText: task.priority === 'high' 
          ? (language === 'ka' ? 'მაღალი პრიორიტეტი' : 'High Priority') 
          : (language === 'ka' ? 'ამოცანა' : 'Task'),
        badgeVariant: 'blue',
        rawItem: task
      });
    });

    // Priority 3: Low-Stock Inventory Alerts
    lowStockListings.forEach(listing => {
      const stockText = listing.stock === 0 
        ? (language === 'ka' ? 'მარაგი ამოიწურა (0)' : 'Out of stock (0)')
        : (language === 'ka' ? `დაბალი მარაგი (${listing.stock} დარჩა)` : `Low stock (${listing.stock} left)`);

      items.push({
        id: `stock_${listing.id}`,
        type: 'low_stock',
        priorityRank: 3,
        title: listing.title,
        subtitle: `${listing.category || 'Product'} • ${stockText}`,
        amount: listing.price,
        currency: 'USD',
        badgeText: language === 'ka' ? 'მარაგის გაფრთხილება' : 'Stock Alert',
        badgeVariant: 'rose',
        rawItem: listing
      });
    });

    return items;
  }, [pendingOrders, activeTasks, lowStockListings, language]);

  const totalActionCount = actionQueueItems.length;
  const visibleQueueItems = showAllQueue ? actionQueueItems : actionQueueItems.slice(0, 5);

  // Authenticated workspace title & date
  const workspaceName = user?.displayName || user?.email?.split('@')[0] || (language === 'ka' ? 'პროტონ სივრცე' : 'Proton Workspace');
  const todayDateStr = useMemo(() => {
    try {
      return new Date().toLocaleDateString(language === 'ka' ? 'ka-GE' : 'en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return '';
    }
  }, [language]);

  const formatCurrency = (val: number | undefined | null): string => {
    const num = typeof val === 'number' && !isNaN(val) ? val : 0;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-20 max-w-5xl mx-auto px-4"
    >
      {/* ========================================================================= */}
      {/* LEVEL 1: ORIENTATION (Compact Workspace Header & Status Strip)            */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-xs uppercase font-mono">
            {workspaceName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight">
                {workspaceName}
              </h1>
              <span className="text-zinc-600">•</span>
              <span className="text-xs text-zinc-400 font-mono">
                {todayDateStr}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {language === 'ka' ? 'საოპერაციო მართვის პანელი' : 'Operational Workspace Cockpit'}
            </p>
          </div>
        </div>

        {/* Dynamic Operational Status Indicator */}
        <div className="flex items-center gap-2">
          {statsLoading ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-zinc-600" />
              <span>{language === 'ka' ? 'სინქრონიზაცია...' : 'Syncing...'}</span>
            </div>
          ) : totalActionCount > 0 ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs font-mono font-medium text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>
                {totalActionCount} {language === 'ka' 
                  ? (totalActionCount === 1 ? 'მოქმედება მოსამსახურებელი' : 'მოქმედება მოსამსახურებელი') 
                  : (totalActionCount === 1 ? 'Action Pending' : 'Actions Pending')}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-medium text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{language === 'ka' ? 'ნომინალური • 0 დავალება' : 'Nominal • 0 Pending'}</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LEVEL 2: UNIFIED OPERATIONAL ACTION QUEUE (The Primary Operational Core) */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-zinc-400" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
              {language === 'ka' ? 'საოპერაციო რიგი' : 'Action Queue'}
            </h2>
            {totalActionCount > 0 && (
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                {totalActionCount}
              </span>
            )}
          </div>

          {totalActionCount > 5 && (
            <button
              type="button"
              onClick={() => setShowAllQueue(!showAllQueue)}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              {showAllQueue 
                ? (language === 'ka' ? 'შეკუმშვა' : 'Show Top 5') 
                : (language === 'ka' ? `სრულად ნახვა (+${totalActionCount - 5})` : `Show All (+${totalActionCount - 5})`)}
            </button>
          )}
        </div>

        {/* Queue Container */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 overflow-hidden divide-y divide-zinc-800/60">
          {statsLoading ? (
            <div className="p-4 space-y-3 animate-pulse">
              <div className="h-11 bg-zinc-900/80 rounded-lg border border-zinc-800/40" />
              <div className="h-11 bg-zinc-900/80 rounded-lg border border-zinc-800/40" />
            </div>
          ) : totalActionCount > 0 ? (
            visibleQueueItems.map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 transition-colors hover:bg-zinc-900/40",
                  item.type === 'order' ? "bg-amber-500/[0.02]" : ""
                )}
              >
                {/* Left & Center: Type, Urgency, Metadata */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                    item.badgeVariant === 'amber' 
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : item.badgeVariant === 'rose'
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                  )}>
                    {item.type === 'order' ? (
                      <ShoppingBag size={14} />
                    ) : item.type === 'low_stock' ? (
                      <AlertTriangle size={14} />
                    ) : (
                      <ListTodo size={14} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs sm:text-sm text-zinc-100 truncate">
                        {item.title}
                      </span>
                      <span className={cn(
                        "text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shrink-0",
                        item.badgeVariant === 'amber' 
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : item.badgeVariant === 'rose'
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      )}>
                        {item.badgeText}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5 truncate">
                      <span className="truncate">{item.subtitle}</span>
                      {item.amount !== undefined && (
                        <>
                          <span>•</span>
                          <span className="font-mono font-medium text-zinc-300">
                            {formatCurrency(item.amount)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Direct Action Execution */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {item.type === 'order' && (
                    <button
                      type="button"
                      onClick={() => setUiMode('market', 'market-hub')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <span>{language === 'ka' ? 'დამუშავება' : 'Review & Fulfill'}</span>
                      <ArrowRight size={12} />
                    </button>
                  )}

                  {item.type === 'task' && (
                    <button
                      type="button"
                      onClick={(e) => handleToggleTask((item.rawItem as Task).id, e)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 text-xs font-medium transition-colors cursor-pointer group"
                    >
                      <Check size={12} className="text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                      <span>{language === 'ka' ? 'დასრულება' : 'Mark Done'}</span>
                    </button>
                  )}

                  {item.type === 'low_stock' && (
                    <button
                      type="button"
                      onClick={() => setUiMode('market', 'market-hub')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Package size={12} className="text-zinc-400" />
                      <span>{language === 'ka' ? 'მარაგის მართვა' : 'Manage Stock'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            /* ========================================================================= */
            /* ZERO-ACTIVITY STATE (Calm Operational Composure)                          */
            /* ========================================================================= */
            <div className="py-10 px-4 text-center space-y-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Check size={18} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-200">
                  {language === 'ka' ? 'ყველა სისტემა ნომინალურ რეჟიმშია' : 'All Systems Nominal'}
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {language === 'ka' 
                    ? 'ყურადღებას არცერთი მოქმედება არ საჭიროებს. სამუშაო სივრცე მზადაა.'
                    : 'No actions require your attention. Your operational horizon is clear.'}
                </p>
              </div>

              {/* Direct Initiation Triggers */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const inputEl = document.getElementById('quick-command-input');
                    if (inputEl) inputEl.focus();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus size={12} className="text-purple-400" />
                  <span>{language === 'ka' ? 'ამოცანის დამატება' : '+ Capture Task'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUiMode('market', 'market-hub')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 text-xs font-medium transition-colors cursor-pointer"
                >
                  <ShoppingBag size={12} className="text-emerald-400" />
                  <span>{language === 'ka' ? 'განცხადების შექმნა' : '+ Create Listing'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('personas')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Sparkles size={12} className="text-cyan-400" />
                  <span>{language === 'ka' ? 'AI ასისტენტი' : 'Launch AI'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LEVEL 4: QUICK INLINE COMMAND / TASK CAPTURE SURFACE                     */}
      {/* ========================================================================= */}
      <form 
        onSubmit={handleCreateQuickTask}
        className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950/90 border border-zinc-800/90 focus-within:border-zinc-700 transition-colors"
      >
        <div className="pl-2 text-zinc-500">
          <ListTodo size={15} />
        </div>
        <input
          id="quick-command-input"
          type="text"
          value={newTaskInput}
          onChange={(e) => setNewTaskInput(e.target.value)}
          placeholder={language === 'ka' ? 'ჩაწერეთ სწრაფი ამოცანა ან ჩანაწერი და დააჭირეთ Enter-ს...' : 'Capture quick task, note, or command (Press Enter)...'}
          className="flex-1 bg-transparent border-none text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!newTaskInput.trim()}
          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900 text-zinc-200 text-xs font-medium border border-zinc-800 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {language === 'ka' ? 'დამატება' : 'Add Task'}
        </button>
      </form>
    </motion.div>
  );
});

DashboardView.displayName = 'DashboardView';
