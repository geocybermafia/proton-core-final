import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ShoppingBag, 
  ShoppingCart,
  MessageCircle, 
  MapPin, 
  Tag, 
  ChevronRight, 
  ShieldCheck,
  Star,
  Plus,
  Trash2,
  Edit3,
  X,
  LayoutGrid,
  User,
  ArrowLeft,
  ArrowRight,
  Link,
  Camera,
  Heart,
  Mail,
  LayoutDashboard,
  ChevronDown,
  Loader2,
  Globe,
  Coins,
  Sparkles,
  Zap
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  getDocs,
  deleteDoc, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  serverTimestamp,
  limit 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { cn } from '../lib/utils';
import { Listing } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useMarketHub } from '../contexts/MarketHubContext';
import { LegalView } from './LegalView';
import { generateTechSpec } from '../services/geminiService';
import { ListingMap } from './ListingMap';
import { MapPicker } from './MapPicker';
import { translations } from '../translations';
import 'leaflet/dist/leaflet.css';

interface MarketHubProps {
  language: 'en' | 'ka';
  t?: any;
  themeId?: string;
  onBack?: () => void;
}

interface MarketTheme {
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

const MARKET_THEMES: Record<string, MarketTheme> = {
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

const PREMIUM_INDUSTRIAL: MarketTheme = {
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

const WORLD_COUNTRIES = [
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

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GEL', symbol: '₾' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CNY', symbol: '¥' },
];

const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GEL: 2.70,
  GBP: 0.79,
  JPY: 156.4,
  CNY: 7.24,
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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

const CATEGORY_EMOJIS: Record<string, string> = {
  service: "⚡",
  rent: "🔑",
  garden: "🏡",
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
  art: "🎨"
};

const convertPrice = (price: number, from: string, to: string) => {
  if (from === to) return price;
  const inUSD = price / (EXCHANGE_RATES[from] || 1);
  return inUSD * (EXCHANGE_RATES[to] || 1);
};

const safeParseDate = (dateVal: any): number => {
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

interface FastInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onCommit: (val: string | any) => void;
}

const FastInput = React.forwardRef<HTMLInputElement, FastInputProps>(({ value, onCommit, ...props }, ref) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVal !== value) {
        onCommit(localVal);
      }
    }, 150); // Fast 150ms state commit to minimize lag completely while capturing fast typing batches
    return () => clearTimeout(timer);
  }, [localVal, value, onCommit]);

  return (
    <input
      ref={ref}
      {...props}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={() => {
        if (localVal !== value) {
          onCommit(localVal);
        }
      }}
    />
  );
});

interface FastTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onCommit: (val: string | any) => void;
}

const FastTextarea = React.forwardRef<HTMLTextAreaElement, FastTextareaProps>(({ value, onCommit, ...props }, ref) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localVal !== value) {
        onCommit(localVal);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [localVal, value, onCommit]);

  return (
    <textarea
      ref={ref}
      {...props}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={() => {
        if (localVal !== value) {
          onCommit(localVal);
        }
      }}
    />
  );
});

export const MarketHub = React.memo(function MarketHub({ language, t: propT, themeId: propThemeId, onBack }: MarketHubProps) {
  const t = propT || translations[language];
  const themeId = propThemeId || 'proton';
  const { user, loading: authLoading } = useAuth();
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (aiAbortControllerRef.current) {
        aiAbortControllerRef.current.abort();
      }
    };
  }, []);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('proton_market_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('proton_market_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error(e);
    }
  }, [favorites]);

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const [activeBottomTab, setActiveBottomTab] = useState<'home' | 'categories' | 'messages'>('home');

  const [search, setSearch] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('search') || '';
    } catch {
      return '';
    }
  });

  const [searchRaw, setSearchRaw] = useState(search);

  // Keep searchRaw in sync if search changes externally (e.g. from popstate)
  useEffect(() => {
    setSearchRaw(search);
  }, [search]);

  // Debounce searchRaw changes to the functional search state (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchRaw);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchRaw]);

  // Sync from URL search input if URL changes externally (e.g. back button / direct link)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        setSearch(params.get('search') || '');
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync to URL search params when search state changes (debounced for input performance)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const current = params.get('search') || '';
        if (search !== current) {
          if (search) {
            params.set('search', search);
          } else {
            params.delete('search');
          }
          const newSearch = params.toString();
          const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
          window.history.replaceState(null, '', newPath);
        }
      } catch (e) {
        console.error(e);
      }
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [search]);

  const [sortBy, setSortBy] = useState<'rating' | 'newest' | 'priceAsc' | 'priceDesc'>('rating');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeCountry, setActiveCountry] = useState('GLOBAL');
  const [activeCity, setActiveCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [activeListingType, setActiveListingType] = useState<'all' | 'product' | 'service' | 'project'>('all');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [allUserMessages, setAllUserMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // Check if on Chat Tab (Tab 5 mapping representing the messages view)
    const activeTab = activeBottomTab === 'messages' ? 5 : 0;
    if (activeTab !== 5) return;

    const q = query(
      collection(db, 'market_messages'),
      where('participants', 'array-contains', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllUserMessages(msgs);
    }, (err) => {
      console.error("Error reading all market messages:", err);
    });
    return () => unsubscribe();
  }, [user, activeBottomTab]);

  const groupedChats = useMemo(() => {
    if (!user) return [];
    const relevantMsgs = allUserMessages.filter(msg => {
      const lst = listings.find(l => l.id === msg.listingId);
      const isSeller = lst && lst.sellerId === user.uid;
      const isBuyer = msg.senderId === user.uid;
      return isSeller || isBuyer;
    });

    const groups: Record<string, { listingId: string; listingTitle: string; lastMessage: string; lastTime: any; messages: any[] }> = {};
    relevantMsgs.forEach(msg => {
      const lid = msg.listingId;
      if (!groups[lid]) {
        groups[lid] = {
          listingId: lid,
          listingTitle: msg.listingTitle || 'Unknown Listing',
          lastMessage: '',
          lastTime: null,
          messages: []
        };
      }
      groups[lid].messages.push(msg);
    });

    return Object.values(groups).map(g => {
      g.messages.sort((a, b) => safeParseDate(a.createdAt) - safeParseDate(b.createdAt));
      const last = g.messages[g.messages.length - 1];
      g.lastMessage = last ? last.text : '';
      g.lastTime = last ? last.createdAt : null;
      return g;
    }).sort((a, b) => safeParseDate(b.lastTime) - safeParseDate(a.lastTime));
  }, [allUserMessages, listings, user]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'browse' | 'my-listings' | 'create' | 'edit' | 'privacy' | 'terms'>('browse');
  const [checkoutItem, setCheckoutItem] = useState<Listing | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [displayMode, setDisplayMode] = useState<'grid' | 'map'>('grid');
  const [buyerInstructions, setBuyerInstructions] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeSellingTab, setActiveSellingTab] = useState<'listings' | 'incoming-orders'>('listings');

  // Unified Loading Spin Gate to completely seal Cold Boot hydration flickering
  if (authLoading) {
    return (
      <div className="min-h-[600px] bg-[#070708] rounded-[36px] border border-white/5 flex flex-col items-center justify-center p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-[#dfb257]/[0.02] blur-[120px] pointer-events-none rounded-full" />
        <div className="flex flex-col items-center gap-5 relative z-10">
          <Loader2 className="w-12 h-12 animate-spin text-[#dfb257] opacity-80" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#dfb257]/90 animate-pulse">
            {language === 'ka' ? 'ავტორიზაცია მოწმდება...' : 'Verifying Identity...'}
          </p>
        </div>
      </div>
    );
  }

  // Shopping Cart state
  const [cart, setCart] = useState<Listing[]>(() => {
    try {
      const saved = localStorage.getItem('proton_market_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPlacingCartOrders, setIsPlacingCartOrders] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('proton_market_cart', JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

  const handleAddToCart = (listing: Listing) => {
    if (!user) {
      alert(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია კალათაში დასამატებლად." : "Please sign in to add items to your cart.");
      return;
    }

    const isOwnListing = listing.sellerId === user.uid;

    if (isOwnListing) {
      alert(language === 'ka' ? "თქვენ არ შეგიძლიათ საკუთარი ნივთის ყიდვა." : "You cannot buy your own item.");
      return;
    }

    if (listing.status === 'sold' || listing.isSold) {
      alert(language === 'ka' ? "ეს ნივთი უკვე გაყიდულია." : "This item is already sold.");
      return;
    }
    setCart((prev) => {
      const exists = prev.some((item) => item.id === listing.id);
      if (exists) {
        alert(language === 'ka' ? "ეს ნივთი უკვე დამატებულია კალათაში!" : "This item is already in your cart!");
        return prev;
      }
      return [...prev, listing];
    });
  };

  const handleRemoveFromCart = (listingId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== listingId));
  };

  const handleCartCheckout = async () => {
    if (!user || cart.length === 0) return;
    setIsPlacingCartOrders(true);
    try {
      for (const item of cart) {
        let freshPrice = item.price;
        let freshCurrency = item.currency || 'USD';
        let freshTitle = item.title;
        let isSold = false;

        if (isSupabaseConfigured()) {
          const { data: freshList, error } = await supabase
            .from('listings')
            .select('*')
            .eq('id', item.id)
            .maybeSingle();

          if (error || !freshList) {
            alert(language === 'ka' 
              ? `პროდუქტი "${item.title}" აღარ არის ხელმისაწვდომი.` 
              : `Product "${item.title}" is no longer available.`);
            setIsPlacingCartOrders(false);
            return;
          }
          if (freshList.status === 'sold' || freshList.isSold) {
            isSold = true;
          }
          freshPrice = freshList.price;
          freshCurrency = freshList.currency || 'USD';
          freshTitle = freshList.title || item.title;
        } else {
          const docRef = doc(db, 'listings', item.id);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            alert(language === 'ka' 
              ? `პროდუქტი "${item.title}" აღარ არსებობს ბაზაში.` 
              : `Product "${item.title}" no longer exists in our database.`);
            setIsPlacingCartOrders(false);
            return;
          }
          const freshData = docSnap.data();
          if (freshData.status === 'sold' || freshData.isSold) {
            isSold = true;
          }
          freshPrice = freshData.price;
          freshCurrency = freshData.currency || 'USD';
          freshTitle = freshData.title || item.title;
        }

        if (isSold) {
          alert(language === 'ka'
            ? `შეცდომა: პროდუქტი "${freshTitle}" უკვე გაყიდულია და მისი შეძენა შეუძლებელია.`
            : `Error: Product "${freshTitle}" has already been sold and cannot be purchased.`);
          setIsPlacingCartOrders(false);
          return;
        }

        const isService = item.listingType === 'service' || item.category === 'service';
        const orderData = {
          listingId: item.id,
          buyerId: user.uid,
          sellerId: item.sellerId,
          amount: freshPrice,
          currency: freshCurrency,
          itemTitle: freshTitle,
          status: isService ? 'booked' : 'completed',
          orderType: isService ? 'service' : 'product',
          buyerInstructions: '',
          createdAt: Date.now()
        };

        if (isSupabaseConfigured()) {
          const { error } = await supabase.from('orders').insert([orderData]);
          if (error) {
            console.error("[SUPABASE ERROR] Cart Checkout transaction failed:", error);
          } else if (!isService) {
            const { error: updateErr } = await supabase
              .from('listings')
              .update({ status: 'sold', isSold: true })
              .eq('id', item.id);
            if (updateErr) console.error("[SUPABASE ERROR] Failed to update listing status:", updateErr);
          }
        } else {
          await addDoc(collection(db, 'orders'), {
            ...orderData,
            createdAt: serverTimestamp()
          });
          if (!isService) {
            await updateDoc(doc(db, 'listings', item.id), {
              status: 'sold',
              isSold: true
            });
          }
        }
      }
      setCart([]);
      setIsCartOpen(false);
      setViewMode('my-listings');
      setProfileSubMode('buying');
    } catch (err) {
      console.error("Cart checkout error:", err);
      alert(language === 'ka' ? "შეკვეთისას მოხდა შეცდომა." : "Error processing cart purchase.");
    } finally {
      setIsPlacingCartOrders(false);
    }
  };

  useEffect(() => {
    let originalTitle = t.market.seo_title || "PROTON — პროფესიონალური ეკოსისტემა";
    let originalMetaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

    if (checkoutItem) {
      const activeTitle = language === 'ka' ? (checkoutItem.titleGe || checkoutItem.title) : checkoutItem.title;
      const activeDesc = language === 'ka' ? (checkoutItem.descriptionGe || checkoutItem.description) : checkoutItem.description;
      document.title = `${activeTitle} | ${language === 'ka' ? 'მარკეტი' : 'Market'} — PROTON`;
      
      let metaDescNode = document.querySelector('meta[name="description"]');
      if (!metaDescNode) {
        metaDescNode = document.createElement('meta');
        metaDescNode.setAttribute('name', 'description');
        document.head.appendChild(metaDescNode);
      }
      metaDescNode.setAttribute('content', activeDesc?.substring(0, 160) || '');
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.title = originalTitle;
      const metaDescNode = document.querySelector('meta[name="description"]');
      if (metaDescNode && originalMetaDesc) {
        metaDescNode.setAttribute('content', originalMetaDesc);
      }
    };
  }, [t, language, checkoutItem]);
  const [profileSubMode, setProfileSubMode] = useState<'selling' | 'buying'>('selling');
  const [buyerOrders, setBuyerOrders] = useState<any[]>([]);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  
  const orders = useMemo(() => {
    const merged = [...buyerOrders];
    sellerOrders.forEach(so => {
      if (!merged.some(bo => bo.id === so.id)) {
        merged.push(so);
      }
    });
    return merged.sort((a, b) => {
      const at = safeParseDate(a.createdAt);
      const bt = safeParseDate(b.createdAt);
      return bt - at;
    });
  }, [buyerOrders, sellerOrders]);

  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStep, setFormStep] = useState<number>(1);

  useEffect(() => {
    if (viewMode === 'create' || viewMode === 'edit') {
      setFormStep(1);
    }
  }, [viewMode]);
  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    titleGe: string;
    description: string;
    descriptionGe: string;
    price: string;
    currency: string;
    category: string;
    country: string;
    city: string;
    location: string;
    images: string[];
    lat?: number;
    lng?: number;
    condition: string;
    isNegotiable: boolean;
    listingType: 'product' | 'service' | 'project';
    serviceDuration: string;
    serviceTerms: string;
  }>({
    title: '',
    titleGe: '',
    description: '',
    descriptionGe: '',
    price: '',
    currency: language === 'ka' ? 'GEL' : 'USD',
    category: 'technics',
    country: language === 'ka' ? 'GEO' : 'USA',
    city: '',
    location: '',
    images: [],
    lat: undefined,
    lng: undefined,
    condition: 'new',
    isNegotiable: false,
    listingType: 'product',
    serviceDuration: '',
    serviceTerms: ''
  });

  // Synchronize listing draft with localStorage to prevent data loss on tab switches
  useEffect(() => {
    if (viewMode === 'create' || viewMode === 'edit') {
      const timer = setTimeout(() => {
        const hasContent = formData.title || formData.titleGe || formData.description || formData.descriptionGe || formData.price || formData.city || formData.location || (formData.images && formData.images.length > 0);
        if (hasContent) {
          localStorage.setItem('proton_markethub_draft_form_data', JSON.stringify({
            mode: viewMode,
            editingId: editingListing?.id || null,
            data: formData
          }));
        } else {
          localStorage.removeItem('proton_markethub_draft_form_data');
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [formData, viewMode, editingListing]);

  // Restore draft when returning to create/edit view modes
  useEffect(() => {
    if (viewMode === 'create' || viewMode === 'edit') {
      try {
        const savedRaw = localStorage.getItem('proton_markethub_draft_form_data');
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (parsed && parsed.data) {
            if (parsed.mode === viewMode) {
              if (viewMode === 'create' || (viewMode === 'edit' && editingListing && parsed.editingId === editingListing.id)) {
                setFormData(prev => ({
                  ...prev,
                  ...parsed.data
                }));
              }
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load form draft from localStorage:", err);
      }
    }
  }, [viewMode, editingListing]);

  // Trust & Reviews States
  const [reviews, setReviews] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<{ id: string, name: string } | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  useEffect(() => {
    if (!user || authLoading) return;
    const qReviews = query(collection(db, 'seller_reviews'), limit(20));
    const unsubscribe = onSnapshot(qReviews, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReviews(list);
    }, (err) => {
      console.warn("Firestore reviews read fallback:", err);
    });
    return () => unsubscribe();
  }, [user, authLoading]);

  const sellerRatings = useMemo(() => {
    const map: { [sellerId: string]: { avg: number; count: number; ratings: number[] } } = {};
    
    // Seed default rating metadata for our system/featured vendors
    const defaultSellers: Record<string, { avg: number; count: number; ratings: number[] }> = {
      'p_labs': { avg: 4.9, count: 48, ratings: [5, 5, 5, 4, 5, 5] },
      'd_guitars': { avg: 4.8, count: 24, ratings: [5, 5, 5, 4, 5] },
      'eco_garden': { avg: 4.5, count: 16, ratings: [5, 4, 4, 5, 5] },
      's_tech': { avg: 4.2, count: 12, ratings: [4, 4, 5, 3, 5] },
      'g_loft': { avg: 4.0, count: 8, ratings: [4, 4, 4, 4] },
    };
    
    Object.entries(defaultSellers).forEach(([sId, data]) => {
      map[sId] = { avg: data.avg, count: data.count, ratings: [...data.ratings] };
    });

    reviews.forEach(r => {
      const sId = r.sellerId;
      if (!sId) return;
      if (!map[sId]) {
        map[sId] = { avg: 0, count: 0, ratings: [] };
      }
      map[sId].ratings.push(r.rating || 5);
    });

    Object.keys(map).forEach(sId => {
      const sum = map[sId].ratings.reduce((a, b) => a + b, 0);
      const count = map[sId].ratings.length;
      map[sId].count = count;
      map[sId].avg = count > 0 ? sum / count : 0;
    });

    return map;
  }, [reviews]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია შეფასების დასაწერად." : "Please log in to write a review.");
      return;
    }
    if (!selectedVendor) return;
    if (user.uid === selectedVendor.id) {
      alert(language === 'ka' ? "თქვენ არ შეგიძლიათ საკუთარი თავის შეფასება." : "You cannot review yourself.");
      return;
    }
    if (reviewRating < 1 || reviewRating > 5) {
      alert(language === 'ka' ? "გთხოვთ აირჩიოთ რეიტინგი 1-დან 5-მდე." : "Please select a rating between 1 and 5.");
      return;
    }
    if (!reviewText.trim()) {
      alert(language === 'ka' ? "გთხოვთ დაწეროთ შეფასების ტექსტი." : "Please write a review comment.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const docId = `rev_${user.uid}_${selectedVendor.id}`;
      const reviewDocRef = doc(db, 'seller_reviews', docId);
      
      await setDoc(reviewDocRef, {
        buyerId: user.uid,
        buyerName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        sellerId: selectedVendor.id,
        rating: reviewRating,
        text: reviewText.trim(),
        createdAt: serverTimestamp()
      });
      
      setReviewText('');
      setReviewRating(5);
      alert(language === 'ka' ? "შეფასება წარმატებით დაემატა!" : "Review added successfully!");
    } catch (err) {
      console.error("Error creating review:", err);
      alert(language === 'ka' ? "შეფასების დამატება ვერ მოხერხდა." : "Could not add your review.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm(language === 'ka' ? "ნამდვილად გსურთ შეფასების წაშლა?" : "Are you sure you want to delete this review?")) return;
    try {
      await deleteDoc(doc(db, 'seller_reviews', reviewId));
    } catch (err) {
      console.error("Error deleting review:", err);
      alert(language === 'ka' ? "წაშლა ვერ მოხერხდა." : "Could not delete review.");
    }
  };

  // Vendor Chat State & Actions
  const [activeChatListing, setActiveChatListing] = useState<Listing | null>(null);
  const [chatMessageText, setChatMessageText] = useState('');
  const [messagesList, setMessagesList] = useState<any[]>([]);

  useEffect(() => {
    if (!activeChatListing || !user) return;
    const qMsgs = query(
      collection(db, 'market_messages'),
      where('listingId', '==', activeChatListing.id),
      where('participants', 'array-contains', user.uid)
    );
    const unsubscribe = onSnapshot(qMsgs, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as any
      }));
      // Sort in client-side memory to avoid composite index requirement
      msgs.sort((a, b) => {
        const timeA = safeParseDate(a.createdAt);
        const timeB = safeParseDate(b.createdAt);
        return timeA - timeB;
      });
      setMessagesList(msgs);
    }, (err) => {
      console.error("Error loading messages: ", err);
    });
    return () => unsubscribe();
  }, [activeChatListing, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChatListing || !chatMessageText.trim()) return;

    try {
      const sellerId = activeChatListing.sellerId;
      const isSeller = sellerId === user.uid;
      let buyerId = '';
      if (isSeller) {
        const buyerMsg = messagesList.find(m => m.senderId !== user.uid);
        if (buyerMsg) {
          buyerId = buyerMsg.senderId;
        }
      } else {
        buyerId = user.uid;
      }

      const participants = [user.uid];
      if (sellerId && !participants.includes(sellerId)) {
        participants.push(sellerId);
      }
      if (buyerId && !participants.includes(buyerId)) {
        participants.push(buyerId);
      }

      await addDoc(collection(db, 'market_messages'), {
        listingId: activeChatListing.id,
        listingTitle: activeChatListing.title,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split('@')[0] || 'User',
        senderAvatar: user.photoURL || '',
        text: chatMessageText.trim(),
        createdAt: serverTimestamp(),
        sellerId: sellerId || '',
        buyerId: buyerId || '',
        receiverId: isSeller ? (buyerId || '') : (sellerId || ''),
        participants
      });
      setChatMessageText('');
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // Dynamically resolve theme from design system.
  // Strips hardcoded hex values to support full color-variable harmony of Light, Forest, Titanium, Rose, Sunset, etc.
  const currentTheme = {
    card: "bg-proton-card border border-proton-border/30 shadow-2xl text-proton-text",
    input: "bg-proton-bg/40 border border-proton-border/50 focus:border-proton-accent/50 text-proton-text placeholder:text-proton-muted/55 focus:outline-none focus:ring-1 focus:ring-proton-accent/20",
    accent: "text-proton-accent",
    accentBg: "bg-proton-accent text-proton-on-accent hover:bg-proton-accent/90 focus:ring-1 focus:ring-proton-accent/20",
    border: "border-proton-border/40",
    muted: "text-proton-muted",
    text: "text-proton-text",
    subtext: "text-proton-text/75",
    tagMuted: "text-proton-muted/60",
    cardAlt: "bg-proton-bg/40 border border-proton-border/30 text-proton-text",
    badgeBg: "bg-proton-accent/10 text-proton-accent border border-proton-accent/25",
    bgHover: "hover:bg-proton-accent/10 hover:text-proton-accent hover:border-proton-accent/30",
    overlay: "bg-proton-bg/95 backdrop-blur-xl border border-proton-border/50"
  };

  useEffect(() => {
    if (!user || authLoading) return;
    const qListings = query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(24));
    const unsubscribeListings = onSnapshot(qListings, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Listing[];

      // Reclaim / heal corrupted listings where sellerName matches the logged-in user but sellerId is wrong
      const loggedUser = auth.currentUser;
      if (loggedUser) {
        data.forEach((l) => {
          const sellerNameLower = String(l.sellerName || '').trim().toLowerCase();
          const userEmailPrefix = loggedUser.email ? String(loggedUser.email.split('@')[0]).trim().toLowerCase() : '';
          const userDisplayName = loggedUser.displayName ? String(loggedUser.displayName).trim().toLowerCase() : '';

          // If the logged-in user is NOT the admin 'devdarianib@gmail.com', AND the listing's sellerName matches their name,
          // but the listing's sellerId is NOT their UID, then it was corrupted! Let's claim it back.
          if (loggedUser.email !== 'devdarianib@gmail.com') {
            const isMatch = sellerNameLower && (
              sellerNameLower === userEmailPrefix ||
              sellerNameLower === userDisplayName
            );
            if (isMatch && l.sellerId !== loggedUser.uid) {
              console.log(`[DATA RECOVERY] Reclaiming listing '${l.title}' (${l.id}) for true owner ${loggedUser.email}. Restoring sellerId to:`, loggedUser.uid);
              updateDoc(doc(db, 'listings', l.id), { sellerId: loggedUser.uid })
                .then(() => {
                  console.log(`[DATA RECOVERY] Successfully claimed back listing '${l.id}' for user.`);
                })
                .catch((e) => {
                  console.error(`[DATA RECOVERY ERROR] Failed to reclaim listing '${l.id}':`, e);
                });
            }
          }
        });
      }

      setListings(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'listings');
    });

    return () => unsubscribeListings();
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) {
      setBuyerOrders([]);
      setSellerOrders([]);
      return;
    }

    let active = true;

    if (isSupabaseConfigured()) {
      const fetchSupabaseOrders = async () => {
        const { data: bData, error: bErr } = await supabase
          .from('orders')
          .select('*')
          .eq('buyerId', user.uid);
        if (active && !bErr && bData) setBuyerOrders(bData);

        const { data: sData, error: sErr } = await supabase
          .from('orders')
          .select('*')
          .eq('sellerId', user.uid);
        if (active && !sErr && sData) setSellerOrders(sData);
      };

      fetchSupabaseOrders();

      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          () => {
            if (active) fetchSupabaseOrders();
          }
        )
        .subscribe();

      return () => {
        active = false;
        supabase.removeChannel(channel);
      };
    } else {
      const qBuyerOrders = query(
        collection(db, 'orders'), 
        where('buyerId', '==', user.uid)
      );
      const unsubscribeBuyer = onSnapshot(qBuyerOrders, (snapshot) => {
        if (!active) return;
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setBuyerOrders(data);
      }, (error) => {
        console.warn("Buyer orders listen failed:", error);
      });

      const qSellerOrders = query(
        collection(db, 'orders'), 
        where('sellerId', '==', user.uid)
      );
      const unsubscribeSeller = onSnapshot(qSellerOrders, (snapshot) => {
        if (!active) return;
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSellerOrders(data);
      }, (error) => {
        console.warn("Seller orders listen failed:", error);
      });

      return () => {
        active = false;
        unsubscribeBuyer();
        unsubscribeSeller();
      };
    }
  }, [user?.uid]);

  const clearFilters = () => {
    setSearch('');
    setActiveCategory('all');
    setActiveCountry('GLOBAL');
    setActiveCity('');
    setMinPrice('');
    setMaxPrice('');
    setActiveListingType('all');
  };

  const allListings = useMemo(() => {
    return listings;
  }, [listings]);

  const filteredListings = useMemo(() => {
    let result = [...allListings];
    
    // Filter by View Mode
    if (viewMode === 'my-listings') {
      console.log('Fetching listings for user:', user?.uid);
      if (profileSubMode === 'selling') {
        result = result.filter(l => l.sellerId === user?.uid);
      } else {
        // Handled by different UI section
        return [];
      }
    }

    // Bypass main marketplace browsing criteria if we are in 'my-listings' mode to ensure all user items remain fully visible
    if (viewMode !== 'my-listings') {
      // Filter out sold items from public browsing
      result = result.filter(l => l.status !== 'sold' && !l.isSold);

      // Filter by Listing Type (Product vs Service vs Project)
      if (activeListingType !== 'all') {
        if (activeListingType === 'service') {
          result = result.filter(l => l.listingType === 'service' || l.category === 'service');
        } else if (activeListingType === 'project') {
          result = result.filter(l => l.listingType === 'project' || l.category === 'project');
        } else {
          result = result.filter(l => l.listingType === 'product' || (!l.listingType && l.category !== 'service' && l.category !== 'project'));
        }
      }

      // Filter by Category
      if (activeCategory !== 'all') {
        result = result.filter(l => l.category === activeCategory);
      }

      // Filter by Country
      if (activeCountry !== 'GLOBAL') {
        result = result.filter(l => l.country === activeCountry);
      }

      // Filter by City
      if (activeCity) {
        result = result.filter(l => l.city.toLowerCase().includes(activeCity.toLowerCase()));
      }

      // Filter by Price
      if (minPrice !== '') {
        result = result.filter(l => convertPrice(l.price, l.currency || 'USD', displayCurrency) >= parseFloat(minPrice));
      }
      if (maxPrice !== '') {
        result = result.filter(l => convertPrice(l.price, l.currency || 'USD', displayCurrency) <= parseFloat(maxPrice));
      }
    }

    // Filter by Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(l => {
        const title = language === 'ka' ? (l.titleGe || l.title) : l.title;
        const desc = language === 'ka' ? (l.descriptionGe || l.description) : l.description;
        return title.toLowerCase().includes(s) || 
               desc.toLowerCase().includes(s) ||
               l.sellerName.toLowerCase().includes(s) ||
               (l.city && l.city.toLowerCase().includes(s)) ||
               (l.country && l.country.toLowerCase().includes(s));
      });
    }

    // Filter by Favorites
    if (showOnlyFavorites) {
      result = result.filter(l => favorites.includes(l.id));
    }

    // Sorting Engine
    if (sortBy === 'rating') {
      result.sort((a, b) => {
        const ratingA = sellerRatings[a.sellerId]?.avg || 0;
        const ratingB = sellerRatings[b.sellerId]?.avg || 0;
        const countA = sellerRatings[a.sellerId]?.count || 0;
        const countB = sellerRatings[b.sellerId]?.count || 0;
        
        if (ratingB !== ratingA) {
          return ratingB - ratingA;
        }
        if (countB !== countA) {
          return countB - countA;
        }
        const timeA = safeParseDate(a.createdAt);
        const timeB = safeParseDate(b.createdAt);
        return timeB - timeA;
      });
    } else if (sortBy === 'newest') {
      result.sort((a, b) => {
        const timeA = safeParseDate(a.createdAt);
        const timeB = safeParseDate(b.createdAt);
        return timeB - timeA;
      });
    } else if (sortBy === 'priceAsc') {
      result.sort((a, b) => {
        const priceA = convertPrice(a.price, a.currency || 'USD', displayCurrency);
        const priceB = convertPrice(b.price, b.currency || 'USD', displayCurrency);
        return priceA - priceB;
      });
    } else if (sortBy === 'priceDesc') {
      result.sort((a, b) => {
        const priceA = convertPrice(a.price, a.currency || 'USD', displayCurrency);
        const priceB = convertPrice(b.price, b.currency || 'USD', displayCurrency);
        return priceB - priceA;
      });
    }

    return result;
  }, [allListings, search, activeCategory, activeCountry, activeCity, minPrice, maxPrice, viewMode, activeListingType, language, sortBy, sellerRatings, user?.uid, displayCurrency]);

  const marketMetrics = useMemo(() => {
    const total = listings.length;
    const active = listings.filter(l => l.status !== 'sold').length;
    const sold = listings.filter(l => l.status === 'sold' || (l as any).isSold).length + orders.length;
    const currencySymbol = CURRENCIES.find(c => c.code === displayCurrency)?.symbol || displayCurrency;
    
    // Average price calculation (coerced with safe guards)
    const validPrices = listings.map(l => {
      try {
        return convertPrice(l.price || 0, l.currency || 'USD', displayCurrency);
      } catch {
        return 0;
      }
    });
    const avgPrice = validPrices.length ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 0;
    
    // Most popular category
    const catCounts: Record<string, number> = {};
    listings.forEach(l => {
      if (l.category) {
        catCounts[l.category] = (catCounts[l.category] || 0) + 1;
      }
    });
    let topCat = 'technics';
    let maxVal = 0;
    Object.entries(catCounts).forEach(([cat, val]) => {
      if (val > maxVal) {
        maxVal = val;
        topCat = cat;
      }
    });
    
    return {
      total,
      active,
      sold,
      avgPrice: `${currencySymbol}${avgPrice}`,
      topCat: topCat.toUpperCase()
    };
  }, [listings, orders, displayCurrency]);

  const handleBuyNow = async (listing: Listing) => {
    if (!user) return;

    const isOwnListing = listing.sellerId === user.uid;

    if (isOwnListing) {
      alert(language === 'ka' ? "თქვენ არ შეგიძლიათ საკუთარი ნივთის ყიდვა." : "You cannot buy your own item.");
      return;
    }
    setCheckoutItem(listing);
  };

  const processPurchase = async () => {
    if (!user || !checkoutItem) return;

    setIsCheckingOut(true);
    try {
      const isService = checkoutItem.listingType === 'service' || checkoutItem.category === 'service';
      const orderData = {
        listingId: checkoutItem.id,
        buyerId: user.uid,
        sellerId: checkoutItem.sellerId,
        amount: checkoutItem.price,
        currency: checkoutItem.currency || 'USD',
        itemTitle: checkoutItem.title,
        status: isService ? 'booked' : 'completed',
        orderType: isService ? 'service' : 'product',
        buyerInstructions: isService ? buyerInstructions.trim() : '',
        createdAt: Date.now()
      };

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('orders').insert([orderData]);
        if (error) throw error;
        if (!isService) {
          const { error: updateErr } = await supabase
            .from('listings')
            .update({ status: 'sold', isSold: true })
            .eq('id', checkoutItem.id);
          if (updateErr) console.error("[SUPABASE ERROR] Failed to update listing status:", updateErr);
        }
      } else {
        await addDoc(collection(db, 'orders'), {
          ...orderData,
          createdAt: serverTimestamp()
        });
        if (!isService) {
          await updateDoc(doc(db, 'listings', checkoutItem.id), {
            status: 'sold',
            isSold: true
          });
        }
      }
      
      setCheckoutItem(null);
      setBuyerInstructions('');
      setViewMode('my-listings');
      setProfileSubMode('buying');
    } catch (error) {
      console.error("Error creating order:", error);
      alert(language === 'ka' ? "შეკვეთისას მოხდა შეცდომა." : "Error processing order.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      if (!user) {
        alert(language === 'ka' ? "ავტორიზაცია აუცილებელია." : "Authentication is required.");
        return;
      }
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('orders')
          .update({ status: newStatus })
          .eq('id', orderId)
          .or(`buyerId.eq.${user.uid},sellerId.eq.${user.uid}`);
        if (error) throw error;
      } else {
        await updateDoc(doc(db, 'orders', orderId), {
          status: newStatus
        });
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      alert(language === 'ka' ? "სტატუსის განახლება ვერ მოხერხდა." : "Failed to update order status.");
    }
  };

  const [isResizing, setIsResizing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(language === 'ka' ? "გთხოვთ აირჩიოთ ფოტოს ფაილი." : "Please select an image file.");
        return;
      }

      setIsResizing(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Canvas resizing logic
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Get base64 with quality reduction
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setFormData(prev => ({ ...prev, images: [dataUrl, ...(prev.images || [])] }));
          setIsResizing(false);
        };
        img.onerror = () => {
          setIsResizing(false);
          alert(language === 'ka' ? "ფოტოს დამუშავებისას მოხდა შეცდომა." : "Error processing image.");
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        setIsResizing(false);
        alert(language === 'ka' ? "ფაილის წაკითხვისას მოხდა შეცდომა." : "Error reading file.");
      };
      reader.readAsDataURL(file);
    }
  };

  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const getFallbackTemplate = (title: string, category: string) => {
    return `${title} (${category})\n\n[Key Specifications]\n- Model:\n- Condition:\n- Performance:\n- Warranty:\n\n[Overview]\nProfessional distribution assets for high-tier industrial use.`;
  };

  const handleAiDescription = async () => {
    if (!formData.title) {
      alert(language === 'ka' ? "გთხოვთ შეიყვანოთ სათაური" : "Please enter a title first");
      return;
    }

    const confirmed = window.confirm(
      language === 'ka' 
        ? "გსურთ AI-ს გამოყენება აღწერის გენერირებისთვის? ეს პროცესი ხარჯავს რესურსებს." 
        : "Do you want to use AI to generate a professional spec? This action uses cloud resources."
    );
    if (!confirmed) return;

    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;

    setIsAiGenerating(true);
    try {
      if (!user) return;

      // 1. Check Rate Limit (1 gen every 10 mins)
      const usageRef = doc(db, 'users', user.uid, 'usage', 'ai');
      const usageSnap = await getDoc(usageRef);
      if (controller.signal.aborted) return;
      if (usageSnap.exists()) {
        const lastGen = usageSnap.data().lastAiGen?.toDate();
        if (lastGen) {
          const now = new Date();
          const tenMins = 10 * 60 * 1000;
          if (now.getTime() - lastGen.getTime() < tenMins) {
            const waitTime = Math.ceil((tenMins - (now.getTime() - lastGen.getTime())) / 60000);
            alert(language === 'ka' 
              ? `გთხოვთ დაიცადოთ ${waitTime} წუთი შემდეგი გენერაციისთვის.` 
              : `Please wait ${waitTime} minutes before using AI again.`);
            
            // Provide fallback if requested
            if (window.confirm(language === 'ka' ? "გსურთ გამოიყენოთ სტანდარტული შაბლონი?" : "Would you like to use a standard template instead?")) {
              const template = getFallbackTemplate(formData.title, formData.category);
              if (!controller.signal.aborted) {
                setFormData(prev => ({ ...prev, description: template }));
              }
            }
            return;
          }
        }
      }

      // 2. Check Cache
      const specId = `${formData.title}_${formData.category}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const cacheRef = doc(db, 'shared_specs', specId);
      const cacheSnap = await getDoc(cacheRef);
      if (controller.signal.aborted) return;
      
      if (cacheSnap.exists()) {
        const cachedSpec = cacheSnap.data().spec;
        if (!controller.signal.aborted) {
          setFormData(prev => ({ 
            ...prev, 
            description: cachedSpec,
            descriptionGe: language === 'ka' ? cachedSpec : prev.descriptionGe 
          }));
        }
        return;
      }

      // 3. Generate with Gemini
      const spec = await generateTechSpec(formData.title, formData.category);
      if (controller.signal.aborted) return;
      if (spec) {
        // 4. Save to Cache
        await setDoc(cacheRef, {
          spec,
          title: formData.title,
          category: formData.category,
          createdAt: serverTimestamp()
        });

        // 5. Update User Usage
        await setDoc(usageRef, {
          lastAiGen: serverTimestamp()
        });

        if (!controller.signal.aborted) {
          setFormData(prev => ({ 
            ...prev, 
            description: spec,
            descriptionGe: language === 'ka' ? spec : prev.descriptionGe 
          }));
        }
      } else {
        throw new Error("AI Generation failed");
      }
    } catch (error: any) {
      if (controller.signal.aborted || (error && error.name === 'AbortError')) return;
      console.error("Error generating tech spec:", error);
      alert(language === 'ka' ? "AI-სთან კავშირი ვერ მოხერხდა. გამოიყენეთ შაბლონი." : "AI service unavailable. Falling back to template.");
      const template = getFallbackTemplate(formData.title, formData.category);
      if (!controller.signal.aborted) {
        setFormData(prev => ({ ...prev, description: template }));
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsAiGenerating(false);
      }
    }
  };

  const checkRateLimit = async () => {
    if (!user) return true;
    try {
      const oneMinuteAgo = new Date();
      oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1);
      
      const recentCount = listings.filter(l => {
        if (l.sellerId !== user.uid) return false;
        const dMillis = safeParseDate(l.createdAt);
        return dMillis >= oneMinuteAgo.getTime();
      }).length;

      // Limit to 5 listings per minute for safety
      if (recentCount >= 5) {
        return false;
      }
      return true;
    } catch (e) {
      console.warn("Local rate limit check fallback failed:", e);
      return true; // Bypass on error to prevent blocking users
    }
  };

  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია განცხადების დასადებად" : "Please log in to post a listing.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (viewMode !== 'edit') {
        const canPost = await checkRateLimit();
        if (!canPost) {
          alert(language === 'ka' ? "გთხოვთ დაიცადოთ. თქვენ ძალიან ბევრ განცხადებას დებთ." : "Rate limit exceeded. Please wait a minute before posting more.");
          setIsSubmitting(false);
          return;
        }
      }

      // Strong validation and sanitization over inputs (such as replacing comma with dot for Georgian users)
      const priceStr = String(formData.price || '').trim().replace(',', '.');
      const parsedPrice = parseFloat(priceStr);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        alert(language === 'ka' 
          ? "გთხოვთ შეიყვანოთ სწორი ფასი (მხოლოდ დადებითი რიცხვები)." 
          : "Please enter a valid price (positive numbers only)."
        );
        setIsSubmitting(false);
        return;
      }

      const countryStr = (formData.country || '').trim();
      const cityStr = (formData.city || '').trim();
      if (!countryStr || !cityStr) {
        alert(language === 'ka' 
          ? "გთხოვთ შეავსოთ ქვეყანა და ქალაქი." 
          : "Please select a country and enter a city."
        );
        setIsSubmitting(false);
        return;
      }

      if (!formData.title.trim()) {
        alert(language === 'ka' ? "გთხოვთ შეავსოთ ნივთის სათაური." : "Please fill in the product title.");
        setIsSubmitting(false);
        return;
      }

      if (!formData.description.trim()) {
        alert(language === 'ka' ? "გთხოვთ შეავსოთ ნივთის აღწერა." : "Please fill in the product description.");
        setIsSubmitting(false);
        return;
      }

      // Safe coordinate assignment (Never send NaN or undefined value directly to firestore fields)
      const sanitizedLat = (typeof formData.lat === 'number' && !isNaN(formData.lat)) ? formData.lat : null;
      const sanitizedLng = (typeof formData.lng === 'number' && !isNaN(formData.lng)) ? formData.lng : null;

      const listingData = {
        title: formData.title.trim(),
        titleGe: (formData.titleGe || formData.title).trim(),
        description: formData.description.trim(),
        descriptionGe: (formData.descriptionGe || formData.description).trim(),
        price: parsedPrice,
        currency: formData.currency || 'USD',
        sellerId: (viewMode === 'edit' && editingListing) ? editingListing.sellerId : user.uid,
        sellerName: (viewMode === 'edit' && editingListing) ? (editingListing.sellerName || 'Unknown') : (user.displayName || user.email?.split('@')[0] || 'Unknown'),
        category: formData.category || 'technics',
        location: (formData.location || `${cityStr}, ${countryStr}`).trim(),
        country: countryStr,
        city: cityStr,
        image: (formData.images && formData.images[0]) || '',
        images: formData.images || [],
        createdAt: serverTimestamp(),
        status: 'active',
        lat: sanitizedLat,
        lng: sanitizedLng,
        condition: formData.condition || 'new',
        isNegotiable: formData.isNegotiable ?? false,
        listingType: formData.listingType || (formData.category === 'service' ? 'service' : 'product'),
        serviceDuration: formData.serviceDuration || '',
        serviceTerms: formData.serviceTerms || ''
      };

      if (viewMode === 'edit' && editingListing) {
        // Remove createdAt from updates to keep it immutable
        const { createdAt, ...updateData } = listingData;
        await updateDoc(doc(db, 'listings', editingListing.id), updateData);
      } else {
        await addDoc(collection(db, 'listings'), listingData);
      }

      localStorage.removeItem('proton_markethub_draft_form_data');
      setViewMode('browse');
      setFormData({
        title: '', titleGe: '', description: '', descriptionGe: '',
        price: '', currency: language === 'ka' ? 'GEL' : 'USD', category: 'technics', 
        country: language === 'ka' ? 'GEO' : 'USA', city: '', location: '', images: [],
        lat: undefined, lng: undefined, condition: 'new', isNegotiable: false,
        listingType: 'product', serviceDuration: '', serviceTerms: ''
      });
    } catch (error: any) {
      console.error(error);
      alert("Firebase Error: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (window.confirm(t.market.delete_confirm)) {
      try {
        await deleteDoc(doc(db, 'listings', id));
      } catch (error) {
        console.error("Error deleting listing:", error);
      }
    }
  };

  const startEdit = (listing: Listing) => {
    setEditingListing(listing);
    setFormData({
      title: listing.title,
      titleGe: listing.titleGe || '',
      description: listing.description,
      descriptionGe: listing.descriptionGe || '',
      price: listing.price.toString(),
      currency: listing.currency || 'USD',
      category: listing.category,
      country: (listing as any).country || 'USA',
      city: (listing as any).city || '',
      location: listing.location,
      images: listing.images || (listing.image ? [listing.image] : []),
      lat: listing.lat,
      lng: listing.lng,
      condition: listing.condition || 'new',
      isNegotiable: listing.isNegotiable || false,
      listingType: listing.listingType || (listing.category === 'service' ? 'service' : 'product'),
      serviceDuration: listing.serviceDuration || '',
      serviceTerms: listing.serviceTerms || ''
    });
    setViewMode('edit');
  };

  const FilterContent = (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-[#dfb257]">
          <LayoutGrid size={16} className="text-[#dfb257]" />
          {language === 'ka' ? 'ფილტრაცია' : 'Refine Search'}
        </h3>
        <button 
          onClick={() => setIsFiltersOpen(false)} 
          className="lg:hidden p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:text-white transition-colors text-zinc-400"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 ml-1 block">
            {t.market.filters.country}
          </label>
          <div className="relative group">
            <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#dfb257] opacity-60" />
            <select 
              value={activeCountry}
              onChange={(e) => setActiveCountry(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-zinc-950 border-2 border-zinc-800 hover:border-zinc-700/85 rounded-xl text-xs md:text-sm font-bold focus:border-[#dfb257] focus:outline-none transition-all text-white appearance-none cursor-pointer"
            >
              {WORLD_COUNTRIES.map(country => (
                <option key={country.code} value={country.code} className="bg-zinc-950 text-white">
                  {country.name}
                </option>
              ))}
            </select>
            <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 opacity-40 pointer-events-none text-zinc-400" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 ml-1 block">
            {t.market.filters.city}
          </label>
          <div className="relative group">
            <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#dfb257] opacity-60" />
            <input 
              type="text"
              value={activeCity}
              onChange={(e) => setActiveCity(e.target.value)}
              placeholder={language === 'ka' ? 'მაგ: თბილისი' : 'e.g. Tbilisi'}
              className="w-full pl-10 pr-4 py-3 bg-zinc-950 border-2 border-zinc-800 focus:border-[#dfb257] focus:outline-none rounded-xl text-xs md:text-sm font-bold transition-all placeholder:text-zinc-650 text-white"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 ml-1 block">
            {t.market.form.category}
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
            <button 
              type="button"
              onClick={() => setActiveCategory('all')}
              className={cn(
                "col-span-2 flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border text-left",
                activeCategory === 'all' 
                  ? "bg-gradient-to-b from-zinc-800 to-zinc-900 border-[#dfb257] text-[#dfb257] shadow-lg shadow-black/80"
                  : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              )}
            >
              <span className="text-base">🌍</span>
              <span className="truncate">{t.market.all_categories}</span>
            </button>
            {Object.entries(t.market.categories).map(([key, label]) => (
              <button 
                key={key}
                type="button"
                onClick={() => setActiveCategory(key)}
                className={cn(
                  "flex items-center gap-2 px-3 py-3 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-tight transition-all border text-left",
                  activeCategory === key 
                    ? "bg-gradient-to-b from-zinc-800 to-zinc-900 border-[#dfb257] text-[#dfb257] shadow-lg"
                    : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:bg-zinc-900 hover:text-white"
                )}
                title={label as string}
              >
                <span className="text-base shrink-0">{CATEGORY_EMOJIS[key] || '🏷️'}</span>
                <span className="truncate">{label as string}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 ml-1 block">
            {t.market.price} (USD)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input 
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder={language === 'ka' ? 'მინ. ფასი' : 'Min Price'}
              className="w-full px-4 py-3 bg-zinc-950 border-2 border-zinc-800 focus:border-[#dfb257] focus:outline-none rounded-xl text-xs md:text-sm font-bold transition-all placeholder:text-zinc-650 text-white"
            />
            <input 
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder={language === 'ka' ? 'მაქს. ფასი' : 'Max Price'}
              className="w-full px-4 py-3 bg-zinc-950 border-2 border-zinc-800 focus:border-[#dfb257] focus:outline-none rounded-xl text-xs md:text-sm font-bold transition-all placeholder:text-zinc-650 text-white"
            />
          </div>
        </div>

        <button 
          onClick={clearFilters}
          className="w-full py-3.5 mt-4 rounded-xl bg-red-950/20 border border-red-900/30 text-xs font-black uppercase tracking-[0.25em] hover:text-white hover:bg-red-905 hover:border-red-500/50 transition-all flex items-center justify-center gap-2 text-red-300"
        >
          <Trash2 size={14} className="stroke-[2.5]" />
          {t.market.filters.clear_all}
        </button>
      </div>
    </div>
  );



  return (
    <div className="min-h-screen bg-proton-bg text-proton-text relative flex flex-col w-full overflow-x-hidden p-0 m-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      {/* Premium Standalone E-Commerce Navigation Bar */}
      <div className="w-full bg-proton-bg/95 border-b border-proton-border/40 py-3 sm:py-4 px-4 sm:px-8 flex flex-col gap-3 sticky top-0 z-50 backdrop-blur-md">
        {/* Top bar layer */}
        <div className="w-full flex items-center justify-between gap-4">
          
          {/* Logo element */}
          <div 
            onClick={() => { 
              setViewMode('browse'); 
              setActiveCategory('all'); 
              setShowOnlyFavorites(false); 
            }} 
            className="flex items-center gap-2 cursor-pointer select-none grow-0 shrink-0"
          >
            <div className="flex items-center">
              <div className="bg-proton-accent text-proton-on-accent font-black px-3 py-1.5 rounded-l-xl text-xs sm:text-sm tracking-tighter uppercase whitespace-nowrap">
                proton
              </div>
              <div className="bg-proton-card text-proton-accent border border-proton-border border-l-0 font-bold px-3 py-1.5 rounded-r-xl text-xs sm:text-sm tracking-tighter uppercase whitespace-nowrap">
                {language === 'ka' ? 'მარკეტი' : 'market'}
              </div>
            </div>
          </div>

          {/* Desktop Search Bar Grouping */}
          <div className="hidden md:flex flex-1 max-w-xl items-center gap-3">
            {/* Category selection selector */}
            <div className="relative shrink-0">
              <select 
                value={activeCategory}
                onChange={(e) => {
                  setActiveCategory(e.target.value);
                  setViewMode('browse');
                }}
                className="pl-3 pr-9 py-2 bg-proton-card border border-proton-border rounded-xl text-[10px] sm:text-xs font-bold text-proton-text hover:text-proton-accent focus:outline-none transition-all cursor-pointer appearance-none min-w-[150px] uppercase tracking-wider"
              >
                <option value="all">📁 {language === 'ka' ? 'ყველა კატეგორია' : 'All Categories'}</option>
                {Object.entries(t.market.categories).map(([key, label]) => (
                  <option key={key} value={key}>
                    {CATEGORY_EMOJIS[key] || '🏷️'} {label as string}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-proton-muted pointer-events-none" />
            </div>

            {/* Input search */}
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-45 text-proton-accent" />
              <input 
                type="text"
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                placeholder={language === 'ka' ? 'ჩაწერე საძიებო სიტყვა...' : 'Search listings, tags, vendors...'}
                className="w-full bg-proton-card border border-proton-border text-proton-text placeholder-proton-muted/50 font-bold tracking-wide focus:outline-none focus:border-proton-accent/60 pl-10 pr-4 py-2 rounded-xl text-xs transition-colors"
              />
              {searchRaw && (
                <button 
                  onClick={() => { setSearch(''); setSearchRaw(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-proton-muted hover:text-proton-text font-bold text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Action buttons list */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Create Listing Button */}
            <button
              onClick={() => setViewMode('create')}
              className="bg-proton-accent hover:bg-proton-accent/90 text-proton-on-accent font-black px-3.5 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={13} className="stroke-[3]" />
              <span>{language === 'ka' ? 'განცხადების დამატება' : 'Create Listing'}</span>
            </button>

            {/* Messages tab */}
            <button 
              onClick={() => {
                setViewMode('my-listings');
                setProfileSubMode('buying');
                setActiveBottomTab('messages');
              }}
              className="p-2 sm:p-2.5 text-proton-muted hover:text-proton-accent hover:bg-proton-card rounded-xl transition-all relative"
              title={language === 'ka' ? 'შეტყობინებები' : 'Messages'}
            >
              <Mail size={16} />
              {allUserMessages.length > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-black flex items-center justify-center text-white scale-90 border border-proton-bg">
                  {allUserMessages.length}
                </span>
              )}
            </button>

            {/* Favorites tab */}
            <button 
              onClick={() => {
                setShowOnlyFavorites(!showOnlyFavorites);
                setViewMode('browse');
              }}
              className={cn(
                "p-2 sm:p-2.5 rounded-xl transition-all relative",
                showOnlyFavorites 
                  ? "text-red-500 bg-red-500/10 border border-red-500/20" 
                  : "text-proton-muted hover:text-proton-accent hover:bg-proton-card"
              )}
              title={language === 'ka' ? 'რჩეულები' : 'Favorites'}
            >
              <Heart size={16} fill={showOnlyFavorites ? "currentColor" : "none"} />
              {favorites.length > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-proton-accent rounded-full text-[8px] font-black text-proton-on-accent flex items-center justify-center scale-90 border border-proton-bg">
                  {favorites.length}
                </span>
              )}
            </button>

            {/* Shopping Cart button */}
            <button 
              onClick={() => setIsCartOpen(true)}
              className="p-2 sm:p-2.5 text-proton-muted hover:text-proton-accent hover:bg-proton-card rounded-xl transition-all relative"
              title={language === 'ka' ? 'კალათა' : 'Shopping Cart'}
            >
              <ShoppingBag size={16} />
              {cart.length > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-proton-accent text-proton-on-accent rounded-full text-[8px] font-black flex items-center justify-center scale-90 border border-proton-bg">
                  {cart.length}
                </span>
              )}
            </button>

            {/* Return Home escape button */}
            {onBack && (
              <button 
                onClick={onBack}
                className="px-3.5 py-2 bg-proton-card hover:bg-proton-card/80 border border-proton-border text-proton-text hover:text-proton-accent font-black rounded-xl text-[10px] sm:text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98]"
                title={language === 'ka' ? 'მთავარზე დაბრუნება' : 'Return to Dashboard'}
              >
                <LayoutDashboard size={13} className="text-proton-accent" />
                <span className="hidden sm:inline">{language === 'ka' ? 'მთავარი' : 'Home'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Search/Filter Row (Shown only on mobile) */}
        <div className="w-full flex md:hidden gap-2">
          {/* Mobile dropdown categories */}
          <div className="relative shrink-0">
            <select 
              value={activeCategory}
              onChange={(e) => {
                setActiveCategory(e.target.value);
                setViewMode('browse');
              }}
              className="pl-2.5 pr-8 py-2 bg-proton-card border border-proton-border rounded-xl text-[10px] font-bold text-proton-text hover:text-proton-accent focus:outline-none transition-all cursor-pointer appearance-none min-w-[110px] uppercase tracking-wide"
            >
              <option value="all">📁 {language === 'ka' ? 'ყველა' : 'All'}</option>
              {Object.entries(t.market.categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {CATEGORY_EMOJIS[key] || '🏷️'} {label as string}
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-proton-muted pointer-events-none" />
          </div>

          {/* Mobile search input */}
          <div className="flex-1 relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-45 text-proton-accent" />
            <input 
              type="text"
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              placeholder={language === 'ka' ? 'ძებნა...' : 'Search...'}
              className="w-full bg-proton-card border border-proton-border text-proton-text placeholder-proton-muted/60 font-bold tracking-wide focus:outline-none focus:border-proton-accent/60 pl-8 pr-4 py-2 rounded-xl text-[10px] transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-10 grow relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12 bg-transparent pb-40 relative z-10"
        >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-zinc-900/40">
        <div className="flex items-center gap-4">
          {viewMode !== 'browse' && (
            <button 
              onClick={() => setViewMode('browse')}
              className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-white/5 text-zinc-300 hover:text-white"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className={cn("text-3xl md:text-4xl font-black mb-1.5 tracking-tighter uppercase leading-none", currentTheme.text)}>
              <span className={currentTheme.accent}>{t.market.title.split(' ')[0]}</span> {t.market.title.split(' ').slice(1).join(' ')}
            </h1>
            <div className="flex items-center gap-3">
              <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-md border", currentTheme.cardAlt)}>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className={cn("font-black tracking-widest uppercase text-[8px] opacity-80", currentTheme.muted)}>
                  {viewMode === 'browse' ? t.market.subtitle : 
                   viewMode === 'my-listings' ? t.market.my_listings :
                   viewMode === 'privacy' ? t.market.legal.privacy_policy :
                   viewMode === 'terms' ? t.market.legal.terms_of_service :
                   viewMode === 'create' ? t.market.create_listing : t.market.edit_listing}
                </span>
              </div>
              {viewMode === 'my-listings' && (
                <div className={cn("flex items-center gap-1.5 p-0.5 rounded-lg border", currentTheme.cardAlt)}>
                  <button 
                    onClick={() => setProfileSubMode('selling')}
                    className={cn(
                      "px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all",
                      profileSubMode === 'selling' ? cn(currentTheme.badgeBg, "shadow-sm") : cn(currentTheme.muted, "hover:opacity-85")
                    )}
                  >
                    {t.market.selling_mode}
                  </button>
                  <button 
                    onClick={() => setProfileSubMode('buying')}
                    className={cn(
                      "px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all",
                      profileSubMode === 'buying' ? cn(currentTheme.badgeBg, "shadow-sm") : cn(currentTheme.muted, "hover:opacity-85")
                    )}
                  >
                    {t.market.buying_mode}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {viewMode === 'browse' && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full pt-1">
            {/* Elegant AI Powered Search Panel */}
            <div className="relative flex-1 group">
              <div className="relative w-full flex items-center bg-[#101012] rounded-2xl border border-zinc-800/80 focus-within:border-[#dfb257] transition-all min-h-[46px] overflow-hidden shadow-inner">
                <Search size={15} className="absolute left-4 opacity-40 text-[#dfb257]" />
                <input 
                  type="text"
                  value={searchRaw}
                  onChange={(e) => setSearchRaw(e.target.value)}
                  placeholder={language === 'ka' ? 'ჩაწერე საძიებო სიტყვა...' : 'Type search word...'}
                  className="w-full bg-transparent pl-11 pr-20 py-2.5 text-zinc-100 placeholder-zinc-500 font-bold tracking-wide focus:outline-none text-sm"
                />
                <div className="absolute right-2 top-1.5 bottom-1.5 flex items-center gap-1.5">
                  <div className="h-4 w-[1px] bg-zinc-800" />
                  <button
                    type="button"
                    onClick={() => {
                      const val = language === 'ka' ? 'Apple iPhone' : 'Apple';
                      setSearch(val);
                      setSearchRaw(val);
                      setActiveCategory('technics');
                    }}
                    className="px-2.5 py-1 h-full rounded-lg bg-[#dfb257]/10 hover:bg-[#dfb257]/20 border border-[#dfb257]/20 text-[#dfb257] transition-all font-black text-[9px] tracking-widest flex items-center gap-1 shrink-0"
                  >
                    <Sparkles size={10} className="text-[#dfb257] fill-[#dfb257]/20" />
                    <span>AI</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Display / Map option switchers alongside selected Display Currency picker */}
            <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0">
              {/* Grid / Map View Toggle */}
              <div className={cn("flex items-center gap-1 p-0.5 rounded-xl border shadow-inner", currentTheme.cardAlt)}>
                <button 
                  type="button"
                  onClick={() => setDisplayMode('grid')}
                  className={cn(
                    "h-8 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5",
                    displayMode === 'grid' ? cn(currentTheme.badgeBg, "shadow-sm") : cn("border border-transparent", currentTheme.muted, "hover:opacity-85")
                  )}
                  title={language === 'ka' ? 'ბადისებრი ხედი' : 'Grid View'}
                >
                  <LayoutGrid size={13} />
                  <span className="text-[9px] font-black uppercase tracking-widest">{language === 'ka' ? 'ბადე' : 'Grid'}</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setDisplayMode('map')}
                  className={cn(
                    "h-8 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5",
                    displayMode === 'map' ? "bg-gradient-to-b from-[#e5af37] to-[#b8860b] text-[#070708] shadow-sm border border-zinc-700/80" : cn("border border-transparent", currentTheme.muted, "hover:opacity-85")
                  )}
                  title={language === 'ka' ? 'რუკის ხედი' : 'Map View'}
                >
                  <MapPin size={13} />
                  <span className="text-[9px] font-black uppercase tracking-widest">{language === 'ka' ? 'რუკა' : 'Map'}</span>
                </button>
              </div>

              {/* Display Currency Menu Selector */}
              <div className="relative group shrink-0">
                <select 
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value)}
                  className={cn(
                    "h-9 pl-3 pr-8 py-1.5 rounded-xl border appearance-none text-[9px] font-black uppercase tracking-widest focus:outline-none transition-all cursor-pointer",
                    currentTheme.input
                  )}
                >
                  {CURRENCIES.map(curr => (
                    <option key={curr.code} value={curr.code}>{curr.code}</option>
                  ))}
                </select>
                <ChevronRight size={12} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 opacity-20 pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'browse' && (
          <div className={cn("w-full flex flex-col md:flex-row md:items-center justify-between gap-5 mt-6 border-t pt-6 animate-in fade-in duration-300", currentTheme.border)}>
            {/* Listing Type Selection Tabs */}
            <div className={cn("flex p-0.5 rounded-xl border shadow-inner w-fit select-none", currentTheme.cardAlt)}>
              <button
                type="button"
                onClick={() => setActiveListingType('all')}
                className={cn(
                  "px-4 py-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-2 active:scale-95",
                  activeListingType === 'all' 
                    ? cn(currentTheme.badgeBg, "shadow-sm border border-white/5") 
                    : cn(currentTheme.muted, "hover:opacity-90 hover:bg-white/5")
                )}
              >
                <span>🌍</span>
                <span>{language === 'ka' ? 'ყველა' : 'All'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveListingType('service')}
                className={cn(
                  "px-4 py-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-2 active:scale-95",
                  activeListingType === 'service' 
                    ? cn(currentTheme.badgeBg, "shadow-sm border border-white/5") 
                    : cn(currentTheme.muted, "hover:opacity-90 hover:bg-white/5")
                )}
              >
                <span>⚡</span>
                <span>{language === 'ka' ? 'სერვისები' : 'Services'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveListingType('product')}
                className={cn(
                  "px-4 py-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-2 active:scale-95",
                  activeListingType === 'product' 
                    ? cn(currentTheme.badgeBg, "shadow-sm border border-white/5") 
                    : cn(currentTheme.muted, "hover:opacity-90 hover:bg-white/5")
                )}
              >
                <span>📦</span>
                <span>{language === 'ka' ? 'პროდუქტები' : 'Products'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveListingType('project')}
                className={cn(
                  "px-4 py-2 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-2 active:scale-95",
                  activeListingType === 'project' 
                    ? cn(currentTheme.badgeBg, "shadow-sm border border-white/5") 
                    : cn(currentTheme.muted, "hover:opacity-90 hover:bg-white/5")
                )}
              >
                <span>🚀</span>
                <span>{language === 'ka' ? 'პროექტები' : 'Projects'}</span>
              </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {/* Sorting Filter */}
              <div className="flex items-center gap-2">
                <span className={cn("text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-40 shrink-0", currentTheme.muted)}>
                  {language === 'ka' ? 'სორტირება:' : 'SORT BY:'}
                </span>
                <div className="relative">
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className={cn(
                      "pl-3 pr-8 py-1.5 sm:py-2 rounded-xl border appearance-none text-[8px] sm:text-[9px] font-black uppercase tracking-widest focus:outline-none transition-all cursor-pointer",
                      currentTheme.input
                    )}
                  >
                    <option value="rating">{language === 'ka' ? '★ რეიტინგი' : '★ RATING'}</option>
                    <option value="newest">{language === 'ka' ? '📅 უახლესი' : '📅 NEWEST'}</option>
                    <option value="priceAsc">{language === 'ka' ? '📉 ფასი (ზრდადი)' : '📉 PRICE (LOW)'}</option>
                    <option value="priceDesc">{language === 'ka' ? '📈 ფასი (კლებადი)' : '📈 PRICE (HIGH)'}</option>
                  </select>
                  <ChevronRight size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 opacity-25 pointer-events-none" />
                </div>
              </div>

              <div className="text-[10px] font-black uppercase tracking-widest opacity-45">
                {language === 'ka' 
                  ? `ნაპოვნია ${filteredListings.length} განცხადება` 
                  : `${filteredListings.length} listings found`}
              </div>
            </div>
          </div>
        )}
      </div>

      {viewMode === 'privacy' || viewMode === 'terms' ? (
        <LegalView 
          type={viewMode}
          language={language}
          t={t}
          currentTheme={currentTheme}
          onBack={() => setViewMode('browse')}
        />
      ) : viewMode === 'browse' || viewMode === 'my-listings' ? (
        <div className="space-y-10 w-full">
          {/* Horizontal Category Carousel & Sticky mobile subfilters - Only for Browse View */}
          {viewMode === 'browse' && (
            <div className="relative -mx-4 px-4 py-3 sm:mx-0 sm:px-0 bg-transparent border-b border-zinc-900/40 lg:border-none lg:p-0 mb-6 lg:mb-10 lg:pt-2 transition-all">
              {/* Categories horizontal list */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-3 pt-1 px-1 scrollbar-none scroll-smooth">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={cn(
                    "flex items-center gap-2.5 px-6 py-4 sm:py-3.5 rounded-2xl text-xs sm:text-[10px] font-black uppercase tracking-widest transition-all shrink-0 border min-h-[48px]",
                    activeCategory === 'all'
                      ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-xl scale-[1.02] -translate-y-0.5"
                      : cn(currentTheme.cardAlt, currentTheme.bgHover)
                  )}
                >
                  <span className="text-sm">🌍</span>
                  <span>{t.market.all_categories}</span>
                </button>
                {Object.entries(t.market.categories).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveCategory(key)}
                    className={cn(
                      "flex items-center gap-2.5 px-6 py-4 sm:py-3.5 rounded-2xl text-xs sm:text-[10px] font-black uppercase tracking-widest transition-all shrink-0 border min-h-[48px]",
                      activeCategory === key
                        ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-xl scale-[1.02] -translate-y-0.5"
                        : cn(currentTheme.cardAlt, currentTheme.bgHover)
                    )}
                  >
                    <span className="text-sm shrink-0">{CATEGORY_EMOJIS[key] || '🏷️'}</span>
                    <span>{label as string}</span>
                  </button>
                ))}
              </div>

              {/* Mobile Quick Subfilters & Filters button under category carousel */}
              <div className="flex items-center justify-between gap-3 mt-3 lg:hidden w-full px-1">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none grow py-1">
                  <button
                    type="button"
                    onClick={() => setActiveListingType('all')}
                    className={cn(
                      "px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all border shrink-0 min-h-[48px]",
                      activeListingType === 'all'
                        ? "bg-white/10 text-white border-white/20"
                        : "text-white/40 border-transparent hover:text-white/60"
                    )}
                  >
                    {language === 'ka' ? 'ყველა' : 'All'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveListingType('service')}
                    className={cn(
                      "px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all border shrink-0 min-h-[48px]",
                      activeListingType === 'service'
                        ? "bg-white/10 text-white border-white/20"
                        : "text-white/40 border-transparent hover:text-white/60"
                    )}
                  >
                    ⚡ {language === 'ka' ? 'სერვისები' : 'Services'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveListingType('product')}
                    className={cn(
                      "px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all border shrink-0 min-h-[48px]",
                      activeListingType === 'product'
                        ? "bg-white/10 text-white border-white/20"
                        : "text-white/40 border-transparent hover:text-white/60"
                    )}
                  >
                    📦 {language === 'ka' ? 'პროდუქტები' : 'Products'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveListingType('project')}
                    className={cn(
                      "px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all border shrink-0 min-h-[48px]",
                      activeListingType === 'project'
                        ? "bg-white/10 text-white border-white/20"
                        : "text-white/40 border-transparent hover:text-white/60"
                    )}
                  >
                    🚀 {language === 'ka' ? 'პროექტები' : 'Projects'}
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0 select-none pb-1">
                  <button
                    type="button"
                    onClick={() => setIsFiltersOpen(true)}
                    className={cn("h-12 px-5 rounded-xl text-sm font-black uppercase tracking-widest transition-all border border-white/10 shadow-lg bg-white/5 text-white active:scale-95 flex items-center justify-center")}
                  >
                    ⚙️ {language === 'ka' ? 'ფილტრები' : 'Filters'}
                  </button>
                  
                  {/* Grid/Map simple compact button */}
                  <button
                    type="button"
                    onClick={() => setDisplayMode(displayMode === 'grid' ? 'map' : 'grid')}
                    className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 flex items-center justify-center shrink-0 animate-pulse-subtle"
                    title={displayMode === 'grid' ? (language === 'ka' ? 'რუკა' : 'Map') : (language === 'ka' ? 'ბადე' : 'Grid')}
                  >
                    {displayMode === 'grid' ? <MapPin size={18} /> : <LayoutGrid size={18} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-8 items-start w-full">
            {/* Desktop Left Sidebar: Categories/Filters */}
            {viewMode === 'browse' && (
              <aside className="hidden md:block w-72 shrink-0 space-y-6 sticky top-20 animate-in fade-in slide-in-from-left duration-300">
                <div className={cn("p-6 rounded-3xl border border-zinc-800/60 backdrop-blur-xl", currentTheme.card)}>
                  {FilterContent}
                </div>
              </aside>
            )}

            <div className="flex-1 min-w-0 space-y-8">
              {viewMode === 'browse' && displayMode === 'grid' && (
                <div className="space-y-12 animate-in fade-in duration-500">


                  {/* Section 2: Quick Highlights Navigation */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-sm">⚡</span>
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                        {language === 'ka' ? 'სწრაფი ნავიგაცია' : 'QUICK NAVIGATOR'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* All Categories */}
                      <button
                        type="button"
                        onClick={() => setActiveBottomTab('categories')}
                        className="bg-zinc-950/40 hover:bg-zinc-900/60 p-5 rounded-3xl min-h-[120px] flex flex-col justify-between text-left border border-zinc-900 transition-all duration-300 hover:-translate-y-0.5 shadow-md group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-zinc-900/80 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                          <LayoutGrid size={18} />
                        </div>
                        <p className="text-xs sm:text-sm font-black text-zinc-100 tracking-tight leading-tight uppercase">
                          {language === 'ka' ? 'ყველა კატეგორია' : 'All Categories'}
                        </p>
                      </button>

                      {/* Secondary on installment */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveListingType('product');
                          setSearch(language === 'ka' ? 'მეორადი' : 'Used');
                        }}
                        className="bg-gradient-to-br from-blue-700/40 to-blue-600/30 hover:from-blue-700/60 hover:to-blue-600/40 p-5 rounded-3xl min-h-[120px] flex flex-col justify-between text-left border border-blue-500/10 transition-all duration-300 hover:-translate-y-0.5 shadow-md relative overflow-hidden group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-200">
                          <Coins size={16} />
                        </div>
                        <p className="text-xs sm:text-sm font-black text-white tracking-tight leading-tight uppercase relative z-10">
                          {language === 'ka' ? 'მეორადი განვადებით' : 'Used Installment'}
                        </p>
                      </button>

                      {/* Mobile Phone */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCategory('technics');
                          setSearch(language === 'ka' ? 'ტელეფონი' : 'iPhone');
                        }}
                        className="bg-zinc-950/40 hover:bg-zinc-900/60 p-5 rounded-3xl min-h-[120px] flex flex-col justify-between text-left border border-zinc-900 transition-all duration-300 hover:-translate-y-0.5 shadow-md group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#dfb257]/10 flex items-center justify-center text-[#dfb257]">
                          📱
                        </div>
                        <p className="text-xs sm:text-sm font-black text-zinc-100 tracking-tight leading-tight uppercase font-sans">
                          {language === 'ka' ? 'მობილური ტელეფონი' : 'Mobile Phones'}
                        </p>
                      </button>

                      {/* Discounted */}
                      <button
                        type="button"
                        onClick={() => {
                          setSearch(language === 'ka' ? 'ფასდაკლება' : 'Discount');
                        }}
                        className="bg-rose-500/5 hover:bg-rose-500/10 p-5 rounded-3xl min-h-[120px] flex flex-col justify-between text-left border border-rose-500/10 transition-all duration-300 hover:-translate-y-0.5 shadow-md group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-450 font-black text-sm">
                          %
                        </div>
                        <p className="text-xs sm:text-sm font-black text-rose-400 tracking-tight leading-tight uppercase">
                          {language === 'ka' ? 'ფასდაკლებული' : 'With Discount'}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Popular Brand Shortcuts */}
                  <div className="p-6 bg-zinc-950/40 border border-zinc-900/80 rounded-[28px] space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-900/40 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🏷️</span>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 font-mono">
                          {language === 'ka' ? 'პოპულარული ბრენდები' : 'SHOP BY BRANDS'}
                        </h3>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-650 uppercase tracking-widest bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">shortcuts</span>
                    </div>

                    <div className="flex items-center gap-5 overflow-x-auto pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none scroll-smooth">
                      {/* Add shortcut circle */}
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            title: '', titleGe: '', description: '', descriptionGe: '',
                            price: '', currency: language === 'ka' ? 'GEL' : 'USD', category: 'technics', 
                            country: language === 'ka' ? 'GEO' : 'USA', city: '', location: '', images: [],
                            lat: undefined, lng: undefined, condition: 'new', isNegotiable: false,
                            listingType: 'product', serviceDuration: '', serviceTerms: ''
                          });
                          setViewMode('create');
                        }}
                        className="flex flex-col items-center gap-2.5 shrink-0 group focus:outline-none"
                      >
                        <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#dfb257] flex items-center justify-center bg-[#dfb257]/5 group-hover:bg-[#dfb257]/10 group-hover:scale-105 transition-all text-[#dfb257]">
                          <Plus size={20} className="stroke-[3]" />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors">
                          {language === 'ka' ? 'დამატება' : 'Add Listing'}
                        </span>
                      </button>

                      {/* Apple */}
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('Apple');
                          setActiveCategory('technics');
                        }}
                        className="flex flex-col items-center gap-2.5 shrink-0 group focus:outline-none"
                      >
                        <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-105 transition-all text-white font-sans font-black text-base shadow-sm">
                          
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors">
                          Apple
                        </span>
                      </button>

                      {/* Xiaomi */}
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('Xiaomi');
                          setActiveCategory('technics');
                        }}
                        className="flex flex-col items-center gap-2.5 shrink-0 group focus:outline-none"
                      >
                        <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center group-hover:scale-105 transition-all text-[#ff6700] font-mono font-black text-xs shadow-sm">
                          mi
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors">
                          Xiaomi
                        </span>
                      </button>

                      {/* Samsung */}
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('Samsung');
                          setActiveCategory('technics');
                        }}
                        className="flex flex-col items-center gap-2.5 shrink-0 group focus:outline-none"
                      >
                        <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center group-hover:scale-105 transition-all text-blue-400 font-sans font-black text-[9px] shadow-sm uppercase leading-none tracking-tighter">
                          SMG
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors">
                          Samsung
                        </span>
                      </button>

                      {/* Sony */}
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('Sony');
                          setActiveCategory('technics');
                        }}
                        className="flex flex-col items-center gap-2.5 shrink-0 group focus:outline-none"
                      >
                        <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center group-hover:scale-105 transition-all text-indigo-400 font-sans font-black text-[8px] tracking-tight shadow-sm uppercase">
                          SONY
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors">
                          Sony
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Section 4: Super VIP Listings Feed */}
                  <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3 pt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                        🚀
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-[0.15em] text-[#dfb257] font-sans">
                        SUPER VIP
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setActiveCategory('all');
                        setActiveListingType('all');
                      }}
                      className="text-xs font-bold text-zinc-450 hover:text-white transition-colors"
                    >
                      {language === 'ka' ? 'ყველას ნახვა' : 'See All'}
                    </button>
                  </div>
                </div>
              )}

              {viewMode === 'browse' && displayMode === 'map' ? (
              <ListingMap 
                listings={filteredListings}
                onSelectListing={(listing) => {
                  setCheckoutItem(listing);
                }}
                language={language}
                currentTheme={currentTheme}
              />
            ) : (
              <div className="space-y-8">
                {viewMode === 'my-listings' && profileSubMode === 'selling' && (
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 shadow-inner self-start max-w-md animate-in fade-in duration-300">
                    <button
                      type="button"
                      onClick={() => setActiveSellingTab('listings')}
                      className={cn(
                        "px-5 py-2.5 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-2 grow sm:grow-0 justify-center",
                        activeSellingTab === 'listings' 
                          ? "bg-white/10 text-white shadow-md border border-white/10" 
                          : "text-white/40 hover:text-white/60"
                      )}
                    >
                      <span>📦</span>
                      <span>{language === 'ka' ? 'ჩემი განცხადებები' : 'My Postings'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSellingTab('incoming-orders')}
                      className={cn(
                        "px-5 py-2.5 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-2 grow sm:grow-0 justify-center relative",
                        activeSellingTab === 'incoming-orders' 
                          ? "bg-white/10 text-white shadow-md border border-white/10" 
                          : "text-white/40 hover:text-white/60"
                      )}
                    >
                      <span>⚡</span>
                      <span>{language === 'ka' ? 'შემოსული შეკვეთები' : 'Incoming Books'}</span>
                      {sellerOrders.length > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 rounded-full text-[8px] font-black text-white ml-1">
                          {sellerOrders.length}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 sm:gap-6">
                  <AnimatePresence mode="popLayout">
                  {viewMode === 'my-listings' && (profileSubMode === 'buying' || activeSellingTab === 'incoming-orders') ? (
                    (profileSubMode === 'buying' ? buyerOrders : sellerOrders).map((order, idx) => {
                      const isExpanded = expandedOrderId === order.id;
                      const isService = order.orderType === 'service';
                      const isSeller = profileSubMode === 'selling';

                      return (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          key={order.id}
                          className={cn("p-8 rounded-[40px] border border-white/5 group relative overflow-hidden flex flex-col justify-between", currentTheme.card)}
                        >
                          <div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-proton-accent/5 blur-3xl rounded-full -mr-16 -mt-16" />
                            <div className="flex items-center justify-between mb-6 relative">
                              <div className={cn(
                                "p-4 rounded-2xl border border-white/5",
                                isService ? "bg-amber-500/10 text-amber-300" : "bg-white/5 text-white"
                              )}>
                                {isService ? <Zap size={20} /> : <ShoppingBag size={20} />}
                              </div>
                              <div className="text-right flex flex-col items-end gap-1.5">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest opacity-40 block", currentTheme.muted)}>
                                  {order.createdAt?.seconds 
                                    ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
                                    : order.createdAt instanceof Date 
                                      ? order.createdAt.toLocaleDateString() 
                                      : (order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'Active')}
                                </span>
                                
                                <span className={cn(
                                  "inline-flex px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em] rounded-lg border",
                                  order.status === 'completed' 
                                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                                    : order.status === 'in_progress'
                                    ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                    : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                )}>
                                  {order.status === 'booked' 
                                    ? (language === 'ka' ? '🚀 შეკვეთილია' : '🚀 Booked')
                                    : order.status === 'in_progress'
                                    ? (language === 'ka' ? '🛠️ მიმდინარე' : '🛠️ In Progress')
                                    : order.status === 'completed'
                                    ? (language === 'ka' ? '🎯 დასრულებული' : '🎯 Completed')
                                    : order.status}
                                </span>
                              </div>
                            </div>
                            
                            <h4 className="text-lg font-black text-white mb-2 uppercase tracking-tight leading-tight">{order.itemTitle}</h4>
                            <p className={cn("text-xs font-bold font-mono mb-4", currentTheme.muted)}>
                              {order.amount} {order.currency}
                            </p>

                            {isService && (
                              <div className="mt-4 bg-white/5 rounded-2xl p-4 border border-white/5 text-xs text-left">
                                <span className="text-[8px] font-black uppercase tracking-wider text-white/40 block mb-1">
                                  {language === 'ka' ? 'ტიპი' : 'Service Booking'}
                                </span>
                                <p className="text-white/80 font-bold">
                                  {language === 'ka' ? 'Professional Freelance სერვისი' : 'Professional Service Booking'}
                                </p>
                              </div>
                            )}

                            {isExpanded && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-6 pt-6 border-t border-white/5 text-left space-y-4"
                              >
                                {isService && order.buyerInstructions && (
                                  <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-white/40 block">
                                      {language === 'ka' ? 'მოთხოვნები შემსრულებლისთვის' : 'Client Requirements'}
                                    </span>
                                    <p className="text-[11px] font-medium text-white bg-black/45 p-3.5 rounded-xl border border-white/5 whitespace-pre-line leading-relaxed shadow-inner">
                                      {order.buyerInstructions}
                                    </p>
                                  </div>
                                )}

                                <div className="space-y-1 font-mono text-[9px] text-white/45">
                                  <p>ID: #{order.id}</p>
                                  <p>Role: {isSeller ? 'Service Provider' : 'Client'}</p>
                                </div>

                                {isService && isSeller && order.status !== 'completed' && (
                                  <div className="pt-2 flex flex-wrap gap-2">
                                    {order.status === 'booked' && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateOrderStatus(order.id, 'in_progress')}
                                        className={cn("px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-black bg-white hover:brightness-95 transition-all shadow-md active:scale-95")}
                                      >
                                        🛠️ {language === 'ka' ? 'მუშაობის დაწყება' : 'Begin Work'}
                                      </button>
                                    )}
                                    {order.status === 'in_progress' && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                                        className={cn("px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-black bg-green-400 hover:bg-green-500 transition-all shadow-md active:scale-95")}
                                      >
                                        🎯 {language === 'ka' ? 'მზადაა / დასრულება' : 'Mark Completed'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>

                          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between relative">
                             <span className={cn("text-[9px] font-bold opacity-30 font-mono", currentTheme.muted)}>#{order.id.substring(0, 12).toUpperCase()}</span>
                             <button 
                               type="button"
                               onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                               className="flex items-center gap-2 text-[10px] font-black uppercase text-[#2e5bff] hover:opacity-80 transition-opacity"
                             >
                               {isExpanded 
                                 ? (language === 'ka' ? 'დახურვა' : 'Close Details') 
                                 : (language === 'ka' ? 'დეტალები' : 'Details')} 
                               <ChevronRight size={14} className={cn("transition-transform", isExpanded && "rotate-90")} />
                             </button>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    filteredListings.map((listing, idx) => {
                      const isOwnListing = !!user && listing.sellerId === user.uid;
                      const isAdminUser = !!user && user.email === 'devdarianib@gmail.com';
                      const canManageListing = isOwnListing || isAdminUser;

                      return (
                <motion.article 
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  key={listing.id}
                  transition={{ delay: idx * 0.03 }}
                  className={cn(
                    "group rounded-2xl overflow-hidden transition-all duration-300 flex flex-col relative border border-zinc-900/40 bg-zinc-950/40 hover:border-[#dfb257]/30 hover:shadow-[0_8px_30px_rgba(223,178,87,0.05)] hover:-translate-y-1 hover:bg-zinc-950/60",
                    currentTheme.card
                  )}
                >
                  <div 
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      setCheckoutItem(listing);
                    }}
                    className="w-full h-44 sm:h-48 bg-zinc-900/80 overflow-hidden relative cursor-pointer"
                  >
                    {(listing.images && listing.images.length > 0) || listing.image ? (
                      <motion.img 
                        src={listing.images && listing.images.length > 0 ? listing.images[0] : (listing.image || '/placeholder-image.jpg')} 
                        alt={language === 'ka' ? (listing.titleGe || listing.title) : listing.title} 
                        className="w-full h-full object-cover transition-transform duration-500 ease-out bg-zinc-950"
                        whileHover={{ scale: 1.05 }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={cn("w-full h-full flex items-center justify-center bg-zinc-900/90")}>
                        <ShoppingBag size={24} className={cn("opacity-10", currentTheme.accent)} />
                      </div>
                    )}
                    
                    {/* Badge Overlay */}
                    <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
                      <div className="px-2 py-0.5 bg-black/80 backdrop-blur-md rounded-lg border border-white/5 flex items-center gap-1 shadow-sm">
                        <span className="text-[10px] sm:text-[9px] leading-none">{CATEGORY_EMOJIS[listing.category as keyof typeof CATEGORY_EMOJIS] || '🏷️'}</span>
                        <span className="text-[9px] font-black text-proton-accent uppercase tracking-wider">
                          {t.market.categories[listing.category as keyof typeof t.market.categories]}
                        </span>
                      </div>
                      <div className="px-2 py-0.5 bg-black/80 backdrop-blur-md rounded-lg border border-white/5 flex items-center gap-1 shadow-sm">
                        <span className="text-[10px] sm:text-[9px]">{WORLD_COUNTRIES.find(c => c.code === listing.country)?.flag || '🌐'}</span>
                        <span className="text-[9px] font-black text-white/90 uppercase tracking-widest">{listing.city}</span>
                      </div>
                      {sellerRatings[listing.sellerId]?.avg >= 4.5 && (
                        <div className="px-2 py-0.5 bg-proton-accent text-proton-on-accent rounded-lg flex items-center gap-1 shadow-sm border border-proton-accent/20">
                          <Star size={8} className="fill-current text-proton-on-accent" />
                          <span className="text-[8px] font-black uppercase tracking-wider">
                            {language === 'ka' ? '✓ ტოპ გამყიდველი' : '✓ TOP VENDOR'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="absolute top-3 right-3 flex gap-1.5 z-10">
                      <button
                        onClick={(e) => toggleFavorite(listing.id, e)}
                        className={cn(
                          "w-9 h-9 flex items-center justify-center backdrop-blur-md rounded-lg border transition-all active:scale-90",
                          favorites.includes(listing.id)
                            ? "bg-red-500/10 border-red-500/20 text-red-500 shadow-md"
                            : "bg-black/80 border-white/10 text-zinc-350 hover:text-red-500"
                        )}
                        title={language === 'ka' ? 'რჩეულებში დამატება' : 'Add to Favorites'}
                      >
                        <Heart size={14} fill={favorites.includes(listing.id) ? "currentColor" : "none"} className="stroke-[2.5]" />
                      </button>
                      {canManageListing && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(listing);
                            }}
                            className={cn("w-9 h-9 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white transition-all hover:bg-white hover:text-black")}
                            title={language === 'ka' ? 'რედაქტირება' : 'Edit'}
                          >
                            <Edit3 className="size-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteListing(listing.id);
                            }}
                            className="w-9 h-9 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white transition-all hover:bg-rose-500 hover:border-rose-500/30"
                            title={language === 'ka' ? 'წაშლა' : 'Delete'}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                  </div>

                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h2 
                        onClick={() => setCheckoutItem(listing)}
                        className="text-sm sm:text-base font-bold tracking-tight text-white hover:text-[#dfb257] cursor-pointer transition-colors line-clamp-2 leading-snug mb-1.5"
                      >
                        {language === 'ka' ? (listing.titleGe || listing.title) : listing.title}
                      </h2>
                      <p className="text-xs font-sans text-zinc-400 font-medium leading-relaxed line-clamp-2">
                        {language === 'ka' ? (listing.descriptionGe || listing.description) : listing.description}
                      </p>
                    </div>

                    <div className={cn("pt-3 border-t", currentTheme.border)}>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mb-0.5 block">{t.market.price}</span>
                          <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#dfb257] flex items-baseline gap-0.5">
                            {convertPrice(listing.price, listing.currency || 'USD', displayCurrency).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            <span className="text-xs font-bold text-zinc-400 font-sans ml-1">{displayCurrency}</span>
                          </span>
                        </div>

                        {/* Product / Service / Project Badge */}
                        {listing.listingType === 'service' || listing.category === 'service' ? (
                          <span className="inline-flex px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-sm shrink-0">
                            {language === 'ka' ? 'სერვისი' : 'Service'}
                          </span>
                        ) : listing.listingType === 'project' || listing.category === 'project' ? (
                          <span className="inline-flex px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-sm shrink-0">
                            {language === 'ka' ? 'პროექტი' : 'Project'}
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-[#dfb257]/10 border border-[#dfb257]/20 text-zinc-200 shadow-sm shrink-0">
                            {language === 'ka' ? 'პროდუქტი' : 'Product'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVendor({ id: listing.sellerId, name: listing.sellerName });
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] relative cursor-pointer hover:border-[#dfb257]/50 transition-all border shrink-0 bg-zinc-900 text-white border-zinc-800"
                            title={language === 'ka' ? 'გამყიდველის პროფილი' : 'Vendor Profile'}
                          >
                            {listing.sellerName.substring(0, 2).toUpperCase()}
                            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-zinc-950" />
                          </div>
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVendor({ id: listing.sellerId, name: listing.sellerName });
                            }}
                            className="min-w-0 cursor-pointer group/vendor flex-1"
                            title={language === 'ka' ? 'გამყიდველის პროფილი და შეფასებები' : 'Vendor Profile & Reviews'}
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-xs font-bold tracking-wide truncate block text-zinc-200 group-hover/vendor:text-[#dfb257] transition-colors">{listing.sellerName}</span>
                              <ShieldCheck size={11} className="shrink-0 text-[#dfb257]" />
                            </div>
                            <div className="flex items-center mt-0.5 min-w-0">
                              {sellerRatings[listing.sellerId] && sellerRatings[listing.sellerId].count > 0 ? (
                                <div className="flex items-center gap-0.5">
                                  <Star size={9} className="fill-[#dfb257] text-[#dfb257]" />
                                  <span className="text-[10px] font-black text-[#dfb257]">{sellerRatings[listing.sellerId].avg.toFixed(1)}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{language === 'ka' ? 'ახალი' : 'New'}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 select-none">
                          {/* Chat Button */}
                          {!isOwnListing && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveChatListing(listing);
                              }}
                              className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-white/60 hover:text-[#dfb257] hover:bg-white/10 transition-all flex items-center justify-center"
                              title={language === 'ka' ? 'კონტაქტი გამყიდველთან' : 'Contact Vendor'}
                            >
                              <MessageCircle size={14} />
                            </button>
                          )}

                          {/* Quick Add to Cart button */}
                          {!isOwnListing && !(listing.status === 'sold' || listing.isSold) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(listing);
                              }}
                              className="w-8 h-8 rounded-lg transition-all shadow-md active:scale-90 hover:scale-105 bg-[#dfb257] text-[#070708] hover:bg-[#ebd083] focus:outline-none flex items-center justify-center border border-[#dfb257]/30"
                              title={language === 'ka' ? 'კალათაში დამატება' : 'Add to Cart'}
                            >
                              <ShoppingCart size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        {isOwnListing ? (
                          <div className="flex gap-1.5">
                            <button 
                              onClick={() => startEdit(listing)}
                              className={cn(
                                "flex-1 h-9 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 border border-white/5 hover:bg-white/10 text-white",
                                currentTheme.accentBg
                              )}
                            >
                              <Edit3 size={12} />
                              {t.market.edit_listing}
                            </button>
                            <button 
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm(t.market.delete_confirm)) {
                                  try {
                                    await deleteDoc(doc(db, 'listings', listing.id));
                                    setListings(prev => prev.filter(l => l.id !== listing.id));
                                  } catch (error) {
                                    console.error("Failed to delete", error);
                                  }
                                }
                              }}
                              className="w-9 h-9 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg text-[9px] font-black transition-all flex items-center justify-center shrink-0"
                              title={language === 'ka' ? 'წაშლა' : 'Delete'}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : listing.status === 'sold' || listing.isSold ? (
                          <button 
                            disabled
                            className="w-full h-9 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider bg-zinc-800 text-zinc-500 border border-zinc-700/50 flex items-center justify-center gap-1.5 cursor-not-allowed"
                          >
                            {language === 'ka' ? 'გაყიდულია' : 'SOLD'}
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleBuyNow(listing)}
                            className={cn(
                              "w-full h-9 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md hover:shadow-proton-accent/20 active:scale-[0.98]",
                              currentTheme.accentBg, "text-white"
                            )}
                          >
                            <ShoppingBag size={12} />
                            {t.market.buy_now}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.article>
                );
              })
               )}
            </AnimatePresence>
          </div>
        </div>
      )}

            {!loading && filteredListings.length === 0 && (
              <div className="py-32 text-center space-y-6">
                <div className="w-20 h-20 bg-white/5 rounded-[40px] flex items-center justify-center mx-auto border border-white/10">
                  <Search size={32} className={cn("opacity-20", currentTheme.muted)} />
                </div>
                <p className={cn("text-sm font-bold uppercase tracking-widest", currentTheme.muted)}>{t.market.no_results}</p>
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-20">
                <Loader2 className={cn("w-10 h-10 animate-spin", currentTheme.accent)} />
              </div>
            )}
          </div>



          {/* Mobile Filters Drawer */}
          <AnimatePresence>
            {isFiltersOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsFiltersOpen(false)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
                />
                <motion.div 
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className={cn(
                    "fixed right-0 top-16 bottom-0 w-[85%] max-w-sm z-[70] p-8 lg:hidden border-l border-white/5 flex flex-col backdrop-blur-[20px] max-h-[calc(100vh-theme(spacing.16))] overflow-y-auto",
                    currentTheme.card
                  )}
                >
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pt-4">
                    {FilterContent}
                  </div>
                  <div className="mt-8">
                    <button 
                      onClick={() => setIsFiltersOpen(false)}
                      className={cn("w-full py-4 text-[#070708] rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-black/80", currentTheme.accentBg)}
                    >
                      {language === 'ka' ? 'შედეგების ჩვენება' : 'Apply Filters'}
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "max-w-2xl mx-auto p-6 sm:p-12 rounded-[32px] sm:rounded-[48px] border backdrop-blur-2xl relative overflow-hidden shadow-[0_24px_50px_-12px_rgba(0,0,0,0.7)]", 
            "bg-zinc-950/75 border-zinc-800/80 hover:border-[#dfb257]/30 transition-colors duration-500"
          )}
        >
           {/* Futuristic Background Gradients */}
           <div className="absolute top-0 left-0 w-64 h-64 bg-[#dfb257]/5 rounded-full blur-[120px] pointer-events-none" />
           <div className="absolute bottom-0 right-0 w-64 h-64 bg-zinc-800/20 rounded-full blur-[100px] pointer-events-none" />

           <form onSubmit={handleSubmitListing} className="space-y-10 relative z-10">
              {/* Dynamic Interactive Steps Header */}
              <div className="flex flex-col gap-6 mb-8 pb-8 border-b border-zinc-900/80">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                       <div className="p-3 rounded-2xl bg-[#dfb257]/10 text-[#dfb257] border border-[#dfb257]/20 shadow-[0_0_15px_rgba(223,178,87,0.1)] select-none">
                          <Plus size={20} className="stroke-[2.5]" />
                       </div>
                       <div>
                          <h2 className="text-base font-black uppercase tracking-wider text-white font-sans">
                             {viewMode === 'create' ? (language === 'ka' ? 'განცხადების შექმნა' : 'Create Listing') : (language === 'ka' ? 'რედაქტირება' : 'Edit Listing')}
                          </h2>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-pulse" />
                             <p className="text-[10px] font-black text-proton-accent uppercase tracking-widest">
                                {language === 'ka' ? `ნაბიჯი ${formStep} 3-დან` : `Step ${formStep} of 3`}
                             </p>
                          </div>
                       </div>
                    </div>
                    
                    {/* Compact step progress radial tracker */}
                    <div className="text-[10px] font-mono font-black text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-900 select-none">
                       PROGRESS: {formStep === 1 ? '33%' : formStep === 2 ? '66%' : '100%'}
                    </div>
                 </div>

                 {/* Stunning Interconnecting Modern Custom Stepper Slider */}
                 <div className="relative pt-2">
                    {/* Background Progress Railway Line */}
                    <div className="absolute top-6 left-0 right-0 h-[2px] bg-proton-border/45 rounded-full">
                       <div 
                          className="h-full bg-proton-accent transition-all duration-500 rounded-full"
                          style={{ width: formStep === 1 ? '16.66%' : formStep === 2 ? '50%' : '83.33%' }}
                       />
                    </div>
                    
                    <div className="flex items-center justify-between relative">
                       {[1, 2, 3].map((step) => {
                          const stepTitles = [
                             language === 'ka' ? 'კატეგორია' : 'Classification',
                             language === 'ka' ? 'ფასი & პირობები' : 'Price & Terms',
                             language === 'ka' ? 'ლოკაცია & მედია' : 'Media & Map'
                          ];
                          const isCompleted = formStep > step;
                          const isActive = formStep === step;

                          return (
                             <button
                                key={step}
                                type="button"
                                onClick={() => {
                                   if (step > 1 && !formData.title.trim()) {
                                      alert(language === 'ka' ? "გთხოვთ პირველ ნაბიჯზე შეიყვანოთ სათაური გასაგრძელებლად" : "Please input a listing title on Step 1 first.");
                                      return;
                                   }
                                   setFormStep(step);
                                }}
                                className="group flex flex-col items-center focus:outline-none transition-all duration-300"
                             >
                                <div className={cn(
                                   "w-10 h-10 rounded-full border flex items-center justify-center text-xs font-black transition-all duration-500 z-10",
                                   isActive
                                      ? "bg-[#dfb257] border-[#dfb257] text-[#070708] shadow-[0_0_20px_rgba(223,178,87,0.4)] scale-110"
                                      : isCompleted
                                      ? "bg-zinc-950 border-[#dfb257]/60 text-[#dfb257] hover:border-[#dfb257]"
                                      : "bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800"
                                )}>
                                   {isCompleted ? (
                                      <ShieldCheck size={16} className="stroke-[2.5]" />
                                   ) : (
                                      <span className="font-mono">{step}</span>
                                   )}
                                </div>
                                <span className={cn(
                                   "text-[9px] font-black uppercase tracking-widest mt-2.5 transition-all duration-500",
                                   isActive ? "text-[#dfb257]" : "text-zinc-550 group-hover:text-zinc-400"
                                )}>
                                   {stepTitles[step - 1]}
                                </span>
                             </button>
                          );
                       })}
                    </div>
                 </div>
              </div>

              {/* STEP 1: Core Classification & Info */}
              {formStep === 1 && (
                 <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-8 animate-in fade-in"
                 >
                    {/* Listing Type Premium Cards Selection */}
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                             <span>⚡</span> {language === 'ka' ? 'განცხადების კლასიფიკაცია' : 'Classification Class'}
                          </label>
                          <span className="text-[8px] font-mono text-zinc-600 block uppercase">Select node archetype</span>
                       </div>
                       
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {[
                             { 
                                type: 'service', 
                                emoji: '⚡', 
                                labelEn: 'Service', 
                                labelKa: 'სერვისი',
                                descEn: 'Professional expertise & tasks',
                                descKa: 'ტექნიკური ან სხვა მომსახურება'
                             },
                             { 
                                type: 'product', 
                                emoji: '📦', 
                                labelEn: 'Product', 
                                labelKa: 'პროდუქტი',
                                descEn: 'Componentry & inventory items',
                                descKa: 'დანადგარები, ნაწილები და ქონება'
                             },
                             { 
                                type: 'project', 
                                emoji: '🚀', 
                                labelEn: 'Project', 
                                labelKa: 'პროექტი',
                                descEn: 'Complex ventures & systems',
                                descKa: 'კომპლექსური საინჟინრო ინიციატივები'
                             }
                          ].map(item => {
                             const isSelected = formData.listingType === item.type;
                             return (
                                <button
                                   key={item.type}
                                   type="button"
                                   onClick={() => {
                                      setFormData(prev => ({ 
                                         ...prev, 
                                         listingType: item.type as any,
                                         category: item.type === 'service' 
                                            ? 'service' 
                                            : item.type === 'project' 
                                            ? 'project' 
                                            : 'technics'
                                      }));
                                   }}
                                   className={cn(
                                      "relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center gap-2 hover:scale-[1.03] group overflow-hidden",
                                      isSelected
                                         ? "bg-[#dfb257]/10 border-[#dfb257] text-[#dfb257] shadow-[0_8px_20px_-6px_rgba(223,178,87,0.15)] ring-1 ring-[#dfb257]/30"
                                         : "bg-zinc-950/70 border-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-900/40 hover:border-zinc-800"
                                   )}
                                >
                                   {/* Mini neon glowing point */}
                                   {isSelected && (
                                      <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#dfb257] shadow-[0_0_8px_#dfb257]" />
                                   )}
                                   <span className="text-2xl mb-1 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-300">
                                      {item.emoji}
                                   </span>
                                   <span className="text-xs font-black uppercase tracking-wider">
                                      {language === 'ka' ? item.labelKa : item.labelEn}
                                   </span>
                                   <span className="text-[8px] font-semibold text-zinc-550 leading-relaxed max-w-[150px] uppercase tracking-wide">
                                      {language === 'ka' ? item.descKa : item.descEn}
                                   </span>
                                </button>
                             );
                          })}
                       </div>
                    </div>

                    {/* Listing Category Selection */}
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                          <span>📁</span> {t.market.form.category}
                       </label>
                       <div className="relative group">
                          <select 
                             value={formData.category}
                             onChange={e => setFormData({...formData, category: e.target.value})}
                             className={cn(
                                "w-full pl-4 pr-10 py-3.5 rounded-2xl border appearance-none text-xs font-bold text-white tracking-wide shadow-inner transition-all",
                                "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                currentTheme.input
                             )}
                          >
                             {Object.entries(t.market.categories).map(([key, label]) => (
                                <option key={key} value={key} className="bg-zinc-950 text-white font-semibold py-2">
                                   {label as string}
                                </option>
                             ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none group-hover:text-zinc-300 transition-colors" />
                       </div>
                    </div>

                    {/* Title in EN & GE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div className="space-y-3">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <span className="text-xs">🇬🇧</span>
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t.market.form.title} (EN)</label>
                             </div>
                             <span className="text-[8px] font-mono text-zinc-650">{language === 'ka' ? 'სავალდებულო' : 'Required'}</span>
                          </div>
                          <div className="relative">
                             <FastInput 
                                required
                                type="text"
                                value={formData.title}
                                onCommit={val => setFormData(p => ({ ...p, title: val }))}
                                placeholder={language === 'ka' ? 'მაგ: ინდუსტრიული მართვის პულტი v3' : 'e.g. Industrial Control Unit v3'}
                                className={cn(
                                   "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-bold text-white shadow-inner transition-all",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10 placeholder-zinc-550",
                                   currentTheme.input
                                )}
                             />
                          </div>
                       </div>

                       <div className="space-y-3">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <span className="text-xs">🇬🇪</span>
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257]">{t.market.form.title} (GE)</label>
                             </div>
                             <span className="text-[8px] font-mono text-zinc-650">{language === 'ka' ? 'თარგმანი არჩევითია' : 'Optional Translation'}</span>
                          </div>
                          <div className="relative">
                             <FastInput 
                                type="text"
                                value={formData.titleGe}
                                onCommit={val => setFormData(p => ({ ...p, titleGe: val }))}
                                placeholder={language === 'ka' ? 'მაგ: ინდუსტრიული მართვის პულტი' : 'e.g. Industrial Control Unit (GE)'}
                                className={cn(
                                   "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-bold text-white shadow-inner transition-all",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10 placeholder-zinc-600",
                                   currentTheme.input
                                )}
                             />
                          </div>
                       </div>
                    </div>
                 </motion.div>
              )}

              {/* STEP 2: Financials & Characteristics */}
              {formStep === 2 && (
                 <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-8 animate-in fade-in"
                 >
                    {/* Price and Currency input fields side-by-side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                             <span>🪙</span> {t.market.form.price}
                          </label>
                          <div className="relative group">
                             <div className="absolute left-4.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <Coins size={14} className="text-[#dfb257] opacity-70 group-focus-within:opacity-100 transition-opacity" />
                             </div>
                             <FastInput 
                                required
                                type="number"
                                value={formData.price}
                                onCommit={val => setFormData(p => ({ ...p, price: val }))}
                                placeholder="0.00"
                                className={cn(
                                   "w-full pl-11 pr-4 py-3.5 rounded-2xl border text-xs font-bold text-white shadow-inner transition-all",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10 placeholder-zinc-600",
                                   currentTheme.input
                                )}
                             />
                          </div>
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                             <span>💵</span> {t.market.form.currency}
                          </label>
                          <div className="relative group">
                             <select 
                                value={formData.currency}
                                onChange={e => setFormData({...formData, currency: e.target.value})}
                                className={cn(
                                   "w-full pl-4.5 pr-10 py-3.5 rounded-2xl border appearance-none text-xs font-mono font-bold text-white transition-all cursor-pointer",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                   currentTheme.input
                                )}
                             >
                                {CURRENCIES.map(curr => (
                                   <option key={curr.code} value={curr.code} className="bg-zinc-950 text-white font-mono font-bold">
                                      {curr.code} ({curr.symbol})
                                   </option>
                                ))}
                             </select>
                             <ChevronDown size={14} className="absolute right-4.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none group-hover:text-zinc-300 transition-colors" />
                          </div>
                       </div>
                    </div>

                    {/* Product Condition Selection Header & Premium Sliding Tabs */}
                    <div className="space-y-4">
                       <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                          <span>📦</span> {language === 'ka' ? 'აქტივის მდგომარეობა' : 'Asset Operational Condition'}
                       </label>
                       
                       {/* Interactive 3-Segment Navigation Switcher */}
                       <div className="grid grid-cols-3 gap-3 p-1.5 rounded-2xl bg-[#09090b]/90 border border-zinc-900">
                          {[
                             { id: 'new', icon: '✨', titleEn: 'Brand New', titleKa: 'ახალი-ახალი' },
                             { id: 'used', icon: '⚙️', titleEn: 'Used', titleKa: 'მეორადი' },
                             { id: 'refurbished', icon: '🛠️', titleEn: 'Restored', titleKa: 'აღდგენილი' }
                          ].map(cond => {
                             const isAct = formData.condition === cond.id;
                             return (
                                <button
                                   key={cond.id}
                                   type="button"
                                   onClick={() => setFormData({...formData, condition: cond.id})}
                                   className={cn(
                                      "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5",
                                      isAct 
                                         ? "bg-[#dfb257] text-[#070708] shadow-[0_4px_12px_rgba(223,178,87,0.25)] scale-102"
                                         : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
                                   )}
                                >
                                   <span className="text-xs">{cond.icon}</span>
                                   <span className="text-[9px] font-black">{language === 'ka' ? cond.titleKa : cond.titleEn}</span>
                                </button>
                             );
                          })}
                       </div>
                    </div>

                    {/* Beautiful Price Negotiable Box & Switch */}
                    <div className="p-1 px-4 py-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-900/80 flex items-center justify-between gap-4">
                       <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-[#dfb257]/10 text-[#dfb257] border border-[#dfb257]/20">
                             <Tag size={14} className="stroke-[2.5]" />
                          </div>
                          <div>
                             <h4 className="text-xs font-black uppercase tracking-wider text-white">
                                {language === 'ka' ? 'ფასი შეთანხმებით' : 'Price Offer Open'}
                             </h4>
                             <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mt-0.5">
                                {language === 'ka' ? 'ფასი ექვემდებარება მოლაპარაკებას' : 'Listing allows open technical bids'}
                             </p>
                          </div>
                       </div>

                       <button
                          type="button"
                          onClick={() => setFormData({...formData, isNegotiable: !formData.isNegotiable})}
                          className={cn(
                             "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none",
                             formData.isNegotiable ? "bg-[#dfb257]" : "bg-zinc-850"
                          )}
                       >
                          <span
                             className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out",
                                formData.isNegotiable ? "translate-x-5" : "translate-x-0"
                             )}
                          />
                       </button>
                    </div>

                    {/* Service specific high-contrast characteristics */}
                    {formData.listingType === 'service' && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-3xl bg-[#dfb257]/5 border border-[#dfb257]/15 shadow-inner">
                          <div className="space-y-3">
                             <label className="text-[9px] font-black uppercase tracking-wider text-[#dfb257] flex items-center gap-1 ml-0.5">
                                <span className="text-[10px]">⏱️</span> {language === 'ka' ? 'შესრულების ვადა' : 'Delivery Lead Time'}
                             </label>
                             <FastInput 
                                type="text"
                                value={formData.serviceDuration || ''}
                                onCommit={val => setFormData(p => ({ ...p, serviceDuration: val }))}
                                placeholder={language === 'ka' ? "მაგ: 3 დღე" : "e.g. 3 business days"}
                                className={cn(
                                   "w-full px-4 py-3 rounded-xl border text-xs font-bold text-white transition-all placeholder-zinc-650",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257]",
                                   currentTheme.input
                                )}
                             />
                          </div>

                          <div className="space-y-3">
                             <label className="text-[9px] font-black uppercase tracking-wider text-[#dfb257] flex items-center gap-1 ml-0.5">
                                <span className="text-[10px]">📋</span> {language === 'ka' ? 'სამუშაო პირობები' : 'Technical Specifications Requirement'}
                             </label>
                             <FastInput 
                                type="text"
                                value={formData.serviceTerms || ''}
                                onCommit={val => setFormData(p => ({ ...p, serviceTerms: val }))}
                                placeholder={language === 'ka' ? "მაგ: სრული ტექნიკური დავალება" : "e.g. Detailed project specs"}
                                className={cn(
                                   "w-full px-4 py-3 rounded-xl border text-xs font-bold text-white transition-all placeholder-zinc-650",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257]",
                                   currentTheme.input
                                )}
                             />
                          </div>
                       </div>
                    )}
                 </motion.div>
              )}

              {/* STEP 3: Location, Coordinates and Media Upload */}
              {formStep === 3 && (
                 <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-8 animate-in fade-in"
                 >
                    {/* Country and City Inputs Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                             <span>🗺️</span> {t.market.form.country}
                          </label>
                          <div className="relative group">
                             <select 
                                value={formData.country}
                                onChange={e => setFormData({...formData, country: e.target.value})}
                                className={cn(
                                   "w-full pl-4.5 pr-10 py-3.5 rounded-2xl border appearance-none text-xs font-bold text-white transition-all cursor-pointer",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                   currentTheme.input
                                )}
                             >
                                {WORLD_COUNTRIES.filter(c => c.code !== 'GLOBAL').map(country => (
                                   <option key={country.code} value={country.code} className="bg-zinc-950 text-white font-bold text-xs py-1">
                                      {country.flag} {country.name}
                                   </option>
                                ))}
                             </select>
                             <ChevronDown size={14} className="absolute right-4.5 top-1/2 -translate-y-1/2 text-zinc-550 pointer-events-none group-hover:text-zinc-300 transition-colors" />
                          </div>
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                             <span>🏙️</span> {t.market.form.city}
                          </label>
                          <div className="relative">
                             <FastInput 
                                required
                                type="text"
                                value={formData.city}
                                onCommit={val => setFormData(p => ({ ...p, city: val }))}
                                placeholder={language === 'ka' ? 'მაგ: თბილისი' : 'e.g. Tbilisi'}
                                className={cn(
                                   "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-bold text-white shadow-inner transition-all placeholder-zinc-550",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                   currentTheme.input
                                )}
                             />
                          </div>
                       </div>
                    </div>

                    {/* Address Location Input */}
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                          <span>📍</span> {t.market.form.location}
                       </label>
                       <div className="relative group">
                          <MapPin size={14} className="absolute left-4.5 top-1/2 -translate-y-1/2 text-zinc-550 group-focus-within:text-[#dfb257] transition-colors" />
                          <FastInput 
                             type="text"
                             value={formData.location}
                             onCommit={val => setFormData(p => ({ ...p, location: val }))}
                             placeholder={language === 'ka' ? 'მისამართის დეტალები/მითითებები...' : 'Detailed address directions...'}
                             className={cn(
                                "w-full pl-11 pr-4 py-3.5 rounded-2xl border text-xs font-bold text-white shadow-inner transition-all placeholder-zinc-550",
                                "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                currentTheme.input
                             )}
                          />
                       </div>
                    </div>

                    {/* Interactive Map Coordinates Picker Container with Telemetry Frame */}
                    <div className="space-y-3">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                             <span>🛰️</span> {language === 'ka' ? 'გეო-ლოკალური კოორდინირება' : 'Coordinate Telemetry Scope'}
                          </label>
                          <span className="text-[8px] font-mono text-zinc-550 block uppercase">
                             COORDS: {formData.lat !== undefined && formData.lat !== null ? formData.lat.toFixed(4) : "41.7151"}, {formData.lng !== undefined && formData.lng !== null ? formData.lng.toFixed(4) : "44.8271"}
                          </span>
                       </div>
                       
                       <div className="p-1 rounded-[28px] bg-black/60 border border-zinc-850/50 overflow-hidden shadow-2xl relative">
                          {/* Design-consistent Corner tech indicators */}
                          <div className="absolute top-3 left-4 text-[7px] font-mono font-black text-[#dfb257]/40 z-20 pointer-events-none uppercase tracking-widest">
                             GPS LINKED
                          </div>
                          <div className="absolute bottom-3 right-4 text-[7px] font-mono font-black text-zinc-650 z-20 pointer-events-none uppercase tracking-widest">
                             SYSTEM ACTIVE
                          </div>
                          
                          <div className="h-48 rounded-[24px] overflow-hidden">
                             <MapPicker 
                                lat={formData.lat}
                                lng={formData.lng}
                                onChange={(lat, lng) => setFormData(prev => ({ ...prev, lat, lng }))}
                                language={language}
                                currentTheme={currentTheme}
                             />
                          </div>
                       </div>
                    </div>

                    {/* Form Description and Spark AI Helper Button */}
                    <div className="space-y-3">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                             <span>📋</span> {t.market.form.description}
                          </label>
                          
                          <button
                             type="button"
                             onClick={handleAiDescription}
                             disabled={isAiGenerating}
                             className={cn(
                                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                "bg-gradient-to-r from-[#dfb257]/10 via-[#dfb257]/5 to-transparent border border-[#dfb257]/20 hover:border-[#dfb257]/70 text-[#dfb257] hover:shadow-[0_0_15px_rgba(223,178,87,0.15)] disabled:opacity-50"
                             )}
                          >
                             {isAiGenerating ? (
                                <Loader2 size={10} className="animate-spin" />
                             ) : (
                                <Sparkles size={10} className="stroke-[2.5] text-[#dfb257]" />
                             )}
                             {language === 'ka' ? 'AI შაბლონი' : 'AI Generate Specification'}
                          </button>
                       </div>
                       
                       <textarea 
                          required
                          value={formData.description}
                          onChange={e => setFormData({...formData, description: e.target.value})}
                          placeholder={language === 'ka' ? 'მიუთითეთ დეტალური ტექნიკური სპეციფიკაციები...' : 'Provide highly detailed product technical specifications...'}
                          className={cn(
                             "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-semibold h-36 resize-none text-white shadow-inner transition-all",
                             "bg-[#09090b]/95 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10 placeholder-zinc-650",
                             currentTheme.input
                          )}
                       />
                    </div>

                    {/* Graphic/Image upload box with scanners */}
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                          <span>🖼️</span> {t.market.form.image_url}
                       </label>
                       
                       <label 
                          className={cn(
                             "w-full h-44 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all overflow-hidden group relative",
                             (formData.images?.[0] || isResizing) 
                                ? "border-transparent bg-black/60 shadow-[0_8px_30px_rgb(0,0,0,0.8)]" 
                                : "bg-[#09090b]/60 border-zinc-850/70 hover:border-[#dfb257]/40 hover:bg-[#09090b]/90"
                          )}
                       >
                          {/* Decorative scanner line */}
                          {!formData.images?.[0] && !isResizing && (
                             <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#dfb257]/30 to-transparent group-hover:animate-ping pointer-events-none" />
                          )}
                          
                          <input 
                             type="file" 
                             onChange={handleFileUpload}
                             accept="image/*"
                             className="hidden"
                          />
                          
                          {isResizing ? (
                             <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-[#dfb257]" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-[#dfb257] tracking-widest">
                                   {language === 'ka' ? 'ინფორმაცია მუშავდება...' : 'Optimizing Visual Asset...'}
                                </span>
                             </div>
                          ) : formData.images?.[0] ? (
                             <div className="relative w-full h-full p-2.5">
                                <img 
                                   src={formData.images[0]} 
                                   className="w-full h-full object-cover rounded-2xl transition-transform duration-700 group-hover:scale-[1.03]" 
                                   alt={formData.title} 
                                />
                                
                                <div className="absolute bottom-5 left-5 bg-black/85 border border-[#dfb257]/30 px-3 py-1.5 rounded-xl backdrop-blur-md select-none pointer-events-none animate-fade-in">
                                   <div className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#dfb257] animate-pulse" />
                                      <span className="text-[8px] font-mono font-black text-white uppercase tracking-wider">
                                         ASSET READY
                                      </span>
                                   </div>
                                </div>
                                
                                <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-3xl duration-300">
                                   <span className="text-[9px] font-black uppercase tracking-widest text-[#dfb257] border border-[#dfb257]/30 bg-black/85 px-4.5 py-2.5 rounded-xl flex items-center gap-2 hover:scale-105 transition-all">
                                      <Camera size={12} className="text-[#dfb257]" /> 
                                      {language === 'ka' ? 'სურათის შეცვლა' : 'Replace Image Asset'}
                                   </span>
                                </div>
                             </div>
                          ) : (
                             <div className="flex flex-col items-center gap-3.5 select-none text-center px-6">
                                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-900 group-hover:scale-105 transition-transform text-zinc-500 group-hover:text-[#dfb257] group-hover:border-[#dfb257]/30 group-hover:shadow-[0_0_15px_rgba(223,178,87,0.1)] duration-300">
                                   <Camera size={22} />
                                </div>
                                <div className="space-y-1">
                                   <span className="text-[10px] font-black text-zinc-400 block uppercase tracking-wider group-hover:text-white transition-colors">
                                      {t.market.form.upload_button}
                                   </span>
                                   <span className="text-[8px] font-semibold text-zinc-650 block uppercase tracking-widest">
                                      {language === 'ka' ? 'PNG, JPG ან WEBP (მაქს. 5MB)' : 'PNG, JPG or WEBP (Max 5MB)'}
                                   </span>
                                </div>
                             </div>
                          )}
                       </label>

                       <div className="relative mt-2.5 group">
                          <Link size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-550 group-focus-within:text-[#dfb257] transition-colors" />
                          <input 
                             type="url"
                             value={formData.images?.[0] || ''}
                             onChange={e => setFormData({...formData, images: [e.target.value]})}
                             placeholder={language === 'ka' ? '...ან ჩასვით სურათის გარე ბმული (URL)' : '...or paste external image link URL'}
                             className={cn(
                                "w-full pl-10.5 pr-4 py-3 rounded-2xl border text-[11px] font-bold text-white shadow-inner transition-all placeholder-zinc-650",
                                "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                currentTheme.input
                             )}
                          />
                       </div>
                    </div>
                 </motion.div>
              )}

              {/* Steps Progress Footer Bar */}
              <div className="flex items-center justify-between gap-4 pt-8 mt-8 border-t border-zinc-900/80">
                 <div className="flex gap-2.5">
                    <button 
                       type="button"
                       onClick={() => setViewMode('browse')}
                       className="h-11 px-5 bg-zinc-950/80 hover:bg-zinc-90 w/80 hover:text-white border border-zinc-900 hover:border-zinc-800 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all text-zinc-400 flex items-center gap-2 shadow-inner"
                    >
                       <ArrowLeft size={13} />
                       {t.common.cancel}
                    </button>

                    {formStep > 1 && (
                       <button 
                          type="button"
                          onClick={() => setFormStep(prev => prev - 1)}
                          className="h-11 px-5 bg-zinc-950/80 hover:bg-zinc-90 w/80 border border-zinc-900 hover:border-zinc-800 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all text-white flex items-center gap-2"
                       >
                          <ChevronRight size={13} className="rotate-180 text-zinc-400" />
                          {language === 'ka' ? 'უკან' : 'Back'}
                       </button>
                    )}
                 </div>

                 <div className="flex gap-2.5">
                    {formStep < 3 ? (
                       <button 
                          type="button"
                          onClick={() => {
                             if (!formData.title.trim()) {
                                alert(language === 'ka' ? "გთხოვთ პირველ ნაბიჯზე შეიყვანოთ სათაური გასაგრძელებლად" : "Please input a title on Step 1 to continue.");
                                return;
                              }
                              setFormStep(prev => prev + 1);
                          }}
                          className="h-11 px-6 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 text-zinc-950 bg-[#dfb257] border border-[#dfb257] font-sans shadow-[0_4px_15px_rgba(223,178,87,0.25)]"
                       >
                          {language === 'ka' ? 'შემდეგი ნაბიჯი' : 'Next Step'}
                          <ChevronRight size={13} className="stroke-[2.5]" />
                       </button>
                    ) : (
                       <button 
                          disabled={isSubmitting}
                          className={cn(
                             "h-11 px-7 rounded-2xl text-[9px] font-black uppercase tracking-widest tracking-[0.18em] hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 text-black border border-[#dfb257] shadow-[0_6px_20px_rgba(223,178,87,0.3)]",
                             currentTheme.accentBg
                          )}
                       >
                          {isSubmitting ? <Loader2 size={13} className="animate-spin text-black" /> : <ShieldCheck size={15} className="stroke-[2.5]" />}
                          {viewMode === 'edit' ? t.market.form.update : t.market.form.submit}
                       </button>
                    )}
                 </div>
              </div>
           </form>
        </motion.div>
      )}
      {/* Footer */}
      <footer className="border-t border-white/5 py-20 mt-24">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex flex-col items-center md:items-start gap-4">
              <h3 className="text-white font-black uppercase tracking-tighter text-3xl">
                <span className={currentTheme.accent}>PROTON</span> MARKET
              </h3>
              <p className={cn("text-[10px] font-black uppercase tracking-[0.4em] opacity-40", currentTheme.muted)}>
                © {new Date().getFullYear()} PROTON INDUSTRIAL SYSTEMS GROUP
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-10 text-[10px] font-black uppercase tracking-[0.3em]">
              <button 
                onClick={() => setViewMode('privacy')}
                className={cn("transition-all hover:text-white pb-1 border-b border-transparent hover:border-white/20", viewMode === 'privacy' ? "text-white border-white/20" : "text-white/40")}
              >
                {t.market.legal.privacy_policy}
              </button>
              <button 
                onClick={() => setViewMode('terms')}
                className={cn("transition-all hover:text-white pb-1 border-b border-transparent hover:border-white/20", viewMode === 'terms' ? "text-white border-white/20" : "text-white/40")}
              >
                {t.market.legal.terms_of_service}
              </button>
              <a href="#" className="text-white/40 hover:text-white transition-all pb-1 border-b border-transparent hover:border-white/20">Security Protocol</a>
              <a href="#" className="text-white/40 hover:text-white transition-all pb-1 border-b border-transparent hover:border-white/20">System Support</a>
            </div>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-end p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isPlacingCartOrders && setIsCartOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "relative w-full max-w-md h-full sm:h-[calc(100vh-32px)] sm:rounded-[40px] border border-white/5 flex flex-col overflow-hidden shadow-2xl z-10",
                currentTheme.card
              )}
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500">
                    <ShoppingCart size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-white">
                      {language === 'ka' ? 'კალათა' : 'Shopping Cart'}
                    </h3>
                    <p className={cn("text-[9px] font-bold uppercase tracking-widest leading-none mt-1", currentTheme.muted)}>
                      {cart.length === 1 
                        ? (language === 'ka' ? '1 ნივთი' : '1 item') 
                        : (language === 'ka' ? `${cart.length} ნივთი` : `${cart.length} items`)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  disabled={isPlacingCartOrders}
                  className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors disabled:opacity-50 text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Items list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                    <div className="p-5 bg-white/5 rounded-[30px] border border-white/5 text-white/20">
                      <ShoppingCart size={32} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-white">
                        {language === 'ka' ? 'კალათა ცარიელია' : 'Cart is Empty'}
                      </h4>
                      <p className={cn("text-[10px] font-medium leading-relaxed max-w-xs mt-1.5", currentTheme.muted)}>
                        {language === 'ka' 
                          ? 'დაამატეთ საინტერესო პროდუქტები ან სერვისები მარკეტიდან.' 
                          : 'Explore the marketplace to add professional products or services.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  cart.map((item) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      key={item.id}
                      className="p-4 rounded-3xl bg-white/5 border border-white/5 flex items-center gap-4 relative"
                    >
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black/40 shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20">
                            <ShoppingBag size={20} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-6">
                        <span className="inline-block px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 text-[#10b981] mb-1">
                          {item.listingType === 'service' || item.category === 'service'
                            ? (language === 'ka' ? 'სერვისი' : 'Service')
                            : (language === 'ka' ? 'ნივთი' : 'Product')}
                        </span>
                        <h4 className="text-xs font-black text-white uppercase truncate tracking-tight">{language === 'ka' ? (item.titleGe || item.title) : item.title}</h4>
                        <p className="text-[11px] font-black text-[#10b981] font-mono mt-0.5">
                          {convertPrice(item.price, item.currency || 'USD', displayCurrency).toLocaleString(undefined, { maximumFractionDigits: 0 })} {displayCurrency}
                        </p>
                      </div>

                      <button 
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        title={language === 'ka' ? 'წაშლა' : 'Remove'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Action buttons at bottom */}
              {cart.length > 0 && (
                <div className="p-6 border-t border-white/5 space-y-4 shrink-0 bg-black/40">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", currentTheme.muted)}>
                      {language === 'ka' ? 'ჯამური ღირებულება' : 'Total Price'}
                    </span>
                    <span className="text-xl font-black text-[#10b981] font-mono drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                      {cart.reduce((acc, item) => acc + convertPrice(item.price, item.currency || 'USD', displayCurrency), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className="text-[10px] font-black opacity-50 ml-1">{displayCurrency}</span>
                    </span>
                  </div>

                  <button 
                    onClick={handleCartCheckout}
                    disabled={isPlacingCartOrders}
                    className={cn(
                      "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg drop-shadow-[0_0_12px_rgba(16,185,129,0.2)] text-black bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50"
                    )}
                  >
                    {isPlacingCartOrders ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {language === 'ka' ? 'მუშავდება...' : 'Processing...'}
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={14} />
                        {language === 'ka' ? 'შეკვეთის გაფორმება' : 'Checkout & Purchase'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {checkoutItem && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isCheckingOut && setCheckoutItem(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className={cn(
                "relative w-full max-w-lg sm:rounded-[40px] border border-white/10 overflow-hidden",
                currentTheme.card
              )}
            >
              <div className="p-8 sm:p-10 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                    {language === 'ka' ? 'შეკვეთის გაფორმება' : 'Complete Purchase'}
                  </h3>
                  <button 
                    onClick={() => setCheckoutItem(null)}
                    disabled={isCheckingOut}
                    className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="bg-white/5 rounded-[32px] p-6 border border-white/5 flex items-center gap-6">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                    {checkoutItem.image ? (
                      <img src={checkoutItem.image} alt={language === 'ka' ? (checkoutItem.titleGe || checkoutItem.title) : checkoutItem.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={24} className={currentTheme.accent} />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className={cn("text-[9px] font-black uppercase tracking-widest opacity-50 mb-1", currentTheme.muted)}>
                      {t.market.categories[checkoutItem.category as keyof typeof t.market.categories]}
                    </p>
                    <h4 className="text-base font-bold text-white uppercase tracking-tight line-clamp-1">{checkoutItem.title}</h4>
                    <p className="text-xl font-black text-white mt-1">
                      {convertPrice(checkoutItem.price, checkoutItem.currency || 'USD', displayCurrency).toLocaleString(undefined, { maximumFractionDigits: 0 })} {displayCurrency}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <p className={cn("text-[8px] font-black uppercase tracking-widest opacity-50 mb-2", currentTheme.muted)}>Seller</p>
                    <div className="flex items-center gap-2">
                       <ShieldCheck size={14} className={currentTheme.accent} />
                       <span className="text-[11px] font-black text-white uppercase">{checkoutItem.sellerName}</span>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <p className={cn("text-[8px] font-black uppercase tracking-widest opacity-50 mb-2", currentTheme.muted)}>Location</p>
                    <div className="flex items-center gap-2">
                       <MapPin size={12} className={currentTheme.accent} />
                       <span className="text-[11px] font-black text-white uppercase">{checkoutItem.city}</span>
                    </div>
                  </div>
                </div>

                {/* Conditional Service Booking Panel */}
                {(checkoutItem.listingType === 'service' || checkoutItem.category === 'service') && (
                  <div className="space-y-4 bg-white/5 rounded-[32px] p-6 border border-white/5 text-left">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">⚡ {language === 'ka' ? 'სერვისის დეტალები' : 'Service Booking Rules'}</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                      <div className="bg-white/5 rounded-xl p-3">
                        <span className="block text-[8px] uppercase tracking-wider opacity-40 mb-1">{language === 'ka' ? 'შესრულების ვადა' : 'Duration'}</span>
                        <span className="text-white font-bold">{checkoutItem.serviceDuration || (language === 'ka' ? 'შეთანხმებით' : 'Flexible')}</span>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <span className="block text-[8px] uppercase tracking-wider opacity-40 mb-1">{language === 'ka' ? 'პირობა' : 'Requirements'}</span>
                        <span className="text-white font-bold truncate block">{checkoutItem.serviceTerms || (language === 'ka' ? 'სტანდარტული' : 'Standard')}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-wider text-white/50 block ml-1">{language === 'ka' ? 'მოთხოვნები შემსრულებლისთვის' : 'Instructions for the Seller'}</label>
                      <textarea
                        value={buyerInstructions}
                        onChange={e => setBuyerInstructions(e.target.value)}
                        placeholder={language === 'ka' ? "ჩაწერეთ სამუშაოს სპეციფიკაცია..." : "Enter your specific task instructions..."}
                        className={cn("w-full h-24 px-4 py-3 rounded-2xl border text-xs font-bold text-white focus:outline-none transition-all placeholder:text-white/20 bg-black/20", currentTheme.input)}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 space-y-4">
                  <p className={cn("text-[10px] font-bold text-center px-8 leading-relaxed", currentTheme.muted)}>
                    {language === 'ka' 
                      ? 'ღილაკზე დაჭერით თქვენ ეთანხმებით მომსახურების პირობებს და კონფიდენციალურობის პოლიტიკას.'
                      : 'By clicking complete, you agree to the Terms of Service and data processing policies.'}
                  </p>
                  
                  <button 
                    onClick={processPurchase}
                    disabled={isCheckingOut}
                    className={cn(
                      "w-full py-6 rounded-3xl text-[12px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 relative overflow-hidden group",
                      currentTheme.accentBg, "text-white hover:brightness-110 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                    )}
                  >
                    {isCheckingOut ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        {language === 'ka' ? 'მუშავდება...' : 'Processing...'}
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={20} />
                        {language === 'ka' ? 'დადასტურება' : 'Confirm & Buy'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {activeChatListing && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveChatListing(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-lg sm:rounded-[40px] border border-white/10 overflow-hidden bg-[#121212]"
            >
              <div className="p-8 sm:p-10 space-y-6 flex flex-col h-[600px] max-h-[85vh]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#2e5bff]/10 border border-[#2e5bff]/20 flex items-center justify-center font-black text-xs text-[#2e5bff]">
                      {activeChatListing.sellerName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        {language === 'ka' ? 'კავშირი გამყიდველთან' : 'Chat with Seller'}
                      </h3>
                      <p className="text-[10px] text-white/50">{activeChatListing.sellerName} • {activeChatListing.title}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveChatListing(null)}
                    className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Subsystem status/Product terms */}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 flex items-start gap-2.5">
                  <span className="text-sm">💬</span>
                  <div className="text-[9px] font-bold text-yellow-500/80 leading-relaxed uppercase">
                    {language === 'ka' 
                      ? `შეთანხმება: პროდუქტის მდგომარეობა - "${activeChatListing.condition === 'new' ? 'ახალი' : activeChatListing.condition === 'used' ? 'მეორადი' : 'განახლებული'}". ${activeChatListing.isNegotiable ? 'ფასზე შეგიძლიათ ვაჭრობა!' : 'ფასი ფიქსირებულია.'}`
                      : `Inquiry terms: item condition is "${activeChatListing.condition || 'new'}". ${activeChatListing.isNegotiable ? 'Custom offers are welcome!' : 'Fixed pricing matches apply.'}`}
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none bg-black/20 rounded-[24px] p-4 border border-white/5">
                  {messagesList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                      <span className="text-2xl opacity-40">🤝</span>
                      <p className="text-xs font-bold text-white uppercase tracking-wider">
                        {language === 'ka' ? 'მიწერეთ გამყიდველს' : 'No messages yet'}
                      </p>
                      <p className="text-[9px] text-white/40 max-w-xs">
                        {language === 'ka' 
                          ? 'ჰკითხეთ მდგომარეობის ან საბოლოო ფასის შესახებ და დაიწყეთ პირდაპირი მოლაპარაკება.'
                          : 'Inquire about item availability, delivery, or state custom quotes.'}
                      </p>
                    </div>
                  ) : (
                    messagesList.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={cn(
                          "flex flex-col max-w-[85%] rounded-[24px] p-4 text-xs font-medium space-y-1",
                          msg.senderId === user?.uid 
                            ? "bg-[#2e5bff] text-white ml-auto rounded-tr-none shadow-[0_4px_10px_rgba(46,91,255,0.2)]" 
                            : "bg-white/10 text-white mr-auto rounded-tl-none"
                        )}
                      >
                        <div className="flex items-center justify-between gap-4 text-[9px] font-black uppercase tracking-wider opacity-65">
                          <span>{msg.senderName}</span>
                          <span>
                            {msg.createdAt?.seconds 
                              ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Just now'}
                          </span>
                        </div>
                        <p className="break-all whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Send message form */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input 
                    type="text"
                    value={chatMessageText}
                    onChange={(e) => setChatMessageText(e.target.value)}
                    placeholder={language === 'ka' ? 'დაწერეთ შეთავაზება...' : 'Propose price or ask a question...'}
                    className="flex-1 px-5 py-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-[#2e5bff] text-xs font-bold text-white placeholder-white/30"
                  />
                  <button 
                    type="submit"
                    className="px-5 py-4 bg-[#2e5bff] text-white font-black text-xs uppercase tracking-wider rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-[0_4px_12px_rgba(46,91,255,0.3)]"
                  >
                    <span>{language === 'ka' ? 'გაგზავნა' : 'Send'}</span>
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {selectedVendor && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVendor(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className={cn(
                "relative w-full max-w-2xl sm:rounded-[32px] border border-white/10 overflow-hidden",
                currentTheme.card
              )}
            >
              <div className="p-6 sm:p-8 space-y-6 flex flex-col max-h-[90vh] overflow-y-auto scrollbar-none">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-sm", currentTheme.accent)}>
                      {selectedVendor.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase text-white tracking-tight flex items-center gap-2">
                        {selectedVendor.name}
                        <ShieldCheck size={16} className={currentTheme.accent} />
                      </h3>
                      <p className={cn("text-[10px] uppercase font-black tracking-widest opacity-50", currentTheme.muted)}>
                        {language === 'ka' ? 'ავტორიზებული გამყიდველი' : 'Authorized Vendor'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedVendor(null)}
                    className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Score Breakdown Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white/5 rounded-3xl p-6 border border-white/5">
                  <div className="flex flex-col items-center justify-center text-center p-2 md:border-r border-white/5">
                    <span className="text-4xl font-black text-white tracking-tighter">
                      {sellerRatings[selectedVendor.id] ? sellerRatings[selectedVendor.id].avg.toFixed(1) : '0.0'}
                    </span>
                    <div className="flex gap-0.5 my-1.5 justify-center">
                      {[1, 2, 3, 4, 5].map((starIdx) => {
                        const score = sellerRatings[selectedVendor.id]?.avg || 0;
                        return (
                          <Star 
                            key={starIdx} 
                            size={14} 
                            className={cn(
                              starIdx <= score 
                                ? "fill-amber-400 text-amber-400" 
                                : starIdx - 0.5 <= score 
                                  ? "fill-amber-400/50 text-amber-400"
                                  : "text-zinc-600"
                            )} 
                          />
                        );
                      })}
                    </div>
                    <span className={cn("text-[9px] font-black uppercase tracking-wider opacity-50", currentTheme.muted)}>
                      {sellerRatings[selectedVendor.id]?.count || 0} {language === 'ka' ? 'შეფასება' : 'reviews'}
                    </span>
                  </div>

                  <div className="md:col-span-2 space-y-2 flex flex-col justify-center">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const list = reviews.filter(r => r.sellerId === selectedVendor.id);
                      const count = list.filter(r => r.rating === stars).length;
                      const pct = list.length > 0 ? (count / list.length) * 100 : 0;
                      return (
                        <div key={stars} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-white">
                          <span className="w-16 text-right text-[9px] opacity-70">{stars} {language === 'ka' ? 'ვარსკვლ.' : 'stars'}</span>
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 opacity-40 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reviews Content Area */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#2e5bff]">
                    {language === 'ka' ? 'მყიდველთა გამოხმაურება' : 'Buyer Feedback'}
                  </h4>

                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-none">
                    {reviews.filter(r => r.sellerId === selectedVendor.id).length === 0 ? (
                      <div className="text-center py-8 bg-white/5 rounded-2xl border border-white/5 text-xs text-white/40">
                        {language === 'ka' ? 'ჯერ არ არის შეფასებები ამ გამყიდველისთვის.' : 'No reviews left for this seller yet.'}
                      </div>
                    ) : (
                      reviews
                        .filter(r => r.sellerId === selectedVendor.id)
                        .map((rev) => {
                          const isOwnReview = user?.uid === rev.buyerId;
                          const hasOrder = orders.some(o => o.sellerId === selectedVendor.id && o.buyerId === rev.buyerId);
                          
                          return (
                            <div key={rev.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase text-white tracking-wider">
                                      {rev.buyerName}
                                    </span>
                                    {hasOrder && (
                                      <span className="px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-[7px] font-black text-green-400 uppercase tracking-widest flex items-center gap-0.5">
                                        <ShieldCheck size={8} />
                                        {language === 'ka' ? 'ვერიფიცირებული მყიდველი' : 'Verified Buyer'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star 
                                        key={s} 
                                        size={10} 
                                        className={cn(s <= rev.rating ? "fill-amber-400 text-amber-400" : "text-zinc-700")} 
                                      />
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={cn("text-[8px] font-mono opacity-30", currentTheme.muted)}>
                                    {rev.createdAt?.seconds 
                                      ? new Date(rev.createdAt.seconds * 1000).toLocaleDateString()
                                      : 'Just now'}
                                  </span>
                                  {isOwnReview && (
                                    <button 
                                      onClick={() => handleDeleteReview(rev.id)}
                                      className="p-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all"
                                      title={language === 'ka' ? 'შეფასების წაშლა' : 'Delete review'}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-white/70 leading-relaxed font-medium">
                                {rev.text}
                              </p>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Write Review Form */}
                {user?.uid !== selectedVendor.id ? (
                  <form onSubmit={handleSubmitReview} className="border-t border-white/5 pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-widest text-[#2e5bff]">
                        {language === 'ka' ? 'შეაფასეთ გამყიდველი' : 'Write a Review'}
                      </label>
                      <div className="flex items-center gap-1 bg-white/5 p-1.5 rounded-xl border border-white/10">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setReviewRating(star)}
                            className="p-0.5 transition-transform hover:scale-125"
                          >
                            <Star 
                              size={16} 
                              className={cn(
                                star <= reviewRating 
                                  ? "fill-amber-400 text-amber-400" 
                                  : "text-zinc-650 hover:text-amber-400/65"
                              )} 
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder={language === 'ka' ? 'გაგვიზიარეთ თქვენი გამოცდილება ამ გამყიდველთან...' : 'Tell others about your experience trading with this vendor...'}
                        rows={3}
                        className={cn(
                          "w-full px-5 py-4 rounded-2xl border text-xs font-medium text-white focus:outline-none placeholder-white/20 bg-white/5 focus:border-[#2e5bff]/40",
                          currentTheme.input
                        )}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingReview || !reviewText.trim()}
                      className={cn(
                        "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg transition-all flex items-center justify-center gap-2",
                        currentTheme.accentBg, "text-white hover:brightness-110 active:scale-95 disabled:opacity-50"
                      )}
                    >
                      {isSubmittingReview ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          {language === 'ka' ? 'იგზავნება...' : 'Submitting...'}
                        </>
                      ) : (
                        <>
                          <span>{language === 'ka' ? 'შეფასების გამოქვეყნება' : 'Submit Review'}</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="border-t border-white/5 pt-4 text-center text-[10px] text-white/35 font-bold uppercase tracking-widest">
                    {language === 'ka' ? 'თქვენ არ შეგიძლიათ საკუთარი თავის შეფასება.' : 'You cannot submit a review for yourself.'}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  </div>

  {/* Categories smooth slide-up accordion/overlay */}
  <AnimatePresence>
    {activeBottomTab === 'categories' && (
      <motion.div 
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-16 top-[60px] bg-[#0a0a0c]/98 backdrop-blur-lg z-40 overflow-y-auto px-6 py-8 border-t border-zinc-805/70"
      >
        <div className="max-w-md mx-auto space-y-8">
          <div className="flex items-center justify-between border-b border-zinc-900/40 pb-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-[#dfb257] flex items-center gap-2 font-sans">
              <span>📂</span> {language === 'ka' ? 'კატეგორიები' : 'Browse Categories'}
            </h2>
            <button 
              onClick={() => setActiveBottomTab('home')}
              className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors"
            >
              {language === 'ka' ? 'დახურვა' : 'Close'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pb-6">
            <button
              type="button"
              onClick={() => {
                setActiveCategory('all');
                setActiveBottomTab('home');
                setViewMode('browse');
              }}
              className={cn(
                "w-full flex flex-col justify-between p-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border text-left min-h-[72px] relative overflow-hidden group/cat",
                activeCategory === 'all'
                  ? "bg-[#dfb257] text-[#070708] border-[#dfb257] shadow-lg shadow-[#dfb257]/20"
                  : "bg-zinc-900/30 text-white border-zinc-800/60 hover:border-[#dfb257]/30 hover:bg-zinc-900/60"
              )}
            >
              <span className="text-xl">🌍</span>
              <span className="mt-2 text-[9px] font-bold tracking-wider leading-none">{language === 'ka' ? 'ყველა' : 'All Goods'}</span>
              {activeCategory === 'all' && <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-zinc-950" />}
            </button>
            {Object.entries(t.market.categories).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveCategory(key);
                  setActiveBottomTab('home');
                  setViewMode('browse');
                }}
                className={cn(
                  "w-full flex flex-col justify-between p-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border text-left min-h-[72px] relative overflow-hidden group/cat",
                  activeCategory === key
                    ? "bg-[#dfb257] text-[#070708] border-[#dfb257] shadow-lg shadow-[#dfb257]/20"
                    : "bg-zinc-900/30 text-white border-zinc-800/60 hover:border-[#dfb257]/30 hover:bg-zinc-900/60"
                )}
              >
                <span className="text-xl shrink-0">{CATEGORY_EMOJIS[key] || '🏷️'}</span>
                <span className="mt-2 text-[9px] font-bold tracking-wider leading-none truncate w-full" title={label as string}>{label as string}</span>
                {activeCategory === key && <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-zinc-950" />}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* Mobile Special Messages/Chat/Orders View Overlay */}
  <AnimatePresence>
    {activeBottomTab === 'messages' && (
      <motion.div 
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-16 top-[60px] bg-[#0a0a0c] z-40 overflow-y-auto px-4 py-6 md:hidden"
      >
        <div className="max-w-md mx-auto space-y-6">
          {/* Top Selector Panel: Chats vs. Orders */}
          <div className="flex items-center justify-between border-b border-zinc-905/70 pb-3">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#dfb257] flex items-center gap-2 font-sans">
              <span>💬</span> {language === 'ka' ? 'კავშირი' : 'Communications'}
            </h2>
            <button 
              onClick={() => setActiveBottomTab('home')}
              className="text-[9px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors"
            >
              {language === 'ka' ? 'დახურვა' : 'Close'}
            </button>
          </div>

          {/* Inner active screen selector or dual panel */}
          <div className="space-y-6">
            {activeChatListing ? (
              // Active Chat Thread
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
                  <button 
                    onClick={() => setActiveChatListing(null)}
                    className="p-1 px-2.5 rounded-lg bg-zinc-900 border border-zinc-850 text-[10px] font-black uppercase text-zinc-300 hover:text-white"
                  >
                    ← {language === 'ka' ? 'უკან' : 'Back'}
                  </button>
                  <div className="truncate">
                    <span className="text-[9px] font-bold text-zinc-500 block uppercase font-mono tracking-wider">
                      {language === 'ka' ? 'ჩატი განცხადებაზე:' : 'Chatting about:'}
                    </span>
                    <h4 className="text-xs font-black text-white truncate">{activeChatListing.title}</h4>
                  </div>
                </div>

                {/* Chat Messages Log */}
                <div className="bg-zinc-950/20 rounded-2xl p-4 border border-zinc-900/60 h-[280px] overflow-y-auto space-y-3 flex flex-col">
                  {messagesList.length === 0 ? (
                    <div className="text-center my-auto py-8">
                      <p className="text-[10px] uppercase font-black tracking-widest text-zinc-650">
                        {language === 'ka' ? 'შეტყობინებები არ არის' : 'No messages yet'}
                      </p>
                      <span className="text-[9px] text-zinc-500 mt-1 block font-semibold">
                        {language === 'ka' ? 'მისწერეთ შეკითხვა გამყიდველს.' : 'Send a friendly query.'}
                      </span>
                    </div>
                  ) : (
                    messagesList.map((msg) => {
                      const isMe = msg.senderId === user?.uid;
                      return (
                        <div 
                          key={msg.id}
                          className={cn(
                            "max-w-[85%] p-3 rounded-2xl text-xs flex flex-col gap-1",
                            isMe 
                              ? "bg-[#dfb257] text-[#070708] self-end rounded-tr-none font-bold" 
                              : "bg-zinc-900 text-zinc-100 self-start rounded-tl-none font-medium border border-zinc-800"
                          )}
                        >
                          <div className="flex items-center gap-1.5 justify-between">
                            <span className={cn("text-[8px] font-black uppercase tracking-wider", isMe ? "text-[#070708]/70" : "text-zinc-500")}>
                              {msg.senderName}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input 
                    type="text"
                    value={chatMessageText}
                    onChange={(e) => setChatMessageText(e.target.value)}
                    placeholder={language === 'ka' ? 'დაწერეთ შეტყობინება...' : 'Type a secure message...'}
                    className="flex-1 bg-zinc-900 border border-zinc-805/70 rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#dfb257]/50"
                  />
                  <button 
                    type="submit"
                    disabled={!chatMessageText.trim()}
                    className="px-4 py-2 bg-[#dfb257] hover:bg-opacity-90 disabled:opacity-40 transition-all rounded-xl text-xs font-black text-[#070708] uppercase tracking-wider"
                  >
                    {language === 'ka' ? 'გაგზავნა' : 'Send'}
                  </button>
                </form>
              </div>
            ) : (
              // Chats and Orders List
              <div className="space-y-6">
                {/* Conversations */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#dfb257]/70">
                    {language === 'ka' ? 'ჩატების სია' : 'Direct Messages'}
                  </h3>
                  {groupedChats.length === 0 ? (
                    <div className="bg-zinc-900/40 border border-zinc-805/40 p-6 rounded-xl text-center">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                        {language === 'ka' ? 'აქტიური საუბრები არ არის' : 'No active chats found'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {groupedChats.map((chat) => {
                        const relatedListing = listings.find(l => l.id === chat.listingId);
                        return (
                          <button
                            key={chat.listingId}
                            onClick={() => {
                              if (relatedListing) {
                                setActiveChatListing(relatedListing);
                              }
                            }}
                            className="w-full text-left bg-zinc-950/40 hover:bg-zinc-900 border border-zinc-805/70 p-3 rounded-xl flex items-center justify-between transition-all"
                          >
                            <div className="truncate flex-1 pr-3">
                              <span className="text-[10px] font-black text-[#dfb257] block truncate">
                                {chat.listingTitle}
                              </span>
                              <p className="text-xs text-zinc-300 truncate font-semibold mt-0.5">
                                {chat.lastMessage}
                              </p>
                            </div>
                            <ChevronRight size={14} className="text-zinc-500 block shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Orders Status */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#dfb257]/70 flex items-center gap-1.5">
                    <span>📦</span> {language === 'ka' ? 'თქვენი შეკვეთები' : 'Transactions & Orders'}
                  </h3>

                  {buyerOrders.length === 0 && sellerOrders.length === 0 ? (
                    <div className="bg-zinc-900/40 border border-zinc-805/40 p-6 rounded-xl text-center">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                        {language === 'ka' ? 'შეკვეთები არ ფიქსირდება' : 'No purchase orders yet'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {/* Purchases */}
                      {buyerOrders.map((order, idx) => (
                        <div key={order.id || idx} className="bg-zinc-950/40 border border-zinc-805/70 p-3 rounded-2xl flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-zinc-900 text-[8px] font-black text-[#dfb257] border border-zinc-805/70 font-mono uppercase">
                              {language === 'ka' ? 'შესყიდვა' : 'PURCHASE'}
                            </span>
                            <span className="text-[9px] font-bold text-green-400 uppercase font-mono tracking-widest">
                              {order.status || 'Success'}
                            </span>
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-white">{order.listingTitle || 'Proton Asset'}</h5>
                            <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                              Total: <span className="text-white font-black">{order.price} {order.currency}</span>
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Sales */}
                      {sellerOrders.map((order, idx) => (
                        <div key={order.id || idx} className="bg-zinc-950/40 border border-zinc-805/70 p-3 rounded-2xl flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-[#dfb257]/10 text-[8px] font-black text-[#dfb257] border border-[#dfb257]/20 font-mono uppercase">
                              {language === 'ka' ? 'გაყიდვა' : 'SALE'}
                            </span>
                            <span className="text-[9px] font-bold text-green-400 uppercase font-mono tracking-widest">
                              {order.status || 'Received'}
                            </span>
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-white">{order.listingTitle || 'Proton Asset'}</h5>
                            <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                              Incoming: <span className="text-[#dfb257] font-black">{order.price} {order.currency}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* Mobile Sticky 5-Tab Navigation Bar */}
  <div className="md:hidden fixed bottom-0 left-0 w-full bg-proton-card/98 backdrop-blur-md border-t border-proton-border/30 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] z-[100] grid grid-cols-5 items-center px-1 shadow-lg">
    {/* Tab 1: Home */}
    <button
      onClick={() => {
        setActiveBottomTab('home');
        setViewMode('browse');
      }}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full transition-all duration-200",
        activeBottomTab === 'home' && viewMode === 'browse' ? "text-proton-accent font-bold" : "text-proton-muted font-medium"
      )}
    >
      <LayoutGrid size={20} className="stroke-[2]" />
      <span className="text-[9px] font-bold mt-1 uppercase tracking-wider block text-center">
        {language === 'ka' ? 'მთავარი' : 'Home'}
      </span>
    </button>

    {/* Tab 2: Categories */}
    <button
      onClick={() => {
        setActiveBottomTab('categories');
      }}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full transition-all duration-200",
        activeBottomTab === 'categories' ? "text-proton-accent font-bold" : "text-proton-muted font-medium"
      )}
    >
      <Tag size={20} className="stroke-[2]" />
      <span className="text-[9px] font-bold mt-1 uppercase tracking-wider block text-center">
        {language === 'ka' ? 'კატეგორია' : 'Category'}
      </span>
    </button>

    {/* Tab 3: Balanced Add [➕] Listing Button */}
    <button
      onClick={() => {
        setFormData({
          title: '',
          titleGe: '',
          description: '',
          descriptionGe: '',
          price: '',
          currency: language === 'ka' ? 'GEL' : 'USD',
          category: 'technics',
          country: language === 'ka' ? 'GEO' : 'USA',
          city: '',
          location: '',
          images: [],
          lat: undefined,
          lng: undefined,
          condition: 'new',
          isNegotiable: false,
          listingType: 'product',
          serviceDuration: '',
          serviceTerms: ''
        });
        setViewMode('create');
        setActiveBottomTab('home');
      }}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full transition-all duration-200",
        viewMode === 'create' ? "text-proton-accent font-bold" : "text-proton-muted font-medium"
      )}
      title={language === 'ka' ? 'განცხადების დამატება' : 'Add Listing'}
    >
      <Plus size={20} className="stroke-[2.5]" />
      <span className="text-[9px] font-bold mt-1 uppercase tracking-wider block text-center">
        {language === 'ka' ? 'დამატება' : 'Add'}
      </span>
    </button>

    {/* Tab 4: Chat messages */}
    <button
      onClick={() => {
        setActiveBottomTab('messages');
      }}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative",
        activeBottomTab === 'messages' ? "text-proton-accent font-bold" : "text-proton-muted font-medium"
      )}
    >
      <div className="relative">
        <MessageCircle size={20} className="stroke-[2]" />
        {groupedChats.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center h-4 w-4 text-[8px] font-black leading-none text-proton-on-accent bg-proton-accent rounded-full">
            {groupedChats.length}
          </span>
        )}
      </div>
      <span className="text-[9px] font-bold mt-1 uppercase tracking-wider block text-center">
        {language === 'ka' ? 'ჩატი' : 'Chat'}
      </span>
    </button>

    {/* Tab 5: My cabinet / Profile */}
    <button
      onClick={() => {
        setActiveBottomTab('home');
        setViewMode('my-listings');
      }}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full transition-all duration-200",
        viewMode === 'my-listings' ? "text-proton-accent font-bold" : "text-proton-muted font-medium"
      )}
    >
      <User size={20} className="stroke-[2]" />
      <span className="text-[9px] font-bold mt-1 uppercase tracking-wider block text-center">
        {language === 'ka' ? 'კაბინეტი' : 'Profile'}
      </span>
    </button>
  </div>
</div>
  );
});

