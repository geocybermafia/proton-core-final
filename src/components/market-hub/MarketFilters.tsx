import React from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { 
  LayoutGrid, 
  X, 
  Globe, 
  ChevronRight, 
  MapPin, 
  Trash2,
  ArrowUpDown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  WORLD_COUNTRIES, 
  CATEGORY_EMOJIS, 
  MarketTheme 
} from './MarketConstants';

export interface MarketFilterPanelProps {
  language: string;
  t: any;
  currentTheme?: MarketTheme;
  activeFiltersCount: number;
  activeListingType: 'all' | 'product' | 'service' | 'project';
  setActiveListingType: (type: 'all' | 'product' | 'service' | 'project') => void;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  activeCountry: string;
  setActiveCountry: (country: string) => void;
  activeCity: string;
  setActiveCity: (city: string) => void;
  minPrice: string;
  setMinPrice: (price: string) => void;
  maxPrice: string;
  setMaxPrice: (price: string) => void;
  displayCurrency: string;
  clearFilters: () => void;
  onCloseMobile?: () => void;
  sortBy?: 'rating' | 'newest' | 'priceAsc' | 'priceDesc';
  setSortBy?: (sort: 'rating' | 'newest' | 'priceAsc' | 'priceDesc') => void;
}

export const MarketFilterPanel = React.memo(function MarketFilterPanel({
  language,
  t,
  currentTheme,
  activeFiltersCount,
  activeListingType,
  setActiveListingType,
  activeCategory,
  setActiveCategory,
  activeCountry,
  setActiveCountry,
  activeCity,
  setActiveCity,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  displayCurrency,
  clearFilters,
  onCloseMobile,
  sortBy,
  setSortBy
}: MarketFilterPanelProps) {
  const inputSurface = currentTheme?.input || "bg-proton-bg border border-proton-border focus:border-proton-accent/60 text-proton-text placeholder:text-proton-muted focus:outline-none focus:ring-1 focus:ring-proton-accent/25";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-proton-border">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-proton-accent" />
          <h3 className="text-xs font-black uppercase tracking-[0.25em] text-proton-accent">
            {language === 'ka' ? 'ფილტრაცია' : 'Refine Search'}
          </h3>
          {activeFiltersCount > 0 && (
            <span className="flex items-center justify-center bg-proton-accent text-proton-on-accent font-black text-[10px] w-5 h-5 rounded-full scale-90">
              {activeFiltersCount}
            </span>
          )}
        </div>
        
        {onCloseMobile && (
          <button 
            type="button"
            onClick={onCloseMobile} 
            className="lg:hidden p-2 bg-proton-bg border border-proton-border rounded-lg hover:bg-proton-accent/10 hover:text-proton-text transition-all text-proton-muted cursor-pointer"
            aria-label="Close filters"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Active Filter Badges */}
      {activeFiltersCount > 0 && (
        <div className="space-y-2">
          <span className="text-[9px] font-black tracking-wider text-proton-muted uppercase">
            {language === 'ka' ? 'აქტიური ფილტრები:' : 'Active Filters:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {activeListingType !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveListingType('all')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-proton-accent/10 border border-proton-accent/25 text-[10px] font-bold text-proton-accent hover:bg-proton-accent/20 transition-all cursor-pointer"
              >
                <span>Type: {activeListingType}</span>
                <X size={10} className="shrink-0" />
              </button>
            )}
            {activeCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-proton-accent/10 border border-proton-accent/25 text-[10px] font-bold text-proton-accent hover:bg-proton-accent/20 transition-all cursor-pointer"
              >
                <span>{CATEGORY_EMOJIS[activeCategory] || ''} {t.market.categories[activeCategory] || activeCategory}</span>
                <X size={10} className="shrink-0" />
              </button>
            )}
            {activeCountry !== 'GLOBAL' && (
              <button
                type="button"
                onClick={() => setActiveCountry('GLOBAL')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-proton-accent/10 border border-proton-accent/25 text-[10px] font-bold text-proton-accent hover:bg-proton-accent/20 transition-all cursor-pointer"
              >
                <span>{WORLD_COUNTRIES.find(c => c.code === activeCountry)?.flag || '🌐'} {WORLD_COUNTRIES.find(c => c.code === activeCountry)?.name}</span>
                <X size={10} className="shrink-0" />
              </button>
            )}
            {activeCity !== '' && (
              <button
                type="button"
                onClick={() => setActiveCity('')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-proton-accent/10 border border-proton-accent/25 text-[10px] font-bold text-proton-accent hover:bg-proton-accent/20 transition-all cursor-pointer"
              >
                <span>📍 {activeCity}</span>
                <X size={10} className="shrink-0" />
              </button>
            )}
            {(minPrice !== '' || maxPrice !== '') && (
              <button
                type="button"
                onClick={() => { setMinPrice(''); setMaxPrice(''); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-proton-accent/10 border border-proton-accent/25 text-[10px] font-bold text-proton-accent hover:bg-proton-accent/20 transition-all cursor-pointer"
              >
                <span>
                  {minPrice ? `${minPrice}` : '0'} - {maxPrice ? `${maxPrice}` : '∞'} {displayCurrency}
                </span>
                <X size={10} className="shrink-0" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Sorting Dropdown */}
        {sortBy && setSortBy && (
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-proton-accent ml-1 block">
              {language === 'ka' ? 'სორტირება' : 'Sort By'}
            </label>
            <div className="relative group">
              <ArrowUpDown size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-accent opacity-75 pointer-events-none" />
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={cn("w-full pl-10 pr-10 py-3 rounded-xl text-xs font-bold transition-all appearance-none cursor-pointer", inputSurface)}
              >
                <option value="rating" className="bg-proton-card text-proton-text">{language === 'ka' ? '★ რეიტინგი' : '★ RATING'}</option>
                <option value="newest" className="bg-proton-card text-proton-text">{language === 'ka' ? '📅 უახლესი' : '📅 NEWEST'}</option>
                <option value="priceAsc" className="bg-proton-card text-proton-text">{language === 'ka' ? '📉 ფასი (ზრდადი)' : '📉 PRICE (LOW)'}</option>
                <option value="priceDesc" className="bg-proton-card text-proton-text">{language === 'ka' ? '📈 ფასი (კლებადი)' : '📈 PRICE (HIGH)'}</option>
              </select>
              <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 opacity-60 pointer-events-none text-proton-muted" />
            </div>
          </div>
        )}

        {/* Location Dropdown */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-proton-accent ml-1 block">
            {t.market.filters.country}
          </label>
          <div className="relative group">
            <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-accent opacity-75 pointer-events-none" />
            <select 
              value={activeCountry}
              onChange={(e) => setActiveCountry(e.target.value)}
              className={cn("w-full pl-10 pr-10 py-3 rounded-xl text-xs font-bold transition-all appearance-none cursor-pointer", inputSurface)}
            >
              {WORLD_COUNTRIES.map(country => (
                <option key={country.code} value={country.code} className="bg-proton-card text-proton-text">
                  {country.flag} &nbsp; {country.name}
                </option>
              ))}
            </select>
            <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 opacity-60 pointer-events-none text-proton-muted" />
          </div>
        </div>

        {/* City Filter */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-proton-accent ml-1 block">
            {t.market.filters.city}
          </label>
          <div className="relative group">
            <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-proton-accent opacity-75" />
            <input 
              type="text"
              value={activeCity}
              onChange={(e) => setActiveCity(e.target.value)}
              placeholder={language === 'ka' ? 'მაგ: თბილისი' : 'e.g. Tbilisi'}
              className={cn("w-full pl-10 pr-9 py-3 rounded-xl text-xs font-bold transition-all", inputSurface)}
            />
            {activeCity && (
              <button
                type="button"
                onClick={() => setActiveCity('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-proton-muted hover:text-proton-text font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {/* Price Filter with presets */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-widest text-proton-accent ml-1 block">
            {t.market.price} ({displayCurrency})
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-proton-muted">MIN</span>
              <input 
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                className={cn("w-full pl-10 pr-3 py-2.5 rounded-xl text-xs font-bold transition-all", inputSurface)}
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-proton-muted">MAX</span>
              <input 
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="∞"
                className={cn("w-full pl-10 pr-3 py-2.5 rounded-xl text-xs font-bold transition-all", inputSurface)}
              />
            </div>
          </div>

          {/* Quick Price Selection Presets */}
          <div className="grid grid-cols-2 gap-1">
            {[
              { label: '< 50', min: '', max: '50' },
              { label: '50 - 200', min: '50', max: '200' },
              { label: '200 - 1000', min: '200', max: '1000' },
              { label: '1000 +', min: '1000', max: '' }
            ].map((preset, i) => {
              const matches = minPrice === preset.min && maxPrice === preset.max;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setMinPrice(preset.min);
                    setMaxPrice(preset.max);
                  }}
                  className={cn(
                    "py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider text-center transition-all border cursor-pointer",
                    matches 
                      ? "bg-proton-accent/15 border-proton-accent text-proton-accent" 
                      : "bg-proton-bg/60 border-proton-border text-proton-muted hover:text-proton-text hover:border-proton-accent/40"
                  )}
                >
                  {preset.label} {displayCurrency}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clear Filters Button */}
        {activeFiltersCount > 0 && (
          <button 
            type="button"
            onClick={clearFilters}
            className="w-full py-3 mt-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[10px] font-black uppercase tracking-[0.25em] hover:text-white hover:bg-rose-600 hover:border-rose-500 transition-all flex items-center justify-center gap-2 text-rose-500 cursor-pointer"
          >
            <Trash2 size={13} className="stroke-[2.5]" />
            {t.market.filters.clear_all}
          </button>
        )}
      </div>
    </div>
  );
});

export interface MobileFilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
  activeFiltersCount: number;
  onClearFilters: () => void;
  matchCount: number;
  filterContent?: React.ReactNode;
  children?: React.ReactNode;
  sheetRef?: React.Ref<HTMLDivElement>;
  sortBy?: 'rating' | 'newest' | 'priceAsc' | 'priceDesc';
  setSortBy?: (sort: 'rating' | 'newest' | 'priceAsc' | 'priceDesc') => void;
}

export const MobileFilterBottomSheet = React.memo(function MobileFilterBottomSheet({
  isOpen,
  onClose,
  language,
  activeFiltersCount,
  onClearFilters,
  matchCount,
  filterContent,
  children,
  sheetRef,
  sortBy,
  setSortBy
}: MobileFilterBottomSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[140] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={language === 'ka' ? 'ფილტრები' : 'Filters'}
        >
          {/* Backdrop with blur */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Bottom Sheet Modal Container */}
          <motion.div 
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
              if (info.offset.y > 100 || info.velocity.y > 400) {
                onClose();
              }
            }}
            className="fixed inset-x-0 bottom-0 max-h-[85vh] flex flex-col rounded-t-[32px] border-t border-x border-proton-border bg-proton-card/98 backdrop-blur-2xl shadow-2xl z-10 overflow-hidden text-proton-text"
          >
            {/* Grab Handle */}
            <div className="w-full flex flex-col items-center pt-3 pb-1 select-none cursor-grab active:cursor-grabbing touch-none shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-proton-border hover:bg-proton-muted transition-colors" />
            </div>

            {/* Bottom Sheet Header */}
            <div className="px-6 py-3 border-b border-proton-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <LayoutGrid size={16} className="text-proton-accent" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-proton-text">
                  {language === 'ka' ? 'ფილტრები' : 'Filters'}
                </h3>
                {activeFiltersCount > 0 && (
                  <span className="flex items-center justify-center bg-proton-accent text-proton-on-accent font-black text-[10px] w-5 h-5 rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-400 uppercase tracking-wider px-2 py-1 transition-colors cursor-pointer"
                  >
                    {language === 'ka' ? 'გასუფთავება' : 'Reset'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-xl bg-proton-bg border border-proton-border text-proton-muted hover:text-proton-text transition-colors cursor-pointer"
                  aria-label="Close filters"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable Filter Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 custom-scrollbar">
              {children || filterContent}
            </div>

            {/* Sticky Bottom Action Bar with Apply CTA */}
            <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-proton-border bg-proton-card/95 backdrop-blur-md shrink-0">
              <button 
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all cursor-pointer bg-proton-accent hover:bg-proton-accent-hover text-proton-on-accent"
              >
                <span>{language === 'ka' ? 'შედეგების ნახვა' : 'Apply Filters'}</span>
                <span className="text-[11px] font-mono font-black opacity-85">
                  ({matchCount})
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
