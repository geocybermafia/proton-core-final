import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  ArrowUpRight,
  Image as ImageIcon,
  MessageSquare,
  Clock,
  Store,
  Palette,
  Video,
  Cpu,
  Workflow as WorkflowIcon,
  ShoppingBag,
  Compass,
  CheckSquare,
  ChevronRight,
  Sun,
  Moon,
  Sunset
} from 'lucide-react';
import { safeStorage } from '../lib/safeStorage';
import { View, Task } from '../types';
import { SystemHealthState } from '../hooks/useSystemHealth';
import { useSeller } from '../contexts/SellerContext';
import { useAuth } from '../contexts/AuthContext';
import { PERSONAS } from '../lib/gemini';
import { cn } from '../lib/utils';

export interface DashboardViewProps {
  setActiveView: (v: View) => void;
  language: 'en' | 'ka';
  setUiMode: (m: 'business' | 'creative' | 'market', targetView?: View) => void;
  systemHealth?: SystemHealthState;
}

interface RealArtifact {
  id: string;
  world: string;
  worldGe: string;
  title: string;
  subtitle: string;
  subtitleGe: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  onClick: () => void;
  timestamp?: number;
}

const isRealTask = (t: any): boolean => {
  if (!t || !t.id) return false;
  const id = String(t.id).toLowerCase();
  const content = (t.content || '').toLowerCase();
  if (
    id.includes('982145') ||
    id.includes('982146') ||
    id.startsWith('demo') ||
    id.startsWith('mock') ||
    id.startsWith('sample') ||
    content.includes('fulfill order #') ||
    content.includes('982145') ||
    content.includes('982146') ||
    t.isDemo === true ||
    t.isMock === true
  ) {
    return false;
  }
  return true;
};

const formatRelativeTime = (timestamp: number, language: 'en' | 'ka'): string => {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return language === 'ka' ? 'ახლახან' : 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return language === 'ka' ? `${diffMin} წუთის წინ` : `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return language === 'ka' ? `${diffHours} საათის წინ` : `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return language === 'ka' ? `${diffDays} დღის წინ` : `${diffDays}d ago`;
};

export const DashboardView: React.FC<DashboardViewProps> = React.memo(({ 
  setActiveView, 
  language = 'en',
  setUiMode
}) => {
  const isKa = language === 'ka';
  const { user } = useAuth();
  const { sellerOrders } = useSeller();

  // ---------------------------------------------------------------------------
  // 1. LIVING CONTEXTUAL ENVIRONMENT (REAL LOCAL TIME & ATMOSPHERE)
  // ---------------------------------------------------------------------------
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const timeEnvironment = useMemo(() => {
    try {
      const hours = currentDate.getHours();
      const timeStr = currentDate.toLocaleTimeString(isKa ? 'ka-GE' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const dayStr = currentDate.toLocaleDateString(isKa ? 'ka-GE' : 'en-US', {
        weekday: 'long'
      });
      const dateStr = currentDate.toLocaleDateString(isKa ? 'ka-GE' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      let periodLabel = isKa ? 'დღე' : 'Day';
      let PeriodIcon = Sun;
      if (hours >= 5 && hours < 12) {
        periodLabel = isKa ? 'დილა' : 'Morning';
        PeriodIcon = Sun;
      } else if (hours >= 12 && hours < 18) {
        periodLabel = isKa ? 'შუადღე' : 'Afternoon';
        PeriodIcon = Sun;
      } else if (hours >= 18 && hours < 22) {
        periodLabel = isKa ? 'საღამო' : 'Evening';
        PeriodIcon = Sunset;
      } else {
        periodLabel = isKa ? 'ღამე' : 'Night';
        PeriodIcon = Moon;
      }

      // Safe timezone detection
      let timeZoneName = 'Local';
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        timeZoneName = tz ? tz.split('/').pop()?.replace(/_/g, ' ') || 'Local' : 'Local';
      } catch {
        timeZoneName = 'Local';
      }

      return {
        timeStr,
        dayStr,
        dateStr,
        periodLabel,
        PeriodIcon,
        timeZoneName
      };
    } catch {
      return {
        timeStr: '',
        dayStr: '',
        dateStr: '',
        periodLabel: '',
        PeriodIcon: Sun,
        timeZoneName: ''
      };
    }
  }, [currentDate, isKa]);

  // ---------------------------------------------------------------------------
  // 2. DYNAMIC AUTHENTICATED USER IDENTITY
  // ---------------------------------------------------------------------------
  const userName = useMemo(() => {
    if (user?.displayName && user.displayName.trim()) {
      return user.displayName.trim();
    }
    if (user?.email) {
      const prefix = user.email.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    try {
      const profileRaw = localStorage.getItem('user-profile');
      if (profileRaw) {
        const parsed = JSON.parse(profileRaw);
        if (parsed?.name && parsed.name.trim()) return parsed.name.trim();
        if (parsed?.displayName && parsed.displayName.trim()) return parsed.displayName.trim();
      }
    } catch {
      // ignore
    }
    return isKa ? 'მეგობარო' : 'Friend';
  }, [user, isKa]);

  // ---------------------------------------------------------------------------
  // 3. RETRIEVE REAL MEANINGFUL ARTIFACTS (MAX 3 - NO FAKE DATA)
  // ---------------------------------------------------------------------------
  const realArtifacts = useMemo<RealArtifact[]>(() => {
    const items: RealArtifact[] = [];

    // 1. Real AI Conversation
    try {
      const chatHistory = safeStorage.getJSON<Record<string, Array<{ id: string; role: string; content: string; timestamp: number }>>>('proton_chat_history', {});
      let latestMessage: { personaId: string; content: string; timestamp: number } | null = null;

      for (const [personaId, messages] of Object.entries(chatHistory)) {
        if (Array.isArray(messages) && messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.content && !lastMsg.content.startsWith('⚠️')) {
            const currentTs = lastMsg.timestamp || Date.now();
            if (!latestMessage || currentTs > latestMessage.timestamp) {
              latestMessage = {
                personaId,
                content: lastMsg.content,
                timestamp: currentTs
              };
            }
          }
        }
      }

      if (latestMessage) {
        const persona = PERSONAS.find(p => p.id === latestMessage!.personaId);
        const pName = isKa ? (persona?.nameGe || persona?.name || 'AI მეგზური') : (persona?.name || 'AI Copilot');
        const snippet = latestMessage.content.replace(/\n+/g, ' ').slice(0, 55);

        items.push({
          id: `chat_${latestMessage.personaId}`,
          world: 'THINK',
          worldGe: 'აზროვნება',
          title: pName,
          subtitle: `${formatRelativeTime(latestMessage.timestamp, language)} · ${snippet}...`,
          subtitleGe: `${formatRelativeTime(latestMessage.timestamp, language)} · ${snippet}...`,
          icon: MessageSquare,
          accentColor: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10',
          onClick: () => {
            setUiMode('business', 'personas');
            setActiveView('personas');
          },
          timestamp: latestMessage.timestamp
        });
      }
    } catch {
      // ignore
    }

    // 2. Real Created Visual Artwork
    try {
      const imageHistory = safeStorage.getJSON<Array<{ id: string; prompt: string; url?: string; timestamp?: number }>>('proton_image_history', []);
      if (Array.isArray(imageHistory) && imageHistory.length > 0) {
        const latestImg = imageHistory[imageHistory.length - 1];
        if (latestImg && (latestImg.prompt || latestImg.url)) {
          const promptText = (latestImg.prompt || 'Generated Artwork').slice(0, 48);
          items.push({
            id: `image_${latestImg.id || 'last'}`,
            world: 'CREATE',
            worldGe: 'შექმნა',
            title: promptText,
            subtitle: latestImg.timestamp ? formatRelativeTime(latestImg.timestamp, language) : 'Visual Art',
            subtitleGe: latestImg.timestamp ? formatRelativeTime(latestImg.timestamp, language) : 'ვიზუალური ნამუშევარი',
            icon: ImageIcon,
            accentColor: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10',
            onClick: () => {
              setUiMode('creative', 'image');
              setActiveView('image');
            },
            timestamp: latestImg.timestamp || Date.now()
          });
        }
      }
    } catch {
      // ignore
    }

    // 3. Real Market Unfinished Draft
    try {
      const draftRaw = localStorage.getItem('proton_markethub_draft_form_data');
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        if (parsed?.data) {
          const title = parsed.data.title || parsed.data.titleGe;
          if (title && title.trim()) {
            items.push({
              id: 'market_draft',
              world: 'SELL',
              worldGe: 'გაყიდვა',
              title: title.trim(),
              subtitle: parsed.data.price ? `$${parsed.data.price} · Unsaved Draft` : 'Draft ready to publish',
              subtitleGe: parsed.data.price ? `$${parsed.data.price} · შენახული მონახაზი` : 'მზადაა გამოსაქვეყნებლად',
              icon: Store,
              accentColor: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
              onClick: () => {
                setUiMode('market', 'market-hub');
                setActiveView('market-hub');
              },
              timestamp: parsed.updatedAt || Date.now()
            });
          }
        }
      }
    } catch {
      // ignore
    }

    // 4. Real Active Task
    try {
      const rawTasks = safeStorage.getJSON<Task[]>('proton_tasks', []);
      const pendingTasks = Array.isArray(rawTasks) ? rawTasks.filter(t => isRealTask(t) && !t.completed) : [];
      if (pendingTasks.length > 0) {
        const firstTask = pendingTasks[0];
        items.push({
          id: `task_${firstTask.id}`,
          world: 'BUILD',
          worldGe: 'მშენებლობა',
          title: (isKa && firstTask.contentGe) ? firstTask.contentGe : firstTask.content,
          subtitle: firstTask.category ? `${firstTask.category} · Active` : 'In Progress',
          subtitleGe: firstTask.category ? `${firstTask.category} · მიმდინარე` : 'აქტიური',
          icon: CheckSquare,
          accentColor: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
          onClick: () => {
            setUiMode('business', 'organizer');
            setActiveView('organizer');
          },
          timestamp: firstTask.timestamp || Date.now()
        });
      }
    } catch {
      // ignore
    }

    // 5. Real Store Order
    try {
      if (Array.isArray(sellerOrders) && sellerOrders.length > 0) {
        const pendingOrder = sellerOrders.find(o => o.status === 'pending' || o.status === 'booked');
        if (pendingOrder) {
          items.push({
            id: `order_${pendingOrder.id}`,
            world: 'SELL',
            worldGe: 'გაყიდვა',
            title: pendingOrder.itemTitle || `Order #${pendingOrder.id.slice(0, 6)}`,
            subtitle: `$${pendingOrder.amount} · Pending`,
            subtitleGe: `$${pendingOrder.amount} · დასამუშავებელი`,
            icon: ShoppingBag,
            accentColor: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
            onClick: () => {
              setUiMode('market', 'market-hub');
              setActiveView('market-hub');
            },
            timestamp: pendingOrder.createdAt || Date.now()
          });
        }
      }
    } catch {
      // ignore
    }

    return items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 3);
  }, [language, isKa, sellerOrders, setActiveView, setUiMode]);

  // ---------------------------------------------------------------------------
  // 4. PROTON WORLDS (6 PILLARS OF THE DIGITAL ECOSYSTEM)
  // ---------------------------------------------------------------------------
  const worlds = useMemo(() => [
    {
      id: 'create',
      tag: 'CREATE',
      tagGe: 'შექმნა',
      title: isKa ? 'კრეატიული სტუდია' : 'Creative Studio',
      lead: isKa ? 'ვიზუალური ხელოვნება & გენერაცია' : 'Visual Artwork & Generation',
      desc: isKa 
        ? 'უმაღლესი რეზოლუციის AI ილუსტრაციები, ციფრული ფერწერის გენერაცია და შემოქმედებითი დიზაინი.'
        : 'High-resolution AI art generation, digital painting, and spatial creative composition.',
      icon: Palette,
      accentStyle: 'from-cyan-500/20 to-transparent border-cyan-500/30 text-cyan-400 group-hover:border-cyan-400/60',
      tagBadge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      action: () => {
        setUiMode('creative', 'creative-studio');
        setActiveView('creative-studio');
      }
    },
    {
      id: 'think',
      tag: 'THINK',
      tagGe: 'აზროვნება',
      title: isKa ? 'AI პერსონები' : 'AI Personas',
      lead: isKa ? 'ინტელექტუალური მრჩევლები' : 'Cognitive Intelligence & Copilots',
      desc: isKa 
        ? 'სპეციალიზებული ქართული და საერთაშორისო AI პერსონები, ბიზნეს სტრატეგია და ლინგვისტიკა.'
        : 'Specialized Georgian & international AI copilots for deep strategy, reasoning, and linguistics.',
      icon: Sparkles,
      accentStyle: 'from-indigo-500/20 to-transparent border-indigo-500/30 text-indigo-400 group-hover:border-indigo-400/60',
      tagBadge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
      action: () => {
        setUiMode('business', 'personas');
        setActiveView('personas');
      }
    },
    {
      id: 'build',
      tag: 'BUILD',
      tagGe: 'მშენებლობა',
      title: isKa ? 'პროცესები & არქიტექტურა' : 'Workflows & Architecture',
      lead: isKa ? 'ვიზუალური სამუშაო ნაკადები' : 'Visual Logic & Project Nodes',
      desc: isKa 
        ? 'ავტომატიზაციის მოდულური არქიტექტურა, ამოცანების ორგანიზება და სტრუქტურირებული სისტემები.'
        : 'Visual automation nodes, modular execution blueprints, and project orchestration.',
      icon: WorkflowIcon,
      accentStyle: 'from-purple-500/20 to-transparent border-purple-500/30 text-purple-400 group-hover:border-purple-400/60',
      tagBadge: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      action: () => {
        setUiMode('business', 'blueprints');
        setActiveView('blueprints');
      }
    },
    {
      id: 'sell',
      tag: 'SELL',
      tagGe: 'გაყიდვა',
      title: isKa ? 'მარკეტი & კომერცია' : 'Market & Store',
      lead: isKa ? 'ციფრული პროდუქტების ეკოსისტემა' : 'Digital Storefront & Commerce',
      desc: isKa 
        ? 'უნიკალური ციფრული აქტივების ვიტრინა, ავტონომიური გაყიდვები და შეკვეთების მიღება.'
        : 'Digital products showcase, merchant storefronts, and seamless commercial transactions.',
      icon: Store,
      accentStyle: 'from-amber-500/20 to-transparent border-amber-500/30 text-amber-400 group-hover:border-amber-400/60',
      tagBadge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      action: () => {
        setUiMode('market', 'market-hub');
        setActiveView('market-hub');
      }
    },
    {
      id: 'clips',
      tag: 'CLIPS',
      tagGe: 'კლიპები',
      title: isKa ? 'ვიდეო & მოძრაობა' : 'Clips & Motion',
      lead: isKa ? 'მოკლე ვიდეო შემოქმედება' : 'Short-form Social Creation',
      desc: isKa 
        ? 'დინამიკური ვიდეო კონტენტის აღმოჩენა, ვიზუალური რიტმი და მულტიმედია პრეზენტაცია.'
        : 'Discover dynamic short clips, motion storytelling, and immersive visual creations.',
      icon: Video,
      accentStyle: 'from-rose-500/20 to-transparent border-rose-500/30 text-rose-400 group-hover:border-rose-400/60',
      tagBadge: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      action: () => {
        setUiMode('market', 'clips');
        setActiveView('clips');
      }
    },
    {
      id: 'own',
      tag: 'OWN',
      tagGe: 'მფლობელობა',
      title: isKa ? 'Web3 & სუვერენიტეტი' : 'Web3 & Sovereign Assets',
      lead: isKa ? 'დეცენტრალიზებული ფინანსები' : 'Decentralized Digital Custody',
      desc: isKa 
        ? 'დეცენტრალიზებული საფულეები, სმარტ-კონტრაქტები და სრული კონტროლი პირად აქტივებზე.'
        : 'Decentralized wallet connectivity, smart contract interactions, and self-custody assets.',
      icon: Cpu,
      accentStyle: 'from-emerald-500/20 to-transparent border-emerald-500/30 text-emerald-400 group-hover:border-emerald-400/60',
      tagBadge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      action: () => {
        setActiveView('finance');
      }
    }
  ], [isKa, setActiveView, setUiMode]);

  return (
    <div className="w-full min-h-screen pb-24 text-proton-text select-none animate-in fade-in duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 space-y-12 sm:space-y-16">

        {/* ========================================================================= */}
        {/* 1. CINEMATIC EDITORIAL HERO: WELCOME TO YOUR DIGITAL HOME                 */}
        {/* ========================================================================= */}
        <header className="relative pt-8 sm:pt-14 pb-4">
          {/* Subtle Ambient Radial Lighting */}
          <div className="absolute -top-10 left-1/3 -translate-x-1/2 w-[32rem] h-[32rem] bg-gradient-to-br from-proton-accent/15 via-indigo-600/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10 opacity-70" />
          <div className="absolute top-10 right-0 w-96 h-96 bg-gradient-to-bl from-cyan-500/10 via-purple-600/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10 opacity-40" />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            {/* Left: Atmospheric Personal Identity Statement */}
            <div className="space-y-4 max-w-3xl">
              {/* Refined Brand Symbol */}
              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-zinc-300 text-xs font-mono font-medium tracking-widest uppercase backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-proton-accent animate-pulse" />
                <span className="text-white font-bold">PROTON</span>
                <span className="text-zinc-400">·</span>
                <span className="text-zinc-300">{isKa ? 'ციფრული სახლი' : 'Digital Home'}</span>
              </div>

              {/* Dynamic Emotional Welcome Typography */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08]">
                {isKa ? (
                  <>
                    კეთილი იყოს შენი მობრძანება,{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
                      {userName}
                    </span>.
                  </>
                ) : (
                  <>
                    Welcome home,{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
                      {userName}
                    </span>.
                  </>
                )}
              </h1>

              {/* Essence Tagline */}
              <p className="text-lg sm:text-xl md:text-2xl font-light text-zinc-300 tracking-tight leading-relaxed max-w-2xl">
                {isKa ? (
                  <>
                    „შენი სივრცე. შენი იდეები.{' '}
                    <span className="text-white font-medium">შენი Proton.“</span>
                  </>
                ) : (
                  <>
                    "Your space. Your ideas.{' '}
                    <span className="text-white font-medium">Your Proton."</span>
                  </>
                )}
              </p>
            </div>

            {/* Right: Environmental Atmosphere (Real Browser Time, Date & Ambience) */}
            <div className="shrink-0 p-5 rounded-3xl bg-zinc-900/60 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col justify-between space-y-3 min-w-[240px]">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-400">
                  {isKa ? 'დრო & გარემო' : 'Environment'}
                </span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300 text-[10px] font-mono">
                  {React.createElement(timeEnvironment.PeriodIcon, { size: 12, className: 'text-proton-accent' })}
                  <span>{timeEnvironment.periodLabel}</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-wider">
                  {timeEnvironment.timeStr}
                </div>
                <div className="text-xs font-mono text-zinc-300 capitalize">
                  {timeEnvironment.dayStr} · {timeEnvironment.dateStr}
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span>{timeEnvironment.timeZoneName}</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {isKa ? 'სინქრონიზებული' : 'Live Sync'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. PROTON WORLDS — THE SPATIAL ECOSYSTEM COMPOSITION                     */}
        {/* ========================================================================= */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/5 pb-4">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-proton-accent font-mono">
                {isKa ? 'შესაძლებლობების ჰორიზონტი' : 'Proton Worlds'}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                {isKa ? 'აირჩიე შენი მიმართულება' : 'Explore the Ecosystem'}
              </h2>
            </div>
            <div className="text-xs font-mono text-zinc-400">
              {isKa ? '6 ციფრული განზომილება' : '6 Digital Dimensions'}
            </div>
          </div>

          {/* Spatial World Architecture */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {worlds.map((w) => {
              const Icon = w.icon;

              return (
                <div
                  key={w.id}
                  onClick={w.action}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      w.action();
                    }
                  }}
                  className={cn(
                    "group relative rounded-3xl p-6 sm:p-7 bg-[#0b0f19]/80 hover:bg-[#101524] border backdrop-blur-xl transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 overflow-hidden focus:outline-none focus:ring-2 focus:ring-proton-accent shadow-lg",
                    w.accentStyle
                  )}
                >
                  {/* Subtle top ambient glow inside the card */}
                  <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-white/[0.04] to-transparent rounded-full blur-2xl pointer-events-none group-hover:from-white/[0.08] transition-colors" />

                  <div className="space-y-5">
                    {/* Top Identity Bar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black font-mono tracking-widest uppercase border", w.tagBadge)}>
                          {isKa ? w.tagGe : w.tag}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400 line-clamp-1">
                          {w.lead}
                        </span>
                      </div>

                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-all shrink-0">
                        <ArrowUpRight size={16} className="transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                    </div>

                    {/* World Title & Graphic Pillar */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-white group-hover:scale-110 transition-transform">
                          <Icon size={22} className="text-white" />
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight group-hover:text-proton-accent transition-colors">
                          {w.title}
                        </h3>
                      </div>

                      <p className="text-sm text-zinc-300 font-normal leading-relaxed">
                        {w.desc}
                      </p>
                    </div>
                  </div>

                  {/* Refined Access Button Strip */}
                  <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-bold text-zinc-400 group-hover:text-white transition-colors">
                    <span className="font-mono text-[11px]">
                      {isKa ? 'შესვლა სივრცეში' : 'Enter Dimension'}
                    </span>
                    <span className="flex items-center gap-1 text-proton-accent">
                      <ChevronRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. CONTEXTUAL PRESENCE / RECENT ARTIFACTS (SHOWN ONLY IF REAL DATA)       */}
        {/* ========================================================================= */}
        {realArtifacts.length > 0 && (
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-proton-accent" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400">
                  {isKa ? 'შენი ბოლო შემოქმედება' : 'Recent Real Artifacts'}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                {isKa ? `${realArtifacts.length} ჩანაწერი` : `${realArtifacts.length} active`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {realArtifacts.map((art) => {
                const ArtIcon = art.icon;

                return (
                  <div
                    key={art.id}
                    onClick={art.onClick}
                    className="p-4 rounded-2xl bg-[#0c101c]/80 hover:bg-[#111728] border border-white/10 hover:border-proton-accent/40 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("p-2 rounded-xl border shrink-0", art.accentColor)}>
                        <ArtIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                          {isKa ? art.worldGe : art.world}
                        </div>
                        <div className="text-xs font-bold text-white truncate">
                          {art.title}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono truncate">
                          {isKa ? art.subtitleGe : art.subtitle}
                        </div>
                      </div>
                    </div>

                    <ArrowUpRight size={14} className="text-zinc-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* 4. UNDERSTATED FOOTER SIGNATURE                                           */}
        {/* ========================================================================= */}
        <footer className="pt-8 pb-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-proton-accent/80" />
            <span>PROTON SOVEREIGN OS</span>
            <span>·</span>
            <span>{isKa ? 'პერსონალური ციფრული გარემო' : 'Personal Digital Realm'}</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>v2.8</span>
            <span>·</span>
            <span>{isKa ? 'ყველა უფლება დაცულია' : 'All Rights Reserved'}</span>
          </div>
        </footer>

      </div>
    </div>
  );
});
DashboardView.displayName = 'DashboardView';
