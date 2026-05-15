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
  Loader2
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
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import { Listing } from '../types';

interface MarketViewProps {
  language: 'en' | 'ka';
  t: any;
  themeId: string;
}

const MARKET_THEMES: Record<string, { card: string; input: string }> = {
  light: {
    card: "bg-white border-slate-200 shadow-xl",
    input: "bg-slate-100 border-slate-200 focus:border-slate-400"
  },
  proton: {
    card: "bg-proton-card/50 backdrop-blur-xl border-proton-border shadow-2xl",
    input: "bg-proton-bg/40 border-proton-border focus:border-proton-accent/50"
  },
  titanium: {
    card: "bg-white/90 backdrop-blur-md border-sky-100 shadow-2xl",
    input: "bg-sky-50/50 border-sky-100 focus:border-sky-300"
  },
  vibrant: {
    card: "bg-[#1a1033]/80 backdrop-blur-xl border-purple-500/30 shadow-2xl shadow-purple-500/10",
    input: "bg-purple-900/20 border-purple-500/20 focus:border-purple-400"
  },
  midnight: {
    card: "bg-slate-900 border-slate-800 shadow-2xl",
    input: "bg-slate-800/50 border-slate-700 focus:border-slate-500"
  }
};

export function MarketView({ language, t, themeId }: MarketViewProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'browse' | 'my-listings' | 'create' | 'edit'>('browse');
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    titleGe: '',
    description: '',
    descriptionGe: '',
    price: '',
    category: 'electronics',
    location: '',
    image: ''
  });

  const currentTheme = MARKET_THEMES[themeId] || MARKET_THEMES.proton;

  useEffect(() => {
    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Listing[];
      setListings(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredListings = useMemo(() => {
    let result = listings;
    
    // Filter by View Mode
    if (viewMode === 'my-listings') {
      result = result.filter(l => l.sellerId === auth.currentUser?.uid);
    }

    // Filter by Category
    if (activeCategory !== 'all') {
      result = result.filter(l => l.category === activeCategory);
    }

    // Filter by Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(l => {
        const title = language === 'ka' ? (l.titleGe || l.title) : l.title;
        const desc = language === 'ka' ? (l.descriptionGe || l.description) : l.description;
        return title.toLowerCase().includes(s) || 
               desc.toLowerCase().includes(s) ||
               l.sellerName.toLowerCase().includes(s);
      });
    }

    return result;
  }, [listings, search, activeCategory, viewMode, language]);

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
        currency: 'USD',
        sellerId: auth.currentUser.uid,
        sellerName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Unknown',
        category: formData.category,
        location: formData.location || 'Global',
        image: formData.image || '',
        createdAt: Date.now(),
        status: 'active'
      };

      if (viewMode === 'edit' && editingListing) {
        await updateDoc(doc(db, 'listings', editingListing.id), listingData);
      } else {
        await addDoc(collection(db, 'listings'), listingData);
      }

      setViewMode('browse');
      setFormData({
        title: '', titleGe: '', description: '', descriptionGe: '',
        price: '', category: 'electronics', location: '', image: ''
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
      category: listing.category,
      location: listing.location,
      image: listing.image || ''
    });
    setViewMode('edit');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 p-1 px-4 lg:px-0"
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
            <h2 className="text-4xl font-black mb-2 tracking-tight uppercase">
              <span className="text-proton-accent">{t.market.title.split(' ')[0]}</span> {t.market.title.split(' ').slice(1).join(' ')}
            </h2>
            <p className="text-proton-muted font-bold tracking-wide uppercase text-xs opacity-60">
              {viewMode === 'browse' ? t.market.subtitle : 
               viewMode === 'my-listings' ? t.market.my_listings :
               viewMode === 'create' ? t.market.create_listing : t.market.edit_listing}
            </p>
          </div>
        </div>

        {viewMode === 'browse' && (
          <div className="flex items-center gap-4">
             <div className="relative w-full md:w-64 group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-accent group-focus-within:scale-110 transition-transform">
                  <Search size={16} />
                </div>
                <input 
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.market.search_placeholder}
                  className={cn(
                    "w-full pl-11 pr-4 py-3 bg-proton-bg/40 border border-white/5 rounded-[20px] text-[11px] font-bold uppercase tracking-wider focus:border-proton-accent/50 focus:outline-none transition-all shadow-inner",
                    currentTheme.input
                  )}
                />
             </div>
             <button 
               onClick={() => setViewMode('my-listings')}
               className="p-3 bg-white/5 rounded-2xl hover:bg-proton-accent hover:text-proton-bg transition-all"
               title={t.market.my_listings}
             >
               <User size={20} />
             </button>
             <button 
               onClick={() => setViewMode('create')}
               className="p-3 bg-proton-accent text-proton-bg rounded-2xl shadow-lg shadow-proton-accent/20 hover:brightness-110 active:scale-95 transition-all"
             >
               <Plus size={20} />
             </button>
          </div>
        )}
      </div>

      {viewMode === 'browse' || viewMode === 'my-listings' ? (
        <div className="space-y-8">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
            <button 
              onClick={() => setActiveCategory('all')}
              className={cn(
                "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0",
                activeCategory === 'all' 
                  ? "bg-proton-accent border-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20"
                  : "border-white/5 text-white/40 hover:border-white/20 hover:bg-white/5"
              )}
            >
              {t.market.all_categories}
            </button>
            {Object.entries(t.market.categories).map(([key, label]) => (
              <button 
                key={key}
                onClick={() => setActiveCategory(key)}
                className={cn(
                  "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0",
                  activeCategory === key 
                    ? "bg-proton-accent border-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20"
                    : "border-white/5 text-white/40 hover:border-white/20 hover:bg-white/5"
                )}
              >
                {label as string}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredListings.map((listing, idx) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={listing.id}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "group rounded-[32px] border border-white/5 overflow-hidden transition-all hover:border-proton-accent/30 flex flex-col",
                    currentTheme.card
                  )}
                >
                  <div className="h-48 bg-proton-bg overflow-hidden relative">
                    {listing.image ? (
                      <img 
                        src={listing.image} 
                        alt={listing.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-proton-accent/5 to-proton-accent/10">
                        <ShoppingBag size={48} className="text-proton-accent opacity-20" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-2">
                        <Tag size={10} className="text-proton-accent" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">
                          {t.market.categories[listing.category as keyof typeof t.market.categories]}
                        </span>
                      </div>
                    </div>
                    {listing.sellerId === auth.currentUser?.uid && (
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button 
                          onClick={() => startEdit(listing)}
                          className="p-2 bg-white/10 hover:bg-proton-accent hover:text-proton-bg backdrop-blur-md rounded-xl border border-white/10 transition-all"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteListing(listing.id)}
                          className="p-2 bg-white/10 hover:bg-red-500 hover:text-white backdrop-blur-md rounded-xl border border-white/10 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-black tracking-tight leading-tight group-hover:text-proton-accent transition-colors">
                        {language === 'ka' ? (listing.titleGe || listing.title) : listing.title}
                      </h4>
                    </div>
                    <p className="text-xs text-proton-muted font-bold leading-relaxed mb-6 line-clamp-2">
                      {language === 'ka' ? (listing.descriptionGe || listing.description) : listing.description}
                    </p>

                    <div className="mt-auto space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-proton-muted uppercase tracking-widest opacity-50">{t.market.price}</span>
                          <span className="text-lg font-black text-white">
                            {listing.price} {listing.currency}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-black text-proton-muted uppercase tracking-widest opacity-50">{t.market.location}</span>
                          <span className="text-[10px] font-bold text-white flex items-center gap-1">
                            <MapPin size={10} className="text-proton-accent" />
                            {listing.location}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-proton-accent/10 border border-proton-accent/20 flex items-center justify-center text-proton-accent font-black text-xs">
                          {listing.sellerName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black uppercase text-white tracking-wide">{listing.sellerName}</span>
                            <ShieldCheck size={12} className="text-green-500" />
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={8} className="fill-proton-accent text-proton-accent" />)}
                          </div>
                        </div>
                        <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-proton-accent hover:border-proton-accent/30 transition-all">
                          <MessageCircle size={18} />
                        </button>
                      </div>

                      {listing.sellerId === auth.currentUser?.uid ? (
                        <button 
                          onClick={() => startEdit(listing)}
                          className="w-full py-4 bg-proton-accent text-proton-bg rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-proton-accent/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Edit3 size={14} />
                          {t.market.edit_listing}
                        </button>
                      ) : (
                        <button className="w-full py-4 bg-proton-bg border-2 border-proton-accent/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-proton-accent hover:bg-proton-accent hover:text-proton-bg hover:border-proton-accent transition-all flex items-center justify-center gap-2 group/btn">
                          {t.market.buy_now}
                          <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {!loading && filteredListings.length === 0 && (
            <div className="py-32 text-center space-y-6">
              <div className="w-20 h-20 bg-white/5 rounded-[40px] flex items-center justify-center mx-auto border border-white/10">
                <Search size={32} className="text-proton-muted opacity-20" />
              </div>
              <p className="text-sm font-bold text-proton-muted uppercase tracking-widest">{t.market.no_results}</p>
            </div>
          )}

          {loading && (
             <div className="flex justify-center py-20">
                <Loader2 className="w-10 h-10 text-proton-accent animate-spin" />
             </div>
          )}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn("max-w-2xl mx-auto p-10 rounded-[40px] border border-white/5", currentTheme.card)}
        >
           <form onSubmit={handleSubmitListing} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted opacity-60 ml-2">{t.market.form.title} (EN)</label>
                    <input 
                       required
                       type="text"
                       value={formData.title}
                       onChange={e => setFormData({...formData, title: e.target.value})}
                       className={cn("w-full px-6 py-4 rounded-2xl border border-white/5 bg-proton-bg/40 focus:outline-none focus:border-proton-accent transition-all text-xs font-bold", currentTheme.input)}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted opacity-60 ml-2">{t.market.form.title} (GE)</label>
                    <input 
                       type="text"
                       value={formData.titleGe}
                       onChange={e => setFormData({...formData, titleGe: e.target.value})}
                       className={cn("w-full px-6 py-4 rounded-2xl border border-white/5 bg-proton-bg/40 focus:outline-none focus:border-proton-accent transition-all text-xs font-bold", currentTheme.input)}
                    />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted opacity-60 ml-2">{t.market.form.category}</label>
                    <select 
                       value={formData.category}
                       onChange={e => setFormData({...formData, category: e.target.value})}
                       className={cn("w-full px-6 py-4 rounded-2xl border border-white/5 bg-proton-bg/40 focus:outline-none focus:border-proton-accent transition-all text-xs font-bold appearance-none", currentTheme.input)}
                    >
                       {Object.entries(t.market.categories).map(([key, label]) => (
                         <option key={key} value={key}>{label as string}</option>
                       ))}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted opacity-60 ml-2">{t.market.form.price} (USD)</label>
                    <input 
                       required
                       type="number"
                       value={formData.price}
                       onChange={e => setFormData({...formData, price: e.target.value})}
                       className={cn("w-full px-6 py-4 rounded-2xl border border-white/5 bg-proton-bg/40 focus:outline-none focus:border-proton-accent transition-all text-xs font-bold", currentTheme.input)}
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted opacity-60 ml-2">{t.market.form.description}</label>
                 <textarea 
                    required
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className={cn("w-full px-6 py-4 rounded-2xl border border-white/5 bg-proton-bg/40 focus:outline-none focus:border-proton-accent transition-all text-xs font-bold h-32 resize-none", currentTheme.input)}
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted opacity-60 ml-2">{t.market.form.image_url}</label>
                 <div className="relative">
                    <Camera size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-proton-accent opacity-50" />
                    <input 
                       type="url"
                       value={formData.image}
                       onChange={e => setFormData({...formData, image: e.target.value})}
                       placeholder="https://images.unsplash.com/..."
                       className={cn("w-full pl-14 pr-6 py-4 rounded-2xl border border-white/5 bg-proton-bg/40 focus:outline-none focus:border-proton-accent transition-all text-xs font-bold", currentTheme.input)}
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted opacity-60 ml-2">{t.market.form.location}</label>
                 <input 
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="Tbilisi, GE"
                    className={cn("w-full px-6 py-4 rounded-2xl border border-white/5 bg-proton-bg/40 focus:outline-none focus:border-proton-accent transition-all text-xs font-bold", currentTheme.input)}
                 />
              </div>

              <div className="flex gap-4 pt-6">
                 <button 
                   type="button"
                   onClick={() => setViewMode('browse')}
                   className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                 >
                   {t.common.cancel}
                 </button>
                 <button 
                   disabled={isSubmitting}
                   className="flex-[2] py-4 bg-proton-accent text-proton-bg rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-proton-accent/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
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

