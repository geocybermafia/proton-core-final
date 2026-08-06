import React, { useState } from 'react';
import { UserProfile } from '../types';
import { User as UserIcon, Camera, Mail, Globe, Bell, Shield, Wallet, Save, RefreshCw, Layers, Settings, Palette, Sun, Moon, Zap, Sparkles, Circle, Trees, Sunrise, Heart, CreditCard, Star, ExternalLink, ZapOff, Gift, TrendingUp, ShoppingBag, CheckCircle, Package, Clock, ArrowUpRight, ShieldCheck, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSeller } from '../contexts/SellerContext';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import AvatarEditorModal from './AvatarEditorModal';

interface CabinetViewProps {
  profile: UserProfile | null;
  onUpdateProfile?: (updates: Partial<UserProfile>) => void;
}

export default function CabinetView({ profile, onUpdateProfile }: CabinetViewProps) {
  const { user } = useAuth();
  const { sellerListings, sellerOrders, loading, updateOrderStatus } = useSeller();
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  if (!profile) return null;
  const rawLang = profile.language?.toLowerCase() || 'ka';
  const lang = (rawLang === 'ka' || rawLang === 'georgian') ? 'ka' : 'en';
  
  // Safe translation access
  const t = translations[lang as keyof typeof translations]?.cabinet || translations.en.cabinet;

  const handleUpdate = async (field: string, value: any) => {
    if (onUpdateProfile) {
      onUpdateProfile({ [field]: value });
    }
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(docRef, { [field]: value });
    } catch (e) {
      console.error("Update failed", e);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!user) return;
    const targetOrder = sellerOrders.find(o => o.id === orderId);
    if (!targetOrder || targetOrder.sellerId !== user.uid) {
      console.error("Only the seller is authorized to update order status.");
      return;
    }
    try {
      if (updateOrderStatus) {
        await updateOrderStatus(orderId, newStatus);
      }
    } catch (e) {
      console.error("Order update failed", e);
    }
  };

  const totalRevenue = sellerOrders.reduce((sum, order) => sum + (Number(order.amount || (order as any).price) || 0), 0);
  
  const isUrl = (str: string) => str.startsWith('http') || str.startsWith('data:image');

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Sign in failed:", err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20 max-w-7xl mx-auto">
      {/* UNAUTHENTICATED CTA CARD */}
      {!user && (
        <section className="bg-gradient-to-r from-proton-card via-proton-card to-proton-accent/10 border border-proton-accent/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 bg-proton-accent/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5 text-center sm:text-left">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-proton-accent/10 border border-proton-accent/30 flex items-center justify-center text-proton-accent shrink-0 shadow-inner">
                <LogIn size={28} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-proton-text">
                    {lang === 'ka' ? 'ავტორიზაცია აუცილებელია' : 'Sign In Required'}
                  </h3>
                  <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-md">
                    GUEST NODE
                  </span>
                </div>
                <p className="text-xs text-proton-muted font-medium max-w-xl leading-relaxed">
                  {lang === 'ka' 
                    ? 'გაიარეთ ავტორიზაცია Google-ის ანგარიშით, რათა მიიღოთ სრული წვდომა გამყიდველის პანელზე, შეინახოთ პარამეტრები და მართოთ შეკვეთები.'
                    : 'Sign in with your Google account to access your full seller dashboard, save system preferences, and manage listings across sessions.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="px-6 py-3.5 bg-gradient-to-r from-proton-accent via-blue-500 to-indigo-600 hover:brightness-110 text-proton-bg font-black uppercase text-xs tracking-widest rounded-xl shadow-lg shadow-proton-accent/20 flex items-center gap-2.5 shrink-0 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              <LogIn size={16} />
              <span>{lang === 'ka' ? 'Google-ით შესვლა' : 'Sign In with Google'}</span>
            </button>
          </div>
        </section>
      )}

      {/* 1. COMPACT HEADER */}
      <section className="relative overflow-hidden group">
         <div className="absolute inset-0 bg-proton-card border border-proton-border rounded-2xl shadow-xl transition-all duration-500 group-hover:border-proton-accent/30" />
         
         <div className="relative p-6 px-10 flex flex-col md:flex-row gap-8 items-center">
            <div className="relative shrink-0">
               <button 
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-br from-proton-accent via-blue-500 to-indigo-600 p-[2px] shadow-2xl relative group/avatar cursor-pointer hover:scale-[1.03] transition-all overflow-hidden"
                  title={t.update_avatar}
               >
                  <div className="w-full h-full bg-proton-bg rounded-[22px] flex items-center justify-center overflow-hidden relative">
                     {profile.avatar && isUrl(profile.avatar) ? (
                        <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover group-hover/avatar:scale-105 transition-all" referrerPolicy="no-referrer" />
                     ) : (
                        <span className="text-4xl font-black text-proton-accent uppercase group-hover/avatar:scale-110 transition-all">{profile.name.charAt(0)}</span>
                     )}
                     
                     {/* Hover Overlay */}
                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center text-proton-accent gap-1">
                        <Camera size={20} className="animate-bounce" />
                        <span className="text-[8px] font-black uppercase tracking-widest">{t.update_avatar}</span>
                     </div>
                  </div>
               </button>
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

      {/* CONNECTED AUTH PROVIDER SECTION */}
      {user && (
        <section className="bg-proton-card border border-proton-border rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-proton-accent/10 border border-proton-accent/20 flex items-center justify-center text-proton-accent shrink-0 shadow-inner">
                {user.providerData?.some(p => p.providerId === 'google.com') ? (
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                ) : (
                  <Mail size={22} className="text-proton-accent" />
                )}
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2.5">
                  <span className="text-xs font-black uppercase tracking-widest text-proton-text">
                    {user.providerData?.some(p => p.providerId === 'google.com')
                      ? (lang === 'ka' ? 'Google ავტორიზაცია' : 'Google Auth Provider')
                      : (lang === 'ka' ? 'ელ-ფოსტის ავტორიზაცია' : 'Email/Password Auth')}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded-md flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {lang === 'ka' ? 'დაკავშირებულია' : 'Connected'}
                  </span>
                </div>
                <p className="text-xs text-proton-muted font-mono font-medium truncate max-w-md">
                  {user.email || profile.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-proton-bg/40 border border-proton-border rounded-xl shrink-0">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="text-[10px] font-black uppercase text-proton-muted tracking-widest">
                {lang === 'ka' ? 'ავტორიზებული სესია' : 'Verified Session'}
              </span>
            </div>
          </div>
        </section>
      )}

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

        <div className="relative z-10">
          {/* Recent Orders Table */}
          <div className="bg-proton-bg/20 border border-proton-border rounded-2xl overflow-hidden">
            <div className="p-6 pb-2 border-b border-proton-border flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase text-proton-text tracking-widest">{(t as any).recent_orders}</h4>
              <Package size={14} className="text-proton-muted" />
            </div>
            <div className="overflow-x-auto custom-scrollbar-minimal touch-pan-x">
              <table className="w-full text-left text-xs min-w-[420px]">
                <thead>
                  <tr className="border-b border-proton-border uppercase text-[10px] font-black text-proton-muted tracking-widest">
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-proton-border/50">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8">
                        <div className="flex items-center justify-center gap-2 text-proton-muted font-bold text-xs uppercase tracking-widest animate-pulse">
                          <RefreshCw size={14} className="animate-spin text-proton-accent" />
                          <span>{(t as any).loading || 'Syncing orders...'}</span>
                        </div>
                      </td>
                    </tr>
                  ) : sellerOrders.length === 0 ? (
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
                            <div className="w-8 h-8 rounded-lg bg-proton-accent/10 overflow-hidden border border-proton-border flex items-center justify-center">
                              {(order as any).image ? (
                                <img src={(order as any).image} className="w-full h-full object-cover" />
                              ) : (
                                <Package size={14} className="text-proton-muted" />
                              )}
                            </div>
                            <div>
                              <p className="font-black text-proton-text truncate max-w-[180px] sm:max-w-xs md:max-w-none">{order.itemTitle || (order as any).title || 'Order Item'}</p>
                              <p className="text-[9px] font-bold text-proton-muted uppercase tracking-tight">${order.amount ?? (order as any).price ?? 0}</p>
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

      {/* NETWORK DIAGNOSTIC */}
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

      <AvatarEditorModal
         isOpen={isAvatarModalOpen}
         onClose={() => setIsAvatarModalOpen(false)}
         currentAvatar={profile?.avatar || undefined}
         userName={profile?.name || 'User'}
         lang={lang}
         onSave={(newAvatarBase64) => handleUpdate('avatar', newAvatarBase64)}
      />
    </div>
  );
}

