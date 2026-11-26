
import { SecurityPinMeta } from './lib/securityUtils';

export type SupportedCurrency = 'USD' | 'EUR' | 'GEL' | 'GBP' | 'JPY' | 'CNY';

export const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = ['USD', 'EUR', 'GEL', 'GBP', 'JPY', 'CNY'] as const;

export function resolvePreferredCurrency(currency?: string | null): SupportedCurrency {
  if (typeof currency === 'string') {
    const upper = currency.trim().toUpperCase() as SupportedCurrency;
    if ((SUPPORTED_CURRENCIES as readonly string[]).includes(upper)) {
      return upper;
    }
  }
  return 'USD';
}

export type UserProfile = {
  id?: string;
  name: string;
  email: string;
  language: 'en' | 'ka';
  region: string;
  notifications: boolean;
  notificationsEnabled?: boolean;
  phoneNumber?: string;
  bio?: string;
  avatar?: string;
  role?: string;
  theme?: Theme;
  themeSchedule?: ThemeSchedule;
  preferredCurrency?: SupportedCurrency;
  showCommercialHub?: boolean;
  country?: string;
  competitionOptOut?: boolean;
  securityPinEnabled?: boolean;
  securityPinMeta?: SecurityPinMeta;
};

export type GlobalAiSettings = {
  temperature: number;
  enableSearch: boolean;
  enableMaps: boolean;
  zenMode: boolean;
  systemInstruction?: string;
  voice: string;
  customApiKey?: string;
};

export type ChatMessage = { id: string, role: 'user' | 'model', content: string, timestamp: number };
export type PersonaHistory = { [personaId: string]: ChatMessage[] };

export type Persona = {
  id: string;
  name: string;
  nameGe: string;
  role: string;
  roleGe?: string;
  description: string;
  descriptionGe: string;
  systemInstruction: string;
  avatar: string;
  language: 'English' | 'Georgian' | 'Mixed';
};

export type WorkflowStep = {
  id: string;
  label: string;
  description: string;
};

export type Workflow = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  personaId: string;
  analysisHistory?: { timestamp: number; result: string }[];
  nodes?: any[];
  edges?: any[];
  steps?: WorkflowStep[];
  status?: 'active' | 'inactive';
  lastRun?: number;
  description?: string;
};

export type Theme = 'auto' | 'enterprise' | 'proton' | 'light' | 'vibrant' | 'midnight' | 'titanium' | 'forest' | 'sunset' | 'rose';

export interface ThemeSchedule {
  enabled: boolean;
  dayStart: string; // e.g. "09:00"
  dayEnd: string;   // e.g. "19:00"
  dayTheme: Theme;  // e.g. "light" or "enterprise"
  nightTheme: Theme; // e.g. "proton" or "midnight"
}

export type LogEntry = {
  id: string;
  timestamp: number;
  type: 'info' | 'error' | 'warning';
  message: string;
  data?: any;
};

export interface GeminiMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  modelName?: string;
  latency?: number;
}

export type View = 'landing' | 'translator' | 'dashboard' | 'compute' | 'personas' | 'blueprints' | 'workflows' | 'profile' | 'settings' | 'image' | 'organizer' | 'documentation' | 'market' | 'commercial' | 'market-hub' | 'finance' | 'business-hub' | 'creative-studio' | 'copywriting' | 'clips';

export type Task = {
  id: string;
  content: string;
  contentGe?: string;
  completed: boolean;
  isAiSuggested?: boolean;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  timestamp?: number;
  description?: string;
  descriptionGe?: string;
  dueDate?: number;
  subtasks?: { id: string; content: string; completed: boolean }[];
  recurring?: 'none' | 'daily' | 'weekly' | 'monthly';
  energyCost?: 'low' | 'medium' | 'high';
  estimatedTime?: number; // in minutes
  elapsedTime?: number; // in seconds
  orderId?: string;
  orderAmount?: number;
  projectId?: string;
  metadata?: {
    orderId?: string;
    amount?: number;
    [key: string]: any;
  };
};

export interface Project {
  id: string;
  name: string;
  nameGe?: string;
  description?: string;
  descriptionGe?: string;
  color?: string;
  icon?: string;
  targetDate?: number;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
}

export type ListingType = 'product' | 'service' | 'project';
export type ListingStatus = 'active' | 'reserved' | 'sold' | 'low_stock' | string;
export type ListingClassification =
  | 'product'
  | 'service'
  | 'project_asset'
  | 'job'
  | 'collaboration'
  | 'project';

export type Listing = {
  id: string;
  title: string;
  titleGe?: string;
  titleEn?: string;
  primaryLanguage?: 'ka' | 'en';
  description: string;
  descriptionGe?: string;
  price: number;
  priceUnspecified?: boolean;
  currency: string;
  sellerId: string;
  sellerName: string;
  authorName?: string;
  tags?: string[];
  image?: string;
  images?: string[];
  category: string;
  location: string;
  country: string;
  city: string;
  lat?: number;
  lng?: number;
  createdAt: number;
  status: ListingStatus;
  isSold?: boolean;
  activeOrderId?: string;
  condition?: 'new' | 'used' | 'refurbished' | string;
  isNegotiable?: boolean;
  listingType?: ListingType;
  isRemote?: boolean;
  attributes?: Record<string, string | number | boolean>;
  serviceDuration?: string;
  serviceTerms?: string;
  stock?: number;
  quantity?: number;
};

export interface ShippingDetails {
  recipientName: string;
  phone: string;
  city: string;
  address: string;
  notes?: string;
}

export interface TrackingInfo {
  carrier?: string;
  trackingNumber?: string;
  shippedAt?: number;
}

export type SellerOrderFilter = 'all' | 'action-required' | 'processing' | 'shipped' | 'completed';
export type BuyerOrderFilter = 'all' | 'action-required' | 'processing' | 'shipped' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  currency: string;
  itemTitle: string;
  status: 'booked' | 'completed' | 'pending' | 'processing' | 'shipped' | 'cancelled' | 'delivered' | string;
  orderType?: 'service' | 'product' | 'project' | string;
  buyerInstructions?: string;
  shippingDetails?: ShippingDetails;
  trackingInfo?: TrackingInfo;
  createdAt: any;
  source?: string;
  clipId?: string;
  grossAmount?: number;
  platformFee?: number;
  netAmount?: number;
  buyerName?: string;
  quantity?: number;
  deliveryAddress?: string;
  paymentMethod?: string;
}

export type MarketplaceItem = Listing;

export interface ClipComment {
  id: string;
  clipId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: any;
}

export interface Clip {
  id: string;
  videoUrl: string;
  caption: string;
  soundName?: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  thumbnailUrl?: string;
  duration?: number;
  likesCount?: number;
  likes?: string[];
  commentsCount?: number;
  createdAt: any;
  productId?: string;
  productInfo?: {
    id: string;
    title: string;
    price: number;
    image?: string;
    category?: string;
  };
  trimStart?: number;
  trimEnd?: number;
}

export interface ClipIssue {
  id: string;
  type: 'black_frame' | 'silence' | 'shaky_cam' | 'low_lighting' | 'unwanted_intro';
  titleEn: string;
  titleKa: string;
  descriptionEn: string;
  descriptionKa: string;
  suggestedActionEn: string;
  suggestedActionKa: string;
  startSec: number;
  endSec: number;
}

export type NotificationCategory = 'system' | 'market' | 'ai' | 'tasks';

export interface NotificationItem {
  id: string;
  title: string;
  titleKa?: string;
  message: string;
  messageKa?: string;
  timestamp: number;
  read: boolean;
  category: NotificationCategory;
  targetView?: View;
  actionUrl?: string;
  type?: string;
  orderId?: string;
  listingId?: string;
  buyerId?: string;
  sellerId?: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

export type AnalyticsPeriod = '24h' | '7d' | '30d' | 'all';

export type RankingScope = 'global' | 'country' | 'category' | 'regional' | 'listingType';

export type ListingTypeFilter = 'all' | ListingType;

export type RankingPeriod = '7d' | '30d';

export type AchievementBadgeId =
  | 'rising_listing'
  | 'popular_listing'
  | 'top_in_category'
  | 'global_recognition';

export interface PeriodMetrics {
  impressions: number;
  views: number;
  uniqueViewers: number;
  engagementRate: number;
}

export interface ViewerSegmentMetrics {
  authImpressions: number;
  authViews: number;
  authUniqueViewers: number;
  guestImpressions: number;
  guestViews: number;
  guestUniqueViewers: number;
}

export interface ListingViewerBreakdown {
  breakdownSince?: number;
  periods: Record<AnalyticsPeriod, ViewerSegmentMetrics>;
}

export interface PeriodComparison {
  impressionsDelta: number;
  viewsDelta: number;
  uniqueViewersDelta: number;
  engagementRateDelta: number;
  impressionsChangePct: number | null;
  viewsChangePct: number | null;
  uniqueViewersChangePct: number | null;
}

export interface ListingAnalyticsStats {
  listingId: string;
  title: string;
  titleGe?: string;
  category: string;
  listingType?: ListingType;
  image?: string;
  status?: string;
  optedOut: boolean;
  createdAt: number;
  updatedAt: number;
  periods: Record<AnalyticsPeriod, PeriodMetrics>;
  comparisons: Record<'24h' | '7d' | '30d', PeriodComparison>;
  achievements: AchievementBadgeId[];
  viewerBreakdown?: ListingViewerBreakdown;
}

export interface EarnedAchievementEntry {
  id: AchievementBadgeId;
  listingId: string;
  listingTitle: string;
  listingTitleGe?: string;
  category: string;
}

export interface SellerAnalyticsOverview {
  totalImpressions: number;
  totalViews: number;
  totalUniqueViewers: number;
  engagementRate: number;
  periodTotals: Record<AnalyticsPeriod, PeriodMetrics>;
  periodComparisons: Record<'24h' | '7d' | '30d', PeriodComparison>;
  listings: ListingAnalyticsStats[];
  competitionOptOut: boolean;
  earnedAchievements: EarnedAchievementEntry[];
  viewerBreakdown?: ListingViewerBreakdown;
  isPartialData: boolean;
  truncationReason?: string;
}

export interface RankingEntry {
  rank: number;
  listingId: string;
  title: string;
  titleGe?: string;
  category: string;
  listingType?: ListingType;
  image?: string;
  sellerName: string;
  country?: string;
  region?: string;
  impressions: number;
  views: number;
  uniqueViewers: number;
  engagementRate: number;
  categoryNormalizedScore: number;
  sellerRatingAvg?: number;
  sellerRatingCount?: number;
  freshnessBoost: number;
  balancedScore: number;
  achievements: AchievementBadgeId[];
  period: RankingPeriod;
}

export type MarketFunnelEventType =
  | 'seller_profile_view'
  | 'listing_to_seller'
  | 'contact_click'
  | 'contact_confirmed'
  | 'order_intent'
  | 'order_confirmed';

export interface SellerFunnelMetrics {
  // Seller profile / vendor modal views (Total vs Unique + Guest/Auth)
  profileViews: number;
  uniqueProfileViewers: number;
  authProfileViews: number;
  guestProfileViews: number;
  authUniqueProfileViewers: number;
  guestUniqueProfileViewers: number;

  // Listing -> Seller discovery transitions (Total vs Unique + Guest/Auth)
  listingToSellerClicks: number;
  uniqueListingToSellerUsers: number;
  authListingToSellerClicks: number;
  guestListingToSellerClicks: number;
  authUniqueListingToSellerUsers?: number;
  guestUniqueListingToSellerUsers?: number;

  // UI Click / Intention events (distinct from confirmed backend actions)
  contactClicks: number;
  uniqueContactClickers: number;
  authContactClicks: number;
  guestContactClicks: number;
  authUniqueContactClickers: number;
  guestUniqueContactClickers: number;

  orderIntents: number;
  uniqueOrderIntentUsers: number;
  authOrderIntents: number;
  guestOrderIntents: number;
  authUniqueOrderIntentUsers: number;
  guestUniqueOrderIntentUsers: number;

  // Verified / Confirmed backend actions (Auth-only DB-backed truth)
  contactConfirmed: number;
  uniqueContactedBuyers: number;
  ordersConfirmed: number;
  uniqueOrderBuyers: number;

  // Guest -> Auth identity links attributed to this seller
  guestToAuthLinks: number;
}

export interface SellerAnalyticsMetadata {
  schemaVersion: number;
  sellerName?: string;
  lastEventAt?: number;
}

export interface SellerAudienceCounters {
  totalImpressions: number;
  totalViews: number;
  uniqueViewers: number;
  authImpressions: number;
  authViews: number;
  authUniqueViewers: number;
  guestImpressions: number;
  guestViews: number;
  guestUniqueViewers: number;
}

export interface SellerAnalyticsTotalCounters {
  totalEvents: number;
  totalUniqueUsers: number;
  authEvents: number;
  guestEvents: number;
  authUniqueUsers: number;
  guestUniqueUsers: number;
}

export interface SellerAnalyticsBucket extends Partial<SellerFunnelMetrics> {
  audienceImpressions?: number;
  audienceViews?: number;
  audienceUniqueViewers?: number;
  authAudienceImpressions?: number;
  authAudienceViews?: number;
  authAudienceUniqueViewers?: number;
  guestAudienceImpressions?: number;
  guestAudienceViews?: number;
  guestAudienceUniqueViewers?: number;
  totalEvents?: number;
  uniqueUsers?: number;
  authEvents?: number;
  guestEvents?: number;
  authUniqueUsers?: number;
  guestUniqueUsers?: number;
}

export interface SellerAnalyticsDoc extends SellerFunnelMetrics {
  sellerId: string;
  metadata?: SellerAnalyticsMetadata;
  optedOut: boolean;
  country?: string;
  region?: string;
  funnelTrackingSince: number;
  audience?: SellerAudienceCounters;
  totals?: SellerAnalyticsTotalCounters;
  hourly?: Record<string, SellerAnalyticsBucket>;
  daily?: Record<string, SellerAnalyticsBucket>;
  createdAt: number;
  updatedAt: number;
}

export interface SellerViewerDoc {
  viewerHash: string;
  viewerType: 'auth' | 'guest';
  firstSeenAt: number;
  lastSeenAt: number;
  firstProfileViewAt?: number;
  lastProfileViewAt?: number;
  firstListingToSellerAt?: number;
  lastListingToSellerAt?: number;
  firstContactClickAt?: number;
  lastContactClickAt?: number;
  firstOrderIntentAt?: number;
  lastOrderIntentAt?: number;
  firstContactConfirmedAt?: number;
  firstOrderConfirmedAt?: number;
  firstAudienceAt?: number;
  lastAudienceAt?: number;
}

export interface GuestSessionIndexDoc {
  guestHash: string;
  listingIds: string[];
  sellerIds: string[];
  linkedUid: string | null;
  createdAt: number;
  updatedAt: number;
  linkedAt: number | null;
  expiresAt: number;
}

export interface GuestSessionClaimResult {
  status: 200 | 400 | 409;
  claimed: boolean;
  idempotent?: boolean;
  reason?: 'no_guest_session' | 'visitor_already_claimed' | 'invalid_request';
  linkedUid?: string;
  listingIds?: string[];
  sellerIds?: string[];
}

export type VerifiedMarkerType = 'contact_confirmed' | 'order_confirmed';

export interface VerifiedFunnelMarkerDoc {
  markerId: string;
  markerType: VerifiedMarkerType;
  sellerId: string;
  buyerHash: string;
  sourceId: string;
  listingId?: string;
  recordedAt: number;
}

export interface VerifiedMarkerClaimResult {
  created: boolean;
  duplicate: boolean;
  markerId: string;
}

