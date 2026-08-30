import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowUpRight,
  Image as ImageIcon,
  MessageSquare,
  Sun,
  Moon,
  Sunset,
  Sparkles,
  Palette,
  Workflow as WorkflowIcon,
  Store,
  Compass,
  CornerDownRight
} from 'lucide-react';
import { safeStorage } from '../lib/safeStorage';
import { View, Task } from '../types';
import { SystemHealthState } from '../hooks/useSystemHealth';
import { useSeller } from '../contexts/SellerContext';
import { useAuth } from '../contexts/AuthContext';
import { PERSONAS } from '../lib/gemini';

export interface DashboardViewProps {
  setActiveView: (v: View) => void;
  language: 'en' | 'ka';
  setUiMode: (m: 'business' | 'creative' | 'market', targetView?: View) => void;
  systemHealth?: SystemHealthState;
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
  if (diffMin < 60) return language === 'ka' ? `${diffMin} წთ წინ` : `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return language === 'ka' ? `${diffHours} სთ წინ` : `${diffHours}h ago`;
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
  // 1. ENVIRONMENTAL TIME & ATMOSPHERE (CALM 30s TICK)
  // ---------------------------------------------------------------------------
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 30000);
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
        month: 'long'
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

      return {
        timeStr,
        dayStr,
        dateStr,
        periodLabel,
        PeriodIcon
      };
    } catch {
      return {
        timeStr: '',
        dayStr: '',
        dateStr: '',
        periodLabel: '',
        PeriodIcon: Sun
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
  // 3. REAL USER ARTIFACTS (SECONDARY LIVING ARTIFACTS, 0 FAKE DATA)
  // ---------------------------------------------------------------------------
  const latestImage = useMemo(() => {
    try {
      const imageHistory = safeStorage.getJSON<Array<{ id: string; prompt: string; url?: string; timestamp?: number }>>('proton_image_history', []);
      if (Array.isArray(imageHistory) && imageHistory.length > 0) {
        const last = imageHistory[imageHistory.length - 1];
        if (last && (last.prompt || last.url)) {
          return {
            prompt: last.prompt?.slice(0, 48) || 'Recent Visual Creation',
            time: last.timestamp ? formatRelativeTime(last.timestamp, language) : ''
          };
        }
      }
    } catch {
      // ignore
    }
    return null;
  }, [language]);

  const latestChat = useMemo(() => {
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
        const pName = isKa ? (persona?.nameGe || persona?.name || 'AI Copilot') : (persona?.name || 'AI Copilot');
        return {
          personaName: pName,
          snippet: latestMessage.content.replace(/\n+/g, ' ').slice(0, 50),
          time: formatRelativeTime(latestMessage.timestamp, language)
        };
      }
    } catch {
      // ignore
    }
    return null;
  }, [language, isKa]);

  const hasAnyArtifacts = Boolean(latestImage || latestChat);

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex flex-col justify-between py-6 sm:py-10 px-4 sm:px-8 lg:px-14 select-none animate-in fade-in duration-300">
      <div className="max-w-[1280px] w-full mx-auto space-y-12 sm:space-y-16">

        {/* ========================================================================= */}
        {/* 1. TOP SANCTUARY BAR (IDENTITY & CALM ENVIRONMENT)                         */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-500/5 border border-amber-400/30 flex items-center justify-center text-amber-400 font-mono text-xs font-black shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              P
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="font-bold text-white tracking-widest">PROTON</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-400">{isKa ? 'ციფრული სახლი' : 'Digital Home'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-zinc-300">
              {React.createElement(timeEnvironment.PeriodIcon, { size: 14, className: "text-amber-400" })}
              <span className="text-white font-bold">{timeEnvironment.timeStr}</span>
              <span className="text-zinc-600 hidden sm:inline">·</span>
              <span className="hidden sm:inline text-zinc-400 capitalize">{timeEnvironment.dayStr}, {timeEnvironment.dateStr}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. THE LIVING SANCTUARY HERO (CENTRAL VISUAL COMPOSITION)                  */}
        {/* ========================================================================= */}
        <div className="relative pt-4 sm:pt-8 pb-4 text-center sm:text-left space-y-8">
          
          {/* Subtle Ambient Radial Lighting Behind Welcome */}
          <div className="absolute top-1/2 left-1/2 sm:left-1/4 -translate-x-1/2 -translate-y-1/2 w-[380px] sm:w-[600px] h-[240px] bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-cyan-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

          {/* Emotional Welcome Statement */}
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-amber-300/90 text-xs font-mono tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>{isKa ? 'ეს შენი პირადი სივრცეა' : 'This is your private space'}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
              {isKa ? (
                <>
                  კეთილი იყოს შენი მობრძანება,<br className="hidden sm:inline" />{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-100 to-zinc-400">
                    {userName}
                  </span>.
                </>
              ) : (
                <>
                  Welcome home,<br className="hidden sm:inline" />{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-100 to-zinc-400">
                    {userName}
                  </span>.
                </>
              )}
            </h1>

            <p className="text-base sm:text-xl text-zinc-400 font-light max-w-2xl leading-relaxed">
              {isKa 
                ? 'შენი იდეები, შენი ინტელექტი, შენი დამოუკიდებელი ციფრული გარემო.' 
                : 'Your ideas, your creative sanctuary, your sovereign digital home.'}
            </p>
          </div>

          {/* ======================================================================= */}
          {/* 3. REFINED DIRECT DOORWAYS (QUIET INGRESS INTO PROTON)                  */}
          {/* ======================================================================= */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl">
            
            {/* Create Doorway */}
            <button
              type="button"
              onClick={() => {
                setUiMode('creative', 'creative-studio');
                setActiveView('creative-studio');
              }}
              className="group p-4 sm:p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-cyan-500/40 transition-all duration-200 text-left flex items-start justify-between focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
              <div className="space-y-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 inline-block">
                  <Palette size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {isKa ? 'შექმნა' : 'Creation Studio'}
                  </div>
                  <div className="text-xs text-zinc-400 font-mono">
                    {isKa ? 'ვიზუალური ხელოვნება' : 'Visual Studio'}
                  </div>
                </div>
              </div>
              <ArrowUpRight size={16} className="text-zinc-600 group-hover:text-cyan-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </button>

            {/* Think Doorway */}
            <button
              type="button"
              onClick={() => {
                setUiMode('business', 'personas');
                setActiveView('personas');
              }}
              className="group p-4 sm:p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-indigo-500/40 transition-all duration-200 text-left flex items-start justify-between focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <div className="space-y-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 inline-block">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {isKa ? 'ინტელექტი' : 'AI Copilots'}
                  </div>
                  <div className="text-xs text-zinc-400 font-mono">
                    {isKa ? 'სტრატეგია & დიალოგი' : 'Cognitive reasoning'}
                  </div>
                </div>
              </div>
              <ArrowUpRight size={16} className="text-zinc-600 group-hover:text-indigo-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </button>

            {/* Build Doorway */}
            <button
              type="button"
              onClick={() => {
                setUiMode('business', 'blueprints');
                setActiveView('blueprints');
              }}
              className="group p-4 sm:p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-purple-500/40 transition-all duration-200 text-left flex items-start justify-between focus:outline-none focus:ring-1 focus:ring-purple-400"
            >
              <div className="space-y-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 inline-block">
                  <WorkflowIcon size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                    {isKa ? 'არქიტექტურა' : 'Architecture'}
                  </div>
                  <div className="text-xs text-zinc-400 font-mono">
                    {isKa ? 'ავტომატიზაცია' : 'Logic workflows'}
                  </div>
                </div>
              </div>
              <ArrowUpRight size={16} className="text-zinc-600 group-hover:text-purple-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </button>

            {/* Market Doorway */}
            <button
              type="button"
              onClick={() => {
                setUiMode('market', 'market-hub');
                setActiveView('market-hub');
              }}
              className="group p-4 sm:p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-amber-500/40 transition-all duration-200 text-left flex items-start justify-between focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <div className="space-y-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 inline-block">
                  <Store size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    {isKa ? 'მარკეტი' : 'Storefront'}
                  </div>
                  <div className="text-xs text-zinc-400 font-mono">
                    {isKa ? 'პროდუქტები & ვაჭრობა' : 'Commerce hub'}
                  </div>
                </div>
              </div>
              <ArrowUpRight size={16} className="text-zinc-600 group-hover:text-amber-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </button>

          </div>

          {/* ======================================================================= */}
          {/* 4. LIVING ARTIFACTS (SHOWN ONLY WHEN GENUINE USER ARTIFACTS EXIST)       */}
          {/* ======================================================================= */}
          {hasAnyArtifacts && (
            <div className="pt-4 border-t border-white/5 space-y-3 max-w-4xl">
              <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-400">
                {isKa ? 'ბოლო შემოქმედებითი კვალი' : 'Recent Living Traces'}
              </div>
              <div className="flex flex-wrap gap-3">
                {latestImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setUiMode('creative', 'creative-studio');
                      setActiveView('creative-studio');
                    }}
                    className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/40 text-xs text-zinc-300 hover:text-white transition-colors"
                  >
                    <ImageIcon size={14} className="text-cyan-400 shrink-0" />
                    <span className="truncate max-w-[220px] sm:max-w-[320px]">„{latestImage.prompt}“</span>
                    {latestImage.time && <span className="text-zinc-400 font-mono text-[10px]">· {latestImage.time}</span>}
                  </button>
                )}
                {latestChat && (
                  <button
                    type="button"
                    onClick={() => {
                      setUiMode('business', 'personas');
                      setActiveView('personas');
                    }}
                    className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/40 text-xs text-zinc-300 hover:text-white transition-colors"
                  >
                    <MessageSquare size={14} className="text-indigo-400 shrink-0" />
                    <span className="font-bold text-indigo-300">{latestChat.personaName}:</span>
                    <span className="truncate max-w-[200px] sm:max-w-[280px]">„{latestChat.snippet}“</span>
                    {latestChat.time && <span className="text-zinc-400 font-mono text-[10px]">· {latestChat.time}</span>}
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 5. MINIMAL SOVEREIGN SIGNATURE                                            */}
      {/* ========================================================================= */}
      <footer className="max-w-[1280px] w-full mx-auto pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
          <span className="text-zinc-400 font-medium">PROTON SOVEREIGN OS</span>
          <span className="text-zinc-600">·</span>
          <span>{isKa ? 'სრული ციფრული სუვერენიტეტი' : 'Digital Sovereignty'}</span>
        </div>
        <div className="text-[11px] text-zinc-400">
          v2.9 · {isKa ? 'პირადი გარემო' : 'Private Sanctuary'}
        </div>
      </footer>
    </div>
  );
});
DashboardView.displayName = 'DashboardView';
