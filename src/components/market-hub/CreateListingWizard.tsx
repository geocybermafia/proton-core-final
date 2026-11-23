import React from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  ShieldCheck,
  ChevronDown,
  Coins,
  Tag,
  MapPin,
  Sparkles,
  Loader2,
  Camera,
  Link,
  ArrowLeft,
  ChevronRight,
  Trash2,
  Eye,
  Edit3,
  AlertCircle,
  Globe,
  Check
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  MarketTheme,
  CURRENCIES,
  WORLD_COUNTRIES,
  CATEGORY_EMOJIS,
  canInferListingTypeFromCategory,
  getCategoriesForListingType,
  getCategoryLabel,
  getDefaultCategoryForType,
  inferListingType,
  isCategoryValidForType,
  roundPriceForDisplayCurrency
} from './MarketConstants';
import {
  getCategoryFormSchema,
  getDefaultIsRemoteForSchema,
  filterAttributesForSchema,
  sanitizeListingAttributes,
  validateSchemaAttributes,
  getFormattedListingAttributes
} from './ListingSchemas';
import { DynamicAttributesSection } from './DynamicAttributesSection';
import { Listing } from '../../types';
import { MarketListingCard } from './MarketListingCard';
import { FastInput, FastTextarea } from './FastInputs';
import { MapPicker } from '../MapPicker';
import { useToast } from '../Toast';
import { auth } from '../../firebase';

const AVAILABLE_COUNTRY_OPTIONS = WORLD_COUNTRIES.filter(c => c.code !== 'GLOBAL');

export interface ListingFormData {
  title: string;
  titleGe: string;
  primaryLanguage?: 'ka' | 'en';
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
  isRemote: boolean;
  attributes: Record<string, string | number | boolean>;
  serviceDuration: string;
  serviceTerms: string;
}

export interface CreateListingWizardProps {
  viewMode: 'create' | 'edit' | string;
  language: string;
  t: any;
  currentTheme: MarketTheme;
  formStep: number;
  setFormStep: React.Dispatch<React.SetStateAction<number>>;
  formData: ListingFormData;
  setFormData: React.Dispatch<React.SetStateAction<ListingFormData>>;
  isSubmitting: boolean;
  handleSubmitListing: (e: React.FormEvent) => void;
  resetListingForm: () => void;
  setViewMode: (mode: any) => void;
  isResizing: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isAiGenerating: boolean;
  handleAiDescription: () => void;
  displayCurrency?: string;
  convertPrice?: (price: number, from: string, to: string) => number;
  sellerName?: string;
  sellerRating?: { avg: number; count: number };
}

export const CreateListingWizard: React.FC<CreateListingWizardProps> = ({
  viewMode,
  language,
  t,
  currentTheme,
  formStep,
  setFormStep,
  formData,
  setFormData,
  isSubmitting,
  handleSubmitListing,
  resetListingForm,
  setViewMode,
  isResizing,
  handleFileUpload,
  isAiGenerating,
  handleAiDescription,
  displayCurrency,
  convertPrice,
  sellerName,
  sellerRating,
}) => {
  const { showToast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const previewImgRef = React.useRef<HTMLImageElement | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [showSecondaryTitle, setShowSecondaryTitle] = React.useState(false);
  const [showAdditionalTerms, setShowAdditionalTerms] = React.useState(false);
  const [showExactLocation, setShowExactLocation] = React.useState(false);
  
  // Draft Save & Recovery State
  const [draftStatus, setDraftStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasCheckedDraft, setHasCheckedDraft] = React.useState(false);
  const [savedDraftData, setSavedDraftData] = React.useState<{ formStep: number; formData: ListingFormData; updatedAt: number } | null>(null);

  const userId = auth.currentUser?.uid || 'guest';
  const draftStorageKey = `proton_markethub_draft_v1_${userId}`;

  React.useEffect(() => {
    if (viewMode === 'create' && !hasCheckedDraft) {
      setHasCheckedDraft(true);
      try {
        const raw = localStorage.getItem(draftStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === 1 && parsed.formData) {
            const hasData = Boolean(
              (parsed.formData.title && parsed.formData.title.trim()) ||
              (parsed.formData.titleGe && parsed.formData.titleGe.trim()) ||
              (parsed.formData.description && parsed.formData.description.trim()) ||
              (parsed.formData.price && Number(parsed.formData.price) > 0)
            );
            if (hasData) {
              setSavedDraftData(parsed);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load listing draft', e);
      }
    }
  }, [viewMode, draftStorageKey, hasCheckedDraft]);

  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (viewMode !== 'create') return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const hasData = Boolean(
      (formData.title && formData.title.trim()) ||
      (formData.titleGe && formData.titleGe.trim()) ||
      (formData.description && formData.description.trim()) ||
      (formData.price && Number(formData.price) > 0) ||
      (formData.images && formData.images.length > 0)
    );

    if (!hasData) return;

    setDraftStatus('saving');
    const timer = setTimeout(() => {
      try {
        const payload = {
          version: 1,
          updatedAt: Date.now(),
          formStep,
          formData,
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(payload));
        setDraftStatus('saved');
        const resetTimer = setTimeout(() => setDraftStatus('idle'), 3000);
        return () => clearTimeout(resetTimer);
      } catch (e) {
        console.error('Failed to save listing draft', e);
        setDraftStatus('error');
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [formData, formStep, viewMode, draftStorageKey]);

  const previewImageUrl = formData.images?.[0] || '';
  const [isPreviewLoaded, setIsPreviewLoaded] = React.useState(false);
  const [previewHasError, setPreviewHasError] = React.useState(false);
  const [previewNeedsBackdrop, setPreviewNeedsBackdrop] = React.useState(false);

  const handlePreviewImageReady = React.useCallback((img: HTMLImageElement) => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w > 0 && h > 0) {
      const naturalRatio = w / h;
      const boxW = img.clientWidth;
      const boxH = img.clientHeight;
      const boxRatio = boxW > 0 && boxH > 0 ? boxW / boxH : 4 / 3;
      const fillRatio = Math.min(naturalRatio / boxRatio, boxRatio / naturalRatio);
      setPreviewNeedsBackdrop(1 - fillRatio > 0.06);
    } else {
      setPreviewNeedsBackdrop(false);
    }
    setPreviewHasError(false);
    setIsPreviewLoaded(true);
  }, []);

  React.useEffect(() => {
    setIsPreviewLoaded(false);
    setPreviewHasError(false);
    setPreviewNeedsBackdrop(false);

    const img = previewImgRef.current;
    if (previewImageUrl && img && img.complete && img.naturalWidth > 0) {
      handlePreviewImageReady(img);
    }
  }, [previewImageUrl, handlePreviewImageReady]);

  const activeSchema = React.useMemo(
    () => getCategoryFormSchema(formData.listingType, formData.category),
    [formData.listingType, formData.category]
  );

  const effectiveIsRemote = React.useMemo(
    () =>
      activeSchema.locationMode === 'remote' ||
      (activeSchema.locationMode === 'flexible' && Boolean(formData.isRemote)),
    [activeSchema.locationMode, formData.isRemote]
  );

  React.useEffect(() => {
    setFieldErrors({});
  }, [formData.category, formData.listingType, viewMode]);

  const clearFieldError = React.useCallback((key: string) => {
    setFieldErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleAttributeChange = React.useCallback(
    (key: string, value: string | number | boolean | undefined) => {
      setFormData(prev => {
        const nextAttrs = { ...(prev.attributes || {}) };
        if (value === undefined || value === null || value === '') {
          delete nextAttrs[key];
        } else {
          nextAttrs[key] = value;
        }

        let nextIsRemote = prev.isRemote;
        if (activeSchema.locationMode === 'flexible') {
          if ((key === 'deliveryFormat' || key === 'employmentFormat') && value === 'remote') {
            nextIsRemote = true;
          } else if (
            (key === 'deliveryFormat' || key === 'employmentFormat') &&
            (value === 'onsite' || value === 'hybrid')
          ) {
            nextIsRemote = false;
          }
        }

        return {
          ...prev,
          isRemote: nextIsRemote,
          attributes: nextAttrs,
        };
      });
    },
    [activeSchema.locationMode, setFormData]
  );

  const handleRemovePhoto = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFormData(prev => ({
      ...prev,
      images: []
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showToast(
      language === 'ka' ? 'სურათი წაიშალა' : 'Photo removed',
      'info'
    );
  };

  const resolvedLocationForPreview = React.useMemo(() => {
    const rawCity = (formData.city || '').trim();
    const rawCountry = (formData.country || '').trim();
    const rawLocation = (formData.location || '').trim();
    if (effectiveIsRemote) {
      const hasRealCity = Boolean(rawCity && rawCity.toLowerCase() !== 'online');
      if (!hasRealCity) {
        return {
          country: 'GLOBAL',
          city: 'Online',
          location: rawLocation || 'Online / Remote',
        };
      }
      return {
        country: rawCountry || 'GLOBAL',
        city: rawCity,
        location: rawLocation || `${rawCity}, ${rawCountry || 'GLOBAL'}`,
      };
    }
    return {
      country: rawCountry,
      city: rawCity,
      location: rawLocation,
    };
  }, [effectiveIsRemote, formData.city, formData.country, formData.location]);

  const selectedCountry = React.useMemo(() => {
    return WORLD_COUNTRIES.find(c => c.code === resolvedLocationForPreview.country);
  }, [resolvedLocationForPreview.country]);

  const conditionLabel = React.useMemo(() => {
    if (formData.condition === 'new') return language === 'ka' ? 'ახალი' : 'Brand New';
    if (formData.condition === 'used') return language === 'ka' ? 'მეორადი' : 'Used';
    if (formData.condition === 'refurbished') return language === 'ka' ? 'აღდგენილი' : 'Restored';
    return formData.condition || (language === 'ka' ? 'ახალი' : 'New');
  }, [formData.condition, language]);

  const uiPrimaryLang: 'ka' | 'en' = language === 'ka' ? 'ka' : 'en';

  const activeFormPrimaryLang: 'ka' | 'en' = React.useMemo(() => {
    const rawTitleEn = (formData.title || '').trim();
    const rawTitleGe = (formData.titleGe || '').trim();
    if (viewMode === 'edit') {
      if (formData.primaryLanguage === 'ka' && !rawTitleGe && rawTitleEn) return 'en';
      if (formData.primaryLanguage === 'en' && !rawTitleEn && rawTitleGe) return 'ka';
      if (formData.primaryLanguage === 'ka' || formData.primaryLanguage === 'en') {
        return formData.primaryLanguage;
      }
      return uiPrimaryLang;
    }
    if (uiPrimaryLang === 'ka' && !rawTitleGe && rawTitleEn && formData.primaryLanguage === 'en') {
      return 'en';
    }
    if (uiPrimaryLang === 'en' && !rawTitleEn && rawTitleGe && formData.primaryLanguage === 'ka') {
      return 'ka';
    }
    return uiPrimaryLang;
  }, [viewMode, formData.primaryLanguage, formData.title, formData.titleGe, uiPrimaryLang]);

  const effectivePrimaryLang: 'ka' | 'en' = React.useMemo(() => {
    const rawTitleEn = (formData.title || '').trim();
    const rawTitleGe = (formData.titleGe || '').trim();
    let lang: 'ka' | 'en' = formData.primaryLanguage || uiPrimaryLang;
    if (lang === 'ka' && !rawTitleGe && rawTitleEn) {
      lang = 'en';
    } else if (lang === 'en' && !rawTitleEn && rawTitleGe) {
      lang = 'ka';
    }
    return lang;
  }, [formData.primaryLanguage, formData.title, formData.titleGe, uiPrimaryLang]);

  // Auto-open optional progressive sections when prefilled (edit / restored draft)
  const secondaryTitleVal = activeFormPrimaryLang === 'ka' ? (formData.title || '') : (formData.titleGe || '');
  React.useEffect(() => {
    if (secondaryTitleVal.trim()) {
      setShowSecondaryTitle(true);
    } else if (viewMode === 'create' && !(formData.title || '').trim() && !(formData.titleGe || '').trim()) {
      setShowSecondaryTitle(false);
    }
  }, [viewMode, secondaryTitleVal, formData.title, formData.titleGe]);

  React.useEffect(() => {
    const hasTerms = Boolean((formData.serviceTerms || '').trim());
    const hasDuration = Boolean((formData.serviceDuration || '').trim());
    const shouldExpand = formData.category === 'rent' ? (hasTerms || hasDuration) : hasTerms;
    if (shouldExpand) {
      setShowAdditionalTerms(true);
    } else if (viewMode === 'create' && !hasTerms && !hasDuration) {
      setShowAdditionalTerms(false);
    }
  }, [viewMode, formData.category, formData.serviceTerms, formData.serviceDuration]);

  React.useEffect(() => {
    const hasAddress = Boolean((formData.location || '').trim());
    const hasPin =
      typeof formData.lat === 'number' &&
      !isNaN(formData.lat) &&
      typeof formData.lng === 'number' &&
      !isNaN(formData.lng);
    if (hasAddress || hasPin) {
      setShowExactLocation(true);
    } else if (viewMode === 'create' && !hasAddress && !hasPin) {
      setShowExactLocation(false);
    }
  }, [viewMode, formData.location, formData.lat, formData.lng]);

  const validImages = React.useMemo(
    () => (formData.images || []).map(img => (typeof img === 'string' ? img.trim() : '')).filter(Boolean),
    [formData.images]
  );

  const parsedPreviewPrice = React.useMemo(() => {
    const priceStr = String(formData.price || '').trim().replace(',', '.');
    const parsed = parseFloat(priceStr);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [formData.price]);

  const sanitizedPreviewAttributes = React.useMemo(
    () => sanitizeListingAttributes(formData.listingType, formData.category, formData.attributes),
    [formData.listingType, formData.category, formData.attributes]
  );

  const activeDisplayCurrency = displayCurrency || formData.currency || 'USD';
  const activeConvertPrice = React.useCallback(
    (amount: number, from: string, to: string) =>
      convertPrice ? convertPrice(amount, from, to) : amount,
    [convertPrice]
  );

  const previewListing: Listing = React.useMemo(() => {
    const rawTitleEn = (formData.title || '').trim();
    const rawTitleGe = (formData.titleGe || '').trim();
    const primaryTitle = effectivePrimaryLang === 'ka' ? rawTitleGe : rawTitleEn;
    const resolvedDesc = (formData.description || '').trim();
    const resolvedDescGe = (formData.descriptionGe || formData.description || '').trim();

    return {
      id: 'preview-listing',
      title: primaryTitle || rawTitleGe || rawTitleEn,
      titleGe: rawTitleGe || undefined,
      titleEn: rawTitleEn || undefined,
      primaryLanguage: effectivePrimaryLang,
      description: resolvedDesc,
      descriptionGe: resolvedDescGe || undefined,
      price: parsedPreviewPrice,
      currency: formData.currency || 'USD',
      sellerId: 'preview-seller',
      sellerName: sellerName || (language === 'ka' ? 'თქვენი პროფილი' : 'Your Profile'),
      image: validImages[0] || '',
      images: validImages,
      category: formData.category,
      location: resolvedLocationForPreview.location,
      country: resolvedLocationForPreview.country,
      city: resolvedLocationForPreview.city,
      lat: effectiveIsRemote ? undefined : formData.lat,
      lng: effectiveIsRemote ? undefined : formData.lng,
      createdAt: Date.now(),
      status: 'active',
      condition: activeSchema.showCondition ? (formData.condition || 'new') : undefined,
      isNegotiable: Boolean(formData.isNegotiable),
      listingType: formData.listingType,
      isRemote: effectiveIsRemote,
      attributes: sanitizedPreviewAttributes,
      serviceDuration: activeSchema.showServiceTerms ? (formData.serviceDuration || '').trim() : '',
      serviceTerms: activeSchema.showServiceTerms ? (formData.serviceTerms || '').trim() : '',
    };
  }, [
    effectivePrimaryLang,
    formData.title,
    formData.titleGe,
    formData.description,
    formData.descriptionGe,
    formData.currency,
    formData.category,
    formData.lat,
    formData.lng,
    formData.listingType,
    formData.condition,
    formData.isNegotiable,
    formData.serviceDuration,
    formData.serviceTerms,
    resolvedLocationForPreview,
    effectiveIsRemote,
    activeSchema.showCondition,
    activeSchema.showServiceTerms,
    sanitizedPreviewAttributes,
    parsedPreviewPrice,
    sellerName,
    language,
    validImages,
  ]);

  const previewPriceMap = React.useMemo(() => {
    const map = new Map<string, number>();
    const converted = activeConvertPrice(
      parsedPreviewPrice,
      (formData.currency || 'USD').trim().toUpperCase(),
      activeDisplayCurrency.trim().toUpperCase()
    );
    map.set('preview-listing', roundPriceForDisplayCurrency(converted, activeDisplayCurrency));
    return map;
  }, [activeConvertPrice, parsedPreviewPrice, formData.currency, activeDisplayCurrency]);

  const handleFormSubmit = (e: React.FormEvent) => {
    if (formStep !== 4) {
      e.preventDefault();
      return;
    }
    handleSubmitListing(e);
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const tagName = target.tagName.toLowerCase();
    if (tagName === 'textarea' || tagName === 'button') {
      return;
    }

    if (formStep < 4) {
      e.preventDefault();
    }
  };

  const hasTitleFilled = Boolean((formData.title || '').trim() || (formData.titleGe || '').trim());
  const hasPriceFilled = parsedPreviewPrice > 0;
  const hasDescriptionFilled = Boolean((formData.description || '').trim());
  const hasLocationFilled = effectiveIsRemote || Boolean((formData.country || '').trim() && (formData.city || '').trim());
  const hasPhotoFilled = validImages.length > 0;
  const completedSectionsCount = [
    hasTitleFilled,
    hasPriceFilled,
    hasLocationFilled && hasDescriptionFilled,
    hasPhotoFilled,
  ].filter(Boolean).length;

  return (
    <div className="w-full max-w-3xl lg:max-w-4xl xl:max-w-6xl mx-auto xl:grid xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-6 2xl:gap-8 xl:items-start">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "w-full min-w-0 p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border backdrop-blur-2xl relative shadow-xl",
          currentTheme.card,
          "hover:border-proton-accent/40 transition-colors duration-300"
        )}
      >
        {/* Dynamic Ambient Background Gradients (Contained safely inside card radius) */}
        <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none" aria-hidden="true">
          <div className="absolute -top-12 -left-12 w-56 h-56 bg-proton-accent/10 rounded-full blur-[110px]" />
          <div className="absolute -bottom-12 -right-12 w-56 h-56 bg-proton-secondary/10 rounded-full blur-[90px]" />
        </div>

        <form onSubmit={handleFormSubmit} onKeyDown={handleFormKeyDown} className="space-y-6 sm:space-y-8 relative z-10 min-w-0">
          {/* Draft Restore Banner */}
          {savedDraftData && viewMode === 'create' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-proton-accent/10 border border-proton-accent/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-md animate-fade-in">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-proton-accent text-base shrink-0">💾</span>
                  <h4 className={cn("text-sm font-bold leading-snug break-words", currentTheme.text)}>
                    {language === 'ka' ? 'მოიძებნა დაუმთავრებელი მონახაზი' : 'Unfinished Draft Found'}
                  </h4>
                </div>
                <p className={cn("text-xs sm:text-[13px] font-medium leading-snug", currentTheme.muted)}>
                  {language === 'ka' 
                    ? `ბოლოს განახლდა: ${new Date(savedDraftData.updatedAt).toLocaleTimeString()} (ნაბიჯი ${savedDraftData.formStep})` 
                    : `Last updated: ${new Date(savedDraftData.updatedAt).toLocaleTimeString()} (Step ${savedDraftData.formStep})`}
                </p>
              </div>
              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:flex sm:items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const restored = savedDraftData.formData;
                    const restoredType = inferListingType(restored.category, restored.listingType);
                    const restoredSchema = getCategoryFormSchema(restoredType, restored.category);
                    const normalizedRemote =
                      restoredSchema.locationMode === 'remote'
                        ? true
                        : restoredSchema.locationMode === 'physical'
                        ? false
                        : Boolean(restored.isRemote);
                    setFormData({
                      ...restored,
                      listingType: restoredType,
                      isRemote: normalizedRemote,
                      attributes: filterAttributesForSchema(restoredSchema, restored.attributes),
                    });
                    setFormStep(savedDraftData.formStep);
                    setSavedDraftData(null);
                    showToast(
                      language === 'ka' ? 'მონახაზი აღდგენილია' : 'Draft restored successfully',
                      'success'
                    );
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-proton-accent text-proton-on-accent text-xs sm:text-[13px] font-bold hover:opacity-90 transition-all cursor-pointer shadow-sm text-center flex items-center justify-center"
                >
                  {language === 'ka' ? 'მონახაზის აღდგენა' : 'Restore Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(draftStorageKey);
                    setSavedDraftData(null);
                    setShowSecondaryTitle(false);
                    setShowAdditionalTerms(false);
                    setShowExactLocation(false);
                    showToast(
                      language === 'ka' ? 'მონახაზი წაიშალა' : 'Draft discarded',
                      'info'
                    );
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-proton-card border border-proton-border text-proton-muted hover:text-proton-text text-xs sm:text-[13px] font-bold transition-all cursor-pointer text-center flex items-center justify-center"
                >
                  {language === 'ka' ? 'ახლის დაწყება' : 'Start Fresh'}
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Interactive Steps Header */}
          <div className="flex flex-col gap-5 pb-6 border-b border-proton-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("p-2.5 sm:p-3 rounded-2xl bg-proton-accent/10 border border-proton-accent/25 select-none shrink-0", currentTheme.accent)}>
                  <Plus size={20} className="stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h2 className={cn("text-base sm:text-xl font-bold tracking-tight leading-snug font-sans break-words", currentTheme.text)}>
                    {viewMode === 'create' ? (language === 'ka' ? 'განცხადების შექმნა' : 'Create Listing') : (language === 'ka' ? 'განცხადების რედაქტირება' : 'Edit Listing')}
                  </h2>
                  <p className="text-xs sm:text-[13px] font-semibold text-proton-accent mt-0.5 tabular-nums">
                    {language === 'ka' ? `ნაბიჯი ${formStep} / 4` : `Step ${formStep} of 4`}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Draft Status Indicator */}
                {viewMode === 'create' && draftStatus !== 'idle' && (
                  <div className={cn(
                    "text-xs font-semibold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 select-none animate-fade-in",
                    draftStatus === 'saving' && "bg-amber-500/10 text-amber-500 border-amber-500/30",
                    draftStatus === 'saved' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
                    draftStatus === 'error' && "bg-rose-500/10 text-rose-500 border-rose-500/30"
                  )}>
                    <span className={cn("w-2 h-2 rounded-full shrink-0", draftStatus === 'saving' && "bg-amber-500 animate-ping", draftStatus === 'saved' && "bg-emerald-500", draftStatus === 'error' && "bg-rose-500")} />
                    <span>
                      {draftStatus === 'saving' && (language === 'ka' ? 'ინახება...' : 'Saving...')}
                      {draftStatus === 'saved' && (language === 'ka' ? 'მონახაზი შენახულია' : 'Draft Saved')}
                      {draftStatus === 'error' && (language === 'ka' ? 'შენახვა ვერ მოხერხდა' : 'Save Failed')}
                    </span>
                  </div>
                )}

                {/* Clean numeric progress indicator */}
                <div className="text-xs font-mono font-bold tabular-nums text-proton-muted bg-proton-bg px-3 py-1.5 rounded-xl border border-proton-border select-none">
                  {formStep === 1 ? '25%' : formStep === 2 ? '50%' : formStep === 3 ? '75%' : '100%'}
                </div>
              </div>
            </div>

            {/* Interconnecting Modern Custom Stepper Slider */}
            <div className="relative pt-1">
              {/* Background Progress Railway Line */}
              <div className="absolute top-[22px] left-5 right-5 h-[2px] bg-proton-border/55 rounded-full">
                <div 
                  className="h-full bg-proton-accent transition-all duration-300 rounded-full"
                  style={{ width: formStep === 1 ? '0%' : formStep === 2 ? '33.33%' : formStep === 3 ? '66.66%' : '100%' }}
                />
              </div>
              
              <div className="grid grid-cols-4 gap-1 sm:gap-2 relative">
                {[1, 2, 3, 4].map((step) => {
                  const shortStepTitles = [
                    language === 'ka' ? 'ტიპი' : 'Type',
                    language === 'ka' ? 'ფასი' : 'Price',
                    language === 'ka' ? 'მედია' : 'Media',
                    language === 'ka' ? 'ნახვა' : 'Review'
                  ];
                  const fullStepTitles = [
                    language === 'ka' ? 'კატეგორია' : 'Category',
                    language === 'ka' ? 'ფასი & პირობები' : 'Price & Terms',
                    language === 'ka' ? 'ლოკაცია & მედია' : 'Media & Map',
                    language === 'ka' ? 'გადახედვა' : 'Preview'
                  ];
                  const isCompleted = formStep > step;
                  const isActive = formStep === step;

                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => {
                        if (step > 1) {
                          const currentPrimary = activeFormPrimaryLang;
                          const tEn = (formData.title || '').trim();
                          const tGe = (formData.titleGe || '').trim();

                          if (currentPrimary === 'ka' && !tGe && tEn) {
                            setFormData(p => ({ ...p, primaryLanguage: 'en' }));
                          } else if (currentPrimary === 'en' && !tEn && tGe) {
                            setFormData(p => ({ ...p, primaryLanguage: 'ka' }));
                          } else if (!tEn && !tGe) {
                            const msg = language === 'ka'
                              ? 'გთხოვთ პირველ ნაბიჯზე შეიყვანოთ განცხადების სათაური გასაგრძელებლად.'
                              : 'Please enter a listing title in Step 1 to continue.';
                            setFieldErrors(prev => ({ ...prev, title: msg }));
                            showToast(msg, 'warning');
                            return;
                          }
                        }
                        if (step > 2) {
                          const priceStr = String(formData.price || '').trim().replace(',', '.');
                          const parsedPrice = parseFloat(priceStr);
                          if (!priceStr || isNaN(parsedPrice) || parsedPrice <= 0) {
                            const msg = language === 'ka'
                              ? "გთხოვთ შეიყვანოთ სწორი ფასი გასაგრძელებლად (მხოლოდ დადებითი რიცხვები)."
                              : "Please enter a valid price to continue (positive numbers only).";
                            setFieldErrors(prev => ({ ...prev, price: msg }));
                            showToast(msg, 'warning');
                            return;
                          }
                          const attrCheck = validateSchemaAttributes(activeSchema, formData.attributes, language);
                          if (!attrCheck.valid) {
                            setFieldErrors(prev => ({ ...prev, ...attrCheck.errors }));
                            showToast(
                              attrCheck.firstErrorMessage || (language === 'ka' ? 'შეავსეთ კატეგორიის სავალდებულო ველები.' : 'Please complete required category fields.'),
                              'warning'
                            );
                            return;
                          }
                        }
                        if (step > 3) {
                          if (!effectiveIsRemote) {
                            const countryStr = (formData.country || '').trim();
                            const cityStr = (formData.city || '').trim();
                            if (!countryStr || !cityStr) {
                              const msg = language === 'ka'
                                ? "გთხოვთ შეავსოთ ქვეყანა და ქალაქი გადახედვამდე."
                                : "Please select a country and enter a city before preview.";
                              setFieldErrors(prev => ({ ...prev, city: msg }));
                              showToast(msg, 'warning');
                              return;
                            }
                          }
                          if (!formData.description.trim()) {
                            const msg = language === 'ka'
                              ? "გთხოვთ შეავსოთ განცხადების აღწერა გადახედვამდე."
                              : "Please fill in the listing description before preview.";
                            setFieldErrors(prev => ({ ...prev, description: msg }));
                            showToast(msg, 'warning');
                            return;
                          }
                        }
                        setFormStep(step);
                      }}
                      className="group min-h-[44px] min-w-[44px] flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-proton-accent rounded-xl transition-all duration-200 cursor-pointer min-w-0"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full border flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300 z-10 shrink-0",
                        isActive
                          ? "bg-proton-accent border-proton-accent text-proton-on-accent shadow-md"
                          : isCompleted
                          ? "bg-proton-card border-proton-accent/60 text-proton-accent hover:border-proton-accent"
                          : "bg-proton-bg border-proton-border text-proton-muted hover:text-proton-text hover:border-proton-accent/40"
                      )}>
                        {isCompleted ? (
                          <Check size={16} className="stroke-[2.5]" />
                        ) : (
                          <span className="font-mono">{step}</span>
                        )}
                      </div>
                      <span className={cn(
                        "text-xs font-bold mt-2 transition-colors duration-200 text-center leading-tight max-w-full px-0.5 break-words",
                        isActive ? "text-proton-accent" : "text-proton-muted group-hover:text-proton-text"
                      )}>
                        <span className="sm:hidden">{shortStepTitles[step - 1]}</span>
                        <span className="hidden sm:inline">{fullStepTitles[step - 1]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEP 1: Classification & Info */}
          {formStep === 1 && (
            <motion.div 
              initial={{ opacity: 0, y: 12 }} 
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 sm:space-y-7 animate-in fade-in min-w-0"
            >
              {/* Grouped Listing Category Selection (Automatically infers ListingType) */}
              {(() => {
                const productCategories = getCategoriesForListingType('product', t, language);
                const serviceCategories = getCategoriesForListingType('service', t, language);
                const projectCategories = getCategoriesForListingType('project', t, language);
                const allGroupedIds = new Set([
                  ...productCategories.map(c => c.id),
                  ...serviceCategories.map(c => c.id),
                  ...projectCategories.map(c => c.id),
                ]);
                const isUnmatchedLegacyCategory =
                  Boolean(formData.category) && !allGroupedIds.has(formData.category);
                const canAutoInferType = canInferListingTypeFromCategory(formData.category);
                const resolvedTypeDisplay =
                  formData.listingType === 'service'
                    ? (language === 'ka' ? '⚡ სერვისი' : '⚡ Service')
                    : formData.listingType === 'project'
                    ? (language === 'ka' ? '🚀 პროექტი' : '🚀 Project')
                    : (language === 'ka' ? '📦 პროდუქტი' : '📦 Product');

                return (
                  <div className="space-y-4">
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.accent)}>
                          <span>📁</span> {t.market.form.category}
                          <span className="text-rose-500">*</span>
                        </label>
                        {canAutoInferType && (
                          <span
                            data-testid="auto-inferred-listing-type"
                            className={cn("text-xs font-semibold flex items-center gap-1.5", currentTheme.muted)}
                          >
                            <span>{language === 'ka' ? 'ტიპი:' : 'Type:'}</span>
                            <span className={cn("font-bold", currentTheme.text)}>{resolvedTypeDisplay}</span>
                          </span>
                        )}
                      </div>

                      <div className="relative group">
                        <select
                          data-testid="category-select"
                          value={formData.category || getDefaultCategoryForType(formData.listingType)}
                          onChange={e => {
                            const nextCategory = e.target.value;
                            const nextType = canInferListingTypeFromCategory(nextCategory)
                              ? inferListingType(nextCategory, formData.listingType)
                              : formData.listingType;
                            const nextSchema = getCategoryFormSchema(nextType, nextCategory);
                            setFormData(prev => ({
                              ...prev,
                              listingType: nextType,
                              category: nextCategory,
                              isRemote: getDefaultIsRemoteForSchema(nextSchema),
                              attributes: filterAttributesForSchema(nextSchema, prev.attributes),
                            }));
                          }}
                          className={cn(
                            "w-full min-h-[48px] pl-4 pr-10 py-3 rounded-2xl border appearance-none text-base md:text-sm font-semibold shadow-inner transition-all cursor-pointer",
                            currentTheme.input
                          )}
                        >
                          {isUnmatchedLegacyCategory && (
                            <option value={formData.category} className="bg-proton-card text-proton-text font-semibold py-2">
                              {CATEGORY_EMOJIS[formData.category] || '🏷️'} {getCategoryLabel(formData.category, t, language)}
                            </option>
                          )}
                          <optgroup label={language === 'ka' ? '📦 პროდუქტები' : '📦 Products'}>
                            {productCategories.map(cat => (
                              <option key={cat.id} value={cat.id} className="bg-proton-card text-proton-text font-semibold py-2">
                                {cat.emoji} {cat.label}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label={language === 'ka' ? '⚡ სერვისები და გაქირავება' : '⚡ Services & Rentals'}>
                            {serviceCategories.map(cat => (
                              <option key={cat.id} value={cat.id} className="bg-proton-card text-proton-text font-semibold py-2">
                                {cat.emoji} {cat.label}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label={language === 'ka' ? '🚀 პროექტები და ციფრული აქტივები' : '🚀 Projects & Digital Assets'}>
                            {projectCategories.map(cat => (
                              <option key={cat.id} value={cat.id} className="bg-proton-card text-proton-text font-semibold py-2">
                                {cat.emoji} {cat.label}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-proton-muted pointer-events-none group-hover:text-proton-text transition-colors" />
                      </div>
                    </div>

                    {/* Fallback Listing Type Selector ONLY for legacy/ambiguous categories */}
                    {!canAutoInferType && (
                      <div data-testid="legacy-listing-type-selector" className="space-y-3 p-4 rounded-2xl bg-proton-bg/70 border border-proton-border">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.accent)}>
                            <span>⚡</span> {language === 'ka' ? 'განცხადების ტიპი' : 'Listing Type'}
                          </label>
                          <span className={cn("text-xs font-medium", currentTheme.muted)}>
                            {language === 'ka' ? 'მიუთითეთ ძველი კატეგორიის ტიპი' : 'Specify type for legacy category'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                          {[
                            { type: 'service', emoji: '⚡', labelEn: 'Service', labelKa: 'სერვისი' },
                            { type: 'product', emoji: '📦', labelEn: 'Product', labelKa: 'პროდუქტი' },
                            { type: 'project', emoji: '🚀', labelEn: 'Project', labelKa: 'პროექტი' }
                          ].map(item => {
                            const isSelected = formData.listingType === item.type;
                            return (
                              <button
                                key={item.type}
                                type="button"
                                onClick={() => {
                                  const nextType = item.type as 'product' | 'service' | 'project';
                                  setFormData(prev => {
                                    const nextSchema = getCategoryFormSchema(nextType, prev.category);
                                    return {
                                      ...prev,
                                      listingType: nextType,
                                      isRemote: getDefaultIsRemoteForSchema(nextSchema),
                                      attributes: filterAttributesForSchema(nextSchema, prev.attributes),
                                    };
                                  });
                                }}
                                className={cn(
                                  "min-h-[48px] px-4 py-2.5 rounded-xl border transition-all duration-200 flex items-center justify-center gap-2 text-sm font-bold cursor-pointer",
                                  isSelected
                                    ? "bg-proton-accent/10 border-proton-accent text-proton-accent ring-1 ring-proton-accent/30"
                                    : "bg-proton-card border-proton-border text-proton-muted hover:text-proton-text"
                                )}
                              >
                                <span>{item.emoji}</span>
                                <span>{language === 'ka' ? item.labelKa : item.labelEn}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Single Primary Title + Collapsible Optional Translation */}
              {(() => {
                const isKaPrimary = activeFormPrimaryLang === 'ka';
                const resolvedTitleLabel = language === 'ka'
                  ? (activeSchema.titleLabelKa || t.market.form.title)
                  : (activeSchema.titleLabelEn || t.market.form.title);
                const primaryPlaceholder = isKaPrimary
                  ? (activeSchema.titlePlaceholderKa || 'მაგ: განცხადების სათაური')
                  : (activeSchema.titlePlaceholderEn || 'e.g. Listing title');
                const secondaryPlaceholder = isKaPrimary
                  ? (activeSchema.titlePlaceholderEn || 'e.g. Optional English title')
                  : (activeSchema.titlePlaceholderKa || 'მაგ: სათაური ქართულად (არასავალდებულო)');
                const primaryValue = isKaPrimary ? formData.titleGe : formData.title;
                const secondaryValue = isKaPrimary ? formData.title : formData.titleGe;
                const secondaryToggleLabel = isKaPrimary
                  ? (language === 'ka' ? '+ ინგლისური სათაურის დამატება (არასავალდებულო)' : '+ Add English title (optional)')
                  : (language === 'ka' ? '+ ქართული სათაურის დამატება (არასავალდებულო)' : '+ Add Georgian title (optional)');
                const secondaryFieldLabel = isKaPrimary
                  ? (language === 'ka' ? 'ინგლისური სათაური (EN · არასავალდებულო)' : 'English Title (Optional)')
                  : (language === 'ka' ? 'ქართული სათაური (GE · არასავალდებულო)' : 'Georgian Title (Optional)');

                return (
                  <div className="space-y-4">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5 leading-snug", currentTheme.accent)}>
                          <span>{isKaPrimary ? '🇬🇪' : '🇬🇧'}</span>
                          <span>{resolvedTitleLabel}</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        {viewMode === 'edit' && activeFormPrimaryLang !== uiPrimaryLang && (
                          <span className={cn("text-xs font-medium", currentTheme.muted)}>
                            {isKaPrimary ? 'KA' : 'EN'}
                          </span>
                        )}
                      </div>
                      <FastInput
                        data-testid="primary-title-input"
                        required
                        type="text"
                        value={primaryValue}
                        onCommit={val => {
                          setFormData(p =>
                            isKaPrimary
                              ? { ...p, primaryLanguage: 'ka', titleGe: val }
                              : { ...p, primaryLanguage: 'en', title: val }
                          );
                          clearFieldError('title');
                        }}
                        placeholder={primaryPlaceholder}
                        aria-invalid={Boolean(fieldErrors.title)}
                        className={cn(
                          "w-full min-h-[48px] px-4 py-3 rounded-2xl border text-base md:text-sm font-semibold shadow-inner transition-all scroll-mb-24",
                          currentTheme.input,
                          fieldErrors.title && "border-rose-500/70 focus:border-rose-500"
                        )}
                      />
                    </div>

                    {!showSecondaryTitle ? (
                      <div className="pt-0.5">
                        <button
                          type="button"
                          data-testid="toggle-secondary-title"
                          onClick={() => setShowSecondaryTitle(true)}
                          className={cn(
                            "min-h-[40px] px-3.5 py-2 rounded-xl border border-proton-border/80 bg-proton-bg/60 hover:bg-proton-bg hover:border-proton-accent/40 text-xs sm:text-[13px] font-semibold transition-all cursor-pointer inline-flex items-center gap-2",
                            currentTheme.muted,
                            "hover:text-proton-text"
                          )}
                        >
                          <span>{secondaryToggleLabel}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 p-4 rounded-2xl bg-proton-bg/60 border border-proton-border/80 min-w-0 animate-in fade-in">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className={cn("text-xs sm:text-[13px] font-bold flex items-center gap-1.5", currentTheme.text)}>
                            <span>{isKaPrimary ? '🇬🇧' : '🇬🇪'}</span>
                            <span>{secondaryFieldLabel}</span>
                          </label>
                          {!secondaryValue.trim() && (
                            <button
                              type="button"
                              onClick={() => setShowSecondaryTitle(false)}
                              className={cn("text-xs font-semibold hover:underline cursor-pointer", currentTheme.muted)}
                            >
                              {language === 'ka' ? 'დამალვა' : 'Hide'}
                            </button>
                          )}
                        </div>
                        <FastInput
                          data-testid="secondary-title-input"
                          type="text"
                          value={secondaryValue}
                          onCommit={val => {
                            setFormData(p => (isKaPrimary ? { ...p, title: val } : { ...p, titleGe: val }));
                            clearFieldError('title');
                          }}
                          placeholder={secondaryPlaceholder}
                          className={cn(
                            "w-full min-h-[46px] px-4 py-3 rounded-2xl border text-base md:text-sm font-semibold shadow-inner transition-all scroll-mb-24",
                            currentTheme.input
                          )}
                        />
                      </div>
                    )}

                    {fieldErrors.title && (
                      <p className="text-xs sm:text-[13px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{fieldErrors.title}</span>
                      </p>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* STEP 2: Financials & Characteristics */}
          {formStep === 2 && (
            <motion.div 
              initial={{ opacity: 0, y: 12 }} 
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 sm:space-y-7 animate-in fade-in min-w-0"
            >
              {/* Price and Currency input fields (1-column up to 820px tablet, 2-column from 1024px) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-2 min-w-0">
                  <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.accent)}>
                    <span>🪙</span> {language === 'ka' ? activeSchema.priceLabelKa : activeSchema.priceLabelEn}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center">
                      <Coins size={16} className={cn("opacity-75 group-focus-within:opacity-100 transition-opacity", currentTheme.accent)} />
                    </div>
                    <FastInput 
                      required
                      type="number"
                      min="0"
                      step="any"
                      value={formData.price}
                      onCommit={val => {
                        setFormData(p => ({ ...p, price: val }));
                        clearFieldError('price');
                      }}
                      placeholder="0.00"
                      aria-invalid={Boolean(fieldErrors.price)}
                      className={cn(
                        "w-full min-h-[46px] pl-11 pr-4 py-3 rounded-2xl border text-base md:text-sm font-bold font-mono tabular-nums shadow-inner transition-all scroll-mb-24",
                        currentTheme.input,
                        fieldErrors.price && "border-rose-500/70 focus:border-rose-500"
                      )}
                    />
                  </div>
                  {fieldErrors.price && (
                    <p className="text-xs sm:text-[13px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{fieldErrors.price}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-2 min-w-0">
                  <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.text)}>
                    <span>💵</span> {t.market.form.currency}
                  </label>
                  <div className="relative group">
                    <select 
                      value={formData.currency}
                      onChange={e => setFormData({...formData, currency: e.target.value})}
                      className={cn(
                        "w-full min-h-[46px] pl-4 pr-10 py-3 rounded-2xl border appearance-none text-base md:text-sm font-mono font-bold transition-all cursor-pointer",
                        currentTheme.input
                      )}
                    >
                      {CURRENCIES.map(curr => (
                        <option key={curr.code} value={curr.code} className="bg-proton-card text-proton-text font-mono font-bold">
                          {curr.code} ({curr.symbol})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-proton-muted pointer-events-none group-hover:text-proton-text transition-colors" />
                  </div>
                </div>
              </div>

              {/* Product Condition Selection Header & Sliding Tabs (Products only) */}
              {activeSchema.showCondition && (
                <div className="space-y-2.5">
                  <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.accent)}>
                    <span>📦</span> {language === 'ka' ? 'ნივთის მდგომარეობა' : 'Item Condition'}
                  </label>
                  
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 p-1.5 rounded-2xl bg-proton-bg border border-proton-border">
                    {[
                      { id: 'new', icon: '✨', titleEn: 'Brand New', titleKa: 'ახალი' },
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
                            "min-h-[44px] px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                            isAct 
                              ? "bg-proton-accent text-proton-on-accent shadow-sm"
                              : "text-proton-muted hover:text-proton-text hover:bg-proton-card"
                          )}
                        >
                          <span className="text-sm shrink-0">{cond.icon}</span>
                          <span className="truncate">{language === 'ka' ? cond.titleKa : cond.titleEn}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category-Specific Dynamic Attributes */}
              <DynamicAttributesSection
                schema={activeSchema}
                attributes={formData.attributes || {}}
                onChange={handleAttributeChange}
                language={language}
                currentTheme={currentTheme}
                errors={fieldErrors}
                onClearError={clearFieldError}
              />

              {/* Price Negotiable Box & Switch */}
              <div className="px-4 py-3.5 min-h-[60px] rounded-2xl bg-proton-bg/70 border border-proton-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("p-2.5 rounded-xl bg-proton-accent/10 border border-proton-accent/25 shrink-0", currentTheme.accent)}>
                    <Tag size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className={cn("text-sm font-bold leading-snug break-words", currentTheme.text)}>
                      {language === 'ka' ? 'ფასი შეთანხმებით' : 'Negotiable Price'}
                    </h4>
                    <p className={cn("text-xs sm:text-[13px] font-medium mt-0.5 leading-snug break-words", currentTheme.muted)}>
                      {language === 'ka' ? 'ფასი ექვემდებარება მოლაპარაკებას' : 'Open to price offers from buyers'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(formData.isNegotiable)}
                  aria-label={language === 'ka' ? 'ფასი შეთანხმებით' : 'Negotiable Price'}
                  onClick={() => setFormData({...formData, isNegotiable: !formData.isNegotiable})}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-end shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-proton-accent rounded-xl"
                >
                  <span className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                    formData.isNegotiable ? "bg-proton-accent" : "bg-proton-border"
                  )}>
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                        formData.isNegotiable ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </span>
                </button>
              </div>

              {/* Service & Rental Terms (Simplified Progressive Disclosure) */}
              {activeSchema.showServiceTerms && (
                <div className="space-y-4">
                  {formData.category !== 'rent' && (
                    <div className="space-y-2 min-w-0">
                      <label className={cn("text-[13px] sm:text-sm font-bold flex flex-wrap items-center gap-1.5", currentTheme.accent)}>
                        <span>⏱️</span> {language === 'ka' ? 'შესრულების ვადა' : 'Estimated Completion Time'}
                        <span className={cn("text-xs font-medium", currentTheme.muted)}>
                          ({language === 'ka' ? 'არასავალდებულო' : 'optional'})
                        </span>
                      </label>
                      <FastInput 
                        type="text"
                        value={formData.serviceDuration || ''}
                        onCommit={val => setFormData(p => ({ ...p, serviceDuration: val }))}
                        placeholder={language === 'ka' ? "მაგ: 3 დღე" : "e.g. 3 business days"}
                        className={cn(
                          "w-full min-h-[46px] px-4 py-3 rounded-2xl border text-base md:text-sm font-semibold transition-all scroll-mb-24",
                          currentTheme.input
                        )}
                      />
                    </div>
                  )}

                  <div className="rounded-2xl border border-proton-border/80 bg-proton-bg/45 overflow-hidden">
                    <button
                      type="button"
                      data-testid="toggle-additional-terms"
                      onClick={() => setShowAdditionalTerms(prev => !prev)}
                      className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-proton-bg/70 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className={cn("text-[13px] sm:text-sm font-bold block", currentTheme.text)}>
                          {language === 'ka' ? 'დამატებითი პირობები (არასავალდებულო)' : 'Additional terms (optional)'}
                        </span>
                      </div>
                      <ChevronDown
                        size={16}
                        className={cn(
                          "text-proton-muted shrink-0 transition-transform duration-200",
                          showAdditionalTerms && "rotate-180"
                        )}
                      />
                    </button>

                    {showAdditionalTerms && (
                      <div className="p-4 pt-3 border-t border-proton-border/70 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {formData.category === 'rent' && (
                          <div className="space-y-2 min-w-0">
                            <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.text)}>
                              <span>⏱️</span> {language === 'ka' ? 'მინ. ვადა / გაცემის დრო' : 'Duration / Pickup Window'}
                            </label>
                            <FastInput 
                              type="text"
                              value={formData.serviceDuration || ''}
                              onCommit={val => setFormData(p => ({ ...p, serviceDuration: val }))}
                              placeholder={language === 'ka' ? "მაგ: მინ. 1 დღე / 10:00–19:00" : "e.g. Min 1 day / 10:00–19:00"}
                              className={cn(
                                "w-full min-h-[46px] px-4 py-3 rounded-2xl border text-base md:text-sm font-semibold transition-all scroll-mb-24",
                                currentTheme.input
                              )}
                            />
                          </div>
                        )}

                        <div className={cn("space-y-2 min-w-0", formData.category !== 'rent' && "lg:col-span-2")}>
                          <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.text)}>
                            <span>📋</span> {language === 'ka' ? 'სამუშაო / გაქირავების პირობები' : 'Terms & Requirements'}
                          </label>
                          <FastInput 
                            type="text"
                            value={formData.serviceTerms || ''}
                            onCommit={val => setFormData(p => ({ ...p, serviceTerms: val }))}
                            placeholder={language === 'ka' ? "მაგ: შეთანხმების მიხედვით" : "e.g. As agreed with client"}
                            className={cn(
                              "w-full min-h-[46px] px-4 py-3 rounded-2xl border text-base md:text-sm font-semibold transition-all scroll-mb-24",
                              currentTheme.input
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 3: Location, Coordinates and Media Upload */}
          {formStep === 3 && (
            <motion.div 
              initial={{ opacity: 0, y: 12 }} 
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 sm:space-y-7 animate-in fade-in min-w-0"
            >
              {/* Smart Category-Aware Location Block */}
              {(() => {
                const hasStep2FormatField = activeSchema.fields.some(
                  f => f.key === 'deliveryFormat' || f.key === 'employmentFormat'
                );

                // Case C: Remote / Digital Asset categories -> Hide all location inputs cleanly
                if (activeSchema.locationMode === 'remote') {
                  return (
                    <div
                      data-testid="remote-digital-location-notice"
                      className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border flex items-start sm:items-center gap-3"
                    >
                      <div className={cn("p-2.5 rounded-xl bg-proton-accent/10 border border-proton-accent/25 shrink-0", currentTheme.accent)}>
                        <Globe size={16} className="stroke-[2.5]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className={cn("text-sm font-bold leading-snug", currentTheme.text)}>
                          {language === 'ka' ? 'ციფრული / ონლაინ განცხადება' : 'Digital / Online Listing'}
                        </h4>
                        <p className={cn("text-xs sm:text-[13px] font-medium mt-0.5 leading-snug", currentTheme.muted)}>
                          {language === 'ka'
                            ? 'მდებარეობის, ქალაქის და რუკის შევსება საჭირო არ არის — გამოქვეყნდება როგორც ონლაინ.'
                            : 'Country, city, address, and map are not needed — listing will be published as Online.'}
                        </p>
                      </div>
                    </div>
                  );
                }

                // Exact location (address + MapPicker) collapsible block for physical & non-remote flexible flows
                const renderExactLocationCollapsible = () => (
                  <div className="rounded-2xl border border-proton-border/80 bg-proton-bg/45 overflow-hidden">
                    <button
                      type="button"
                      data-testid="toggle-exact-location"
                      onClick={() => setShowExactLocation(prev => !prev)}
                      className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-proton-bg/70 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <MapPin size={15} className={cn("shrink-0", currentTheme.accent)} />
                        <span className={cn("text-[13px] sm:text-sm font-bold", currentTheme.text)}>
                          {language === 'ka' ? 'ზუსტი მდებარეობა (არასავალდებულო)' : 'Exact location (optional)'}
                        </span>
                      </div>
                      <ChevronDown
                        size={16}
                        className={cn(
                          "text-proton-muted shrink-0 transition-transform duration-200",
                          showExactLocation && "rotate-180"
                        )}
                      />
                    </button>

                    {showExactLocation && (
                      <div className="p-4 pt-3 border-t border-proton-border/70 space-y-5">
                        <div className="space-y-2 min-w-0">
                          <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.text)}>
                            <span>📍</span> {t.market.form.location}
                          </label>
                          <div className="relative group">
                            <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proton-muted group-focus-within:text-proton-accent transition-colors" />
                            <FastInput 
                              type="text"
                              value={formData.location}
                              onCommit={val => setFormData(p => ({ ...p, location: val }))}
                              placeholder={language === 'ka' ? 'ქუჩა, უბანი ან შეხვედრის ადგილი...' : 'Street address or pickup details...'}
                              className={cn(
                                "w-full min-h-[46px] pl-10.5 pr-4 py-3 rounded-2xl border text-base md:text-sm font-semibold shadow-inner transition-all scroll-mb-24",
                                currentTheme.input
                              )}
                            />
                          </div>
                        </div>

                        <div className="space-y-2.5 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.accent)}>
                              <span>🛰️</span> {language === 'ka' ? 'მდებარეობა რუკაზე' : 'Location on Map'}
                            </label>
                            <span className={cn("text-xs font-mono font-semibold tabular-nums", currentTheme.muted)}>
                              {formData.lat !== undefined && formData.lat !== null ? formData.lat.toFixed(4) : "41.7151"}, {formData.lng !== undefined && formData.lng !== null ? formData.lng.toFixed(4) : "44.8271"}
                            </span>
                          </div>
                          <div className="p-3 sm:p-4 rounded-2xl bg-proton-bg/70 border border-proton-border shadow-md relative">
                            <MapPicker 
                              lat={formData.lat}
                              lng={formData.lng}
                              onChange={(lat, lng) => setFormData(prev => ({ ...prev, lat, lng }))}
                              language={language as 'en' | 'ka'}
                              currentTheme={currentTheme}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );

                // Country + City grid for physical & non-remote flexible flows
                const renderCountryCityInputs = () => (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                    <div className="space-y-2 min-w-0">
                      <label className={cn("text-[13px] sm:text-sm font-bold flex flex-wrap items-center gap-1.5", currentTheme.accent)}>
                        <span>🗺️</span> {t.market.form.country}
                        <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative group">
                        <select
                          data-testid="country-select"
                          value={formData.country && formData.country !== 'GLOBAL' ? formData.country : 'GEO'}
                          onChange={e => setFormData({ ...formData, country: e.target.value })}
                          className={cn(
                            "w-full min-h-[46px] pl-4 pr-10 py-3 rounded-2xl border appearance-none text-base md:text-sm font-semibold transition-all cursor-pointer",
                            currentTheme.input
                          )}
                        >
                          {AVAILABLE_COUNTRY_OPTIONS.map(country => (
                            <option key={country.code} value={country.code} className="bg-proton-card text-proton-text font-semibold py-1">
                              {country.flag} {country.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-proton-muted pointer-events-none group-hover:text-proton-text transition-colors" />
                      </div>
                    </div>

                    <div className="space-y-2 min-w-0">
                      <label className={cn("text-[13px] sm:text-sm font-bold flex flex-wrap items-center gap-1.5", currentTheme.accent)}>
                        <span>🏙️</span> {t.market.form.city}
                        <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <FastInput
                          data-testid="city-input"
                          required
                          type="text"
                          value={formData.city}
                          onCommit={val => {
                            setFormData(p => ({ ...p, city: val }));
                            clearFieldError('city');
                          }}
                          placeholder={language === 'ka' ? 'მაგ: თბილისი' : 'e.g. Tbilisi'}
                          aria-invalid={Boolean(fieldErrors.city)}
                          className={cn(
                            "w-full min-h-[46px] px-4 py-3 rounded-2xl border text-base md:text-sm font-semibold shadow-inner transition-all scroll-mb-24",
                            currentTheme.input,
                            fieldErrors.city && "border-rose-500/70 focus:border-rose-500"
                          )}
                        />
                      </div>
                      {fieldErrors.city && (
                        <p className="text-xs sm:text-[13px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{fieldErrors.city}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );

                // Case B: Flexible categories (service, project-jobs, collaboration)
                if (activeSchema.locationMode === 'flexible') {
                  return (
                    <div className="space-y-5">
                      {hasStep2FormatField ? (
                        <div
                          data-testid="step2-derived-format-banner"
                          className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <div className={cn("p-2.5 rounded-xl bg-proton-accent/10 border border-proton-accent/25 shrink-0", currentTheme.accent)}>
                              {effectiveIsRemote ? <Globe size={16} className="stroke-[2.5]" /> : <MapPin size={16} className="stroke-[2.5]" />}
                            </div>
                            <div className="min-w-0">
                              <h4 className={cn("text-sm font-bold leading-snug", currentTheme.text)}>
                                {effectiveIsRemote
                                  ? (language === 'ka' ? 'არჩეულია დისტანციური / ონლაინ ფორმატი' : 'Online / Remote format selected')
                                  : (language === 'ka' ? 'არჩეულია ადგილზე / ჰიბრიდული ფორმატი' : 'On-site / Hybrid format selected')}
                              </h4>
                              <p className={cn("text-xs sm:text-[13px] font-medium mt-0.5 leading-snug", currentTheme.muted)}>
                                {effectiveIsRemote
                                  ? (language === 'ka' ? 'ქალაქი, მისამართი და რუკა საჭირო არ არის.' : 'City, address, and map are not required.')
                                  : (language === 'ka' ? 'მიუთითეთ ქვეყანა და ქალაქი. ზუსტი მისამართი არასავალდებულოა.' : 'Provide country and city. Exact address is optional.')}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormStep(2)}
                            className={cn("min-h-[38px] px-3 py-1.5 rounded-xl bg-proton-accent/10 hover:bg-proton-accent/20 text-xs font-bold cursor-pointer shrink-0 transition-colors", currentTheme.accent)}
                          >
                            {language === 'ka' ? 'ფორმატის შეცვლა' : 'Change format'}
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border flex items-start sm:items-center justify-between gap-4">
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <div className={cn("p-2.5 rounded-xl bg-proton-accent/10 border border-proton-accent/25 shrink-0", currentTheme.accent)}>
                              <Globe size={16} className="stroke-[2.5]" />
                            </div>
                            <div className="min-w-0">
                              <h4 className={cn("text-sm font-bold leading-snug break-words", currentTheme.text)}>
                                {language === 'ka' ? 'ონლაინ / დისტანციური ფორმატი' : 'Online / Remote Format'}
                              </h4>
                              <p className={cn("text-xs sm:text-[13px] font-medium mt-0.5 leading-snug break-words", currentTheme.muted)}>
                                {language === 'ka'
                                  ? (effectiveIsRemote
                                    ? 'ქალაქი და მისამართი საჭირო არ არის.'
                                    : 'ადგილზე — მიუთითეთ ქვეყანა და ქალაქი.')
                                  : (effectiveIsRemote
                                    ? 'City and address are not required.'
                                    : 'On-site — provide country and city.')}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            data-testid="flexible-remote-toggle"
                            role="switch"
                            aria-checked={effectiveIsRemote}
                            aria-label={language === 'ka' ? 'დისტანციური / ონლაინ რეჟიმი' : 'Remote / Online mode'}
                            onClick={() => {
                              const nextRemote = !effectiveIsRemote;
                              clearFieldError('city');
                              setFormData(prev => ({
                                ...prev,
                                isRemote: nextRemote,
                                country: !nextRemote && (!prev.country || prev.country === 'GLOBAL')
                                  ? 'GEO'
                                  : prev.country,
                              }));
                            }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-end shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-proton-accent rounded-xl"
                          >
                            <span className={cn(
                              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                              effectiveIsRemote ? "bg-proton-accent" : "bg-proton-border"
                            )}>
                              <span
                                className={cn(
                                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                                  effectiveIsRemote ? "translate-x-5" : "translate-x-0"
                                )}
                              />
                            </span>
                          </button>
                        </div>
                      )}

                      {!effectiveIsRemote && (
                        <>
                          {renderCountryCityInputs()}
                          {renderExactLocationCollapsible()}
                        </>
                      )}
                    </div>
                  );
                }

                // Case A: Physical Products & Rent
                return (
                  <div className="space-y-5">
                    {renderCountryCityInputs()}
                    {renderExactLocationCollapsible()}
                  </div>
                );
              })()}

              {/* Form Description and Spark AI Helper Button */}
              <div className="space-y-2.5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.accent)}>
                    <span>📋</span> {language === 'ka' ? activeSchema.descriptionLabelKa : activeSchema.descriptionLabelEn}
                    <span className="text-rose-500">*</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleAiDescription}
                    disabled={isAiGenerating}
                    className={cn(
                      "min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all cursor-pointer shrink-0",
                      "bg-proton-accent/10 border border-proton-accent/30 hover:border-proton-accent text-proton-accent disabled:opacity-50"
                    )}
                  >
                    {isAiGenerating ? (
                      <Loader2 size={14} className="animate-spin shrink-0" />
                    ) : (
                      <Sparkles size={14} className="stroke-[2.5] text-proton-accent shrink-0" />
                    )}
                    <span>{language === 'ka' ? 'AI შაბლონი' : 'AI Generate Description'}</span>
                  </button>
                </div>
                
                <FastTextarea 
                  required
                  value={formData.description}
                  onCommit={val => {
                    setFormData(p => ({ ...p, description: val }));
                    clearFieldError('description');
                  }}
                  placeholder={language === 'ka' ? activeSchema.descriptionPlaceholderKa : activeSchema.descriptionPlaceholderEn}
                  aria-invalid={Boolean(fieldErrors.description)}
                  className={cn(
                    "w-full min-h-[150px] px-4 py-3.5 rounded-2xl border text-base md:text-sm font-medium leading-relaxed resize-y shadow-inner transition-all scroll-mb-24",
                    currentTheme.input,
                    fieldErrors.description && "border-rose-500/70 focus:border-rose-500"
                  )}
                />
                {fieldErrors.description && (
                  <p className="text-xs sm:text-[13px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{fieldErrors.description}</span>
                  </p>
                )}
              </div>

              {/* Graphic/Image upload box */}
              <div className="space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.text)}>
                    <span>🖼️</span> {t.market.form.image_url}
                  </label>
                  {formData.images?.[0] && !isResizing && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="min-h-[38px] text-xs sm:text-[13px] font-bold text-rose-500 hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer px-3 py-1.5 rounded-xl hover:bg-rose-500/10"
                    >
                      <Trash2 size={14} />
                      <span>{language === 'ka' ? 'ფოტოს წაშლა' : 'Remove Photo'}</span>
                    </button>
                  )}
                </div>
                
                <div 
                  className={cn(
                    "w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all overflow-hidden relative",
                    formData.images?.[0] && !isResizing
                      ? "aspect-[4/3] max-h-80 sm:max-h-96 min-h-[200px] border-proton-border bg-proton-bg shadow-lg"
                      : isResizing
                      ? "min-h-[190px] border-proton-border bg-proton-bg shadow-lg"
                      : "min-h-[190px] sm:min-h-[210px] bg-proton-bg/60 border-proton-border hover:border-proton-accent/50 hover:bg-proton-bg group cursor-pointer"
                  )}
                >
                  {!formData.images?.[0] && !isResizing && (
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-proton-accent/40 to-transparent pointer-events-none" />
                  )}
                  
                  <input 
                    ref={fileInputRef}
                    id="listing-photo-upload-input"
                    type="file" 
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {isResizing ? (
                    <div className="flex flex-col items-center gap-2.5 p-6">
                      <Loader2 className={cn("w-8 h-8 animate-spin", currentTheme.accent)} />
                      <span className={cn("text-xs sm:text-[13px] font-bold", currentTheme.accent)}>
                        {language === 'ka' ? 'ფოტო მუშავდება...' : 'Processing Photo...'}
                      </span>
                    </div>
                  ) : formData.images?.[0] ? (
                    <div className="relative w-full h-full p-2.5 flex items-center justify-center overflow-hidden">
                      {!isPreviewLoaded && !previewHasError && (
                        <div className="absolute inset-0 z-0 animate-pulse bg-proton-border/30 flex items-center justify-center pointer-events-none">
                          <Loader2 className={cn("w-6 h-6 animate-spin opacity-60", currentTheme.accent)} />
                        </div>
                      )}

                      {isPreviewLoaded && previewNeedsBackdrop && !previewHasError && (
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none"
                        >
                          <img
                            src={formData.images[0]}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover object-center blur-xl scale-110 opacity-35"
                          />
                          <div className="absolute inset-0 bg-proton-bg/30" />
                        </div>
                      )}

                      {!previewHasError ? (
                        <img 
                          ref={previewImgRef}
                          src={formData.images[0]} 
                          onLoad={(e) => handlePreviewImageReady(e.currentTarget)}
                          onError={() => {
                            setPreviewHasError(true);
                            setIsPreviewLoaded(true);
                            setPreviewNeedsBackdrop(false);
                          }}
                          className={cn(
                            "relative z-[1] w-full h-full object-contain object-center rounded-xl transition-opacity duration-200",
                            isPreviewLoaded ? "opacity-100" : "opacity-0"
                          )}
                          alt={formData.title || formData.titleGe || 'Listing'} 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="relative z-[1] flex flex-col items-center justify-center gap-2 text-proton-muted">
                          <Camera size={28} className="opacity-40" />
                        </div>
                      )}
                      
                      <div className="absolute bottom-4 left-4 z-10 bg-proton-card/92 border border-proton-border px-3 py-1.5 rounded-xl backdrop-blur-md select-none pointer-events-none">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-proton-accent" />
                          <span className={cn("text-xs font-bold", currentTheme.text)}>
                            {language === 'ka' ? 'ფოტო მზადაა' : 'Photo Ready'}
                          </span>
                        </div>
                      </div>

                      {/* Action Controls: Replace and Remove */}
                      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                        <label 
                          htmlFor="listing-photo-upload-input"
                          className="min-h-[40px] bg-proton-card/95 hover:bg-proton-card border border-proton-border hover:border-proton-accent px-3 py-2 rounded-xl backdrop-blur-md cursor-pointer shadow-lg flex items-center gap-1.5 transition-all text-proton-accent active:scale-95 select-none"
                        >
                          <Camera size={14} />
                          <span className="text-xs font-bold">
                            {language === 'ka' ? 'შეცვლა' : 'Replace'}
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="min-h-[40px] bg-proton-card/95 hover:bg-rose-600 border border-rose-500/40 px-3 py-2 rounded-xl backdrop-blur-md cursor-pointer shadow-lg flex items-center gap-1.5 transition-all text-rose-500 hover:text-white active:scale-95 select-none"
                          title={language === 'ka' ? 'ფოტოს წაშლა' : 'Remove photo'}
                        >
                          <Trash2 size={14} />
                          <span className="text-xs font-bold">
                            {language === 'ka' ? 'წაშლა' : 'Remove'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label 
                      htmlFor="listing-photo-upload-input"
                      className="w-full min-h-[190px] sm:min-h-[210px] flex flex-col items-center justify-center gap-3 select-none text-center px-5 py-6 cursor-pointer"
                    >
                      <div className="p-3.5 rounded-2xl bg-proton-card border border-proton-border group-hover:scale-105 transition-transform text-proton-muted group-hover:text-proton-accent group-hover:border-proton-accent/40 duration-200">
                        <Camera size={24} />
                      </div>
                      <div className="space-y-1">
                        <span className={cn("text-sm font-bold block group-hover:text-proton-accent transition-colors", currentTheme.text)}>
                          {t.market.form.upload_button}
                        </span>
                        <span className={cn("text-xs font-medium block", currentTheme.muted)}>
                          {language === 'ka' ? 'PNG, JPG ან WEBP (მაქს. 5MB)' : 'PNG, JPG or WEBP (Max 5MB)'}
                        </span>
                      </div>
                    </label>
                  )}
                </div>

                <div className="relative mt-2.5 group">
                  <Link size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proton-muted group-focus-within:text-proton-accent transition-colors" />
                  <input 
                    type="url"
                    value={formData.images?.[0] || ''}
                    onChange={e => setFormData({...formData, images: e.target.value ? [e.target.value] : []})}
                    placeholder={language === 'ka' ? '...ან ჩასვით სურათის გარე ბმული (URL)' : '...or paste external image link URL'}
                    className={cn(
                      "w-full min-h-[46px] pl-10.5 pr-4 py-3 rounded-2xl border text-base md:text-sm font-medium shadow-inner transition-all scroll-mb-24",
                      currentTheme.input
                    )}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Listing Preview */}
          {formStep === 4 && (
            <motion.div 
              initial={{ opacity: 0, y: 12 }} 
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 sm:space-y-7 animate-in fade-in min-w-0"
            >
              {/* Preview Banner Header */}
              <div className="p-4 sm:p-5 rounded-2xl bg-proton-accent/10 border border-proton-accent/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className={cn("p-2.5 rounded-xl bg-proton-accent/15 border border-proton-accent/30 shrink-0", currentTheme.accent)}>
                    <Eye size={18} className="stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className={cn("text-sm sm:text-base font-bold flex flex-wrap items-center gap-2 leading-snug", currentTheme.text)}>
                      <span>{language === 'ka' ? 'განცხადების გადახედვა' : 'Listing Preview'}</span>
                      <span className="text-xs font-semibold text-proton-accent">
                        · {language === 'ka' ? 'მყიდველის ხედვა' : 'Buyer View'}
                      </span>
                    </h3>
                    <p className={cn("text-xs sm:text-[13px] font-medium mt-0.5 leading-snug break-words", currentTheme.muted)}>
                      {language === 'ka' 
                        ? 'ასე გამოჩნდება თქვენი განცხადება ბაზარზე. გადაამოწმეთ ინფორმაცია გამოქვეყნებამდე.' 
                        : 'This is how your listing will appear in the marketplace. Review all details before publishing.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Real Buyer-Facing Marketplace Card Preview (Shown inline below 1280px; desktop 1280px+ shows it in right live panel) */}
              <div className="xl:hidden flex flex-col items-center gap-3">
                <div className="w-full max-w-sm">
                  <MarketListingCard
                    listing={previewListing}
                    idx={0}
                    user={null}
                    language={language}
                    t={t}
                    currentTheme={currentTheme}
                    priceMap={previewPriceMap}
                    convertPrice={activeConvertPrice}
                    displayCurrency={activeDisplayCurrency}
                    isFavorite={false}
                    toggleFavorite={() => {}}
                    sellerRating={sellerRating}
                    onSelectListing={() => {
                      document.getElementById('listing-preview-details')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                      });
                    }}
                    onSelectVendor={() => {}}
                    onStartEdit={() => {}}
                    onDeleteListing={() => {}}
                  />
                </div>

                <p className={cn("text-xs sm:text-[13px] text-center max-w-md leading-relaxed", currentTheme.muted)}>
                  {language === 'ka'
                    ? 'გადახდის და მიწოდების პირობებზე მყიდველი და გამყიდველი თანხმდებიან უშუალოდ.'
                    : 'Payment and delivery terms are agreed directly between buyer and seller.'}
                </p>
              </div>

              {/* Summary Details & Quick Edit Jump Links */}
              {(() => {
                const rawTitleEn = (formData.title || '').trim();
                const rawTitleGe = (formData.titleGe || '').trim();
                const secondaryTitle = rawTitleEn && rawTitleGe && rawTitleEn !== rawTitleGe
                  ? (effectivePrimaryLang === 'ka' ? rawTitleEn : rawTitleGe)
                  : '';
                const trimmedAddress = resolvedLocationForPreview.location;
                const trimmedDuration = activeSchema.showServiceTerms ? (formData.serviceDuration || '').trim() : '';
                const trimmedTerms = activeSchema.showServiceTerms ? (formData.serviceTerms || '').trim() : '';
                const formattedPreviewAttributes = getFormattedListingAttributes(previewListing, language);
                const hasGpsCoords =
                  !effectiveIsRemote &&
                  typeof formData.lat === 'number' &&
                  !isNaN(formData.lat) &&
                  typeof formData.lng === 'number' &&
                  !isNaN(formData.lng);
                const step2Title =
                  activeSchema.showServiceTerms
                    ? (language === 'ka' ? 'ნაბიჯი 2: ფასი და პირობები' : 'Step 2: Price & Terms')
                    : formData.listingType === 'project'
                    ? (language === 'ka' ? 'ნაბიჯი 2: ბიუჯეტი და მახასიათებლები' : 'Step 2: Budget & Specs')
                    : (language === 'ka' ? 'ნაბიჯი 2: ფასი და მახასიათებლები' : 'Step 2: Price & Specs');
                const showOriginalCurrencyLine =
                  activeDisplayCurrency.trim().toUpperCase() !== (formData.currency || 'USD').trim().toUpperCase();

                return (
                  <div id="listing-preview-details" className="space-y-3.5 min-w-0">
                    <div className={cn("flex flex-wrap items-center justify-between gap-2 text-[13px] sm:text-sm font-bold", currentTheme.text)}>
                      <span>📋 {language === 'ka' ? 'მონაცემების შემოწმება' : 'Details Breakdown'}</span>
                      <span className={cn("text-xs font-medium", currentTheme.muted)}>
                        {language === 'ka' ? 'შეცდომის შემთხვევაში დააჭირეთ „შეცვლას“' : 'Click edit to adjust any section'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-3.5">
                      {/* Step 1 Review: Type, Language & Secondary Title */}
                      <div className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border flex flex-col justify-between gap-3 min-w-0">
                        <div className="space-y-2.5 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn("text-xs sm:text-[13px] font-bold", currentTheme.accent)}>
                              {language === 'ka' ? 'ნაბიჯი 1: ტიპი და სათაური' : 'Step 1: Type & Title'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setFormStep(1)}
                              className={cn("min-h-[38px] px-3 py-1.5 rounded-xl bg-proton-accent/10 hover:bg-proton-accent/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors", currentTheme.accent)}
                            >
                              <Edit3 size={12} />
                              <span>{language === 'ka' ? 'შეცვლა' : 'Edit'}</span>
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-[13px] font-semibold">
                            <span className="text-proton-accent">
                              {formData.listingType === 'service'
                                ? (language === 'ka' ? '⚡ სერვისი' : '⚡ Service')
                                : formData.listingType === 'project'
                                ? (language === 'ka' ? '🚀 პროექტი' : '🚀 Project')
                                : (language === 'ka' ? '📦 პროდუქტი' : '📦 Product')}
                            </span>
                            <span aria-hidden="true" className={currentTheme.muted}>·</span>
                            <span className={currentTheme.text}>
                              {getCategoryLabel(formData.category, t, language)}
                            </span>
                            <span aria-hidden="true" className={currentTheme.muted}>·</span>
                            <span className={currentTheme.muted}>
                              {effectivePrimaryLang === 'ka'
                                ? (language === 'ka' ? 'ენა: ქართული' : 'Primary: KA')
                                : (language === 'ka' ? 'ენა: ინგლისური' : 'Primary: EN')}
                            </span>
                          </div>

                          {secondaryTitle && (
                            <div className="pt-1">
                              <span className={cn("text-xs font-semibold block", currentTheme.muted)}>
                                {effectivePrimaryLang === 'ka'
                                  ? (language === 'ka' ? 'სათაური (EN)' : 'English Title')
                                  : (language === 'ka' ? 'სათაური (GE)' : 'Georgian Title')}
                              </span>
                              <p className={cn("text-[13px] sm:text-sm font-semibold line-clamp-2 mt-0.5 break-words", currentTheme.text)}>
                                {secondaryTitle}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 2 Review: Adapted by Schema & Attributes */}
                      <div className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border flex flex-col justify-between gap-3 min-w-0">
                        <div className="space-y-2.5 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn("text-xs sm:text-[13px] font-bold", currentTheme.accent)}>
                              {step2Title}
                            </span>
                            <button
                              type="button"
                              onClick={() => setFormStep(2)}
                              className={cn("min-h-[38px] px-3 py-1.5 rounded-xl bg-proton-accent/10 hover:bg-proton-accent/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors", currentTheme.accent)}
                            >
                              <Edit3 size={12} />
                              <span>{language === 'ka' ? 'შეცვლა' : 'Edit'}</span>
                            </button>
                          </div>

                          {showOriginalCurrencyLine && (
                            <p className={cn("text-sm font-bold font-mono tabular-nums", currentTheme.text)}>
                              {parsedPreviewPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} {formData.currency}
                            </p>
                          )}

                          {activeSchema.showCondition && (
                            <div className="flex flex-wrap items-center gap-2 text-[13px]">
                              <span className={cn("font-medium", currentTheme.muted)}>
                                {language === 'ka' ? 'მდგომარეობა:' : 'Condition:'}
                              </span>
                              <span className="font-bold text-proton-text">
                                {conditionLabel}
                              </span>
                            </div>
                          )}

                          {activeSchema.showServiceTerms && (
                            <div className="space-y-2">
                              {trimmedDuration && (
                                <div>
                                  <span className={cn("text-xs font-semibold block", currentTheme.muted)}>
                                    ⏱️ {language === 'ka' ? 'შესრულების ვადა' : 'Completion Time'}
                                  </span>
                                  <p className={cn("text-[13px] font-bold mt-0.5 break-words", currentTheme.text)}>
                                    {trimmedDuration}
                                  </p>
                                </div>
                              )}
                              {trimmedTerms && (
                                <div>
                                  <span className={cn("text-xs font-semibold block", currentTheme.muted)}>
                                    📋 {language === 'ka' ? 'სამუშაო პირობები' : 'Work Terms'}
                                  </span>
                                  <p className={cn("text-[13px] font-semibold mt-0.5 break-words", currentTheme.text)}>
                                    {trimmedTerms}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {formattedPreviewAttributes.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-proton-border/60">
                              {formattedPreviewAttributes.map(attr => (
                                <div key={attr.key} className="flex items-start justify-between gap-2 text-xs sm:text-[13px]">
                                  <span className={cn("shrink-0", currentTheme.muted)}>{attr.label}:</span>
                                  <span className={cn("font-bold text-right break-words min-w-0", currentTheme.text)}>{attr.value}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {formData.listingType === 'project' && !showOriginalCurrencyLine && !formData.isNegotiable && formattedPreviewAttributes.length === 0 && (
                            <p className={cn("text-sm font-bold font-mono tabular-nums", currentTheme.text)}>
                              {parsedPreviewPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} {formData.currency}
                            </p>
                          )}

                          {formData.isNegotiable && (
                            <p className="text-xs sm:text-[13px] font-semibold text-emerald-500">
                              ✓ {language === 'ka' ? 'ფასი შეთანხმებით' : 'Negotiable'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Step 3 Review: Address, Remote Status, Media & GPS */}
                      <div className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border flex flex-col justify-between gap-3 min-w-0 lg:col-span-2 xl:col-span-1 2xl:col-span-2">
                        <div className="space-y-2.5 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn("text-xs sm:text-[13px] font-bold", currentTheme.accent)}>
                              {language === 'ka' ? 'ნაბიჯი 3: მდებარეობა და მედია' : 'Step 3: Location & Media'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setFormStep(3)}
                              className={cn("min-h-[38px] px-3 py-1.5 rounded-xl bg-proton-accent/10 hover:bg-proton-accent/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors", currentTheme.accent)}
                            >
                              <Edit3 size={12} />
                              <span>{language === 'ka' ? 'შეცვლა' : 'Edit'}</span>
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-semibold">
                            {effectiveIsRemote && (
                              <span className="text-proton-accent">
                                🌐 {language === 'ka' ? 'დისტანციური / ონლაინ' : 'Remote / Online'}
                              </span>
                            )}
                            {validImages.length > 0 && (
                              <span className={currentTheme.text}>
                                🖼️ {validImages.length} {language === 'ka' ? 'ფოტო' : validImages.length === 1 ? 'Photo' : 'Photos'}
                              </span>
                            )}
                            {hasGpsCoords && (
                              <span className={currentTheme.text}>
                                🛰️ {language === 'ka' ? 'რუკაზე მონიშნულია' : 'Map Pinned'}
                              </span>
                            )}
                          </div>

                          {(!effectiveIsRemote || Boolean((formData.location || '').trim()) || Boolean((formData.city || '').trim())) && (
                            trimmedAddress && (!effectiveIsRemote || Boolean((formData.location || '').trim())) ? (
                              <p className={cn("text-[13px] font-medium break-words", currentTheme.text)}>
                                📍 {trimmedAddress}
                              </p>
                            ) : (
                              <p className={cn("text-[13px] font-medium", currentTheme.text)}>
                                {selectedCountry?.flag} {resolvedLocationForPreview.city}{selectedCountry?.name ? `, ${selectedCountry.name}` : ''}
                              </p>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description Preview */}
                    <div className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border space-y-2 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-xs sm:text-[13px] font-bold", currentTheme.muted)}>
                          {language === 'ka' ? activeSchema.descriptionLabelKa : activeSchema.descriptionLabelEn}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFormStep(3)}
                          className={cn("min-h-[38px] px-3 py-1.5 rounded-xl bg-proton-accent/10 hover:bg-proton-accent/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors", currentTheme.accent)}
                        >
                          <Edit3 size={12} />
                          <span>{language === 'ka' ? 'შეცვლა' : 'Edit'}</span>
                        </button>
                      </div>
                      <p className={cn("text-[13px] sm:text-sm font-sans whitespace-pre-line break-words leading-relaxed max-h-40 overflow-y-auto", currentTheme.subtext)}>
                        {formData.description.trim()}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* Steps Progress Footer Bar */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-5 sm:pt-6 mt-6 border-t border-proton-border">
            <div className={cn(
              "w-full sm:w-auto",
              formStep > 1 ? "grid grid-cols-2 sm:flex sm:items-center gap-2.5" : "flex items-center"
            )}>
              <button 
                type="button"
                onClick={() => {
                  localStorage.removeItem('proton_markethub_draft_form_data');
                  resetListingForm();
                  setViewMode('browse');
                }}
                className="w-full sm:w-auto min-h-[46px] px-4 sm:px-5 bg-proton-bg hover:bg-proton-card border border-proton-border hover:border-proton-accent/40 rounded-2xl text-[13px] sm:text-sm font-bold transition-all text-proton-muted hover:text-proton-text flex items-center justify-center gap-2 shadow-inner active:scale-[0.98] cursor-pointer"
              >
                <ArrowLeft size={15} className="shrink-0" />
                <span className="truncate">{t.common.cancel}</span>
              </button>

              {formStep > 1 && (
                <button 
                  type="button"
                  onClick={() => setFormStep(prev => prev - 1)}
                  className="w-full sm:w-auto min-h-[46px] px-4 sm:px-5 bg-proton-bg hover:bg-proton-card border border-proton-border hover:border-proton-accent/40 rounded-2xl text-[13px] sm:text-sm font-bold transition-all text-proton-text flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                >
                  <ChevronRight size={15} className="rotate-180 text-proton-muted shrink-0" />
                  <span className="truncate">{language === 'ka' ? 'უკან' : 'Back'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center w-full sm:w-auto">
              {formStep < 4 ? (
                <button 
                  type="button"
                  onClick={() => {
                    if (formStep === 1) {
                      const currentPrimary = activeFormPrimaryLang;
                      const tEn = (formData.title || '').trim();
                      const tGe = (formData.titleGe || '').trim();

                      if (currentPrimary === 'ka' && !tGe && tEn) {
                        setFormData(p => ({ ...p, primaryLanguage: 'en' }));
                      } else if (currentPrimary === 'en' && !tEn && tGe) {
                        setFormData(p => ({ ...p, primaryLanguage: 'ka' }));
                      } else if (!tEn && !tGe) {
                        const msg = language === 'ka'
                          ? 'გთხოვთ პირველ ნაბიჯზე შეიყვანოთ განცხადების სათაური გასაგრძელებლად.'
                          : 'Please enter a listing title in Step 1 to continue.';
                        setFieldErrors(prev => ({ ...prev, title: msg }));
                        showToast(msg, 'warning');
                        return;
                      }
                    } else if (formStep === 2) {
                      const priceStr = String(formData.price || '').trim().replace(',', '.');
                      const parsedPrice = parseFloat(priceStr);
                      if (!priceStr || isNaN(parsedPrice) || parsedPrice <= 0) {
                        const msg = language === 'ka'
                          ? "გთხოვთ შეიყვანოთ სწორი ფასი გასაგრძელებლად (მხოლოდ დადებითი რიცხვები)."
                          : "Please enter a valid price to continue (positive numbers only).";
                        setFieldErrors(prev => ({ ...prev, price: msg }));
                        showToast(msg, 'warning');
                        return;
                      }
                      const attrCheck = validateSchemaAttributes(activeSchema, formData.attributes, language);
                      if (!attrCheck.valid) {
                        setFieldErrors(prev => ({ ...prev, ...attrCheck.errors }));
                        showToast(
                          attrCheck.firstErrorMessage || (language === 'ka' ? 'შეავსეთ კატეგორიის სავალდებულო ველები.' : 'Please complete required category fields.'),
                          'warning'
                        );
                        return;
                      }
                    } else if (formStep === 3) {
                      if (!effectiveIsRemote) {
                        const countryStr = (formData.country || '').trim();
                        const cityStr = (formData.city || '').trim();
                        if (!countryStr || !cityStr) {
                          const msg = language === 'ka'
                            ? "გთხოვთ შეავსოთ ქვეყანა და ქალაქი გადახედვამდე."
                            : "Please select a country and city before preview.";
                          setFieldErrors(prev => ({ ...prev, city: msg }));
                          showToast(msg, 'warning');
                          return;
                        }
                      }
                      if (!formData.description.trim()) {
                        const msg = language === 'ka'
                          ? "გთხოვთ შეავსოთ განცხადების აღწერა გადახედვამდე."
                          : "Please fill in the listing description before preview.";
                        setFieldErrors(prev => ({ ...prev, description: msg }));
                        showToast(msg, 'warning');
                        return;
                      }
                    }
                    setFormStep(prev => prev + 1);
                  }}
                  className={cn(
                    "w-full sm:w-auto min-h-[48px] sm:min-h-[46px] px-6 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-sans shadow-md cursor-pointer",
                    currentTheme.accentBg
                  )}
                >
                  <span>
                    {formStep === 3 
                      ? (language === 'ka' ? 'გადახედვა' : 'Preview Listing')
                      : (language === 'ka' ? 'შემდეგი ნაბიჯი' : 'Next Step')}
                  </span>
                  {formStep === 3 ? <Eye size={16} className="stroke-[2.5] shrink-0" /> : <ChevronRight size={16} className="stroke-[2.5] shrink-0" />}
                </button>
              ) : (
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "w-full sm:w-auto min-h-[48px] sm:min-h-[46px] px-6 sm:px-7 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer",
                    currentTheme.accentBg
                  )}
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin shrink-0" /> : <ShieldCheck size={17} className="stroke-[2.5] shrink-0" />}
                  <span>{viewMode === 'edit' ? t.market.form.update : t.market.form.submit}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </motion.div>

      {/* Desktop Live Preview Sidebar (>= 1280px) */}
      <aside
        aria-label={language === 'ka' ? 'განცხადების ცოცხალი გადახედვა' : 'Live listing preview'}
        className="hidden xl:block xl:sticky xl:top-24 space-y-4 min-w-0"
      >
        <div className={cn("p-5 rounded-3xl border backdrop-blur-2xl shadow-xl space-y-4", currentTheme.card)}>
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-proton-border">
            <div className="flex items-center gap-2 min-w-0">
              <Eye size={16} className={cn("shrink-0", currentTheme.accent)} />
              <h3 className={cn("text-sm font-bold truncate", currentTheme.text)}>
                {language === 'ka' ? 'ცოცხალი გადახედვა' : 'Live Preview'}
              </h3>
            </div>
            <span className={cn("text-xs font-semibold tabular-nums shrink-0", currentTheme.muted)}>
              {completedSectionsCount} / 4 {language === 'ka' ? 'მზადაა' : 'ready'}
            </span>
          </div>

          <MarketListingCard
            listing={previewListing}
            idx={0}
            user={null}
            language={language}
            t={t}
            currentTheme={currentTheme}
            priceMap={previewPriceMap}
            convertPrice={activeConvertPrice}
            displayCurrency={activeDisplayCurrency}
            isFavorite={false}
            toggleFavorite={() => {}}
            sellerRating={sellerRating}
            onSelectListing={() => {}}
            onSelectVendor={() => {}}
            onStartEdit={() => {}}
            onDeleteListing={() => {}}
          />

          <div className="pt-2 border-t border-proton-border space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className={currentTheme.muted}>{language === 'ka' ? 'სათაური' : 'Title'}</span>
              <span className={cn("font-semibold", hasTitleFilled ? "text-emerald-500" : currentTheme.muted)}>
                {hasTitleFilled ? (language === 'ka' ? '✓ შევსებულია' : '✓ Added') : (language === 'ka' ? 'საჭიროა' : 'Required')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={currentTheme.muted}>{language === 'ka' ? 'ფასი' : 'Price'}</span>
              <span className={cn("font-semibold", hasPriceFilled ? "text-emerald-500" : currentTheme.muted)}>
                {hasPriceFilled ? `${parsedPreviewPrice.toLocaleString()} ${formData.currency}` : (language === 'ka' ? 'საჭიროა' : 'Required')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={currentTheme.muted}>{language === 'ka' ? 'მდებარეობა' : 'Location'}</span>
              <span className={cn("font-semibold truncate max-w-[190px]", hasLocationFilled ? "text-emerald-500" : currentTheme.muted)}>
                {effectiveIsRemote
                  ? (language === 'ka' ? '✓ ონლაინ' : '✓ Online')
                  : (resolvedLocationForPreview.city || (language === 'ka' ? 'საჭიროა' : 'Required'))}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={currentTheme.muted}>{language === 'ka' ? 'ფოტო' : 'Photo'}</span>
              <span className={cn("font-semibold", hasPhotoFilled ? "text-emerald-500" : currentTheme.muted)}>
                {hasPhotoFilled ? (language === 'ka' ? '✓ ატვირთულია' : '✓ Added') : (language === 'ka' ? 'არასავალდებულო' : 'Optional')}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
