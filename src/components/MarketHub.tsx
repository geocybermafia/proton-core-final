import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  Zap,
  Truck,
  CheckCircle2,
  Package,
  Inbox,
  Clock,
  MessageSquare,
  ExternalLink,
  Store,
  Trophy,
  BarChart3,
  AlertTriangle
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
  limit,
  startAfter,
  runTransaction,
  deleteField
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import { Listing, Order, ShippingDetails, TrackingInfo, SellerOrderFilter, SupportedCurrency, resolvePreferredCurrency, ListingAnalyticsStats, SellerAnalyticsOverview } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useMarketHub } from '../contexts/MarketHubContext';
import { useMarketChatUnread } from '../contexts/MarketChatUnreadContext';
import { isRealListing } from './market-hub/MarketConstants';
import { useSeller } from '../contexts/SellerContext';
import { useToast } from './Toast';
import { markMarketConversationReadCall } from '../services/cloudFunctionsService';
import { LegalView } from './LegalView';
import { generateTechSpec } from '../services/geminiService';
import { ListingMap } from './ListingMap';
import { MapPicker } from './MapPicker';
import { uploadProductImage, deleteListingImagesFromStorage, validateListingImageUrl } from '../lib/storageUtils';
import { translations } from '../translations';
import { useFocusTrap } from '../hooks/useFocusTrap';
import 'leaflet/dist/leaflet.css';

interface MarketHubProps {
  language: 'en' | 'ka';
  preferredCurrency?: SupportedCurrency;
  onCurrencyChange?: (currency: SupportedCurrency) => void;
  t?: any;
  themeId?: string;
  onBack?: () => void;
  onOpenAuthModal?: () => void;
  onMobileOverlayChange?: (isOpen: boolean) => void;
  isAdmin?: boolean;
}

import {
  MarketTheme,
  WORLD_COUNTRIES,
  CURRENCIES,
  EXCHANGE_RATES,
  OperationType,
  handleFirestoreError,
  CATEGORY_EMOJIS,
  convertPrice,
  normalizeListingPriceValue,
  roundPriceForDisplayCurrency,
  parsePriceFilterInput,
  safeParseDate,
  isPhysicalListing,
  isServiceListing,
  isProjectListing,
  isPhysicalOrder,
  isProjectAssetOrder,
  isServiceOrder,
  isSellerActionRequired,
  canCancelOrder,
  getListingTitle,
  getCategoriesForListingType,
  getGroupedCategoriesForListingType,
  getListingDirectionsMeta,
  getCategoryLabel,
  getDefaultCategoryForType,
  inferListingType,
  isCategoryValidForType,
  resolvePreservedListingStatus
} from './market-hub/MarketConstants';
import {
  buildVerifiedOrderPayload,
  completeDigitalAssetOrderInTransaction,
  MarketOrderRuleError,
  shouldUnlockListingOnOrderCancel,
  validateListingForOrderCreation
} from '../lib/marketOrderRules';
import {
  cleanChatId,
  extractBuyerIdFromConversationId,
  extractNavigationLookupHints,
  MarketChatThreadLookupItem,
  MarketNavigationTarget,
  resolveMarketChatNavigation,
  validateActiveChatContext,
} from '../lib/marketChatNavigation';
import {
  createConversationReadController,
  formatUnreadBadgeCount,
  mergeConversationThreadsWithLegacy,
} from '../lib/marketChatUnread';

import { FastInput, FastTextarea } from './market-hub/FastInputs';
import { CartDrawer } from './market-hub/CartDrawer';
import { CheckoutModal } from './market-hub/CheckoutModal';
import { ListingDetailsModal } from './market-hub/ListingDetailsModal';
import { CancelOrderModal } from './market-hub/CancelOrderModal';
import { MarketChatDrawer } from './market-hub/MarketChatDrawer';
import { ChatThreadList, ChatThreadSummary } from './market-hub/chat/ChatThreadList';
import { ChatThreadHeader } from './market-hub/chat/ChatThreadHeader';
import { ChatMessageList } from './market-hub/chat/ChatMessageList';
import { ChatComposer } from './market-hub/chat/ChatComposer';
import { VendorReviewsModal } from './market-hub/VendorReviewsModal';
import { CreateListingWizard } from './market-hub/CreateListingWizard';
import {
  ListingFormData,
  clearUnifiedListingDraft,
  createDefaultListingFormData,
} from '../lib/listingDrafts';
import {
  MAX_LISTING_PHOTOS,
  MAX_LISTING_PHOTO_BYTES,
  ListingPhotoUploadTask,
  appendUploadedPhotoUrl,
  getAvailablePhotoSlots,
  normalizePhotoUrlList,
  removePhotoAtIndex,
  reorderPhotosByIndex,
  resolveListingPrimaryAndGalleryImages,
  setPrimaryPhotoAtIndex,
  validateExternalPhotoUrl,
} from '../lib/listingPhotos';
import {
  getCategoryFormSchema,
  getDefaultIsRemoteForSchema,
  filterAttributesForSchema,
  sanitizeListingAttributes,
  validateSchemaAttributes
} from './market-hub/ListingSchemas';
import { MarketFilterPanel, MobileFilterBottomSheet } from './market-hub/MarketFilters';
import { ListingTypeTabs } from './market-hub/MarketPulseMetrics';
import { MarketListingCard } from './market-hub/MarketListingCard';
import { BuyerOrders } from './market-hub/BuyerOrders';
import { OrderDetailsModal } from './market-hub/OrderDetailsModal';
import { SellerAnalyticsPanel } from './market-hub/SellerAnalyticsPanel';
import { MarketRankingsView } from './market-hub/MarketRankingsView';
import { fetchSellerAnalyticsOverview, setCompetitionOptOutPreference } from '../utils/marketAnalyticsClient';
import { formatPublishListingErrorMessage, generateClientListingId } from '../lib/marketListingApi';

const AVAILABLE_COUNTRY_OPTIONS = WORLD_COUNTRIES.filter(c => c.code !== 'GLOBAL');

export interface ActiveChatContext {
  conversationId: string;
  listing: Listing;
  buyerId: string;
  sellerId: string;
  buyerName?: string;
  sellerName?: string;
  orderId?: string | null;
}

export const MarketHub = React.memo(function MarketHub({ language, preferredCurrency, onCurrencyChange, t: propT, themeId: propThemeId, onBack, onOpenAuthModal, onMobileOverlayChange, isAdmin: propIsAdmin }: MarketHubProps) {
  const t = propT || translations[language];
  const themeId = propThemeId || 'proton';
  const { user, loading: authLoading } = useAuth();
  const {
    conversations: serverConversations,
    conversationsById: serverConversationsById,
    unreadByConversationId,
    totalUnreadCount,
  } = useMarketChatUnread();
  const globalUnreadBadgeLabel = useMemo(
    () => formatUnreadBadgeCount(totalUnreadCount),
    [totalUnreadCount]
  );
  const { showToast } = useToast();
  const [hasAdminClaim, setHasAdminClaim] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasAdminClaim(false);
      return;
    }
    user.getIdTokenResult().then((tokenResult) => {
      const claims = tokenResult.claims;
      setHasAdminClaim(claims.admin === true || claims.role === 'admin');
    }).catch(() => {
      setHasAdminClaim(false);
    });
  }, [user]);

  const isAdminUser = Boolean(propIsAdmin || hasAdminClaim);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef<boolean>(false);

  const cancelAndResetAiSpec = useCallback((notifyUser = true) => {
    const wasGenerating = isGeneratingRef.current;
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setIsAiGenerating(false);
    isGeneratingRef.current = false;

    if (wasGenerating && notifyUser) {
      showToast(
        language === 'ka' 
          ? 'AI ტექნიკური სპეციფიკაციის გენერირება გაუქმდა' 
          : 'AI spec generation was canceled',
        'info',
        4000
      );
    }
  }, [language, showToast]);

  useEffect(() => {
    return () => {
      if (aiAbortControllerRef.current) {
        aiAbortControllerRef.current.abort();
        aiAbortControllerRef.current = null;
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
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>(() => resolvePreferredCurrency(preferredCurrency));
  const prevDisplayCurrencyRef = useRef<SupportedCurrency>(displayCurrency);
  useEffect(() => {
    setDisplayCurrency(resolvePreferredCurrency(preferredCurrency));
  }, [preferredCurrency]);
  useEffect(() => {
    const prevCurrency = prevDisplayCurrencyRef.current;
    if (prevCurrency !== displayCurrency) {
      prevDisplayCurrencyRef.current = displayCurrency;
      setMinPrice((current) => {
        const parsed = parsePriceFilterInput(current);
        if (parsed === null) return '';
        const converted = convertPrice(parsed, prevCurrency, displayCurrency);
        return String(roundPriceForDisplayCurrency(converted, displayCurrency));
      });
      setMaxPrice((current) => {
        const parsed = parsePriceFilterInput(current);
        if (parsed === null) return '';
        const converted = convertPrice(parsed, prevCurrency, displayCurrency);
        return String(roundPriceForDisplayCurrency(converted, displayCurrency));
      });
    }
  }, [displayCurrency]);
  const [activeListingType, setActiveListingType] = useState<'all' | 'product' | 'service' | 'project'>('all');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [allUserMessages, setAllUserMessages] = useState<any[]>([]);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setAllUserMessages([]);
      return;
    }

    // Legacy message list subscription is only needed while Messages view is active;
    // global unread counts come from MarketChatUnreadContext (`market_conversations`).
    if (activeBottomTab !== 'messages') {
      return;
    }

    let isCurrent = true;
    const q = query(
      collection(db, 'market_messages'),
      where('participants', 'array-contains', uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isCurrent) return;
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllUserMessages(msgs);
    }, (err) => {
      console.error("Error reading all market messages:", err);
    });
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [user?.uid, activeBottomTab]);

  const groupedChats = useMemo(() => {
    if (!user) return [];
    const uid = user.uid;
    const groups: Record<string, {
      conversationId: string;
      listingId: string;
      listingTitle: string;
      sellerId: string;
      sellerName: string;
      buyerId: string;
      buyerName: string;
      orderId?: string | null;
      lastMessage: string;
      lastTime: any;
      lastTimeMillis: number;
      messages: any[];
    }> = {};

    for (let i = 0; i < allUserMessages.length; i++) {
      const msg = allUserMessages[i];
      if (msg.participants && Array.isArray(msg.participants) && !msg.participants.includes(uid)) continue;
      const lid = msg.listingId;
      if (!lid) continue;

      let sellerId = msg.sellerId || '';
      let buyerId = msg.buyerId || '';

      if (!sellerId) {
        const found = listings.find(l => l.id === lid);
        if (found) sellerId = found.sellerId;
      }

      if (!buyerId) {
        if (msg.conversationId && typeof msg.conversationId === 'string') {
          buyerId = extractBuyerIdFromConversationId(msg.conversationId, lid);
        }
        if (!buyerId && sellerId && msg.participants && Array.isArray(msg.participants)) {
          buyerId = msg.participants.find((p: string) => p !== sellerId) || '';
        } else if (!buyerId && msg.senderId && sellerId) {
          buyerId = msg.senderId !== sellerId ? msg.senderId : (msg.receiverId || '');
        }
      }

      if (!buyerId) {
        buyerId = msg.senderId === uid ? (msg.receiverId || '') : (msg.senderId || '');
      }

      const convId = msg.conversationId || (lid && buyerId ? `${lid}_${buyerId}` : lid);
      if (!convId) continue;

      if (!groups[convId]) {
        groups[convId] = {
          conversationId: convId,
          listingId: lid,
          listingTitle: msg.listingTitle || 'Marketplace Item',
          sellerId: sellerId,
          sellerName: msg.sellerName || '',
          buyerId: buyerId,
          buyerName: msg.buyerName || '',
          orderId: msg.orderId || null,
          lastMessage: '',
          lastTime: null,
          lastTimeMillis: 0,
          messages: []
        };
      }

      if (msg.senderId === buyerId && msg.senderName && !groups[convId].buyerName) {
        groups[convId].buyerName = msg.senderName;
      }
      if (msg.senderId === sellerId && msg.senderName && !groups[convId].sellerName) {
        groups[convId].sellerName = msg.senderName;
      }

      if (msg.orderId && !groups[convId].orderId) {
        groups[convId].orderId = msg.orderId;
      }
      const msgTime = safeParseDate(msg.createdAt);
      groups[convId].messages.push({ ...msg, _time: msgTime, conversationId: convId });
    }

    return Object.values(groups).map(g => {
      g.messages.sort((a, b) => a._time - b._time);
      const last = g.messages[g.messages.length - 1];
      g.lastMessage = last ? last.text : '';
      g.lastTime = last ? last.createdAt : null;
      g.lastTimeMillis = last ? last._time : 0;
      const latestOrderMsg = g.messages.slice().reverse().find(m => m.orderId);
      if (latestOrderMsg?.orderId) {
        g.orderId = latestOrderMsg.orderId;
      }
      const relListing = listings.find(l => l.id === g.listingId);
      if (relListing) {
        g.listingTitle = relListing.title;
        if (!g.sellerName) g.sellerName = relListing.sellerName;
        if (!g.sellerId) g.sellerId = relListing.sellerId;
      }
      if (!g.buyerName) {
        const buyerMsg = g.messages.find(m => m.senderId === g.buyerId && m.senderName);
        if (buyerMsg) g.buyerName = buyerMsg.senderName;
      }
      return g;
    }).sort((a, b) => b.lastTimeMillis - a.lastTimeMillis);
  }, [allUserMessages, user?.uid, listings]);

  const desktopChatThreads = useMemo<ChatThreadSummary[]>(() => {
    return mergeConversationThreadsWithLegacy({
      serverConversations,
      legacyThreads: groupedChats,
      listings,
      currentUserId: user?.uid,
    });
  }, [serverConversations, groupedChats, listings, user?.uid]);

  const navigationLookupChats = useMemo<MarketChatThreadLookupItem[]>(() => {
    const byId = new Map<string, MarketChatThreadLookupItem>();
    for (const chat of groupedChats) {
      if (chat?.conversationId) {
        byId.set(chat.conversationId, chat);
      }
    }
    for (const conv of serverConversations) {
      if (conv?.conversationId && !byId.has(conv.conversationId)) {
        byId.set(conv.conversationId, {
          conversationId: conv.conversationId,
          listingId: conv.listingId,
          listingTitle: conv.listingTitle,
          sellerId: conv.sellerId,
          sellerName: conv.sellerName,
          buyerId: conv.buyerId,
          buyerName: conv.buyerName,
          orderId: conv.orderId ?? null,
        });
      }
    }
    return Array.from(byId.values());
  }, [groupedChats, serverConversations]);

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'browse' | 'my-listings' | 'rankings' | 'create' | 'edit' | 'privacy' | 'terms'>('browse');

  useEffect(() => {
    if (viewMode !== 'create' && viewMode !== 'edit') {
      if (isGeneratingRef.current || aiAbortControllerRef.current) {
        cancelAndResetAiSpec(true);
      }
    }
  }, [viewMode, cancelAndResetAiSpec]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const handleOpenListingFromRankings = useCallback(async (listingId: string) => {
    const localMatch = listings.find((l) => l.id === listingId);
    if (localMatch) {
      setSelectedListing(localMatch);
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'listings', listingId));
      if (snap.exists()) {
        setSelectedListing({ id: snap.id, ...snap.data() } as Listing);
      }
    } catch {
      // Ignore fetch failure cleanly
    }
  }, [listings]);

  // Deep-linking: Initial load check for ?listingId=<id>
  const initialListingIdProcessedRef = useRef(false);
  useEffect(() => {
    if (initialListingIdProcessedRef.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlListingId = params.get('listingId');
      if (urlListingId) {
        initialListingIdProcessedRef.current = true;
        handleOpenListingFromRankings(urlListingId);
      }
    } catch {}
  }, [handleOpenListingFromRankings]);

  // Deep-linking: Update URL when selectedListing changes
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (selectedListing) {
        url.searchParams.set('listingId', selectedListing.id);
      } else {
        url.searchParams.delete('listingId');
      }
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.error(e);
    }
  }, [selectedListing]);

  // Deep-linking: Handle browser back/forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlListingId = params.get('listingId');
        if (urlListingId) {
          if (!selectedListing || selectedListing.id !== urlListingId) {
            handleOpenListingFromRankings(urlListingId);
          }
        } else {
          if (selectedListing) {
            setSelectedListing(null);
          }
        }
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedListing, handleOpenListingFromRankings]);

  const [checkoutItem, setCheckoutItem] = useState<Listing | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [displayMode, setDisplayMode] = useState<'grid' | 'map'>('grid');
  const [buyerInstructions, setBuyerInstructions] = useState('');
  const [shippingDetails, setShippingDetails] = useState<ShippingDetails>({
    recipientName: '',
    phone: '',
    city: '',
    address: '',
    notes: ''
  });
  const [shipmentTrackingInput, setShipmentTrackingInput] = useState<{ orderId: string; carrier: string; trackingNumber: string } | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [sellerSelectedOrder, setSellerSelectedOrder] = useState<Order | null>(null);
  const [buyerSelectedOrder, setBuyerSelectedOrder] = useState<Order | null>(null);
  const [activeChatOrder, setActiveChatOrder] = useState<Order | null>(null);
  const [activeSellingTab, setActiveSellingTab] = useState<'listings' | 'incoming-orders' | 'statistics'>('listings');
  const [sellerAnalyticsOverview, setSellerAnalyticsOverview] = useState<SellerAnalyticsOverview | null>(null);
  const [sellerAnalyticsLoading, setSellerAnalyticsLoading] = useState(false);
  const [sellerAnalyticsUnavailableReason, setSellerAnalyticsUnavailableReason] = useState<string | undefined>(undefined);
  const [publishSuccessModal, setPublishSuccessModal] = useState<{
    title: string;
    isEdit: boolean;
  } | null>(null);

  useEffect(() => {
    if (user?.displayName && !shippingDetails.recipientName) {
      setShippingDetails(prev => ({
        ...prev,
        recipientName: user.displayName || ''
      }));
    }
  }, [user?.displayName, shippingDetails.recipientName]);
  
  // Catalog Pagination & Scalable Discovery State
  const PAGE_SIZE = 24;
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearchingBackend, setIsSearchingBackend] = useState(false);
  const [searchVisibleLimit, setSearchVisibleLimit] = useState(PAGE_SIZE);
  const lastVisibleDocRef = useRef<any>(null);
  const appendedListingsRef = useRef<Listing[]>([]);
  const page1DocsRef = useRef<Listing[]>([]);
  const currentUseOrderByRef = useRef<boolean>(true);

  // Search & Filter state detection
  const parsedMinPrice = useMemo(() => parsePriceFilterInput(minPrice), [minPrice]);
  const parsedMaxPrice = useMemo(() => parsePriceFilterInput(maxPrice), [maxPrice]);
  const hasActivePriceFilter = parsedMinPrice !== null || parsedMaxPrice !== null;
  const isSearchActive = search.trim().length > 0;
  const hasActiveFilters = activeCategory !== 'all' || activeCountry !== 'GLOBAL' || activeCity.trim().length > 0 || activeListingType !== 'all' || hasActivePriceFilter || showOnlyFavorites;
  const isFilteredMode = isSearchActive || hasActiveFilters;

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
  const [cartServiceInstructions, setCartServiceInstructions] = useState<Record<string, string>>({});

  // Focus traps for accessible modal & drawer management
  const cartDrawerRef = useFocusTrap<HTMLDivElement>({
    isOpen: isCartOpen,
    onClose: () => !isPlacingCartOrders && setIsCartOpen(false),
  });

  const singleCheckoutModalRef = useFocusTrap<HTMLDivElement>({
    isOpen: !!checkoutItem,
    onClose: () => !isCheckingOut && setCheckoutItem(null),
  });

  const filtersDrawerRef = useFocusTrap<HTMLDivElement>({
    isOpen: isFiltersOpen,
    onClose: () => setIsFiltersOpen(false),
  });

  // Cross-tab synchronization for Cart State
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('proton_market_cart_channel');
        channel.onmessage = (event) => {
          if (event.data && Array.isArray(event.data.cart)) {
            setCart(event.data.cart);
          }
        };
      }
    } catch (err) {
      console.warn("BroadcastChannel not supported in environment:", err);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'proton_market_cart') {
        try {
          const updated = e.newValue ? JSON.parse(e.newValue) : [];
          if (Array.isArray(updated)) {
            setCart(updated);
          }
        } catch (parseErr) {
          console.error("Failed to parse synced cart:", parseErr);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        channel.close();
      }
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('proton_market_cart', JSON.stringify(cart));
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('proton_market_cart_channel');
        channel.postMessage({ cart });
        channel.close();
      }
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

  const handleAddToCart = (listing: Listing) => {
    if (!user) {
      showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია კალათაში დასამატებლად." : "Please sign in to add items to your cart.", 'warning');
      onOpenAuthModal?.();
      return;
    }

    const validation = validateListingForOrderCreation(listing, user.uid);
    if (!validation.ok) {
      showToast(
        language === 'ka' ? validation.messageKa : validation.messageEn,
        validation.code === 'SELF_PURCHASE' ? 'warning' : 'error',
        6000
      );
      return;
    }

    setCart((prev) => {
      const exists = prev.some((item) => item.id === listing.id);
      if (exists) {
        showToast(language === 'ka' ? "ეს ნივთი უკვე დამატებულია კალათაში!" : "This item is already in your cart!", 'info');
        return prev;
      }
      showToast(
        language === 'ka' 
          ? `"${getListingTitle(listing, language)}" დაემატა კალათაში.` 
          : `"${getListingTitle(listing, language)}" added to cart.`, 
        'success'
      );
      return [...prev, listing];
    });
  };

  const handleRemoveFromCart = (listingId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== listingId));
    setCartServiceInstructions((prev) => {
      const next = { ...prev };
      delete next[listingId];
      return next;
    });
  };

  const handleCartCheckout = async () => {
    if (!user) {
      showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია შესყიდვისთვის." : "Please sign in to make a purchase.", 'warning');
      onOpenAuthModal?.();
      return;
    }
    if (cart.length === 0) return;

    const uniqueCart: Listing[] = [];
    const seenIds = new Set<string>();
    for (const item of cart) {
      if (item?.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        uniqueCart.push(item);
      }
    }
    if (uniqueCart.length === 0) return;

    setIsPlacingCartOrders(true);
    try {
      // Atomic Firestore transaction covering all cart items in a single commit
      await runTransaction(db, async (transaction) => {
        // 1. First read all listing docs concurrently
        const listingSnapshots = await Promise.all(
          uniqueCart.map((item) => transaction.get(doc(db, 'listings', item.id)))
        );

        // 2. Validate every item against canonical order rules before any writes
        const invalidItems: {
          id: string;
          title: string;
          reason: string;
          messageEn: string;
          messageKa: string;
        }[] = [];
        const verifiedOrders: {
          listingRef: any;
          orderData: Record<string, any>;
          validation: Extract<ReturnType<typeof validateListingForOrderCreation>, { ok: true }>;
        }[] = [];

        let requiresAnyShipping = false;

        for (let i = 0; i < uniqueCart.length; i++) {
          const item = uniqueCart[i];
          const docSnap = listingSnapshots[i];
          if (!docSnap.exists()) {
            const title = getListingTitle(item, language);
            invalidItems.push({
              id: item.id,
              title,
              reason: 'LISTING_NOT_FOUND',
              messageEn: `Item "${title}" no longer exists and was removed from your cart.`,
              messageKa: `განცხადება "${title}" ბაზაში აღარ არსებობს და ამოიშალა კალათიდან.`
            });
            continue;
          }

          const freshData = docSnap.data();
          const title = getListingTitle(freshData || item, language);
          const freshValidation = validateListingForOrderCreation(freshData, user.uid);
          if (!freshValidation.ok) {
            invalidItems.push({
              id: item.id,
              title,
              reason: freshValidation.code,
              messageEn: `${title}: ${freshValidation.messageEn}`,
              messageKa: `${title}: ${freshValidation.messageKa}`
            });
            continue;
          }

          if (freshValidation.requiresShipping) {
            requiresAnyShipping = true;
          }

          const orderData = buildVerifiedOrderPayload({
            listingId: item.id,
            freshListing: freshData,
            buyerId: user.uid,
            itemTitle: title,
            validation: freshValidation,
            buyerInstructions: !freshValidation.requiresShipping
              ? (cartServiceInstructions[item.id]?.trim() || '')
              : '',
            shippingDetails: freshValidation.requiresShipping ? shippingDetails : null,
            fallbackBuyerName: user.displayName,
            createdAt: serverTimestamp()
          });

          verifiedOrders.push({
            listingRef: doc(db, 'listings', item.id),
            orderData,
            validation: freshValidation
          });
        }

        if (invalidItems.length > 0) {
          const err: any = new Error(
            invalidItems.length === 1
              ? (language === 'ka' ? invalidItems[0].messageKa : invalidItems[0].messageEn)
              : `${invalidItems.length} items in your cart are no longer available.`
          );
          err.invalidItems = invalidItems;
          throw err;
        }

        if (requiresAnyShipping) {
          const isShippingComplete = Boolean(
            shippingDetails &&
            shippingDetails.phone.trim().length >= 4 &&
            shippingDetails.city.trim().length >= 2 &&
            shippingDetails.address.trim().length >= 3
          );
          if (!isShippingComplete) {
            throw new Error(
              language === 'ka'
                ? 'ფიზიკური ნივთებისთვის გთხოვთ შეავსოთ ტელეფონი, ქალაქი და მისამართი.'
                : 'Please provide contact phone, city, and delivery address for physical items.'
            );
          }
        }

        // 3. Commit all order creations and atomic listing locks
        for (const { listingRef, orderData, validation } of verifiedOrders) {
          const newOrderRef = doc(collection(db, 'orders'));
          transaction.set(newOrderRef, orderData);

          if (validation.requiresAtomicListingLock) {
            const lockUpdate = validation.buildListingLockUpdate(newOrderRef.id);
            if (lockUpdate) {
              transaction.update(listingRef, lockUpdate);
            }
          }
        }
      });

      setCart([]);
      setCartServiceInstructions({});
      setIsCartOpen(false);
      showToast(
        language === 'ka' 
          ? "შეკვეთა წარმატებით გაფორმდა!" 
          : "Cart checkout completed successfully!", 
        'success'
      );
      setViewMode('my-listings');
      setProfileSubMode('buying');
    } catch (err: any) {
      console.error("Cart checkout error:", err);
      if (err && Array.isArray(err.invalidItems) && err.invalidItems.length > 0) {
        const invalidIds = new Set(err.invalidItems.map((inv: any) => inv.id));
        setCart(prev => prev.filter(item => !invalidIds.has(item.id)));
        setCartServiceInstructions(prev => {
          const next = { ...prev };
          invalidIds.forEach(id => { delete next[id as string]; });
          return next;
        });

        const invalidTitles = err.invalidItems.map((inv: any) => `"${inv.title}"`).join(', ');
        if (err.invalidItems.length === 1) {
          const single = err.invalidItems[0];
          showToast(
            language === 'ka'
              ? `${single.messageKa} ნივთი ამოიშალა კალათიდან.`
              : `${single.messageEn} Item was removed from your cart.`,
            'error',
            7000
          );
        } else {
          showToast(
            language === 'ka'
              ? `ნივთები (${invalidTitles}) მიუწვდომელია და ამოიშალა კალათიდან. შეგიძლიათ განაგრძოთ დარჩენილი ნივთების შეძენა.`
              : `Items (${invalidTitles}) are unavailable and were removed from your cart. You can proceed with your remaining items.`,
            'error',
            7000
          );
        }
      } else if (err && err.message) {
        showToast(err.message, 'error', 6000);
      } else {
        showToast(language === 'ka' ? "შეკვეთისას მოხდა შეცდომა." : "Error processing cart purchase.", 'error');
      }
    } finally {
      setIsPlacingCartOrders(false);
    }
  };

  useEffect(() => {
    let originalTitle = t.market.seo_title || "PROTON — პროფესიონალური ეკოსისტემა";
    let originalMetaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const activeInspectListing = checkoutItem || selectedListing;

    if (activeInspectListing) {
      const activeTitle = getListingTitle(activeInspectListing, language);
      const activeDesc = language === 'ka' ? (activeInspectListing.descriptionGe || activeInspectListing.description) : activeInspectListing.description;
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
  }, [t, language, checkoutItem, selectedListing]);
  const [profileSubMode, setProfileSubMode] = useState<'selling' | 'buying'>('selling');
  const { sellerOrders = [], buyerOrders = [], publishListing } = useSeller();
  const [sellerOrderFilter, setSellerOrderFilter] = useState<SellerOrderFilter>('all');

  // Keep sellerSelectedOrder synced with real-time updates in sellerOrders
  const activeSellerSelectedOrder = useMemo(() => {
    if (!sellerSelectedOrder) return null;
    return sellerOrders.find(o => o.id === sellerSelectedOrder.id) || sellerSelectedOrder;
  }, [sellerSelectedOrder, sellerOrders]);

  // Keep buyerSelectedOrder synced with real-time updates in buyerOrders
  const activeBuyerSelectedOrder = useMemo(() => {
    if (!buyerSelectedOrder) return null;
    return buyerOrders.find(o => o.id === buyerSelectedOrder.id) || buyerSelectedOrder;
  }, [buyerSelectedOrder, buyerOrders]);

  const sellerOrderCounts = useMemo(() => {
    let actionRequired = 0;
    let processing = 0;
    let shipped = 0;
    let completed = 0;

    for (let i = 0; i < sellerOrders.length; i++) {
      const o = sellerOrders[i];
      if (isSellerActionRequired(o)) {
        actionRequired++;
      }
      const isPhysical = isPhysicalOrder(o);
      if ((isPhysical || o.orderType === 'product') && o.status === 'processing') {
        processing++;
      }
      if ((isPhysical || o.orderType === 'product') && o.status === 'shipped') {
        shipped++;
      }
      if (o.status === 'completed') {
        completed++;
      }
    }

    return {
      all: sellerOrders.length,
      actionRequired,
      processing,
      shipped,
      completed
    };
  }, [sellerOrders]);

  const sellerSalesSummary = useMemo(() => {
    let completedCount = 0;
    const revenueByCurrency: Record<string, number> = {};
    let totalRevenueConverted = 0;

    for (let i = 0; i < sellerOrders.length; i++) {
      const o = sellerOrders[i];
      // Only completed orders contribute to revenue.
      // Cancelled, refunded, pending, processing, shipped, booked, and in_progress orders do NOT contribute.
      if (o.status === 'completed') {
        completedCount++;
        const rawAmt = typeof o.amount === 'number' ? o.amount : parseFloat(String(o.amount || 0));
        const amt = !isNaN(rawAmt) && rawAmt > 0 ? rawAmt : 0;
        const cur = (o.currency || displayCurrency || 'USD').toUpperCase();

        if (amt > 0) {
          revenueByCurrency[cur] = (revenueByCurrency[cur] || 0) + amt;
          try {
            totalRevenueConverted += convertPrice(amt, cur, displayCurrency);
          } catch {
            totalRevenueConverted += amt;
          }
        }
      }
    }

    const currencyCodes = Object.keys(revenueByCurrency);
    const activeSymbol = CURRENCIES.find(c => c.code === displayCurrency)?.symbol || displayCurrency;

    let formattedRevenue = `${activeSymbol}0`;
    let revenueBreakdown: string | null = null;

    if (currencyCodes.length === 0) {
      formattedRevenue = `${activeSymbol}0`;
    } else if (currencyCodes.length === 1) {
      const cur = currencyCodes[0];
      const symbol = CURRENCIES.find(c => c.code === cur)?.symbol || cur;
      const amt = revenueByCurrency[cur];
      const formattedAmt = amt % 1 === 0 
        ? amt.toLocaleString() 
        : amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      formattedRevenue = `${symbol}${formattedAmt}`;
    } else {
      // Multi-currency: Converted total in active displayCurrency (Approach B) + Grouped Breakdown (Approach A)
      const formattedAmt = totalRevenueConverted % 1 === 0 
        ? Math.round(totalRevenueConverted).toLocaleString() 
        : totalRevenueConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      formattedRevenue = `~${activeSymbol}${formattedAmt}`;
      revenueBreakdown = currencyCodes
        .map(c => {
          const sym = CURRENCIES.find(curr => curr.code === c)?.symbol || c;
          const a = revenueByCurrency[c];
          return `${sym}${a % 1 === 0 ? a.toLocaleString() : a.toFixed(2)}`;
        })
        .join(' + ');
    }

    return {
      totalOrders: sellerOrders.length,
      completedOrders: completedCount,
      actionRequired: sellerOrderCounts.actionRequired,
      formattedRevenue,
      revenueBreakdown,
      currencyCodes,
    };
  }, [sellerOrders, displayCurrency, sellerOrderCounts.actionRequired]);

  const filteredSellerOrders = useMemo(() => {
    if (sellerOrderFilter === 'all') {
      return sellerOrders;
    }
    return sellerOrders.filter(order => {
      switch (sellerOrderFilter) {
        case 'action-required':
          return isSellerActionRequired(order);
        case 'processing':
          return (isPhysicalOrder(order) || order.orderType === 'product') && order.status === 'processing';
        case 'shipped':
          return (isPhysicalOrder(order) || order.orderType === 'product') && order.status === 'shipped';
        case 'completed':
          return order.status === 'completed';
        default:
          return true;
      }
    });
  }, [sellerOrders, sellerOrderFilter]);
  
  const orders = useMemo(() => {
    const buyerIdSet = new Set(buyerOrders.map(b => b.id));
    const merged = [...buyerOrders];
    for (let i = 0; i < sellerOrders.length; i++) {
      const so = sellerOrders[i];
      if (!buyerIdSet.has(so.id)) {
        merged.push(so);
      }
    }
    const withTimes = merged.map(o => ({
      order: o,
      time: safeParseDate(o.createdAt)
    }));
    withTimes.sort((a, b) => b.time - a.time);
    return withTimes.map(w => w.order);
  }, [buyerOrders, sellerOrders]);

  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStep, setFormStep] = useState<number>(1);
  const [photoUploadTasks, setPhotoUploadTasks] = useState<ListingPhotoUploadTask[]>([]);
  const photoUploadTasksRef = useRef<ListingPhotoUploadTask[]>([]);
  const sessionUploadedUrlsRef = useRef<Set<string>>(new Set());
  const uploadSessionEpochRef = useRef<number>(0);
  const currentUserUidRef = useRef<string | null>(user?.uid ?? null);
  currentUserUidRef.current = user?.uid ?? null;
  const prevAuthUidForWizardRef = useRef<string | null | undefined>(undefined);
  const pendingCreateListingIdRef = useRef<string | null>(null);

  useEffect(() => {
    photoUploadTasksRef.current = photoUploadTasks;
  }, [photoUploadTasks]);

  // Form State
  const [formData, setFormData] = useState<ListingFormData>(() => createDefaultListingFormData(language));

  const resetListingForm = useCallback(() => {
    uploadSessionEpochRef.current += 1;
    pendingCreateListingIdRef.current = null;
    setEditingListing(null);
    setFormStep(1);
    setPhotoUploadTasks([]);
    sessionUploadedUrlsRef.current.clear();
    setFormData(createDefaultListingFormData(language));
  }, [language]);

  // Isolate wizard/edit session completely across same-session logout/login or account switches
  useEffect(() => {
    if (authLoading) return;
    const nextUid = user?.uid ?? null;
    if (prevAuthUidForWizardRef.current === undefined) {
      prevAuthUidForWizardRef.current = nextUid;
      return;
    }
    if (prevAuthUidForWizardRef.current === nextUid) {
      return;
    }
    prevAuthUidForWizardRef.current = nextUid;
    resetListingForm();
    setPublishSuccessModal(null);
    setSelectedListing(null);
    setViewMode(prev => {
      if (prev === 'edit' || prev === 'my-listings') return 'browse';
      if (prev === 'create' && !nextUid) return 'browse';
      return prev;
    });
  }, [authLoading, user?.uid, resetListingForm]);

  // Trust & Reviews States
  const [reviews, setReviews] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<{ id: string, name: string } | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  const vendorModalRef = useFocusTrap<HTMLDivElement>({
    isOpen: !!selectedVendor,
    onClose: () => setSelectedVendor(null),
  });

  useEffect(() => {
    if (authLoading) return;
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
  }, [authLoading]);

  const sellerRatings = useMemo(() => {
    const map: { [sellerId: string]: { avg: number; count: number } } = {};
    const sums: { [sellerId: string]: number } = {};

    for (let i = 0; i < reviews.length; i++) {
      const r = reviews[i];
      const sId = r.sellerId;
      if (!sId) continue;
      const rating = typeof r.rating === 'number' ? r.rating : 5;
      if (!map[sId]) {
        map[sId] = { avg: rating, count: 1 };
        sums[sId] = rating;
      } else {
        map[sId].count += 1;
        sums[sId] += rating;
        map[sId].avg = sums[sId] / map[sId].count;
      }
    }

    return map;
  }, [reviews]);

  const [vendorReviews, setVendorReviews] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedVendor) {
      setVendorReviews([]);
      return;
    }
    const qVendorReviews = query(
      collection(db, 'seller_reviews'),
      where('sellerId', '==', selectedVendor.id),
      limit(50)
    );
    const unsubscribe = onSnapshot(qVendorReviews, (snapshot) => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setVendorReviews(list);
    }, (err) => {
      console.warn("Firestore vendor reviews fallback:", err);
    });
    return () => unsubscribe();
  }, [selectedVendor?.id]);

  const selectedVendorReviews = useMemo(() => {
    if (!selectedVendor) return [];
    if (vendorReviews.length > 0) return vendorReviews;
    return reviews.filter(r => r.sellerId === selectedVendor.id);
  }, [selectedVendor, vendorReviews, reviews]);

  const selectedVendorRatingBreakdown = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (!selectedVendor || selectedVendorReviews.length === 0) {
      return { counts, total: 0 };
    }
    for (let i = 0; i < selectedVendorReviews.length; i++) {
      const rating = Math.min(5, Math.max(1, Math.round(selectedVendorReviews[i].rating || 5)));
      counts[rating] = (counts[rating] || 0) + 1;
    }
    return { counts, total: selectedVendorReviews.length };
  }, [selectedVendor, selectedVendorReviews]);

  const [selectedReviewOrderId, setSelectedReviewOrderId] = useState<string>('');
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<string>>(new Set());
  const [isCheckingEligibility, setIsCheckingEligibility] = useState<boolean>(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [eligibilityRetryCount, setEligibilityRetryCount] = useState<number>(0);

  const eligibleCompletedOrders = useMemo(() => {
    if (!user || !selectedVendor) return [];
    return buyerOrders.filter(o => o.sellerId === selectedVendor.id && o.status === 'completed');
  }, [user, selectedVendor, buyerOrders]);

  const hasPendingOrInTransitOrder = useMemo(() => {
    if (!user || !selectedVendor) return false;
    return buyerOrders.some(o => 
      o.sellerId === selectedVendor.id && 
      ['pending', 'processing', 'shipped', 'booked', 'in_progress'].includes(o.status)
    );
  }, [user, selectedVendor, buyerOrders]);

  // Direct deterministic point-lookup for each eligible completed order (independent of global 20-review limit)
  useEffect(() => {
    let active = true;
    if (!user || !selectedVendor || eligibleCompletedOrders.length === 0) {
      setReviewedOrderIds(new Set());
      setIsCheckingEligibility(false);
      setEligibilityError(null);
      return;
    }

    const verifyReviewStatuses = async () => {
      setIsCheckingEligibility(true);
      setEligibilityError(null);
      try {
        const results = await Promise.all(
          eligibleCompletedOrders.map(async (order) => {
            const docRef = doc(db, 'seller_reviews', `rev_${order.id}`);
            const snap = await getDoc(docRef);
            return { orderId: order.id, exists: snap.exists() };
          })
        );
        if (!active) return;
        const setOfReviewed = new Set<string>();
        for (const res of results) {
          if (res.exists) {
            setOfReviewed.add(res.orderId);
          }
        }
        setReviewedOrderIds(setOfReviewed);
      } catch (err: any) {
        if (!active) return;
        console.warn("[MarketHub] Direct review eligibility lookup failed:", err);
        // Honestly set error state; never treat a failure as unreviewed
        setEligibilityError(err?.message || "Failed to check review status");
      } finally {
        if (active) {
          setIsCheckingEligibility(false);
        }
      }
    };

    verifyReviewStatuses();

    return () => {
      active = false;
    };
  }, [user?.uid, selectedVendor?.id, eligibleCompletedOrders, eligibilityRetryCount]);

  const unreviewedCompletedOrders = useMemo(() => {
    if (!user || !selectedVendor || isCheckingEligibility || eligibilityError) return [];
    return eligibleCompletedOrders.filter(o => !reviewedOrderIds.has(o.id));
  }, [user, selectedVendor, eligibleCompletedOrders, reviewedOrderIds, isCheckingEligibility, eligibilityError]);

  useEffect(() => {
    if (unreviewedCompletedOrders.length > 0) {
      if (!selectedReviewOrderId || !unreviewedCompletedOrders.some(o => o.id === selectedReviewOrderId)) {
        setSelectedReviewOrderId(unreviewedCompletedOrders[0].id);
      }
    } else {
      setSelectedReviewOrderId('');
    }
  }, [unreviewedCompletedOrders, selectedReviewOrderId]);

  const vendorBuyerOrderKeys = useMemo(() => {
    if (!selectedVendor) return new Set<string>();
    return new Set(orders.filter(o => o.sellerId === selectedVendor.id && o.status === 'completed').map(o => o.buyerId));
  }, [orders, selectedVendor]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია შეფასების დასაწერად." : "Please log in to write a review.", 'warning');
      return;
    }
    if (!selectedVendor) return;
    if (user.uid === selectedVendor.id) {
      showToast(language === 'ka' ? "თქვენ არ შეგიძლიათ საკუთარი თავის შეფასება." : "You cannot review yourself.", 'warning');
      return;
    }
    if (reviewRating < 1 || reviewRating > 5) {
      showToast(language === 'ka' ? "გთხოვთ აირჩიოთ რეიტინგი 1-დან 5-მდე." : "Please select a rating between 1 and 5.", 'warning');
      return;
    }
    const cleanText = reviewText.trim();
    if (!cleanText) {
      showToast(language === 'ka' ? "გთხოვთ დაწეროთ შეფასების ტექსტი." : "Please write a review comment.", 'warning');
      return;
    }
    if (cleanText.length > 2000) {
      showToast(language === 'ka' ? "შეფასების ტექსტი არ უნდა აღემატებოდეს 2000 სიმბოლოს." : "Review comment must not exceed 2,000 characters.", 'warning');
      return;
    }

    const targetOrder = eligibleCompletedOrders.find(o => o.id === selectedReviewOrderId) || unreviewedCompletedOrders[0];
    if (!targetOrder) {
      showToast(
        language === 'ka' 
          ? "შეფასების დასაწერად აუცილებელია დასრულებული შეკვეთის არსებობა." 
          : "A completed order with this vendor is required to submit a review.", 
        'warning'
      );
      return;
    }

    setIsSubmittingReview(true);
    try {
      const docId = `rev_${targetOrder.id}`;
      const reviewDocRef = doc(db, 'seller_reviews', docId);

      // Pre-check for duplicate review
      const existingDocSnap = await getDoc(reviewDocRef);
      if (existingDocSnap.exists()) {
        showToast(
          language === 'ka' 
            ? "ამ შეკვეთაზე შეფასება უკვე არსებობს. განმეორებითი შეფასება შეუძლებელია." 
            : "A review already exists for this order. Duplicate reviews are not allowed.", 
          'warning'
        );
        setReviewedOrderIds(prev => new Set([...prev, targetOrder.id]));
        setIsSubmittingReview(false);
        return;
      }
      
      await setDoc(reviewDocRef, {
        orderId: targetOrder.id,
        listingId: targetOrder.listingId || '',
        buyerId: user.uid,
        buyerName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        sellerId: selectedVendor.id,
        rating: reviewRating,
        text: cleanText,
        createdAt: serverTimestamp()
      });
      
      setReviewedOrderIds(prev => new Set([...prev, targetOrder.id]));
      setReviewText('');
      setReviewRating(5);
      showToast(language === 'ka' ? "შეფასება წარმატებით დაემატა!" : "Review added successfully!", 'success');
    } catch (err: any) {
      console.error("Error creating review:", err);
      showToast(
        language === 'ka' 
          ? `შეფასების დამატება ვერ მოხერხდა: ${err?.message || ''}` 
          : `Could not add your review: ${err?.message || ''}`, 
        'error'
      );
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
      showToast(language === 'ka' ? "წაშლა ვერ მოხერხდა." : "Could not delete review.", 'error');
    }
  };

  // Vendor Chat State & Actions
  const [activeChatContext, setActiveChatContext] = useState<ActiveChatContext | null>(null);
  const [activeChatListing, setActiveChatListing] = useState<Listing | null>(null);
  const [chatMessageText, setChatMessageText] = useState('');
  const [messagesList, setMessagesList] = useState<any[]>([]);
  const [chatResolutionError, setChatResolutionError] = useState<string | null>(null);

  const activeChatSendValidation = useMemo(
    () =>
      validateActiveChatContext({
        context: activeChatContext,
        listing: activeChatListing,
        order: activeChatOrder,
        currentUserId: user?.uid,
      }),
    [activeChatContext, activeChatListing, activeChatOrder, user?.uid]
  );
  const isActiveChatSendAllowed = activeChatSendValidation.ok;

  const navSeqRef = useRef(0);
  const pendingNavOrderIdRef = useRef<string | null>(null);
  const pendingNavTargetRef = useRef<{
    target: MarketNavigationTarget;
    fetchedListing: Listing | null;
    fetchedOrder: Order | null;
  } | null>(null);

  const closeInlineMessages = useCallback(() => {
    navSeqRef.current += 1;
    pendingNavTargetRef.current = null;
    setChatResolutionError(null);
    setActiveBottomTab('home');
    setActiveChatListing(null);
    setActiveChatContext(null);
    setActiveChatOrder(null);
  }, []);

  const isInlineMessagesActive = activeBottomTab === 'messages';
  const isDrawerChatOpen = Boolean(activeChatListing) && !isInlineMessagesActive;

  const [documentVisibilityState, setDocumentVisibilityState] = useState<string>(() =>
    typeof document !== 'undefined' ? document.visibilityState : 'visible'
  );
  const [surfaceVisibility, setSurfaceVisibility] = useState<{
    desktop: { lastMessageId: string | null; isLastMessageVisible: boolean };
    mobile: { lastMessageId: string | null; isLastMessageVisible: boolean };
    drawer: { lastMessageId: string | null; isLastMessageVisible: boolean };
  }>({
    desktop: { lastMessageId: null, isLastMessageVisible: false },
    mobile: { lastMessageId: null, isLastMessageVisible: false },
    drawer: { lastMessageId: null, isLastMessageVisible: false },
  });

  const makeSurfaceVisibilityHandler = useCallback(
    (surface: 'desktop' | 'mobile' | 'drawer') =>
      (info: { lastMessageId: string | null; isLastMessageVisible: boolean }) => {
        setSurfaceVisibility((prev) => {
          const cur = prev[surface];
          if (
            cur.lastMessageId === info.lastMessageId &&
            cur.isLastMessageVisible === info.isLastMessageVisible
          ) {
            return prev;
          }
          return { ...prev, [surface]: info };
        });
      },
    []
  );

  const handleDesktopLastMsgVisibility = useMemo(
    () => makeSurfaceVisibilityHandler('desktop'),
    [makeSurfaceVisibilityHandler]
  );
  const handleMobileLastMsgVisibility = useMemo(
    () => makeSurfaceVisibilityHandler('mobile'),
    [makeSurfaceVisibilityHandler]
  );
  const handleDrawerLastMsgVisibility = useMemo(
    () => makeSurfaceVisibilityHandler('drawer'),
    [makeSurfaceVisibilityHandler]
  );

  const readControllerRef = useRef<ReturnType<typeof createConversationReadController> | null>(null);
  if (!readControllerRef.current) {
    readControllerRef.current = createConversationReadController({
      debounceMs: 180,
      markReadFn: markMarketConversationReadCall,
      onError: (err, params) => {
        console.warn(
          `[MarketHub] markMarketConversationRead failed safely for ${params.conversationId}:`,
          err
        );
      },
    });
  }

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      setDocumentVisibilityState(document.visibilityState);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      readControllerRef.current?.dispose();
    };
  }, []);

  // Immediately wipe all user-scoped chat & active thread state on logout or account switch
  useEffect(() => {
    navSeqRef.current += 1;
    pendingNavTargetRef.current = null;
    pendingNavOrderIdRef.current = null;
    setAllUserMessages([]);
    setMessagesList([]);
    setActiveChatContext(null);
    setActiveChatListing(null);
    setActiveChatOrder(null);
    setChatResolutionError(null);
    setSurfaceVisibility({
      desktop: { lastMessageId: null, isLastMessageVisible: false },
      mobile: { lastMessageId: null, isLastMessageVisible: false },
      drawer: { lastMessageId: null, isLastMessageVisible: false },
    });
    readControllerRef.current?.resetForUser(user?.uid ?? null);
  }, [user?.uid]);

  const activeConvUnreadCount = activeChatContext?.conversationId
    ? (unreadByConversationId[activeChatContext.conversationId] ?? 0)
    : 0;
  const hasActiveServerConversation = Boolean(
    activeChatContext?.conversationId && serverConversationsById[activeChatContext.conversationId]
  );
  const isActiveChatVisibleInUi = Boolean(
    activeChatContext && activeChatListing && user?.uid && (isDrawerChatOpen || isInlineMessagesActive)
  );
  const currentLastMessageId =
    messagesList.length > 0 ? (messagesList[messagesList.length - 1]?.id ?? null) : null;
  const isLastMessageVisibleOnActiveSurface = Boolean(
    currentLastMessageId &&
      ((isInlineMessagesActive &&
        ((surfaceVisibility.desktop.isLastMessageVisible &&
          surfaceVisibility.desktop.lastMessageId === currentLastMessageId) ||
          (surfaceVisibility.mobile.isLastMessageVisible &&
            surfaceVisibility.mobile.lastMessageId === currentLastMessageId))) ||
        (isDrawerChatOpen &&
          surfaceVisibility.drawer.isLastMessageVisible &&
          surfaceVisibility.drawer.lastMessageId === currentLastMessageId))
  );

  useEffect(() => {
    readControllerRef.current?.evaluate({
      isActive: isActiveChatVisibleInUi,
      currentUserId: user?.uid,
      buyerId: activeChatContext?.buyerId,
      sellerId: activeChatContext?.sellerId,
      conversationId: activeChatContext?.conversationId,
      documentVisibilityState,
      isLastMessageVisible: isLastMessageVisibleOnActiveSurface,
      lastVisibleMessageId: currentLastMessageId,
      hasServerConversation: hasActiveServerConversation,
      unreadCount: activeConvUnreadCount,
    });
  }, [
    isActiveChatVisibleInUi,
    user?.uid,
    activeChatContext?.conversationId,
    activeChatContext?.buyerId,
    activeChatContext?.sellerId,
    documentVisibilityState,
    isLastMessageVisibleOnActiveSurface,
    currentLastMessageId,
    hasActiveServerConversation,
    activeConvUnreadCount,
  ]);

  const chatModalRef = useFocusTrap<HTMLDivElement>({
    isOpen: isDrawerChatOpen,
    onClose: () => {
      navSeqRef.current += 1;
      pendingNavTargetRef.current = null;
      setChatResolutionError(null);
      setActiveChatListing(null);
      setActiveChatContext(null);
      setActiveChatOrder(null);
    },
  });

  const listingDetailsModalRef = useFocusTrap<HTMLDivElement>({
    isOpen: !!selectedListing && !selectedVendor && !checkoutItem && !isDrawerChatOpen && !isCartOpen,
    onClose: () => setSelectedListing(null),
  });

  // Notify parent App shell when any MarketHub fullscreen overlay/drawer/modal or wizard is open on mobile
  const isAnyMarketOverlayOpen = Boolean(
    viewMode === 'create' ||
    viewMode === 'edit' ||
    activeBottomTab === 'categories' ||
    activeBottomTab === 'messages' ||
    selectedListing ||
    checkoutItem ||
    isCartOpen ||
    isFiltersOpen ||
    selectedVendor ||
    orderToCancel ||
    sellerSelectedOrder ||
    buyerSelectedOrder ||
    publishSuccessModal ||
    isDrawerChatOpen
  );

  useEffect(() => {
    onMobileOverlayChange?.(isAnyMarketOverlayOpen);
    return () => {
      onMobileOverlayChange?.(false);
    };
  }, [isAnyMarketOverlayOpen, onMobileOverlayChange]);

  const mobileMessagesOverlayRef = useRef<HTMLDivElement | null>(null);
  const shouldPinMobileBottomRef = useRef<boolean>(false);
  const [mobileVisualViewport, setMobileVisualViewport] = useState<{ height: number; offsetTop: number } | null>(null);

  useEffect(() => {
    if (activeBottomTab !== 'messages' || typeof window === 'undefined' || !window.visualViewport) {
      setMobileVisualViewport(null);
      return;
    }

    const vv = window.visualViewport;
    const syncViewport = () => {
      if (window.innerWidth >= 768) {
        setMobileVisualViewport(null);
        return;
      }
      const logEl = mobileMessagesOverlayRef.current?.querySelector('[role="log"]') as HTMLElement | null;
      if (logEl) {
        shouldPinMobileBottomRef.current =
          logEl.scrollHeight - logEl.clientHeight - logEl.scrollTop <= 48;
      }
      setMobileVisualViewport({
        height: Math.round(vv.height),
        offsetTop: Math.round(vv.offsetTop),
      });
    };

    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);

    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
    };
  }, [activeBottomTab]);

  useEffect(() => {
    if (!shouldPinMobileBottomRef.current) return;
    const rafId = requestAnimationFrame(() => {
      const logEl = mobileMessagesOverlayRef.current?.querySelector('[role="log"]') as HTMLElement | null;
      if (logEl) {
        logEl.scrollTop = logEl.scrollHeight;
      }
      shouldPinMobileBottomRef.current = false;
    });
    return () => cancelAnimationFrame(rafId);
  }, [mobileVisualViewport]);

  // Browser History & Hardware Back-Button Integration (Modals & Drawers)
  const modalHistoryRef = useRef<string | null>(null);
  const isBackNavigationRef = useRef<boolean>(false);

  // Compute currently active modal in priority order
  const activeModalKey = useMemo(() => {
    if (checkoutItem) return 'checkout';
    if (selectedListing) return 'listing-details';
    if (isCartOpen) return 'cart';
    if (isFiltersOpen) return 'filters';
    if (isDrawerChatOpen) return 'chat';
    return null;
  }, [checkoutItem, selectedListing, isCartOpen, isFiltersOpen, isDrawerChatOpen]);

  // Synchronize modal state with browser history (Push on Open, Back on Close)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (activeModalKey) {
      if (modalHistoryRef.current !== activeModalKey) {
        if (!isBackNavigationRef.current) {
          try {
            window.history.pushState({ protonModal: activeModalKey }, '');
          } catch (e) {
            console.warn('[History] Push modal error:', e);
          }
        }
        modalHistoryRef.current = activeModalKey;
        isBackNavigationRef.current = false;
      }
    } else {
      if (modalHistoryRef.current !== null) {
        if (!isBackNavigationRef.current) {
          try {
            if (window.history.state?.protonModal) {
              window.history.back();
            }
          } catch (e) {
            console.warn('[History] Pop modal error:', e);
          }
        }
        modalHistoryRef.current = null;
        isBackNavigationRef.current = false;
      }
    }
  }, [activeModalKey]);

  // Listen to popstate (Mobile hardware Back button / Browser back navigation)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUnifiedPopState = () => {
      // Sync URL search params if present
      try {
        const params = new URLSearchParams(window.location.search);
        const urlSearch = params.get('search') || '';
        setSearch(prev => (prev !== urlSearch ? urlSearch : prev));
      } catch (e) {
        console.error(e);
      }

      // If any modal is active when popstate occurs, dismiss it without exiting the app
      if (modalHistoryRef.current) {
        isBackNavigationRef.current = true;
        setCheckoutItem(null);
        setSelectedListing(null);
        setIsCartOpen(false);
        setIsFiltersOpen(false);
        setActiveChatListing(null);
        setActiveChatContext(null);
        setActiveChatOrder(null);
        modalHistoryRef.current = null;
      }
    };

    window.addEventListener('popstate', handleUnifiedPopState);
    return () => {
      window.removeEventListener('popstate', handleUnifiedPopState);
    };
  }, []);

  // SELLER NOTIFICATION ROUTING (P1 Support)
  const handleProcessMarketNavigation = useCallback(async (target: MarketNavigationTarget | any) => {
    if (!target) return;
    const { type, orderId, conversationId } = target;

    if (type === 'market_order' || (!type && orderId)) {
      navSeqRef.current += 1;
      pendingNavTargetRef.current = null;
      setChatResolutionError(null);
      setViewMode('my-listings');
      setProfileSubMode('selling');
      setActiveSellingTab('incoming-orders');
      if (orderId) {
        setExpandedOrderId(orderId);
        pendingNavOrderIdRef.current = orderId;
        const matched = sellerOrders.find(o => o.id === orderId);
        if (matched) {
          setSellerSelectedOrder(matched);
          pendingNavOrderIdRef.current = null;
        }
      }
      return;
    }

    if (type === 'market_message' || (!type && conversationId)) {
      const reqSeq = ++navSeqRef.current;
      pendingNavTargetRef.current = null;
      setChatResolutionError(null);
      setViewMode('my-listings');
      setActiveBottomTab('messages');

      if (!user?.uid) {
        const msg = language === 'ka'
          ? 'საუბრის გასახსნელად გთხოვთ გაიაროთ ავტორიზაცია.'
          : 'Please sign in to open this conversation.';
        setActiveChatContext(null);
        setActiveChatListing(null);
        setActiveChatOrder(null);
        setChatResolutionError(msg);
        showToast(msg, 'warning');
        return;
      }

      const combinedOrders = [...sellerOrders, ...buyerOrders];
      const hints = extractNavigationLookupHints({
        target,
        knownListings: listings,
        groupedChats: navigationLookupChats,
        orders: combinedOrders,
      });

      // Resolve authoritative listing from listings state or Firestore (never via split('_')[0])
      let fetchedListing: Listing | null = hints.lookupListingId
        ? listings.find(l => l.id === hints.lookupListingId) || null
        : null;

      if (!fetchedListing && hints.lookupListingId) {
        try {
          const snap = await getDoc(doc(db, 'listings', hints.lookupListingId));
          if (navSeqRef.current !== reqSeq) return;
          if (snap.exists()) {
            fetchedListing = { id: snap.id, ...snap.data() } as Listing;
          }
        } catch (e) {
          // Proceed with deleted-listing / existing-conversation fallback checks below
        }
      }

      // Resolve linked order from Firestore if orderId exists and is not yet in sellerOrders/buyerOrders
      let fetchedOrder: Order | null = hints.matchedOrder;
      if (!fetchedOrder && hints.lookupOrderId) {
        try {
          const orderSnap = await getDoc(doc(db, 'orders', hints.lookupOrderId));
          if (navSeqRef.current !== reqSeq) return;
          if (orderSnap.exists()) {
            fetchedOrder = { id: orderSnap.id, ...orderSnap.data() } as Order;
          }
        } catch (e) {
          // Ignore order fetch permission/missing failure; resolution handles validation safely
        }
      }

      const augmentedOrders =
        fetchedOrder && !combinedOrders.some(o => o.id === fetchedOrder!.id)
          ? [...combinedOrders, fetchedOrder]
          : combinedOrders;

      // If listing was deleted and in-memory navigationLookupChats hasn't loaded yet, query conversation messages safely
      let augmentedChats: MarketChatThreadLookupItem[] = navigationLookupChats;
      if (
        !fetchedListing &&
        !hints.matchedChat &&
        !cleanChatId(target.sellerId) &&
        hints.lookupConversationId
      ) {
        try {
          const msgQ = query(
            collection(db, 'market_messages'),
            where('conversationId', '==', hints.lookupConversationId),
            where('participants', 'array-contains', user.uid),
            limit(5)
          );
          const msgSnap = await getDocs(msgQ);
          if (navSeqRef.current !== reqSeq) return;
          if (!msgSnap.empty) {
            const docs = msgSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
            const sample = docs.find(d => d.sellerId && d.buyerId) || docs[0];
            if (sample) {
              const sellerMsg = docs.find(d => d.senderId === sample.sellerId && d.senderName);
              const buyerMsg = docs.find(d => d.senderId === sample.buyerId && d.senderName);
              const reconstructed: MarketChatThreadLookupItem = {
                conversationId: cleanChatId(sample.conversationId) || hints.lookupConversationId,
                listingId: cleanChatId(sample.listingId) || hints.lookupListingId,
                listingTitle: cleanChatId(sample.listingTitle) || 'Marketplace Item',
                sellerId: cleanChatId(sample.sellerId),
                sellerName: cleanChatId(sample.sellerName) || cleanChatId(sellerMsg?.senderName),
                buyerId: cleanChatId(sample.buyerId),
                buyerName: cleanChatId(sample.buyerName) || cleanChatId(buyerMsg?.senderName),
                orderId: cleanChatId(docs.find(d => d.orderId)?.orderId) || null,
              };
              augmentedChats = [...navigationLookupChats, reconstructed];
            }
          }
        } catch (e) {
          // Ignore fallback query error; strict resolution below will block safely
        }
      }

      const resolution = resolveMarketChatNavigation({
        target,
        currentUserId: user.uid,
        currentUserDisplayName: user.displayName,
        fetchedListing,
        knownListings: listings,
        groupedChats: augmentedChats,
        orders: augmentedOrders,
      });

      if (navSeqRef.current !== reqSeq) return;

      if (resolution.ok) {
        pendingNavTargetRef.current = null;
        setChatResolutionError(null);
        setActiveChatContext({
          conversationId: resolution.conversationId,
          listing: resolution.listing,
          buyerId: resolution.buyerId,
          sellerId: resolution.sellerId,
          buyerName: resolution.buyerName,
          sellerName: resolution.sellerName,
          orderId: resolution.orderId,
        });
        setActiveChatListing(resolution.listing);
        setActiveChatOrder(resolution.matchedOrder);
      } else {
        // NEVER open chat or assign current user as sellerId on failure/conflict
        setActiveChatContext(null);
        setActiveChatListing(null);
        setActiveChatOrder(null);
        const errorText = language === 'ka' ? resolution.messageKa : resolution.messageEn;
        setChatResolutionError(errorText);
        if (resolution.canRetryWhenChatsLoad) {
          pendingNavTargetRef.current = {
            target,
            fetchedListing,
            fetchedOrder,
          };
        } else {
          pendingNavTargetRef.current = null;
        }
        showToast(errorText, 'error');
      }
    }
  }, [sellerOrders, buyerOrders, navigationLookupChats, listings, user, language, showToast]);

  useEffect(() => {
    // Check initial window navigation target if set before MarketHub mounted
    const initialTarget = (window as any).__protonMarketNavTarget;
    if (initialTarget) {
      (window as any).__protonMarketNavTarget = null;
      handleProcessMarketNavigation(initialTarget);
    }

    const handleCustomNav = (e: any) => {
      if (e.detail) {
        (window as any).__protonMarketNavTarget = null;
        handleProcessMarketNavigation(e.detail);
      }
    };

    window.addEventListener('proton:navigate_market', handleCustomNav);
    return () => {
      window.removeEventListener('proton:navigate_market', handleCustomNav);
    };
  }, [handleProcessMarketNavigation]);

  useEffect(() => {
    if (pendingNavOrderIdRef.current && sellerOrders.length > 0) {
      const found = sellerOrders.find(o => o.id === pendingNavOrderIdRef.current);
      if (found) {
        setSellerSelectedOrder(found);
        pendingNavOrderIdRef.current = null;
      }
    }
  }, [sellerOrders]);

  useEffect(() => {
    const pending = pendingNavTargetRef.current;
    if (!pending || !user?.uid || navigationLookupChats.length === 0) return;

    const combinedOrders = [...sellerOrders, ...buyerOrders];
    const augmentedOrders =
      pending.fetchedOrder && !combinedOrders.some(o => o.id === pending.fetchedOrder!.id)
        ? [...combinedOrders, pending.fetchedOrder]
        : combinedOrders;

    const resolution = resolveMarketChatNavigation({
      target: pending.target,
      currentUserId: user.uid,
      currentUserDisplayName: user.displayName,
      fetchedListing: pending.fetchedListing,
      knownListings: listings,
      groupedChats: navigationLookupChats,
      orders: augmentedOrders,
    });

    pendingNavTargetRef.current = null;

    if (resolution.ok) {
      setChatResolutionError(null);
      setActiveChatContext({
        conversationId: resolution.conversationId,
        listing: resolution.listing,
        buyerId: resolution.buyerId,
        sellerId: resolution.sellerId,
        buyerName: resolution.buyerName,
        sellerName: resolution.sellerName,
        orderId: resolution.orderId,
      });
      setActiveChatListing(resolution.listing);
      setActiveChatOrder(resolution.matchedOrder);
    } else {
      setActiveChatContext(null);
      setActiveChatListing(null);
      setActiveChatOrder(null);
      setChatResolutionError(language === 'ka' ? resolution.messageKa : resolution.messageEn);
    }
  }, [navigationLookupChats, listings, sellerOrders, buyerOrders, user, language]);

  const sellerOrdersRef = useRef(sellerOrders);
  sellerOrdersRef.current = sellerOrders;
  const buyerOrdersRef = useRef(buyerOrders);
  buyerOrdersRef.current = buyerOrders;
  const activeChatOrderRef = useRef(activeChatOrder);
  activeChatOrderRef.current = activeChatOrder;
  const allUserMessagesRef = useRef(allUserMessages);
  allUserMessagesRef.current = allUserMessages;

  useEffect(() => {
    const uid = user?.uid;
    const convId = activeChatContext?.conversationId;
    const targetListingId = activeChatContext?.listing?.id;
    const targetBuyerId = activeChatContext?.buyerId;

    if (!convId || !targetListingId || !targetBuyerId || !uid) {
      setMessagesList([]);
      return;
    }

    let isCurrent = true;
    setMessagesList([]);
    let unsubscribe: () => void = () => {};

    try {
      const qMsgs = query(
        collection(db, 'market_messages'),
        where('conversationId', '==', convId),
        where('participants', 'array-contains', uid)
      );

      unsubscribe = onSnapshot(qMsgs, (snapshot) => {
        if (!isCurrent) return;
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as any
        }));

        // Blend any legacy messages for this specific conversation if loaded in allUserMessages
        const legacyMsgs = allUserMessagesRef.current.filter(m => {
          if (msgs.some(em => em.id === m.id)) return false;
          const mConv = m.conversationId || (m.listingId && m.buyerId ? `${m.listingId}_${m.buyerId}` : '');
          return mConv === convId || (m.listingId === targetListingId && (m.buyerId === targetBuyerId || (!m.buyerId && (m.senderId === targetBuyerId || m.receiverId === targetBuyerId))));
        });

        const combined = [...msgs, ...legacyMsgs];
        combined.sort((a, b) => safeParseDate(a.createdAt) - safeParseDate(b.createdAt));
        setMessagesList(combined);

        // If activeChatOrder is not yet set, check if messages reference an orderId
        if (!activeChatOrderRef.current) {
          const orderMsg = combined.slice().reverse().find(m => m.orderId);
          if (orderMsg?.orderId) {
            const matched =
              sellerOrdersRef.current.find(o => o.id === orderMsg.orderId) ||
              buyerOrdersRef.current.find(o => o.id === orderMsg.orderId);
            if (matched) {
              setActiveChatOrder(matched);
            }
          }
        }
      }, (err) => {
        if (!isCurrent) return;
        console.warn("Scoped conversationId query returned error, using fallback with client filter:", err);
        const fallbackQ = query(
          collection(db, 'market_messages'),
          where('listingId', '==', targetListingId),
          where('participants', 'array-contains', uid)
        );
        unsubscribe = onSnapshot(fallbackQ, (snapshot) => {
          if (!isCurrent) return;
          const msgs = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() as any }))
            .filter(m => {
              const mConv = m.conversationId || (m.listingId && m.buyerId ? `${m.listingId}_${m.buyerId}` : '');
              return mConv === convId || m.buyerId === targetBuyerId || (!m.buyerId && (m.senderId === targetBuyerId || m.receiverId === targetBuyerId));
            });
          msgs.sort((a, b) => safeParseDate(a.createdAt) - safeParseDate(b.createdAt));
          setMessagesList(msgs);
        });
      });
    } catch (e) {
      console.error("Error setting up conversation message listener:", e);
    }

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [activeChatContext?.conversationId, activeChatContext?.listing?.id, activeChatContext?.buyerId, user?.uid]);

  const handleStartChat = useCallback((listing: Listing) => {
    if (!user) {
      showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია შეტყობინების გასაგზავნად." : "Please sign in to message the seller.", 'warning');
      onOpenAuthModal?.();
      return;
    }
    if (!cleanChatId(listing?.id) || !cleanChatId(listing?.sellerId)) {
      showToast(
        language === 'ka'
          ? 'საუბრის მონაცემების დადგენა ვერ მოხერხდა.'
          : 'Conversation details could not be determined.',
        'error'
      );
      return;
    }
    if (listing.sellerId === user.uid) {
      showToast(
        language === 'ka'
          ? 'საკუთარ განცხადებაზე მყიდველის ჩატის დაწყება შეუძლებელია.'
          : 'You cannot start a buyer chat on your own listing.',
        'warning'
      );
      return;
    }

    navSeqRef.current += 1;
    pendingNavTargetRef.current = null;
    setChatResolutionError(null);

    const buyerId = user.uid;
    const conversationId = `${listing.id}_${buyerId}`;

    const ctx: ActiveChatContext = {
      conversationId,
      listing,
      buyerId,
      sellerId: listing.sellerId,
      buyerName: user.displayName || user.email?.split('@')[0] || 'Buyer',
      sellerName: listing.sellerName || 'Seller',
      orderId: null
    };

    setActiveChatContext(ctx);
    setActiveChatListing(listing);
    setActiveChatOrder(null);
  }, [user, language, showToast, onOpenAuthModal]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChatContext || !chatMessageText.trim()) return;

    const validation = validateActiveChatContext({
      context: activeChatContext,
      listing: activeChatListing,
      order: activeChatOrder,
      currentUserId: user.uid,
    });

    if (!validation.ok) {
      const errMsg = language === 'ka' ? validation.messageKa : validation.messageEn;
      showToast(errMsg, 'error');
      return;
    }

    try {
      const { listing } = activeChatContext;
      const resolvedBuyerId = validation.buyerId;
      const resolvedSellerId = validation.sellerId;
      const isSeller = validation.userRole === 'seller';
      const receiverId = isSeller ? resolvedBuyerId : resolvedSellerId;
      const canonicalConversationId = validation.conversationId;
      const participants = [resolvedBuyerId, resolvedSellerId];

      const messageDoc: any = {
        conversationId: canonicalConversationId,
        listingId: listing.id,
        listingTitle: listing.title,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split('@')[0] || (isSeller ? 'Seller' : 'Buyer'),
        senderAvatar: user.photoURL || '',
        text: chatMessageText.trim(),
        createdAt: serverTimestamp(),
        sellerId: resolvedSellerId,
        buyerId: resolvedBuyerId,
        receiverId: receiverId,
        participants
      };

      if (activeChatOrder?.id) {
        messageDoc.orderId = activeChatOrder.id;
      }

      await addDoc(collection(db, 'market_messages'), messageDoc);
      setChatMessageText('');
    } catch (err) {
      console.error("Error sending message:", err);
      showToast(language === 'ka' ? "შეტყობინების გაგზავნა ვერ მოხერხდა." : "Could not send message.", 'error');
    }
  };

  // Order-Linked Marketplace Chat Handlers
  const handleStartOrderChat = useCallback((order: Order) => {
    if (!user) {
      showToast(language === 'ka' ? 'გთხოვთ გაიაროთ ავტორიზაცია' : 'Please sign in to chat', 'error');
      return;
    }

    if (!cleanChatId(order?.listingId) || !cleanChatId(order?.buyerId) || !cleanChatId(order?.sellerId) || order.buyerId === order.sellerId) {
      showToast(
        language === 'ka'
          ? 'შეკვეთის საუბრის მონაცემების დადგენა ვერ მოხერხდა.'
          : 'Order conversation participants could not be verified.',
        'error'
      );
      return;
    }

    // Security check: Only the buyer or seller of the order can initiate or participate in order chat
    const isBuyer = user.uid === order.buyerId;
    const isSeller = user.uid === order.sellerId;
    if (!isBuyer && !isSeller) {
      showToast(language === 'ka' ? 'წვდომა შეზღუდულია' : 'Unauthorized access to order chat', 'error');
      return;
    }

    // Resolve or create safe minimal listing metadata
    const matchedListing = listings.find(l => l.id === order.listingId);
    if (matchedListing && cleanChatId(matchedListing.sellerId) && matchedListing.sellerId !== order.sellerId) {
      showToast(
        language === 'ka'
          ? 'შეკვეთისა და განცხადების გამყიდველის მონაცემები არ ემთხვევა.'
          : 'Order seller does not match listing seller.',
        'error'
      );
      return;
    }

    navSeqRef.current += 1;
    pendingNavTargetRef.current = null;
    setChatResolutionError(null);

    const resolvedListing: Listing = matchedListing || {
      id: order.listingId,
      title: order.itemTitle || 'Marketplace Item',
      description: '',
      price: order.amount || 0,
      currency: order.currency || 'USD',
      sellerId: order.sellerId,
      sellerName: (order as any).sellerName || 'Seller',
      category: 'General',
      country: '',
      city: '',
      location: '',
      createdAt: Date.now(),
      status: 'active'
    };

    // Close order details modal if open, to avoid overlay stacking traps
    setSellerSelectedOrder(null);
    setBuyerSelectedOrder(null);

    // CRITICAL: Determine conversation identity strictly from listingId + order.buyerId
    const buyerId = order.buyerId;
    const sellerId = order.sellerId;
    const conversationId = `${order.listingId}_${buyerId}`;

    const buyerName = isBuyer ? (user.displayName || 'Buyer') : ((order as any).buyerName || (order as any).shippingDetails?.recipientName || 'Buyer');
    const sellerName = isSeller ? (user.displayName || 'Seller') : (resolvedListing.sellerName || 'Seller');

    const ctx: ActiveChatContext = {
      conversationId,
      listing: resolvedListing,
      buyerId,
      sellerId,
      buyerName,
      sellerName,
      orderId: order.id
    };

    // Set order context and open existing chat drawer
    setActiveChatContext(ctx);
    setActiveChatOrder(order);
    setActiveChatListing(resolvedListing);
  }, [user, listings, language, showToast]);

  const handleViewOrderFromChat = useCallback((orderId: string) => {
    const foundOrder = sellerOrders.find(o => o.id === orderId) || buyerOrders.find(o => o.id === orderId) || activeChatOrder;
    if (!foundOrder) return;

    // Close chat drawer to return cleanly to Order Details without overlay trap
    setActiveChatListing(null);
    setActiveChatContext(null);

    if (foundOrder.sellerId === user?.uid) {
      setSellerSelectedOrder(foundOrder);
    } else {
      setBuyerSelectedOrder(foundOrder);
    }
  }, [sellerOrders, buyerOrders, activeChatOrder, user?.uid]);

  const handleSelectDesktopThread = useCallback((thread: ChatThreadSummary) => {
    navSeqRef.current += 1;
    pendingNavTargetRef.current = null;

    const originalChat = groupedChats.find((c) => c.conversationId === thread.conversationId);
    const orderId =
      thread.orderId ||
      originalChat?.messages?.find((m: any) => m.orderId)?.orderId;
    const combinedOrders = [...sellerOrders, ...buyerOrders];
    const resolution = resolveMarketChatNavigation({
      target: {
        type: 'market_message',
        conversationId: thread.conversationId,
        listingId: thread.listingId,
        buyerId: thread.buyerId,
        sellerId: thread.sellerId,
        orderId: orderId || undefined,
      },
      currentUserId: user?.uid,
      currentUserDisplayName: user?.displayName,
      knownListings: listings,
      groupedChats: navigationLookupChats,
      orders: combinedOrders,
    });

    if (!resolution.ok) {
      const errorText = language === 'ka' ? resolution.messageKa : resolution.messageEn;
      setActiveChatContext(null);
      setActiveChatListing(null);
      setActiveChatOrder(null);
      setChatResolutionError(errorText);
      showToast(errorText, 'error');
      return;
    }

    setChatResolutionError(null);
    const ctx: ActiveChatContext = {
      conversationId: resolution.conversationId,
      listing: resolution.listing,
      buyerId: resolution.buyerId,
      sellerId: resolution.sellerId,
      buyerName: resolution.buyerName,
      sellerName: resolution.sellerName,
      orderId: resolution.orderId,
    };

    setActiveChatContext(ctx);
    setActiveChatListing(resolution.listing);

    if (resolution.matchedOrder) {
      setActiveChatOrder(resolution.matchedOrder);
    } else if (resolution.orderId) {
      setActiveChatOrder({
        id: resolution.orderId,
        listingId: resolution.listingId,
        itemTitle: resolution.listing.title,
        buyerId: resolution.buyerId,
        sellerId: resolution.sellerId,
        amount: 0,
        currency: 'USD',
        status: 'pending',
        createdAt: Date.now(),
      } as any);
    } else {
      setActiveChatOrder(null);
    }
  }, [groupedChats, navigationLookupChats, listings, sellerOrders, buyerOrders, user?.uid, user?.displayName, language, showToast]);

  // Dynamically resolve theme from design system.
  // Strips hardcoded hex values to support full color-variable harmony of Light, Forest, Titanium, Rose, Sunset, etc.
  const currentTheme = {
    card: "bg-proton-card border border-proton-border shadow-xl text-proton-text",
    input: "bg-proton-bg border border-proton-border focus:border-proton-accent text-proton-text placeholder:text-proton-muted/65 focus:outline-none focus:ring-1 focus:ring-proton-accent/30",
    accent: "text-proton-accent",
    accentBg: "bg-proton-accent text-proton-on-accent hover:bg-proton-accent-hover focus:ring-1 focus:ring-proton-accent/30",
    border: "border-proton-border",
    muted: "text-proton-muted",
    text: "text-proton-text",
    subtext: "text-proton-text/80",
    tagMuted: "text-proton-muted/75",
    cardAlt: "bg-proton-bg/70 border border-proton-border text-proton-text",
    badgeBg: "bg-proton-accent/15 text-proton-accent border border-proton-accent/30",
    bgHover: "hover:bg-proton-accent/10 hover:text-proton-accent hover:border-proton-accent/35",
    overlay: "bg-proton-card/95 backdrop-blur-xl border border-proton-border"
  };

  const getBaseQuery = useCallback((category: string, mode: string, uid?: string) => {
    const coll = collection(db, 'listings');
    if (mode === 'my-listings' && uid) {
      return query(coll, where('sellerId', '==', uid));
    }
    if (category !== 'all') {
      return query(coll, where('category', '==', category));
    }
    return coll;
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore) return;

    if (isFilteredMode) {
      // In filtered / search mode: reveal next page of matching results smoothly
      if (searchVisibleLimit < listings.length) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setSearchVisibleLimit(prev => prev + PAGE_SIZE);
          setIsLoadingMore(false);
        }, 120);
      }
      return;
    }

    if (!hasMore || !lastVisibleDocRef.current) return;
    setIsLoadingMore(true);

    try {
      const baseQ = getBaseQuery(activeCategory, viewMode, user?.uid);
      const useOrderBy = currentUseOrderByRef.current;

      let nextSnap;
      try {
        const qNext = useOrderBy
          ? query(baseQ, orderBy('createdAt', 'desc'), startAfter(lastVisibleDocRef.current), limit(PAGE_SIZE))
          : query(baseQ, startAfter(lastVisibleDocRef.current), limit(PAGE_SIZE));
        nextSnap = await getDocs(qNext);
      } catch (orderErr) {
        console.warn("[MarketHub] Paginated cursor query with orderBy failed, falling back without orderBy:", orderErr);
        currentUseOrderByRef.current = false;
        const qFallback = query(baseQ, startAfter(lastVisibleDocRef.current), limit(PAGE_SIZE));
        nextSnap = await getDocs(qFallback);
      }

      if (!nextSnap || nextSnap.empty) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const newRawDocs = nextSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Listing[];

      lastVisibleDocRef.current = nextSnap.docs[nextSnap.docs.length - 1];

      if (nextSnap.docs.length < PAGE_SIZE) {
        setHasMore(false);
      }

      const realNew = newRawDocs.filter(isRealListing);

      setListings(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        const deduplicated = realNew.filter(l => !existingIds.has(l.id));
        appendedListingsRef.current = [...appendedListingsRef.current, ...deduplicated];
        const combined = [...prev, ...deduplicated];
        if (!currentUseOrderByRef.current) {
          combined.sort((a, b) => safeParseDate(b.createdAt) - safeParseDate(a.createdAt));
        }
        return combined;
      });
    } catch (e) {
      console.error("[MarketHub] Error loading next page of listings:", e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, isFilteredMode, searchVisibleLimit, listings.length, hasMore, activeCategory, viewMode, user?.uid, getBaseQuery]);

  useEffect(() => {
    if (authLoading) return;
    if (viewMode === 'my-listings' && !user) {
      setListings([]);
      setLoading(false);
      return;
    }

    let unsub: (() => void) | null = null;
    let isActive = true;

    // Reset pagination state when filters or viewMode change
    appendedListingsRef.current = [];
    page1DocsRef.current = [];
    lastVisibleDocRef.current = null;
    setHasMore(true);
    setSearchVisibleLimit(PAGE_SIZE);

    if (isSearchActive) {
      // GLOBAL FIRESTORE SEARCH EXECUTION
      setIsSearchingBackend(true);
      setLoading(true);

      const runSearch = async () => {
        try {
          const coll = collection(db, 'listings');
          const cleanTerm = search.trim();
          const lowerTerm = cleanTerm.toLowerCase();
          const capTerm = cleanTerm.charAt(0).toUpperCase() + cleanTerm.slice(1);
          const upperTerm = cleanTerm.toUpperCase();
          const uniqueVariants = Array.from(new Set([cleanTerm, lowerTerm, capTerm, upperTerm])).filter(Boolean);

          const prefixPromises: Promise<any>[] = [];
          uniqueVariants.forEach(variant => {
            prefixPromises.push(
              getDocs(query(
                coll,
                where('title', '>=', variant),
                where('title', '<=', variant + '\uf8ff'),
                limit(50)
              )).catch(e => {
                console.warn("[MarketHub Search] Title prefix query error:", e);
                return null;
              })
            );
            prefixPromises.push(
              getDocs(query(
                coll,
                where('titleGe', '>=', variant),
                where('titleGe', '<=', variant + '\uf8ff'),
                limit(50)
              )).catch(e => {
                console.warn("[MarketHub Search] TitleGe prefix query error:", e);
                return null;
              })
            );
          });

          // Scoped window query to capture keyword matches across descriptions, cities, sellerNames, categories, etc.
          const scopedPromise = (async () => {
            try {
              let qScoped;
              if (viewMode === 'my-listings') {
                if (!user) return null;
                qScoped = query(coll, where('sellerId', '==', user.uid), limit(200));
              } else if (activeCategory !== 'all') {
                qScoped = query(coll, where('category', '==', activeCategory), limit(200));
              } else {
                try {
                  qScoped = query(coll, orderBy('createdAt', 'desc'), limit(200));
                  return await getDocs(qScoped);
                } catch {
                  qScoped = query(coll, limit(200));
                  return await getDocs(qScoped);
                }
              }
              return await getDocs(qScoped);
            } catch (err) {
              console.warn("[MarketHub Search] Scoped window query error:", err);
              return null;
            }
          })();

          const [prefixSnaps, scopedSnap] = await Promise.all([
            Promise.all(prefixPromises),
            scopedPromise
          ]);

          if (!isActive) return;

          const docMap = new Map<string, Listing>();

          if (scopedSnap && scopedSnap.docs) {
            scopedSnap.docs.forEach((d: any) => {
              docMap.set(d.id, { id: d.id, ...d.data() } as Listing);
            });
          }

          prefixSnaps.forEach(snap => {
            if (snap && snap.docs) {
              snap.docs.forEach((d: any) => {
                docMap.set(d.id, { id: d.id, ...d.data() } as Listing);
              });
            }
          });

          const candidates = Array.from(docMap.values()).filter(isRealListing);
          candidates.sort((a, b) => safeParseDate(b.createdAt) - safeParseDate(a.createdAt));

          setListings(candidates);
        } catch (err) {
          console.error("[MarketHub Search] Search execution exception:", err);
        } finally {
          if (isActive) {
            setIsSearchingBackend(false);
            setLoading(false);
          }
        }
      };

      runSearch();

      return () => {
        isActive = false;
      };
    }

    // If text search is not active, but secondary filters are active:
    // Execute scoped query window directly against Firestore to prevent false zero-results
    if (hasActiveFilters && (activeCountry !== 'GLOBAL' || activeListingType !== 'all' || hasActivePriceFilter || activeCity.trim().length > 0)) {
      setLoading(true);

      const runScopedFilterFetch = async () => {
        try {
          const coll = collection(db, 'listings');
          let snap;
          if (viewMode === 'my-listings') {
            if (!user) return;
            snap = await getDocs(query(coll, where('sellerId', '==', user.uid), limit(200)));
          } else if (activeCategory !== 'all') {
            snap = await getDocs(query(coll, where('category', '==', activeCategory), limit(200)));
          } else {
            try {
              snap = await getDocs(query(coll, orderBy('createdAt', 'desc'), limit(200)));
            } catch {
              snap = await getDocs(query(coll, limit(200)));
            }
          }
          if (!isActive || !snap) return;

          const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Listing[];
          data.sort((a, b) => safeParseDate(b.createdAt) - safeParseDate(a.createdAt));
          const realDocs = data.filter(isRealListing);
          setListings(realDocs);
        } catch (e) {
          console.warn("[MarketHub] Scoped filter fetch error:", e);
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      };

      runScopedFilterFetch();

      return () => {
        isActive = false;
      };
    }

    // STANDARD BROWSE / PAGINATED WINDOW MODE:
    // Fetches page 1 with real-time onSnapshot and sets up cursor pagination
    setLoading(true);

    const tryFetchListings = (useOrderBy: boolean) => {
      try {
        const baseQ = getBaseQuery(activeCategory, viewMode, user?.uid);
        const qListings = useOrderBy 
          ? query(baseQ, orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
          : query(baseQ, limit(PAGE_SIZE));

        currentUseOrderByRef.current = useOrderBy;

        unsub = onSnapshot(qListings, (snapshot) => {
          if (!isActive) return;

          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Listing[];

          if (!useOrderBy) {
            data.sort((a, b) => safeParseDate(b.createdAt) - safeParseDate(a.createdAt));
          }

          const realPage1 = data.filter(isRealListing);
          page1DocsRef.current = realPage1;

          // Track cursor for next page if no appended pages exist yet
          if (snapshot.docs.length > 0 && appendedListingsRef.current.length === 0) {
            lastVisibleDocRef.current = snapshot.docs[snapshot.docs.length - 1];
          }
          if (snapshot.docs.length < PAGE_SIZE && appendedListingsRef.current.length === 0) {
            setHasMore(false);
          } else if (snapshot.docs.length >= PAGE_SIZE && appendedListingsRef.current.length === 0) {
            setHasMore(true);
          }

          // Merge with appended listings, keeping unique ids
          const page1Ids = new Set(realPage1.map(l => l.id));
          const survivingAppended = appendedListingsRef.current.filter(l => !page1Ids.has(l.id));
          appendedListingsRef.current = survivingAppended;

          const combined = [...realPage1, ...survivingAppended];
          if (!useOrderBy) {
            combined.sort((a, b) => safeParseDate(b.createdAt) - safeParseDate(a.createdAt));
          }
          setListings(combined);
          setLoading(false);
        }, (error) => {
          console.warn(`[MarketHub] Listings listener failed (useOrderBy=${useOrderBy}):`, error);
          if (useOrderBy) {
            currentUseOrderByRef.current = false;
            tryFetchListings(false);
          } else {
            setLoading(false);
          }
        });
      } catch (e) {
        console.warn("[MarketHub] Query execution exception:", e);
        if (useOrderBy) {
          currentUseOrderByRef.current = false;
          tryFetchListings(false);
        } else {
          setLoading(false);
        }
      }
    };

    tryFetchListings(true);

    return () => {
      isActive = false;
      if (unsub) unsub();
    };
  }, [user, authLoading, activeCategory, viewMode, search, activeCountry, activeCity, activeListingType, hasActivePriceFilter, showOnlyFavorites, isSearchActive, hasActiveFilters, getBaseQuery]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setSearchRaw('');
    setActiveCategory('all');
    setActiveCountry('GLOBAL');
    setActiveCity('');
    setMinPrice('');
    setMaxPrice('');
    setActiveListingType('all');
    setShowOnlyFavorites(false);
    setSearchVisibleLimit(PAGE_SIZE);
  }, [PAGE_SIZE]);

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < listings.length; i++) {
      const l = listings[i];
      try {
        const safePrice = normalizeListingPriceValue(l.price);
        const converted = convertPrice(safePrice, l.currency || 'USD', displayCurrency);
        map.set(l.id, roundPriceForDisplayCurrency(converted, displayCurrency));
      } catch {
        map.set(l.id, 0);
      }
    }
    return map;
  }, [listings, displayCurrency]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      try {
        const fallback = roundPriceForDisplayCurrency(
          convertPrice(normalizeListingPriceValue(item.price), item.currency || 'USD', displayCurrency),
          displayCurrency
        );
        return acc + (priceMap.get(item.id) ?? fallback);
      } catch {
        return acc;
      }
    }, 0);
  }, [cart, displayCurrency, priceMap]);

  const filteredListings = useMemo(() => {
    const isMyListings = viewMode === 'my-listings';
    if (isMyListings && profileSubMode !== 'selling') {
      return [];
    }

    const searchLower = search ? search.toLowerCase() : null;
    const activeCityLower = activeCity ? activeCity.toLowerCase() : null;

    // Single pass map with cached converted price and created timestamp
    const itemsWithMeta = listings.map(l => {
      const fallbackConverted = roundPriceForDisplayCurrency(
        convertPrice(normalizeListingPriceValue(l.price), l.currency || 'USD', displayCurrency),
        displayCurrency
      );
      return {
        item: l,
        convertedPrice: priceMap.get(l.id) ?? fallbackConverted,
        createdTime: safeParseDate(l.createdAt)
      };
    });

    const filtered = itemsWithMeta.filter(({ item: l, convertedPrice }) => {
      if (isMyListings) {
        return l.sellerId === user?.uid;
      }

      // Filter out sold items
      if (l.status === 'sold' || (l as any).isSold) return false;

      // Filter by Listing Type
      if (activeListingType !== 'all') {
        if (activeListingType === 'service') {
          if (!isServiceListing(l)) return false;
        } else if (activeListingType === 'project') {
          if (!isProjectListing(l)) return false;
        } else {
          if (!isPhysicalListing(l)) return false;
        }
      }

      // Filter by Category
      if (activeCategory !== 'all' && l.category !== activeCategory) return false;

      // Filter by Country
      if (activeCountry !== 'GLOBAL' && l.country !== activeCountry) return false;

      // Filter by City
      if (activeCityLower && (!l.city || !l.city.toLowerCase().includes(activeCityLower))) return false;

      // Filter by Price in active displayCurrency
      if (parsedMinPrice !== null && convertedPrice < parsedMinPrice) return false;
      if (parsedMaxPrice !== null && convertedPrice > parsedMaxPrice) return false;

      // Filter by Search (Bilingual & cross-language + category attributes)
      if (searchLower) {
        const matchesAttribute = l.attributes
          ? Object.values(l.attributes).some(
              val => typeof val !== 'boolean' && val !== null && val !== undefined && String(val).toLowerCase().includes(searchLower)
            )
          : false;
        const matchesSearch = 
          (l.title && l.title.toLowerCase().includes(searchLower)) ||
          (l.titleGe && l.titleGe.toLowerCase().includes(searchLower)) ||
          (Boolean((l as any).titleEn) && (l as any).titleEn.toLowerCase().includes(searchLower)) ||
          (l.description && l.description.toLowerCase().includes(searchLower)) ||
          (l.descriptionGe && l.descriptionGe.toLowerCase().includes(searchLower)) ||
          (l.sellerName && l.sellerName.toLowerCase().includes(searchLower)) ||
          (l.city && l.city.toLowerCase().includes(searchLower)) ||
          (l.country && l.country.toLowerCase().includes(searchLower)) ||
          matchesAttribute;
        if (!matchesSearch) return false;
      }

      // Filter by Favorites
      if (showOnlyFavorites && !favoritesSet.has(l.id)) return false;

      return true;
    });

    // Sorting Engine with pre-calculated numbers
    if (sortBy === 'rating') {
      filtered.sort((aObj, bObj) => {
        const a = aObj.item;
        const b = bObj.item;
        const ratingA = sellerRatings[a.sellerId]?.avg || 0;
        const ratingB = sellerRatings[b.sellerId]?.avg || 0;
        const countA = sellerRatings[a.sellerId]?.count || 0;
        const countB = sellerRatings[b.sellerId]?.count || 0;
        
        if (ratingB !== ratingA) return ratingB - ratingA;
        if (countB !== countA) return countB - countA;
        return bObj.createdTime - aObj.createdTime;
      });
    } else if (sortBy === 'newest') {
      filtered.sort((aObj, bObj) => bObj.createdTime - aObj.createdTime);
    } else if (sortBy === 'priceAsc') {
      filtered.sort((aObj, bObj) => aObj.convertedPrice - bObj.convertedPrice);
    } else if (sortBy === 'priceDesc') {
      filtered.sort((aObj, bObj) => bObj.convertedPrice - aObj.convertedPrice);
    }

    return filtered.map(r => r.item);
  }, [listings, priceMap, search, activeCategory, activeCountry, activeCity, parsedMinPrice, parsedMaxPrice, viewMode, profileSubMode, activeListingType, language, sortBy, sellerRatings, user?.uid, displayCurrency, showOnlyFavorites, favoritesSet]);

  const displayedListings = useMemo(() => {
    if (isFilteredMode) {
      return filteredListings.slice(0, searchVisibleLimit);
    }
    return filteredListings;
  }, [filteredListings, isFilteredMode, searchVisibleLimit]);

  const hasMoreToDisplay = useMemo(() => {
    if (isFilteredMode) {
      return searchVisibleLimit < filteredListings.length;
    }
    return hasMore;
  }, [isFilteredMode, searchVisibleLimit, filteredListings.length, hasMore]);

  const activeListingsCount = useMemo(() => {
    let active = 0;
    for (let i = 0; i < listings.length; i++) {
      const l = listings[i];
      const isSold = l.status === 'sold' || (l as any).isSold;
      if (!isSold) {
        active++;
      }
    }
    return active;
  }, [listings]);

  const sellerOwnedListings = useMemo(() => {
    if (!user) return [];
    return listings.filter((l) => l.sellerId === user.uid);
  }, [listings, user]);

  const sellerStatsByListingId = useMemo(() => {
    const m = new Map<string, ListingAnalyticsStats>();
    if (sellerAnalyticsOverview?.listings) {
      for (const s of sellerAnalyticsOverview.listings) {
        m.set(s.listingId, s);
      }
    }
    return m;
  }, [sellerAnalyticsOverview]);

  const loadSellerAnalytics = useCallback(async () => {
    if (!user) {
      setSellerAnalyticsOverview(null);
      setSellerAnalyticsUnavailableReason(undefined);
      return;
    }
    setSellerAnalyticsLoading(true);
    try {
      const res = await fetchSellerAnalyticsOverview();
      setSellerAnalyticsOverview(res.overview);
      setSellerAnalyticsUnavailableReason(res.unavailableReason);
    } catch {
      // Keep clean zero state on transient error
    } finally {
      setSellerAnalyticsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSellerAnalyticsOverview(null);
      setSellerAnalyticsUnavailableReason(undefined);
      return;
    }
    if (
      (viewMode === 'my-listings' && profileSubMode === 'selling') ||
      viewMode === 'rankings'
    ) {
      void loadSellerAnalytics();
    }
  }, [user, viewMode, profileSubMode, loadSellerAnalytics]);

  const handleToggleCompetitionOptOut = useCallback(async (nextOptOut: boolean) => {
    const res = await setCompetitionOptOutPreference(nextOptOut);
    if (!res.success) {
      showToast(
        res.error || (language === 'ka' ? 'პარამეტრის შენახვა ვერ მოხერხდა.' : 'Could not update competition preference.'),
        'error'
      );
      return;
    }
    setSellerAnalyticsOverview((prev) =>
      prev
        ? {
            ...prev,
            competitionOptOut: res.optedOut,
            listings: prev.listings.map((item) => ({ ...item, optedOut: res.optedOut })),
          }
        : prev
    );
    showToast(
      res.optedOut
        ? (language === 'ka' ? 'საჯარო რეიტინგებიდან გამოთიშვა ჩაირთო (პირადი სტატისტიკა შენარჩუნებულია).' : 'Opted out of public rankings (private stats retained).')
        : (language === 'ka' ? 'საჯარო რეიტინგებში მონაწილეობა ჩაირთო.' : 'Public rankings participation enabled.'),
      'success'
    );
  }, [language, showToast]);

  const handleBuyNow = async (listing: Listing) => {
    if (!user) {
      showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია შესყიდვისთვის." : "Please sign in to make a purchase.", 'warning');
      onOpenAuthModal?.();
      return;
    }

    const validation = validateListingForOrderCreation(listing, user.uid);
    if (!validation.ok) {
      showToast(
        language === 'ka' ? validation.messageKa : validation.messageEn,
        validation.code === 'SELF_PURCHASE' ? 'warning' : 'error',
        6000
      );
      return;
    }

    setCheckoutItem(listing);
  };

  const processPurchase = async () => {
    if (!user) {
      showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია შესყიდვისთვის." : "Please sign in to make a purchase.", 'warning');
      return;
    }
    if (!checkoutItem) return;

    // 1. Initial client-side validation using marketOrderRules
    const preValidation = validateListingForOrderCreation(checkoutItem, user.uid);
    if (!preValidation.ok) {
      showToast(language === 'ka' ? preValidation.messageKa : preValidation.messageEn, 'error', 6000);
      return;
    }

    setIsCheckingOut(true);
    try {
      await runTransaction(db, async (transaction) => {
        const listingRef = doc(db, 'listings', checkoutItem.id);
        const listingSnap = await transaction.get(listingRef);
        if (!listingSnap.exists()) {
          throw new Error(language === 'ka' ? 'განცხადება ბაზაში ვერ მოიძებნა.' : 'Listing does not exist.');
        }
        const freshData = listingSnap.data();

        // 2. Strict transaction-level re-validation against fresh Firestore snapshot for concurrency protection
        const freshValidation = validateListingForOrderCreation(freshData, user.uid);
        if (!freshValidation.ok) {
          throw new Error(language === 'ka' ? freshValidation.messageKa : freshValidation.messageEn);
        }

        const verifiedOrderData = buildVerifiedOrderPayload({
          listingId: checkoutItem.id,
          freshListing: freshData,
          buyerId: user.uid,
          itemTitle: getListingTitle(freshData || checkoutItem, language),
          validation: freshValidation,
          buyerInstructions: !freshValidation.requiresShipping ? buyerInstructions : '',
          shippingDetails: freshValidation.requiresShipping ? shippingDetails : null,
          fallbackBuyerName: user.displayName,
          createdAt: serverTimestamp()
        });

        const newOrderRef = doc(collection(db, 'orders'));
        transaction.set(newOrderRef, verifiedOrderData);

        if (freshValidation.requiresAtomicListingLock) {
          const lockUpdate = freshValidation.buildListingLockUpdate(newOrderRef.id);
          if (lockUpdate) {
            transaction.update(listingRef, lockUpdate);
          }
        }
      });
      
      const purchasedTitle = getListingTitle(checkoutItem, language);
      setCheckoutItem(null);
      setBuyerInstructions('');
      showToast(
        language === 'ka' 
          ? `შეკვეთის მოთხოვნა "${purchasedTitle}" წარმატებით გაეგზავნა გამყიდველს! დეტალებზე დაუკავშირდით გამყიდველს ჩატში.` 
          : `Order request for "${purchasedTitle}" sent to seller! Please arrange payment and delivery with seller in chat.`, 
        'success'
      );
      setViewMode('my-listings');
      setProfileSubMode('buying');
    } catch (error: any) {
      console.error("Error creating order:", error);
      const errMsg = error?.message || (language === 'ka' ? "შეკვეთისას მოხდა შეცდომა." : "Error processing order.");
      showToast(errMsg, 'error', 6000);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const executeOrderCancellation = async (order: Order) => {
    if (!user) {
      showToast(language === 'ka' ? "ავტორიზაცია აუცილებელია." : "Authentication is required.", 'warning');
      return;
    }

    setIsCancellingOrder(true);
    try {
      let restoredListingId: string | null = null;
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', order.id);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) {
          throw new Error(language === 'ka' ? "შეკვეთა ვერ მოიძებნა." : "Order not found.");
        }

        const freshOrder = orderSnap.data();
        const currentStatus = freshOrder.status;

        // Authorization validation: only buyer or seller of the order can cancel
        const isSeller = freshOrder.sellerId === user.uid;
        const isBuyer = freshOrder.buyerId === user.uid;
        if (!isBuyer && !isSeller) {
          throw new Error(language === 'ka' ? "არაავტორიზებული ოპერაცია." : "Unauthorized to cancel this order.");
        }

        // Integrity check: buyer and seller cannot be the same user
        if (freshOrder.buyerId === freshOrder.sellerId) {
          throw new Error("Self-purchase integrity error: buyer and seller cannot be identical.");
        }

        // Terminal & progress checks
        if (currentStatus === 'cancelled') {
          throw new Error(language === 'ka' ? "შეკვეთა უკვე გაუქმებულია." : "This order has already been cancelled.");
        }
        if (currentStatus === 'completed') {
          throw new Error(language === 'ka' ? "დასრულებული შეკვეთის გაუქმება შეუძლებელია." : "Completed orders cannot be cancelled.");
        }
        if (currentStatus === 'shipped') {
          throw new Error(language === 'ka' ? "გაგზავნილი შეკვეთის გაუქმება შეუძლებელია." : "Shipped orders cannot be cancelled.");
        }
        if (currentStatus === 'processing') {
          throw new Error(language === 'ka' ? "დამუშავების პროცესში მყოფი შეკვეთის გაუქმება შეუძლებელია." : "Orders currently being processed cannot be cancelled.");
        }
        if (currentStatus === 'in_progress') {
          throw new Error(language === 'ka' ? "მიმდინარე სამუშაოს შეკვეთის გაუქმება შეუძლებელია." : "Orders with work in progress cannot be cancelled.");
        }

        // Only 'pending' (physical or unique digital asset) or 'booked' (service) orders can be cancelled
        if (currentStatus !== 'pending' && currentStatus !== 'booked') {
          throw new Error(
            language === 'ka'
              ? `შეკვეთის გაუქმება შეუძლებელია ამჟამინდელი სტატუსით (${currentStatus}).`
              : `Order cannot be cancelled in status: ${currentStatus}.`
          );
        }

        // Read listing document before any writes (all reads must precede all writes in Firestore transactions)
        let shouldRestoreListing = false;
        let listingRef: any = null;

        if (freshOrder.listingId) {
          listingRef = doc(db, 'listings', freshOrder.listingId);
          const listingSnap = await transaction.get(listingRef);

          if (listingSnap.exists()) {
            const listingData = listingSnap.data() as Record<string, any>;
            shouldRestoreListing = shouldUnlockListingOnOrderCancel(
              listingData,
              orderSnap.id || order.id,
              freshOrder.sellerId,
              freshOrder.orderType
            );
          }
        }

        // Atomically update the order status to 'cancelled'
        transaction.update(orderRef, {
          status: 'cancelled'
        });

        // Atomically restore the listing to 'active' if provenance and asset-state guards pass
        if (shouldRestoreListing && listingRef) {
          restoredListingId = freshOrder.listingId;
          transaction.update(listingRef, {
            status: 'active',
            isSold: false,
            activeOrderId: deleteField()
          });
        }
      });

      // Update local listings state immediately when the transaction actually restored the listing
      if (restoredListingId) {
        setListings(prev => prev.map(item => {
          if (item.id === restoredListingId && (item.activeOrderId === order.id || item.status === 'reserved' || (order.orderType !== 'project' && (item.status === 'sold' || item.isSold)))) {
            return {
              ...item,
              status: 'active',
              isSold: false,
              activeOrderId: undefined
            };
          }
          return item;
        }));
      }

      showToast(
        language === 'ka' ? "შეკვეთა წარმატებით გაუქმდა." : "Order cancelled successfully.",
        'success'
      );
      setOrderToCancel(null);
    } catch (error: any) {
      console.error("Order cancellation transaction error:", error);
      showToast(error.message || (language === 'ka' ? "შეკვეთის გაუქმება ვერ მოხერხდა." : "Failed to cancel order."), 'error');
    } finally {
      setIsCancellingOrder(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string, tracking?: TrackingInfo) => {
    try {
      if (!user) {
        showToast(language === 'ka' ? "ავტორიზაცია აუცილებელია." : "Authentication is required.", 'warning');
        return;
      }

      const targetOrder = orders.find(o => o.id === orderId);
      if (!targetOrder) {
        showToast(language === 'ka' ? "შეკვეთა ვერ მოიძებნა." : "Order not found.", 'error');
        return;
      }

      // Delegate cancellation to atomic transactional method
      if (newStatus === 'cancelled') {
        return await executeOrderCancellation(targetOrder);
      }

      const isPhysical = isPhysicalOrder(targetOrder);
      const isProjectAsset = isProjectAssetOrder(targetOrder);
      const isSeller = targetOrder.sellerId === user.uid;
      const isBuyer = targetOrder.buyerId === user.uid;

      if (isProjectAsset) {
        if (!isSeller) {
          showToast(
            language === 'ka'
              ? "მხოლოდ გამყიდველს შეუძლია ციფრული აქტივის შეკვეთის დასრულება."
              : "Only the seller can complete a digital asset order.",
            'warning'
          );
          return;
        }
        if (newStatus !== 'completed') {
          showToast(
            language === 'ka'
              ? "ციფრული აქტივის შეკვეთისთვის დაშვებულია მხოლოდ დასრულება ან გაუქმება."
              : "Only completion or cancellation is allowed for digital asset orders.",
            'warning'
          );
          return;
        }

        const { listingId: finalizedListingId, soldUpdate } = await runTransaction(db, async (transaction) => {
          return completeDigitalAssetOrderInTransaction({
            tx: transaction,
            orderRef: doc(db, 'orders', orderId),
            getListingRef: (id: string) => doc(db, 'listings', id),
            orderId,
            callerUid: user.uid
          });
        });

        if (finalizedListingId) {
          setListings(prev => prev.map(item => (
            item.id === finalizedListingId
              ? { ...item, ...soldUpdate }
              : item
          )));
        }

        showToast(
          language === 'ka'
            ? "შეკვეთა დასრულდა და ციფრული აქტივი გაყიდულად მოინიშნა!"
            : "Order completed and digital asset marked as sold!",
          'success'
        );
        setShipmentTrackingInput(null);
        return;
      }

      if (isPhysical) {
        if (newStatus === 'processing' || newStatus === 'shipped') {
          if (!isSeller) {
            showToast(language === 'ka' 
              ? "მხოლოდ გამყიდველს შეუძლია შეკვეთის გაგზავნა ან დამუშავება." 
              : "Only the seller can process or ship the order.", 'warning');
            return;
          }
        } else if (newStatus === 'completed') {
          if (!isBuyer) {
            showToast(language === 'ka' 
              ? "მხოლოდ მყიდველს შეუძლია ჩაბარების დადასტურება." 
              : "Only the buyer can confirm order receipt.", 'warning');
            return;
          }
        }
      } else {
        if (!isSeller) {
          showToast(language === 'ka' 
            ? "მხოლოდ გამყიდველს/შემსრულებელს შეუძლია შეკვეთის სტატუსის შეცვლა." 
            : "Only the seller or service provider is authorized to update order status.", 'warning');
          return;
        }
      }

      const updates: any = {
        status: newStatus
      };

      if (tracking && (tracking.carrier?.trim() || tracking.trackingNumber?.trim())) {
        updates.trackingInfo = {
          carrier: tracking.carrier?.trim() || '',
          trackingNumber: tracking.trackingNumber?.trim() || '',
          shippedAt: new Date().toISOString()
        };
      }

      await updateDoc(doc(db, 'orders', orderId), updates);
      showToast(
        language === 'ka' ? "შეკვეთის სტატუსი განახლდა!" : "Order status updated successfully!",
        'success'
      );
      setShipmentTrackingInput(null);
    } catch (error: any) {
      console.error("Error updating order status:", error);
      const localizedMsg = error instanceof MarketOrderRuleError
        ? (language === 'ka' ? error.messageKa : error.messageEn)
        : (error?.message || (language === 'ka' ? "სტატუსის განახლება ვერ მოხერხდა." : "Failed to update order status."));
      showToast(localizedMsg, 'error');
    }
  };

  const isResizing = photoUploadTasks.some(
    t => t.status === 'resizing' || t.status === 'uploading'
  );

  const updatePhotoTask = useCallback(
    (taskId: string, updater: (task: ListingPhotoUploadTask) => ListingPhotoUploadTask) => {
      setPhotoUploadTasks(prev => prev.map(t => (t.id === taskId ? updater(t) : t)));
    },
    []
  );

  const resizeImageFileToDataUri = useCallback(
    (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        if (!file.type || !file.type.startsWith('image/')) {
          reject(
            new Error(
              language === 'ka'
                ? 'ფაილი არ არის სურათი (PNG, JPG, WEBP).'
                : 'File is not a supported image (PNG, JPG, WEBP).'
            )
          );
          return;
        }

        const reader = new FileReader();
        reader.onload = event => {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const MAX_WIDTH = 1280;
              const MAX_HEIGHT = 1280;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height = Math.round(height * (MAX_WIDTH / width));
                  width = MAX_WIDTH;
                }
              } else if (height > MAX_HEIGHT) {
                width = Math.round(width * (MAX_HEIGHT / height));
                height = MAX_HEIGHT;
              }

              canvas.width = Math.max(1, Math.round(width));
              canvas.height = Math.max(1, Math.round(height));
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              }

              let dataUrl = canvas.toDataURL('image/jpeg', 0.82);
              const estimateBytes = (uri: string) => Math.ceil((uri.length * 3) / 4);
              if (estimateBytes(dataUrl) > MAX_LISTING_PHOTO_BYTES) {
                dataUrl = canvas.toDataURL('image/jpeg', 0.64);
              }
              if (estimateBytes(dataUrl) > MAX_LISTING_PHOTO_BYTES) {
                reject(
                  new Error(
                    language === 'ka'
                      ? 'ფოტოს ზომა აღემატება 5MB ლიმიტს.'
                      : 'Photo exceeds the 5MB limit after compression.'
                  )
                );
                return;
              }

              resolve(dataUrl);
            } catch {
              reject(
                new Error(
                  language === 'ka'
                    ? 'ფოტოს დამუშავებისას მოხდა შეცდომა.'
                    : 'Failed to process image.'
                )
              );
            }
          };
          img.onerror = () => {
            reject(
              new Error(
                language === 'ka'
                  ? 'ფოტოს ჩატვირთვა ვერ მოხერხდა.'
                  : 'Could not decode image file.'
              )
            );
          };
          img.src = (event.target?.result as string) || '';
        };
        reader.onerror = () => {
          reject(
            new Error(
              language === 'ka'
                ? 'ფაილის წაკითხვა ვერ მოხერხდა.'
                : 'Error reading file.'
            )
          );
        };
        reader.readAsDataURL(file);
      }),
    [language]
  );

  const executeSinglePhotoUpload = useCallback(
    async (taskId: string, dataUri: string) => {
      const requestEpoch = uploadSessionEpochRef.current;
      const expectedUid = user?.uid ?? null;

      updatePhotoTask(taskId, task => ({
        ...task,
        previewUrl: task.previewUrl || dataUri,
        resizedDataUri: dataUri,
        status: 'uploading',
        progress: 55,
        errorMessage: undefined,
      }));

      if (!expectedUid) {
        updatePhotoTask(taskId, task => ({
          ...task,
          status: 'error',
          progress: 0,
          errorMessage:
            language === 'ka'
              ? 'ფოტოს ასატვირთად გაიარეთ ავტორიზაცია.'
              : 'Sign in required to upload photos.',
        }));
        return;
      }

      try {
        const uploadedUrl = await uploadProductImage(
          expectedUid,
          dataUri,
          `prod_${Date.now()}_${taskId.replace(/[^a-zA-Z0-9]/g, '').slice(-6)}`
        );

        // Guard against stale async upload completions after user sign-out / account switch / reset
        if (
          uploadSessionEpochRef.current !== requestEpoch ||
          currentUserUidRef.current !== expectedUid
        ) {
          void deleteListingImagesFromStorage([uploadedUrl], expectedUid).catch(() => {});
          return;
        }

        sessionUploadedUrlsRef.current.add(uploadedUrl);
        setFormData(prev => ({
          ...prev,
          images: appendUploadedPhotoUrl(prev.images || [], uploadedUrl, MAX_LISTING_PHOTOS),
        }));

        updatePhotoTask(taskId, task => ({
          ...task,
          status: 'success',
          progress: 100,
          uploadedUrl,
          errorMessage: undefined,
        }));

        setTimeout(() => {
          if (uploadSessionEpochRef.current !== requestEpoch) return;
          setPhotoUploadTasks(prev => prev.filter(t => t.id !== taskId));
        }, 1800);
      } catch (uploadErr: any) {
        if (
          uploadSessionEpochRef.current !== requestEpoch ||
          currentUserUidRef.current !== expectedUid
        ) {
          return;
        }
        const rawMessage = String(uploadErr?.message || '');
        let friendlyError =
          language === 'ka'
            ? 'ფოტოს ატვირთვა ვერ მოხერხდა.'
            : 'Photo upload failed.';
        if (rawMessage.toLowerCase().includes('unauthorized') || uploadErr?.statusCode === 401) {
          friendlyError =
            language === 'ka'
              ? 'სესია არ დადასტურდა. სცადეთ თავიდან.'
              : 'Session verification failed. Please retry.';
        } else if (rawMessage.toLowerCase().includes('timed out')) {
          friendlyError =
            language === 'ka'
              ? 'ატვირთვის დრო ამოიწურა. სცადეთ თავიდან.'
              : 'Upload timed out. Please retry.';
        } else if (rawMessage.toLowerCase().includes('5 mb') || uploadErr?.statusCode === 400) {
          friendlyError =
            language === 'ka'
              ? 'ფოტოს ფორმატი ან ზომა არასწორია.'
              : 'Invalid image format or file too large.';
        }

        updatePhotoTask(taskId, task => ({
          ...task,
          status: 'error',
          progress: 0,
          errorMessage: friendlyError,
        }));
      }
    },
    [language, updatePhotoTask, user?.uid]
  );

  const handlePhotoFilesUpload = useCallback(
    async (filesInput: FileList | File[]) => {
      const requestEpoch = uploadSessionEpochRef.current;
      const incomingFiles = Array.from(filesInput || []);
      if (incomingFiles.length === 0) return;

      const inFlightCount = photoUploadTasksRef.current.filter(
        t => t.status === 'resizing' || t.status === 'uploading'
      ).length;
      const availableSlots = getAvailablePhotoSlots(
        formData.images || [],
        inFlightCount,
        MAX_LISTING_PHOTOS
      );

      if (availableSlots <= 0) {
        showToast(
          language === 'ka'
            ? `მაქსიმუმ ${MAX_LISTING_PHOTOS} ფოტოს დამატებაა შესაძლებელი.`
            : `Maximum ${MAX_LISTING_PHOTOS} photos allowed per listing.`,
          'warning'
        );
        return;
      }

      const acceptedFiles = incomingFiles.slice(0, availableSlots);
      const skippedCount = incomingFiles.length - acceptedFiles.length;
      if (skippedCount > 0) {
        showToast(
          language === 'ka'
            ? `მაქსიმუმ ${MAX_LISTING_PHOTOS} ფოტო: ${skippedCount} ზედმეტი ფაილი გამოტოვებულია.`
            : `Max ${MAX_LISTING_PHOTOS} photos allowed: ${skippedCount} extra file(s) skipped.`,
          'warning'
        );
      }

      const createdTasks: ListingPhotoUploadTask[] = acceptedFiles.map((file, idx) => ({
        id: `photo_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        fileName: file.name || `photo-${idx + 1}.jpg`,
        previewUrl: '',
        status: 'resizing',
        progress: 15,
        file,
      }));

      setPhotoUploadTasks(prev => [...prev, ...createdTasks]);

      await Promise.allSettled(
        createdTasks.map(async task => {
          try {
            const dataUri = await resizeImageFileToDataUri(task.file!);
            if (uploadSessionEpochRef.current !== requestEpoch) return;
            await executeSinglePhotoUpload(task.id, dataUri);
          } catch (err: any) {
            if (uploadSessionEpochRef.current !== requestEpoch) return;
            updatePhotoTask(task.id, current => ({
              ...current,
              status: 'error',
              progress: 0,
              errorMessage:
                err?.message ||
                (language === 'ka'
                  ? 'ფოტოს დამუშავება ვერ მოხერხდა.'
                  : 'Failed to process image.'),
            }));
          }
        })
      );
    },
    [executeSinglePhotoUpload, formData.images, language, resizeImageFileToDataUri, showToast, updatePhotoTask]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const targetInput = e.target;
      const selectedFiles = targetInput?.files ? Array.from(targetInput.files) : [];
      if (targetInput) targetInput.value = '';
      if (selectedFiles.length > 0) {
        void handlePhotoFilesUpload(selectedFiles);
      }
    },
    [handlePhotoFilesUpload]
  );

  const handleRetryPhotoUpload = useCallback(
    async (taskId: string) => {
      const target = photoUploadTasksRef.current.find(t => t.id === taskId);
      if (!target) return;

      const availableSlots = getAvailablePhotoSlots(
        formData.images || [],
        photoUploadTasksRef.current.filter(
          t => t.id !== taskId && (t.status === 'resizing' || t.status === 'uploading')
        ).length,
        MAX_LISTING_PHOTOS
      );
      if (availableSlots <= 0) {
        showToast(
          language === 'ka'
            ? `მაქსიმუმ ${MAX_LISTING_PHOTOS} ფოტოს დამატებაა შესაძლებელი.`
            : `Maximum ${MAX_LISTING_PHOTOS} photos allowed per listing.`,
          'warning'
        );
        return;
      }

      if (target.resizedDataUri) {
        await executeSinglePhotoUpload(taskId, target.resizedDataUri);
        return;
      }

      if (target.file) {
        updatePhotoTask(taskId, t => ({
          ...t,
          status: 'resizing',
          progress: 15,
          errorMessage: undefined,
        }));
        try {
          const dataUri = await resizeImageFileToDataUri(target.file);
          await executeSinglePhotoUpload(taskId, dataUri);
        } catch (err: any) {
          updatePhotoTask(taskId, t => ({
            ...t,
            status: 'error',
            progress: 0,
            errorMessage:
              err?.message ||
              (language === 'ka'
                ? 'ფოტოს დამუშავება ვერ მოხერხდა.'
                : 'Failed to process image.'),
          }));
        }
      }
    },
    [executeSinglePhotoUpload, formData.images, language, resizeImageFileToDataUri, showToast, updatePhotoTask]
  );

  const handleDismissPhotoTask = useCallback((taskId: string) => {
    setPhotoUploadTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const isUrlProtectedByListing = useCallback(
    (candidateUrl: string): boolean => {
      const trimmed = candidateUrl.trim();
      if (!trimmed) return true;
      if (editingListing) {
        if (editingListing.image?.trim() === trimmed) return true;
        if (Array.isArray(editingListing.images) && editingListing.images.some(u => u?.trim() === trimmed)) {
          return true;
        }
      }
      return listings.some(item => {
        if (!item) return false;
        if (item.image?.trim() === trimmed) return true;
        return Array.isArray(item.images) && item.images.some(u => u?.trim() === trimmed);
      });
    },
    [editingListing, listings]
  );

  // Authoritative Firestore reference check across all listings of seller (fail-closed: returns null on query error)
  const fetchSellerProtectedPhotoUrls = useCallback(
    async (sellerUid: string): Promise<Set<string> | null> => {
      try {
        const snap = await getDocs(
          query(collection(db, 'listings'), where('sellerId', '==', sellerUid))
        );
        const protectedUrls = new Set<string>();
        snap.forEach(d => {
          const data = d.data();
          if (typeof data?.image === 'string' && data.image.trim()) {
            protectedUrls.add(data.image.trim());
          }
          if (Array.isArray(data?.images)) {
            for (const img of data.images) {
              if (typeof img === 'string' && img.trim()) {
                protectedUrls.add(img.trim());
              }
            }
          }
        });
        if (editingListing) {
          if (editingListing.image?.trim()) protectedUrls.add(editingListing.image.trim());
          if (Array.isArray(editingListing.images)) {
            for (const img of editingListing.images) {
              if (typeof img === 'string' && img.trim()) protectedUrls.add(img.trim());
            }
          }
        }
        return protectedUrls;
      } catch (err) {
        console.warn('[MarketHub] Cross-listing Storage reference check failed; preserving files safely:', err);
        return null;
      }
    },
    [editingListing]
  );

  const handleRemovePhotoAt = useCallback(
    (index: number) => {
      const targetUrl = (formData.images || [])[index];
      setFormData(prev => ({
        ...prev,
        images: removePhotoAtIndex(prev.images || [], index),
      }));

      const activeUid = user?.uid;
      if (
        targetUrl &&
        activeUid &&
        sessionUploadedUrlsRef.current.has(targetUrl) &&
        !isUrlProtectedByListing(targetUrl)
      ) {
        sessionUploadedUrlsRef.current.delete(targetUrl);
        void (async () => {
          const protectedUrls = await fetchSellerProtectedPhotoUrls(activeUid);
          if (!protectedUrls) return; // Fail-safe: do not delete if Firestore check failed
          if (protectedUrls.has(targetUrl.trim())) return;
          await deleteListingImagesFromStorage([targetUrl], activeUid);
        })().catch(err => {
          console.warn('[MarketHub] Non-blocking orphan photo cleanup notice:', err);
        });
      }
    },
    [fetchSellerProtectedPhotoUrls, formData.images, isUrlProtectedByListing, user?.uid]
  );

  const handleSetPrimaryPhoto = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      images: setPrimaryPhotoAtIndex(prev.images || [], index),
    }));
  }, []);

  const handleReorderPhotos = useCallback((fromIndex: number, toIndex: number) => {
    setFormData(prev => ({
      ...prev,
      images: reorderPhotosByIndex(prev.images || [], fromIndex, toIndex),
    }));
  }, []);

  const handleAddPhotoUrl = useCallback(
    (rawUrl: string): boolean => {
      const check = validateExternalPhotoUrl(rawUrl, formData.images || [], MAX_LISTING_PHOTOS);
      if (!check.valid || !check.normalizedUrl) {
        const msg =
          check.reason === 'limit_reached'
            ? language === 'ka'
              ? `მაქსიმუმ ${MAX_LISTING_PHOTOS} ფოტოს დამატებაა შესაძლებელი.`
              : `Maximum ${MAX_LISTING_PHOTOS} photos allowed per listing.`
            : check.reason === 'duplicate'
            ? language === 'ka'
              ? 'ეს ფოტო უკვე დამატებულია.'
              : 'This photo is already added.'
            : language === 'ka'
            ? 'გთხოვთ შეიყვანოთ სწორი http:// ან https:// სურათის ბმული.'
            : 'Please enter a valid http:// or https:// image URL.';
        showToast(msg, 'warning');
        return false;
      }

      if (user?.uid) {
        const securityCheck = validateListingImageUrl(check.normalizedUrl, user.uid);
        if (!securityCheck.isAllowed) {
          const msg =
            securityCheck.reason === 'ownership_mismatch'
              ? language === 'ka'
                ? 'სხვა მომხმარებლის პირადი სურათის გამოყენება დაუშვებელია.'
                : 'Using images belonging to other users is not permitted.'
              : securityCheck.reason === 'not_a_listing_path'
              ? language === 'ka'
                ? 'ავატარის ან ვიდეოს მისამართის გამოყენება განცხადების სურათად დაუშვებელია.'
                : 'Avatar or video storage paths cannot be used as listing images.'
              : language === 'ka'
              ? 'სურათის მისამართი დაუშვებელია.'
              : 'Invalid or unauthorized image URL.';
          showToast(msg, 'error');
          return false;
        }
      }

      setFormData(prev => ({
        ...prev,
        images: appendUploadedPhotoUrl(prev.images || [], check.normalizedUrl!, MAX_LISTING_PHOTOS),
      }));
      return true;
    },
    [formData.images, language, showToast, user?.uid]
  );

  const handleDiscardSessionPhotos = useCallback(
    async (explicitUrls?: string[]) => {
      const activeUid = user?.uid;
      if (!activeUid) {
        sessionUploadedUrlsRef.current.clear();
        return;
      }
      const candidates = Array.from(
        new Set([...Array.from(sessionUploadedUrlsRef.current), ...(explicitUrls || [])])
      )
        .map(url => url.trim())
        .filter(Boolean)
        .filter(url => !isUrlProtectedByListing(url));

      sessionUploadedUrlsRef.current.clear();
      if (candidates.length === 0) return;

      const protectedUrls = await fetchSellerProtectedPhotoUrls(activeUid);
      if (!protectedUrls) {
        // Fail-safe: preserve Storage files if authoritative Firestore verification failed
        return;
      }
      const safeCandidates = candidates.filter(url => !protectedUrls.has(url));
      if (safeCandidates.length > 0) {
        try {
          await deleteListingImagesFromStorage(safeCandidates, activeUid);
        } catch (err) {
          console.warn('[MarketHub] Non-blocking discarded draft photo cleanup notice:', err);
        }
      }
    },
    [fetchSellerProtectedPhotoUrls, isUrlProtectedByListing, user?.uid]
  );

  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const getFallbackTemplate = (title: string, category: string) => {
    const schema = getCategoryFormSchema(formData.listingType, category);
    const isKa = language === 'ka';
    const specLines = schema.fields.slice(0, 4).map(field => `- ${isKa ? field.labelKa : field.labelEn}:`);
    const lines = specLines.length > 0
      ? specLines.join('\n')
      : (isKa ? '- ძირითადი პარამეტრები:\n- პირობები:' : '- Key Details:\n- Terms:');

    return isKa
      ? `${title} (${getCategoryLabel(category, t, language)})\n\n[ძირითადი მახასიათებლები]\n${lines}\n\n[მიმოხილვა]\nდამატებითი დეტალები და პირობები.`
      : `${title} (${getCategoryLabel(category, t, language)})\n\n[Key Details]\n${lines}\n\n[Overview]\nAdditional details and terms.`;
  };

  const handleAiDescription = async () => {
    const titleForAi = (language === 'ka'
      ? (formData.titleGe || formData.title)
      : (formData.title || formData.titleGe) || '').trim();
    if (!titleForAi) {
      showToast(language === 'ka' ? "გთხოვთ შეიყვანოთ სათაური" : "Please enter a title first", 'warning');
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
    isGeneratingRef.current = true;
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
            showToast(language === 'ka' 
              ? `გთხოვთ დაიცადოთ ${waitTime} წუთი შემდეგი გენერაციისთვის.` 
              : `Please wait ${waitTime} minutes before using AI again.`,
              'warning'
            );
            
            // Provide fallback if requested
            if (window.confirm(language === 'ka' ? "გსურთ გამოიყენოთ სტანდარტული შაბლონი?" : "Would you like to use a standard template instead?")) {
              const template = getFallbackTemplate(titleForAi, formData.category);
              if (!controller.signal.aborted) {
                setFormData(prev => ({ ...prev, description: template }));
              }
            }
            return;
          }
        }
      }

      // 2. Check Cache
      const specId = `${titleForAi}_${formData.category}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
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
      const spec = await generateTechSpec(titleForAi, formData.category);
      if (controller.signal.aborted) return;
      if (spec) {
        // 4. Save to Cache
        await setDoc(cacheRef, {
          spec,
          title: titleForAi,
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
      showToast(language === 'ka' ? "AI-სთან კავშირი ვერ მოხერხდა. გამოიყენეთ შაბლონი." : "AI service unavailable. Falling back to template.", 'error');
      const template = getFallbackTemplate(titleForAi, formData.category);
      if (!controller.signal.aborted) {
        setFormData(prev => ({ ...prev, description: template }));
      }
    } finally {
      if (aiAbortControllerRef.current === controller) {
        aiAbortControllerRef.current = null;
      }
      setIsAiGenerating(false);
      isGeneratingRef.current = false;
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
    if (formStep !== 4) {
      return;
    }
    if (!user) {
      showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია განცხადების დასადებად" : "Please log in to post a listing.", 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (viewMode !== 'edit') {
        const canPost = await checkRateLimit();
        if (!canPost) {
          showToast(language === 'ka' ? "გთხოვთ დაიცადოთ. თქვენ ძალიან ბევრ განცხადებას დებთ." : "Rate limit exceeded. Please wait a minute before posting more.", 'warning');
          setIsSubmitting(false);
          return;
        }
      }

      // Step 1 validation: Multilingual Title Logic
      const rawTitleEn = (formData.title || '').trim();
      const rawTitleGe = (formData.titleGe || '').trim();

      if (!rawTitleEn && !rawTitleGe) {
        showToast(
          language === 'ka' 
            ? "გთხოვთ შეავსოთ განცხადების სათაური." 
            : "Please enter a listing title.", 
          'warning'
        );
        setFormStep(1);
        setIsSubmitting(false);
        return;
      }

      // Determine active primary language
      let effectivePrimaryLang: 'ka' | 'en' = formData.primaryLanguage || (language === 'ka' ? 'ka' : 'en');
      if (effectivePrimaryLang === 'ka' && !rawTitleGe && rawTitleEn) {
        effectivePrimaryLang = 'en';
      } else if (effectivePrimaryLang === 'en' && !rawTitleEn && rawTitleGe) {
        effectivePrimaryLang = 'ka';
      }

      const primaryTitle = effectivePrimaryLang === 'ka' ? rawTitleGe : rawTitleEn;
      if (!primaryTitle) {
        showToast(
          language === 'ka'
            ? `გთხოვთ შეავსოთ სათაური ძირითად ენაზე (${effectivePrimaryLang === 'ka' ? 'ქართულად' : 'ინგლისურად'}).`
            : `Please enter a title in the primary language (${effectivePrimaryLang === 'ka' ? 'Georgian' : 'English'}).`,
          'warning'
        );
        setFormStep(1);
        setIsSubmitting(false);
        return;
      }

      // Preserve authentic seller inputs without auto-generating fake translations.
      // Firestore requires `title` in hasAll(['title', ...]). Set `title` to authoritative primaryTitle.
      const finalTitleGe = rawTitleGe;
      const finalTitleEn = rawTitleEn;
      const resolvedFirestoreTitle = primaryTitle;

      const isEdit = viewMode === 'edit' && Boolean(editingListing);
      const resolvedListingType = inferListingType(formData.category, formData.listingType);
      const resolvedCategory = (isEdit && formData.category)
        ? formData.category
        : (isCategoryValidForType(formData.category, resolvedListingType)
            ? formData.category
            : getDefaultCategoryForType(resolvedListingType));
      const activeSchema = getCategoryFormSchema(resolvedListingType, resolvedCategory);

      // Step 2 validation: Price & Category-Specific Dynamic Attributes
      const priceStr = String(formData.price || '').trim().replace(',', '.');
      const parsedPrice = parseFloat(priceStr);
      if (!priceStr || isNaN(parsedPrice) || parsedPrice <= 0) {
        showToast(language === 'ka' 
          ? "გთხოვთ შეიყვანოთ სწორი ფასი (მხოლოდ დადებითი რიცხვები)." 
          : "Please enter a valid price (positive numbers only).",
          'warning'
        );
        setFormStep(2);
        setIsSubmitting(false);
        return;
      }

      const attrCheck = validateSchemaAttributes(activeSchema, formData.attributes, language);
      if (!attrCheck.valid) {
        showToast(
          attrCheck.firstErrorMessage || (language === 'ka' ? 'გთხოვთ შეავსოთ კატეგორიის სავალდებულო ველები.' : 'Please complete required category fields.'),
          'warning'
        );
        setFormStep(2);
        setIsSubmitting(false);
        return;
      }

      // Step 3 validation: Country and City (remote-aware)
      const effectiveIsRemote =
        activeSchema.locationMode === 'remote' ||
        (activeSchema.locationMode === 'flexible' && Boolean(formData.isRemote));
      const countryStr = (formData.country || '').trim();
      const cityStr = (formData.city || '').trim();
      const hasRealCity = Boolean(cityStr && cityStr.toLowerCase() !== 'online');
      let finalCountry = countryStr;
      let finalCity = cityStr;
      let finalLocation = (formData.location || '').trim();

      if (effectiveIsRemote) {
        if (!hasRealCity) {
          finalCountry = 'GLOBAL';
          finalCity = 'Online';
          finalLocation = finalLocation || 'Online / Remote';
        } else {
          finalCountry = countryStr || 'GLOBAL';
          finalCity = cityStr;
          finalLocation = finalLocation || `${cityStr}, ${finalCountry}`;
        }
      } else {
        if (!countryStr || !cityStr) {
          showToast(language === 'ka' 
            ? "გთხოვთ შეავსოთ ქვეყანა და ქალაქი." 
            : "Please select a country and enter a city.",
            'warning'
          );
          setFormStep(3);
          setIsSubmitting(false);
          return;
        }
        finalLocation = finalLocation || `${cityStr}, ${countryStr}`;
      }

      // Step 3 validation: Description
      if (!formData.description.trim()) {
        showToast(language === 'ka' ? "გთხოვთ შეავსოთ განცხადების აღწერა." : "Please fill in the listing description.", 'warning');
        setFormStep(3);
        setIsSubmitting(false);
        return;
      }

      // Safe coordinate assignment (Preserve legacy remote coordinates only when editing a legacy listing with city, never leak stale pins on new/switched remote listings)
      const preserveLegacyRemoteCoords =
        effectiveIsRemote && activeSchema.locationMode === 'remote' && isEdit && hasRealCity;
      const sanitizedLat =
        effectiveIsRemote && !preserveLegacyRemoteCoords
          ? null
          : ((typeof formData.lat === 'number' && !isNaN(formData.lat)) ? formData.lat : null);
      const sanitizedLng =
        effectiveIsRemote && !preserveLegacyRemoteCoords
          ? null
          : ((typeof formData.lng === 'number' && !isNaN(formData.lng)) ? formData.lng : null);

      if (photoUploadTasksRef.current.some(t => t.status === 'resizing' || t.status === 'uploading')) {
        showToast(
          language === 'ka'
            ? "გთხოვთ დაელოდოთ ფოტოების ატვირთვის დასრულებას."
            : "Please wait for active photo uploads to finish.",
          'warning'
        );
        setFormStep(3);
        setIsSubmitting(false);
        return;
      }

      // Upload any stray local base64 images to Storage first to ensure HTTPS URLs in Firestore
      let finalImages = normalizePhotoUrlList(formData.images || [], MAX_LISTING_PHOTOS);
      if (finalImages.length > 0) {
        try {
          const uploadPromises = finalImages.map(async (img, idx) => {
            if (typeof img === 'string' && img.startsWith('data:image/')) {
              const uploadedUrl = await uploadProductImage(user.uid, img, `prod_${Date.now()}_${idx}`);
              return uploadedUrl;
            }
            return img;
          });
          finalImages = normalizePhotoUrlList(await Promise.all(uploadPromises), MAX_LISTING_PHOTOS);
        } catch (uploadErr: any) {
          console.error("[MarketHub] Storage upload error:", uploadErr);
          const rawMessage = uploadErr?.message || '';
          let userMessage = language === 'ka'
            ? "ფოტოს ატვირთვა ვერ მოხერხდა."
            : "Failed to upload images.";
            
          if (rawMessage.toLowerCase().includes('supabase_service_role_key') || uploadErr?.statusCode === 503) {
            userMessage = language === 'ka'
              ? "სერვერის კონფიგურაციის შეცდომა: სერვერზე SUPABASE_SERVICE_ROLE_KEY არ არის მითითებული."
              : "Server configuration notice: SUPABASE_SERVICE_ROLE_KEY is required on the server.";
          } else if (rawMessage.toLowerCase().includes('unauthorized') || uploadErr?.statusCode === 401) {
            const serverDetail = uploadErr?.reason || uploadErr?.details || '';
            const detailSuffix = serverDetail ? ` (${serverDetail})` : '';
            userMessage = language === 'ka'
              ? `სესიის დადასტურება ვერ მოხერხდა${detailSuffix}. სცადეთ გვერდის განახლება ან ხელახლა შესვლა.`
              : `Could not verify your session${detailSuffix}. Try refreshing the page or signing in again.`;
          } else if (rawMessage.toLowerCase().includes('html document') || rawMessage.toLowerCase().includes('not valid json')) {
            userMessage = language === 'ka'
              ? "სერვერთან კავშირის შეცდომა. გთხოვთ სცადოთ თავიდან."
              : "Server connection error. Please try again.";
          } else if (rawMessage.toLowerCase().includes('timed out')) {
            userMessage = language === 'ka'
              ? "ფოტოს ატვირთვას ძალიან დიდი დრო დასჭირდა. შეამოწმეთ ინტერნეტი და სცადეთ თავიდან."
              : "Image upload timed out. Please check your connection and try again.";
          } else if (rawMessage) {
            userMessage += ` (${rawMessage})`;
          }

          showToast(userMessage, 'error');
          setIsSubmitting(false);
          return;
        }

        // Safety guard: ensure no raw base64 data URLs leak into Firestore
        const hasUnuploadedBase64 = finalImages.some(img => typeof img === 'string' && img.startsWith('data:image/'));
        if (hasUnuploadedBase64) {
          showToast(
            language === 'ka'
              ? "ფოტოს დამუშავება ვერ მოხერხდა. გთხოვთ სცადოთ თავიდან."
              : "Image upload could not be verified. Please try again.",
            'error'
          );
          setIsSubmitting(false);
          return;
        }

        // Security guard: verify that all image URLs are safe (either owned by the seller or legitimate external URLs)
        for (const img of finalImages) {
          if (typeof img === 'string' && img.trim()) {
            const check = validateListingImageUrl(img, user.uid);
            if (!check.isAllowed) {
              const errorMessage = check.reason === 'ownership_mismatch'
                ? (language === 'ka' 
                    ? "სხვა მომხმარებლის პირადი სურათის გამოყენება დაუშვებელია." 
                    : "Using images belonging to other users is not permitted.")
                : check.reason === 'not_a_listing_path'
                ? (language === 'ka'
                    ? "ავატარის ან ვიდეოს მისამართის გამოყენება განცხადების სურათად დაუშვებელია."
                    : "Using avatar or video storage paths as listing images is not permitted.")
                : (language === 'ka'
                    ? "სურათის მისამართი დაუშვებელია ან არასწორია."
                    : "Invalid or unauthorized image URL.");
              showToast(errorMessage, 'error');
              setIsSubmitting(false);
              return;
            }
          }
        }
      }

      const sanitizedAttributes = sanitizeListingAttributes(
        resolvedListingType,
        resolvedCategory,
        formData.attributes
      );

      const latestEditingListing = isEdit && editingListing
        ? (listings.find(l => l.id === editingListing.id) || editingListing)
        : null;
      const resolvedListingStatus = isEdit && latestEditingListing
        ? resolvePreservedListingStatus(latestEditingListing)
        : 'active';

      const { image: primaryListingImage, images: normalizedGalleryImages } =
        resolveListingPrimaryAndGalleryImages(finalImages, MAX_LISTING_PHOTOS);

      const listingData = {
        title: resolvedFirestoreTitle,
        titleGe: finalTitleGe,
        titleEn: finalTitleEn,
        primaryLanguage: effectivePrimaryLang,
        description: formData.description.trim(),
        descriptionGe: formData.description.trim(),
        price: parsedPrice,
        currency: formData.currency || 'USD',
        sellerId: (isEdit && editingListing) ? editingListing.sellerId : user.uid,
        sellerName: (isEdit && editingListing) ? (editingListing.sellerName || 'Unknown') : (user.displayName || user.email?.split('@')[0] || 'Unknown'),
        category: resolvedCategory,
        location: finalLocation,
        country: finalCountry,
        city: finalCity,
        image: primaryListingImage,
        images: normalizedGalleryImages,
        createdAt: serverTimestamp(),
        status: resolvedListingStatus,
        lat: sanitizedLat,
        lng: sanitizedLng,
        condition: activeSchema.showCondition ? (formData.condition || 'new') : '',
        isNegotiable: formData.isNegotiable ?? false,
        listingType: resolvedListingType,
        isRemote: effectiveIsRemote,
        attributes: sanitizedAttributes,
        serviceDuration: activeSchema.showServiceTerms ? (formData.serviceDuration || '') : '',
        serviceTerms: activeSchema.showServiceTerms ? (formData.serviceTerms || '') : ''
      };

      const savedTitle = primaryTitle;

      if (isEdit && editingListing) {
        // Collect original images before update to detect removed images
        const originalImages = Array.from(new Set([
          ...(editingListing.image ? [editingListing.image] : []),
          ...(Array.isArray(editingListing.images) ? editingListing.images : [])
        ].filter((img): img is string => typeof img === 'string' && Boolean(img.trim()))));

        // Images retained or newly added in this edit
        const currentImages = Array.from(new Set([
          ...(listingData.image ? [listingData.image] : []),
          ...(Array.isArray(listingData.images) ? listingData.images : [])
        ].filter((img): img is string => typeof img === 'string' && Boolean(img.trim()))));

        // Identify images explicitly removed from this listing
        const removedImages = originalImages.filter(orig => !currentImages.includes(orig));

        // Remove createdAt from updates to keep it immutable
        const { createdAt, ...updateData } = listingData;
        await updateDoc(doc(db, 'listings', editingListing.id), updateData);

        // If updateDoc succeeds, clean up removed images if they are not referenced by other listings
        if (removedImages.length > 0 && user?.uid) {
          try {
            // Verify if any removed image is still referenced by another listing owned by this seller
            const otherListingsQuery = query(
              collection(db, 'listings'),
              where('sellerId', '==', user.uid)
            );
            const otherSnap = await getDocs(otherListingsQuery);
            const otherReferencedUrls = new Set<string>();
            otherSnap.forEach(d => {
              if (d.id !== editingListing.id) {
                const otherData = d.data();
                if (typeof otherData?.image === 'string' && otherData.image) {
                  otherReferencedUrls.add(otherData.image.trim());
                }
                if (Array.isArray(otherData?.images)) {
                  for (const img of otherData.images) {
                    if (typeof img === 'string' && img) {
                      otherReferencedUrls.add(img.trim());
                    }
                  }
                }
              }
            });

            const safeRemovedImages = removedImages.filter(img => !otherReferencedUrls.has(img.trim()));
            if (safeRemovedImages.length > 0) {
              await deleteListingImagesFromStorage(safeRemovedImages, user.uid);
            }
          } catch (storageCleanupErr) {
            console.warn("[MarketHub] Non-blocking storage cleanup notice during image replacement:", storageCleanupErr);
          }
        }
      } else {
        if (!pendingCreateListingIdRef.current) {
          pendingCreateListingIdRef.current = generateClientListingId();
        }
        const createdListing = await publishListing({
          id: pendingCreateListingIdRef.current,
          title: resolvedFirestoreTitle,
          titleGe: finalTitleGe,
          titleEn: finalTitleEn,
          primaryLanguage: effectivePrimaryLang,
          description: formData.description.trim(),
          descriptionGe: formData.description.trim(),
          price: parsedPrice,
          currency: formData.currency || 'USD',
          sellerName: user.displayName || user.email?.split('@')[0] || 'Unknown',
          image: primaryListingImage,
          images: normalizedGalleryImages,
          category: resolvedCategory,
          listingType: resolvedListingType,
          condition: activeSchema.showCondition ? (formData.condition || 'new') : '',
          isNegotiable: formData.isNegotiable ?? false,
          isRemote: effectiveIsRemote,
          location: finalLocation,
          country: finalCountry,
          city: finalCity,
          lat: sanitizedLat,
          lng: sanitizedLng,
          attributes: sanitizedAttributes,
          serviceDuration: activeSchema.showServiceTerms ? (formData.serviceDuration || '') : '',
          serviceTerms: activeSchema.showServiceTerms ? (formData.serviceTerms || '') : '',
        });
        pendingCreateListingIdRef.current = null;
        setListings(prev => [createdListing, ...prev.filter(l => l.id !== createdListing.id)]);
      }

      if (!isEdit) {
        clearUnifiedListingDraft(user.uid);
      }
      setViewMode('browse');
      resetListingForm();
      setPublishSuccessModal({
        title: savedTitle,
        isEdit
      });
    } catch (error: any) {
      console.error("[MarketHub] Failed to save listing:", error);
      showToast(formatPublishListingErrorMessage(error, language), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (window.confirm(t.market.delete_confirm)) {
      try {
        // Step 1: Read authoritative listing data before deleting its Firestore document
        const listingDocRef = doc(db, 'listings', id);
        const listingSnap = await getDoc(listingDocRef);

        let candidateImages: string[] = [];
        let sellerId = user?.uid;

        if (listingSnap.exists()) {
          const data = listingSnap.data();
          sellerId = data?.sellerId || sellerId;
          const imgList: string[] = [];
          if (typeof data?.image === 'string' && data.image) {
            imgList.push(data.image.trim());
          }
          if (Array.isArray(data?.images)) {
            for (const img of data.images) {
              if (typeof img === 'string' && img) {
                imgList.push(img.trim());
              }
            }
          }
          candidateImages = Array.from(new Set(imgList.filter(Boolean)));
        }

        // Step 2: Check whether any candidate image is still referenced by another listing of this seller
        let safeImagesToDelete: string[] = [];
        if (candidateImages.length > 0 && sellerId) {
          try {
            const otherListingsQuery = query(
              collection(db, 'listings'),
              where('sellerId', '==', sellerId)
            );
            const otherSnap = await getDocs(otherListingsQuery);
            const otherReferencedUrls = new Set<string>();
            otherSnap.forEach(d => {
              if (d.id !== id) {
                const otherData = d.data();
                if (typeof otherData?.image === 'string' && otherData.image) {
                  otherReferencedUrls.add(otherData.image.trim());
                }
                if (Array.isArray(otherData?.images)) {
                  for (const img of otherData.images) {
                    if (typeof img === 'string' && img) {
                      otherReferencedUrls.add(img.trim());
                    }
                  }
                }
              }
            });

            // Filter out any image that is still referenced by another listing
            safeImagesToDelete = candidateImages.filter(img => !otherReferencedUrls.has(img.trim()));
          } catch (queryErr) {
            console.warn("[MarketHub] Could not verify cross-listing references, preserving images:", queryErr);
            // Safety guard: Prefer preserving potentially orphaned files over deleting an image active listings still need
            safeImagesToDelete = [];
          }
        }

        // Step 3: Delete the Firestore listing document first
        await deleteDoc(listingDocRef);

        // Step 4: Delete confirmed safe Storage objects
        let cleanupNotice: string | null = null;
        if (safeImagesToDelete.length > 0 && user?.uid && user.uid === sellerId) {
          try {
            const cleanupResult = await deleteListingImagesFromStorage(safeImagesToDelete, user.uid);
            if (cleanupResult.failed > 0) {
              cleanupNotice = language === 'ka'
                ? 'განცხადება წაიშალა, მაგრამ ზოგიერთი ფოტოს მეხსიერებიდან წაშლა ვერ მოხერხდა.'
                : 'Listing deleted, but some images could not be cleaned up from storage.';
            }
          } catch (storageErr) {
            console.warn("[MarketHub] Non-blocking storage cleanup notice:", storageErr);
            cleanupNotice = language === 'ka'
              ? 'განცხადება წაიშალა, მაგრამ ფოტოების მეხსიერებიდან გასუფთავება ვერ მოხერხდა.'
              : 'Listing deleted, but image cleanup encountered an error.';
          }
        }

        // Step 5: Truthful UI feedback
        if (cleanupNotice) {
          showToast(cleanupNotice, 'warning');
        } else {
          showToast(
            language === 'ka' 
              ? 'განცხადება წარმატებით წაიშალა.' 
              : 'Listing deleted successfully.', 
            'success'
          );
        }
      } catch (error) {
        console.error("Error deleting listing:", error);
        showToast(
          language === 'ka' 
            ? 'განცხადების წაშლა ვერ მოხერხდა.' 
            : 'Could not delete listing.', 
          'error'
        );
      }
    }
  };

  const startEdit = (listing: Listing) => {
    pendingCreateListingIdRef.current = null;
    setEditingListing(listing);

    // Detect primary language and preserve genuine title inputs
    const isGeorgianText = (str: string) => /[\u10A0-\u10FF]/.test(str);
    const rawTitle = (listing.title || '').trim();
    const rawTitleGe = (listing.titleGe || '').trim();
    const rawTitleEn = ((listing as any).titleEn || '').trim();

    let primaryLang: 'ka' | 'en' = listing.primaryLanguage === 'ka' || listing.primaryLanguage === 'en'
      ? listing.primaryLanguage
      : (rawTitleGe && !rawTitle && !rawTitleEn ? 'ka' : isGeorgianText(rawTitle) ? 'ka' : 'en');

    // Handle legacy listings where title and titleGe were duplicated:
    let editTitleEn = rawTitleEn;
    let editTitleGe = rawTitleGe;

    if (!editTitleEn && !editTitleGe) {
      if (primaryLang === 'ka') {
        editTitleGe = rawTitle;
        editTitleEn = '';
      } else {
        editTitleEn = rawTitle;
        editTitleGe = '';
      }
    } else if (rawTitle && rawTitle === rawTitleGe && !rawTitleEn) {
      // Legacy duplication: only one language was entered originally
      if (isGeorgianText(rawTitle)) {
        editTitleGe = rawTitle;
        editTitleEn = '';
        primaryLang = 'ka';
      } else {
        editTitleEn = rawTitle;
        editTitleGe = '';
        primaryLang = 'en';
      }
    } else {
      if (!editTitleEn && primaryLang === 'en' && rawTitle && rawTitle !== rawTitleGe) {
        editTitleEn = rawTitle;
      }
      if (!editTitleGe && primaryLang === 'ka' && rawTitle && rawTitle !== rawTitleEn) {
        editTitleGe = rawTitle;
      }
    }

    const editListingType = inferListingType(listing.category, listing.listingType);
    const editSchema = getCategoryFormSchema(editListingType, listing.category);
    const inferredRemote =
      editSchema.locationMode === 'remote'
        ? true
        : editSchema.locationMode === 'flexible'
        ? (typeof listing.isRemote === 'boolean'
            ? listing.isRemote
            : ((listing.country || '').trim().toUpperCase() === 'GLOBAL' &&
              (listing.city || '').trim().toLowerCase() === 'online'))
        : false;

    setFormStep(1);
    setPhotoUploadTasks([]);
    sessionUploadedUrlsRef.current.clear();

    const normalizedEditImages = normalizePhotoUrlList(
      [
        ...(Array.isArray(listing.images) ? listing.images : []),
        ...(listing.image ? [listing.image] : []),
      ],
      MAX_LISTING_PHOTOS
    );

    setFormData({
      title: editTitleEn,
      titleGe: editTitleGe,
      primaryLanguage: primaryLang,
      description: listing.description || listing.descriptionGe || '',
      descriptionGe: listing.descriptionGe || '',
      price: listing.price.toString(),
      currency: listing.currency || 'USD',
      category: listing.category,
      country: (listing as any).country || (inferredRemote ? 'GLOBAL' : 'GEO'),
      city: (listing as any).city || '',
      location: listing.location || '',
      images: normalizedEditImages,
      lat: listing.lat,
      lng: listing.lng,
      condition: listing.condition || 'new',
      isNegotiable: listing.isNegotiable || false,
      listingType: editListingType,
      isRemote: inferredRemote,
      attributes:
        listing.attributes && typeof listing.attributes === 'object'
          ? filterAttributesForSchema(editSchema, listing.attributes)
          : {},
      serviceDuration: listing.serviceDuration || '',
      serviceTerms: listing.serviceTerms || ''
    });
    setViewMode('edit');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (activeCategory !== 'all') count++;
    if (activeCountry !== 'GLOBAL') count++;
    if (activeCity !== '') count++;
    if (parsedMinPrice !== null) count++;
    if (parsedMaxPrice !== null) count++;
    if (activeListingType !== 'all') count++;
    return count;
  }, [activeCategory, activeCountry, activeCity, parsedMinPrice, parsedMaxPrice, activeListingType]);

  const handleSelectListingType = useCallback((nextType: 'all' | 'product' | 'service' | 'project') => {
    setActiveListingType(nextType);
    setActiveCategory(prev => (prev !== 'all' && !isCategoryValidForType(prev, nextType) ? 'all' : prev));
  }, []);

  // Unified Loading Spin Gate to completely seal Cold Boot hydration flickering
  if (authLoading) {
    return (
      <div className={cn("min-h-[600px] rounded-xl border border-proton-border flex flex-col items-center justify-center p-12 shadow-xl relative overflow-hidden", currentTheme.card)}>
        <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-proton-accent/[0.06] blur-[120px] pointer-events-none rounded-full" />
        <div className="flex flex-col items-center gap-5 relative z-10">
          <Loader2 className="w-12 h-12 animate-spin text-proton-accent opacity-85" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-proton-accent animate-pulse">
            {language === 'ka' ? 'ავტორიზაცია მოწმდება...' : 'Verifying Identity...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen bg-proton-bg text-proton-text relative flex flex-col w-full overflow-x-hidden p-0 m-0 md:pb-0",
        isAnyMarketOverlayOpen
          ? "pb-[env(safe-area-inset-bottom,0px)]"
          : "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
      )}
    >
      {/* Main Proton Header (PROTON // მარკეტი) */}
      <div className="w-full bg-proton-card/95 border-b border-proton-border pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-2 md:pt-[max(0.875rem,env(safe-area-inset-top,0px))] md:pb-3.5 px-3 sm:px-6 lg:px-8 flex flex-col gap-2 md:gap-3 sticky top-0 z-50 backdrop-blur-md">
        {/* Top bar layer */}
        <div className="w-full flex flex-nowrap items-center justify-between gap-1 sm:gap-3 lg:gap-4">
          
          {/* Logo element */}
          <div 
            onClick={() => { 
              if (activeBottomTab === 'messages') closeInlineMessages();
              else setActiveBottomTab('home');
              setViewMode('browse'); 
              setActiveCategory('all'); 
              setShowOnlyFavorites(false); 
            }} 
            className="flex items-center gap-2 cursor-pointer select-none grow-0 shrink-0"
          >
            <div className="flex items-center">
              <div className="bg-proton-bg border border-proton-border text-proton-text font-black px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-l-xl text-[11px] sm:text-sm tracking-tighter uppercase whitespace-nowrap flex items-center gap-1 sm:gap-1.5">
                <span className="text-proton-accent">PROTON</span>
                <span className="text-proton-muted/60 font-mono text-[10px] sm:text-[11px]">//</span>
              </div>
              <div className="bg-proton-card text-proton-accent border border-proton-border border-l-0 font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-r-xl text-[11px] sm:text-sm tracking-tighter uppercase whitespace-nowrap">
                {language === 'ka' ? 'მარკეტი' : 'market'}
              </div>
            </div>
          </div>

          {/* Desktop Primary Navigation: Browse | Seller Cabinet | My Orders */}
          <nav
            aria-label={language === 'ka' ? 'მარკეტის მთავარი ნავიგაცია' : 'Marketplace primary navigation'}
            className="hidden md:flex items-center bg-proton-bg border border-proton-border p-1 rounded-xl gap-1 shrink-0"
          >
            <button
              type="button"
              onClick={() => {
                if (activeBottomTab === 'messages') closeInlineMessages();
                else setActiveBottomTab('home');
                setShowOnlyFavorites(false);
                setViewMode('browse');
              }}
              className={cn(
                "px-2.5 lg:px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap",
                viewMode === 'browse' && activeBottomTab !== 'messages' && !showOnlyFavorites
                  ? "bg-proton-accent text-proton-on-accent font-black shadow-sm"
                  : "text-proton-muted hover:text-proton-text hover:bg-proton-card"
              )}
              title={language === 'ka' ? 'განცხადებების დათვალიერება' : 'Browse Marketplace'}
            >
              <LayoutGrid size={13} />
              <span>{language === 'ka' ? 'ბაზარი' : 'Browse'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია გამყიდველის კაბინეტის სანახავად." : "Please sign in to open Seller Cabinet.", 'warning');
                  onOpenAuthModal?.();
                  return;
                }
                if (activeBottomTab === 'messages') closeInlineMessages();
                else setActiveBottomTab('home');
                setViewMode('my-listings');
                setProfileSubMode('selling');
              }}
              className={cn(
                "px-2.5 lg:px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap relative",
                viewMode === 'my-listings' && profileSubMode === 'selling' && activeBottomTab !== 'messages'
                  ? "bg-proton-accent text-proton-on-accent font-black shadow-sm"
                  : "text-proton-muted hover:text-proton-text hover:bg-proton-card"
              )}
              title={language === 'ka' ? 'გამყიდველის კაბინეტი' : 'Seller Cabinet'}
            >
              <Store size={13} />
              <span className="xl:hidden">{language === 'ka' ? 'გაყიდვები' : 'Selling'}</span>
              <span className="hidden xl:inline">{language === 'ka' ? 'გამყიდველის კაბინეტი' : 'Seller Cabinet'}</span>
              {sellerOrderCounts.actionRequired > 0 && (
                <span className={cn(
                  "inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[9px] font-black leading-none rounded-full",
                  viewMode === 'my-listings' && profileSubMode === 'selling' && activeBottomTab !== 'messages'
                    ? "bg-black/20 text-proton-on-accent"
                    : "bg-amber-500 text-zinc-950"
                )}>
                  {sellerOrderCounts.actionRequired}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია შეკვეთების სანახავად." : "Please sign in to view your orders.", 'warning');
                  onOpenAuthModal?.();
                  return;
                }
                if (activeBottomTab === 'messages') closeInlineMessages();
                else setActiveBottomTab('home');
                setViewMode('my-listings');
                setProfileSubMode('buying');
              }}
              className={cn(
                "px-2.5 lg:px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap relative",
                viewMode === 'my-listings' && profileSubMode === 'buying' && activeBottomTab !== 'messages'
                  ? "bg-proton-accent text-proton-on-accent font-black shadow-sm"
                  : "text-proton-muted hover:text-proton-text hover:bg-proton-card"
              )}
              title={language === 'ka' ? 'ჩემი შეკვეთები' : 'My Orders'}
            >
              <Package size={13} />
              <span className="xl:hidden">{language === 'ka' ? 'შეკვეთები' : 'Orders'}</span>
              <span className="hidden xl:inline">{language === 'ka' ? 'ჩემი შეკვეთები' : 'My Orders'}</span>
              {buyerOrders.length > 0 && (
                <span className={cn(
                  "inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[9px] font-black leading-none rounded-full",
                  viewMode === 'my-listings' && profileSubMode === 'buying' && activeBottomTab !== 'messages'
                    ? "bg-black/20 text-proton-on-accent"
                    : "bg-proton-accent text-proton-on-accent"
                )}>
                  {buyerOrders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeBottomTab === 'messages') closeInlineMessages();
                else setActiveBottomTab('home');
                setShowOnlyFavorites(false);
                setViewMode('rankings');
              }}
              className={cn(
                "px-2.5 lg:px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap",
                viewMode === 'rankings' && activeBottomTab !== 'messages'
                  ? "bg-proton-accent text-proton-on-accent font-black shadow-sm"
                  : "text-proton-muted hover:text-proton-text hover:bg-proton-card"
              )}
              title={language === 'ka' ? 'რეიტინგები და მიღწევები' : 'Rankings & Achievements'}
            >
              <Trophy size={13} />
              <span>{language === 'ka' ? 'რეიტინგები' : 'Rankings'}</span>
            </button>
          </nav>

          {/* Desktop Search Bar Grouping */}
          <div className="hidden md:flex flex-1 min-w-[120px] max-w-md items-center gap-3">
            {/* Input search */}
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-70 text-proton-accent" />
              <input 
                type="text"
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                placeholder={language === 'ka' ? 'ჩაწერე საძიებო სიტყვა...' : 'Search listings, tags, vendors...'}
                className={cn("w-full font-bold tracking-wide pl-9 pr-7 py-2 rounded-xl text-base md:text-xs transition-all shadow-inner", currentTheme.input)}
              />
              {searchRaw && (
                <button 
                  onClick={() => { setSearch(''); setSearchRaw(''); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-proton-muted hover:text-proton-text font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Action buttons list (Utilities + Single Add Listing CTA) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Create Listing Button (Single canonical location on both Mobile & Desktop) */}
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია განცხადების დასადებად." : "Please sign in to create a listing.", 'warning');
                  onOpenAuthModal?.();
                  return;
                }
                if (activeBottomTab === 'messages') closeInlineMessages();
                else setActiveBottomTab('home');
                resetListingForm();
                setViewMode('create');
              }}
              className={cn("relative flex font-black px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs items-center justify-center gap-1 transition-all shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98] shrink-0 before:absolute before:-inset-y-2 before:-inset-x-1 sm:before:hidden", currentTheme.accentBg)}
              title={language === 'ka' ? 'განცხადების დამატება' : 'Create Listing'}
            >
              <Plus size={14} className="stroke-[3]" />
              <span className="md:hidden lg:inline">{language === 'ka' ? 'დამატება' : 'Add'}</span>
              <span className="hidden xl:inline">{language === 'ka' ? ' განცხადება' : ' Listing'}</span>
            </button>

            {/* Desktop Messages Button (Mobile accesses Messages via the unified 4-tab bar below) */}
            <button 
              type="button"
              onClick={() => {
                if (!user) {
                  showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია შეტყობინებების სანახავად." : "Please sign in to view your messages.", 'warning');
                  onOpenAuthModal?.();
                  return;
                }
                if (activeBottomTab === 'messages') {
                  closeInlineMessages();
                  setViewMode('browse');
                  return;
                }
                setViewMode('my-listings');
                setProfileSubMode('buying');
                setActiveBottomTab('messages');
              }}
              className={cn(
                "hidden md:flex p-2 sm:p-2.5 rounded-xl transition-all relative border cursor-pointer",
                activeBottomTab === 'messages'
                  ? "bg-proton-accent/15 text-proton-accent border-proton-accent/40 shadow-sm"
                  : "text-proton-muted hover:text-proton-accent hover:bg-proton-bg border-transparent"
              )}
              title={language === 'ka' ? 'შეტყობინებები' : 'Messages'}
              aria-pressed={activeBottomTab === 'messages'}
            >
              <Mail size={16} />
              {globalUnreadBadgeLabel && (
                <span
                  data-testid="desktop-messages-unread-badge"
                  className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 rounded-full text-[9px] font-black leading-none flex items-center justify-center text-white border border-proton-card tabular-nums"
                >
                  {globalUnreadBadgeLabel}
                </span>
              )}
            </button>

            {/* Favorites tab */}
            <button 
              type="button"
              onClick={() => {
                if (activeBottomTab === 'messages') closeInlineMessages();
                else setActiveBottomTab('home');
                setShowOnlyFavorites(!showOnlyFavorites);
                setViewMode('browse');
              }}
              className={cn(
                "relative p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer border flex items-center justify-center before:absolute before:-inset-2 sm:before:hidden",
                showOnlyFavorites 
                  ? "text-rose-500 bg-rose-500/10 border-rose-500/30" 
                  : "text-proton-muted hover:text-proton-accent hover:bg-proton-bg border-transparent"
              )}
              title={language === 'ka' ? 'რჩეულები' : 'Favorites'}
            >
              <Heart size={16} fill={showOnlyFavorites ? "currentColor" : "none"} />
              {favorites.length > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-proton-accent rounded-full text-[8px] font-black text-proton-on-accent flex items-center justify-center scale-90 border border-proton-card">
                  {favorites.length}
                </span>
              )}
            </button>

            {/* Shopping Cart button */}
            <button 
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 sm:p-2.5 text-proton-muted hover:text-proton-accent hover:bg-proton-bg rounded-xl transition-all cursor-pointer flex items-center justify-center before:absolute before:-inset-2 sm:before:hidden"
              title={language === 'ka' ? 'კალათა' : 'Shopping Cart'}
            >
              <ShoppingBag size={16} />
              {cart.length > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-proton-accent text-proton-on-accent rounded-full text-[8px] font-black flex items-center justify-center scale-90 border border-proton-card">
                  {cart.length}
                </span>
              )}
            </button>

            {/* Return Home escape button */}
            {onBack && (
              <button 
                type="button"
                onClick={onBack}
                className="relative p-2 md:px-3 md:py-2 bg-proton-bg hover:bg-proton-accent/10 border border-proton-border hover:border-proton-accent/40 text-proton-text hover:text-proton-accent font-black rounded-xl text-[10px] sm:text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] before:absolute before:-inset-2 sm:before:hidden"
                title={language === 'ka' ? 'მთავარზე დაბრუნება' : 'Return to Dashboard'}
              >
                <LayoutDashboard size={14} className="text-proton-accent" />
                <span className="hidden lg:inline">{language === 'ka' ? 'მთავარი' : 'Home'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Search Row (Shown only on mobile outside listing creation/editing wizard) */}
        {viewMode !== 'create' && viewMode !== 'edit' && (
          <div className="w-full md:hidden">
            <div className="w-full relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70 text-proton-accent" />
              <input 
                type="text"
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                placeholder={language === 'ka' ? 'ძებნა მარკეტში...' : 'Search marketplace...'}
                className={cn("w-full font-bold tracking-wide pl-9 pr-8 py-2 rounded-xl text-base md:text-xs transition-colors", currentTheme.input)}
              />
              {searchRaw && (
                <button 
                  type="button"
                  onClick={() => { setSearch(''); setSearchRaw(''); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-proton-muted hover:text-proton-text font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Unified Mobile Navigation Bar (Single non-duplicated 5-tab switcher, md:hidden; hidden during create/edit wizard) */}
        {viewMode !== 'create' && viewMode !== 'edit' && (
          <nav
            aria-label={language === 'ka' ? 'მობილური მარკეტის ნავიგაცია' : 'Mobile marketplace navigation'}
            className="w-full grid grid-cols-5 gap-1 md:hidden pt-1.5 border-t border-proton-border"
          >
          <button
            type="button"
            onClick={() => {
              if (activeBottomTab === 'messages') closeInlineMessages();
              else setActiveBottomTab('home');
              setShowOnlyFavorites(false);
              setViewMode('browse');
            }}
            className={cn(
              "px-1.5 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all border cursor-pointer relative",
              activeBottomTab === 'home' && viewMode === 'browse' && !showOnlyFavorites
                ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-sm font-black"
                : "bg-proton-bg text-proton-muted hover:text-proton-text border-proton-border hover:bg-proton-accent/10"
            )}
          >
            <LayoutGrid size={13} />
            <span className="truncate max-w-full">{language === 'ka' ? 'ბაზარი' : 'Browse'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!user) {
                showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია კაბინეტის სანახავად." : "Please sign in to open Seller Cabinet.", 'warning');
                onOpenAuthModal?.();
                return;
              }
              if (activeBottomTab === 'messages') closeInlineMessages();
              else setActiveBottomTab('home');
              setViewMode('my-listings');
              setProfileSubMode('selling');
            }}
            className={cn(
              "px-1.5 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all border cursor-pointer relative",
              viewMode === 'my-listings' && profileSubMode === 'selling' && activeBottomTab !== 'messages'
                ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-sm font-black"
                : "bg-proton-bg text-proton-muted hover:text-proton-text border-proton-border hover:bg-proton-accent/10"
            )}
          >
            <Store size={13} />
            <span className="truncate max-w-full">{language === 'ka' ? 'კაბინეტი' : 'Selling'}</span>
            {sellerOrderCounts.actionRequired > 0 && (
              <span className={cn(
                "absolute top-1 right-1.5 inline-flex items-center justify-center h-3.5 min-w-[14px] px-1 text-[8px] font-black leading-none rounded-full",
                viewMode === 'my-listings' && profileSubMode === 'selling' && activeBottomTab !== 'messages'
                  ? "bg-black/20 text-proton-on-accent"
                  : "bg-amber-500 text-zinc-950"
              )}>
                {sellerOrderCounts.actionRequired}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!user) {
                showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია შეკვეთების სანახავად." : "Please sign in to view your orders.", 'warning');
                onOpenAuthModal?.();
                return;
              }
              if (activeBottomTab === 'messages') closeInlineMessages();
              else setActiveBottomTab('home');
              setViewMode('my-listings');
              setProfileSubMode('buying');
            }}
            className={cn(
              "px-1.5 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all border cursor-pointer relative",
              viewMode === 'my-listings' && profileSubMode === 'buying' && activeBottomTab !== 'messages'
                ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-sm font-black"
                : "bg-proton-bg text-proton-muted hover:text-proton-text border-proton-border hover:bg-proton-accent/10"
            )}
          >
            <Package size={13} />
            <span className="truncate max-w-full">{language === 'ka' ? 'შეკვეთები' : 'Orders'}</span>
            {buyerOrders.length > 0 && (
              <span className={cn(
                "absolute top-1 right-1.5 inline-flex items-center justify-center h-3.5 min-w-[14px] px-1 text-[8px] font-black leading-none rounded-full",
                viewMode === 'my-listings' && profileSubMode === 'buying' && activeBottomTab !== 'messages'
                  ? "bg-black/20 text-proton-on-accent"
                  : "bg-proton-accent text-proton-on-accent"
              )}>
                {buyerOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!user) {
                showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია შეტყობინებების სანახავად." : "Please sign in to view your messages.", 'warning');
                onOpenAuthModal?.();
                return;
              }
              if (activeBottomTab === 'messages') {
                closeInlineMessages();
                setViewMode('browse');
                return;
              }
              setViewMode('my-listings');
              setActiveBottomTab('messages');
            }}
            className={cn(
              "px-1.5 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all border cursor-pointer relative",
              activeBottomTab === 'messages'
                ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-sm font-black"
                : "bg-proton-bg text-proton-muted hover:text-proton-text border-proton-border hover:bg-proton-accent/10"
            )}
          >
            <Mail size={13} />
            <span className="truncate max-w-full">{language === 'ka' ? 'ჩატი' : 'Messages'}</span>
            {globalUnreadBadgeLabel && (
              <span
                data-testid="mobile-messages-unread-badge"
                className={cn(
                  "absolute top-1 right-1.5 inline-flex items-center justify-center h-3.5 min-w-[14px] px-1 text-[8px] font-black leading-none rounded-full tabular-nums",
                  activeBottomTab === 'messages'
                    ? "bg-black/20 text-proton-on-accent"
                    : "bg-rose-500 text-white"
                )}
              >
                {globalUnreadBadgeLabel}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeBottomTab === 'messages') closeInlineMessages();
              else setActiveBottomTab('home');
              setShowOnlyFavorites(false);
              setViewMode('rankings');
            }}
            className={cn(
              "px-1 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all border cursor-pointer relative",
              viewMode === 'rankings' && activeBottomTab !== 'messages'
                ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-sm font-black"
                : "bg-proton-bg text-proton-muted hover:text-proton-text border-proton-border hover:bg-proton-accent/10"
            )}
          >
            <Trophy size={13} />
            <span className="truncate max-w-full">{language === 'ka' ? 'რეიტინგი' : 'Rankings'}</span>
          </button>
          </nav>
        )}
      </div>

      <div
        className={cn(
          "w-full max-w-[1680px] mx-auto grow relative",
          (viewMode === 'create' || viewMode === 'edit')
            ? "px-2.5 py-3 sm:p-6 lg:p-8"
            : "px-4 py-4 sm:p-6 lg:p-10",
          activeBottomTab === 'messages' && "md:py-4 lg:py-4"
        )}
      >
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "bg-transparent relative",
            activeBottomTab === 'messages' ? "space-y-4 md:space-y-4 pb-4 md:pb-4" : "space-y-5 md:space-y-10",
            activeBottomTab !== 'messages' && ((viewMode === 'create' || viewMode === 'edit') ? "pb-12 md:pb-16" : isAnyMarketOverlayOpen ? "pb-8 md:pb-16" : "pb-16 md:pb-16")
          )}
        >
      {/* Market Hub Header / Banner Section */}
      <div
        className={cn(
          "flex flex-col gap-3 md:gap-6 border-b border-proton-border",
          activeBottomTab === 'messages'
            ? "pb-3 md:pb-3"
            : viewMode === 'browse'
            ? "pb-3 md:pb-6"
            : "pb-4 md:pb-6"
        )}
      >
        {/* Row 1: Title & Status on left, Grid / Map Mode on right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-6 w-full">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {viewMode !== 'browse' && (
              <button 
                type="button"
                onClick={() => {
                  if (activeBottomTab === 'messages') closeInlineMessages();
                  else setActiveBottomTab('home');
                  setViewMode('browse');
                }}
                className="min-w-[44px] min-h-[44px] p-2.5 md:p-3 bg-proton-card rounded-xl hover:bg-proton-accent/10 transition-colors border border-proton-border hover:border-proton-accent/40 text-proton-muted hover:text-proton-text cursor-pointer flex items-center justify-center shrink-0"
                title={language === 'ka' ? 'მარკეტში დაბრუნება' : 'Back to Market'}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <h1 className={cn(
                "font-black tracking-tighter uppercase leading-none",
                activeBottomTab === 'messages'
                  ? "text-xl sm:text-2xl md:text-2xl mb-1"
                  : viewMode === 'browse'
                  ? "hidden md:block text-3xl md:text-4xl mb-1.5"
                  : "text-xl sm:text-3xl md:text-4xl mb-1.5",
                currentTheme.text
              )}>
                <span className={currentTheme.accent}>{t.market.title.split(' ')[0]}</span> {t.market.title.split(' ').slice(1).join(' ')}
              </h1>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md border", currentTheme.cardAlt)}>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className={cn(
                    (viewMode === 'create' || viewMode === 'edit')
                      ? "text-[11px] sm:text-xs font-bold tracking-normal"
                      : "font-black tracking-widest uppercase text-[8px]",
                    currentTheme.muted
                  )}>
                    {viewMode === 'browse' ? (language === 'ka' ? 'ონლაინ' : 'LIVE') : 
                     viewMode === 'rankings' ? (language === 'ka' ? 'რეიტინგები და მიღწევები' : 'Rankings & Achievements') :
                     viewMode === 'my-listings' && activeBottomTab === 'messages' ? (language === 'ka' ? 'შეტყობინებები' : 'Messages') :
                     viewMode === 'my-listings' ? t.market.my_listings :
                     viewMode === 'privacy' ? t.market.legal.privacy_policy :
                     viewMode === 'terms' ? t.market.legal.terms_of_service :
                     viewMode === 'create' ? t.market.create_listing : t.market.edit_listing}
                  </span>
                </div>
                {viewMode === 'browse' && (
                  <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-md border", currentTheme.cardAlt)} data-testid="header-listings-count-badge">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className={cn("font-black tracking-widest uppercase text-[8px] font-mono", currentTheme.muted)}>
                      {isFilteredMode
                        ? (language === 'ka'
                            ? `ნაპოვნი განცხადებები: ${filteredListings.length}`
                            : `Matching Listings: ${filteredListings.length}`)
                        : (language === 'ka'
                            ? `აქტიური განცხადებები: ${activeListingsCount}`
                            : `Active Listings: ${activeListingsCount}`)}
                    </span>
                  </div>
                )}
                {viewMode === 'my-listings' && activeBottomTab !== 'messages' && (
                  <div className={cn("flex items-center gap-1.5 p-0.5 rounded-lg border", currentTheme.cardAlt)}>
                    <button 
                      onClick={() => setProfileSubMode('selling')}
                      className={cn(
                        "px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        profileSubMode === 'selling' ? cn(currentTheme.badgeBg, "shadow-sm") : cn(currentTheme.muted, "hover:text-proton-text")
                      )}
                    >
                      {t.market.selling_mode}
                    </button>
                    <button 
                      onClick={() => setProfileSubMode('buying')}
                      className={cn(
                        "px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        profileSubMode === 'buying' ? cn(currentTheme.badgeBg, "shadow-sm") : cn(currentTheme.muted, "hover:text-proton-text")
                      )}
                    >
                      {t.market.buying_mode}
                    </button>
                  </div>
                )}
                {viewMode === 'my-listings' && activeBottomTab === 'messages' && (
                  <button
                    type="button"
                    onClick={() => {
                      closeInlineMessages();
                      setViewMode('browse');
                    }}
                    className={cn("hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer hover:bg-proton-accent/10 hover:text-proton-text", currentTheme.cardAlt, currentTheme.muted)}
                  >
                    <ArrowLeft size={10} />
                    <span>{language === 'ka' ? 'მარკეტში დაბრუნება' : 'Back to Market'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {viewMode === 'browse' && (
            <div className="hidden md:flex items-center justify-end gap-3 shrink-0">
              {/* Grid / Map View Toggle */}
              <div className={cn("flex items-center gap-1 p-0.5 rounded-xl border shadow-inner", currentTheme.cardAlt)}>
                <button 
                  type="button"
                  onClick={() => setDisplayMode('grid')}
                  className={cn(
                    "h-8 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    displayMode === 'grid' ? cn(currentTheme.badgeBg, "shadow-sm") : cn("border border-transparent", currentTheme.muted, "hover:text-proton-text")
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
                    "h-8 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    displayMode === 'map' ? "bg-proton-accent text-proton-on-accent shadow-sm border border-proton-accent font-black" : cn("border border-transparent", currentTheme.muted, "hover:text-proton-text")
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
                  onChange={(e) => {
                    const nextCurrency = resolvePreferredCurrency(e.target.value);
                    setDisplayCurrency(nextCurrency);
                    onCurrencyChange?.(nextCurrency);
                  }}
                  className={cn(
                    "h-9 pl-3 pr-8 py-1.5 rounded-xl border appearance-none text-[9px] font-black uppercase tracking-widest focus:outline-none transition-all cursor-pointer",
                    currentTheme.input
                  )}
                >
                  {CURRENCIES.map(curr => (
                    <option key={curr.code} value={curr.code} className="bg-proton-card text-proton-text">{curr.code}</option>
                  ))}
                </select>
                <ChevronRight size={12} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-proton-muted pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* Row 2: Listing Type Tabs, Category Selector, Sort, Count spanning full width underneath Row 1 */}
        {viewMode === 'browse' && (
          <div className={cn("hidden md:flex flex-col xl:flex-row xl:items-center justify-between gap-4 xl:gap-5 border-t pt-6 animate-in fade-in duration-300", currentTheme.border)}>
            {/* Listing Type & Categories Wrap */}
            <div className="flex flex-wrap items-center gap-3 relative">
              {/* Listing Type Selection Tabs */}
              <ListingTypeTabs
                activeType={activeListingType}
                onSelectType={handleSelectListingType}
                language={language}
                theme={currentTheme}
              />

              {/* SPACE SAVING: Category Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  className="flex items-center gap-2 px-3.5 py-2 h-[38px] rounded-xl bg-proton-card border border-proton-border hover:border-proton-accent/40 hover:text-proton-text transition-all text-[10px] font-black uppercase tracking-wider text-proton-text cursor-pointer active:scale-95 shadow-sm shrink-0"
                >
                  <span className="text-sm shrink-0">
                    {activeCategory === 'all' ? '📊' : (CATEGORY_EMOJIS[activeCategory] || '🏷️')}
                  </span>
                  <span>
                    {activeCategory === 'all' 
                      ? (language === 'ka' ? 'ყველა კატეგორია' : 'All Categories') 
                      : getCategoryLabel(activeCategory, t, language)}
                  </span>
                  <ChevronDown size={11} className={cn("text-proton-muted transition-transform duration-200", isCategoryDropdownOpen && "rotate-180")} />
                </button>

                {isCategoryDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-[60]" 
                      onClick={() => setIsCategoryDropdownOpen(false)} 
                    />
                    <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-proton-card border border-proton-border rounded-2xl shadow-2xl p-2 z-[70] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="text-[9px] font-black tracking-wider text-proton-muted uppercase px-3 py-1.5 border-b border-proton-border w-full flex justify-between items-center mb-1.5">
                        <span>{language === 'ka' ? 'აირჩიეთ კატეგორია' : 'Select Category'}</span>
                        <span className="text-proton-accent text-[8px] tracking-widest">★ PROTON</span>
                      </div>
                      <div className="max-h-72 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCategory('all');
                            setIsCategoryDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border text-left cursor-pointer",
                            activeCategory === 'all'
                              ? "bg-proton-accent/15 border-proton-accent/35 text-proton-accent"
                              : "bg-transparent border-transparent text-proton-muted hover:bg-proton-bg hover:text-proton-text"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span>🌍</span>
                            <span>{t.market.all_categories}</span>
                          </div>
                          {activeCategory === 'all' && <span className="w-1.5 h-1.5 rounded-full bg-proton-accent" />}
                        </button>

                        {(activeListingType === 'all'
                          ? getListingDirectionsMeta(language).map((dir) => ({
                              groupId: dir.id,
                              title: `${dir.emoji} ${dir.title}`,
                              categories: getCategoriesForListingType(dir.id, t, language),
                            }))
                          : getGroupedCategoriesForListingType(activeListingType, t, language)
                        ).map(group => (
                          <div key={group.groupId} className="pt-1.5 border-t border-proton-border/60 space-y-0.5">
                            <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-proton-accent/90">
                              {group.title}
                            </div>
                            {group.categories.map(cat => {
                              const isSelected = activeCategory === cat.id;
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  data-testid={`desktop-cat-item-${cat.id}`}
                                  onClick={() => {
                                    setActiveCategory(cat.id);
                                    setIsCategoryDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border text-left cursor-pointer",
                                    isSelected
                                      ? "bg-proton-accent/15 border-proton-accent/35 text-proton-accent"
                                      : "bg-transparent border-transparent text-proton-muted hover:bg-proton-bg hover:text-proton-text"
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs shrink-0">{cat.emoji}</span>
                                    <span className="truncate">{cat.label}</span>
                                  </div>
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-proton-accent" />}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {/* Sorting Filter */}
              <div className="flex items-center gap-2">
                <span className={cn("text-[8px] sm:text-[9px] font-black uppercase tracking-widest shrink-0", currentTheme.muted)}>
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
                    <option value="rating" className="bg-proton-card text-proton-text">{language === 'ka' ? '★ რეიტინგი' : '★ RATING'}</option>
                    <option value="newest" className="bg-proton-card text-proton-text">{language === 'ka' ? '📅 უახლესი' : '📅 NEWEST'}</option>
                    <option value="priceAsc" className="bg-proton-card text-proton-text">{language === 'ka' ? '📉 ფასი (ზრდადი)' : '📉 PRICE (LOW)'}</option>
                    <option value="priceDesc" className="bg-proton-card text-proton-text">{language === 'ka' ? '📈 ფასი (კლებადი)' : '📈 PRICE (HIGH)'}</option>
                  </select>
                  <ChevronRight size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-proton-muted pointer-events-none" />
                </div>
              </div>

              <div className="text-[10px] font-black uppercase tracking-widest text-proton-muted">
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
      ) : viewMode === 'rankings' ? (
        <MarketRankingsView
          language={language}
          t={t}
          currentTheme={currentTheme}
          listings={listings}
          earnedAchievements={sellerAnalyticsOverview?.earnedAchievements || []}
          onSelectListingId={handleOpenListingFromRankings}
        />
      ) : viewMode === 'browse' || viewMode === 'my-listings' ? (
        <div className="space-y-10 w-full">
          {/* SPACE-SAVING MOBILE TOOLBAR - Only for Browse View */}
          {viewMode === 'browse' && (
            <div className="block md:hidden bg-proton-card/95 border border-proton-border rounded-xl p-4 mb-3.5 space-y-3.5 transition-all shadow-sm">
              {/* Listing Type Select tabs (scrollable with horizontal scroll indicator) */}
              <div className="relative group/typescroll">
                <div className="flex items-center overflow-x-auto scrollbar-none py-0.5 pr-6">
                  <ListingTypeTabs
                    activeType={activeListingType}
                    onSelectType={handleSelectListingType}
                    language={language}
                    theme={currentTheme}
                  />
                </div>
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-proton-card via-proton-card/50 to-transparent flex items-center justify-end pr-1 text-proton-muted">
                  <ChevronRight size={12} className="opacity-70" />
                </div>
              </div>

              {/* Space-saving Compact Action Controls */}
              <div className="grid grid-cols-12 gap-2 relative">
                {/* Category Dropdown Selector */}
                <div className="col-span-6 relative">
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                    className="w-full flex items-center justify-between px-3 h-11 rounded-xl bg-proton-bg border border-proton-border text-left text-[10px] font-black uppercase tracking-wider text-proton-text active:scale-95 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                      <span className="text-xs shrink-0">
                        {activeCategory === 'all' ? '📊' : (CATEGORY_EMOJIS[activeCategory] || '🏷️')}
                      </span>
                      <span className="truncate">
                        {activeCategory === 'all' 
                          ? (language === 'ka' ? 'კატეგორია' : 'Category') 
                          : getCategoryLabel(activeCategory, t, language)}
                      </span>
                    </div>
                    <ChevronDown size={11} className={cn("text-proton-muted transition-transform duration-200 shrink-0", isCategoryDropdownOpen && "rotate-180")} />
                  </button>

                  {isCategoryDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-[60]" 
                        onClick={() => setIsCategoryDropdownOpen(false)} 
                      />
                      <div className="absolute left-0 top-12 w-[calc(200%+0.5rem)] sm:w-64 max-w-[calc(100vw-2.5rem)] bg-proton-card border-2 border-proton-accent/40 rounded-2xl shadow-2xl p-2 z-[70] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="text-[9px] font-black tracking-wider text-proton-muted uppercase px-3 py-1.5 border-b border-proton-border w-full flex justify-between items-center mb-1.5">
                          <span>{language === 'ka' ? 'აირჩიეთ კატეგორია' : 'Select Category'}</span>
                        </div>
                        <div className="max-h-72 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCategory('all');
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border text-left cursor-pointer",
                              activeCategory === 'all'
                                ? "bg-proton-accent/15 border-proton-accent/35 text-proton-accent"
                                : "bg-transparent border-transparent text-proton-muted hover:bg-proton-bg hover:text-proton-text"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span>🌍</span>
                              <span>{t.market.all_categories}</span>
                            </div>
                            {activeCategory === 'all' && <span className="w-1.5 h-1.5 rounded-full bg-proton-accent" />}
                          </button>

                          {(activeListingType === 'all'
                            ? getListingDirectionsMeta(language).map((dir) => ({
                                groupId: dir.id,
                                title: `${dir.emoji} ${dir.title}`,
                                categories: getCategoriesForListingType(dir.id, t, language),
                              }))
                            : getGroupedCategoriesForListingType(activeListingType, t, language)
                          ).map(group => (
                            <div key={group.groupId} className="pt-1.5 border-t border-proton-border/60 space-y-0.5">
                              <div className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-proton-accent/90">
                                {group.title}
                              </div>
                              {group.categories.map(cat => {
                                const isSelected = activeCategory === cat.id;
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    data-testid={`mobile-cat-item-${cat.id}`}
                                    onClick={() => {
                                      setActiveCategory(cat.id);
                                      setIsCategoryDropdownOpen(false);
                                    }}
                                    className={cn(
                                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border text-left cursor-pointer",
                                      isSelected
                                        ? "bg-proton-accent/15 border-proton-accent/35 text-proton-accent"
                                        : "bg-transparent border-transparent text-proton-muted hover:bg-proton-bg hover:text-proton-text"
                                    )}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 font-bold">
                                      <span className="text-xs shrink-0">{cat.emoji}</span>
                                      <span className="truncate">{cat.label}</span>
                                    </div>
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-proton-accent" />}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Filters button */}
                <button
                  type="button"
                  onClick={() => setIsFiltersOpen(true)}
                  className="col-span-3 h-11 rounded-xl text-[10px] uppercase font-black tracking-widest bg-proton-bg border border-proton-border text-proton-text hover:border-proton-accent/40 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  ⚙️ <span>{language === 'ka' ? 'ფილტრი' : 'Filter'}</span>
                </button>

                {/* Grid/Map button */}
                <button
                  type="button"
                  onClick={() => setDisplayMode(displayMode === 'grid' ? 'map' : 'grid')}
                  className="col-span-3 h-11 bg-proton-bg border border-proton-border hover:border-proton-accent/40 rounded-xl text-proton-text flex items-center justify-center active:scale-95 transition-all text-[10px] uppercase font-black tracking-widest gap-1 cursor-pointer"
                >
                  {displayMode === 'grid' ? (
                    <>
                      <MapPin size={11} className="text-proton-accent" />
                      <span>{language === 'ka' ? 'რუკა' : 'Map'}</span>
                    </>
                  ) : (
                    <>
                      <LayoutGrid size={11} className="text-proton-accent" />
                      <span>{language === 'ka' ? 'ბადე' : 'Grid'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-8 items-stretch md:items-start w-full">
            {/* Desktop Left Sidebar: Categories/Filters */}
            {viewMode === 'browse' && (
              <aside className="hidden md:block w-72 shrink-0 space-y-6 sticky top-20 animate-in fade-in slide-in-from-left duration-300">
                <div className={cn("p-6 rounded-xl backdrop-blur-xl", currentTheme.card)}>
                  <MarketFilterPanel
                    language={language}
                    t={t}
                    currentTheme={currentTheme}
                    activeFiltersCount={activeFiltersCount}
                    activeListingType={activeListingType}
                    setActiveListingType={handleSelectListingType}
                    activeCategory={activeCategory}
                    setActiveCategory={setActiveCategory}
                    activeCountry={activeCountry}
                    setActiveCountry={setActiveCountry}
                    activeCity={activeCity}
                    setActiveCity={setActiveCity}
                    minPrice={minPrice}
                    setMinPrice={setMinPrice}
                    maxPrice={maxPrice}
                    setMaxPrice={setMaxPrice}
                    displayCurrency={displayCurrency}
                    clearFilters={clearFilters}
                  />
                </div>
              </aside>
            )}

            <div className={cn("w-full md:w-auto flex-1 min-w-0", activeBottomTab === 'messages' ? "space-y-4" : "space-y-8")}>


              {viewMode === 'browse' && displayMode === 'map' && (
                <div className="mb-8 animate-in fade-in duration-300 relative z-0 isolate">
                  <ListingMap 
                    listings={filteredListings}
                    onSelectListing={(listing) => {
                      setSelectedListing(listing);
                    }}
                    onClose={() => setDisplayMode('grid')}
                    language={language}
                    currentTheme={currentTheme}
                    displayCurrency={displayCurrency}
                    priceMap={priceMap}
                    convertPrice={convertPrice}
                  />
                </div>
              )}

              <div className={cn("w-full min-w-0", activeBottomTab === 'messages' ? "space-y-4" : "space-y-8")}>
                {(viewMode === 'my-listings' || viewMode === 'browse') && activeBottomTab === 'messages' && (
                  /* Dedicated Desktop Inbox / Direct Messages layout */
                  <div className="hidden md:grid grid-cols-12 gap-4 lg:gap-5 bg-proton-card border border-proton-border rounded-2xl p-4 lg:p-5 h-[clamp(360px,calc(100dvh-215px),680px)] animate-in fade-in duration-300 shadow-lg">
                    {/* Left Column: Conversational threads */}
                    <div className="col-span-4 min-w-0 border-r border-proton-border pr-4 lg:pr-5 flex flex-col h-full min-h-0 overflow-hidden">
                      <div className="pb-3 border-b border-proton-border shrink-0 flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0">
                          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-proton-accent truncate">
                            {language === 'ka' ? 'ჩატების სია' : 'Direct Messages'}
                          </h3>
                          <p className="text-[11px] text-proton-muted font-medium mt-0.5 truncate">
                            {language === 'ka' ? 'აქტიური საუბრები' : 'Active Conversations'}
                          </p>
                        </div>
                        {desktopChatThreads.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-proton-bg border border-proton-border text-[11px] font-bold text-proton-text tabular-nums shrink-0">
                            {desktopChatThreads.length}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 mt-3 custom-scrollbar">
                        <ChatThreadList
                          threads={desktopChatThreads}
                          activeConversationId={activeChatContext?.conversationId}
                          currentUserId={user?.uid}
                          unreadByConversationId={unreadByConversationId}
                          language={language}
                          currentTheme={currentTheme}
                          onSelectThread={handleSelectDesktopThread}
                          onBrowseMarket={() => {
                            closeInlineMessages();
                            setViewMode('browse');
                          }}
                        />
                      </div>
                    </div>

                    {/* Right Column: Active Thread Messages */}
                    <div className="col-span-8 min-w-0 flex flex-col h-full min-h-0 overflow-hidden pl-1 lg:pl-2">
                      {activeChatListing ? (
                        <div className="flex flex-col h-full min-h-0 gap-3 min-w-0">
                          <ChatThreadHeader
                            listing={activeChatListing}
                            order={
                              activeChatOrder
                                ? {
                                    orderId: activeChatOrder.id,
                                    itemTitle: activeChatOrder.itemTitle || activeChatListing.title,
                                    amount: activeChatOrder.amount,
                                    currency: activeChatOrder.currency,
                                    status: activeChatOrder.status,
                                  }
                                : null
                            }
                            currentUserId={user?.uid}
                            buyerName={activeChatContext?.buyerName}
                            sellerName={activeChatContext?.sellerName || activeChatListing.sellerName}
                            language={language}
                            currentTheme={currentTheme}
                            onClose={() => {
                              setActiveChatListing(null);
                              setActiveChatContext(null);
                              setActiveChatOrder(null);
                            }}
                            onViewOrder={handleViewOrderFromChat}
                            showInquiryTerms={Boolean(listings.some((l) => l.id === activeChatListing.id))}
                          />

                          <ChatMessageList
                            messages={messagesList}
                            currentUserId={user?.uid}
                            isSellerViewing={Boolean(
                              user?.uid &&
                                user.uid === (activeChatContext?.sellerId || activeChatListing.sellerId)
                            )}
                            language={language}
                            emptyStateAction={setChatMessageText}
                            conversationKey={
                              activeChatContext?.conversationId ||
                              `${activeChatListing.id}_${activeChatOrder?.id || ''}`
                            }
                            onLastMessageVisibilityChange={handleDesktopLastMsgVisibility}
                          />

                          <ChatComposer
                            value={chatMessageText}
                            onChange={setChatMessageText}
                            onSubmit={handleSendMessage}
                            language={language}
                            currentTheme={currentTheme}
                            disabled={!isActiveChatSendAllowed}
                            placeholder={
                              language === 'ka'
                                ? 'დაწერეთ შეთავაზება ან შეკითხვა...'
                                : 'Propose a price or ask a question...'
                            }
                          />
                        </div>
                      ) : chatResolutionError ? (
                        <div
                          role="alert"
                          className="h-full flex flex-col items-center justify-center text-center px-6 text-proton-muted"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-500 mb-3 shadow-sm">
                            <AlertTriangle size={22} />
                          </div>
                          <p className="text-sm font-bold text-proton-text">
                            {language === 'ka' ? 'საუბრის გახსნა ვერ მოხერხდა' : 'Unable to Open Conversation'}
                          </p>
                          <p className="text-xs text-rose-400 max-w-sm mt-1.5 leading-relaxed">
                            {chatResolutionError}
                          </p>
                          <button
                            type="button"
                            onClick={() => setChatResolutionError(null)}
                            className="mt-4 px-3.5 py-2 rounded-xl bg-proton-bg border border-proton-border text-xs font-bold text-proton-text hover:bg-proton-accent/10 transition-colors cursor-pointer"
                          >
                            {language === 'ka' ? 'დახურვა' : 'Dismiss'}
                          </button>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center px-6 text-proton-muted">
                          <div className="w-12 h-12 rounded-2xl bg-proton-bg border border-proton-border flex items-center justify-center text-proton-accent mb-3 shadow-sm">
                            <MessageSquare size={22} />
                          </div>
                          <p className="text-sm font-bold text-proton-text">
                            {language === 'ka' ? 'აირჩიეთ საუბარი' : 'Select a Conversation'}
                          </p>
                          <p className="text-xs text-proton-muted max-w-xs mt-1.5 leading-relaxed">
                            {language === 'ka'
                              ? 'დააწკაპუნეთ საუბარზე მარცხენა პანელში ჩეთის გასახსნელად.'
                              : 'Click any conversation on the left list to view thread details.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {viewMode === 'my-listings' && profileSubMode === 'selling' && activeBottomTab !== 'messages' && (
                  <div className="space-y-3 w-full min-w-0">
                    <div className="flex flex-wrap bg-proton-bg p-1 rounded-2xl border border-proton-border shadow-inner self-start max-w-2xl gap-1 animate-in fade-in duration-300">
                      <button
                        type="button"
                        id="seller-tab-postings-btn"
                        onClick={() => setActiveSellingTab('listings')}
                        className={cn(
                          "px-4 sm:px-5 py-2.5 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-2 grow sm:grow-0 justify-center cursor-pointer border",
                          activeSellingTab === 'listings' 
                            ? "bg-proton-card text-proton-text shadow-sm border-proton-border" 
                            : "text-proton-muted hover:text-proton-text border-transparent"
                        )}
                      >
                        <span>📦</span>
                        <span>{language === 'ka' ? 'ჩემი განცხადებები' : 'My Postings'}</span>
                      </button>
                      <button
                        type="button"
                        id="seller-tab-statistics-btn"
                        onClick={() => setActiveSellingTab('statistics')}
                        className={cn(
                          "px-4 sm:px-5 py-2.5 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-2 grow sm:grow-0 justify-center cursor-pointer border",
                          activeSellingTab === 'statistics' 
                            ? "bg-proton-card text-proton-accent shadow-sm border-proton-border" 
                            : "text-proton-muted hover:text-proton-text border-transparent"
                        )}
                      >
                        <BarChart3 size={13} />
                        <span>{language === 'ka' ? 'სტატისტიკა' : 'Statistics'}</span>
                      </button>
                      <button
                        type="button"
                        id="seller-tab-incoming-orders-btn"
                        onClick={() => setActiveSellingTab('incoming-orders')}
                        className={cn(
                          "px-4 sm:px-5 py-2.5 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-2 grow sm:grow-0 justify-center relative cursor-pointer border",
                          activeSellingTab === 'incoming-orders' 
                            ? "bg-proton-card text-proton-text shadow-sm border-proton-border" 
                            : "text-proton-muted hover:text-proton-text border-transparent"
                        )}
                      >
                        <span>⚡</span>
                        <span>{language === 'ka' ? 'შემოსული შეკვეთები' : 'Incoming Orders'}</span>
                        {sellerOrders.length > 0 && (
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-black ml-1 transition-colors",
                            sellerOrderCounts.actionRequired > 0 
                              ? "bg-amber-500 text-zinc-950 font-black animate-pulse" 
                              : "bg-proton-accent/15 text-proton-accent"
                          )}>
                            {sellerOrderCounts.actionRequired > 0 ? sellerOrderCounts.actionRequired : sellerOrders.length}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Filter Tabs & Summary for Seller Incoming Orders */}
                    {activeSellingTab === 'incoming-orders' && (
                      <>
                        {/* Compact Seller Sales & Revenue Summary */}
                        <div 
                          id="seller-sales-revenue-summary"
                          className={cn(
                            "grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-2xl border backdrop-blur-md",
                            currentTheme.card
                          )}
                        >
                          {/* Metric 1: Total Revenue */}
                          <div id="seller-metric-revenue" className="flex flex-col justify-between p-3 rounded-xl bg-proton-bg/70 border border-proton-border">
                            <span className={cn("text-[9px] sm:text-[10px] font-black uppercase tracking-wider", currentTheme.muted)}>
                              {language === 'ka' ? 'შემოსავალი' : 'Revenue'}
                            </span>
                            <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                              <span className={cn("text-base sm:text-lg lg:text-xl font-black font-mono tracking-tight", currentTheme.text)}>
                                {sellerSalesSummary.formattedRevenue}
                              </span>
                              {sellerSalesSummary.revenueBreakdown && (
                                <span className={cn("text-[8px] font-mono", currentTheme.tagMuted)}>
                                  ({sellerSalesSummary.revenueBreakdown})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Metric 2: Completed Orders */}
                          <div id="seller-metric-completed" className="flex flex-col justify-between p-3 rounded-xl bg-proton-bg/70 border border-proton-border">
                            <span className={cn("text-[9px] sm:text-[10px] font-black uppercase tracking-wider", currentTheme.muted)}>
                              {language === 'ka' ? 'დასრულებული' : 'Completed'}
                            </span>
                            <div className="mt-1 flex items-baseline gap-1.5">
                              <span className="text-base sm:text-lg lg:text-xl font-black font-mono tracking-tight text-emerald-500">
                                {sellerSalesSummary.completedOrders}
                              </span>
                            </div>
                          </div>

                          {/* Metric 3: Total Orders */}
                          <div id="seller-metric-total-orders" className="flex flex-col justify-between p-3 rounded-xl bg-proton-bg/70 border border-proton-border">
                            <span className={cn("text-[9px] sm:text-[10px] font-black uppercase tracking-wider", currentTheme.muted)}>
                              {language === 'ka' ? 'სულ შეკვეთები' : 'Total Orders'}
                            </span>
                            <div className="mt-1 flex items-baseline gap-1.5">
                              <span className={cn("text-base sm:text-lg lg:text-xl font-black font-mono tracking-tight", currentTheme.text)}>
                                {sellerSalesSummary.totalOrders}
                              </span>
                            </div>
                          </div>

                          {/* Metric 4: Action Required */}
                          <div id="seller-metric-action-required" className={cn(
                            "flex flex-col justify-between p-3 rounded-xl border transition-colors",
                            sellerSalesSummary.actionRequired > 0 
                              ? "bg-amber-500/15 border-amber-500/35 text-amber-500" 
                              : "bg-proton-bg/70 border-proton-border"
                          )}>
                            <div className="flex items-center justify-between gap-1">
                              <span className={cn(
                                "text-[9px] sm:text-[10px] font-black uppercase tracking-wider",
                                sellerSalesSummary.actionRequired > 0 ? "text-amber-500" : currentTheme.muted
                              )}>
                                {language === 'ka' ? 'მოქმედებაა საჭირო' : 'Action Required'}
                              </span>
                              {sellerSalesSummary.actionRequired > 0 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              )}
                            </div>
                            <div className="mt-1 flex items-baseline gap-1.5">
                              <span className={cn(
                                "text-base sm:text-lg lg:text-xl font-black font-mono tracking-tight",
                                sellerSalesSummary.actionRequired > 0 ? "text-amber-500 font-black" : currentTheme.text
                              )}>
                                {sellerSalesSummary.actionRequired}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Filter Tabs for Seller Incoming Orders */}
                        <div className="w-full min-w-0 max-w-full overflow-x-auto scrollbar-none no-scrollbar py-0.5">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-max pb-1">
                          {/* Tab 1: All */}
                          <button
                            type="button"
                            id="seller-order-filter-all"
                            onClick={() => setSellerOrderFilter('all')}
                            className={cn(
                              "px-3.5 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 border active:scale-95 cursor-pointer",
                              sellerOrderFilter === 'all'
                                ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-sm"
                                : "bg-proton-card text-proton-muted border-proton-border hover:text-proton-text hover:border-proton-accent/40"
                            )}
                          >
                            <span>{language === 'ka' ? 'ყველა' : 'All'}</span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-md text-[8px] font-mono",
                              sellerOrderFilter === 'all' ? "bg-black/20 text-proton-on-accent font-bold" : "bg-proton-bg text-proton-muted"
                            )}>
                              {sellerOrderCounts.all}
                            </span>
                          </button>

                          {/* Tab 2: Action Required */}
                          <button
                            type="button"
                            id="seller-order-filter-action-required"
                            onClick={() => setSellerOrderFilter('action-required')}
                            className={cn(
                              "px-3.5 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 border active:scale-95 cursor-pointer",
                              sellerOrderFilter === 'action-required'
                                ? "bg-amber-500/15 text-amber-500 border-amber-500/40 shadow-sm font-black"
                                : "bg-proton-card text-proton-muted border-proton-border hover:text-amber-500 hover:border-amber-500/35"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>{language === 'ka' ? 'მოქმედებაა საჭირო' : 'Action Required'}</span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-md text-[8px] font-mono font-black",
                              sellerOrderCounts.actionRequired > 0 
                                ? "bg-amber-500 text-zinc-950 font-black" 
                                : (sellerOrderFilter === 'action-required' ? "bg-amber-500/25 text-amber-500" : "bg-proton-bg text-proton-muted")
                            )}>
                              {sellerOrderCounts.actionRequired}
                            </span>
                          </button>

                          {/* Tab 3: Processing */}
                          <button
                            type="button"
                            id="seller-order-filter-processing"
                            onClick={() => setSellerOrderFilter('processing')}
                            className={cn(
                              "px-3.5 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 border active:scale-95 cursor-pointer",
                              sellerOrderFilter === 'processing'
                                ? "bg-indigo-500/15 text-indigo-500 border-indigo-500/40 shadow-sm font-black"
                                : "bg-proton-card text-proton-muted border-proton-border hover:text-indigo-500 hover:border-indigo-500/35"
                            )}
                          >
                            <span>{language === 'ka' ? 'მუშავდება' : 'Processing'}</span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-md text-[8px] font-mono",
                              sellerOrderFilter === 'processing' ? "bg-indigo-500/20 text-indigo-500 font-bold" : "bg-proton-bg text-proton-muted"
                            )}>
                              {sellerOrderCounts.processing}
                            </span>
                          </button>

                          {/* Tab 4: Shipped */}
                          <button
                            type="button"
                            id="seller-order-filter-shipped"
                            onClick={() => setSellerOrderFilter('shipped')}
                            className={cn(
                              "px-3.5 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 border active:scale-95 cursor-pointer",
                              sellerOrderFilter === 'shipped'
                                ? "bg-cyan-500/15 text-cyan-500 border-cyan-500/40 shadow-sm font-black"
                                : "bg-proton-card text-proton-muted border-proton-border hover:text-cyan-500 hover:border-cyan-500/35"
                            )}
                          >
                            <span>{language === 'ka' ? 'გაგზავნილი' : 'Shipped'}</span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-md text-[8px] font-mono",
                              sellerOrderFilter === 'shipped' ? "bg-cyan-500/20 text-cyan-500 font-bold" : "bg-proton-bg text-proton-muted"
                            )}>
                              {sellerOrderCounts.shipped}
                            </span>
                          </button>

                          {/* Tab 5: Completed */}
                          <button
                            type="button"
                            id="seller-order-filter-completed"
                            onClick={() => setSellerOrderFilter('completed')}
                            className={cn(
                              "px-3.5 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 border active:scale-95 cursor-pointer",
                              sellerOrderFilter === 'completed'
                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/40 shadow-sm font-black"
                                : "bg-proton-card text-proton-muted border-proton-border hover:text-emerald-500 hover:border-emerald-500/35"
                            )}
                          >
                            <span>{language === 'ka' ? 'დასრულებული' : 'Completed'}</span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-md text-[8px] font-mono",
                              sellerOrderFilter === 'completed' ? "bg-emerald-500/20 text-emerald-500 font-bold" : "bg-proton-bg text-proton-muted"
                            )}>
                              {sellerOrderCounts.completed}
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  </div>
                )}

                {activeBottomTab !== 'messages' && (
                  viewMode === 'my-listings' && profileSubMode === 'buying' ? (
                    <BuyerOrders
                      buyerOrders={buyerOrders}
                      listings={listings}
                      language={language}
                      currentTheme={currentTheme}
                      onUpdateOrderStatus={handleUpdateOrderStatus}
                      onCancelOrder={(order) => setOrderToCancel(order)}
                      onExploreMarket={() => setViewMode('browse')}
                      onMessageSeller={handleStartOrderChat}
                      selectedOrder={buyerSelectedOrder}
                      onSelectOrder={setBuyerSelectedOrder}
                    />
                  ) : viewMode === 'my-listings' && profileSubMode === 'selling' && activeSellingTab === 'statistics' ? (
                    <SellerAnalyticsPanel
                      overview={sellerAnalyticsOverview}
                      loading={sellerAnalyticsLoading}
                      unavailableReason={sellerAnalyticsUnavailableReason}
                      sellerListings={sellerOwnedListings}
                      language={language}
                      t={t}
                      currentTheme={currentTheme}
                      onToggleOptOut={handleToggleCompetitionOptOut}
                      onSelectListing={setSelectedListing}
                      onOpenRankings={() => setViewMode('rankings')}
                    />
                  ) : (
                    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 min-[1440px]:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6 items-stretch w-full min-w-0">
                      <AnimatePresence mode="popLayout">
                      {viewMode === 'my-listings' && activeSellingTab === 'incoming-orders' ? (
                        filteredSellerOrders.length > 0 ? (
                          filteredSellerOrders.map((order, idx) => {
                        const isExpanded = expandedOrderId === order.id;
                        const isProjectAsset = isProjectAssetOrder(order);
                        const isService = isServiceOrder(order);
                        const isPhysical = isPhysicalOrder(order);
                        const isSeller = true;

                      return (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          key={order.id}
                          className={cn("p-4 sm:p-6 lg:p-8 rounded-xl border border-proton-border group relative overflow-hidden flex flex-col justify-between", currentTheme.card)}
                        >
                          <div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-proton-accent/5 blur-3xl rounded-full -mr-16 -mt-16" />
                            <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6 relative">
                              <div className={cn(
                                "p-3 sm:p-4 rounded-lg border border-proton-border shrink-0",
                                isProjectAsset
                                  ? "bg-purple-500/15 text-purple-400"
                                  : isService 
                                  ? "bg-amber-500/15 text-amber-500" 
                                  : isPhysical 
                                  ? "bg-cyan-500/15 text-cyan-500" 
                                  : "bg-proton-bg text-proton-text"
                              )}>
                                {isProjectAsset ? <ShieldCheck size={20} /> : isService ? <Zap size={20} /> : isPhysical ? <Truck size={20} /> : <ShoppingBag size={20} />}
                              </div>
                              <div className="text-right flex flex-col items-end gap-1.5">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest block", currentTheme.muted)}>
                                  {order.createdAt?.seconds 
                                    ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
                                    : order.createdAt instanceof Date 
                                      ? order.createdAt.toLocaleDateString() 
                                      : (order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'Active')}
                                </span>
                                
                                <span className={cn(
                                  "inline-flex px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em] rounded-lg border",
                                  order.status === 'completed' 
                                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
                                    : order.status === 'shipped'
                                    ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-500"
                                    : order.status === 'processing'
                                    ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-500"
                                    : order.status === 'in_progress'
                                    ? "bg-blue-500/15 border-blue-500/30 text-blue-500"
                                    : order.status === 'cancelled'
                                    ? "bg-rose-500/15 border-rose-500/30 text-rose-500"
                                    : "bg-amber-500/15 border-amber-500/30 text-amber-500"
                                )}>
                                  {order.status === 'booked' 
                                    ? (language === 'ka' ? '🚀 შეკვეთილია' : '🚀 Booked')
                                    : order.status === 'pending'
                                    ? (isProjectAsset
                                      ? (language === 'ka' ? '🔒 დაჯავშნილია · გადაცემის მოლოდინში' : '🔒 Reserved · Pending Transfer')
                                      : (language === 'ka' ? '⏳ მიღებულია' : '⏳ Pending'))
                                    : order.status === 'processing'
                                    ? (language === 'ka' ? '📦 მუშავდება' : '📦 Processing')
                                    : order.status === 'shipped'
                                    ? (language === 'ka' ? '🚚 გაგზავნილია' : '🚚 Shipped')
                                    : order.status === 'completed'
                                    ? (language === 'ka' ? '🎯 დასრულებული' : '🎯 Completed')
                                    : order.status === 'cancelled'
                                    ? (language === 'ka' ? '❌ გაუქმებული' : '❌ Cancelled')
                                    : order.status === 'in_progress'
                                    ? (language === 'ka' ? '🛠️ მიმდინარე' : '🛠️ In Progress')
                                    : order.status}
                                </span>
                              </div>
                            </div>
                            
                            <h4 
                              onClick={() => setSellerSelectedOrder(order)}
                              className="text-base sm:text-lg font-black text-proton-text mb-2 uppercase tracking-tight leading-tight break-words min-w-0 hover:text-proton-accent cursor-pointer transition-colors"
                              title={language === 'ka' ? 'დეტალებისა და თაიმლაინის ნახვა' : 'Click to view details & timeline'}
                            >
                              {order.itemTitle}
                            </h4>
                            <p className={cn("text-xs font-bold font-mono mb-3 sm:mb-4", currentTheme.muted)}>
                              {order.amount} {order.currency}
                            </p>

                            {isProjectAsset && (
                              <div className="mt-3 sm:mt-4 bg-proton-bg/70 rounded-2xl p-3 sm:p-4 border border-proton-border text-xs text-left">
                                <span className="text-[8px] font-black uppercase tracking-wider text-proton-muted block mb-1">
                                  {language === 'ka' ? 'ტიპი' : 'Asset Type'}
                                </span>
                                <p className="text-proton-text font-bold">
                                  {language === 'ka' ? 'უნიკალური ციფრული აქტივი' : 'Unique Digital Asset'}
                                </p>
                              </div>
                            )}

                            {isService && (
                              <div className="mt-3 sm:mt-4 bg-proton-bg/70 rounded-2xl p-3 sm:p-4 border border-proton-border text-xs text-left">
                                <span className="text-[8px] font-black uppercase tracking-wider text-proton-muted block mb-1">
                                  {language === 'ka' ? 'ტიპი' : 'Service Booking'}
                                </span>
                                <p className="text-proton-text font-bold">
                                  {language === 'ka' ? 'Professional Freelance სერვისი' : 'Professional Service Booking'}
                                </p>
                              </div>
                            )}

                            {isPhysical && (
                              <div className="mt-3 sm:mt-4 bg-proton-bg/70 rounded-2xl p-3 sm:p-4 border border-proton-border text-xs text-left">
                                <span className="text-[8px] font-black uppercase tracking-wider text-proton-muted block mb-1">
                                  {language === 'ka' ? 'მიწოდების ტიპი' : 'Fulfillment Type'}
                                </span>
                                <p className="text-proton-text font-bold flex items-center gap-1.5">
                                  <Truck size={14} className="text-cyan-500 shrink-0" />
                                  <span>{language === 'ka' ? 'ფიზიკური მიწოდება / ამანათი' : 'Physical Shipping / Courier'}</span>
                                </p>
                              </div>
                            )}

                            {isExpanded && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-6 pt-6 border-t border-proton-border text-left space-y-4"
                              >
                                {(isService || isProjectAsset) && order.buyerInstructions && (
                                  <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-proton-muted block">
                                      {isProjectAsset
                                        ? (language === 'ka' ? 'მყიდველის შენიშვნა / კონტაქტი' : 'Buyer Transfer Notes')
                                        : (language === 'ka' ? 'მოთხოვნები შემსრულებლისთვის' : 'Client Requirements')}
                                    </span>
                                    <p className="text-[11px] font-medium text-proton-text bg-proton-bg p-3.5 rounded-xl border border-proton-border whitespace-pre-line leading-relaxed shadow-inner">
                                      {order.buyerInstructions}
                                    </p>
                                  </div>
                                )}

                                {isPhysical && order.shippingDetails && (
                                  <div className="space-y-2 bg-proton-bg p-4 rounded-2xl border border-proton-border text-left">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-cyan-500 block">
                                      {language === 'ka' ? '📦 მიწოდების მონაცემები' : '📦 Shipping Information'}
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                      <div>
                                        <span className="text-[9px] text-proton-muted block">{language === 'ka' ? 'მიმღები' : 'Recipient'}:</span>
                                        <span className="text-proton-text font-bold">{order.shippingDetails.recipientName}</span>
                                      </div>
                                      <div>
                                        <span className="text-[9px] text-proton-muted block">{language === 'ka' ? 'ტელეფონი' : 'Phone'}:</span>
                                        <span className="text-proton-text font-mono">{order.shippingDetails.phone}</span>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <span className="text-[9px] text-proton-muted block">{language === 'ka' ? 'ქალაქი და მისამართი' : 'City & Address'}:</span>
                                        <span className="text-proton-text">{order.shippingDetails.city}, {order.shippingDetails.address}</span>
                                      </div>
                                      {order.shippingDetails.notes && (
                                        <div className="sm:col-span-2 pt-1 border-t border-proton-border">
                                          <span className="text-[9px] text-proton-muted block">{language === 'ka' ? 'კომენტარი კურიერისთვის' : 'Courier Notes'}:</span>
                                          <span className="text-proton-text/80 italic">{order.shippingDetails.notes}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {isPhysical && order.trackingInfo && (
                                  <div className="bg-cyan-500/10 border border-cyan-500/30 p-4 rounded-2xl text-left space-y-1">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-cyan-500 block">
                                      {language === 'ka' ? '🚚 გზავნილის თრექინგი' : '🚚 Tracking Information'}
                                    </span>
                                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                                      <span className="text-proton-muted">{order.trackingInfo.carrier || (language === 'ka' ? 'საკურიერო' : 'Courier')}</span>
                                      <span className="text-proton-text font-mono font-bold bg-proton-card px-2 py-0.5 rounded border border-proton-border break-all">{order.trackingInfo.trackingNumber}</span>
                                    </div>
                                    {order.trackingInfo.shippedAt && (
                                      <span className="text-[9px] text-proton-muted block font-mono">
                                        {language === 'ka' ? 'გაგზავნის დრო' : 'Shipped'}: {new Date(order.trackingInfo.shippedAt).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="space-y-1 font-mono text-[9px] text-proton-muted">
                                  <p>ID: #{order.id}</p>
                                  <p>Role: {isSeller ? (isService ? 'Service Provider' : 'Merchant / Seller') : 'Customer'}</p>
                                </div>

                                {isProjectAsset && isSeller && order.status !== 'completed' && order.status !== 'cancelled' && (
                                  <div className="pt-2 flex flex-wrap gap-2">
                                    {(order.status === 'pending' || order.status === 'booked') && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                                        className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md active:scale-95 cursor-pointer"
                                      >
                                        🎯 {language === 'ka' ? 'დასრულებულად მონიშვნა' : 'Mark Completed'}
                                      </button>
                                    )}
                                    {canCancelOrder(order) && (
                                      <button
                                        type="button"
                                        onClick={() => setOrderToCancel(order)}
                                        className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-rose-500 hover:text-white bg-rose-500/10 border border-rose-500/30 hover:bg-rose-600 transition-all active:scale-95 cursor-pointer"
                                      >
                                        ❌ {language === 'ka' ? 'შეკვეთის გაუქმება' : 'Cancel Order'}
                                      </button>
                                    )}
                                  </div>
                                )}

                                {isService && isSeller && order.status !== 'completed' && order.status !== 'cancelled' && (
                                  <div className="pt-2 flex flex-wrap gap-2">
                                    {order.status === 'booked' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateOrderStatus(order.id, 'in_progress')}
                                          className={cn("px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer", currentTheme.accentBg)}
                                        >
                                          🛠️ {language === 'ka' ? 'მუშაობის დაწყება' : 'Begin Work'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setOrderToCancel(order)}
                                          className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-rose-500 hover:text-white bg-rose-500/10 border border-rose-500/30 hover:bg-rose-600 transition-all active:scale-95 cursor-pointer"
                                        >
                                          ❌ {language === 'ka' ? 'შეკვეთის გაუქმება' : 'Cancel Order'}
                                        </button>
                                      </>
                                    )}
                                    {order.status === 'in_progress' && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                                        className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md active:scale-95 cursor-pointer"
                                      >
                                        🎯 {language === 'ka' ? 'მზადაა / დასრულება' : 'Mark Completed'}
                                      </button>
                                    )}
                                  </div>
                                )}

                                {isPhysical && isSeller && order.status !== 'completed' && order.status !== 'cancelled' && (
                                  <div className="pt-2 flex flex-col gap-2">
                                    {order.status === 'pending' && (
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateOrderStatus(order.id, 'processing')}
                                          className={cn("px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 text-left cursor-pointer", currentTheme.accentBg)}
                                        >
                                          📦 {language === 'ka' ? 'შეკვეთის დამუშავების დაწყება' : 'Start Processing Order'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setOrderToCancel(order)}
                                          className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-rose-500 hover:text-white bg-rose-500/10 border border-rose-500/30 hover:bg-rose-600 transition-all active:scale-95 cursor-pointer"
                                        >
                                          ❌ {language === 'ka' ? 'შეკვეთის გაუქმება' : 'Cancel Order'}
                                        </button>
                                      </div>
                                    )}

                                    {order.status === 'processing' && (
                                      shipmentTrackingInput?.orderId === order.id ? (
                                        <div className="bg-proton-bg p-3.5 rounded-2xl border border-proton-border space-y-2">
                                          <span className="text-[8px] font-black uppercase tracking-wider text-proton-muted block">
                                            {language === 'ka' ? 'გზავნილის დეტალები' : 'Shipment Tracking'}
                                          </span>
                                          <input
                                            type="text"
                                            value={shipmentTrackingInput?.carrier || ''}
                                            onChange={(e) => setShipmentTrackingInput(prev => prev ? ({ ...prev, carrier: e.target.value }) : null)}
                                            placeholder={language === 'ka' ? 'გადამზიდი (მაგ. Georgian Post, DHL)' : 'Carrier (e.g. Courier, Post)'}
                                            className={cn("w-full rounded-xl px-3 py-2 text-base md:text-[10px]", currentTheme.input)}
                                          />
                                          <input
                                            type="text"
                                            value={shipmentTrackingInput?.trackingNumber || ''}
                                            onChange={(e) => setShipmentTrackingInput(prev => prev ? ({ ...prev, trackingNumber: e.target.value }) : null)}
                                            placeholder={language === 'ka' ? 'თრექინგ ნომერი' : 'Tracking Code / Number'}
                                            className={cn("w-full rounded-xl px-3 py-2 text-base md:text-[10px] font-mono", currentTheme.input)}
                                          />
                                          <div className="flex flex-wrap gap-2 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                handleUpdateOrderStatus(order.id, 'shipped', {
                                                  carrier: shipmentTrackingInput?.carrier || '',
                                                  trackingNumber: shipmentTrackingInput?.trackingNumber || ''
                                                });
                                              }}
                                              className={cn("px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer", currentTheme.accentBg)}
                                            >
                                              🚚 {language === 'ka' ? 'გაგზავნის დადასტურება' : 'Confirm Shipped'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setShipmentTrackingInput(null)}
                                              className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider bg-proton-card border border-proton-border text-proton-muted hover:text-proton-text transition-all cursor-pointer"
                                            >
                                              {language === 'ka' ? 'გაუქმება' : 'Cancel'}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setShipmentTrackingInput({ orderId: order.id, carrier: '', trackingNumber: '' })}
                                          className={cn("px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 text-left cursor-pointer", currentTheme.accentBg)}
                                        >
                                          🚚 {language === 'ka' ? 'ამანათის გაგზავნა' : 'Mark as Shipped'}
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}

                                {!isSeller && order.status !== 'completed' && order.status !== 'cancelled' && (
                                  <div className="pt-2 flex flex-wrap gap-2">
                                    {isPhysical && order.status === 'shipped' && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                                        className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md active:scale-95 cursor-pointer"
                                      >
                                        🎯 {language === 'ka' ? 'ჩაბარების დადასტურება' : 'Confirm Delivery Received'}
                                      </button>
                                    )}
                                    {canCancelOrder(order) && (
                                      <button
                                        type="button"
                                        onClick={() => setOrderToCancel(order)}
                                        className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-rose-500 hover:text-white bg-rose-500/10 border border-rose-500/30 hover:bg-rose-600 transition-all active:scale-95 cursor-pointer"
                                      >
                                        ❌ {language === 'ka' ? 'შეკვეთის გაუქმება' : 'Cancel Order'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>

                          <div className="mt-5 sm:mt-8 pt-4 sm:pt-6 border-t border-proton-border flex items-center justify-between relative flex-wrap gap-2">
                             <div className="flex items-center flex-wrap gap-2">
                               <span className={cn("text-[9px] font-bold font-mono", currentTheme.muted)}>#{order.id.substring(0, 8).toUpperCase()}</span>
                               <button
                                 type="button"
                                 id={`seller-view-timeline-btn-${order.id}`}
                                 onClick={() => setSellerSelectedOrder(order)}
                                 className="px-2.5 py-1 rounded-lg bg-proton-bg hover:bg-proton-accent/10 border border-proton-border hover:border-proton-accent/40 text-[9px] font-bold text-proton-text flex items-center gap-1.5 transition-all cursor-pointer"
                               >
                                 <Clock size={11} className="text-proton-accent" />
                                 <span>{language === 'ka' ? 'თაიმლაინი' : 'Timeline'}</span>
                               </button>
                               <button
                                 type="button"
                                 id={`seller-message-buyer-btn-${order.id}`}
                                 onClick={() => handleStartOrderChat(order)}
                                 className="px-2.5 py-1 rounded-lg bg-proton-bg hover:bg-proton-accent/10 border border-proton-border hover:border-proton-accent/40 text-[9px] font-bold text-proton-text flex items-center gap-1.5 transition-all cursor-pointer"
                                 title={language === 'ka' ? 'მიწერეთ მყიდველს' : 'Message Buyer'}
                               >
                                 <MessageSquare size={11} className="text-proton-accent" />
                                 <span>{language === 'ka' ? 'მიწერა' : 'Message'}</span>
                               </button>
                             </div>
                             <button 
                               type="button"
                               onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                               className="flex items-center gap-2 text-[10px] font-black uppercase text-proton-accent hover:opacity-80 transition-opacity cursor-pointer"
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
                    <div className="col-span-full w-full py-16 px-6 max-w-md mx-auto text-center space-y-4 bg-proton-card border border-proton-border rounded-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-300 shadow-lg">
                      <div className="w-14 h-14 bg-proton-bg rounded-xl flex items-center justify-center mx-auto border border-proton-border text-proton-text">
                        {sellerOrderFilter === 'action-required' ? (
                          <CheckCircle2 size={24} className="text-emerald-500" />
                        ) : sellerOrderFilter === 'processing' ? (
                          <Package size={24} className="text-indigo-500" />
                        ) : sellerOrderFilter === 'shipped' ? (
                          <Truck size={24} className="text-cyan-500" />
                        ) : sellerOrderFilter === 'completed' ? (
                          <CheckCircle2 size={24} className="text-emerald-500" />
                        ) : (
                          <Inbox size={24} className="text-proton-muted" />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-xs font-black uppercase tracking-widest text-proton-text">
                          {sellerOrderFilter === 'action-required'
                            ? (language === 'ka' ? 'მოქმედება არცერთ შეკვეთაზე არ არის საჭირო' : 'No orders need your attention right now')
                            : sellerOrderFilter === 'processing'
                            ? (language === 'ka' ? 'დამუშავებაში შეკვეთები არ არის' : 'No orders in processing')
                            : sellerOrderFilter === 'shipped'
                            ? (language === 'ka' ? 'გაგზავნილი შეკვეთები არ არის' : 'No shipped orders')
                            : sellerOrderFilter === 'completed'
                            ? (language === 'ka' ? 'დასრულებული შეკვეთები ჯერ არ არის' : 'No completed orders yet')
                            : (language === 'ka' ? 'შემოსული შეკვეთები არ არის' : 'No incoming orders yet')}
                        </h3>
                        <p className="text-[11px] text-proton-muted font-medium leading-relaxed">
                          {sellerOrderFilter === 'action-required'
                            ? (language === 'ka' ? 'ყველა შემოსული შეკვეთა დამუშავებულია ან გაგზავნილია.' : 'All incoming orders have been handled or are already in transit.')
                            : sellerOrderFilter === 'processing'
                            ? (language === 'ka' ? 'ამჟამად არცერთი ფიზიკური შეკვეთა არ იმყოფება დამუშავების ეტაპზე.' : 'There are no physical orders currently being processed.')
                            : sellerOrderFilter === 'shipped'
                            ? (language === 'ka' ? 'გაგზავნილი ამანათები, რომლებიც ჩაბარებას ელოდება, აქ გამოჩნდება.' : 'Orders dispatched and awaiting delivery will appear here.')
                            : sellerOrderFilter === 'completed'
                            ? (language === 'ka' ? 'წარმატებით მიწოდებული და დასრულებული შეკვეთები გამოჩნდება აქ.' : 'Orders confirmed as delivered or completed will appear here.')
                            : (language === 'ka' ? 'როდესაც კლიენტები განათავსებენ შეკვეთას, ისინი გამოჩნდება აქ.' : 'When clients place orders, they will appear here.')}
                        </p>
                      </div>
                      {profileSubMode === 'selling' && sellerOrderFilter !== 'all' && sellerOrders.length > 0 && (
                        <button
                          type="button"
                          id="seller-order-reset-filter-btn"
                          onClick={() => setSellerOrderFilter('all')}
                          className="mt-2 px-4 py-2 rounded-xl bg-proton-bg hover:bg-proton-accent/10 border border-proton-border hover:border-proton-accent/40 text-[9px] font-black uppercase tracking-wider text-proton-text transition-all active:scale-95 cursor-pointer"
                        >
                          {language === 'ka' ? 'ყველა შეკვეთის ნახვა' : 'View All Orders'} ({sellerOrders.length})
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  displayedListings.map((listing, idx) => (
                      <MarketListingCard
                        key={listing.id}
                        listing={listing}
                        idx={idx}
                        user={user}
                        language={language}
                        t={t}
                        currentTheme={currentTheme}
                        priceMap={priceMap}
                        convertPrice={convertPrice}
                        displayCurrency={displayCurrency}
                        isFavorite={favoritesSet.has(listing.id)}
                        toggleFavorite={toggleFavorite}
                        sellerRating={sellerRatings[listing.sellerId]}
                        isAdmin={isAdminUser}
                        onSelectListing={setSelectedListing}
                        onSelectVendor={setSelectedVendor}
                        onStartEdit={startEdit}
                        onDeleteListing={handleDeleteListing}
                        ownerStats={user?.uid === listing.sellerId ? sellerStatsByListingId.get(listing.id) : undefined}
                      />
                    ))
                  )}
            </AnimatePresence>
          </div>
        )
      )}

        {/* Catalog Pagination Load More & Discovery Status */}
        {!loading && !isSearchingBackend && viewMode === 'browse' && displayedListings.length > 0 && (
          <div className="mt-8 flex flex-col justify-center items-center gap-3 pb-8">
            {/* Filter / Search Match Count Notice */}
            {isFilteredMode && (
              <p className="text-[10px] font-bold text-proton-muted bg-proton-card px-4 py-1.5 rounded-full border border-proton-border">
                {language === 'ka' 
                  ? `ნაპოვნია ${filteredListings.length} განცხადება` 
                  : `Found ${filteredListings.length} matching listings`}
              </p>
            )}

            {hasMoreToDisplay ? (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className={cn("px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:border-proton-accent/45 transition-all flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer disabled:opacity-50", currentTheme.card)}
              >
                {isLoadingMore ? (
                  <Loader2 size={14} className={cn("animate-spin", currentTheme.accent)} />
                ) : (
                  <ChevronDown size={14} className={currentTheme.accent} />
                )}
                <span>
                  {isLoadingMore
                    ? (language === 'ka' ? 'იტვირთება...' : 'Loading More...')
                    : (language === 'ka' ? 'მეტის ჩატვირთვა' : 'Load More Listings')}
                </span>
                <span className="text-[10px] text-proton-muted font-mono">
                  {isFilteredMode 
                    ? `(${displayedListings.length} / ${filteredListings.length})` 
                    : `(${listings.length} loaded)`}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-proton-muted bg-proton-card px-4 py-2 rounded-xl border border-proton-border">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>
                  {isFilteredMode
                    ? (language === 'ka' 
                        ? `ყველა ${filteredListings.length} განცხადება ჩატვირთულია` 
                        : `All ${filteredListings.length} matching listings loaded • End of catalog`)
                    : (language === 'ka' 
                        ? `ყველა ${listings.length} ხელმისაწვდომი განცხადება ჩატვირთულია` 
                        : `All ${listings.length} available listings loaded • End of catalog`)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

            {(viewMode === 'browse' || (viewMode === 'my-listings' && profileSubMode === 'selling' && activeSellingTab === 'listings')) && !loading && !isSearchingBackend && listings.length === 0 && !isFilteredMode && (
              <div className="py-20 px-6 max-w-2xl mx-auto text-center space-y-8 bg-proton-card border border-proton-border rounded-xl backdrop-blur-md animate-in fade-in zoom-in duration-500 shadow-lg">
                <div className="w-16 h-16 bg-proton-accent/10 rounded-xl flex items-center justify-center mx-auto border border-proton-accent/25">
                  <LayoutGrid size={28} className="text-proton-accent" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-black uppercase tracking-widest text-proton-text">
                    {language === 'ka' ? 'განცხადებები არ მოიძებნა' : 'No Listings Available'}
                  </h3>
                  <p className="text-xs text-proton-muted leading-relaxed font-medium">
                    {language === 'ka' 
                      ? 'მარკეტში ჯერ არ არის განთავსებული პროდუქტები ან მომსახურება. იყავით პირველი და განათავსეთ თქვენი განცხადება.'
                      : 'There are currently no products or services listed in the marketplace. Be the first to publish a new listing.'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        showToast(language === 'ka' ? "გთხოვთ გაიაროთ ავტორიზაცია განცხადების დასადებად." : "Please sign in to create a listing.", 'warning');
                        onOpenAuthModal?.();
                        return;
                      }
                      resetListingForm();
                      setViewMode('create');
                    }}
                    className={cn("w-full sm:w-auto px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer", currentTheme.accentBg)}
                  >
                    <Plus size={16} />
                    {language === 'ka' ? 'განცხადების დამატება' : 'CREATE LISTING'}
                  </button>
                </div>
              </div>
            )}

            {(viewMode === 'browse' || (viewMode === 'my-listings' && profileSubMode === 'selling' && activeSellingTab === 'listings')) && !loading && !isSearchingBackend && isFilteredMode && filteredListings.length === 0 && (
              <div className="py-24 text-center space-y-6 max-w-sm mx-auto bg-proton-card border border-proton-border p-8 rounded-2xl shadow-lg">
                <div className="w-16 h-16 bg-proton-bg rounded-2xl flex items-center justify-center mx-auto border border-proton-border">
                  <Search size={24} className="text-proton-muted" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-widest text-proton-accent">{t.market.no_results}</p>
                  <p className="text-[11px] text-proton-muted leading-relaxed font-semibold">
                    {language === 'ka' ? 'სცადეთ საძიებო სიტყვის შეცვლა ან სხვა ფილტრების მონიშვნა.' : 'Try adjusting your search keywords, category tags, or location filters.'}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-5 py-2.5 rounded-xl bg-proton-bg border border-proton-border text-[10px] uppercase font-black tracking-widest text-proton-text hover:border-proton-accent/40 hover:text-proton-accent transition-all active:scale-95 cursor-pointer"
                  >
                    {language === 'ka' ? 'ფილტრების გასუფთავება' : 'Reset Filters'}
                  </button>
                </div>
              </div>
            )}

            {(viewMode === 'browse' || (viewMode === 'my-listings' && profileSubMode === 'selling' && activeSellingTab === 'listings')) && (loading || isSearchingBackend) && (
              <div className="flex justify-center py-20">
                <Loader2 className={cn("w-10 h-10 animate-spin", currentTheme.accent)} />
              </div>
            )}
          </div>



        </div>
        </div>
      ) : (
        <CreateListingWizard
          viewMode={viewMode}
          language={language}
          t={t}
          currentTheme={currentTheme}
          formStep={formStep}
          setFormStep={setFormStep}
          formData={formData}
          setFormData={setFormData}
          isSubmitting={isSubmitting}
          handleSubmitListing={handleSubmitListing}
          resetListingForm={resetListingForm}
          setViewMode={setViewMode}
          isResizing={isResizing}
          handleFileUpload={handleFileUpload}
          handlePhotoFilesUpload={handlePhotoFilesUpload}
          photoUploadTasks={photoUploadTasks}
          onRetryPhotoUpload={handleRetryPhotoUpload}
          onDismissPhotoTask={handleDismissPhotoTask}
          onRemovePhotoAt={handleRemovePhotoAt}
          onSetPrimaryPhoto={handleSetPrimaryPhoto}
          onReorderPhotos={handleReorderPhotos}
          onAddPhotoUrl={handleAddPhotoUrl}
          onDiscardSessionPhotos={handleDiscardSessionPhotos}
          userId={user?.uid || null}
          isAiGenerating={isAiGenerating}
          handleAiDescription={handleAiDescription}
          displayCurrency={displayCurrency}
          convertPrice={convertPrice}
          sellerName={
            viewMode === 'edit' && editingListing
              ? editingListing.sellerName
              : (user?.displayName || user?.email?.split('@')[0] || undefined)
          }
          sellerRating={
            viewMode === 'edit' && editingListing
              ? sellerRatings[editingListing.sellerId]
              : (user?.uid ? sellerRatings[user.uid] : undefined)
          }
        />
      )}
      {/* Footer */}
      <footer className="border-t border-proton-border py-20 mt-24">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex flex-col items-center md:items-start gap-4">
              <h3 className="text-proton-text font-black uppercase tracking-tighter text-3xl">
                <span className={currentTheme.accent}>PROTON</span> MARKET
              </h3>
              <p className={cn("text-[10px] font-black uppercase tracking-[0.4em]", currentTheme.muted)}>
                © {new Date().getFullYear()} PROTON INDUSTRIAL SYSTEMS GROUP
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-10 text-[10px] font-black uppercase tracking-[0.3em]">
              <button 
                onClick={() => {
                  if (activeBottomTab === 'messages') closeInlineMessages();
                  setViewMode('privacy');
                }}
                className={cn("transition-all hover:text-proton-text pb-1 border-b border-transparent hover:border-proton-accent cursor-pointer", viewMode === 'privacy' ? "text-proton-text border-proton-accent" : "text-proton-muted")}
              >
                {t.market.legal.privacy_policy}
              </button>
              <button 
                onClick={() => {
                  if (activeBottomTab === 'messages') closeInlineMessages();
                  setViewMode('terms');
                }}
                className={cn("transition-all hover:text-proton-text pb-1 border-b border-transparent hover:border-proton-accent cursor-pointer", viewMode === 'terms' ? "text-proton-text border-proton-accent" : "text-proton-muted")}
              >
                {t.market.legal.terms_of_service}
              </button>
              <a href="#" className="text-proton-muted hover:text-proton-text transition-all pb-1 border-b border-transparent hover:border-proton-accent">Security Protocol</a>
              <a href="#" className="text-proton-muted hover:text-proton-text transition-all pb-1 border-b border-transparent hover:border-proton-accent">System Support</a>
            </div>
          </div>
        </div>
      </footer>
    </motion.div>
  </div>

  {/* Mobile Filters Bottom Sheet (Top-level MarketHub layer) */}
  <MobileFilterBottomSheet
    isOpen={isFiltersOpen}
    onClose={() => setIsFiltersOpen(false)}
    language={language}
    activeFiltersCount={activeFiltersCount}
    onClearFilters={clearFilters}
    matchCount={filteredListings.length}
    sheetRef={filtersDrawerRef}
    sortBy={sortBy}
    setSortBy={setSortBy}
  >
    <MarketFilterPanel
      language={language}
      t={t}
      currentTheme={currentTheme}
      activeFiltersCount={activeFiltersCount}
      activeListingType={activeListingType}
      setActiveListingType={handleSelectListingType}
      activeCategory={activeCategory}
      setActiveCategory={setActiveCategory}
      activeCountry={activeCountry}
      setActiveCountry={setActiveCountry}
      activeCity={activeCity}
      setActiveCity={setActiveCity}
      minPrice={minPrice}
      setMinPrice={setMinPrice}
      maxPrice={maxPrice}
      setMaxPrice={setMaxPrice}
      displayCurrency={displayCurrency}
      clearFilters={clearFilters}
      sortBy={sortBy}
      setSortBy={setSortBy}
    />
  </MobileFilterBottomSheet>

  {/* Shopping Cart Drawer */}
  <CartDrawer
    isOpen={isCartOpen}
    onClose={() => !isPlacingCartOrders && setIsCartOpen(false)}
    drawerRef={cartDrawerRef}
    language={language}
    currentTheme={currentTheme}
    cart={cart}
    cartTotal={cartTotal}
    displayCurrency={displayCurrency}
    priceMap={priceMap}
    convertPrice={convertPrice}
    isPlacingCartOrders={isPlacingCartOrders}
    cartServiceInstructions={cartServiceInstructions}
    onUpdateServiceInstruction={(itemId, instruction) => {
      setCartServiceInstructions(prev => ({ ...prev, [itemId]: instruction }));
    }}
    shippingDetails={shippingDetails}
    onChangeShippingDetails={setShippingDetails}
    onRemoveFromCart={handleRemoveFromCart}
    onCheckout={handleCartCheckout}
  />

  {/* Listing Details Modal (Opens before Checkout) */}
  <ListingDetailsModal
    listing={selectedListing}
    onClose={() => setSelectedListing(null)}
    modalRef={listingDetailsModalRef}
    user={user}
    language={language}
    t={t}
    currentTheme={currentTheme}
    displayCurrency={displayCurrency}
    priceMap={priceMap}
    convertPrice={convertPrice}
    sellerRating={selectedListing ? sellerRatings[selectedListing.sellerId] : undefined}
    isInCart={Boolean(selectedListing && cart.some(item => item.id === selectedListing.id))}
    isFavorite={Boolean(selectedListing && favoritesSet.has(selectedListing.id))}
    onToggleFavorite={toggleFavorite}
    onSelectVendor={setSelectedVendor}
    onAddToCart={handleAddToCart}
    onStartChat={handleStartChat}
    onBuyNow={handleBuyNow}
    onStartEdit={startEdit}
    onDeleteListing={handleDeleteListing}
  />

  {/* Single Item Checkout Modal */}
  <CheckoutModal
    checkoutItem={checkoutItem}
    onClose={() => !isCheckingOut && setCheckoutItem(null)}
    modalRef={singleCheckoutModalRef}
    language={language}
    t={t}
    currentTheme={currentTheme}
    cart={cart}
    onViewCart={() => {
      setCheckoutItem(null);
      setIsCartOpen(true);
    }}
    displayCurrency={displayCurrency}
    priceMap={priceMap}
    convertPrice={convertPrice}
    buyerInstructions={buyerInstructions}
    onChangeBuyerInstructions={setBuyerInstructions}
    shippingDetails={shippingDetails}
    onChangeShippingDetails={setShippingDetails}
    isCheckingOut={isCheckingOut}
    onConfirmPurchase={processPurchase}
    onStartChat={(item) => {
      setCheckoutItem(null);
      handleStartChat(item);
    }}
  />

  {/* Direct Buyer-Seller Chat Drawer (Suppressed when inline Messages view is active) */}
  <MarketChatDrawer
    activeChatListing={isDrawerChatOpen ? activeChatListing : null}
    activeChatOrder={activeChatOrder ? {
      orderId: activeChatOrder.id,
      buyerId: activeChatOrder.buyerId,
      sellerId: activeChatOrder.sellerId,
      listingId: activeChatOrder.listingId,
      itemTitle: activeChatOrder.itemTitle || activeChatListing?.title,
      amount: activeChatOrder.amount,
      currency: activeChatOrder.currency,
      status: activeChatOrder.status
    } : null}
    onClose={() => {
      setActiveChatListing(null);
      setActiveChatContext(null);
      setActiveChatOrder(null);
    }}
    onViewOrder={handleViewOrderFromChat}
    chatModalRef={chatModalRef}
    language={language}
    currentTheme={currentTheme}
    user={user}
    messagesList={messagesList}
    chatMessageText={chatMessageText}
    onChangeChatMessageText={setChatMessageText}
    onSendMessage={handleSendMessage}
    buyerName={activeChatContext?.buyerName}
    conversationId={activeChatContext?.conversationId}
    isSendDisabled={!isActiveChatSendAllowed}
    onLastMessageVisibilityChange={handleDrawerLastMsgVisibility}
  />

  {/* Vendor Reviews & Rating Modal */}
  <VendorReviewsModal
    selectedVendor={selectedVendor}
    onClose={() => setSelectedVendor(null)}
    vendorModalRef={vendorModalRef}
    language={language}
    currentTheme={currentTheme}
    user={user}
    sellerRatings={sellerRatings}
    selectedVendorRatingBreakdown={selectedVendorRatingBreakdown}
    selectedVendorReviews={selectedVendorReviews}
    vendorBuyerOrderKeys={vendorBuyerOrderKeys}
    eligibleCompletedOrders={eligibleCompletedOrders}
    unreviewedCompletedOrders={unreviewedCompletedOrders}
    hasPendingOrInTransitOrder={hasPendingOrInTransitOrder}
    selectedOrderId={selectedReviewOrderId}
    onSelectOrderId={setSelectedReviewOrderId}
    onDeleteReview={handleDeleteReview}
    reviewRating={reviewRating}
    onChangeReviewRating={setReviewRating}
    reviewText={reviewText}
    onChangeReviewText={setReviewText}
    onSubmitReview={handleSubmitReview}
    isSubmittingReview={isSubmittingReview}
    isCheckingEligibility={isCheckingEligibility}
    eligibilityError={eligibilityError}
    onRetryEligibility={() => setEligibilityRetryCount(c => c + 1)}
  />

  {/* Safe Order Cancellation Confirmation Modal */}
  <CancelOrderModal
    order={orderToCancel}
    isOpen={Boolean(orderToCancel)}
    isCancelling={isCancellingOrder}
    onClose={() => !isCancellingOrder && setOrderToCancel(null)}
    onConfirmCancel={() => {
      if (orderToCancel) {
        executeOrderCancellation(orderToCancel);
      }
    }}
    isSeller={profileSubMode === 'selling'}
    language={language}
    currentTheme={currentTheme}
  />

  {/* Seller Order Details & Fulfillment Timeline Modal */}
  <OrderDetailsModal
    order={activeSellerSelectedOrder}
    isOpen={Boolean(activeSellerSelectedOrder)}
    onClose={() => setSellerSelectedOrder(null)}
    listings={listings}
    language={language}
    currentTheme={currentTheme}
    isSeller={true}
    onCancelOrder={(order) => setOrderToCancel(order)}
    onUpdateOrderStatus={handleUpdateOrderStatus}
    onOpenShipmentModal={(order) => setShipmentTrackingInput({ orderId: order.id, carrier: '', trackingNumber: '' })}
    onMessageBuyer={handleStartOrderChat}
  />

  {/* Buyer Order Details & Fulfillment Timeline Modal (Opened from Chat or Hub) */}
  <OrderDetailsModal
    order={activeBuyerSelectedOrder}
    isOpen={Boolean(activeBuyerSelectedOrder)}
    onClose={() => setBuyerSelectedOrder(null)}
    listings={listings}
    language={language}
    currentTheme={currentTheme}
    isSeller={false}
    onCancelOrder={(order) => setOrderToCancel(order)}
    onConfirmDelivery={async (order) => {
      await handleUpdateOrderStatus(order.id, 'completed');
    }}
    onMessageSeller={handleStartOrderChat}
  />

  {/* Publish Success Confirmation Modal */}
  <AnimatePresence>
    {publishSuccessModal && (
      <div 
        className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-success-dialog-title"
      >
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setPublishSuccessModal(null)}
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Dialog Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md rounded-[28px] sm:rounded-[32px] border border-proton-accent/35 bg-proton-card p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl overflow-hidden z-10"
        >
          {/* Radial glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-proton-accent/15 rounded-full blur-[80px] pointer-events-none" />

          {/* Close Button */}
          <button 
            type="button"
            onClick={() => setPublishSuccessModal(null)}
            className="absolute top-4 right-4 p-2 text-proton-muted hover:text-proton-text rounded-xl transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Success Icon */}
          <div className="w-16 h-16 rounded-2xl bg-proton-accent/15 border border-proton-accent/35 flex items-center justify-center text-proton-accent shadow-sm mb-4">
            <CheckCircle2 size={32} className="stroke-[2.5]" />
          </div>

          {/* Title */}
          <h3 
            id="publish-success-dialog-title"
            className="text-lg sm:text-xl font-black uppercase tracking-wider text-proton-text"
          >
            {language === 'ka' 
              ? (publishSuccessModal.isEdit ? 'განცხადება განახლდა!' : 'განცხადება გამოქვეყნდა!') 
              : (publishSuccessModal.isEdit ? 'Listing Updated!' : 'Listing Published!')}
          </h3>

          {/* Description */}
          <p className="text-xs font-semibold text-proton-muted mt-2 max-w-xs leading-relaxed">
            {language === 'ka' ? (
              <>
                თქვენი განცხადება <span className="text-proton-accent font-bold">"{publishSuccessModal.title}"</span> წარმატებით შეინახა და უკვე ხელმისაწვდომია მყიდველებისთვის.
              </>
            ) : (
              <>
                Your listing <span className="text-proton-accent font-bold">"{publishSuccessModal.title}"</span> was saved successfully and is now live on Proton Market.
              </>
            )}
          </p>

          {/* Navigation Options / Clear Next Steps */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-6">
            <button
              type="button"
              onClick={() => {
                setPublishSuccessModal(null);
                setProfileSubMode('selling');
                setViewMode('my-listings');
              }}
              className={cn("w-full sm:flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer font-sans", currentTheme.accentBg)}
            >
              <Package size={14} />
              <span>{language === 'ka' ? 'ჩემი განცხადებები' : 'My Listings'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPublishSuccessModal(null);
                setViewMode('browse');
              }}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-proton-bg hover:bg-proton-accent/10 text-proton-muted hover:text-proton-text border border-proton-border hover:border-proton-accent/40 transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
            >
              <LayoutGrid size={14} />
              <span>{language === 'ka' ? 'მარკეტში დაბრუნება' : 'Back to Market'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

  {/* Categories smooth slide-up accordion/overlay */}
  <AnimatePresence>
    {activeBottomTab === 'categories' && (
      <motion.div 
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-0 bg-proton-bg/98 backdrop-blur-lg z-[120] overflow-y-auto px-6 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))]"
      >
        <div className="max-w-md mx-auto space-y-5">
          <div className="flex items-center justify-between border-b border-proton-border pb-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-proton-accent flex items-center gap-2 font-sans">
              <span>📂</span> {language === 'ka' ? 'კატეგორიები' : 'Browse Categories'}
            </h2>
            <button 
              type="button"
              onClick={() => setActiveBottomTab('home')}
              className="px-3 py-1.5 rounded-xl bg-proton-card border border-proton-border text-[10px] font-black text-proton-muted hover:text-proton-text uppercase tracking-widest transition-colors cursor-pointer"
            >
              {language === 'ka' ? 'დახურვა' : 'Close'}
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-none pb-1">
            <ListingTypeTabs
              activeType={activeListingType}
              onSelectType={handleSelectListingType}
              language={language}
              theme={currentTheme}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('all');
              setActiveBottomTab('home');
              setViewMode('browse');
            }}
            className={cn(
              "w-full flex items-center justify-between p-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border text-left cursor-pointer",
              activeCategory === 'all'
                ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-md"
                : "bg-proton-card text-proton-text border-proton-border hover:border-proton-accent/40 hover:bg-proton-accent/10"
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🌍</span>
              <span>{t.market.all_categories}</span>
            </div>
            {activeCategory === 'all' && <span className="w-2 h-2 rounded-full bg-current opacity-85" />}
          </button>

          <div className="space-y-5 pb-6">
            {(activeListingType === 'all'
              ? getListingDirectionsMeta(language).map((dir) => ({
                  groupId: dir.id,
                  title: `${dir.emoji} ${dir.title}`,
                  categories: getCategoriesForListingType(dir.id, t, language),
                }))
              : getGroupedCategoriesForListingType(activeListingType, t, language)
            ).map(group => (
              <div key={group.groupId} className="space-y-2.5">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-proton-accent px-1">
                  {group.title}
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {group.categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setActiveBottomTab('home');
                        setViewMode('browse');
                      }}
                      className={cn(
                        "w-full flex flex-col justify-between p-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border text-left min-h-[72px] relative overflow-hidden group/cat cursor-pointer",
                        activeCategory === cat.id
                          ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-md"
                          : "bg-proton-card text-proton-text border-proton-border hover:border-proton-accent/40 hover:bg-proton-accent/10"
                      )}
                    >
                      <span className="text-xl shrink-0">{cat.emoji}</span>
                      <span className="mt-2 text-[9px] font-bold tracking-wider leading-none truncate w-full" title={cat.label}>{cat.label}</span>
                      {activeCategory === cat.id && <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
                    </button>
                  ))}
                </div>
              </div>
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
        ref={mobileMessagesOverlayRef}
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        style={
          mobileVisualViewport
            ? {
                height: `${mobileVisualViewport.height}px`,
                top: `${mobileVisualViewport.offsetTop}px`,
                bottom: 'auto',
              }
            : undefined
        }
        className={cn(
          "fixed inset-x-0 top-0 bottom-0 bg-proton-bg z-[120] px-3 sm:px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:hidden flex flex-col overflow-x-hidden",
          activeChatListing ? "overflow-hidden" : "overflow-y-auto"
        )}
      >
        <div
          className={cn(
            "max-w-md w-full mx-auto flex flex-col min-w-0",
            activeChatListing ? "flex-1 min-h-0" : "space-y-5 pb-4"
          )}
        >
          {/* Top Selector Panel: Hidden during active thread so ChatThreadHeader provides Back + Close cleanly */}
          {!activeChatListing && (
            <div className="flex items-center justify-between gap-2 border-b border-proton-border pb-3 shrink-0 min-w-0">
              <h2 className="text-xs font-black uppercase tracking-[0.16em] text-proton-accent flex items-center gap-2 font-sans truncate">
                <span aria-hidden="true">💬</span>
                <span className="truncate">{language === 'ka' ? 'კავშირი' : 'Communications'}</span>
              </h2>
              <button 
                type="button"
                onClick={closeInlineMessages}
                className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-proton-card border border-proton-border text-xs font-bold text-proton-text hover:bg-proton-accent/10 hover:border-proton-accent/40 transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5 active:scale-95"
                aria-label={language === 'ka' ? 'დახურვა' : 'Close'}
              >
                <X size={15} className="shrink-0" />
                <span>{language === 'ka' ? 'დახურვა' : 'Close'}</span>
              </button>
            </div>
          )}

          {/* Inner active screen selector or dual panel */}
          <div className={cn("min-w-0", activeChatListing ? "flex-1 min-h-0 flex flex-col" : "space-y-6")}>
            {activeChatListing ? (
              // Active Chat Thread using Shared Chat Components
              <div className="flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3 min-w-0">
                <ChatThreadHeader
                  listing={activeChatListing}
                  order={
                    activeChatOrder
                      ? {
                          orderId: activeChatOrder.id,
                          itemTitle: activeChatOrder.itemTitle || activeChatListing.title,
                          amount: activeChatOrder.amount,
                          currency: activeChatOrder.currency,
                          status: activeChatOrder.status,
                        }
                      : null
                  }
                  currentUserId={user?.uid}
                  buyerName={activeChatContext?.buyerName}
                  sellerName={activeChatContext?.sellerName || activeChatListing.sellerName}
                  language={language}
                  currentTheme={currentTheme}
                  onBack={() => {
                    setActiveChatListing(null);
                    setActiveChatContext(null);
                    setActiveChatOrder(null);
                  }}
                  onClose={closeInlineMessages}
                  onViewOrder={handleViewOrderFromChat}
                  showInquiryTerms={Boolean(listings.some((l) => l.id === activeChatListing.id))}
                />

                <ChatMessageList
                  messages={messagesList}
                  currentUserId={user?.uid}
                  isSellerViewing={Boolean(
                    user?.uid &&
                      user.uid === (activeChatContext?.sellerId || activeChatListing.sellerId)
                  )}
                  language={language}
                  emptyStateAction={setChatMessageText}
                  conversationKey={
                    activeChatContext?.conversationId ||
                    `${activeChatListing.id}_${activeChatOrder?.id || ''}`
                  }
                  onLastMessageVisibilityChange={handleMobileLastMsgVisibility}
                />

                <ChatComposer
                  value={chatMessageText}
                  onChange={setChatMessageText}
                  onSubmit={handleSendMessage}
                  language={language}
                  currentTheme={currentTheme}
                  disabled={!isActiveChatSendAllowed}
                  placeholder={
                    language === 'ka'
                      ? 'დაწერეთ შეთავაზება ან შეკითხვა...'
                      : 'Propose a price or ask a question...'
                  }
                />
              </div>
            ) : (
              // Chats and Orders List
              <div className="space-y-6 min-w-0">
                {chatResolutionError && (
                  <div
                    role="alert"
                    className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-rose-400"
                  >
                    <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-proton-text">
                        {language === 'ka' ? 'საუბრის გახსნა ვერ მოხერხდა' : 'Unable to Open Conversation'}
                      </p>
                      <p className="mt-0.5 leading-relaxed">{chatResolutionError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChatResolutionError(null)}
                      aria-label={language === 'ka' ? 'დახურვა' : 'Dismiss'}
                      className="p-1 rounded-lg hover:bg-rose-500/15 text-rose-400 shrink-0 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {/* Conversations via Shared ChatThreadList */}
                <div className="space-y-3 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <h3 className="text-xs font-black uppercase tracking-wider text-proton-accent truncate">
                      {language === 'ka' ? 'ჩატების სია' : 'Direct Messages'}
                    </h3>
                    {desktopChatThreads.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-proton-card border border-proton-border text-[11px] font-bold text-proton-text tabular-nums shrink-0">
                        {desktopChatThreads.length}
                      </span>
                    )}
                  </div>

                  <ChatThreadList
                    threads={desktopChatThreads}
                    activeConversationId={activeChatContext?.conversationId}
                    currentUserId={user?.uid}
                    unreadByConversationId={unreadByConversationId}
                    language={language}
                    currentTheme={currentTheme}
                    onSelectThread={handleSelectDesktopThread}
                    onBrowseMarket={() => {
                      closeInlineMessages();
                      setViewMode('browse');
                    }}
                  />
                </div>


                {/* Orders Status */}
                <div className="space-y-3 min-w-0">
                  <h3 className="text-xs font-black uppercase tracking-wider text-proton-accent flex items-center gap-1.5">
                    <span aria-hidden="true">📦</span>
                    <span>{language === 'ka' ? 'თქვენი შეკვეთები' : 'Transactions & Orders'}</span>
                  </h3>

                  {buyerOrders.length === 0 && sellerOrders.length === 0 ? (
                    <div className="bg-proton-card border border-proton-border p-5 rounded-2xl text-center">
                      <p className="text-xs font-semibold text-proton-muted">
                        {language === 'ka' ? 'შეკვეთები არ ფიქსირდება' : 'No purchase orders yet'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {/* Purchases */}
                      {buyerOrders.map((order, idx) => (
                        <div key={order.id || idx} className="bg-proton-card border border-proton-border p-3.5 rounded-2xl flex flex-col gap-2 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded bg-proton-bg text-[11px] font-bold text-proton-accent border border-proton-border font-mono uppercase">
                              {language === 'ka' ? 'შესყიდვა' : 'PURCHASE'}
                            </span>
                            <span className="text-[11px] font-bold text-emerald-500 uppercase font-mono tracking-wider">
                              {order.status || 'Success'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-proton-text break-words">{order.itemTitle || (order as any).listingTitle || 'Proton Asset'}</h5>
                            <p className="text-xs text-proton-muted font-medium mt-0.5">
                              {language === 'ka' ? 'ჯამი:' : 'Total:'}{' '}
                              <span className="text-proton-text font-bold tabular-nums">{order.amount ?? (order as any).price} {order.currency}</span>
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Sales */}
                      {sellerOrders.map((order, idx) => (
                        <div key={order.id || idx} className="bg-proton-card border border-proton-border p-3.5 rounded-2xl flex flex-col gap-2 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded bg-proton-accent/15 text-[11px] font-bold text-proton-accent border border-proton-accent/30 font-mono uppercase">
                              {language === 'ka' ? 'გაყიდვა' : 'SALE'}
                            </span>
                            <span className="text-[11px] font-bold text-emerald-500 uppercase font-mono tracking-wider">
                              {order.status || 'Received'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-proton-text break-words">{order.itemTitle || (order as any).listingTitle || 'Proton Asset'}</h5>
                            <p className="text-xs text-proton-muted font-medium mt-0.5">
                              {language === 'ka' ? 'შემოსავალი:' : 'Incoming:'}{' '}
                              <span className="text-proton-accent font-bold tabular-nums">{order.amount ?? (order as any).price} {order.currency}</span>
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
</div>
  );
});

export default MarketHub;

