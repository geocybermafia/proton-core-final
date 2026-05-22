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
  ArrowRight,
  Link,
  Camera,
  Loader2,
  Globe,
  Coins,
  Sparkles
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
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import { Listing } from '../types';
import { LegalView } from './LegalView';
import { generateTechSpec } from '../services/geminiService';

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
    input: "bg-[#0a0a0a] border-white/10 focus:border-slate-400",
    accent: "text-slate-300",
    accentBg: "bg-slate-600",
    border: "border-white/10",
    muted: "text-[#a0a0a0]"
  },
  forest: {
    card: "bg-[#022c22]/80 border-emerald-500/20 backdrop-blur-xl shadow-2xl shadow-emerald-900/20",
    input: "bg-black/40 border-emerald-500/20 focus:border-emerald-500/50",
    accent: "text-emerald-400",
    accentBg: "bg-emerald-600",
    border: "border-emerald-500/20",
    muted: "text-emerald-200/50"
  },
  sunset: {
    card: "bg-[#431407]/80 border-orange-500/20 backdrop-blur-xl shadow-2xl shadow-orange-900/20",
    input: "bg-black/40 border-orange-500/20 focus:border-orange-500/50",
    accent: "text-orange-400",
    accentBg: "bg-orange-600",
    border: "border-orange-500/20",
    muted: "text-orange-200/50"
  },
  rose: {
    card: "bg-[#2d0611]/80 border-rose-500/20 backdrop-blur-xl shadow-2xl shadow-rose-900/20",
    input: "bg-black/40 border-rose-500/20 focus:border-rose-500/50",
    accent: "text-rose-400",
    accentBg: "bg-rose-600",
    border: "border-rose-500/20",
    muted: "text-rose-200/50"
  },
  vibrant: {
    card: "bg-[#1e1b4b]/80 border-purple-500/20 backdrop-blur-xl shadow-2xl shadow-purple-900/20",
    input: "bg-black/40 border-purple-500/20 focus:border-purple-500/50",
    accent: "text-purple-400",
    accentBg: "bg-purple-600",
    border: "border-purple-500/20",
    muted: "text-purple-200/50"
  },
  midnight: {
    card: "bg-[#0a0a0a] border-white/5 shadow-2xl",
    input: "bg-black border-white/10 focus:border-white/30",
    accent: "text-white",
    accentBg: "bg-zinc-800",
    border: "border-white/5",
    muted: "text-zinc-500"
  },
  industrial: {
    card: "bg-[#0d0d0d] border-white/10 shadow-2xl",
    input: "bg-[#080808] border-white/10 focus:border-[#3b82f6]/50",
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
  const [viewMode, setViewMode] = useState<'browse' | 'my-listings' | 'create' | 'edit' | 'privacy' | 'terms'>('browse');
  const [checkoutItem, setCheckoutItem] = useState<Listing | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

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
  const [orders, setOrders] = useState<any[]>([]);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    titleGe: '',
    description: '',
    descriptionGe: '',
    price: '',
    currency: language === 'ka' ? 'GEL' : 'USD',
    category: 'electronics',
    country: language === 'ka' ? 'GEO' : 'USA',
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
      where('buyerId', '==', auth.currentUser.uid)
    );
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => {
        const at = a.createdAt?.seconds || 0;
        const bt = b.createdAt?.seconds || 0;
        return bt - at;
      });
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
      alert(language === 'ka' ? "თქვენ არ შეგიძლიათ საკუთარი ნივთის ყიდვა." : "You cannot buy your own item.");
      return;
    }
    setCheckoutItem(listing);
  };

  const processPurchase = async () => {
    if (!auth.currentUser || !checkoutItem) return;

    setIsCheckingOut(true);
    try {
      await addDoc(collection(db, 'orders'), {
        listingId: checkoutItem.id,
        buyerId: auth.currentUser.uid,
        sellerId: checkoutItem.sellerId,
        amount: checkoutItem.price,
        currency: checkoutItem.currency || 'USD',
        itemTitle: checkoutItem.title,
        status: 'completed',
        createdAt: serverTimestamp()
      });
      
      setCheckoutItem(null);
      setViewMode('my-listings');
      setProfileSubMode('buying');
    } catch (error) {
      console.error("Error creating order:", error);
      alert(language === 'ka' ? "შეკვეთისას მოხდა შეცდომა." : "Error processing order.");
    } finally {
      setIsCheckingOut(false);
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
          setFormData(prev => ({ ...prev, image: dataUrl }));
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

    setIsAiGenerating(true);
    try {
      if (!auth.currentUser) return;

      // 1. Check Rate Limit (1 gen every 10 mins)
      const usageRef = doc(db, 'users', auth.currentUser.uid, 'usage', 'ai');
      const usageSnap = await getDoc(usageRef);
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
              setFormData(prev => ({ ...prev, description: template }));
            }
            return;
          }
        }
      }

      // 2. Check Cache
      const specId = `${formData.title}_${formData.category}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const cacheRef = doc(db, 'shared_specs', specId);
      const cacheSnap = await getDoc(cacheRef);
      
      if (cacheSnap.exists()) {
        const cachedSpec = cacheSnap.data().spec;
        setFormData(prev => ({ 
          ...prev, 
          description: cachedSpec,
          descriptionGe: language === 'ka' ? cachedSpec : prev.descriptionGe 
        }));
        return;
      }

      // 3. Generate with Gemini
      const spec = await generateTechSpec(formData.title, formData.category);
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

        setFormData(prev => ({ 
          ...prev, 
          description: spec,
          descriptionGe: language === 'ka' ? spec : prev.descriptionGe 
        }));
      } else {
        throw new Error("AI Generation failed");
      }
    } catch (error) {
      console.error("Error generating tech spec:", error);
      alert(language === 'ka' ? "AI-სთან კავშირი ვერ მოხერხდა. გამოიყენეთ შაბლონი." : "AI service unavailable. Falling back to template.");
      const template = getFallbackTemplate(formData.title, formData.category);
      setFormData(prev => ({ ...prev, description: template }));
    } finally {
      setIsAiGenerating(false);
    }
  };

  const checkRateLimit = async () => {
    if (!auth.currentUser) return true;
    
    const oneMinuteAgo = new Date();
    oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1);
    
    const recentListingsQuery = query(
      collection(db, 'listings'),
      where('sellerId', '==', auth.currentUser.uid)
    );
    
    const snapshot = await getDocs(recentListingsQuery);
    const recentCount = snapshot.docs.filter(doc => {
      const createdAt = doc.data().createdAt;
      if (!createdAt) return false;
      const date = createdAt instanceof Timestamp ? createdAt.toDate() : new Date(createdAt);
      return date >= oneMinuteAgo;
    }).length;

    // Limit to 5 listings per minute for safety
    if (recentCount >= 5) {
      return false;
    }
    return true;
  };

  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

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
        price: '', currency: language === 'ka' ? 'GEL' : 'USD', category: 'electronics', 
        country: language === 'ka' ? 'GEO' : 'USA', city: '', location: '', image: ''
      });
    } catch (error: any) {
      console.error("Error saving listing:", error);
      alert(language === 'ka' 
        ? `განცხადების განთავსება ვერ მოხერხდა: ${error.message || 'დაუდგენელი შეცდომა'}` 
        : `Listing placement failed: ${error.message || 'Unknown error'}`
      );
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
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex items-center justify-between mb-2">
        <h3 className={cn("text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2", currentTheme.muted)}>
          <LayoutGrid size={14} className={currentTheme.accent} />
          {language === 'ka' ? 'ფილტრაცია' : 'Refine'}
        </h3>
        <button 
          onClick={() => setIsFiltersOpen(false)} 
          className="lg:hidden p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className={cn("text-[9px] font-black uppercase tracking-widest opacity-40 ml-1", currentTheme.muted)}>
            {t.market.filters.country}
          </label>
          <div className="relative group">
            <Globe size={12} className={cn("absolute left-4 top-1/2 -translate-y-1/2 opacity-40", currentTheme.accent)} />
            <select 
              value={activeCountry}
              onChange={(e) => setActiveCountry(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2.5 border rounded-xl text-[11px] font-bold appearance-none focus:outline-none transition-all text-white",
                currentTheme.input
              )}
            >
              {WORLD_COUNTRIES.map(country => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 opacity-20 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-2">
          <label className={cn("text-[9px] font-black uppercase tracking-widest opacity-40 ml-1", currentTheme.muted)}>
            {t.market.filters.city}
          </label>
          <div className="relative group">
            <MapPin size={12} className={cn("absolute left-4 top-1/2 -translate-y-1/2 opacity-40", currentTheme.accent)} />
            <input 
              type="text"
              value={activeCity}
              onChange={(e) => setActiveCity(e.target.value)}
              placeholder={language === 'ka' ? 'მაგ: თბილისი' : 'e.g. New York'}
              className={cn(
                "w-full pl-10 pr-4 py-2.5 border rounded-xl text-[11px] font-bold focus:outline-none transition-all placeholder:opacity-20 text-white",
                currentTheme.input
              )}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className={cn("text-[9px] font-black uppercase tracking-widest opacity-40 ml-1", currentTheme.muted)}>
            {t.market.form.category}
          </label>
          <div className="flex flex-col gap-1.5">
            <button 
              onClick={() => setActiveCategory('all')}
              className={cn(
                "flex items-center justify-between px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                activeCategory === 'all' 
                  ? cn(currentTheme.accentBg, "border-transparent text-white shadow-lg shadow-blue-500/20")
                  : "bg-white/5 border-transparent text-white/40 hover:bg-white/10"
              )}
            >
              <span>{t.market.all_categories}</span>
              {activeCategory === 'all' && <Star size={10} fill="currentColor" />}
            </button>
            {Object.entries(t.market.categories).map(([key, label]) => (
              <button 
                key={key}
                onClick={() => setActiveCategory(key)}
                className={cn(
                  "flex items-center justify-between px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                  activeCategory === key 
                    ? cn(currentTheme.accentBg, "border-transparent text-white shadow-lg shadow-blue-500/20")
                    : "bg-white/5 border-transparent text-white/40 hover:bg-white/10"
                )}
              >
                <span>{label as string}</span>
                {activeCategory === key && <Star size={10} fill="currentColor" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className={cn("text-[9px] font-black uppercase tracking-widest opacity-40 ml-1", currentTheme.muted)}>
            {t.market.price} (USD)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input 
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min"
              className={cn(
                "w-full px-3 py-2 border rounded-xl text-[11px] font-bold focus:outline-none transition-all placeholder:opacity-20 text-white",
                currentTheme.input
              )}
            />
            <input 
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              className={cn(
                "w-full px-3 py-2 border rounded-xl text-[11px] font-bold focus:outline-none transition-all placeholder:opacity-20 text-white",
                currentTheme.input
              )}
            />
          </div>
        </div>

        <button 
          onClick={clearFilters}
          className={cn("w-full py-3 mt-4 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.2em] hover:text-white hover:bg-red-500/10 hover:border-red-500/20 transition-all flex items-center justify-center gap-2", currentTheme.muted)}
        >
          <Trash2 size={12} />
          {t.market.filters.clear_all}
        </button>
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12 p-1 px-4 lg:px-0 bg-transparent min-h-screen pb-40"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="flex items-center gap-6">
          {viewMode !== 'browse' && (
            <button 
              onClick={() => setViewMode('browse')}
              className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors border border-white/5"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tighter uppercase text-white leading-none">
              <span className={currentTheme.accent}>{t.market.title.split(' ')[0]}</span> {t.market.title.split(' ').slice(1).join(' ')}
            </h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className={cn("font-black tracking-widest uppercase text-[9px] opacity-80", currentTheme.muted)}>
                  {viewMode === 'browse' ? t.market.subtitle : 
                   viewMode === 'my-listings' ? t.market.my_listings :
                   viewMode === 'privacy' ? t.market.legal.privacy_policy :
                   viewMode === 'terms' ? t.market.legal.terms_of_service :
                   viewMode === 'create' ? t.market.create_listing : t.market.edit_listing}
                </span>
              </div>
              {viewMode === 'my-listings' && (
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                  <button 
                    onClick={() => setProfileSubMode('selling')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                      profileSubMode === 'selling' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    {t.market.selling_mode}
                  </button>
                  <button 
                    onClick={() => setProfileSubMode('buying')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                      profileSubMode === 'buying' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
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
          <div className="flex flex-wrap items-center gap-3">
             <div className="relative flex-1 md:flex-none md:w-80 group">
                <Search size={14} className={cn("absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity", currentTheme.accent)} />
                <input 
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.market.search_placeholder}
                  className={cn(
                    "w-full pl-11 pr-4 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-wider focus:outline-none transition-all shadow-inner border border-transparent focus:border-white/10",
                    currentTheme.input
                  )}
                />
             </div>
             
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setViewMode('my-listings')}
                  className={cn("p-3.5 bg-white/5 rounded-2xl transition-all border border-white/5", `hover:bg-white/10 hover:text-white`)}
                  title={t.market.my_listings}
                >
                  <User size={20} />
                </button>
                <button 
                  onClick={() => {
                    setFormData({
                      title: '', titleGe: '', description: '', descriptionGe: '',
                      price: '', currency: language === 'ka' ? 'GEL' : 'USD', category: 'electronics', 
                      country: language === 'ka' ? 'GEO' : 'USA', city: '', location: '', image: ''
                    });
                    setViewMode('create');
                  }}
                  className={cn("p-3.5 rounded-2xl shadow-xl shadow-blue-500/10 hover:brightness-110 active:scale-95 transition-all text-white border border-white/10", currentTheme.accentBg)}
                >
                  <Plus size={20} />
                </button>
             </div>

             <div className="relative group">
                <select 
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value)}
                  className={cn(
                    "pl-4 pr-10 py-3.5 rounded-2xl border appearance-none text-[10px] font-black uppercase tracking-widest focus:outline-none transition-all text-white cursor-pointer bg-white/5",
                    currentTheme.input
                  )}
                >
                  {CURRENCIES.map(curr => (
                    <option key={curr.code} value={curr.code}>{curr.code}</option>
                  ))}
                </select>
                <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 opacity-20 pointer-events-none" />
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
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Sidebar */}
          {viewMode === 'browse' && (
            <aside className="hidden lg:block w-72 shrink-0 space-y-8 animate-in fade-in slide-in-from-left duration-700">
               <div className={cn("p-6 rounded-3xl border border-white/5 sticky top-30 backdrop-blur-xl", currentTheme.card)}>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              <AnimatePresence mode="popLayout">
                {viewMode === 'my-listings' && profileSubMode === 'buying' ? (
                  orders.map((order, idx) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={order.id}
                      className={cn("p-8 rounded-[40px] border border-white/5 group relative overflow-hidden", currentTheme.card)}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-proton-accent/5 blur-3xl rounded-full -mr-16 -mt-16" />
                      <div className="flex items-center justify-between mb-6 relative">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:bg-proton-accent/10 transition-colors">
                          <ShoppingBag size={20} className={currentTheme.accent} />
                        </div>
                        <div className="text-right">
                          <span className={cn("text-[9px] font-black uppercase tracking-widest opacity-40 block mb-1", currentTheme.muted)}>
                            {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                          <span className="inline-flex px-3 py-1 bg-green-500/10 border border-green-500/20 text-[9px] font-black text-green-500 uppercase tracking-[0.1em] rounded-lg">
                            {order.status}
                          </span>
                        </div>
                      </div>
                      <h4 className="text-lg font-black text-white mb-2 uppercase tracking-tight leading-tight">{order.itemTitle}</h4>
                      <p className={cn("text-xs font-bold font-mono", currentTheme.muted)}>
                        {order.amount} {order.currency}
                      </p>
                      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between relative">
                         <span className={cn("text-[9px] font-bold opacity-30 font-mono", currentTheme.muted)}>#{order.id.substring(0, 12).toUpperCase()}</span>
                         <button className="flex items-center gap-2 text-[10px] font-black uppercase text-[#2e5bff] hover:opacity-80 transition-opacity">
                           Details <ChevronRight size={14} />
                         </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  filteredListings.map((listing, idx) => (
                <motion.article 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={listing.id}
                  transition={{ delay: idx * 0.04 }}
                  className={cn(
                    "group rounded-3xl overflow-hidden transition-all flex flex-col relative",
                    currentTheme.card,
                    "border-white/5 hover:border-white/20 hover:shadow-2xl hover:shadow-proton-accent/5"
                  )}
                >
                  <div 
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      setCheckoutItem(listing);
                    }}
                    className="h-52 bg-black/60 overflow-hidden relative cursor-pointer"
                  >
                    {listing.image ? (
                      <motion.img 
                        src={listing.image} 
                        alt={language === 'ka' ? (listing.titleGe || listing.title) : listing.title} 
                        className="w-full h-full object-cover transition-transform duration-1000 ease-out"
                        whileHover={{ scale: 1.05 }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={cn("w-full h-full flex items-center justify-center bg-[#0a0a0a]")}>
                        <ShoppingBag size={40} className={cn("opacity-10", currentTheme.accent)} />
                      </div>
                    )}
                    
                    {/* Badge Overlay */}
                    <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
                      <div className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2">
                        <Tag size={10} className={currentTheme.accent} />
                        <span className="text-[9px] font-black text-white uppercase tracking-wider">
                          {t.market.categories[listing.category as keyof typeof t.market.categories]}
                        </span>
                      </div>
                      <div className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2">
                        <span className="text-xs">{WORLD_COUNTRIES.find(c => c.code === listing.country)?.flag || '🌐'}</span>
                        <span className="text-[9px] font-black text-white uppercase tracking-wider">{listing.city}</span>
                      </div>
                    </div>

                    {listing.sellerId === auth.currentUser?.uid && (
                      <div className="absolute top-4 right-4 flex gap-2 z-10">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(listing);
                          }}
                          className={cn("p-2.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 transition-all hover:bg-white hover:text-black")}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteListing(listing.id);
                          }}
                          className="p-2.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 transition-all hover:bg-red-500 hover:text-white"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                  </div>

                  <div className="p-6 flex-1 flex flex-col relative">
                    <h2 
                      onClick={() => setCheckoutItem(listing)}
                      className="text-lg font-black tracking-tight text-white mb-2 uppercase group-hover:text-proton-accent cursor-pointer transition-colors"
                    >
                      {language === 'ka' ? (listing.titleGe || listing.title) : listing.title}
                    </h2>
                    <p className={cn("text-xs font-medium leading-relaxed mb-6 line-clamp-2 opacity-60", currentTheme.muted)}>
                      {language === 'ka' ? (listing.descriptionGe || listing.description) : listing.description}
                    </p>

                    <div className="mt-auto pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                          <span className={cn("text-[9px] font-black uppercase tracking-widest opacity-40 mb-1", currentTheme.muted)}>{t.market.price}</span>
                          <span className="text-2xl font-black text-white tracking-tighter">
                            {convertPrice(listing.price, listing.currency || 'USD', displayCurrency).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            <span className="text-[10px] font-black opacity-30 ml-1.5 tracking-wider">{displayCurrency}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center font-black text-xs relative", currentTheme.accent)}>
                          {listing.sellerName.substring(0, 2).toUpperCase()}
                          <div className="absolute -top-0.5 -right-0.5 w-2 bg-green-500 rounded-full border-2 border-[#141414]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase text-white tracking-wider truncate">{listing.sellerName}</span>
                            <ShieldCheck size={12} className={currentTheme.accent} />
                          </div>
                          <span className={cn("text-[8px] font-bold uppercase tracking-widest opacity-40 block mt-0.5", currentTheme.muted)}>Verified Vendor</span>
                        </div>
                        <button className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all">
                          <MessageCircle size={16} />
                        </button>
                      </div>

                      <div className="mt-6">
                        {listing.sellerId === auth.currentUser?.uid ? (
                          <button 
                            onClick={() => startEdit(listing)}
                            className={cn(
                              "w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 border border-white/10 hover:bg-white/10 text-white",
                              currentTheme.accentBg
                            )}
                          >
                            <Edit3 size={14} />
                            {t.market.edit_listing}
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleBuyNow(listing)}
                            className={cn(
                              "w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-proton-accent/20 active:scale-[0.98]",
                              currentTheme.accentBg, "text-white"
                            )}
                          >
                            <ShoppingBag size={14} />
                            {t.market.buy_now}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.article>
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
           <form onSubmit={handleSubmitListing} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2", currentTheme.muted)}>{t.market.form.title} (EN)</label>
                    <input 
                       required
                       type="text"
                       value={formData.title}
                       onChange={e => setFormData({...formData, title: e.target.value})}
                       placeholder="e.g. Industrial Control Unit v3"
                       className={cn("w-full px-8 py-5 rounded-[24px] border focus:outline-none transition-all text-xs font-bold text-white shadow-inner bg-white/5", currentTheme.input)}
                    />
                 </div>
                 <div className="space-y-3">
                    <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2", currentTheme.muted)}>{t.market.form.title} (GE)</label>
                    <input 
                       type="text"
                       value={formData.titleGe}
                       onChange={e => setFormData({...formData, titleGe: e.target.value})}
                       placeholder="მაგ: ინდუსტრიული კონტროლერი"
                       className={cn("w-full px-8 py-5 rounded-[24px] border focus:outline-none transition-all text-xs font-bold text-white shadow-inner bg-white/5", currentTheme.input)}
                    />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2", currentTheme.muted)}>{t.market.form.category}</label>
                    <div className="relative group">
                      <select 
                         value={formData.category}
                         onChange={e => setFormData({...formData, category: e.target.value})}
                         className={cn("w-full px-8 py-5 rounded-[24px] border focus:outline-none transition-all text-xs font-bold appearance-none text-white shadow-inner bg-white/5", currentTheme.input)}
                      >
                         {Object.entries(t.market.categories).map(([key, label]) => (
                           <option key={key} value={key}>{label as string}</option>
                         ))}
                      </select>
                      <ChevronRight size={14} className="absolute right-6 top-1/2 -translate-y-1/2 rotate-90 opacity-20 pointer-events-none" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-3">
                     <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2", currentTheme.muted)}>{t.market.form.price}</label>
                     <div className="relative group">
                       <Coins size={14} className={cn("absolute left-6 top-1/2 -translate-y-1/2 opacity-30", currentTheme.accent)} />
                       <input 
                           required
                           type="number"
                           value={formData.price}
                           onChange={e => setFormData({...formData, price: e.target.value})}
                           className={cn("w-full pl-14 pr-6 py-5 rounded-[24px] border focus:outline-none transition-all text-xs font-bold text-white shadow-inner bg-white/5", currentTheme.input)}
                       />
                     </div>
                   </div>
                   <div className="space-y-3">
                     <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2", currentTheme.muted)}>{t.market.form.currency}</label>
                     <div className="relative">
                       <select 
                           value={formData.currency}
                           onChange={e => setFormData({...formData, currency: e.target.value})}
                           className={cn("w-full px-6 py-5 rounded-[24px] border focus:outline-none transition-all text-xs font-bold appearance-none text-white shadow-inner bg-white/5", currentTheme.input)}
                       >
                           {CURRENCIES.map(curr => (
                             <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                           ))}
                       </select>
                       <ChevronRight size={14} className="absolute right-6 top-1/2 -translate-y-1/2 rotate-90 opacity-20 pointer-events-none" />
                     </div>
                   </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2", currentTheme.muted)}>{t.market.form.country}</label>
                    <div className="relative">
                      <select 
                         value={formData.country}
                         onChange={e => setFormData({...formData, country: e.target.value})}
                         className={cn("w-full px-8 py-5 rounded-[24px] border focus:outline-none transition-all text-xs font-bold appearance-none text-white shadow-inner bg-white/5", currentTheme.input)}
                      >
                         {WORLD_COUNTRIES.filter(c => c.code !== 'GLOBAL').map(country => (
                           <option key={country.code} value={country.code}>
                             {country.flag} {country.name}
                           </option>
                         ))}
                      </select>
                      <ChevronRight size={14} className="absolute right-6 top-1/2 -translate-y-1/2 rotate-90 opacity-20 pointer-events-none" />
                    </div>
                 </div>
                 <div className="space-y-3">
                    <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2", currentTheme.muted)}>{t.market.form.city}</label>
                    <input 
                       required
                       type="text"
                       value={formData.city}
                       onChange={e => setFormData({...formData, city: e.target.value})}
                       placeholder="e.g. Tbilisi"
                       className={cn("w-full px-8 py-5 rounded-[24px] border focus:outline-none transition-all text-xs font-bold text-white shadow-inner bg-white/5", currentTheme.input)}
                    />
                 </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-40", currentTheme.muted)}>{t.market.form.description}</label>
                  <button
                    type="button"
                    onClick={handleAiDescription}
                    disabled={isAiGenerating}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                      "bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 text-white"
                    )}
                  >
                    {isAiGenerating ? (
                      <Loader2 size={12} className="animate-spin text-[#2e5bff]" />
                    ) : (
                      <Sparkles size={12} className="text-[#2e5bff]" />
                    )}
                    {language === 'ka' ? 'AI სპეციფიკაცია' : 'AI Generate Spec'}
                  </button>
                </div>
                <textarea 
                    required
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Technical specifications and details..."
                    className={cn("w-full px-8 py-6 rounded-[32px] border focus:outline-none transition-all text-xs font-medium h-48 resize-none text-white shadow-inner bg-white/5", currentTheme.input)}
                />
              </div>

               <div className="space-y-6">
                  <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2", currentTheme.muted)}>
                    {t.market.form.image_url}
                  </label>
                  <label 
                    className={cn(
                      "w-full h-64 rounded-[48px] border-2 border-dashed flex flex-col items-center justify-center gap-6 cursor-pointer transition-all hover:bg-white/5 overflow-hidden group",
                      currentTheme.input,
                      (formData.image || isResizing) ? "border-transparent bg-black/40" : "border-white/10"
                    )}
                  >
                    <input 
                      type="file" 
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    {isResizing ? (
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className={cn("w-12 h-12 animate-spin text-[#2e5bff]")} />
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", currentTheme.muted)}>
                          {language === 'ka' ? 'ინფორმაცია მუშავდება...' : 'Optimizing Visual...'}
                        </span>
                      </div>
                    ) : formData.image ? (
                      <div className="relative w-full h-full p-4">
                        <img 
                          src={formData.image} 
                          className="w-full h-full object-cover rounded-[32px] transition-transform duration-700 group-hover:scale-105" 
                          alt={formData.title ? (language === 'ka' ? `სურათი: ${formData.titleGe || formData.title}` : `Asset preview: ${formData.title}`) : (language === 'ka' ? 'ატვირთული სურათის პრევიუ' : 'Uploaded asset preview')} 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-[32px] backdrop-blur-sm">
                          <div className="p-4 bg-white/10 rounded-2xl border border-white/20">
                            <Camera className="text-white" size={32} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <div className={cn("p-6 rounded-[32px] bg-white/5 border border-white/10 group-hover:scale-110 transition-transform", currentTheme.accent)}>
                          <Camera size={40} />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", currentTheme.muted)}>
                          {t.market.form.upload_button}
                        </span>
                      </div>
                    )}
                  </label>
                  <div className="relative group">
                 <Link size={14} className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20" />
                    <input 
                       type="url"
                       value={formData.image}
                       onChange={e => setFormData({...formData, image: e.target.value})}
                       placeholder="...or paste external secure URL"
                       className={cn("w-full pl-14 pr-6 py-5 rounded-[24px] border focus:outline-none transition-all text-xs font-bold text-white shadow-inner bg-white/5", currentTheme.input)}
                    />
                  </div>
               </div>

              <div className="space-y-3">
                 <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-2", currentTheme.muted)}>{t.market.form.location}</label>
                 <div className="relative group">
                    <MapPin size={16} className={cn("absolute left-6 top-1/2 -translate-y-1/2 opacity-30", currentTheme.accent)} />
                    <input 
                       type="text"
                       value={formData.location}
                       onChange={e => setFormData({...formData, location: e.target.value})}
                       placeholder="Detailed operational address"
                       className={cn("w-full pl-14 pr-6 py-5 rounded-[24px] border focus:outline-none transition-all text-xs font-bold text-white shadow-inner bg-white/5", currentTheme.input)}
                    />
                 </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 pt-10">
                 <button 
                   type="button"
                   onClick={() => setViewMode('browse')}
                   className="flex-1 py-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[24px] text-[10px] font-black uppercase tracking-[0.3em] transition-all text-white flex items-center justify-center gap-2"
                 >
                   <ArrowLeft size={16} />
                   {t.common.cancel}
                 </button>
                 <button 
                   disabled={isSubmitting}
                   className={cn("flex-[2] py-6 text-white rounded-[24px] text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/10", currentTheme.accentBg)}
                 >
                   {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                   {viewMode === 'edit' ? t.market.form.update : t.market.form.submit}
                 </button>
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
      </AnimatePresence>
    </motion.div>
  );
}

