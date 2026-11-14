import React, { useEffect, useRef, useState } from 'react';
import { Listing } from '../types';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LayoutGrid, Navigation, Loader2, AlertTriangle, RotateCcw, X } from 'lucide-react';
import { translations } from '../translations';
import {
  getListingTitle,
  convertPrice as defaultConvertPrice,
  formatOriginalCurrencyPrice,
  formatApproxCurrencyEquivalent
} from './market-hub/MarketConstants';

interface ListingMapProps {
  listings: Listing[];
  onSelectListing: (listing: Listing) => void;
  language: 'en' | 'ka';
  currentTheme: any;
  displayCurrency?: string;
  priceMap?: Map<string, number>;
  convertPrice?: (price: number, from: string, to: string) => number;
  onClose?: () => void;
}

export const MAP_TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
} as const;

const LEGACY_CATEGORY_TO_TRANSLATION_KEY: Record<string, string> = {
  rent: 'service',
  garden: 'home',
  building: 'home',
  'family-technic': 'technics',
  kids: 'fashion',
  village: 'business',
  sport: 'hobby',
  art: 'hobby',
  book: 'hobby',
  music: 'hobby',
  hunting: 'hobby',
  animals: 'hobby',
};

export function getSafeMapImageUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function getLocalizedMapCategory(
  category: unknown,
  language: 'en' | 'ka',
  customTranslations?: any
): string {
  const raw = typeof category === 'string' ? category.trim() : '';
  if (!raw) {
    return language === 'ka' ? 'სხვა' : 'Other';
  }

  const normalized = raw.toLowerCase();
  const categoryMap: Record<string, string> | undefined =
    customTranslations?.market?.categories ||
    translations[language]?.market?.categories ||
    translations.en.market.categories;

  if (categoryMap) {
    if (categoryMap[raw]) return categoryMap[raw];
    if (categoryMap[normalized]) return categoryMap[normalized];
    const mappedKey = LEGACY_CATEGORY_TO_TRANSLATION_KEY[normalized];
    if (mappedKey && categoryMap[mappedKey]) {
      return categoryMap[mappedKey];
    }
  }

  return raw.replace(/[-_]+/g, ' ');
}

export function resolveMapTileTheme(currentTheme?: any): 'light' | 'dark' {
  if (typeof document !== 'undefined') {
    const dataTheme = document.documentElement.getAttribute('data-theme');
    const dataColorScheme = document.documentElement.getAttribute('data-color-scheme');

    if (dataTheme === 'light' || (dataTheme === 'auto' && dataColorScheme === 'light')) {
      return 'light';
    }
    if (dataTheme) {
      return 'dark';
    }
  }

  const cardClass = typeof currentTheme?.card === 'string' ? currentTheme.card : '';
  if (cardClass.includes('bg-white') || cardClass.includes('text-slate-900')) {
    return 'light';
  }
  return 'dark';
}

export function buildListingPopupElement({
  listing,
  language,
  displayCurrency,
  priceMap,
  convertPrice,
  onSelect,
}: {
  listing: Listing;
  language: 'en' | 'ka';
  displayCurrency: string;
  priceMap?: Map<string, number>;
  convertPrice: (price: number, from: string, to: string) => number;
  onSelect: (listing: Listing) => void;
}): HTMLElement {
  const localizedTitle = getListingTitle(listing, language);
  const localizedDesc =
    (language === 'ka'
      ? listing.descriptionGe || listing.description
      : listing.description || listing.descriptionGe) || '';
  const categoryLabel = getLocalizedMapCategory(listing.category, language);

  const origCurrency = (listing.currency || 'USD').trim().toUpperCase();
  const targetCurrency = (displayCurrency || 'USD').trim().toUpperCase();
  const isSameCurrency = origCurrency === targetCurrency;
  const convertedVal =
    priceMap?.get(listing.id) ?? convertPrice(listing.price || 0, origCurrency, targetCurrency);
  const formattedOriginal = formatOriginalCurrencyPrice(listing.price || 0, origCurrency);
  const formattedApprox = formatApproxCurrencyEquivalent(convertedVal, targetCurrency);

  const candidateImage =
    Array.isArray(listing.images) && listing.images.length > 0
      ? listing.images[0]
      : listing.image;
  const safeImageUrl = getSafeMapImageUrl(candidateImage);

  const root = document.createElement('div');
  root.className = 'w-64 rounded-2xl overflow-hidden p-0 shadow-2xl font-sans';
  root.style.margin = '-14px -20px';
  root.style.background = 'var(--proton-card)';
  root.style.color = 'var(--proton-text)';
  root.style.border = '1px solid var(--proton-border)';

  const createCategoryBadge = (isOverlay: boolean): HTMLElement => {
    const badge = document.createElement('div');
    badge.className = isOverlay
      ? 'absolute top-2 right-2 px-2.5 py-1 backdrop-blur-md rounded-lg text-[9px] font-black uppercase tracking-widest max-w-[85%] truncate'
      : 'inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest max-w-full truncate';
    badge.style.background = 'var(--proton-card)';
    badge.style.color = 'var(--proton-text)';
    badge.style.border = '1px solid var(--proton-border)';
    badge.style.opacity = isOverlay ? '0.92' : '1';
    badge.textContent = categoryLabel;
    return badge;
  };

  if (safeImageUrl) {
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'h-28 overflow-hidden relative';
    imageWrapper.style.background = 'var(--proton-bg)';

    const img = document.createElement('img');
    img.src = safeImageUrl;
    img.alt = localizedTitle;
    img.className = 'w-full h-full object-cover';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });

    imageWrapper.appendChild(img);
    imageWrapper.appendChild(createCategoryBadge(true));
    root.appendChild(imageWrapper);
  }

  const body = document.createElement('div');
  body.className = 'p-4 space-y-2';

  if (!safeImageUrl) {
    body.appendChild(createCategoryBadge(false));
  }

  const titleEl = document.createElement('h4');
  titleEl.className = 'text-sm font-black uppercase tracking-tight leading-tight line-clamp-1';
  titleEl.style.color = 'var(--proton-text)';
  titleEl.textContent = localizedTitle;
  body.appendChild(titleEl);

  const descEl = document.createElement('p');
  descEl.className = 'text-[10px] leading-relaxed line-clamp-2';
  descEl.style.color = 'var(--proton-muted)';
  descEl.textContent = localizedDesc;
  body.appendChild(descEl);

  const priceRow = document.createElement('div');
  priceRow.className = 'flex items-start justify-between gap-2 pt-1.5';
  priceRow.style.borderTop = '1px solid var(--proton-border)';

  const priceLabel = document.createElement('span');
  priceLabel.className = 'text-[9px] font-bold uppercase tracking-wider';
  priceLabel.style.color = 'var(--proton-muted)';
  priceLabel.textContent = isSameCurrency
    ? (language === 'ka' ? 'ფასი:' : 'Price:')
    : (language === 'ka' ? 'სავარაუდო:' : 'Est.:');

  const priceValues = document.createElement('div');
  priceValues.className = 'text-right';

  if (isSameCurrency) {
    const singlePrice = document.createElement('span');
    singlePrice.className = 'text-xs font-black font-mono';
    singlePrice.style.color = 'var(--proton-accent)';
    singlePrice.textContent = formattedOriginal;
    priceValues.appendChild(singlePrice);
  } else {
    const approxEl = document.createElement('div');
    approxEl.className = 'text-xs font-black font-mono';
    approxEl.style.color = 'var(--proton-accent)';
    approxEl.textContent = formattedApprox;

    const originalEl = document.createElement('div');
    originalEl.className = 'text-[10px] font-semibold font-mono';
    originalEl.style.color = 'var(--proton-muted)';
    originalEl.textContent = `${language === 'ka' ? 'ორიგინალი:' : 'Original:'} ${formattedOriginal}`;

    priceValues.appendChild(approxEl);
    priceValues.appendChild(originalEl);
  }

  priceRow.appendChild(priceLabel);
  priceRow.appendChild(priceValues);
  body.appendChild(priceRow);

  const detailsBtn = document.createElement('button');
  detailsBtn.type = 'button';
  detailsBtn.className =
    'popup-buy-btn w-full mt-2 py-2 px-4 text-center text-[9px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 cursor-pointer active:scale-95 transition-all duration-200 block shadow-md';
  detailsBtn.style.background = 'var(--proton-accent)';
  detailsBtn.style.color = 'var(--proton-on-accent)';
  detailsBtn.style.border = '1px solid var(--proton-border)';
  detailsBtn.textContent = language === 'ka' ? 'დეტალების ნახვა' : 'View Details';

  detailsBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    detailsBtn.style.opacity = '0.7';
    detailsBtn.style.transform = 'scale(0.98)';
    onSelect(listing);
  });

  body.appendChild(detailsBtn);
  root.appendChild(body);

  return root;
}

// Custom CSS styling for map pins and theme-consistent Leaflet controls/popups
const markerStyle = `
  .custom-map-pin {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .custom-leaflet-popup-container .leaflet-popup-content-wrapper {
    background: transparent;
    box-shadow: none;
    padding: 0;
  }
  .custom-leaflet-popup-container .leaflet-popup-tip {
    background: var(--proton-card);
    border: 1px solid var(--proton-border);
  }
  .custom-leaflet-popup-container .leaflet-popup-close-button {
    color: var(--proton-text);
    z-index: 30;
  }
  .leaflet-container .leaflet-control-zoom a {
    background-color: var(--proton-card);
    color: var(--proton-text);
    border-color: var(--proton-border);
  }
  .leaflet-container .leaflet-control-zoom a:hover {
    background-color: var(--proton-bg);
    color: var(--proton-accent);
  }
  .leaflet-container .leaflet-control-attribution {
    background-color: var(--proton-card);
    color: var(--proton-muted);
    opacity: 0.9;
  }
  .leaflet-container .leaflet-control-attribution a {
    color: var(--proton-accent);
  }
`;

const DEFAULT_CENTER: [number, number] = [41.7151, 44.8271];

export function ListingMap({
  listings,
  onSelectListing,
  language,
  currentTheme,
  displayCurrency = 'USD',
  priceMap,
  convertPrice = defaultConvertPrice,
  onClose
}: ListingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const listingsRef = useRef<Listing[]>(listings);
  const onSelectListingRef = useRef<(listing: Listing) => void>(onSelectListing);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [tileScheme, setTileScheme] = useState<'light' | 'dark'>(() =>
    resolveMapTileTheme(currentTheme)
  );

  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);

  useEffect(() => {
    onSelectListingRef.current = onSelectListing;
  }, [onSelectListing]);

  // Set up custom style on mount
  useEffect(() => {
    const styleId = 'custom-map-styles';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = markerStyle;
  }, []);

  // Track PROTON theme changes via props & DOM theme attributes
  useEffect(() => {
    const syncTileScheme = () => {
      const next = resolveMapTileTheme(currentTheme);
      setTileScheme((prev) => (prev === next ? prev : next));
    };

    syncTileScheme();

    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const observer = new MutationObserver(syncTileScheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-color-scheme'],
    });

    return () => observer.disconnect();
  }, [currentTheme]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Use Georgia/Tbilisi center as default starting point
    const map = L.map(mapContainerRef.current, {
      center: [41.7151, 44.8271],
      zoom: 8,
      zoomControl: false,
      attributionControl: true
    });

    const initialScheme = resolveMapTileTheme(currentTheme);
    const tileLayer = L.tileLayer(MAP_TILE_URLS[initialScheme], {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Zoom controls at bottom right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    // Create marker layers group
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapRef.current = map;

    // Multiple delayed invalidateSize calls for animation transitions
    const invalidateTimers = [50, 150, 300, 600, 1000].map(delay =>
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, delay)
    );

    // Cleanup on unmount
    return () => {
      invalidateTimers.forEach(t => clearTimeout(t));
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileLayerRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // Update tile URL dynamically when theme changes without recreating map state
  useEffect(() => {
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(MAP_TILE_URLS[tileScheme]);
    }
  }, [tileScheme]);

  // Handle parent container resize via ResizeObserver
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      });
    });

    observer.observe(container);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  // Update Markers when listings change
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    // Clear existing markers
    markersLayer.clearLayers();

    // Collect coordinates to calculate bounds
    const validCoords: L.LatLngExpression[] = [];

    listings.forEach((listing) => {
      const lat = listing.lat;
      const lng = listing.lng;

      // Only draw if coordinates exist and are valid numbers
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        validCoords.push([lat, lng]);

        // Create Custom DivIcon bound dynamically to PROTON accent & card CSS tokens
        const iconHtml = `
          <div class="relative w-10 h-10 flex items-center justify-center">
            <!-- Pulsing outer ring -->
            <div class="absolute w-8 h-8 rounded-full animate-ping duration-1000" style="background: var(--proton-accent); opacity: 0.25;"></div>
            <!-- Inner ring -->
            <div class="w-7 h-7 rounded-full flex items-center justify-center shadow-lg" style="background: var(--proton-card); border: 2px solid var(--proton-accent); box-shadow: 0 4px 12px rgba(0,0,0,0.35);">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--proton-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-map-pin',
          html: iconHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 32],
          popupAnchor: [0, -32]
        });

        const popupElement = buildListingPopupElement({
          listing,
          language,
          displayCurrency,
          priceMap,
          convertPrice,
          onSelect: (selected) => {
            if (onSelectListingRef.current) {
              onSelectListingRef.current(selected);
            }
          }
        });

        // Create marker with XSS-safe DOM popup
        const marker = L.marker([lat, lng], { icon: customIcon });
        marker.bindPopup(popupElement, {
          maxWidth: 300,
          className: 'custom-leaflet-popup-container'
        });

        marker.on('popupopen', () => {
          const btn = popupElement.querySelector('.popup-buy-btn') as HTMLButtonElement | null;
          if (btn) {
            btn.style.opacity = '1';
            btn.style.transform = '';
          }
        });

        markersLayer.addLayer(marker);
      }
    });

    // Auto fit map bounds if valid pins exist
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      if (validCoords.length === 1) {
        map.setView(validCoords[0], 11);
      } else {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } else {
      // Default viewpoint when no listings are mapped
      map.setView([41.7151, 44.8271], 7);
    }

    // Quick invalidate size to guarantee correct display in relative containers
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

  }, [listings, language, displayCurrency, priceMap, convertPrice]);

  // Geolocation detector with graceful error fallback handling
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      setGeoError(
        language === 'ka'
          ? 'გეოლოკაცია არ არის მხარდაჭერილი თქვენი ბრაუზერის მიერ. რუკა დაბრუნდა სტანდარტულ კოორდინატებზე (თბილისი).'
          : 'Geolocation is not supported by your browser. Defaulting to regional view (Tbilisi).'
      );
      if (mapRef.current) {
        mapRef.current.setView(DEFAULT_CENTER, 8);
      }
      return;
    }

    setLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude } = position.coords;

        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 13);

          const userPopupEl = document.createElement('div');
          userPopupEl.className = 'p-2 text-center text-xs font-bold text-emerald-500 rounded-lg';
          userPopupEl.style.background = 'var(--proton-card)';
          userPopupEl.style.border = '1px solid var(--proton-border)';
          userPopupEl.textContent =
            language === 'ka' ? 'თქვენი მიმდინარე ლოკაცია' : 'Your Current Location';

          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([latitude, longitude]);
            userMarkerRef.current.setPopupContent(userPopupEl);
          } else {
            const userIconHtml = `
              <div class="relative w-8 h-8 flex items-center justify-center">
                <div class="absolute w-6 h-6 rounded-full bg-emerald-500/30 animate-ping"></div>
                <div class="w-5 h-5 rounded-full border-2 border-emerald-500 shadow-lg shadow-emerald-500/40 flex items-center justify-center" style="background: var(--proton-card);">
                  <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                </div>
              </div>
            `;
            const userIcon = L.divIcon({
              className: 'custom-map-pin',
              html: userIconHtml,
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            });

            userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon })
              .bindPopup(userPopupEl)
              .addTo(mapRef.current);
          }
        }
      },
      (error: GeolocationPositionError) => {
        setLocating(false);
        console.warn("GeolocationPositionError:", error.code, error.message);

        let errorMsg = language === 'ka'
          ? 'ლოკაციის დადგენა ვერ მოხერხდა. რუკა გადავიდა სტანდარტულ ხედზე (თბილისი).'
          : 'Location access denied or unavailable. Centered map on default region (Tbilisi).';

        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = language === 'ka'
            ? 'ლოკაციაზე წვდომა უარყოფილია. რუკა ნაჩვენებია სტანდარტულ რეგიონზე (თბილისი).'
            : 'Location permission denied by user. Centered map on default region (Tbilisi).';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = language === 'ka'
            ? 'ლოკაციის მოთხოვნის დრო ამოიწურა. რუკა დაბრუნდა სტანდარტულ ხედზე.'
            : 'Location request timed out. Showing default regional map (Tbilisi).';
        }

        setGeoError(errorMsg);

        // Fallback gracefully to default regional coordinates
        if (mapRef.current) {
          mapRef.current.setView(DEFAULT_CENTER, 8);
        }
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 }
    );
  };

  // Handle parent container resize
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-[380px] sm:h-[500px] md:h-[650px] rounded-[32px] sm:rounded-[40px] overflow-hidden border border-proton-border shadow-2xl bg-proton-bg group animate-in fade-in duration-500">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full z-0" 
      />
      
      {/* Geolocation Fallback Contextual Banner */}
      {geoError && (
        <div className="absolute top-16 left-4 right-4 sm:left-6 sm:right-6 z-20 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="px-4 py-3 bg-proton-card/95 backdrop-blur-xl rounded-2xl border border-amber-500/40 text-proton-text shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={16} className="text-amber-500 shrink-0" />
              <span className="font-medium leading-tight text-[11px] text-proton-text">{geoError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleLocateUser}
                disabled={locating}
                className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-xl text-[10px] font-black uppercase tracking-wider text-amber-500 transition-all flex items-center gap-1 cursor-pointer"
              >
                {locating ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                <span>{language === 'ka' ? 'ხელახლა ცდა' : 'Retry'}</span>
              </button>
              <button
                type="button"
                onClick={() => setGeoError(null)}
                className="p-1 hover:bg-proton-bg rounded-lg text-proton-muted hover:text-proton-text transition-all cursor-pointer"
                title={language === 'ka' ? 'დახურვა' : 'Dismiss'}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decorative Overlays */}
      <div className="absolute top-4 sm:top-6 left-4 sm:left-6 z-10 pointer-events-none">
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-proton-card/95 backdrop-blur-xl rounded-2xl border border-proton-border flex items-center gap-2 shadow-xl">
          <div className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-proton-text">
            {language === 'ka' ? 'ლოკაციების რუკა' : 'Live Asset Map'}
          </span>
          <span className="px-1.5 py-0.5 bg-proton-bg rounded text-[8px] font-black text-proton-muted uppercase tracking-widest border border-proton-border">
            {listings.filter(l => typeof l.lat === 'number').length} / {listings.length}
          </span>
        </div>
      </div>

      {/* Controls Overlay Top Right: Locate Me + Grid Button */}
      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-20 pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={handleLocateUser}
          disabled={locating}
          className="px-3 py-2 bg-proton-card/95 backdrop-blur-xl rounded-xl border border-proton-border text-proton-text hover:text-proton-accent hover:border-proton-accent/40 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shadow-xl active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          title={language === 'ka' ? 'ჩემი ლოკაცია' : 'Locate Me'}
        >
          {locating ? (
            <Loader2 size={12} className="animate-spin text-proton-accent" />
          ) : (
            <Navigation size={12} className="text-proton-accent" />
          )}
          <span>{language === 'ka' ? 'ჩემი ლოკაცია' : 'Locate Me'}</span>
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 bg-proton-card/95 backdrop-blur-xl rounded-xl border border-proton-border text-proton-text hover:text-proton-accent hover:border-proton-accent/40 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shadow-xl active:scale-95 transition-all cursor-pointer"
            title={language === 'ka' ? 'ბადეზე გადასვლა' : 'Switch to Grid'}
          >
            <LayoutGrid size={12} className="text-proton-accent" />
            <span>{language === 'ka' ? 'ბადე' : 'Grid'}</span>
          </button>
        )}
      </div>
      
      {/* Map Guidelines instructions */}
      <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 z-10 pointer-events-none hidden md:block">
        <div className="px-4 py-2 bg-proton-card/90 backdrop-blur-md rounded-xl border border-proton-border text-[8px] text-proton-muted font-black uppercase tracking-[0.1em] shadow-lg">
          {language === 'ka' ? 'დააწკაპუნეთ მარკერზე შესყიდვისთვის' : 'Click markers to initiate purchase flow'}
        </div>
      </div>
    </div>
  );
}
