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
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-[#dfb257]" />
          <h3 className="text-xs font-black uppercase tracking-[0.25em] text-[#dfb257]">
            {language === 'ka' ? 'ფილტრაცია' : 'Refine Search'}
          </h3>
          {activeFiltersCount > 0 && (
            <span className="flex items-center justify-center bg-[#dfb257] text-[#070708] font-black text-[10px] w-5 h-5 rounded-full scale-90">
              {activeFiltersCount}
            </span>
          )}
        </div>
        
        {onCloseMobile && (
          <button 
            type="button"
            onClick={onCloseMobile} 
            className="lg:hidden p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:text-white transition-all text-zinc-400 cursor-pointer"
            aria-label="Close filters"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Active Filter Badges */}
      {activeFiltersCount > 0 && (
        <div className="space-y-2">
          <span className="text-[9px] font-black tracking-wider text-zinc-500 uppercase">
            {language === 'ka' ? 'აქტიური ფილტრები:' : 'Active Filters:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {activeListingType !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveListingType('all')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#dfb257]/10 border border-[#dfb257]/20 text-[10px] font-bold text-[#dfb257] hover:bg-[#dfb257]/20 transition-all cursor-pointer"
              >
                <span>Type: {activeListingType}</span>
                <X size={10} className="shrink-0" />
              </button>
            )}
            {activeCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#dfb257]/10 border border-[#dfb257]/20 text-[10px] font-bold text-[#dfb257] hover:bg-[#dfb257]/20 transition-all cursor-pointer"
              >
                <span>{CATEGORY_EMOJIS[activeCategory] || ''} {t.market.categories[activeCategory] || activeCategory}</span>
                <X size={10} className="shrink-0" />
              </button>
            )}
            {activeCountry !== 'GLOBAL' && (
              <button
                type="button"
                onClick={() => setActiveCountry('GLOBAL')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#dfb257]/10 border border-[#dfb257]/20 text-[10px] font-bold text-[#dfb257] hover:bg-[#dfb257]/20 transition-all cursor-pointer"
              >
                <span>{WORLD_COUNTRIES.find(c => c.code === activeCountry)?.flag || '🌐'} {WORLD_COUNTRIES.find(c => c.code === activeCountry)?.name}</span>
                <X size={10} className="shrink-0" />
              </button>
            )}
            {activeCity !== '' && (
              <button
                type="button"
                onClick={() => setActiveCity('')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#dfb257]/10 border border-[#dfb257]/20 text-[10px] font-bold text-[#dfb257] hover:bg-[#dfb257]/20 transition-all cursor-pointer"
              >
                <span>📍 {activeCity}</span>
                <X size={10} className="shrink-0" />
              </button>
            )}
            {(minPrice !== '' || maxPrice !== '') && (
              <button
                type="button"
                onClick={() => { setMinPrice(''); setMaxPrice(''); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#dfb257]/10 border border-[#dfb257]/20 text-[10px] font-bold text-[#dfb257] hover:bg-[#dfb257]/20 transition-all cursor-pointer"
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
            <label className="text-xs font-black uppercase tracking-widest text-[#dfb257] ml-1 block">
              {language === 'ka' ? 'სორტირება' : 'Sort By'}
            </label>
            <div className="relative group">
              <ArrowUpDown size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#dfb257] opacity-60 pointer-events-none" />
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full pl-10 pr-10 py-3 bg-zinc-950 border-2 border-zinc-800 hover:border-zinc-700/85 rounded-xl text-xs font-bold focus:border-[#dfb257] focus:outline-none transition-all text-white appearance-none cursor-pointer"
              >
                <option value="rating">{language === 'ka' ? '★ რეიტინგი' : '★ RATING'}</option>
                <option value="newest">{language === 'ka' ? '📅 უახლესი' : '📅 NEWEST'}</option>
                <option value="priceAsc">{language === 'ka' ? '📉 ფასი (ზრდადი)' : '📉 PRICE (LOW)'}</option>
                <option value="priceDesc">{language === 'ka' ? '📈 ფასი (კლებადი)' : '📈 PRICE (HIGH)'}</option>
              </select>
              <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 opacity-40 pointer-events-none text-zinc-400" />
            </div>
          </div>
        )}

        {/* Location Dropdown */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-[#dfb257] ml-1 block">
            {t.market.filters.country}
          </label>
          <div className="relative group">
            <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#dfb257] opacity-60 pointer-events-none" />
            <select 
              value={activeCountry}
              onChange={(e) => setActiveCountry(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-zinc-950 border-2 border-zinc-800 hover:border-zinc-700/85 rounded-xl text-xs font-bold focus:border-[#dfb257] focus:outline-none transition-all text-white appearance-none cursor-pointer"
            >
              {WORLD_COUNTRIES.map(country => (
                <option key={country.code} value={country.code} className="bg-zinc-950 text-white">
                  {country.flag} &nbsp; {country.name}
                </option>
              ))}
            </select>
            <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 opacity-40 pointer-events-none text-zinc-400" />
          </div>
        </div>

        {/* City Filter */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-[#dfb257] ml-1 block">
            {t.market.filters.city}
          </label>
          <div className="relative group">
            <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#dfb257] opacity-60" />
            <input 
              type="text"
              value={activeCity}
              onChange={(e) => setActiveCity(e.target.value)}
              placeholder={language === 'ka' ? 'მაგ: თბილისი' : 'e.g. Tbilisi'}
              className="w-full pl-10 pr-9 py-3 bg-zinc-950 border-2 border-zinc-800 focus:border-[#dfb257] focus:outline-none rounded-xl text-xs font-bold transition-all placeholder:text-zinc-600 text-white"
            />
            {activeCity && (
              <button
                type="button"
                onClick={() => setActiveCity('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {/* Price Filter with presets */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-widest text-[#dfb257] ml-1 block">
            {t.market.price} ({displayCurrency})
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-500">MIN</span>
              <input 
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                className="w-full pl-10 pr-3 py-2.5 bg-zinc-950 border-2 border-zinc-800 focus:border-[#dfb257] focus:outline-none rounded-xl text-xs font-bold transition-all placeholder:text-zinc-700 text-white"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-500">MAX</span>
              <input 
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="∞"
                className="w-full pl-10 pr-3 py-2.5 bg-zinc-950 border-2 border-zinc-800 focus:border-[#dfb257] focus:outline-none rounded-xl text-xs font-bold transition-all placeholder:text-zinc-700 text-white"
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
                      ? "bg-[#dfb257]/10 border-[#dfb257] text-[#dfb257]" 
                      : "bg-zinc-950/20 border-zinc-900 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800"
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
            className="w-full py-3 mt-4 rounded-xl bg-red-950/20 border border-red-900/30 text-[10px] font-black uppercase tracking-[0.25em] hover:text-white hover:bg-gradient-to-b hover:from-red-900/40 hover:to-red-950/60 hover:border-red-500/50 transition-all flex items-center justify-center gap-2 text-red-400 cursor-pointer"
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
            className="fixed inset-x-0 bottom-0 max-h-[85vh] flex flex-col rounded-t-[32px] border-t border-x border-zinc-800/80 bg-zinc-950/98 backdrop-blur-2xl shadow-[0_-20px_50px_rgba(0,0,0,0.8)] z-10 overflow-hidden"
          >
            {/* Grab Handle */}
            <div className="w-full flex flex-col items-center pt-3 pb-1 select-none cursor-grab active:cursor-grabbing touch-none shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-zinc-700/80 hover:bg-zinc-600 transition-colors" />
            </div>

            {/* Bottom Sheet Header */}
            <div className="px-6 py-3 border-b border-zinc-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <LayoutGrid size={16} className="text-[#dfb257]" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                  {language === 'ka' ? 'ფილტრები' : 'Filters'}
                </h3>
                {activeFiltersCount > 0 && (
                  <span className="flex items-center justify-center bg-[#dfb257] text-[#070708] font-black text-[10px] w-5 h-5 rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-wider px-2 py-1 transition-colors cursor-pointer"
                  >
                    {language === 'ka' ? 'გასუფთავება' : 'Reset'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
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
            <div className="p-4 border-t border-zinc-900 bg-zinc-950/95 backdrop-blur-md shrink-0">
              <button 
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all cursor-pointer bg-[#dfb257] text-[#070708] hover:brightness-110 shadow-[#dfb257]/10"
              >
                <span>{language === 'ka' ? 'შედეგების ნახვა' : 'Apply Filters'}</span>
                <span className="text-[11px] font-mono font-black opacity-80">
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
