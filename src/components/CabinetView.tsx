import React, { useEffect, useState } from 'react';
import { UserProfile, Theme } from '../types';
import { User as UserIcon, Mail, Globe, Bell, Shield, Wallet, Save, RefreshCw, Layers, Settings, Palette, Sun, Moon, Zap, Sparkles, Circle, CreditCard, Star, ExternalLink, ZapOff, Gift, TrendingUp, ShoppingBag, CheckCircle, Package, Clock, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc, increment, collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts';

interface CabinetViewProps {
  profile: UserProfile | null;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const THEME_OPTIONS: { id: Theme; label: string; icon: any; color: string; bg: string }[] = [
  { id: 'light', label: 'Light', icon: Sun, color: 'bg-slate-200', bg: 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-800' },
  { id: 'titanium', label: 'Titanium', icon: Circle, color: 'bg-sky-400', bg: 'bg-gradient-to-br from-slate-700 to-slate-900 border-slate-500' },
  { id: 'proton', label: 'Cyber', icon: Zap, color: 'bg-cyan-400', bg: 'bg-[radial-gradient(circle_at_50%_50%,#0d1117_0%,#010409_100%)] border-cyan-500/20' },
  { id: 'forest', label: 'Forest', icon: Layers, color: 'bg-emerald-500', bg: 'bg-gradient-to-br from-emerald-900 via-emerald-950 to-black border-emerald-500/20' },
  { id: 'sunset', label: 'Sunset', icon: Sparkles, color: 'bg-orange-400', bg: 'bg-gradient-to-br from-orange-900 via-red-950 to-black border-orange-500/20' },
  { id: 'rose', label: 'Rose', icon: Sparkles, color: 'bg-rose-500', bg: 'bg-gradient-to-br from-rose-900 via-rose-950 to-black border-rose-500/20' },
  { id: 'vibrant', label: 'Nebula', icon: Sparkles, color: 'bg-purple-500', bg: 'bg-gradient-to-br from-indigo-900 via-purple-950 to-black border-purple-500/20' },
  { id: 'midnight', label: 'Dark', icon: Moon, color: 'bg-slate-900', bg: 'bg-gradient-to-br from-neutral-900 to-black border-neutral-800' },
];

export default function CabinetView({ profile, theme, setTheme }: CabinetViewProps) {
  const [isDesignOpen, setIsDesignOpen] = React.useState(false);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [sellerListings, setSellerListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch Seller Listings
    const qListings = query(
      collection(db, 'listings'),
      where('sellerId', '==', auth.currentUser.uid)
    );

    const unsubListings = onSnapshot(qListings, (snapshot) => {
      setSellerListings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Seller Orders (Received)
    const qOrders = query(
      collection(db, 'orders'),
      where('sellerId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setSellerOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubListings();
      unsubOrders();
    };
  }, []);

  if (!profile) return null;
  const rawLang = profile.language?.toLowerCase() || 'ka';
  const lang = (rawLang === 'ka' || rawLang === 'georgian') ? 'ka' : 'en';
  
  // Safe translation access
  const t = translations[lang as keyof typeof translations]?.cabinet || translations.en.cabinet;

  const handleUpdate = async (field: string, value: any) => {
    if (!auth.currentUser) return;
    const docRef = doc(db, 'users', auth.currentUser.uid);
    try {
      await updateDoc(docRef, { [field]: value });
    } catch (e) {
      console.error("Update failed", e);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    } catch (e) {
      console.error("Order update failed", e);
    }
  };

  const totalRevenue = sellerOrders.reduce((sum, order) => sum + (Number(order.price) || 0), 0);
  
  // Chart Data preparation (Last 7 days)
  const chartData = [
    { name: 'Mon', sales: 4000 },
    { name: 'Tue', sales: 3000 },
    { name: 'Wed', sales: 2000 },
    { name: 'Thu', sales: 2780 },
    { name: 'Fri', sales: 1890 },
    { name: 'Sat', sales: 2390 },
    { name: 'Sun', sales: 3490 },
  ];

  const isUrl = (str: string) => str.startsWith('http') || str.startsWith('data:image');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20 max-w-7xl mx-auto">
      {/* 1. COMPACT HEADER */}
      <section className="relative overflow-hidden group">
         <div className="absolute inset-0 bg-proton-card border border-proton-border rounded-2xl shadow-xl transition-all duration-500 group-hover:border-proton-accent/30" />
         
         <div className="relative p-6 px-10 flex flex-col md:flex-row gap-8 items-center">
            <div className="relative shrink-0">
               <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-br from-proton-accent via-blue-500 to-indigo-600 p-[2px] shadow-2xl">
                  <div className="w-full h-full bg-proton-bg rounded-[22px] flex items-center justify-center overflow-hidden">
                     {profile.avatar && isUrl(profile.avatar) ? (
                        <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     ) : (
                        <span className="text-4xl font-black text-proton-accent uppercase">{profile.name.charAt(0)}</span>
                     )}
                  </div>
               </div>
               <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-proton-accent rounded-xl flex items-center justify-center border-4 border-proton-card shadow-lg text-proton-bg">
                  <ShieldCheck size={16} />
               </div>
            </div>

            <div className="flex-1 text-center md:text-left min-w-0">
               <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-proton-text truncate">{profile.name}</h2>
                  <div className="px-3 py-1 bg-proton-accent/10 border border-proton-accent/20 text-proton-accent text-[10px] font-black rounded-lg uppercase tracking-widest animate-pulse h-fit w-fit mx-auto md:mx-0">
                     {t.verified}
                  </div>
               </div>
               <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-proton-muted font-bold text-sm mt-3">
                  <span className="flex items-center gap-2 hover:text-proton-text transition-colors"><Mail size={16} className="text-proton-accent" /> {profile.email}</span>
                  <span className="flex items-center gap-2 hover:text-proton-text transition-colors"><Globe size={16} className="text-emerald-500" /> {lang.toUpperCase()} Node</span>
               </div>
            </div>
         </div>
      </section>

      {/* SELLER ANALYTICS SECTION */}
      <section className="bg-proton-card border border-proton-border rounded-2xl p-8 shadow-xl space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <TrendingUp size={200} />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-proton-text flex items-center gap-3">
              <ShoppingBag className="text-proton-accent" size={24} />
              {(t as any).seller_dashboard}
            </h3>
            <p className="text-xs text-proton-muted font-bold uppercase tracking-widest mt-1 opacity-70">
              {(t as any).analytics_desc}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="px-4 py-2 bg-proton-bg/40 border border-proton-border rounded-xl flex items-center gap-3">
              <Clock size={14} className="text-proton-muted" />
              <span className="text-[10px] font-black uppercase text-proton-text tracking-widest">Live Sync</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          <div className="p-6 bg-proton-bg/20 border border-proton-border rounded-2xl hover:border-proton-accent/30 transition-all group">
            <p className="text-[10px] font-black uppercase text-proton-muted tracking-widest mb-2 group-hover:text-proton-accent transition-colors">{(t as any).total_sales}</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-black text-proton-text">{sellerOrders.length}</p>
              <span className="text-[10px] font-bold text-emerald-500 mb-1.5 flex items-center gap-1"><ArrowUpRight size={12} />+12%</span>
            </div>
          </div>
          <div className="p-6 bg-proton-bg/20 border border-proton-border rounded-2xl hover:border-proton-accent/30 transition-all group">
            <p className="text-[10px] font-black uppercase text-proton-muted tracking-widest mb-2 group-hover:text-emerald-400 transition-colors">{(t as any).revenue}</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-black text-proton-text">${totalRevenue.toLocaleString()}</p>
              <span className="text-[10px] font-bold text-emerald-500 mb-1.5 uppercase">USDT</span>
            </div>
          </div>
          <div className="p-6 bg-proton-bg/20 border border-proton-border rounded-2xl hover:border-proton-accent/30 transition-all group">
            <p className="text-[10px] font-black uppercase text-proton-muted tracking-widest mb-2 group-hover:text-amber-400 transition-colors">{(t as any).active_listings}</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-black text-proton-text">{sellerListings.length}</p>
              <span className="text-[10px] font-bold text-proton-muted mb-1.5 uppercase">Items</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          {/* Revenue Chart */}
          <div className="h-[250px] bg-proton-bg/20 border border-proton-border rounded-2xl p-6 transition-all hover:bg-proton-bg/30">
            <div className="flex justify-between items-center mb-6">
              <p className="text-[10px] font-black uppercase text-proton-text tracking-widest">Performance</p>
              <div className="flex gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-proton-accent" />
                 <div className="w-1.5 h-1.5 rounded-full bg-proton-accent/20" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} stroke="#6b7280" />
                <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1f2937', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Orders Table */}
          <div className="bg-proton-bg/20 border border-proton-border rounded-2xl overflow-hidden">
            <div className="p-6 pb-2 border-b border-proton-border flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase text-proton-text tracking-widest">{(t as any).recent_orders}</h4>
              <Package size={14} className="text-proton-muted" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-proton-border uppercase text-[10px] font-black text-proton-muted tracking-widest">
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-proton-border/50">
                  {sellerOrders.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-proton-muted font-bold italic uppercase tracking-widest opacity-40">
                        {(t as any).no_orders}
                      </td>
                    </tr>
                  ) : (
                    sellerOrders.slice(0, 5).map((order) => (
                      <tr key={order.id} className="group hover:bg-proton-accent/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-proton-accent/10 overflow-hidden border border-proton-border">
                              <img src={order.image} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="font-black text-proton-text truncate max-w-[120px]">{order.title}</p>
                              <p className="text-[9px] font-bold text-proton-muted uppercase tracking-tight">${order.price}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border",
                            order.status === 'completed' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                            order.status === 'shipped' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                            "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          )}>
                            {order.status || 'pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                             {order.status !== 'shipped' && order.status !== 'completed' && (
                               <button 
                                 onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}
                                 className="px-2 py-1 bg-proton-accent text-proton-bg rounded-md text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                               >
                                 {(t as any).ship_order}
                               </button>
                             )}
                             {order.status === 'shipped' && (
                               <button 
                                 onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                                 className="px-2 py-1 bg-emerald-500 text-white rounded-md text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                               >
                                 {(t as any).complete_order}
                               </button>
                             )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* 2. DESIGN / THEME SWITCHER - COLLAPSIBLE */}
         <section className="bg-proton-card border border-proton-border rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
            <button 
               onClick={() => setIsDesignOpen(!isDesignOpen)}
               className="w-full flex items-center justify-between p-6 px-8 hover:bg-proton-bg/20 transition-colors"
            >
               <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-xl bg-gradient-to-br from-proton-accent/20 to-transparent text-proton-accent transition-transform duration-500 shadow-inner", isDesignOpen && "rotate-12 scale-110")}>
                     <Palette size={20} />
                  </div>
                  <div className="text-left">
                     <h3 className="text-sm font-black uppercase tracking-widest text-proton-text">{(t as any).design_title}</h3>
                     <p className="text-[10px] text-proton-muted font-bold uppercase tracking-widest mt-0.5 opacity-60">
                        {(t as any).design_desc}
                     </p>
                  </div>
               </div>
               <motion.div
                  animate={{ rotate: isDesignOpen ? 180 : 0 }}
                  transition={{ duration: 0.5, type: "spring" }}
                  className="text-proton-muted"
               >
                  <Settings size={18} />
               </motion.div>
            </button>
            
            <AnimatePresence>
               {isDesignOpen && (
                  <motion.div
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ duration: 0.5, ease: "circOut" }}
                  >
                     <div className="p-8 pt-0">
                        <div className="h-px bg-gradient-to-r from-transparent via-proton-border to-transparent mb-8 opacity-40" />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                           {THEME_OPTIONS.map((opt) => (
                              <button
                                 key={opt.id}
                                 onClick={() => setTheme(opt.id)}
                                 className={cn(
                                    "p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all border group relative overflow-hidden",
                                    theme === opt.id 
                                       ? "border-proton-accent shadow-[0_0_30px_rgba(0,242,255,0.1)] ring-2 ring-proton-accent/20 scale-[1.02]" 
                                       : "border-proton-border hover:border-proton-accent/40 hover:scale-[1.02]",
                                    opt.bg
                                 )}
                              >
                                 <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500", 
                                    theme === opt.id ? "bg-proton-accent text-proton-bg shadow-xl rotate-6" : "bg-white/10 group-hover:bg-white/20 group-hover:rotate-3"
                                 )}>
                                    <opt.icon size={24} />
                                 </div>
                                 <span className={cn(
                                    "text-[10px] font-black uppercase tracking-[0.2em]",
                                    theme === opt.id ? "text-proton-accent" : "text-white/60 group-hover:text-white"
                                 )}>
                                    {(t as any)[`theme_${opt.id}`] || opt.label}
                                 </span>
                                 
                                 {theme === opt.id && (
                                    <motion.div 
                                       layoutId="theme-active-indicator"
                                       className="absolute top-3 right-3"
                                    >
                                       <div className="w-2 h-2 bg-proton-accent rounded-full shadow-[0_0_12px_rgba(0,242,255,1)] animate-pulse" />
                                    </motion.div>
                                 )}
                              </button>
                           ))}
                        </div>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>
         </section>

         {/* 5. SETTINGS */}
         <section className="bg-proton-card border border-proton-border rounded-2xl p-8 space-y-6 shadow-xl relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="flex items-center gap-4 border-b border-proton-border pb-4">
               <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                  <Settings size={20} />
               </div>
               <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-proton-text">{t.config_title}</h3>
                  <p className="text-[10px] text-proton-muted font-bold uppercase tracking-widest mt-0.5 opacity-60">System Preferences</p>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
               <div className="flex items-center justify-between p-5 bg-proton-bg/20 rounded-2xl border border-proton-border hover:bg-proton-bg/30 transition-all cursor-default">
                  <div className="space-y-1">
                     <div className="text-xs font-black uppercase text-proton-text tracking-widest">{t.language_label}</div>
                     <div className="text-[10px] text-proton-muted font-bold uppercase tracking-widest opacity-60">{t.language_desc}</div>
                  </div>
                  <select 
                     value={profile.language}
                     onChange={(e) => handleUpdate('language', e.target.value)}
                     className="bg-proton-bg border border-proton-border rounded-xl px-5 py-2 text-[10px] font-black text-proton-text focus:outline-none focus:border-proton-accent cursor-pointer hover:border-proton-accent/50 transition-colors uppercase tracking-widest shadow-inner"
                  >
                     <option value="en">English (US)</option>
                     <option value="ka">ქართული (GE)</option>
                  </select>
               </div>

               <div className="flex items-center justify-between p-5 bg-proton-bg/20 rounded-2xl border border-proton-border hover:bg-proton-bg/30 transition-all cursor-default">
                  <div className="space-y-1">
                     <div className="text-xs font-black uppercase text-proton-text tracking-widest">{t.notifications_label}</div>
                     <div className="text-[10px] text-proton-muted font-bold uppercase tracking-widest opacity-60">{t.notifications_desc}</div>
                  </div>
                  <button 
                     onClick={() => handleUpdate('notifications', !profile.notifications)}
                     className={cn(
                        "w-12 h-6 rounded-full transition-all relative flex items-center shadow-inner",
                        profile.notifications ? "bg-proton-accent" : "bg-white/10"
                     )}
                  >
                     <motion.div 
                        animate={{ x: profile.notifications ? 26 : 4 }}
                        className={cn("w-4 h-4 rounded-lg bg-white shadow-lg flex items-center justify-center")}
                     >
                        <div className={cn("w-1.5 h-1.5 rounded-full", profile.notifications ? "bg-proton-bg" : "bg-proton-muted")} />
                     </motion.div>
                  </button>
               </div>
            </div>
         </section>

         {/* 4. NETWORK diagnostic */}
         <section className="bg-proton-card border border-proton-border rounded-2xl p-8 space-y-6 shadow-xl relative group overflow-hidden">
            <div className="absolute -right-4 -bottom-4 text-emerald-500/5 rotate-12 transition-transform group-hover:scale-110 duration-1000">
              <Globe size={120} />
            </div>
            
            <div className="flex items-center justify-between border-b border-proton-border pb-4">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:animate-pulse">
                    <Globe size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-proton-text">{t.connection_title}</h3>
                    <p className="text-[10px] text-proton-muted font-bold uppercase tracking-widest mt-0.5 opacity-60">Neural Network Status</p>
                  </div>
               </div>
               <button className="text-proton-muted hover:text-proton-accent transition-all hover:rotate-180 duration-500 p-2">
                  <RefreshCw size={16} />
               </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="p-5 bg-proton-bg/20 border border-proton-border rounded-2xl hover:bg-proton-bg/30 transition-all">
                  <span className="text-[10px] font-black text-proton-muted uppercase tracking-[0.2em] block mb-2 opacity-60">{t.region_label}</span>
                  <div className="text-sm font-mono font-black text-white tracking-widest">EU-CENTRAL-1</div>
               </div>
               <div className="p-5 bg-proton-bg/20 border border-proton-border rounded-2xl hover:bg-proton-bg/30 transition-all">
                  <span className="text-[10px] font-black text-proton-muted uppercase tracking-[0.2em] block mb-2 opacity-60">{t.status_label}</span>
                  <div className="flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
                     <span className="text-xs text-emerald-500 font-black uppercase tracking-widest">{t.optimal}</span>
                  </div>
               </div>
            </div>
         </section>
      </div>
    </div>
  );
}

