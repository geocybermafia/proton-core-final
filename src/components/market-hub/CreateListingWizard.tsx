import React from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  ShieldCheck,
  ChevronDown,
  ChevronLeft,
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
  Check,
  Star,
  RefreshCw,
  X
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
  getGroupedCategoriesForListingType,
  getListingDirectionsMeta,
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
import {
  ListingFormData,
  UnifiedListingDraft,
  clearUnifiedListingDraft,
  hasMeaningfulDraftContent,
  normalizeDraftOwnerUid,
  readAndMigrateListingDraft,
  saveUnifiedListingDraft,
} from '../../lib/listingDrafts';
import {
  MAX_LISTING_PHOTOS,
  ListingPhotoUploadTask,
  appendUploadedPhotoUrl,
  getAvailablePhotoSlots,
  removePhotoAtIndex,
  reorderPhotosByIndex,
  setPrimaryPhotoAtIndex,
  validateExternalPhotoUrl,
} from '../../lib/listingPhotos';
import {
  getListingPriceDisplayMode,
  getListingPriceValidationMessage,
  isZeroOrEmptyPriceAllowed,
  validateAndNormalizeListingPrice,
} from '../../lib/listingPricing';

export type { ListingFormData };

const AVAILABLE_COUNTRY_OPTIONS = WORLD_COUNTRIES.filter(c => c.code !== 'GLOBAL');

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
  handlePhotoFilesUpload?: (files: FileList | File[]) => void | Promise<void>;
  photoUploadTasks?: ListingPhotoUploadTask[];
  onRetryPhotoUpload?: (taskId: string) => void | Promise<void>;
  onDismissPhotoTask?: (taskId: string) => void;
  onRemovePhotoAt?: (index: number) => void;
  onSetPrimaryPhoto?: (index: number) => void;
  onReorderPhotos?: (fromIndex: number, toIndex: number) => void;
  onAddPhotoUrl?: (url: string) => boolean;
  onDiscardSessionPhotos?: (urls?: string[]) => void;
  userId?: string | null;
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
  handlePhotoFilesUpload,
  photoUploadTasks = [],
  onRetryPhotoUpload,
  onDismissPhotoTask,
  onRemovePhotoAt,
  onSetPrimaryPhoto,
  onReorderPhotos,
  onAddPhotoUrl,
  onDiscardSessionPhotos,
  userId: propUserId,
  isAiGenerating,
  handleAiDescription,
  displayCurrency,
  convertPrice,
  sellerName,
  sellerRating,
}) => {
  const { showToast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [showSecondaryTitle, setShowSecondaryTitle] = React.useState(false);
  const [showAdditionalTerms, setShowAdditionalTerms] = React.useState(false);
  const [showExactLocation, setShowExactLocation] = React.useState(false);
  const [photoUrlInput, setPhotoUrlInput] = React.useState('');
  const [isDragOverDropzone, setIsDragOverDropzone] = React.useState(false);
  const [draggingPhotoIdx, setDraggingPhotoIdx] = React.useState<number | null>(null);
  const [dragTargetPhotoIdx, setDragTargetPhotoIdx] = React.useState<number | null>(null);
  const [showCancelModal, setShowCancelModal] = React.useState(false);

  // Unified Draft Save & Recovery State
  const [draftStatus, setDraftStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedDraftData, setSavedDraftData] = React.useState<UnifiedListingDraft | null>(null);
  const [restoredDraftNotice, setRestoredDraftNotice] = React.useState<{ updatedAt: number; formStep: number } | null>(null);

  const effectiveUserId = React.useMemo(
    () => normalizeDraftOwnerUid(propUserId !== undefined ? propUserId : auth.currentUser?.uid),
    [propUserId]
  );

  // Explicit 3-direction choice before displaying category selector on fresh Create flow
  const [hasSelectedDirection, setHasSelectedDirection] = React.useState<boolean>(() =>
    viewMode === 'edit' || hasMeaningfulDraftContent(formData)
  );
  const prevEffectiveUserIdRef = React.useRef<string>(effectiveUserId);

  const checkedDraftScopeRef = React.useRef<string>('');
  const skipNextAutoSaveRef = React.useRef<boolean>(false);
  const skipUnmountFlushRef = React.useRef<boolean>(false);
  const latestDraftStateRef = React.useRef<{
    viewMode: string;
    userId: string;
    formStep: number;
    formData: ListingFormData;
    language: string;
    hasBlockingBanner: boolean;
  }>({
    viewMode,
    userId: effectiveUserId,
    formStep,
    formData,
    language,
    hasBlockingBanner: false,
  });

  latestDraftStateRef.current = {
    viewMode,
    userId: effectiveUserId,
    formStep,
    formData,
    language,
    hasBlockingBanner: Boolean(savedDraftData),
  };

  const applyDraftToForm = React.useCallback(
    (draft: UnifiedListingDraft) => {
      const restored = draft.formData;
      const restoredType = inferListingType(restored.category, restored.listingType);
      const restoredCategory = isCategoryValidForType(restored.category, restoredType)
        ? restored.category
        : getDefaultCategoryForType(restoredType);
      const restoredSchema = getCategoryFormSchema(restoredType, restoredCategory);
      const normalizedRemote =
        restoredSchema.locationMode === 'remote'
          ? true
          : restoredSchema.locationMode === 'physical'
          ? false
          : Boolean(restored.isRemote);

      skipNextAutoSaveRef.current = true;
      setHasSelectedDirection(true);
      setFormData({
        ...restored,
        listingType: restoredType,
        category: restoredCategory,
        isRemote: normalizedRemote,
        attributes: filterAttributesForSchema(restoredSchema, restored.attributes),
      });
      setFormStep(draft.formStep || 1);
    },
    [setFormData, setFormStep]
  );

  React.useEffect(() => {
    if (prevEffectiveUserIdRef.current !== effectiveUserId) {
      prevEffectiveUserIdRef.current = effectiveUserId;
      checkedDraftScopeRef.current = '';
      setFieldErrors({});
      setPhotoUrlInput('');
      setShowCancelModal(false);
      setShowSecondaryTitle(false);
      setShowAdditionalTerms(false);
      setShowExactLocation(false);
      setSavedDraftData(null);
      setRestoredDraftNotice(null);
      setDraftStatus('idle');
      setHasSelectedDirection(viewMode === 'edit');
    }
  }, [effectiveUserId, viewMode]);

  React.useEffect(() => {
    const scopeKey = `${viewMode}:${effectiveUserId}`;
    if (viewMode !== 'create') {
      checkedDraftScopeRef.current = scopeKey;
      setSavedDraftData(null);
      setRestoredDraftNotice(null);
      setHasSelectedDirection(true);
      return;
    }

    if (checkedDraftScopeRef.current === scopeKey) return;
    checkedDraftScopeRef.current = scopeKey;
    skipUnmountFlushRef.current = false;

    const existingDraft = readAndMigrateListingDraft(effectiveUserId, language);
    if (!existingDraft || existingDraft.mode !== 'create') {
      setSavedDraftData(null);
      setRestoredDraftNotice(null);
      if (!hasMeaningfulDraftContent(formData)) {
        setHasSelectedDirection(false);
      }
      return;
    }

    // Automatically restore draft seamlessly if current form is fresh/empty;
    // otherwise show non-destructive Restore / Start Fresh banner.
    if (!hasMeaningfulDraftContent(formData)) {
      applyDraftToForm(existingDraft);
      setSavedDraftData(null);
      setRestoredDraftNotice({
        updatedAt: existingDraft.updatedAt,
        formStep: existingDraft.formStep,
      });
    } else {
      setSavedDraftData(existingDraft);
    }
  }, [viewMode, effectiveUserId, language, applyDraftToForm, formData]);

  React.useEffect(() => {
    if (viewMode !== 'create') return;
    if (savedDraftData) return; // Don't clobber pending draft choice before user restores or discards
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }

    if (!hasMeaningfulDraftContent(formData)) {
      return;
    }

    setDraftStatus('saving');
    let resetTimer: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      const result = saveUnifiedListingDraft(
        effectiveUserId,
        {
          mode: 'create',
          editingId: null,
          formStep,
          formData,
        },
        language
      );
      if (result.ok) {
        setDraftStatus('saved');
        resetTimer = setTimeout(() => setDraftStatus('idle'), 2500);
      } else {
        setDraftStatus('error');
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [formData, formStep, viewMode, effectiveUserId, language, savedDraftData]);

  // Flush pending draft changes synchronously on page unload or wizard unmount
  React.useEffect(() => {
    const flushPendingDraft = () => {
      const state = latestDraftStateRef.current;
      if (skipUnmountFlushRef.current) return;
      if (state.viewMode !== 'create' || state.hasBlockingBanner) return;
      if (!hasMeaningfulDraftContent(state.formData)) return;
      saveUnifiedListingDraft(
        state.userId,
        {
          mode: 'create',
          editingId: null,
          formStep: state.formStep,
          formData: state.formData,
        },
        state.language
      );
    };

    window.addEventListener('beforeunload', flushPendingDraft);
    return () => {
      window.removeEventListener('beforeunload', flushPendingDraft);
      flushPendingDraft();
    };
  }, []);

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

  const isPriceOptional = React.useMemo(
    () => isZeroOrEmptyPriceAllowed({ category: formData.category, isNegotiable: formData.isNegotiable }),
    [formData.category, formData.isNegotiable]
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

  const handleRemovePhotoAtIndex = React.useCallback(
    (index: number) => {
      if (onRemovePhotoAt) {
        onRemovePhotoAt(index);
      } else {
        setFormData(prev => ({
          ...prev,
          images: removePhotoAtIndex(prev.images || [], index),
        }));
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      showToast(language === 'ka' ? 'ფოტო წაიშალა' : 'Photo removed', 'info');
    },
    [language, onRemovePhotoAt, setFormData, showToast]
  );

  const handleSetPrimaryPhotoAtIndex = React.useCallback(
    (index: number) => {
      if (onSetPrimaryPhoto) {
        onSetPrimaryPhoto(index);
      } else {
        setFormData(prev => ({
          ...prev,
          images: setPrimaryPhotoAtIndex(prev.images || [], index),
        }));
      }
      showToast(language === 'ka' ? 'მთავარი ფოტო განახლდა' : 'Primary photo updated', 'success');
    },
    [language, onSetPrimaryPhoto, setFormData, showToast]
  );

  const handleMovePhoto = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      if (onReorderPhotos) {
        onReorderPhotos(fromIndex, toIndex);
      } else {
        setFormData(prev => ({
          ...prev,
          images: reorderPhotosByIndex(prev.images || [], fromIndex, toIndex),
        }));
      }
    },
    [onReorderPhotos, setFormData]
  );

  const handleAddExternalPhotoUrl = React.useCallback(() => {
    if (onAddPhotoUrl) {
      if (onAddPhotoUrl(photoUrlInput)) {
        setPhotoUrlInput('');
      }
      return;
    }

    const check = validateExternalPhotoUrl(photoUrlInput, formData.images || [], MAX_LISTING_PHOTOS);
    if (!check.valid || !check.normalizedUrl) {
      showToast(
        check.reason === 'limit_reached'
          ? language === 'ka'
            ? `მაქსიმუმ ${MAX_LISTING_PHOTOS} ფოტოს დამატებაა შესაძლებელი.`
            : `Maximum ${MAX_LISTING_PHOTOS} photos allowed.`
          : language === 'ka'
          ? 'შეიყვანეთ სწორი სურათის ბმული.'
          : 'Enter a valid image URL.',
        'warning'
      );
      return;
    }

    setFormData(prev => ({
      ...prev,
      images: appendUploadedPhotoUrl(prev.images || [], check.normalizedUrl!, MAX_LISTING_PHOTOS),
    }));
    setPhotoUrlInput('');
  }, [formData.images, language, onAddPhotoUrl, photoUrlInput, setFormData, showToast]);

  const handleStartFreshDraft = React.useCallback(() => {
    skipUnmountFlushRef.current = true;
    clearUnifiedListingDraft(effectiveUserId);
    onDiscardSessionPhotos?.(formData.images);
    setSavedDraftData(null);
    setRestoredDraftNotice(null);
    setHasSelectedDirection(false);
    setShowSecondaryTitle(false);
    setShowAdditionalTerms(false);
    setShowExactLocation(false);
    resetListingForm();
    showToast(language === 'ka' ? 'მონახაზი წაიშალა' : 'Draft discarded', 'info');
  }, [effectiveUserId, formData.images, language, onDiscardSessionPhotos, resetListingForm, showToast]);

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

  const previewPriceValidation = React.useMemo(
    () =>
      validateAndNormalizeListingPrice({
        rawPrice: formData.price,
        category: formData.category,
        isNegotiable: formData.isNegotiable,
      }),
    [formData.price, formData.category, formData.isNegotiable]
  );

  const parsedPreviewPrice = previewPriceValidation.valid ? previewPriceValidation.price : 0;
  const previewPriceUnspecified = previewPriceValidation.valid
    ? previewPriceValidation.priceUnspecified
    : String(formData.price || '').trim() === '';

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
      priceUnspecified: previewPriceUnspecified,
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
    previewPriceUnspecified,
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
  const hasPriceFilled = previewPriceValidation.valid;
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
          {/* Restored Draft Notice Banner (non-blocking, preserves fields & photos, allows Start Fresh) */}
          {restoredDraftNotice && !savedDraftData && viewMode === 'create' && (
            <div
              data-testid="draft-restored-banner"
              className="p-3.5 sm:p-4 rounded-2xl bg-proton-accent/10 border border-proton-accent/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
            >
              <div className="min-w-0 space-y-0.5">
                <p className={cn("text-xs sm:text-[13px] font-bold flex items-center gap-2", currentTheme.text)}>
                  <span className="w-2 h-2 rounded-full bg-proton-accent shrink-0" />
                  <span>
                    {language === 'ka' ? 'დაუმთავრებელი მონახაზი აღდგენილია' : 'Unfinished draft restored'}
                  </span>
                </p>
                <p className={cn("text-xs font-medium", currentTheme.muted)}>
                  {language === 'ka'
                    ? `ბოლოს შენახული: ${new Date(restoredDraftNotice.updatedAt).toLocaleTimeString()} · ნაბიჯი ${restoredDraftNotice.formStep}`
                    : `Last saved: ${new Date(restoredDraftNotice.updatedAt).toLocaleTimeString()} · Step ${restoredDraftNotice.formStep}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-testid="draft-start-fresh-btn"
                  onClick={handleStartFreshDraft}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-proton-card border border-proton-border text-proton-muted hover:text-rose-500 hover:border-rose-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  {language === 'ka' ? 'ახლის დაწყება' : 'Start Fresh'}
                </button>
                <button
                  type="button"
                  onClick={() => setRestoredDraftNotice(null)}
                  aria-label={language === 'ka' ? 'შეტყობინების დახურვა' : 'Dismiss notice'}
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-proton-card/70 border border-proton-border text-proton-muted hover:text-proton-text flex items-center justify-center cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Non-destructive Draft Restore Banner (when form already contains unsaved data) */}
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
                    applyDraftToForm(savedDraftData);
                    setSavedDraftData(null);
                    setRestoredDraftNotice({
                      updatedAt: savedDraftData.updatedAt,
                      formStep: savedDraftData.formStep,
                    });
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
                  onClick={handleStartFreshDraft}
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
                          if (viewMode === 'create' && !hasSelectedDirection) {
                            const msg = language === 'ka'
                              ? 'გთხოვთ ჯერ აირჩიოთ განცხადების მიმართულება (პროდუქტი, მომსახურება ან პროექტი).'
                              : 'Please choose a marketplace direction first (Product, Service, or Project).';
                            setFieldErrors(prev => ({ ...prev, direction: msg }));
                            showToast(msg, 'warning');
                            return;
                          }
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
                          const priceCheck = validateAndNormalizeListingPrice({
                            rawPrice: formData.price,
                            category: formData.category,
                            isNegotiable: formData.isNegotiable,
                          });
                          if (!priceCheck.valid) {
                            const msg = getListingPriceValidationMessage(priceCheck.reason, language);
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
              {/* Step 1A: Explicit 3 Marketplace Directions First, then Strictly Separated Categories */}
              {(() => {
                const directions = getListingDirectionsMeta(language);
                const activeDirectionsReady = hasSelectedDirection || viewMode === 'edit';
                const canAutoInferType = canInferListingTypeFromCategory(formData.category);
                const isUnmatchedLegacyCategory =
                  Boolean(formData.category) && !canAutoInferType;
                const categoryGroups = getGroupedCategoriesForListingType(
                  formData.listingType,
                  t,
                  language
                );
                const currentDirectionMeta =
                  directions.find(d => d.id === formData.listingType) || directions[0];

                const handleSelectDirection = (nextType: 'product' | 'service' | 'project') => {
                  setHasSelectedDirection(true);
                  clearFieldError('direction');
                  setFormData(prev => {
                    const keepLegacyCategory =
                      Boolean(prev.category) && !canInferListingTypeFromCategory(prev.category);
                    const nextCategory = keepLegacyCategory
                      ? prev.category
                      : isCategoryValidForType(prev.category, nextType)
                      ? prev.category
                      : getDefaultCategoryForType(nextType);
                    const nextSchema = getCategoryFormSchema(nextType, nextCategory);
                    return {
                      ...prev,
                      listingType: nextType,
                      category: nextCategory,
                      isRemote: getDefaultIsRemoteForSchema(nextSchema),
                      attributes: filterAttributesForSchema(nextSchema, prev.attributes),
                    };
                  });
                };

                const handleSelectCategory = (nextCategory: string) => {
                  setHasSelectedDirection(true);
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
                };

                return (
                  <div className="space-y-6">
                    {/* Screen / Section 1: Choose 1 of 3 Main Marketplace Directions */}
                    <div className="space-y-3" data-testid="direction-selector-section">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.accent)}>
                          <span>🧭</span>
                          <span>{language === 'ka' ? 'აირჩიეთ მიმართულება' : 'Choose Marketplace Direction'}</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        {activeDirectionsReady && (
                          <span
                            data-testid="auto-inferred-listing-type"
                            className={cn("text-xs font-semibold flex items-center gap-1.5", currentTheme.muted)}
                          >
                            <span>{language === 'ka' ? 'არჩეული:' : 'Selected:'}</span>
                            <span className={cn("font-bold", currentTheme.text)}>
                              {currentDirectionMeta.emoji} {currentDirectionMeta.title}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {directions.map((dir) => {
                          const isSelected = activeDirectionsReady && formData.listingType === dir.id;
                          return (
                            <button
                              key={dir.id}
                              type="button"
                              data-testid={`direction-card-${dir.id}`}
                              aria-pressed={isSelected}
                              onClick={() => handleSelectDirection(dir.id)}
                              className={cn(
                                "min-h-[96px] p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between gap-2.5 cursor-pointer relative group",
                                isSelected
                                  ? "bg-proton-accent/12 border-proton-accent ring-2 ring-proton-accent/25 shadow-md"
                                  : "bg-proton-bg/75 border-proton-border hover:border-proton-accent/45 hover:bg-proton-bg"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="w-10 h-10 rounded-xl bg-proton-card border border-proton-border flex items-center justify-center text-xl shrink-0">
                                  {dir.emoji}
                                </span>
                                {isSelected && (
                                  <span className="w-6 h-6 rounded-full bg-proton-accent text-proton-on-accent flex items-center justify-center shrink-0">
                                    <Check size={13} className="stroke-[2.5]" />
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 space-y-1">
                                <div className={cn("text-sm font-bold leading-snug", isSelected ? "text-proton-accent" : currentTheme.text)}>
                                  {dir.title}
                                </div>
                                <p className={cn("text-xs font-medium leading-relaxed break-words", currentTheme.muted)}>
                                  {dir.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {fieldErrors.direction && (
                        <p className="text-xs sm:text-[13px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{fieldErrors.direction}</span>
                        </p>
                      )}
                    </div>

                    {/* Screen / Section 2: Strictly Filtered Categories for Selected Direction ONLY */}
                    {activeDirectionsReady && (
                      <div className="space-y-4 pt-2 border-t border-proton-border/70 animate-in fade-in duration-200" data-testid="separated-category-section">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.accent)}>
                            <span>📁</span>
                            <span>
                              {language === 'ka'
                                ? `${currentDirectionMeta.title} — აირჩიეთ კატეგორია`
                                : `${currentDirectionMeta.title} — Select Category`}
                            </span>
                            <span className="text-rose-500">*</span>
                          </label>
                          <span className={cn("text-xs font-medium", currentTheme.muted)}>
                            {language === 'ka'
                              ? `ნაჩვენებია მხოლოდ „${currentDirectionMeta.title}“-ის კატეგორიები`
                              : `Showing ${currentDirectionMeta.title} categories only`}
                          </span>
                        </div>

                        {isUnmatchedLegacyCategory && (
                          <div
                            data-testid="legacy-listing-type-selector"
                            className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div className="text-xs font-semibold text-proton-text">
                              <span className="font-bold text-amber-500 mr-1.5">
                                {language === 'ka' ? 'ძველი კატეგორია შენარჩუნებულია:' : 'Legacy category preserved:'}
                              </span>
                              <span>
                                {CATEGORY_EMOJIS[formData.category] || '🏷️'} {getCategoryLabel(formData.category, t, language)}
                              </span>
                            </div>
                            <span className={cn("text-xs", currentTheme.muted)}>
                              {language === 'ka'
                                ? 'შეგიძლიათ დატოვოთ ან აირჩიოთ ახალი კატეგორია ქვემოთ'
                                : 'Keep it as-is or select a new category below'}
                            </span>
                          </div>
                        )}

                        <div className="space-y-4" data-testid="category-select">
                          {categoryGroups.map((group) => (
                            <div key={group.groupId} className="space-y-2.5">
                              {(categoryGroups.length > 1 || group.subtitle) && (
                                <div className="flex flex-wrap items-baseline justify-between gap-1.5 px-0.5">
                                  <h4 className={cn("text-xs font-bold uppercase tracking-wider", currentTheme.muted)}>
                                    {group.title}
                                  </h4>
                                  {group.subtitle && (
                                    <span className={cn("text-[11px] font-medium", currentTheme.muted)}>
                                      {group.subtitle}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-2">
                                {group.categories.map((cat) => {
                                  const isSelected = formData.category === cat.id;
                                  return (
                                    <button
                                      key={cat.id}
                                      type="button"
                                      data-testid={`category-option-${cat.id}`}
                                      aria-pressed={isSelected}
                                      onClick={() => handleSelectCategory(cat.id)}
                                      className={cn(
                                        "min-h-[46px] px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer",
                                        isSelected
                                          ? "bg-proton-accent/12 border-proton-accent text-proton-accent ring-1 ring-proton-accent/30 shadow-sm font-bold"
                                          : "bg-proton-bg/70 border-proton-border text-proton-text hover:border-proton-accent/40 hover:bg-proton-bg font-semibold"
                                      )}
                                    >
                                      <span className="flex items-center gap-2 min-w-0">
                                        <span className="text-base shrink-0">{cat.emoji}</span>
                                        <span className="text-xs sm:text-[13px] truncate">{cat.label}</span>
                                      </span>
                                      {isSelected && <Check size={14} className="shrink-0 stroke-[2.5]" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Single Primary Title + Collapsible Optional Translation (revealed once direction is picked) */}
              {(hasSelectedDirection || viewMode === 'edit') && (() => {
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
                  <div className="space-y-4 pt-2 border-t border-proton-border/70">
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
                  <label className={cn("text-[13px] sm:text-sm font-bold flex flex-wrap items-center gap-1.5", currentTheme.accent)}>
                    <span>🪙</span> {language === 'ka' ? activeSchema.priceLabelKa : activeSchema.priceLabelEn}
                    {isPriceOptional ? (
                      <span className={cn("text-xs font-medium", currentTheme.muted)}>
                        ({language === 'ka' ? 'არასავალდებულო' : 'optional'})
                      </span>
                    ) : (
                      <span className="text-rose-500">*</span>
                    )}
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center">
                      <Coins size={16} className={cn("opacity-75 group-focus-within:opacity-100 transition-opacity", currentTheme.accent)} />
                    </div>
                    <FastInput 
                      required={!isPriceOptional}
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
                  {fieldErrors.price ? (
                    <p className="text-xs sm:text-[13px] font-semibold text-rose-500 flex items-center gap-1.5 ml-1">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{fieldErrors.price}</span>
                    </p>
                  ) : isPriceOptional ? (
                    <p className={cn("text-xs font-medium ml-1", currentTheme.muted)}>
                      {formData.isNegotiable
                        ? (language === 'ka'
                            ? 'შეგიძლიათ დატოვოთ ცარიელი ან ჩაწეროთ 0 — განცხადებაზე გამოჩნდება „შეთანხმებით“.'
                            : 'You can leave empty or enter 0 — listing will display as Negotiable.')
                        : (language === 'ka'
                            ? 'შეგიძლიათ მიუთითოთ 0 (უფასო) ან დატოვოთ ველი ცარიელი.'
                            : 'You can enter 0 (Free) or leave the price blank.')}
                    </p>
                  ) : null}
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
                  onClick={() => {
                    setFormData(p => ({ ...p, isNegotiable: !p.isNegotiable }));
                    clearFieldError('price');
                  }}
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

              {/* Multi-Photo Upload & Management UI (Up to 10 photos) */}
              {(() => {
                const inFlightTasks = photoUploadTasks.filter(
                  t => t.status === 'resizing' || t.status === 'uploading'
                );
                const remainingSlots = getAvailablePhotoSlots(
                  validImages,
                  inFlightTasks.length,
                  MAX_LISTING_PHOTOS
                );
                const isAtLimit = remainingSlots <= 0;

                return (
                  <div className="space-y-4 min-w-0" data-testid="multi-photo-manager">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className={cn("text-[13px] sm:text-sm font-bold flex items-center gap-1.5", currentTheme.text)}>
                        <span>🖼️</span>
                        <span>{language === 'ka' ? 'ფოტოები' : 'Photos'}</span>
                        <span className={cn("text-xs font-mono tabular-nums ml-1", currentTheme.muted)} data-testid="photo-count-indicator">
                          ({validImages.length} / {MAX_LISTING_PHOTOS})
                        </span>
                      </label>
                      {validImages.length > 1 && (
                        <span className={cn("text-xs font-medium", currentTheme.muted)}>
                          {language === 'ka'
                            ? 'გადააადგილეთ ან დააყენეთ მთავარი ფოტო'
                            : 'Drag, reorder, or choose primary photo'}
                        </span>
                      )}
                    </div>

                    {/* Multi-file Input + Drag & Drop Upload Box */}
                    <div
                      onDragOver={e => {
                        if (isAtLimit) return;
                        e.preventDefault();
                        setIsDragOverDropzone(true);
                      }}
                      onDragLeave={() => setIsDragOverDropzone(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setIsDragOverDropzone(false);
                        if (isAtLimit) {
                          showToast(
                            language === 'ka'
                              ? `მაქსიმუმ ${MAX_LISTING_PHOTOS} ფოტოს დამატებაა შესაძლებელი.`
                              : `Maximum ${MAX_LISTING_PHOTOS} photos allowed per listing.`,
                            'warning'
                          );
                          return;
                        }
                        if (e.dataTransfer?.files?.length) {
                          if (handlePhotoFilesUpload) {
                            void handlePhotoFilesUpload(e.dataTransfer.files);
                          }
                        }
                      }}
                      className={cn(
                        "w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2.5 transition-all relative overflow-hidden",
                        isAtLimit
                          ? "min-h-[120px] bg-proton-bg/40 border-proton-border/60 opacity-75 cursor-not-allowed"
                          : isDragOverDropzone
                          ? "min-h-[145px] sm:min-h-[160px] bg-proton-accent/10 border-proton-accent"
                          : "min-h-[145px] sm:min-h-[160px] bg-proton-bg/60 border-proton-border hover:border-proton-accent/50 hover:bg-proton-bg group cursor-pointer"
                      )}
                    >
                      <input
                        ref={fileInputRef}
                        id="listing-photo-upload-input"
                        data-testid="photo-file-input"
                        type="file"
                        multiple
                        disabled={isAtLimit}
                        onChange={handleFileUpload}
                        accept="image/*"
                        className="hidden"
                      />

                      <label
                        htmlFor={isAtLimit ? undefined : 'listing-photo-upload-input'}
                        className={cn(
                          "w-full h-full min-h-[120px] flex flex-col items-center justify-center gap-2.5 select-none text-center px-4 py-5",
                          isAtLimit ? "cursor-not-allowed" : "cursor-pointer"
                        )}
                      >
                        <div className="p-3 rounded-2xl bg-proton-card border border-proton-border text-proton-muted group-hover:text-proton-accent group-hover:border-proton-accent/40 transition-colors">
                          {isResizing ? (
                            <Loader2 size={22} className="animate-spin text-proton-accent" />
                          ) : (
                            <Camera size={22} />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <span className={cn("text-sm font-bold block transition-colors", !isAtLimit && "group-hover:text-proton-accent", currentTheme.text)}>
                            {isAtLimit
                              ? language === 'ka'
                                ? `მიღწეულია მაქსიმუმი (${MAX_LISTING_PHOTOS}/${MAX_LISTING_PHOTOS})`
                                : `Maximum reached (${MAX_LISTING_PHOTOS}/${MAX_LISTING_PHOTOS})`
                              : validImages.length > 0
                              ? language === 'ka'
                                ? `დამატებითი ფოტოების ატვირთვა (დარჩა ${remainingSlots})`
                                : `Add more photos (${remainingSlots} left)`
                              : t.market.form.upload_button}
                          </span>
                          <span className={cn("text-xs font-medium block", currentTheme.muted)}>
                            {language === 'ka'
                              ? `PNG, JPG ან WEBP · მაქს. ${MAX_LISTING_PHOTOS} ფოტო (თითო 5MB-მდე)`
                              : `PNG, JPG or WEBP · Up to ${MAX_LISTING_PHOTOS} photos (5MB max each)`}
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* Per-Photo Upload Status Queue (Progress / Error / Retry) */}
                    {photoUploadTasks.length > 0 && (
                      <div className="space-y-2" data-testid="photo-upload-queue">
                        {photoUploadTasks.map(task => (
                          <div
                            key={task.id}
                            data-testid={`photo-task-${task.status}`}
                            className={cn(
                              "p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-proton-bg/80",
                              task.status === 'error'
                                ? "border-rose-500/40 bg-rose-500/5"
                                : task.status === 'success'
                                ? "border-emerald-500/40 bg-emerald-500/5"
                                : "border-proton-border"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {task.previewUrl ? (
                                <img
                                  src={task.previewUrl}
                                  alt={task.fileName}
                                  className="w-11 h-11 rounded-lg object-cover shrink-0 border border-proton-border"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-lg bg-proton-card border border-proton-border flex items-center justify-center shrink-0">
                                  <Camera size={16} className={currentTheme.muted} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={cn("text-xs font-bold truncate", currentTheme.text)}>
                                    {task.fileName}
                                  </span>
                                  <span className="text-[11px] font-mono tabular-nums text-proton-muted shrink-0">
                                    {task.status === 'resizing'
                                      ? language === 'ka'
                                        ? 'დამუშავება...'
                                        : 'Resizing...'
                                      : task.status === 'uploading'
                                      ? `${task.progress}%`
                                      : task.status === 'success'
                                      ? language === 'ka'
                                        ? '✓ აიტვირთა'
                                        : '✓ Uploaded'
                                      : language === 'ka'
                                      ? 'შეცდომა'
                                      : 'Failed'}
                                  </span>
                                </div>
                                {(task.status === 'resizing' || task.status === 'uploading') && (
                                  <div className="w-full h-1.5 rounded-full bg-proton-border/60 overflow-hidden">
                                    <div
                                      className="h-full bg-proton-accent transition-all duration-300"
                                      style={{ width: `${Math.max(10, task.progress)}%` }}
                                    />
                                  </div>
                                )}
                                {task.status === 'error' && task.errorMessage && (
                                  <p className="text-xs font-semibold text-rose-500 break-words">
                                    {task.errorMessage}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {task.status === 'error' && onRetryPhotoUpload && (
                                <button
                                  type="button"
                                  data-testid="retry-photo-upload-btn"
                                  onClick={() => void onRetryPhotoUpload(task.id)}
                                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-proton-accent text-proton-on-accent text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                                >
                                  <RefreshCw size={13} />
                                  <span>{language === 'ka' ? 'თავიდან ცდა' : 'Retry'}</span>
                                </button>
                              )}
                              {onDismissPhotoTask && task.status !== 'uploading' && task.status !== 'resizing' && (
                                <button
                                  type="button"
                                  data-testid="dismiss-photo-task-btn"
                                  onClick={() => onDismissPhotoTask(task.id)}
                                  aria-label={language === 'ka' ? 'დახურვა' : 'Dismiss'}
                                  className="min-h-[36px] min-w-[36px] rounded-xl bg-proton-card border border-proton-border text-proton-muted hover:text-rose-500 flex items-center justify-center cursor-pointer"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Uploaded & Saved Photos Preview Grid (Reorder, Set Primary, Delete) */}
                    {validImages.length > 0 && (
                      <div
                        data-testid="photo-preview-grid"
                        className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-4 gap-3"
                      >
                        {validImages.map((imgUrl, idx) => {
                          const isPrimary = idx === 0;
                          const isDragging = draggingPhotoIdx === idx;
                          const isDragTarget = dragTargetPhotoIdx === idx && draggingPhotoIdx !== idx;

                          return (
                            <div
                              key={`${imgUrl}-${idx}`}
                              data-testid={`photo-card-${idx}`}
                              draggable
                              onDragStart={e => {
                                setDraggingPhotoIdx(idx);
                                if (e.dataTransfer) {
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('text/plain', String(idx));
                                }
                              }}
                              onDragOver={e => {
                                e.preventDefault();
                                if (draggingPhotoIdx !== null && draggingPhotoIdx !== idx) {
                                  setDragTargetPhotoIdx(idx);
                                }
                              }}
                              onDragLeave={() => {
                                if (dragTargetPhotoIdx === idx) {
                                  setDragTargetPhotoIdx(null);
                                }
                              }}
                              onDrop={e => {
                                e.preventDefault();
                                const fromIdx = draggingPhotoIdx;
                                setDraggingPhotoIdx(null);
                                setDragTargetPhotoIdx(null);
                                if (fromIdx !== null && fromIdx !== idx) {
                                  handleMovePhoto(fromIdx, idx);
                                }
                              }}
                              onDragEnd={() => {
                                setDraggingPhotoIdx(null);
                                setDragTargetPhotoIdx(null);
                              }}
                              className={cn(
                                "rounded-2xl border bg-proton-bg p-2 flex flex-col gap-2 transition-all min-w-0",
                                isPrimary
                                  ? "border-proton-accent ring-2 ring-proton-accent/25 shadow-md"
                                  : "border-proton-border hover:border-proton-accent/40",
                                isDragging && "opacity-50 scale-[0.98]",
                                isDragTarget && "border-dashed border-proton-accent bg-proton-accent/5"
                              )}
                            >
                              <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-proton-card border border-proton-border/60">
                                <img
                                  src={imgUrl}
                                  alt={`${formData.title || formData.titleGe || 'Listing'} ${idx + 1}`}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover object-center"
                                />

                                <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                                  {isPrimary ? (
                                    <span
                                      data-testid="primary-photo-badge"
                                      className="px-2 py-0.5 rounded-lg bg-proton-accent text-proton-on-accent text-[10px] font-extrabold shadow-sm flex items-center gap-1"
                                    >
                                      <Star size={10} className="fill-current shrink-0" />
                                      <span>{language === 'ka' ? 'მთავარი' : 'Primary'}</span>
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded-lg bg-black/65 text-white text-[10px] font-mono font-bold">
                                      #{idx + 1}
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  data-testid={`delete-photo-${idx}`}
                                  onClick={() => handleRemovePhotoAtIndex(idx)}
                                  aria-label={language === 'ka' ? `ფოტო #${idx + 1} წაშლა` : `Delete photo #${idx + 1}`}
                                  title={language === 'ka' ? 'ფოტოს წაშლა' : 'Delete photo'}
                                  className="absolute top-1.5 right-1.5 min-w-[34px] min-h-[34px] w-8 h-8 rounded-lg bg-black/65 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              {/* Reorder & Set Primary Controls */}
                              <div className="flex items-center justify-between gap-1 min-w-0">
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    data-testid={`move-photo-left-${idx}`}
                                    disabled={idx === 0}
                                    onClick={() => handleMovePhoto(idx, idx - 1)}
                                    aria-label={language === 'ka' ? 'მარცხნივ გადაწევა' : 'Move earlier'}
                                    className="min-w-[34px] min-h-[34px] rounded-lg border border-proton-border bg-proton-card text-proton-text disabled:opacity-35 disabled:cursor-not-allowed hover:border-proton-accent flex items-center justify-center cursor-pointer"
                                  >
                                    <ChevronLeft size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`move-photo-right-${idx}`}
                                    disabled={idx === validImages.length - 1}
                                    onClick={() => handleMovePhoto(idx, idx + 1)}
                                    aria-label={language === 'ka' ? 'მარჯვნივ გადაწევა' : 'Move later'}
                                    className="min-w-[34px] min-h-[34px] rounded-lg border border-proton-border bg-proton-card text-proton-text disabled:opacity-35 disabled:cursor-not-allowed hover:border-proton-accent flex items-center justify-center cursor-pointer"
                                  >
                                    <ChevronRight size={14} />
                                  </button>
                                </div>

                                {!isPrimary ? (
                                  <button
                                    type="button"
                                    data-testid={`set-primary-photo-${idx}`}
                                    onClick={() => handleSetPrimaryPhotoAtIndex(idx)}
                                    className="min-h-[34px] px-2 rounded-lg border border-proton-border bg-proton-card hover:border-proton-accent hover:text-proton-accent text-[11px] font-bold text-proton-muted truncate cursor-pointer transition-colors"
                                  >
                                    {language === 'ka' ? 'მთავარი' : 'Set Main'}
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-bold text-proton-accent truncate px-1">
                                    {language === 'ka' ? 'გარეკანი' : 'Cover'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Photo by External URL (non-destructive append up to 10) */}
                    <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-2 pt-1">
                      <div className="relative flex-1 group min-w-0">
                        <Link size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-proton-muted group-focus-within:text-proton-accent transition-colors" />
                        <input
                          type="url"
                          data-testid="add-photo-url-input"
                          value={photoUrlInput}
                          disabled={isAtLimit}
                          onChange={e => setPhotoUrlInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddExternalPhotoUrl();
                            }
                          }}
                          placeholder={
                            isAtLimit
                              ? language === 'ka'
                                ? `მიღწეულია ${MAX_LISTING_PHOTOS} ფოტოს ლიმიტი`
                                : `${MAX_LISTING_PHOTOS} photo limit reached`
                              : language === 'ka'
                              ? '...ან ჩასვით სურათის გარე ბმული (URL)'
                              : '...or paste external image URL'
                          }
                          className={cn(
                            "w-full min-h-[46px] pl-10.5 pr-4 py-2.5 rounded-2xl border text-base md:text-sm font-medium shadow-inner transition-all scroll-mb-24 disabled:opacity-50",
                            currentTheme.input
                          )}
                        />
                      </div>
                      <button
                        type="button"
                        data-testid="add-photo-url-btn"
                        disabled={isAtLimit || !photoUrlInput.trim()}
                        onClick={handleAddExternalPhotoUrl}
                        className="min-h-[46px] px-4 rounded-2xl bg-proton-card border border-proton-border hover:border-proton-accent text-xs sm:text-[13px] font-bold text-proton-text disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
                      >
                        {language === 'ka' ? '+ დამატება' : '+ Add URL'}
                      </button>
                    </div>
                  </div>
                );
              })()}
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
                const previewPriceMode = getListingPriceDisplayMode(previewListing);
                const showOriginalCurrencyLine =
                  previewPriceMode === 'amount' &&
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
                                ? (language === 'ka' ? '⚡ მომსახურება' : '⚡ Service')
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

                          {previewPriceMode === 'free' && (
                            <p className={cn("text-sm font-bold text-emerald-500")}>
                              ✓ {language === 'ka' ? 'ფასი: უფასო' : 'Price: Free'}
                            </p>
                          )}

                          {previewPriceMode === 'unspecified' && (
                            <p className={cn("text-sm font-semibold", currentTheme.text)}>
                              {language === 'ka' ? 'ფასი: მითითებული არ არის' : 'Price: Not specified'}
                            </p>
                          )}

                          {previewPriceMode === 'amount' && formData.listingType === 'project' && !showOriginalCurrencyLine && !formData.isNegotiable && formattedPreviewAttributes.length === 0 && (
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

                          {validImages.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {validImages.map((imgUrl, idx) => (
                                <div
                                  key={`step4-thumb-${idx}`}
                                  className={cn(
                                    "relative w-12 h-10 rounded-lg overflow-hidden border",
                                    idx === 0 ? "border-proton-accent ring-1 ring-proton-accent/40" : "border-proton-border"
                                  )}
                                >
                                  <img
                                    src={imgUrl}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                  {idx === 0 && (
                                    <span className="absolute bottom-0 inset-x-0 bg-proton-accent/90 text-proton-on-accent text-[8px] font-black text-center leading-tight py-0.5">
                                      1
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
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

          {/* Cancel Confirmation Panel (Non-destructive choice: Keep Draft / Discard / Continue) */}
          {showCancelModal && (
            <div
              role="dialog"
              aria-modal="true"
              data-testid="cancel-wizard-dialog"
              className="p-4 sm:p-5 rounded-2xl bg-proton-bg border border-proton-accent/40 shadow-2xl space-y-3.5"
            >
              <div className="space-y-1">
                <h4 className={cn("text-sm font-bold", currentTheme.text)}>
                  {viewMode === 'edit'
                    ? (language === 'ka' ? 'რედაქტირების შეწყვეტა?' : 'Exit editing?')
                    : (language === 'ka' ? 'მონახაზის შენახვა თუ წაშლა?' : 'Keep or discard draft?')}
                </h4>
                <p className={cn("text-xs leading-relaxed", currentTheme.muted)}>
                  {viewMode === 'edit'
                    ? (language === 'ka'
                        ? 'შეუნახავი ცვლილებები არ შეინახება. გამოქვეყნებული განცხადება უცვლელი დარჩება.'
                        : 'Unsaved changes will not be applied. Your published listing will remain unchanged.')
                    : (language === 'ka'
                        ? 'შეგიძლიათ შეინახოთ მონახაზი მოგვიანებით გასაგრძელებლად ან წაშალოთ იგი.'
                        : 'You can keep your draft to finish later, or discard it completely.')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2">
                <button
                  type="button"
                  data-testid="cancel-continue-editing-btn"
                  onClick={() => setShowCancelModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-proton-card border border-proton-border text-xs font-bold text-proton-text hover:border-proton-accent/50 cursor-pointer"
                >
                  {language === 'ka' ? 'გაგრძელება' : 'Continue Editing'}
                </button>
                {viewMode === 'create' && (
                  <button
                    type="button"
                    data-testid="cancel-keep-draft-btn"
                    onClick={() => {
                      skipUnmountFlushRef.current = true;
                      saveUnifiedListingDraft(
                        effectiveUserId,
                        {
                          mode: 'create',
                          editingId: null,
                          formStep,
                          formData,
                        },
                        language
                      );
                      setShowCancelModal(false);
                      setViewMode('browse');
                      showToast(
                        language === 'ka' ? 'მონახაზი შენახულია' : 'Draft saved for later',
                        'info'
                      );
                    }}
                    className={cn(
                      "min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-sm",
                      currentTheme.accentBg
                    )}
                  >
                    {language === 'ka' ? 'შენახვა და გასვლა' : 'Keep Draft & Exit'}
                  </button>
                )}
                <button
                  type="button"
                  data-testid="cancel-discard-exit-btn"
                  onClick={() => {
                    skipUnmountFlushRef.current = true;
                    if (viewMode === 'create') {
                      clearUnifiedListingDraft(effectiveUserId);
                      onDiscardSessionPhotos?.(formData.images);
                    } else {
                      onDiscardSessionPhotos?.();
                    }
                    setShowCancelModal(false);
                    resetListingForm();
                    setViewMode('browse');
                  }}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs font-bold text-rose-500 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
                >
                  {viewMode === 'edit'
                    ? (language === 'ka' ? 'გასვლა შენახვის გარეშე' : 'Exit Without Saving')
                    : (language === 'ka' ? 'წაშლა და გასვლა' : 'Discard & Exit')}
                </button>
              </div>
            </div>
          )}

          {/* Steps Progress Footer Bar */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-5 sm:pt-6 mt-6 border-t border-proton-border">
            <div className={cn(
              "w-full sm:w-auto",
              formStep > 1 ? "grid grid-cols-2 sm:flex sm:items-center gap-2.5" : "flex items-center"
            )}>
              <button 
                type="button"
                data-testid="wizard-cancel-btn"
                onClick={() => {
                  const hasPendingChanges =
                    hasMeaningfulDraftContent(formData) || photoUploadTasks.length > 0;
                  if (hasPendingChanges) {
                    setShowCancelModal(true);
                    return;
                  }
                  skipUnmountFlushRef.current = true;
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
                      if (viewMode === 'create' && !hasSelectedDirection) {
                        const msg = language === 'ka'
                          ? 'გთხოვთ ჯერ აირჩიოთ განცხადების მიმართულება (პროდუქტი, მომსახურება ან პროექტი).'
                          : 'Please choose a marketplace direction first (Product, Service, or Project).';
                        setFieldErrors(prev => ({ ...prev, direction: msg }));
                        showToast(msg, 'warning');
                        return;
                      }
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
                      const priceCheck = validateAndNormalizeListingPrice({
                        rawPrice: formData.price,
                        category: formData.category,
                        isNegotiable: formData.isNegotiable,
                      });
                      if (!priceCheck.valid) {
                        const msg = getListingPriceValidationMessage(priceCheck.reason, language);
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
                {(() => {
                  if (!hasPriceFilled) return language === 'ka' ? 'საჭიროა' : 'Required';
                  const mode = getListingPriceDisplayMode(previewListing);
                  if (mode === 'negotiable') return language === 'ka' ? '✓ შეთანხმებით' : '✓ Negotiable';
                  if (mode === 'free') return language === 'ka' ? '✓ უფასო' : '✓ Free';
                  if (mode === 'unspecified') return language === 'ka' ? '✓ მითითებული არ არის' : '✓ Not specified';
                  return `${parsedPreviewPrice.toLocaleString()} ${formData.currency}`;
                })()}
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
              <span className={currentTheme.muted}>{language === 'ka' ? 'ფოტო' : 'Photos'}</span>
              <span className={cn("font-semibold", hasPhotoFilled ? "text-emerald-500" : currentTheme.muted)}>
                {hasPhotoFilled ? `✓ ${validImages.length} / ${MAX_LISTING_PHOTOS}` : (language === 'ka' ? 'არასავალდებულო' : 'Optional')}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
