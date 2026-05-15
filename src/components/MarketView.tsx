import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ShoppingBag, 
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
  Camera,
  Loader2,
  Globe,
  Coins
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  where,
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import { Listing } from '../types';

interface MarketViewProps {
  language: 'en' | 'ka';
  t: any;
  themeId: string;
}

const MARKET_THEMES: Record<string, { card: string; input: string; accent: string; accentBg: string; border: string; muted: string }> = {
  light: {
    card: "bg-white border-slate-200 shadow-xl",
    input: "bg-slate-100 border-slate-200 focus:border-slate-400",
    accent: "text-[#2e5bff]",
    accentBg: "bg-[#2e5bff]",
    border: "border-slate-200",
    muted: "text-slate-500"
  },
  proton: {
    card: "bg-[#141414] border-white/5 shadow-2xl",
    input: "bg-[#0a0a0a] border-white/5 focus:border-[#2e5bff]/50",
    accent: "text-[#2e5bff]",
    accentBg: "bg-[#2e5bff]",
    border: "border-white/5",
    muted: "text-[#a0a0a0]"
  },
  titanium: {
    card: "bg-[#141414] border-white/10 shadow-2xl",
    input: "bg-[#0a0a0a] border-white/10 focus:border-[#2e5bff]/60",
    accent: "text-[#2e5bff]",
    accentBg: "bg-[#2e5bff]",
    border: "border-white/10",
    muted: "text-[#a0a0a0]"
  },
  vibrant: {
    card: "bg-[#141414] border-[#2e5bff]/20 shadow-2xl shadow-[#2e5bff]/5",
    input: "bg-[#0a0a0a] border-[#2e5bff]/20 focus:border-[#2e5bff]/50",
    accent: "text-[#2e5bff]",
    accentBg: "bg-[#2e5bff]",
    border: "border-[#2e5bff]/20",
    muted: "text-[#a0a0a0]"
  },
  midnight: {
    card: "bg-[#111111] border-white/5 shadow-2xl",
    input: "bg-[#080808] border-white/5 focus:border-[#2e5bff]/50",
    accent: "text-[#2e5bff]",
    accentBg: "bg-[#2e5bff]",
    border: "border-white/5",
    muted: "text-[#a0a0a0]"
  },
  industrial: {
    card: "bg-[#0d0d0d] border-white/10 shadow-2xl",
    input: "bg-[#080808] border-white/10 focus:border-[#2e5bff]/50",
    accent: "text-[#3b82f6]",
    accentBg: "bg-[#3b82f6]",
    border: "border-white/10",
    muted: "text-zinc-500"
  }
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

export function MarketView({ language, t, themeId }: MarketViewProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeCountry, setActiveCountry] = useState('GLOBAL');
  const [activeCity, setActiveCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'browse' | 'my-listings' | 'create' | 'edit'>('browse');
  const [profileSubMode, setProfileSubMode] = useState<'selling' | 'buying'>('selling');
  const [orders, setOrders] = useState<any[]>([]);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    titleGe: '',
    description: '',
    descriptionGe: '',
    price: '',
    currency: 'USD',
    category: 'electronics',
    country: 'USA',
    city: '',
    location: '',
    image: ''
  });

  const currentTheme = MARKET_THEMES[themeId] || MARKET_THEMES.industrial;

  useEffect(() => {
    const qListings = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsubscribeListings = onSnapshot(qListings, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Listing[];
      setListings(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'listings');
    });

    return () => unsubscribeListings();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const qOrders = query(
      collection(db, 'orders'), 
      where('buyerId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });

    return () => unsubscribeOrders();
  }, []);

  const clearFilters = () => {
    setSearch('');
    setActiveCategory('all');
    setActiveCountry('GLOBAL');
    setActiveCity('');
    setMinPrice('');
    setMaxPrice('');
  };

  const filteredListings = useMemo(() => {
    let result = listings;
    
    // Filter by View Mode
    if (viewMode === 'my-listings') {
      if (profileSubMode === 'selling') {
        result = result.filter(l => l.sellerId === auth.currentUser?.uid);
      } else {
        // Handled by different UI section
        return [];
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

    return result;
  }, [listings, search, activeCategory, activeCountry, activeCity, minPrice, maxPrice, viewMode, language]);

  const convertPrice = (price: number, from: string, to: string) => {
    if (from === to) return price;
    const inUSD = price / (EXCHANGE_RATES[from] || 1);
    return inUSD * (EXCHANGE_RATES[to] || 1);
  };

  const handleBuyNow = async (listing: Listing) => {
    if (!auth.currentUser) return;
    if (listing.sellerId === auth.currentUser.uid) {
      alert("You cannot buy your own item.");
      return;
    }

    if (window.confirm(`${t.market.buy_now}?`)) {
      try {
        await addDoc(collection(db, 'orders'), {
          listingId: listing.id,
          buyerId: auth.currentUser.uid,
          sellerId: listing.sellerId,
          amount: listing.price,
          currency: listing.currency || 'USD',
          itemTitle: listing.title,
          status: 'completed',
          createdAt: serverTimestamp()
        });
        alert(language === 'ka' ? "შეკვეთა გაფორმდა!" : "Order placed successfully!");
        setViewMode('my-listings');
        setProfileSubMode('buying');
      } catch (error) {
        console.error("Error creating order:", error);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setIsSubmitting(true);
    try {
      const listingData = {
        title: formData.title,
        titleGe: formData.titleGe || formData.title,
        description: formData.description,
        descriptionGe: formData.descriptionGe || formData.description,
        price: parseFloat(formData.price),
        currency: formData.currency,
        sellerId: auth.currentUser.uid,
        sellerName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Unknown',
        category: formData.category,
        location: formData.location || `${formData.city}, ${formData.country}`,
        country: formData.country,
        city: formData.city,
        image: formData.image || '',
        createdAt: serverTimestamp(),
        status: 'active'
      };

      if (viewMode === 'edit' && editingListing) {
        // Remove createdAt from updates to keep it immutable
        const { createdAt, ...updateData } = listingData;
        await updateDoc(doc(db, 'listings', editingListing.id), updateData);
      } else {
        await addDoc(collection(db, 'listings'), listingData);
      }

      setViewMode('browse');
      setFormData({
        title: '', titleGe: '', description: '', descriptionGe: '',
        price: '', currency: 'USD', category: 'electronics', 
        country: 'USA', city: '', location: '', image: ''
      });
    } catch (error) {
      console.error("Error saving listing:", error);
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
      image: listing.image || ''
    });
    setViewMode('edit');
  };

  const FilterContent = (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-6">
        <h3 className={cn("text-base font-black uppercase tracking-tighter flex items-center gap-3", currentTheme.accent)}>
          <LayoutGrid size={18} />
          {language === 'ka' ? 'ფილტრაცია' : 'Refine Results'}
        </h3>
        <button 
          onClick={() => setIsFiltersOpen(false)} 
          className="lg:hidden p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3">
        <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-60 ml-1 font-mono", currentTheme.muted)}>
          {t.market.filters.country}
        </label>
        <div className="relative group">
          <Globe size={12} className={cn("absolute left-4 top-1/2 -translate-y-1/2 opacity-40", currentTheme.accent)} />
          <select 
            value={activeCountry}
            onChange={(e) => setActiveCountry(e.target.value)}
            className={cn(
              "w-full pl-10 pr-4 py-3 border rounded-xl text-[11px] font-bold appearance-none focus:outline-none transition-all text-white",
              currentTheme.input
            )}
          >
            {WORLD_COUNTRIES.map(country => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-60 ml-1 font-mono", currentTheme.muted)}>
          {t.market.filters.city}
        </label>
        <div className="relative group">
          <MapPin size={12} className={cn("absolute left-4 top-1/2 -translate-y-1/2 opacity-40", currentTheme.accent)} />
          <input 
            type="text"
            value={activeCity}
            onChange={(e) => setActiveCity(e.target.value)}
            placeholder={language === 'ka' ? 'შეიყვანეთ ქალაქი...' : 'Enter city...'}
            className={cn(
              "w-full pl-10 pr-4 py-3 border rounded-xl text-[11px] font-bold focus:outline-none transition-all placeholder:opacity-30 text-white",
              currentTheme.input
            )}
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-60 ml-1 font-mono", currentTheme.muted)}>
          {t.market.form.category}
        </label>
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => setActiveCategory('all')}
            className={cn(
              "flex items-center justify-between px-5 py-3 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all border",
              activeCategory === 'all' 
                ? cn(currentTheme.accentBg, "border-transparent text-white shadow-lg shadow-blue-500/20")
                : "bg-white/5 border-white/5 text-white/40 hover:border-white/10 hover:bg-white/10"
            )}
          >
            <span>{t.market.all_categories}</span>
            {activeCategory === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </button>
          {Object.entries(t.market.categories).map(([key, label]) => (
            <button 
              key={key}
              onClick={() => setActiveCategory(key)}
              className={cn(
                "flex items-center justify-between px-5 py-3 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all border",
                activeCategory === key 
                  ? cn(currentTheme.accentBg, "border-transparent text-white shadow-lg shadow-blue-500/20")
                  : "bg-white/5 border-white/5 text-white/40 hover:border-white/10 hover:bg-white/10"
              )}
            >
              <span>{label as string}</span>
              {activeCategory === key && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-60 ml-1 font-mono", currentTheme.muted)}>
          {t.market.price} (USD)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative group">
            <input 
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder={t.market.filters.price_min}
              className={cn(
                "w-full px-4 py-3 border rounded-xl text-[11px] font-bold focus:outline-none transition-all placeholder:opacity-30 text-white",
                currentTheme.input
              )}
            />
          </div>
          <div className="relative group">
            <input 
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder={t.market.filters.price_max}
              className={cn(
                "w-full px-4 py-3 border rounded-xl text-[11px] font-bold focus:outline-none transition-all placeholder:opacity-30 text-white",
                currentTheme.input
              )}
            />
          </div>
        </div>
      </div>

      <button 
        onClick={clearFilters}
        className={cn("w-full py-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-[0.2em] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2", currentTheme.muted)}
      >
        <Trash2 size={12} />
        {t.market.filters.clear_all}
      </button>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 p-1 px-4 lg:px-0 bg-[#0a0a0a] min-h-screen"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          {viewMode !== 'browse' && (
            <button 
              onClick={() => setViewMode('browse')}
              className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-4xl font-black mb-2 tracking-tight uppercase text-white">
              <span className={currentTheme.accent}>{t.market.title.split(' ')[0]}</span> {t.market.title.split(' ').slice(1).join(' ')}
            </h2>
            <div className="flex items-center gap-4">
              <p className={cn("font-bold tracking-wide uppercase text-xs opacity-60", currentTheme.muted)}>
                {viewMode === 'browse' ? t.market.subtitle : 
                 viewMode === 'my-listings' ? t.market.my_listings :
                 viewMode === 'create' ? t.market.create_listing : t.market.edit_listing}
              </p>
              {viewMode === 'my-listings' && (
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl">
                  <button 
                    onClick={() => setProfileSubMode('selling')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                      profileSubMode === 'selling' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    {t.market.selling_mode}
                  </button>
                  <button 
                    onClick={() => setProfileSubMode('buying')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                      profileSubMode === 'buying' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
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
          <div className="flex items-center gap-4">
             <div className="relative w-full md:w-64 group">
                <div className={cn("absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform", currentTheme.accent)}>
                  <Search size={16} />
                </div>
                <input 
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.market.search_placeholder}
                  className={cn(
                    "w-full pl-11 pr-4 py-3 rounded-[20px] text-[11px] font-bold uppercase tracking-wider focus:outline-none transition-all shadow-inner",
                    currentTheme.input
                  )}
                />
             </div>
             <button 
               onClick={() => setViewMode('my-listings')}
               className={cn("p-3 bg-white/5 rounded-2xl transition-all", `hover:${currentTheme.accentBg.replace('bg-', 'bg-')} hover:text-white`)}
               title={t.market.my_listings}
             >
               <User size={20} />
             </button>
             <button 
               onClick={() => setViewMode('create')}
               className={cn("p-3 rounded-2xl shadow-lg shadow-blue-500/20 hover:brightness-110 active:scale-95 transition-all text-white", currentTheme.accentBg)}
             >
               <Plus size={20} />
             </button>
             <div className="h-10 w-[1px] bg-white/10 mx-2 hidden md:block" />
             <div className="relative group">
                <Coins size={14} className={cn("absolute left-3 top-1/2 -translate-y-1/2 opacity-50", currentTheme.accent)} />
                <select 
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value)}
                  className={cn(
                    "pl-9 pr-4 py-3 rounded-xl border appearance-none text-[10px] font-black uppercase tracking-widest focus:outline-none transition-all text-white cursor-pointer",
                    currentTheme.input
                  )}
                >
                  {CURRENCIES.map(curr => (
                    <option key={curr.code} value={curr.code}>{curr.code}</option>
                  ))}
                </select>
             </div>
          </div>
        )}
      </div>

      {viewMode === 'browse' || viewMode === 'my-listings' ? (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Sidebar */}
          {viewMode === 'browse' && (
            <aside className="hidden lg:block w-72 shrink-0 space-y-8 animate-in fade-in slide-in-from-left duration-700">
               <div className={cn("p-8 rounded-[40px] border border-white/5 sticky top-32 backdrop-blur-[20px]", currentTheme.card)}>
                 {FilterContent}
               </div>
            </aside>
          )}

          <div className="flex-1 space-y-8">
            {/* Mobile Filter Toggle */}
            {viewMode === 'browse' && (
              <div className={cn("lg:hidden flex items-center justify-between p-4 rounded-3xl border border-white/5", currentTheme.card)}>
                <div className="flex items-center gap-3">
                  <LayoutGrid size={18} className={currentTheme.accent} />
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", currentTheme.muted)}>{t.market.all_categories}</span>
                </div>
                <button 
                  onClick={() => setIsFiltersOpen(true)}
                  className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all", currentTheme.accentBg, "text-white")}
                >
                  {language === 'ka' ? 'ფილტრები' : 'Filters'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {viewMode === 'my-listings' && profileSubMode === 'buying' ? (
                  orders.map((order, idx) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={order.id}
                      className={cn("p-6 rounded-[32px] border border-white/5", currentTheme.card)}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-white/5 rounded-2xl">
                          <ShoppingBag size={20} className={currentTheme.accent} />
                        </div>
                        <div className="text-right">
                          <span className={cn("text-[8px] font-black uppercase tracking-widest opacity-50 block", currentTheme.muted)}>
                            {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] font-black text-[#2e5bff] uppercase tracking-widest">
                            {order.status}
                          </span>
                        </div>
                      </div>
                      <h4 className="text-sm font-black text-white mb-1 uppercase tracking-tight">{order.itemTitle}</h4>
                      <p className={cn("text-xs font-bold", currentTheme.muted)}>Price: {order.amount} {order.currency}</p>
                      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                         <span className={cn("text-[9px] font-bold", currentTheme.muted)}>ID: {order.id.substring(0, 12)}</span>
                         <button className="flex items-center gap-2 text-[10px] font-black uppercase text-[#2e5bff] hover:underline">
                           View Details
                         </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  filteredListings.map((listing, idx) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={listing.id}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "group rounded-[32px] overflow-hidden transition-all flex flex-col",
                    currentTheme.card,
                    "border-white/5 hover:border-white/20"
                  )}
                >
                  <div className="h-48 bg-[#0a0a0a] overflow-hidden relative">
                    {listing.image ? (
                      <img 
                        src={listing.image} 
                        alt={listing.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={cn("w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10")}>
                        <ShoppingBag size={48} className={cn("opacity-20", currentTheme.accent)} />
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-2">
                        <Tag size={10} className={currentTheme.accent} />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">
                          {t.market.categories[listing.category as keyof typeof t.market.categories]}
                        </span>
                      </div>
                    </div>
                    {listing.sellerId === auth.currentUser?.uid && (
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button 
                          onClick={() => startEdit(listing)}
                          className={cn("p-2 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 transition-all hover:bg-[#2e5bff] hover:text-white")}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteListing(listing.id)}
                          className="p-2 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 transition-all hover:bg-red-500 hover:text-white"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className={cn("text-lg font-black tracking-tight leading-tight transition-colors text-white group-hover:text-[#2e5bff]")}>
                        {language === 'ka' ? (listing.titleGe || listing.title) : listing.title}
                      </h4>
                    </div>
                    <p className={cn("text-xs font-bold leading-relaxed mb-6 line-clamp-2", currentTheme.muted)}>
                      {language === 'ka' ? (listing.descriptionGe || listing.description) : listing.description}
                    </p>

                    <div className="mt-auto space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className={cn("text-[8px] font-black uppercase tracking-widest opacity-50", currentTheme.muted)}>{t.market.price}</span>
                          <span className="text-xl font-black text-white">
                            {convertPrice(listing.price, listing.currency || 'USD', displayCurrency).toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
                          </span>
                          {listing.currency !== displayCurrency && (
                            <span className={cn("text-[9px] font-bold opacity-40 italic", currentTheme.muted)}>
                              Original: {listing.price} {listing.currency}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={cn("text-[8px] font-black uppercase tracking-widest opacity-50", currentTheme.muted)}>{t.market.location}</span>
                          <span className="text-[10px] font-bold text-white flex items-center gap-1.5">
                            <span className="text-xs">{WORLD_COUNTRIES.find(c => c.code === listing.country)?.flag || '🌐'}</span>
                            <span className="uppercase tracking-tighter opacity-70">{listing.country}</span>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            {listing.city}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                        <div className={cn("w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-xs", currentTheme.accent)}>
                          {listing.sellerName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black uppercase text-white tracking-wide">{listing.sellerName}</span>
                            <ShieldCheck size={12} className="text-[#2e5bff]" />
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={8} className="fill-[#2e5bff] text-[#2e5bff]" />)}
                          </div>
                        </div>
                        <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-[#2e5bff] hover:border-[#2e5bff]/30 transition-all">
                          <MessageCircle size={18} />
                        </button>
                      </div>

                      {listing.sellerId === auth.currentUser?.uid ? (
                        <button 
                          onClick={() => startEdit(listing)}
                          className={cn("w-full py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2", currentTheme.accentBg)}
                        >
                          <Edit3 size={14} />
                          {t.market.edit_listing}
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleBuyNow(listing)}
                          className={cn("w-full py-4 bg-transparent border border-[#2e5bff]/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#2e5bff] hover:bg-[#2e5bff] hover:text-white transition-all flex items-center justify-center gap-2 group/btn")}
                        >
                          {t.market.buy_now}
                          <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
                ))
              )}
            </AnimatePresence>

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
                    "fixed right-0 top-0 bottom-0 w-[85%] max-w-sm z-[70] p-8 lg:hidden border-l border-white/5 flex flex-col backdrop-blur-[20px]",
                    currentTheme.card
                  )}
                >
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pt-4">
                    {FilterContent}
                  </div>
                  <div className="mt-8">
                    <button 
                      onClick={() => setIsFiltersOpen(false)}
                      className={cn("w-full py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20", currentTheme.accentBg)}
                    >
                      {language === 'ka' ? 'შედეგების ჩვენება' : 'Apply Filters'}
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn("max-w-2xl mx-auto p-10 rounded-[40px] border", currentTheme.card, currentTheme.border)}
        >
           <form onSubmit={handleSubmitListing} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 ml-2", currentTheme.muted)}>{t.market.form.title} (EN)</label>
                    <input 
                       required
                       type="text"
                       value={formData.title}
                       onChange={e => setFormData({...formData, title: e.target.value})}
                       className={cn("w-full px-6 py-4 rounded-2xl border focus:outline-none transition-all text-xs font-bold text-white", currentTheme.input)}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 ml-2", currentTheme.muted)}>{t.market.form.title} (GE)</label>
                    <input 
                       type="text"
                       value={formData.titleGe}
                       onChange={e => setFormData({...formData, titleGe: e.target.value})}
                       className={cn("w-full px-6 py-4 rounded-2xl border focus:outline-none transition-all text-xs font-bold text-white", currentTheme.input)}
                    />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 ml-2", currentTheme.muted)}>{t.market.form.category}</label>
                    <select 
                       value={formData.category}
                       onChange={e => setFormData({...formData, category: e.target.value})}
                       className={cn("w-full px-6 py-4 rounded-2xl border focus:outline-none transition-all text-xs font-bold appearance-none text-white", currentTheme.input)}
                    >
                       {Object.entries(t.market.categories).map(([key, label]) => (
                         <option key={key} value={key}>{label as string}</option>
                       ))}
                    </select>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 ml-2", currentTheme.muted)}>{t.market.form.price}</label>
                    <div className="relative group">
                       <Coins size={14} className={cn("absolute left-6 top-1/2 -translate-y-1/2 opacity-50", currentTheme.accent)} />
                       <input 
                          required
                          type="number"
                          value={formData.price}
                          onChange={e => setFormData({...formData, price: e.target.value})}
                          className={cn("w-full pl-14 pr-6 py-4 rounded-2xl border focus:outline-none transition-all text-xs font-bold text-white", currentTheme.input)}
                       />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 ml-2", currentTheme.muted)}>{t.market.form.currency}</label>
                    <select 
                       value={formData.currency}
                       onChange={e => setFormData({...formData, currency: e.target.value})}
                       className={cn("w-full px-6 py-4 rounded-2xl border focus:outline-none transition-all text-xs font-bold appearance-none text-white", currentTheme.input)}
                    >
                       {CURRENCIES.map(curr => (
                         <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                       ))}
                    </select>
                    {formData.price && formData.currency !== 'USD' && (
                       <p className={cn("text-[10px] font-bold opacity-50 px-2 italic mt-1", currentTheme.muted)}>
                         ≈ {convertPrice(parseFloat(formData.price), formData.currency, 'USD').toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                       </p>
                    )}
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 ml-2", currentTheme.muted)}>{t.market.form.country}</label>
                    <select 
                       value={formData.country}
                       onChange={e => setFormData({...formData, country: e.target.value})}
                       className={cn("w-full px-6 py-4 rounded-2xl border focus:outline-none transition-all text-xs font-bold appearance-none text-white", currentTheme.input)}
                    >
                       {WORLD_COUNTRIES.filter(c => c.code !== 'GLOBAL').map(country => (
                         <option key={country.code} value={country.code}>
                           {country.flag} {country.name}
                         </option>
                       ))}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 ml-2", currentTheme.muted)}>{t.market.form.city}</label>
                    <input 
                       required
                       type="text"
                       value={formData.city}
                       onChange={e => setFormData({...formData, city: e.target.value})}
                       placeholder="Enter city..."
                       className={cn("w-full px-6 py-4 rounded-2xl border focus:outline-none transition-all text-xs font-bold text-white", currentTheme.input)}
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 ml-2", currentTheme.muted)}>{t.market.form.description}</label>
                 <textarea 
                    required
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className={cn("w-full px-6 py-4 rounded-2xl border focus:outline-none transition-all text-xs font-bold h-32 resize-none text-white", currentTheme.input)}
                 />
              </div>

               <div className="space-y-4">
                  <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 ml-2", currentTheme.muted)}>
                    {t.market.form.image_url}
                  </label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "w-full h-48 rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all hover:bg-white/5",
                      currentTheme.input,
                      formData.image ? "border-transparent bg-black/40" : "border-white/10"
                    )}
                  >
                    {formData.image ? (
                      <div className="relative w-full h-full p-2">
                        <img 
                          src={formData.image} 
                          className="w-full h-full object-cover rounded-[24px]" 
                          alt="Preview" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity rounded-[24px]">
                          <Camera className="text-white" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={cn("p-4 rounded-full bg-white/5", currentTheme.accent)}>
                          <Camera size={32} />
                        </div>
                        <span className={cn("text-[10px] font-bold uppercase tracking-widest", currentTheme.muted)}>
                          {t.market.form.upload_button}
                        </span>
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="relative">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-30 text-[10px] font-black">URL</div>
                    <input 
                       type="url"
                       value={formData.image}
                       onChange={e => setFormData({...formData, image: e.target.value})}
                       placeholder="...or paste an external link"
                       className={cn("w-full pl-14 pr-6 py-4 rounded-2xl border focus:outline-none transition-all text-xs font-bold text-white", currentTheme.input)}
                    />
                  </div>
               </div>

              <div className="space-y-2">
                 <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 ml-2", currentTheme.muted)}>{t.market.form.location}</label>
                 <div className="relative">
                    <MapPin size={14} className={cn("absolute left-6 top-1/2 -translate-y-1/2 opacity-50", currentTheme.accent)} />
                    <input 
                       type="text"
                       value={formData.location}
                       onChange={e => setFormData({...formData, location: e.target.value})}
                       placeholder="Detailed address (Street, Apt, etc.)"
                       className={cn("w-full pl-14 pr-6 py-4 rounded-2xl border focus:outline-none transition-all text-xs font-bold text-white", currentTheme.input)}
                    />
                 </div>
              </div>

              <div className="flex gap-4 pt-6">
                 <button 
                   type="button"
                   onClick={() => setViewMode('browse')}
                   className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-white"
                 >
                   {t.common.cancel}
                 </button>
                 <button 
                   disabled={isSubmitting}
                   className={cn("flex-[2] py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2", currentTheme.accentBg)}
                 >
                   {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
                   {viewMode === 'edit' ? t.market.form.update : t.market.form.submit}
                 </button>
              </div>
           </form>
        </motion.div>
      )}
    </motion.div>
  );
}

