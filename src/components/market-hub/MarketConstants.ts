import { auth } from '../../firebase';

export interface MarketTheme {
  card: string;
  input: string;
  accent: string;
  accentBg: string;
  border: string;
  muted: string;
  text: string;
  subtext: string;
  tagMuted: string;
  cardAlt: string;
  badgeBg: string;
  bgHover: string;
  overlay: string;
}

export const MARKET_THEMES: Record<string, MarketTheme> = {
  light: {
    card: "bg-white border-slate-200 shadow-xl text-slate-900",
    input: "bg-slate-50 border-slate-200 focus:border-slate-400 text-slate-900 placeholder:text-slate-400",
    accent: "text-[#2e5bff]",
    accentBg: "bg-[#2e5bff]",
    border: "border-slate-200",
    muted: "text-slate-500",
    text: "text-slate-900",
    subtext: "text-slate-600",
    tagMuted: "text-slate-400",
    cardAlt: "bg-slate-50 border border-slate-100 text-slate-800",
    badgeBg: "bg-slate-100 text-slate-800 border-slate-200/50",
    bgHover: "hover:bg-slate-100 hover:text-[#2e5bff]",
    overlay: "bg-white/90 backdrop-blur-md border border-slate-200"
  },
  proton: {
    card: "bg-[#141414] border-white/5 shadow-2xl text-white",
    input: "bg-[#0a0a0a] border-white/5 focus:border-[#2e5bff]/50 text-white placeholder:text-white/25",
    accent: "text-[#2e5bff]",
    accentBg: "bg-[#2e5bff]",
    border: "border-white/5",
    muted: "text-[#a0a0a0]",
    text: "text-white",
    subtext: "text-white/70",
    tagMuted: "text-white/45",
    cardAlt: "bg-white/5 border border-white/5 text-white",
    badgeBg: "bg-white/10 text-white border-white/10",
    bgHover: "hover:bg-white/10 hover:text-white",
    overlay: "bg-black/60 backdrop-blur-md border border-white/10"
  },
  titanium: {
    card: "bg-[#141414] border-white/10 shadow-2xl text-white",
    input: "bg-[#0a0a0a] border-white/10 focus:border-slate-400 text-white placeholder:text-white/25",
    accent: "text-slate-300",
    accentBg: "bg-slate-600",
    border: "border-white/10",
    muted: "text-[#a0a0a0]",
    text: "text-white",
    subtext: "text-white/70",
    tagMuted: "text-white/40",
    cardAlt: "bg-white/5 border border-white/10 text-white",
    badgeBg: "bg-white/10 text-white border-white/10",
    bgHover: "hover:bg-white/10 hover:text-white",
    overlay: "bg-black/60 backdrop-blur-md border border-white/10"
  },
  forest: {
    card: "bg-[#022c22]/80 border-emerald-500/20 backdrop-blur-xl shadow-2xl shadow-emerald-900/20 text-white",
    input: "bg-black/40 border-emerald-500/20 focus:border-emerald-500/50 text-white placeholder:text-white/25",
    accent: "text-emerald-400",
    accentBg: "bg-emerald-600",
    border: "border-emerald-500/20",
    muted: "text-emerald-200/50",
    text: "text-white",
    subtext: "text-emerald-200/70",
    tagMuted: "text-emerald-200/30",
    cardAlt: "bg-black/20 border border-emerald-500/10 text-emerald-100",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    bgHover: "hover:bg-emerald-500/10 hover:text-emerald-300",
    overlay: "bg-[#022c22]/80 backdrop-blur-xl border border-emerald-500/25"
  },
  sunset: {
    card: "bg-[#431407]/80 border-orange-500/20 backdrop-blur-xl shadow-2xl shadow-orange-900/20 text-white",
    input: "bg-black/40 border-orange-500/20 focus:border-orange-500/50 text-white placeholder:text-white/25",
    accent: "text-orange-400",
    accentBg: "bg-orange-600",
    border: "border-orange-500/20",
    muted: "text-orange-200/50",
    text: "text-white",
    subtext: "text-orange-200/70",
    tagMuted: "text-orange-200/30",
    cardAlt: "bg-black/20 border border-orange-500/10 text-orange-100",
    badgeBg: "bg-orange-500/10 text-orange-300 border-orange-500/20",
    bgHover: "hover:bg-orange-500/10 hover:text-orange-300",
    overlay: "bg-[#431407]/80 backdrop-blur-xl border border-orange-500/25"
  },
  rose: {
    card: "bg-[#2d0611]/80 border-rose-500/20 backdrop-blur-xl shadow-2xl shadow-rose-900/20 text-white",
    input: "bg-black/40 border-rose-500/20 focus:border-rose-500/50 text-white placeholder:text-white/25",
    accent: "text-rose-400",
    accentBg: "bg-rose-600",
    border: "border-rose-500/20",
    muted: "text-rose-200/50",
    text: "text-white",
    subtext: "text-rose-200/70",
    tagMuted: "text-rose-200/30",
    cardAlt: "bg-black/20 border border-rose-500/10 text-rose-100",
    badgeBg: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    bgHover: "hover:bg-rose-500/10 hover:text-rose-300",
    overlay: "bg-[#2d0611]/80 backdrop-blur-xl border border-rose-500/25"
  },
  vibrant: {
    card: "bg-[#1e1b4b]/80 border-purple-500/20 backdrop-blur-xl shadow-2xl shadow-purple-900/20 text-white",
    input: "bg-black/40 border-purple-500/20 focus:border-purple-500/50 text-white placeholder:text-white/25",
    accent: "text-purple-400",
    accentBg: "bg-purple-600",
    border: "border-purple-500/20",
    muted: "text-purple-200/50",
    text: "text-white",
    subtext: "text-purple-200/70",
    tagMuted: "text-purple-200/30",
    cardAlt: "bg-black/20 border border-purple-500/10 text-purple-100",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    bgHover: "hover:bg-purple-500/10 hover:text-purple-300",
    overlay: "bg-[#1e1b4b]/80 backdrop-blur-xl border border-purple-500/25"
  },
  midnight: {
    card: "bg-[#0a0a0a] border-white/5 shadow-2xl text-white",
    input: "bg-black border-white/10 focus:border-white/30 text-white placeholder:text-white/25",
    accent: "text-white",
    accentBg: "bg-zinc-800",
    border: "border-white/5",
    muted: "text-zinc-500",
    text: "text-white",
    subtext: "text-zinc-300",
    tagMuted: "text-[#666666]",
    cardAlt: "bg-zinc-900 border border-zinc-800 text-zinc-100",
    badgeBg: "bg-zinc-800 text-zinc-100 border-zinc-800",
    bgHover: "hover:bg-zinc-850 hover:text-white",
    overlay: "bg-black/80 backdrop-blur-xl border border-zinc-800"
  },
  industrial: {
    card: "bg-[#0d0d0d] border-white/10 shadow-2xl text-white",
    input: "bg-[#080808] border-white/10 focus:border-[#3b82f6]/50 text-white placeholder:text-white/25",
    accent: "text-[#3b82f6]",
    accentBg: "bg-[#3b82f6]",
    border: "border-white/10",
    muted: "text-zinc-500",
    text: "text-white",
    subtext: "text-zinc-300",
    tagMuted: "text-[#555555]",
    cardAlt: "bg-white/5 border border-white/10 text-white",
    badgeBg: "bg-white/10 text-white border-white/10",
    bgHover: "hover:bg-white/10 hover:text-white",
    overlay: "bg-black/60 backdrop-blur-md border border-white/10"
  }
};

export const PREMIUM_INDUSTRIAL: MarketTheme = {
  card: "bg-zinc-900 border border-zinc-800 shadow-[0_12px_45px_rgba(0,0,0,0.85)] text-zinc-100 backdrop-blur-2xl transition-all duration-305 hover:shadow-[#dfb257]/10 hover:border-zinc-700/80",
  input: "bg-zinc-950 border border-zinc-800 focus:border-[#dfb257]/80 text-zinc-100 placeholder:text-zinc-550 transition-all font-sans",
  accent: "text-[#dfb257]",
  accentBg: "bg-gradient-to-b from-[#dfb257] to-[#b8860b] hover:from-[#ebd083] hover:to-[#dfb257]",
  border: "border-zinc-800/80",
  muted: "text-zinc-350 font-sans tracking-wide",
  text: "text-zinc-100",
  subtext: "text-zinc-250",
  tagMuted: "text-zinc-400",
  cardAlt: "bg-[#121215] border border-zinc-800 text-zinc-200 backdrop-blur-xl",
  badgeBg: "bg-gradient-to-b from-zinc-850 to-zinc-900 border-zinc-700/90 shadow-md text-[#dfb257] font-black uppercase tracking-widest",
  bgHover: "hover:bg-zinc-800 hover:text-[#dfb257]",
  overlay: "bg-zinc-950/98 backdrop-blur-3xl border border-zinc-800 shadow-2xl"
};

export const WORLD_COUNTRIES = [
  { code: 'GLOBAL', name: 'Worldwide', flag: '🌐' },
  { code: 'USA', name: 'United States', flag: '🇺🇸' },
  { code: 'GEO', name: 'Georgia', flag: '🇬🇪' },
  { code: 'DEU', name: 'Germany', flag: '🇩🇪' },
  { code: 'CHN', name: 'China', flag: '🇨🇳' },
  { code: 'JPN', name: 'Japan', flag: '🇯🇵' },
  { code: 'GBR', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'FRA', name: 'France', flag: '🇫🇷' },
  { code: 'EST', name: 'Estonia', flag: '🇪🇪' },
  { code: 'ISR', name: 'Israel', flag: '🇮🇱' },
  { code: 'SGP', name: 'Singapore', flag: '🇸🇬' },
  { code: 'VAE', name: 'UAE', flag: '🇦🇪' },
];

export const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GEL', symbol: '₾' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CNY', symbol: '¥' },
];

export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GEL: 2.70,
  GBP: 0.79,
  JPY: 156.4,
  CNY: 7.24,
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const CATEGORY_EMOJIS: Record<string, string> = {
  service: "⚡",
  rent: "🔑",
  garden: "🏡",
  home: "🏡",
  "family-technic": "🔌",
  technics: "💻",
  hunting: "🏹",
  music: "🎸",
  kids: "🧸",
  fashion: "💄",
  building: "🔨",
  village: "🚜",
  animals: "🐾",
  sport: "⚽",
  business: "💼",
  book: "📚",
  art: "🎨",
  hobby: "🎨",
  realestate: "🏢",
  auto: "🚗",
  crypto: "🪙"
};

export const convertPrice = (price: number, from: string, to: string) => {
  if (from === to) return price;
  const inUSD = price / (EXCHANGE_RATES[from] || 1);
  return inUSD * (EXCHANGE_RATES[to] || 1);
};

export const safeParseDate = (dateVal: any): number => {
  if (!dateVal) return Date.now();
  try {
    if (typeof dateVal === 'object') {
      if (typeof dateVal.toDate === 'function') {
        const d = dateVal.toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : Date.now();
      }
      if (typeof dateVal.seconds === 'number') {
        return dateVal.seconds * 1000 + (dateVal.nanoseconds ? Math.floor(dateVal.nanoseconds / 1000000) : 0);
      }
    }
    const d = new Date(dateVal);
    const ms = d.getTime();
    return isNaN(ms) ? Date.now() : ms;
  } catch (e) {
    console.error("Error parsing date:", e);
    return Date.now();
  }
};
