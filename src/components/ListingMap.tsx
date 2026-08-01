import React, { useEffect, useRef, useState } from 'react';
import { Listing } from '../types';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LayoutGrid, Navigation, Loader2, AlertTriangle, RotateCcw, X } from 'lucide-react';

interface ListingMapProps {
  listings: Listing[];
  onSelectListing: (listing: Listing) => void;
  language: 'en' | 'ka';
  currentTheme: any;
  onClose?: () => void;
}

// Custom CSS styling for the markers
const markerStyle = `
  .custom-map-pin {
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const DEFAULT_CENTER: [number, number] = [41.7151, 44.8271];

export function ListingMap({ listings, onSelectListing, language, currentTheme, onClose }: ListingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const listingsRef = useRef<Listing[]>(listings);
  const onSelectListingRef = useRef<(listing: Listing) => void>(onSelectListing);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);

  useEffect(() => {
    onSelectListingRef.current = onSelectListing;
  }, [onSelectListing]);

  // Set up custom style on mount
  useEffect(() => {
    const styleId = 'custom-map-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = markerStyle;
      document.head.appendChild(style);
    }
  }, []);

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

    // Add CartoDB Dark Matter tile layer for an incredibly premium tech aesthetic
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    // Zoom controls at bottom right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    // Create marker layers group
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapRef.current = map;

    // Listen to custom details/buy button clicks in popups with proper cleanup
    const handlePopupOpen = (e: L.PopupEvent) => {
      const container = e.popup.getElement();
      if (container) {
        const btn = container.querySelector('.popup-buy-btn') as HTMLElement | null;
        if (btn) {
          const id = btn.getAttribute('data-listing-id');
          const handleBuyClick = () => {
            btn.setAttribute('style', 'opacity: 0.7; transform: scale(0.98);');
            if (id) {
              const matched = listingsRef.current.find(l => l.id === id);
              if (matched && onSelectListingRef.current) {
                onSelectListingRef.current(matched);
              }
            }
          };
          btn.addEventListener('click', handleBuyClick);
          map.once('popupclose', () => {
            btn.removeEventListener('click', handleBuyClick);
          });
        }
      }
    };

    map.on('popupopen', handlePopupOpen);

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
        mapRef.current.off('popupopen', handlePopupOpen);
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

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

        // Create Custom DivIcon with pulsing neon/proton aesthetic
        const markerColor = '#2e5bff'; // Default premium blue theme
        const iconHtml = `
          <div class="relative w-10 h-10 flex items-center justify-center">
            <!-- Pulsing outer ring -->
            <div class="absolute w-8 h-8 rounded-full bg-[#2e5bff]/20 animate-ping duration-1000"></div>
            <!-- Inner ring -->
            <div class="w-7 h-7 rounded-full bg-[#141414] border-2 border-[#2e5bff] shadow-lg shadow-[#2e5bff]/40 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${markerColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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

        const localizedTitle = language === 'ka' ? (listing.titleGe || listing.title) : listing.title;
        const localizedDesc = language === 'ka' ? (listing.descriptionGe || listing.description) : listing.description;
        
        // Premium popup HTML structured standardly
        const popupHtml = `
          <div class="w-64 bg-[#141414] text-white rounded-2xl overflow-hidden p-0 border border-white/10 shadow-2xl font-sans" style="margin: -14px -20px;">
            ${listing.image ? `
              <div class="h-28 overflow-hidden relative">
                <img src="${listing.image}" alt="${localizedTitle}" class="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div class="absolute top-2 right-2 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[9px] font-black uppercase text-white tracking-widest border border-white/10">
                  ${listing.category}
                </div>
              </div>
            ` : ''}
            <div class="p-4 space-y-2">
              <h4 class="text-sm font-black uppercase tracking-tight text-white leading-tight line-clamp-1">${localizedTitle}</h4>
              <p class="text-[10px] text-gray-400 leading-relaxed line-clamp-2">${localizedDesc}</p>
              
              <div class="flex items-center justify-between pt-1 border-t border-white/5">
                <span class="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                  ${language === 'ka' ? 'ფასი:' : 'Price:'}
                </span>
                <span class="text-xs font-black text-[#2e5bff]">
                  ${listing.price.toLocaleString()} ${listing.currency}
                </span>
              </div>
              
              <button 
                id="btn-buy-${listing.id}"
                data-listing-id="${listing.id}"
                class="popup-buy-btn w-full mt-2 py-2 px-4 text-center text-[9px] font-black uppercase tracking-widest text-white rounded-xl bg-gradient-to-r from-blue-600 to-[#2e5bff] border border-white/10 hover:brightness-110 cursor-pointer active:scale-95 transition-all duration-200 block shadow-md shadow-blue-500/10"
              >
                ${language === 'ka' ? 'დეტალები / ყიდვა' : 'Details / Buy Now'}
              </button>
            </div>
          </div>
        `;

        // Create marker
        const marker = L.marker([lat, lng], { icon: customIcon });
        marker.bindPopup(popupHtml, {
          maxWidth: 300,
          className: 'custom-leaflet-popup-container'
        });

        // Dynamic click binding inside map component directly with cleanup
        marker.on('popupopen', () => {
          setTimeout(() => {
            const btn = document.getElementById(`btn-buy-${listing.id}`);
            if (btn) {
              btn.onclick = () => {
                if (onSelectListingRef.current) {
                  onSelectListingRef.current(listing);
                }
              };
              marker.once('popupclose', () => {
                if (btn) btn.onclick = null;
              });
            }
          }, 50);
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

  }, [listings, language]);

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

          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            const userIconHtml = `
              <div class="relative w-8 h-8 flex items-center justify-center">
                <div class="absolute w-6 h-6 rounded-full bg-emerald-500/30 animate-ping"></div>
                <div class="w-5 h-5 rounded-full bg-[#141414] border-2 border-emerald-400 shadow-lg shadow-emerald-500/50 flex items-center justify-center">
                  <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
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
              .bindPopup(
                `<div class="p-2 text-center text-xs font-bold text-emerald-400 bg-[#141414] rounded-lg">${
                  language === 'ka' ? 'თქვენი მიმდინარე ლოკაცია' : 'Your Current Location'
                }</div>`
              )
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
    <div className="relative w-full h-[380px] sm:h-[500px] md:h-[650px] rounded-[32px] sm:rounded-[40px] overflow-hidden border border-white/5 shadow-2xl bg-[#0a0a0a] group animate-in fade-in duration-500">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full z-0" 
        style={{ background: '#0a0a0a' }}
      />
      
      {/* Geolocation Fallback Contextual Banner */}
      {geoError && (
        <div className="absolute top-16 left-4 right-4 sm:left-6 sm:right-6 z-20 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="px-4 py-3 bg-black/90 backdrop-blur-xl rounded-2xl border border-amber-500/30 text-amber-300 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              <span className="font-medium leading-tight text-[11px] text-amber-200">{geoError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleLocateUser}
                disabled={locating}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl text-[10px] font-black uppercase tracking-wider text-amber-200 transition-all flex items-center gap-1 cursor-pointer"
              >
                {locating ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                <span>{language === 'ka' ? 'ხელახლა ცდა' : 'Retry'}</span>
              </button>
              <button
                type="button"
                onClick={() => setGeoError(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-amber-400/80 hover:text-amber-200 transition-all cursor-pointer"
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
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-black/85 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center gap-2 shadow-2xl">
          <div className="w-1.5 h-1.5 rounded-full bg-[#2e5bff] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
            {language === 'ka' ? 'ლოკაციების რუკა' : 'Live Asset Map'}
          </span>
          <span className="px-1.5 py-0.5 bg-white/5 rounded text-[8px] font-black text-gray-500 uppercase tracking-widest border border-white/5">
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
          className="px-3 py-2 bg-black/85 backdrop-blur-xl rounded-xl border border-white/10 text-white hover:text-[#2e5bff] hover:border-[#2e5bff]/30 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shadow-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          title={language === 'ka' ? 'ჩემი ლოკაცია' : 'Locate Me'}
        >
          {locating ? (
            <Loader2 size={12} className="animate-spin text-[#2e5bff]" />
          ) : (
            <Navigation size={12} className="text-[#2e5bff]" />
          )}
          <span>{language === 'ka' ? 'ჩემი ლოკაცია' : 'Locate Me'}</span>
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 bg-black/85 backdrop-blur-xl rounded-xl border border-white/10 text-white hover:text-[#dfb257] hover:border-[#dfb257]/30 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shadow-2xl active:scale-95 transition-all cursor-pointer"
            title={language === 'ka' ? 'ბადეზე გადასვლა' : 'Switch to Grid'}
          >
            <LayoutGrid size={12} className="text-[#dfb257]" />
            <span>{language === 'ka' ? 'ბადე' : 'Grid'}</span>
          </button>
        )}
      </div>
      
      {/* Map Guidelines instructions */}
      <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 z-10 pointer-events-none hidden md:block">
        <div className="px-4 py-2 bg-black/80 backdrop-blur-md rounded-xl border border-white/5 text-[8px] text-gray-500 font-black uppercase tracking-[0.1em]">
          {language === 'ka' ? 'დააწკაპუნეთ მარკერზე შესყიდვისთვის' : 'Click markers to initiate purchase flow'}
        </div>
      </div>
    </div>
  );
}
