import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  BellOff,
  Settings,
  Check, 
  CheckCheck, 
  Trash2, 
  X, 
  ShoppingBag, 
  Sparkles, 
  ShieldCheck, 
  Calendar, 
  ChevronRight, 
  Volume2, 
  VolumeX, 
  Info, 
  Filter, 
  Plus, 
  ArrowRight,
  Zap,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, writeBatch, orderBy, limit, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { NotificationItem, NotificationCategory, View } from '../types';
import { safeStorage } from '../lib/safeStorage';
import { cn } from '../lib/utils';

interface NotificationCenterProps {
  language: 'en' | 'ka';
  activeView: View;
  setActiveView: (view: View) => void;
  showToast?: (message: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
  notificationsEnabled?: boolean;
}

// Initial default notifications (empty for clean user state)
const DEFAULT_NOTIFICATIONS: NotificationItem[] = [];

// Helper to play subtle soft chime sound
const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // Audio context may be blocked by autoplay policies
  }
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  language,
  activeView,
  setActiveView,
  showToast,
  notificationsEnabled = true
}) => {
  const isEnabled = notificationsEnabled !== false;
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | NotificationCategory>('all');
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return safeStorage.get('proton_notif_sound') !== 'false';
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  // Local state for fallback / instant reactivity
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = safeStorage.get('proton_notifications');
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });

  const currentUser = auth.currentUser;

  // Real-time Sync with Firestore if logged in and notifications are globally enabled
  useEffect(() => {
    if (!isEnabled) {
      setLoading(false);
      return; // Bypass listener: saves Firestore reads completely when muted!
    }

    if (!currentUser) {
      safeStorage.set('proton_notifications', JSON.stringify(notifications));
      setLoading(false);
      return;
    }

    setLoading(true);
    const notifRef = collection(db, 'users', currentUser.uid, 'notifications');
    const q = query(notifRef, orderBy('timestamp', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setNotifications([]);
      } else {
        const items: NotificationItem[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title || '',
            titleKa: data.titleKa || data.title || '',
            message: data.message || '',
            messageKa: data.messageKa || data.message || '',
            timestamp: data.timestamp || Date.now(),
            read: !!data.read,
            category: (data.category as NotificationCategory) || 'system',
            targetView: data.targetView as View | undefined,
            actionUrl: data.actionUrl,
            metadata: data.metadata
          };
        });
        setNotifications(items);
        safeStorage.set('proton_notifications', JSON.stringify(items));
      }
      setLoading(false);
    }, (error) => {
      console.warn("Firestore notification sync fallback:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, isEnabled]);

  // Save to safeStorage when local state mutates (for guest/offline mode)
  useEffect(() => {
    safeStorage.set('proton_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Sound setting toggle persistence
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      safeStorage.set('proton_notif_sound', String(next));
      if (next && isEnabled) playNotificationChime();
      return next;
    });
  };

  // Close on outside click or Escape key press
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = useMemo(() => {
    if (!isEnabled) return 0;
    return notifications.filter(n => !n.read).length;
  }, [notifications, isEnabled]);

  // Filtered list
  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      if (activeTab === 'unread') return !item.read;
      if (activeTab === 'all') return true;
      return item.category === activeTab;
    });
  }, [notifications, activeTab]);

  // Mark single as read
  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'notifications', id), { read: true });
      } catch (err) {
        // Ignored fallback
      }
    }
  }, [currentUser]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        notifications.filter(n => !n.read).forEach(n => {
          const ref = doc(db, 'users', currentUser.uid, 'notifications', n.id);
          batch.update(ref, { read: true });
        });
        await batch.commit();
      } catch (err) {
        // Fallback handled
      }
    }

    if (showToast) {
      showToast(
        language === 'ka' ? 'ყველა შეტყობინება მონიშნულია წაკითხულად' : 'All notifications marked as read',
        'success'
      );
    }
  }, [currentUser, notifications, showToast, language]);

  // Delete single item
  const deleteNotification = useCallback(async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));

    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'notifications', id));
      } catch (err) {
        // Fallback
      }
    }
  }, [currentUser]);

  // Clear all
  const clearAllNotifications = useCallback(async () => {
    if (notifications.length === 0) return;
    setNotifications([]);

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        notifications.forEach(n => {
          const ref = doc(db, 'users', currentUser.uid, 'notifications', n.id);
          batch.delete(ref);
        });
        await batch.commit();
      } catch (err) {
        // Fallback
      }
    }

    if (showToast) {
      showToast(
        language === 'ka' ? 'შეტყობინებების სია გასუფთავდა' : 'Notifications list cleared',
        'info'
      );
    }
  }, [currentUser, notifications, showToast, language]);

  // Handle clicking notification item
  const handleItemClick = (item: NotificationItem) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    if (item.targetView) {
      setActiveView(item.targetView);
      setIsOpen(false);
    }
  };

  // Add test notification for user preview
  const handleAddTestNotification = async () => {
    const testItem: NotificationItem = {
      id: `test-notif-${Date.now()}`,
      title: 'Real-time System Audit Passed',
      titleKa: 'სისტემური აუდიტი წარმატებულია',
      message: 'All zero-trust security parameters & encrypted pipelines are verified.',
      messageKa: 'ყველა უსაფრთხოების პარამეტრი და შიფრირებული არხი გადამოწმებულია.',
      timestamp: Date.now(),
      read: false,
      category: 'system',
      targetView: 'settings'
    };

    setNotifications(prev => [testItem, ...prev]);

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'notifications', testItem.id), testItem);
      } catch (e) {
        // Fallback
      }
    }

    if (soundEnabled) {
      playNotificationChime();
    }

    if (showToast) {
      showToast(
        language === 'ka' ? 'ახალი შეტყობინება დაემატა!' : 'New test notification generated!',
        'success'
      );
    }
  };

  // Format relative timestamp
  const formatTimeAgo = (timestamp: number) => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return language === 'ka' ? 'ახლახანს' : 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return language === 'ka' ? `${diffMin} წთ-ის წინ` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return language === 'ka' ? `${diffHours} სთ-ის წინ` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return language === 'ka' ? `${diffDays} დღის წინ` : `${diffDays}d ago`;
  };

  // Icon selector per category
  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'market':
        return <ShoppingBag size={14} className="text-emerald-400" />;
      case 'ai':
        return <Sparkles size={14} className="text-proton-accent" />;
      case 'tasks':
        return <Calendar size={14} className="text-amber-400" />;
      case 'system':
      default:
        return <ShieldCheck size={14} className="text-blue-400" />;
    }
  };

  return (
    <div className="relative shrink-0 select-none" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-8 sm:w-10 h-8 sm:h-10 rounded-xl border flex items-center justify-center transition-all duration-300 relative shrink-0 cursor-pointer shadow-sm group focus-visible:ring-2 focus-visible:ring-proton-accent focus-visible:ring-offset-2 focus-visible:ring-offset-proton-bg focus-visible:outline-none",
          isOpen 
            ? "bg-proton-accent/20 border-proton-accent text-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.2)]" 
            : !isEnabled
              ? "bg-proton-bg/60 border-proton-border/60 text-proton-muted/60 hover:text-proton-muted hover:border-proton-border"
              : unreadCount > 0
                ? "bg-proton-bg border-proton-accent/40 text-proton-accent hover:border-proton-accent hover:bg-proton-accent/10"
                : "bg-proton-bg border-proton-border text-proton-muted hover:text-proton-text hover:border-proton-accent/30"
        )}
        title={!isEnabled ? (language === 'ka' ? 'შეტყობინებები გათიშულია (პარამეტრებიდან)' : 'Notifications Muted (Disabled in Settings)') : (language === 'ka' ? 'შეტყობინებების ცენტრი' : 'Notification Hub')}
        aria-expanded={isOpen}
        aria-label="Notification Center"
      >
        {isEnabled ? (
          <Bell size={16} className={cn("sm:w-[18px] sm:h-[18px] transition-transform duration-300", isOpen && "scale-110")} />
        ) : (
          <BellOff size={16} className="sm:w-[18px] sm:h-[18px] text-proton-muted/60" />
        )}
        
        {/* Unread Ping Badge (Only when active and notifications enabled) */}
        {isEnabled && unreadCount > 0 && (
          <>
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-proton-accent text-proton-bg font-mono font-black text-[9px] shadow-[0_0_10px_#00f2ff]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-proton-accent animate-ping opacity-75 pointer-events-none" />
          </>
        )}
      </button>

      {/* Popover Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-12 w-[340px] sm:w-[420px] max-w-[calc(100vw-1.5rem)] bg-[#0c0d0f]/95 border border-proton-border/80 shadow-[0_12px_45px_rgba(0,0,0,0.85)] backdrop-blur-2xl rounded-3xl z-[100] overflow-hidden flex flex-col origin-top-right"
          >
            {/* Header */}
            <div className="p-4 border-b border-proton-border/50 flex items-center justify-between bg-proton-bg/40">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-8 h-8 rounded-xl border flex items-center justify-center",
                  isEnabled ? "bg-proton-accent/10 border-proton-accent/30 text-proton-accent" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                )}>
                  {isEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-proton-text">
                      {language === 'ka' ? 'შეტყობინებების ცენტრი' : 'Notification Hub'}
                    </h3>
                    {isEnabled && unreadCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-proton-accent/20 border border-proton-accent/30 text-proton-accent text-[9px] font-mono font-bold">
                        {unreadCount} {language === 'ka' ? 'ახალი' : 'NEW'}
                      </span>
                    ) : !isEnabled ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[9px] font-mono font-bold">
                        {language === 'ka' ? 'გათიშულია' : 'MUTED'}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[9px] font-mono text-proton-muted uppercase tracking-widest mt-0.5">
                    {isEnabled ? 'PROTON OS // LIVE REALTIME ALERTS' : 'ALERTS MUTED // SAVING BANDWIDTH'}
                  </p>
                </div>
              </div>

              {/* Top Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleSound}
                  className={cn(
                    "p-1.5 rounded-lg border transition-all focus-visible:ring-2 focus-visible:ring-proton-accent focus-visible:outline-none",
                    soundEnabled && isEnabled
                      ? "bg-proton-accent/10 border-proton-accent/30 text-proton-accent" 
                      : "bg-proton-bg border-proton-border text-proton-muted hover:text-proton-text"
                  )}
                  title={soundEnabled ? (language === 'ka' ? 'ხმის გამორთვა' : 'Disable Sound') : (language === 'ka' ? 'ხმის ჩართვა' : 'Enable Sound')}
                >
                  {soundEnabled && isEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg bg-proton-bg border border-proton-border text-proton-muted hover:text-proton-text transition-all focus-visible:ring-2 focus-visible:ring-proton-accent focus-visible:outline-none"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Banner when Muted */}
            {!isEnabled && (
              <div className="mx-3 mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <BellOff size={15} className="text-amber-400 shrink-0" />
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-wide text-amber-300">
                      {language === 'ka' ? 'შეტყობინებები გათიშულია' : 'Global Notifications Muted'}
                    </p>
                    <p className="text-[9px] text-proton-muted font-bold">
                      {language === 'ka' ? 'რეალური დროის მონაცემების კითხვა შეჩერებულია' : 'Polling paused to save bandwidth & reads'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('settings');
                    setIsOpen(false);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[9px] font-black uppercase tracking-wider shrink-0 transition-all border border-amber-500/40 flex items-center gap-1 cursor-pointer"
                >
                  <Settings size={10} />
                  <span>{language === 'ka' ? 'ჩართვა' : 'Settings'}</span>
                </button>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="p-2 border-b border-proton-border/30 bg-proton-bg/20 flex items-center gap-1 overflow-x-auto custom-scrollbar-minimal">
              {[
                { id: 'all', label: language === 'ka' ? 'ყველა' : 'All' },
                { id: 'unread', label: language === 'ka' ? 'წაუკითხავი' : 'Unread', badge: unreadCount },
                { id: 'system', label: language === 'ka' ? 'სისტემა' : 'System' },
                { id: 'market', label: language === 'ka' ? 'მარკეტი' : 'Market' },
                { id: 'ai', label: language === 'ka' ? 'AI' : 'AI' },
                { id: 'tasks', label: language === 'ka' ? 'დავალებები' : 'Tasks' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-proton-accent focus-visible:outline-none",
                    activeTab === tab.id
                      ? "bg-proton-accent/20 border border-proton-accent/40 text-proton-accent shadow-sm"
                      : "text-proton-muted hover:text-proton-text hover:bg-proton-accent/5 border border-transparent"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="w-4 h-4 rounded-full bg-proton-accent text-proton-bg text-[8px] font-black flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Notification Items List */}
            <div className="max-h-[60vh] sm:max-h-[380px] overflow-y-auto custom-scrollbar-minimal p-2 space-y-1.5">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  // Sleek Skeleton Loading State
                  <div className="space-y-2 py-1">
                    {[1, 2, 3].map((key) => (
                      <div
                        key={key}
                        className="p-3 rounded-2xl border border-proton-border/30 bg-proton-bg/40 animate-pulse flex items-start gap-3"
                      >
                        <div className="w-8 h-8 rounded-xl bg-proton-border/40 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-2 py-0.5">
                          <div className="h-3 bg-proton-border/50 rounded-md w-2/3" />
                          <div className="h-2.5 bg-proton-border/30 rounded-md w-full" />
                          <div className="h-2 bg-proton-border/20 rounded-md w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="py-12 px-4 flex flex-col items-center justify-center text-center text-proton-muted"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-proton-accent/5 border border-proton-border flex items-center justify-center text-proton-muted mb-3">
                      <Bell size={20} className="opacity-40" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-wider text-proton-text/80">
                      {language === 'ka' ? 'შეტყობინება არ არის' : 'No notifications'}
                    </p>
                    <p className="text-[10px] text-proton-muted max-w-[220px] mt-1 font-mono">
                      {activeTab === 'unread' 
                        ? (language === 'ka' ? 'ყველა შეტყობინება წაკითხულია' : 'All notifications are marked as read')
                        : (language === 'ka' ? 'ამ კატეგორიაში შეტყობინებები არ იძებნება' : 'No items match the selected category filter')}
                    </p>
                  </motion.div>
                ) : (
                  filteredNotifications.map(item => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        "p-3 rounded-2xl border transition-all duration-200 cursor-pointer relative group flex items-start gap-3 focus-visible:ring-2 focus-visible:ring-proton-accent focus-visible:outline-none",
                        !item.read
                          ? "bg-proton-accent/[0.06] border-proton-accent/30 hover:border-proton-accent/60 shadow-sm"
                          : "bg-proton-bg/40 border-proton-border/40 hover:bg-proton-accent/[0.02] hover:border-proton-border"
                      )}
                      tabIndex={0}
                      role="button"
                    >
                      {/* Category Icon */}
                      <div className={cn(
                        "w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 transition-all",
                        !item.read
                          ? "bg-proton-accent/10 border-proton-accent/30 text-proton-accent"
                          : "bg-proton-bg border-proton-border text-proton-muted"
                      )}>
                        {getCategoryIcon(item.category)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className={cn(
                            "text-xs font-bold leading-snug truncate",
                            !item.read ? "text-proton-text font-black" : "text-proton-text/80"
                          )}>
                            {language === 'ka' ? (item.titleKa || item.title) : item.title}
                          </h4>
                          {!item.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-proton-accent shrink-0 animate-pulse" />
                          )}
                        </div>

                        <p className="text-[11px] text-proton-muted/90 line-clamp-2 leading-relaxed">
                          {language === 'ka' ? (item.messageKa || item.message) : item.message}
                        </p>

                        <div className="flex items-center gap-3 mt-2 text-[9px] font-mono text-proton-muted">
                          <span className="flex items-center gap-1">
                            <Clock size={10} className="text-proton-accent/70" />
                            {formatTimeAgo(item.timestamp)}
                          </span>
                          {item.targetView && (
                            <span className="text-proton-accent uppercase font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                              <span>{language === 'ka' ? 'გახსნა' : 'Open'}</span>
                              <ChevronRight size={10} />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete Item Action */}
                      <button
                        type="button"
                        onClick={(e) => deleteNotification(item.id, e)}
                        className="absolute right-2.5 top-2.5 p-1 rounded-lg text-proton-muted hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-proton-accent focus-visible:outline-none"
                        title={language === 'ka' ? 'წაშლა' : 'Delete'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer Toolbar */}
            <div className="p-3 border-t border-proton-border/50 bg-proton-bg/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="px-2.5 py-1.5 rounded-xl bg-proton-accent/10 border border-proton-accent/30 text-proton-accent hover:bg-proton-accent hover:text-proton-bg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-proton-accent focus-visible:outline-none"
                  >
                    <CheckCheck size={12} />
                    <span>{language === 'ka' ? 'ყველას წაკითხვა' : 'Mark all read'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddTestNotification}
                  className="px-2 py-1.5 rounded-xl bg-proton-bg border border-proton-border text-proton-muted hover:text-proton-accent hover:border-proton-accent/30 text-[9px] font-mono uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-proton-accent focus-visible:outline-none"
                  title={language === 'ka' ? 'ტესტური შეტყობინების დამატება' : 'Add Test Alert'}
                >
                  <Plus size={12} />
                  <span>{language === 'ka' ? 'ტესტი' : 'Test'}</span>
                </button>
              </div>

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  className="px-2.5 py-1.5 rounded-xl text-proton-muted hover:text-red-400 text-[9px] font-mono uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-proton-accent focus-visible:outline-none"
                >
                  <Trash2 size={12} />
                  <span>{language === 'ka' ? 'გასუფთავება' : 'Clear all'}</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
