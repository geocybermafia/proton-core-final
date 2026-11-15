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
  Languages
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  MarketTheme,
  CURRENCIES,
  WORLD_COUNTRIES,
  CATEGORY_EMOJIS,
  getCategoriesForListingType,
  getCategoryLabel,
  getDefaultCategoryForType,
  isCategoryValidForType,
  roundPriceForDisplayCurrency
} from './MarketConstants';
import { Listing } from '../../types';
import { MarketListingCard } from './MarketListingCard';
import { FastInput } from './FastInputs';
import { MapPicker } from '../MapPicker';
import { useToast } from '../Toast';

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

  const selectedCountry = React.useMemo(() => {
    return WORLD_COUNTRIES.find(c => c.code === formData.country);
  }, [formData.country]);

  const conditionLabel = React.useMemo(() => {
    if (formData.condition === 'new') return language === 'ka' ? 'ახალი' : 'Brand New';
    if (formData.condition === 'used') return language === 'ka' ? 'მეორადი' : 'Used';
    if (formData.condition === 'refurbished') return language === 'ka' ? 'აღდგენილი' : 'Restored';
    return formData.condition || (language === 'ka' ? 'ახალი' : 'New');
  }, [formData.condition, language]);

  const effectivePrimaryLang: 'ka' | 'en' = React.useMemo(() => {
    const rawTitleEn = (formData.title || '').trim();
    const rawTitleGe = (formData.titleGe || '').trim();
    let lang: 'ka' | 'en' = formData.primaryLanguage || (language === 'ka' ? 'ka' : 'en');
    if (lang === 'ka' && !rawTitleGe && rawTitleEn) {
      lang = 'en';
    } else if (lang === 'en' && !rawTitleEn && rawTitleGe) {
      lang = 'ka';
    }
    return lang;
  }, [formData.primaryLanguage, formData.title, formData.titleGe, language]);

  const validImages = React.useMemo(
    () => (formData.images || []).map(img => (typeof img === 'string' ? img.trim() : '')).filter(Boolean),
    [formData.images]
  );

  const parsedPreviewPrice = React.useMemo(() => {
    const priceStr = String(formData.price || '').trim().replace(',', '.');
    const parsed = parseFloat(priceStr);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [formData.price]);

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
      location: (formData.location || '').trim(),
      country: formData.country,
      city: (formData.city || '').trim(),
      lat: formData.lat,
      lng: formData.lng,
      createdAt: Date.now(),
      status: 'active',
      condition: formData.listingType === 'product' ? (formData.condition || 'new') : undefined,
      isNegotiable: Boolean(formData.isNegotiable),
      listingType: formData.listingType,
      serviceDuration: formData.listingType === 'service' ? (formData.serviceDuration || '').trim() : '',
      serviceTerms: formData.listingType === 'service' ? (formData.serviceTerms || '').trim() : '',
    };
  }, [
    effectivePrimaryLang,
    formData.title,
    formData.titleGe,
    formData.description,
    formData.descriptionGe,
    formData.currency,
    formData.category,
    formData.location,
    formData.country,
    formData.city,
    formData.lat,
    formData.lng,
    formData.listingType,
    formData.condition,
    formData.isNegotiable,
    formData.serviceDuration,
    formData.serviceTerms,
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "max-w-2xl mx-auto p-4 sm:p-12 pb-24 sm:pb-12 rounded-[28px] sm:rounded-[48px] border backdrop-blur-2xl relative overflow-hidden shadow-2xl",
        currentTheme.card,
        "hover:border-proton-accent/40 transition-colors duration-500"
      )}
    >
      {/* Dynamic Ambient Background Gradients */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-proton-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-proton-secondary/10 rounded-full blur-[100px] pointer-events-none" />

      <form onSubmit={handleFormSubmit} onKeyDown={handleFormKeyDown} className="space-y-10 relative z-10">
        {/* Dynamic Interactive Steps Header */}
        <div className="flex flex-col gap-6 mb-8 pb-8 border-b border-proton-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className={cn("p-3 rounded-2xl bg-proton-accent/10 border border-proton-accent/25 select-none", currentTheme.accent)}>
                <Plus size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h2 className={cn("text-base font-black uppercase tracking-wider font-sans", currentTheme.text)}>
                  {viewMode === 'create' ? (language === 'ka' ? 'განცხადების შექმნა' : 'Create Listing') : (language === 'ka' ? 'რედაქტირება' : 'Edit Listing')}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-pulse" />
                  <p className="text-[10px] font-black text-proton-accent uppercase tracking-widest">
                    {language === 'ka' ? `ნაბიჯი ${formStep} 4-დან` : `Step ${formStep} of 4`}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Compact step progress radial tracker */}
            <div className="text-[10px] font-mono font-black text-proton-muted bg-proton-bg px-3 py-1.5 rounded-full border border-proton-border select-none">
              PROGRESS: {formStep === 1 ? '25%' : formStep === 2 ? '50%' : formStep === 3 ? '75%' : '100%'}
            </div>
          </div>

          {/* Interconnecting Modern Custom Stepper Slider */}
          <div className="relative pt-2">
            {/* Background Progress Railway Line */}
            <div className="absolute top-6 left-0 right-0 h-[2px] bg-proton-border/45 rounded-full">
              <div 
                className="h-full bg-proton-accent transition-all duration-500 rounded-full"
                style={{ width: formStep === 1 ? '12.5%' : formStep === 2 ? '37.5%' : formStep === 3 ? '62.5%' : '87.5%' }}
              />
            </div>
            
            <div className="flex items-center justify-between relative">
              {[1, 2, 3, 4].map((step) => {
                const stepTitles = [
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
                        const currentPrimary = formData.primaryLanguage || (language === 'ka' ? 'ka' : 'en');
                        const tEn = (formData.title || '').trim();
                        const tGe = (formData.titleGe || '').trim();

                        if (currentPrimary === 'ka' && !tGe && tEn) {
                          setFormData(p => ({ ...p, primaryLanguage: 'en' }));
                        } else if (currentPrimary === 'en' && !tEn && tGe) {
                          setFormData(p => ({ ...p, primaryLanguage: 'ka' }));
                        } else if (!tEn && !tGe) {
                          showToast(
                            language === 'ka' 
                              ? `გთხოვთ პირველ ნაბიჯზე შეიყვანოთ სათაური ძირითად ენაზე (${currentPrimary === 'ka' ? 'ქართულად' : 'ინგლისურად'}) გასაგრძელებლად.` 
                              : `Please enter a listing title in the primary language (${currentPrimary === 'ka' ? 'Georgian' : 'English'}) to continue.`, 
                            'warning'
                          );
                          return;
                        }
                      }
                      if (step > 2) {
                        const priceStr = String(formData.price || '').trim().replace(',', '.');
                        const parsedPrice = parseFloat(priceStr);
                        if (!priceStr || isNaN(parsedPrice) || parsedPrice <= 0) {
                          showToast(language === 'ka' 
                            ? "გთხოვთ შეიყვანოთ სწორი ფასი გასაგრძელებლად (მხოლოდ დადებითი რიცხვები)." 
                            : "Please enter a valid price to continue (positive numbers only).",
                            'warning'
                          );
                          return;
                        }
                      }
                      if (step > 3) {
                        const countryStr = (formData.country || '').trim();
                        const cityStr = (formData.city || '').trim();
                        if (!countryStr || !cityStr) {
                          showToast(language === 'ka' 
                            ? "გთხოვთ შეავსოთ ქვეყანა და ქალაქი გადახედვამდე." 
                            : "Please select a country and enter a city before preview.",
                            'warning'
                          );
                          return;
                        }
                        if (!formData.description.trim()) {
                          showToast(language === 'ka' ? "გთხოვთ შეავსოთ ნივთის აღწერა გადახედვამდე." : "Please fill in the product description before preview.", 'warning');
                          return;
                        }
                      }
                      setFormStep(step);
                    }}
                    className="group flex flex-col items-center focus:outline-none transition-all duration-300"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full border flex items-center justify-center text-xs font-black transition-all duration-500 z-10",
                      isActive
                        ? "bg-proton-accent border-proton-accent text-proton-on-accent shadow-md scale-110"
                        : isCompleted
                        ? "bg-proton-card border-proton-accent/60 text-proton-accent hover:border-proton-accent"
                        : "bg-proton-bg border-proton-border text-proton-muted hover:text-proton-text hover:border-proton-accent/40"
                    )}>
                      {isCompleted ? (
                        <ShieldCheck size={16} className="stroke-[2.5]" />
                      ) : (
                        <span className="font-mono">{step}</span>
                      )}
                    </div>
                    <span className={cn(
                      "text-[8px] sm:text-[9px] font-black uppercase tracking-tight sm:tracking-widest mt-2 sm:mt-2.5 transition-all duration-500 text-center",
                      isActive ? "text-proton-accent" : "text-proton-muted group-hover:text-proton-text"
                    )}>
                      {stepTitles[step - 1]}
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
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
            className="space-y-8 animate-in fade-in"
          >
            {/* Listing Type Cards Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.accent)}>
                  <span>⚡</span> {language === 'ka' ? 'განცხადების ტიპი' : 'Listing Type'}
                </label>
                <span className={cn("text-[8px] font-mono block uppercase", currentTheme.muted)}>{language === 'ka' ? 'აირჩიეთ ტიპი' : 'Choose type'}</span>
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
                    descEn: 'Items, equipment & physical goods',
                    descKa: 'ნივთები, ტექნიკა და პროდუქცია'
                  },
                  { 
                    type: 'project', 
                    emoji: '🚀', 
                    labelEn: 'Project', 
                    labelKa: 'პროექტი',
                    descEn: 'Digital projects, jobs & partnerships',
                    descKa: 'ციფრული პროექტები, ვაკანსიები და პარტნიორობა'
                  }
                ].map(item => {
                  const isSelected = formData.listingType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => {
                        const nextType = item.type as 'product' | 'service' | 'project';
                        setFormData(prev => ({ 
                          ...prev, 
                          listingType: nextType,
                          category: isCategoryValidForType(prev.category, nextType)
                            ? prev.category
                            : getDefaultCategoryForType(nextType)
                        }));
                      }}
                      className={cn(
                        "relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center gap-2 hover:scale-[1.03] group overflow-hidden cursor-pointer",
                        isSelected
                          ? "bg-proton-accent/10 border-proton-accent text-proton-accent shadow-sm ring-1 ring-proton-accent/30"
                          : "bg-proton-bg/70 border-proton-border text-proton-muted hover:text-proton-text hover:bg-proton-bg hover:border-proton-accent/30"
                      )}
                    >
                      {isSelected && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-proton-accent" />
                      )}
                      <span className="text-2xl mb-1 group-hover:scale-110 transition-transform duration-300">
                        {item.emoji}
                      </span>
                      <span className={cn("text-xs font-black uppercase tracking-wider", isSelected ? currentTheme.accent : currentTheme.text)}>
                        {language === 'ka' ? item.labelKa : item.labelEn}
                      </span>
                      <span className={cn("text-[8px] font-semibold leading-relaxed max-w-[150px] uppercase tracking-wide", currentTheme.muted)}>
                        {language === 'ka' ? item.descKa : item.descEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Listing Category Selection */}
            <div className="space-y-3">
              <label className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.accent)}>
                <span>📁</span> {t.market.form.category}
              </label>
              <div className="relative group">
                {(() => {
                  const availableCategories = getCategoriesForListingType(formData.listingType, t, language);
                  const isLegacyCategoryInEdit =
                    viewMode === 'edit' &&
                    Boolean(formData.category) &&
                    !availableCategories.some(cat => cat.id === formData.category);
                  const selectValue =
                    isLegacyCategoryInEdit || availableCategories.some(cat => cat.id === formData.category)
                      ? formData.category
                      : getDefaultCategoryForType(formData.listingType);

                  return (
                    <select 
                      value={selectValue}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className={cn(
                        "w-full pl-4 pr-10 py-3.5 rounded-2xl border appearance-none text-xs font-bold tracking-wide shadow-inner transition-all cursor-pointer",
                        currentTheme.input
                      )}
                    >
                      {isLegacyCategoryInEdit && (
                        <option value={formData.category} className="bg-proton-card text-proton-text font-semibold py-2">
                          {CATEGORY_EMOJIS[formData.category] || '🏷️'} {getCategoryLabel(formData.category, t, language)}
                        </option>
                      )}
                      {availableCategories.map(cat => (
                        <option key={cat.id} value={cat.id} className="bg-proton-card text-proton-text font-semibold py-2">
                          {cat.emoji} {cat.label}
                        </option>
                      ))}
                    </select>
                  );
                })()}
                <ChevronDown size={14} className="absolute right-4.5 top-1/2 -translate-y-1/2 text-proton-muted pointer-events-none group-hover:text-proton-text transition-colors" />
              </div>
            </div>

            {/* Primary Language Selection & Multilingual Titles */}
            {(() => {
              const activePrimary = formData.primaryLanguage || (language === 'ka' ? 'ka' : 'en');
              const isKaPrimary = activePrimary === 'ka';

              return (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Languages size={15} className={currentTheme.accent} />
                        <span className={cn("text-[11px] font-black uppercase tracking-wider", currentTheme.text)}>
                          {language === 'ka' ? 'განცხადების ძირითადი ენა' : 'Primary Listing Language'}
                        </span>
                      </div>
                      <p className={cn("text-[10px] font-medium", currentTheme.muted)}>
                        {language === 'ka'
                          ? 'ძირითად ენაზე სათაური სავალდებულოა. დამატებითი ენა არასავალდებულოა.'
                          : 'Title in primary language is required. Secondary language title is optional.'}
                      </p>
                    </div>

                    <div className="inline-flex p-1 rounded-xl bg-proton-card border border-proton-border self-start sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, primaryLanguage: 'ka' }))}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                          isKaPrimary
                            ? "bg-proton-accent text-proton-on-accent shadow-sm font-black"
                            : "text-proton-muted hover:text-proton-text hover:bg-proton-bg"
                        )}
                      >
                        <span>🇬🇪</span>
                        <span>ქართული</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, primaryLanguage: 'en' }))}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                          !isKaPrimary
                            ? "bg-proton-accent text-proton-on-accent shadow-sm font-black"
                            : "text-proton-muted hover:text-proton-text hover:bg-proton-bg"
                        )}
                      >
                        <span>🇬🇧</span>
                        <span>English</span>
                      </button>
                    </div>
                  </div>

                  {/* Title inputs in GE & EN */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Georgian Title Field */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs">🇬🇪</span>
                          <label className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            isKaPrimary ? currentTheme.accent : currentTheme.muted
                          )}>
                            {t.market.form.title} (GE)
                          </label>
                        </div>
                        <span className={cn(
                          "text-[8px] font-mono px-2 py-0.5 rounded-md uppercase tracking-wider font-bold border",
                          isKaPrimary 
                            ? "bg-proton-accent/15 text-proton-accent border-proton-accent/30" 
                            : "bg-proton-bg text-proton-muted border-proton-border"
                        )}>
                          {isKaPrimary
                            ? (language === 'ka' ? 'ძირითადი • სავალდებულო' : 'Primary • Required')
                            : (language === 'ka' ? 'დამატებითი • არასავალდებულო' : 'Secondary • Optional')}
                        </span>
                      </div>
                      <div className="relative">
                        <FastInput 
                          type="text"
                          value={formData.titleGe}
                          onCommit={val => setFormData(p => ({ ...p, titleGe: val }))}
                          placeholder={isKaPrimary
                            ? (language === 'ka' ? 'მაგ: iPhone 14 Pro ან ხის მაგიდა (სავალდებულო)' : 'e.g. iPhone 14 Pro or Wooden Desk (Required)')
                            : (language === 'ka' ? 'მაგ: iPhone 14 Pro ან ხის მაგიდა (არასავალდებულო)' : 'e.g. iPhone 14 Pro or Wooden Desk (Optional)')
                          }
                          className={cn(
                            "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-bold shadow-inner transition-all",
                            currentTheme.input
                          )}
                        />
                      </div>
                    </div>

                    {/* English Title Field */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs">🇬🇧</span>
                          <label className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            !isKaPrimary ? currentTheme.accent : currentTheme.muted
                          )}>
                            {t.market.form.title} (EN)
                          </label>
                        </div>
                        <span className={cn(
                          "text-[8px] font-mono px-2 py-0.5 rounded-md uppercase tracking-wider font-bold border",
                          !isKaPrimary 
                            ? "bg-proton-accent/15 text-proton-accent border-proton-accent/30" 
                            : "bg-proton-bg text-proton-muted border-proton-border"
                        )}>
                          {!isKaPrimary
                            ? (language === 'ka' ? 'ძირითადი • სავალდებულო' : 'Primary • Required')
                            : (language === 'ka' ? 'დამატებითი • არასავალდებულო' : 'Secondary • Optional')}
                        </span>
                      </div>
                      <div className="relative">
                        <FastInput 
                          type="text"
                          value={formData.title}
                          onCommit={val => setFormData(p => ({ ...p, title: val }))}
                          placeholder={!isKaPrimary
                            ? (language === 'ka' ? 'e.g. iPhone 14 Pro or Wooden Desk (სავალდებულო)' : 'e.g. iPhone 14 Pro or Wooden Desk (Required)')
                            : (language === 'ka' ? 'e.g. iPhone 14 Pro or Wooden Desk (არასავალდებულო)' : 'e.g. iPhone 14 Pro or Wooden Desk (Optional)')
                          }
                          className={cn(
                            "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-bold shadow-inner transition-all",
                            currentTheme.input
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
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
                <label className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.accent)}>
                  <span>🪙</span> {t.market.form.price}
                </label>
                <div className="relative group">
                  <div className="absolute left-4.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Coins size={14} className={cn("opacity-70 group-focus-within:opacity-100 transition-opacity", currentTheme.accent)} />
                  </div>
                  <FastInput 
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={formData.price}
                    onCommit={val => setFormData(p => ({ ...p, price: val }))}
                    placeholder="0.00"
                    className={cn(
                      "w-full pl-11 pr-4 py-3.5 rounded-2xl border text-xs font-bold shadow-inner transition-all",
                      currentTheme.input
                    )}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.muted)}>
                  <span>💵</span> {t.market.form.currency}
                </label>
                <div className="relative group">
                  <select 
                    value={formData.currency}
                    onChange={e => setFormData({...formData, currency: e.target.value})}
                    className={cn(
                      "w-full pl-4.5 pr-10 py-3.5 rounded-2xl border appearance-none text-xs font-mono font-bold transition-all cursor-pointer",
                      currentTheme.input
                    )}
                  >
                    {CURRENCIES.map(curr => (
                      <option key={curr.code} value={curr.code} className="bg-proton-card text-proton-text font-mono font-bold">
                        {curr.code} ({curr.symbol})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4.5 top-1/2 -translate-y-1/2 text-proton-muted pointer-events-none group-hover:text-proton-text transition-colors" />
                </div>
              </div>
            </div>

            {/* Product Condition Selection Header & Sliding Tabs (Products only) */}
            {formData.listingType === 'product' && (
              <div className="space-y-4">
                <label className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.accent)}>
                  <span>📦</span> {language === 'ka' ? 'ნივთის მდგომარეობა' : 'Item Condition'}
                </label>
                
                <div className="grid grid-cols-3 gap-3 p-1.5 rounded-2xl bg-proton-bg border border-proton-border">
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
                          "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer",
                          isAct 
                            ? "bg-proton-accent text-proton-on-accent shadow-sm"
                            : "text-proton-muted hover:text-proton-text hover:bg-proton-card"
                        )}
                      >
                        <span className="text-xs">{cond.icon}</span>
                        <span className="text-[9px] font-black">{language === 'ka' ? cond.titleKa : cond.titleEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price Negotiable Box & Switch */}
            <div className="p-1 px-4 py-3.5 rounded-2xl bg-proton-bg/70 border border-proton-border flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl bg-proton-accent/10 border border-proton-accent/25", currentTheme.accent)}>
                  <Tag size={14} className="stroke-[2.5]" />
                </div>
                <div>
                  <h4 className={cn("text-xs font-black uppercase tracking-wider", currentTheme.text)}>
                    {language === 'ka' ? 'ფასი შეთანხმებით' : 'Negotiable Price'}
                  </h4>
                  <p className={cn("text-[9px] font-semibold uppercase tracking-widest mt-0.5", currentTheme.muted)}>
                    {language === 'ka' ? 'ფასი ექვემდებარება მოლაპარაკებას' : 'Open to price offers from buyers'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFormData({...formData, isNegotiable: !formData.isNegotiable})}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none",
                  formData.isNegotiable ? "bg-proton-accent" : "bg-proton-border"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-3xl bg-proton-accent/5 border border-proton-accent/20 shadow-inner">
                <div className="space-y-3">
                  <label className={cn("text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ml-0.5", currentTheme.accent)}>
                    <span className="text-[10px]">⏱️</span> {language === 'ka' ? 'შესრულების ვადა' : 'Estimated Completion Time'}
                  </label>
                  <FastInput 
                    type="text"
                    value={formData.serviceDuration || ''}
                    onCommit={val => setFormData(p => ({ ...p, serviceDuration: val }))}
                    placeholder={language === 'ka' ? "მაგ: 3 დღე" : "e.g. 3 business days"}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border text-xs font-bold transition-all",
                      currentTheme.input
                    )}
                  />
                </div>

                <div className="space-y-3">
                  <label className={cn("text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ml-0.5", currentTheme.accent)}>
                    <span className="text-[10px]">📋</span> {language === 'ka' ? 'სამუშაო პირობები' : 'Work Terms & Requirements'}
                  </label>
                  <FastInput 
                    type="text"
                    value={formData.serviceTerms || ''}
                    onCommit={val => setFormData(p => ({ ...p, serviceTerms: val }))}
                    placeholder={language === 'ka' ? "მაგ: შეთანხმების მიხედვით" : "e.g. As agreed with client"}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border text-xs font-bold transition-all",
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
                <label className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.accent)}>
                  <span>🗺️</span> {t.market.form.country}
                </label>
                <div className="relative group">
                  <select 
                    value={formData.country}
                    onChange={e => setFormData({...formData, country: e.target.value})}
                    className={cn(
                      "w-full pl-4.5 pr-10 py-3.5 rounded-2xl border appearance-none text-xs font-bold transition-all cursor-pointer",
                      currentTheme.input
                    )}
                  >
                    {AVAILABLE_COUNTRY_OPTIONS.map(country => (
                      <option key={country.code} value={country.code} className="bg-proton-card text-proton-text font-bold text-xs py-1">
                        {country.flag} {country.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4.5 top-1/2 -translate-y-1/2 text-proton-muted pointer-events-none group-hover:text-proton-text transition-colors" />
                </div>
              </div>

              <div className="space-y-3">
                <label className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.muted)}>
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
                      "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-bold shadow-inner transition-all",
                      currentTheme.input
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Address Location Input */}
            <div className="space-y-3">
              <label className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.muted)}>
                <span>📍</span> {t.market.form.location}
              </label>
              <div className="relative group">
                <MapPin size={14} className="absolute left-4.5 top-1/2 -translate-y-1/2 text-proton-muted group-focus-within:text-proton-accent transition-colors" />
                <FastInput 
                  type="text"
                  value={formData.location}
                  onCommit={val => setFormData(p => ({ ...p, location: val }))}
                  placeholder={language === 'ka' ? 'მისამართის დეტალები/მითითებები...' : 'Detailed address directions...'}
                  className={cn(
                    "w-full pl-11 pr-4 py-3.5 rounded-2xl border text-xs font-bold shadow-inner transition-all",
                    currentTheme.input
                  )}
                />
              </div>
            </div>

            {/* Interactive Map Coordinates Picker Container */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.accent)}>
                  <span>🛰️</span> {language === 'ka' ? 'მდებარეობა რუკაზე' : 'Location on Map'}
                </label>
                <span className={cn("text-[8px] font-mono block uppercase", currentTheme.muted)}>
                  {language === 'ka' ? 'კოორდინატები: ' : 'COORDS: '}{formData.lat !== undefined && formData.lat !== null ? formData.lat.toFixed(4) : "41.7151"}, {formData.lng !== undefined && formData.lng !== null ? formData.lng.toFixed(4) : "44.8271"}
                </span>
              </div>
              
              <div className="p-1 rounded-[28px] bg-proton-bg border border-proton-border overflow-hidden shadow-xl relative">
                <div className="w-full h-64 min-h-[250px] rounded-[24px] overflow-hidden relative">
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

            {/* Form Description and Spark AI Helper Button */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.accent)}>
                  <span>📋</span> {t.market.form.description}
                </label>
                
                <button
                  type="button"
                  onClick={handleAiDescription}
                  disabled={isAiGenerating}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                    "bg-proton-accent/10 border border-proton-accent/30 hover:border-proton-accent text-proton-accent disabled:opacity-50"
                  )}
                >
                  {isAiGenerating ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Sparkles size={10} className="stroke-[2.5] text-proton-accent" />
                  )}
                  {language === 'ka' ? 'AI შაბლონი' : 'AI Generate Description'}
                </button>
              </div>
              
              <textarea 
                required
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder={language === 'ka' ? 'აღწერეთ თქვენი ნივთი ან მომსახურება დეტალურად...' : 'Describe your item or service in detail...'}
                className={cn(
                  "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-semibold h-36 resize-none shadow-inner transition-all",
                  currentTheme.input
                )}
              />
            </div>

            {/* Graphic/Image upload box */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", currentTheme.muted)}>
                  <span>🖼️</span> {t.market.form.image_url}
                </label>
                {formData.images?.[0] && !isResizing && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer px-2 py-0.5 rounded-lg hover:bg-rose-500/10"
                  >
                    <Trash2 size={11} />
                    <span>{language === 'ka' ? 'ფოტოს წაშლა' : 'Remove Photo'}</span>
                  </button>
                )}
              </div>
              
              <div 
                className={cn(
                  "w-full h-44 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all overflow-hidden relative",
                  (formData.images?.[0] || isResizing) 
                    ? "border-proton-border bg-proton-bg shadow-lg" 
                    : "bg-proton-bg/60 border-proton-border hover:border-proton-accent/50 hover:bg-proton-bg group cursor-pointer"
                )}
              >
                {!formData.images?.[0] && !isResizing && (
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-proton-accent/40 to-transparent group-hover:animate-ping pointer-events-none" />
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
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className={cn("w-8 h-8 animate-spin", currentTheme.accent)} />
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", currentTheme.accent)}>
                      {language === 'ka' ? 'ფოტო მუშავდება...' : 'Processing Photo...'}
                    </span>
                  </div>
                ) : formData.images?.[0] ? (
                  <div className="relative w-full h-full p-2.5">
                    <img 
                      src={formData.images[0]} 
                      className="w-full h-full object-cover rounded-2xl" 
                      alt={formData.title || formData.titleGe || 'Listing'} 
                    />
                    
                    <div className="absolute bottom-5 left-5 bg-proton-card/90 border border-proton-border px-3 py-1.5 rounded-xl backdrop-blur-md select-none pointer-events-none animate-fade-in">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-pulse" />
                        <span className={cn("text-[8px] font-mono font-black uppercase tracking-wider", currentTheme.text)}>
                          {language === 'ka' ? 'ფოტო მზადაა' : 'PHOTO READY'}
                        </span>
                      </div>
                    </div>

                    {/* Action Controls: Replace and Remove */}
                    <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                      <label 
                        htmlFor="listing-photo-upload-input"
                        className="bg-proton-card/90 hover:bg-proton-card border border-proton-border hover:border-proton-accent px-2.5 py-1.5 rounded-xl backdrop-blur-md cursor-pointer shadow-lg flex items-center gap-1.5 transition-all text-proton-accent active:scale-95 select-none"
                      >
                        <Camera size={12} />
                        <span className="text-[8px] font-black uppercase tracking-wider">
                          {language === 'ka' ? 'შეცვლა' : 'Replace'}
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="bg-proton-card/90 hover:bg-rose-600 border border-rose-500/40 px-2.5 py-1.5 rounded-xl backdrop-blur-md cursor-pointer shadow-lg flex items-center gap-1.5 transition-all text-rose-500 hover:text-white active:scale-95 select-none"
                        title={language === 'ka' ? 'ფოტოს წაშლა' : 'Remove photo'}
                      >
                        <Trash2 size={12} />
                        <span className="text-[8px] font-black uppercase tracking-wider">
                          {language === 'ka' ? 'წაშლა' : 'Remove'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label 
                    htmlFor="listing-photo-upload-input"
                    className="w-full h-full flex flex-col items-center justify-center gap-3.5 select-none text-center px-6 cursor-pointer"
                  >
                    <div className="p-3.5 rounded-2xl bg-proton-card border border-proton-border group-hover:scale-105 transition-transform text-proton-muted group-hover:text-proton-accent group-hover:border-proton-accent/40 duration-300">
                      <Camera size={22} />
                    </div>
                    <div className="space-y-1">
                      <span className={cn("text-[10px] font-black block uppercase tracking-wider group-hover:text-proton-accent transition-colors", currentTheme.text)}>
                        {t.market.form.upload_button}
                      </span>
                      <span className={cn("text-[8px] font-semibold block uppercase tracking-widest", currentTheme.muted)}>
                        {language === 'ka' ? 'PNG, JPG ან WEBP (მაქს. 5MB)' : 'PNG, JPG or WEBP (Max 5MB)'}
                      </span>
                    </div>
                  </label>
                )}
              </div>

              <div className="relative mt-2.5 group">
                <Link size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-muted group-focus-within:text-proton-accent transition-colors" />
                <input 
                  type="url"
                  value={formData.images?.[0] || ''}
                  onChange={e => setFormData({...formData, images: e.target.value ? [e.target.value] : []})}
                  placeholder={language === 'ka' ? '...ან ჩასვით სურათის გარე ბმული (URL)' : '...or paste external image link URL'}
                  className={cn(
                    "w-full pl-10.5 pr-4 py-3 rounded-2xl border text-[11px] font-bold shadow-inner transition-all",
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
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
            className="space-y-8 animate-in fade-in"
          >
            {/* Preview Banner Header */}
            <div className="p-4 sm:p-5 rounded-2xl bg-proton-accent/10 border border-proton-accent/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl bg-proton-accent/15 border border-proton-accent/30", currentTheme.accent)}>
                  <Eye size={18} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className={cn("text-xs font-black uppercase tracking-wider flex items-center gap-2", currentTheme.text)}>
                    <span>{language === 'ka' ? 'განცხადების გადახედვა' : 'Listing Preview'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-mono font-black uppercase tracking-widest bg-proton-accent text-proton-on-accent">
                      {language === 'ka' ? 'მყიდველის ხედვა' : 'Buyer View'}
                    </span>
                  </h3>
                  <p className={cn("text-[10px] font-semibold mt-0.5", currentTheme.muted)}>
                    {language === 'ka' 
                      ? 'ასე გამოჩნდება თქვენი განცხადება ბაზარზე. გადაამოწმეთ ინფორმაცია გამოქვეყნებამდე.' 
                      : 'This is how your listing will appear in the marketplace. Review all details before publishing.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Real Buyer-Facing Marketplace Card Preview */}
            <div className="flex flex-col items-center gap-3">
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

              <p className={cn("text-[11px] text-center max-w-md leading-relaxed", currentTheme.muted)}>
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
              const trimmedAddress = (formData.location || '').trim();
              const trimmedDuration = (formData.serviceDuration || '').trim();
              const trimmedTerms = (formData.serviceTerms || '').trim();
              const hasGpsCoords =
                typeof formData.lat === 'number' &&
                !isNaN(formData.lat) &&
                typeof formData.lng === 'number' &&
                !isNaN(formData.lng);
              const step2Title =
                formData.listingType === 'service'
                  ? (language === 'ka' ? 'ნაბიჯი 2: ფასი და პირობები' : 'Step 2: Price & Terms')
                  : formData.listingType === 'project'
                  ? (language === 'ka' ? 'ნაბიჯი 2: ბიუჯეტი და ფასი' : 'Step 2: Budget & Price')
                  : (language === 'ka' ? 'ნაბიჯი 2: ფასი და მდგომარეობა' : 'Step 2: Price & Condition');
              const showOriginalCurrencyLine =
                activeDisplayCurrency.trim().toUpperCase() !== (formData.currency || 'USD').trim().toUpperCase();

              return (
                <div id="listing-preview-details" className="space-y-3">
                  <div className={cn("text-[10px] font-black uppercase tracking-widest flex items-center justify-between", currentTheme.muted)}>
                    <span>📋 {language === 'ka' ? 'მონაცემების შემოწმება' : 'Details Breakdown'}</span>
                    <span className={cn("text-[8px] font-mono uppercase", currentTheme.tagMuted)}>
                      {language === 'ka' ? 'შეცდომის შემთხვევაში დააჭირეთ „შეცვლას“' : 'Click edit to adjust any section'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Step 1 Review: Type, Language & Secondary Title */}
                    <div className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-[9px] font-mono font-black uppercase tracking-wider", currentTheme.accent)}>
                            {language === 'ka' ? 'ნაბიჯი 1: ტიპი' : 'Step 1: Type'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFormStep(1)}
                            className={cn("text-[9px] font-black hover:underline flex items-center gap-1 cursor-pointer", currentTheme.accent)}
                          >
                            <Edit3 size={10} />
                            <span>{language === 'ka' ? 'შეცვლა' : 'Edit'}</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-proton-accent/15 border border-proton-accent/30 text-proton-accent">
                            {formData.listingType === 'service'
                              ? (language === 'ka' ? '⚡ სერვისი' : '⚡ SERVICE')
                              : formData.listingType === 'project'
                              ? (language === 'ka' ? '🚀 პროექტი' : '🚀 PROJECT')
                              : (language === 'ka' ? '📦 პროდუქტი' : '📦 PRODUCT')}
                          </span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-proton-card border border-proton-border text-proton-muted">
                            {effectivePrimaryLang === 'ka'
                              ? (language === 'ka' ? 'ენა: ქართული' : 'Primary: KA')
                              : (language === 'ka' ? 'ენა: ინგლისური' : 'Primary: EN')}
                          </span>
                        </div>

                        {secondaryTitle && (
                          <div className="pt-1">
                            <span className={cn("text-[9px] font-bold block uppercase tracking-wider", currentTheme.muted)}>
                              {effectivePrimaryLang === 'ka'
                                ? (language === 'ka' ? 'სათაური (EN)' : 'English Title')
                                : (language === 'ka' ? 'სათაური (GE)' : 'Georgian Title')}
                            </span>
                            <p className={cn("text-xs font-semibold line-clamp-2 mt-0.5", currentTheme.text)}>
                              {secondaryTitle}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 2 Review: Adapted strictly by Listing Type */}
                    <div className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-[9px] font-mono font-black uppercase tracking-wider", currentTheme.accent)}>
                            {step2Title}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFormStep(2)}
                            className={cn("text-[9px] font-black hover:underline flex items-center gap-1 cursor-pointer", currentTheme.accent)}
                          >
                            <Edit3 size={10} />
                            <span>{language === 'ka' ? 'შეცვლა' : 'Edit'}</span>
                          </button>
                        </div>

                        {showOriginalCurrencyLine && (
                          <p className={cn("text-xs font-bold font-mono", currentTheme.text)}>
                            {parsedPreviewPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} {formData.currency}
                          </p>
                        )}

                        {formData.listingType === 'product' && (
                          <div className="space-y-1">
                            <span className={cn("text-[9px] font-bold block uppercase tracking-wider", currentTheme.muted)}>
                              {language === 'ka' ? 'ნივთის მდგომარეობა' : 'Item Condition'}
                            </span>
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-proton-card border border-proton-border text-proton-text">
                              {conditionLabel}
                            </span>
                          </div>
                        )}

                        {formData.listingType === 'service' && (
                          <div className="space-y-2">
                            {trimmedDuration && (
                              <div>
                                <span className={cn("text-[9px] font-bold block uppercase tracking-wider", currentTheme.muted)}>
                                  ⏱️ {language === 'ka' ? 'შესრულების ვადა' : 'Completion Time'}
                                </span>
                                <p className={cn("text-xs font-bold mt-0.5 break-words", currentTheme.text)}>
                                  {trimmedDuration}
                                </p>
                              </div>
                            )}
                            {trimmedTerms && (
                              <div>
                                <span className={cn("text-[9px] font-bold block uppercase tracking-wider", currentTheme.muted)}>
                                  📋 {language === 'ka' ? 'სამუშაო პირობები' : 'Work Terms'}
                                </span>
                                <p className={cn("text-xs font-semibold mt-0.5 break-words", currentTheme.text)}>
                                  {trimmedTerms}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {formData.listingType === 'project' && !showOriginalCurrencyLine && !formData.isNegotiable && (
                          <p className={cn("text-xs font-bold font-mono", currentTheme.text)}>
                            {parsedPreviewPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} {formData.currency}
                          </p>
                        )}

                        {formData.isNegotiable && (
                          <div>
                            <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/25 text-emerald-500">
                              {language === 'ka' ? 'ფასი შეთანხმებით' : 'Negotiable'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step 3 Review: Address, Media & GPS */}
                    <div className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-[9px] font-mono font-black uppercase tracking-wider", currentTheme.accent)}>
                            {language === 'ka' ? 'ნაბიჯი 3: მდებარეობა და მედია' : 'Step 3: Location & Media'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFormStep(3)}
                            className={cn("text-[9px] font-black hover:underline flex items-center gap-1 cursor-pointer", currentTheme.accent)}
                          >
                            <Edit3 size={10} />
                            <span>{language === 'ka' ? 'შეცვლა' : 'Edit'}</span>
                          </button>
                        </div>

                        {trimmedAddress && (
                          <div>
                            <span className={cn("text-[9px] font-bold block uppercase tracking-wider", currentTheme.muted)}>
                              📍 {language === 'ka' ? 'დეტალური მისამართი' : 'Detailed Address'}
                            </span>
                            <p className={cn("text-xs font-semibold mt-0.5 break-words", currentTheme.text)}>
                              {trimmedAddress}
                            </p>
                          </div>
                        )}

                        {(validImages.length > 0 || hasGpsCoords) && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {validImages.length > 0 && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-proton-card border border-proton-border text-proton-text">
                                🖼️ {validImages.length} {language === 'ka' ? 'ფოტო' : validImages.length === 1 ? 'Photo' : 'Photos'}
                              </span>
                            )}
                            {hasGpsCoords && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-proton-card border border-proton-border text-proton-text">
                                🛰️ {language === 'ka' ? 'რუკაზე მონიშნულია' : 'Map Pinned'}
                              </span>
                            )}
                          </div>
                        )}

                        {!trimmedAddress && validImages.length === 0 && !hasGpsCoords && (
                          <p className={cn("text-xs font-semibold", currentTheme.text)}>
                            {selectedCountry?.flag} {formData.city}{selectedCountry?.name ? `, ${selectedCountry.name}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description Preview */}
                  <div className="p-4 rounded-2xl bg-proton-bg/70 border border-proton-border space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[9px] font-mono font-black uppercase tracking-wider", currentTheme.muted)}>
                        {language === 'ka' ? 'აღწერა' : 'Description'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormStep(3)}
                        className={cn("text-[9px] font-black hover:underline flex items-center gap-1 cursor-pointer", currentTheme.accent)}
                      >
                        <Edit3 size={10} />
                        <span>{language === 'ka' ? 'შეცვლა' : 'Edit'}</span>
                      </button>
                    </div>
                    <p className={cn("text-xs font-sans whitespace-pre-line break-words leading-relaxed max-h-32 overflow-y-auto", currentTheme.subtext)}>
                      {formData.description.trim()}
                    </p>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* Steps Progress Footer Bar */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-6 sm:pt-8 mt-6 sm:mt-8 border-t border-proton-border">
          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => {
                localStorage.removeItem('proton_markethub_draft_form_data');
                resetListingForm();
                setViewMode('browse');
              }}
              className="flex-1 sm:flex-initial h-11 px-3 sm:px-5 bg-proton-bg hover:bg-proton-card border border-proton-border hover:border-proton-accent/40 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all text-proton-muted hover:text-proton-text flex items-center justify-center gap-1.5 sm:gap-2 shadow-inner active:scale-95 shrink-0 sm:shrink cursor-pointer"
            >
              <ArrowLeft size={13} className="shrink-0" />
              <span>{t.common.cancel}</span>
            </button>

            {formStep > 1 && (
              <button 
                type="button"
                onClick={() => setFormStep(prev => prev - 1)}
                className="flex-1 sm:flex-initial h-11 px-3 sm:px-5 bg-proton-bg hover:bg-proton-card border border-proton-border hover:border-proton-accent/40 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all text-proton-text flex items-center justify-center gap-1.5 sm:gap-2 active:scale-95 shrink-0 sm:shrink cursor-pointer"
              >
                <ChevronRight size={13} className="rotate-180 text-proton-muted shrink-0" />
                <span>{language === 'ka' ? 'უკან' : 'Back'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            {formStep < 4 ? (
              <button 
                type="button"
                onClick={() => {
                  if (formStep === 1) {
                    const currentPrimary = formData.primaryLanguage || (language === 'ka' ? 'ka' : 'en');
                    const tEn = (formData.title || '').trim();
                    const tGe = (formData.titleGe || '').trim();

                    if (currentPrimary === 'ka' && !tGe && tEn) {
                      setFormData(p => ({ ...p, primaryLanguage: 'en' }));
                    } else if (currentPrimary === 'en' && !tEn && tGe) {
                      setFormData(p => ({ ...p, primaryLanguage: 'ka' }));
                    } else if (!tEn && !tGe) {
                      showToast(
                        language === 'ka' 
                          ? `გთხოვთ პირველ ნაბიჯზე შეიყვანოთ სათაური ძირითად ენაზე (${currentPrimary === 'ka' ? 'ქართულად' : 'ინგლისურად'}) გასაგრძელებლად.` 
                          : `Please enter a listing title in the primary language (${currentPrimary === 'ka' ? 'Georgian' : 'English'}) to continue.`, 
                        'warning'
                      );
                      return;
                    }
                  } else if (formStep === 2) {
                    const priceStr = String(formData.price || '').trim().replace(',', '.');
                    const parsedPrice = parseFloat(priceStr);
                    if (!priceStr || isNaN(parsedPrice) || parsedPrice <= 0) {
                      showToast(language === 'ka' 
                        ? "გთხოვთ შეიყვანოთ სწორი ფასი გასაგრძელებლად (მხოლოდ დადებითი რიცხვები)." 
                        : "Please enter a valid price to continue (positive numbers only).",
                        'warning'
                      );
                      return;
                    }
                  } else if (formStep === 3) {
                    const countryStr = (formData.country || '').trim();
                    const cityStr = (formData.city || '').trim();
                    if (!countryStr || !cityStr) {
                      showToast(language === 'ka' 
                        ? "გთხოვთ შეავსოთ ქვეყანა და ქალაქი გადახედვამდე." 
                        : "Please select a country and city before preview.",
                        'warning'
                      );
                      return;
                    }
                    if (!formData.description.trim()) {
                      showToast(language === 'ka' ? "გთხოვთ შეავსოთ ნივთის აღწერა გადახედვამდე." : "Please fill in the product description before preview.", 'warning');
                      return;
                    }
                  }
                  setFormStep(prev => prev + 1);
                }}
                className={cn(
                  "w-full sm:w-auto h-11 px-5 sm:px-6 rounded-2xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 font-sans shadow-md cursor-pointer",
                  currentTheme.accentBg
                )}
              >
                <span>
                  {formStep === 3 
                    ? (language === 'ka' ? 'გადახედვა' : 'Preview Listing')
                    : (language === 'ka' ? 'შემდეგი ნაბიჯი' : 'Next Step')}
                </span>
                {formStep === 3 ? <Eye size={13} className="stroke-[2.5] shrink-0" /> : <ChevronRight size={13} className="stroke-[2.5] shrink-0" />}
              </button>
            ) : (
              <button 
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "w-full sm:w-auto h-11 px-6 sm:px-7 rounded-2xl text-[9px] font-black uppercase tracking-[0.18em] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer",
                  currentTheme.accentBg
                )}
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin shrink-0" /> : <ShieldCheck size={15} className="stroke-[2.5] shrink-0" />}
                <span>{viewMode === 'edit' ? t.market.form.update : t.market.form.submit}</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </motion.div>
  );
};
