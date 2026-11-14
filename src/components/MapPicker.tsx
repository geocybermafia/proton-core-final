import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Loader2, AlertTriangle, RotateCcw, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { MAP_TILE_URLS, resolveMapTileTheme } from './ListingMap';

interface MapPickerProps {
  lat?: number;
  lng?: number;
  onChange: (lat?: number, lng?: number) => void;
  language: 'en' | 'ka';
  currentTheme: any;
}

const PICKER_CONTROL_STYLE = `
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

export function MapPicker({ lat, lng, onChange, language, currentTheme }: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [tileScheme, setTileScheme] = useState<'light' | 'dark'>(() =>
    resolveMapTileTheme(currentTheme)
  );

  useEffect(() => {
    const styleId = 'custom-map-picker-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = PICKER_CONTROL_STYLE;
      document.head.appendChild(style);
    }
  }, []);

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

    // Default to Tbilisi if no coordinates given
    const initialLat = typeof lat === 'number' && !isNaN(lat) ? lat : 41.7151;
    const initialLng = typeof lng === 'number' && !isNaN(lng) ? lng : 44.8271;
    const initialZoom = typeof lat === 'number' ? 14 : 9;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: true
    });

    const initialScheme = resolveMapTileTheme(currentTheme);
    const tileLayer = L.tileLayer(MAP_TILE_URLS[initialScheme], {
      maxZoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OSM</a>'
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Zoom buttons in bottom right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    mapRef.current = map;

    // Create marker if coordinates exist
    const markerIconHtml = `
      <div class="relative w-8 h-8 flex items-center justify-center">
        <div class="absolute w-5 h-5 rounded-full animate-ping" style="background: var(--proton-accent); opacity: 0.35;"></div>
        <div class="w-6 h-6 rounded-full shadow-lg flex items-center justify-center" style="background: var(--proton-card); border: 2px solid var(--proton-accent);">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--proton-accent)" stroke-width="2.5">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: markerIconHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 26]
    });

    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      const marker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map);
      
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        onChange(position.lat, position.lng);
      });

      markerRef.current = marker;
    }

    // Click map to drop or update Pin
    map.on('click', (e) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      
      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng]);
      } else {
        const newMarker = L.marker([clickLat, clickLng], { icon: customIcon, draggable: true }).addTo(map);
        
        newMarker.on('dragend', () => {
          const pos = newMarker.getLatLng();
          onChange(pos.lat, pos.lng);
        });

        markerRef.current = newMarker;
      }
      onChange(clickLat, clickLng);
    });

    // Step One: Multiple invalidateSize calls to guarantee tile rendering post modal animation
    const invalidateTimers = [50, 150, 300, 600, 1000].map(delay =>
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, delay)
    );

    // Cleanup unmount
    return () => {
      invalidateTimers.forEach(t => clearTimeout(t));
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  // Dynamically switch tile layer URL when active PROTON theme changes
  useEffect(() => {
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(MAP_TILE_URLS[tileScheme]);
    }
  }, [tileScheme]);

  // Step Three: ResizeObserver Integration for Container Resizing & Drawer Toggles
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

  // Update center or marker coordinates when props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      if (markerRef.current) {
        const currentPos = markerRef.current.getLatLng();
        if (currentPos.lat !== lat || currentPos.lng !== lng) {
          markerRef.current.setLatLng([lat, lng]);
          map.panTo([lat, lng]);
        }
      } else {
        const markerIconHtml = `
          <div class="relative w-8 h-8 flex items-center justify-center">
            <div class="absolute w-5 h-5 rounded-full animate-ping" style="background: var(--proton-accent); opacity: 0.35;"></div>
            <div class="w-6 h-6 rounded-full shadow-lg flex items-center justify-center" style="background: var(--proton-card); border: 2px solid var(--proton-accent);">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--proton-accent)" stroke-width="2.5">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>
        `;
        const customIcon = L.divIcon({
          className: 'custom-map-pin',
          html: markerIconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 26]
        });

        const newMarker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map);
        newMarker.on('dragend', () => {
          const pos = newMarker.getLatLng();
          onChange(pos.lat, pos.lng);
        });
        markerRef.current = newMarker;
        map.setView([lat, lng], 14);
      }
    } else {
      // Coords removed/falsy, remove marker
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [lat, lng]);

  // Geolocation detector with graceful error handling
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGeoError(
        language === 'ka'
          ? 'გეოლოკაცია არ არის მხარდაჭერილი. მიუთითეთ ლოკაცია რუკაზე ხელით.'
          : 'Geolocation is not supported. Please click on the map to pin location manually.'
      );
      return;
    }

    setDetecting(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDetecting(false);
        const { latitude, longitude } = position.coords;
        onChange(latitude, longitude);
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 15);
        }
      },
      (error: GeolocationPositionError) => {
        setDetecting(false);
        console.warn("MapPicker GeolocationPositionError:", error.code, error.message);

        let msg = language === 'ka'
          ? 'ლოკაციის დადგენა ვერ მოხერხდა. მიუთითეთ ლოკაცია რუკაზე ხელით.'
          : 'Could not fetch location. Please click on map to pin manually.';

        if (error.code === error.PERMISSION_DENIED) {
          msg = language === 'ka'
            ? 'ლოკაციაზე წვდომა უარყოფილია. აირჩიეთ კოორდინატები რუკაზე წკაპით.'
            : 'Location permission denied. Click anywhere on the map to place pin.';
        } else if (error.code === error.TIMEOUT) {
          msg = language === 'ka'
            ? 'ლოკაციის მოთხოვნის დრო ამოიწურა. სცადეთ ხელახლა ან მიუთითეთ ხელით.'
            : 'Location request timed out. Please retry or pick location manually.';
        }

        setGeoError(msg);
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between ml-2">
        <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] leading-none", currentTheme.muted)}>
          {language === 'ka' ? 'რუკის კოორდინატები' : 'Geographical coordinates'}
        </label>
        
        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={detecting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-proton-card border border-proton-border hover:border-proton-accent/40 hover:bg-proton-accent/10 rounded-xl text-[9px] font-black uppercase tracking-wider text-proton-text transition-all disabled:opacity-50 cursor-pointer"
        >
          {detecting ? (
            <Loader2 size={10} className="animate-spin text-proton-accent" />
          ) : (
            <Navigation size={10} className="text-proton-accent" />
          )}
          {language === 'ka' ? 'ჩემი ლოკაცია' : 'Auto Detect'}
        </button>
      </div>

      {/* Non-intrusive Geolocation Error Banner */}
      {geoError && (
        <div className="px-3.5 py-2 bg-proton-card/95 border border-amber-500/40 rounded-xl flex items-center justify-between gap-2 text-[10px] text-proton-text shadow-md">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-amber-500 shrink-0" />
            <span className="leading-tight">{geoError}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={detecting}
              className="p-1 text-amber-500 hover:text-proton-text transition-colors"
              title={language === 'ka' ? 'ხელახლა ცდა' : 'Retry'}
            >
              <RotateCcw size={11} />
            </button>
            <button
              type="button"
              onClick={() => setGeoError(null)}
              className="p-1 text-proton-muted hover:text-proton-text transition-colors"
              title={language === 'ka' ? 'დახურვა' : 'Dismiss'}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      <div className="relative w-full h-64 min-h-[250px] rounded-[30px] overflow-hidden border border-proton-border shadow-inner bg-proton-bg">
        <div ref={mapContainerRef} className="w-full h-full min-h-[250px] z-0 bg-proton-bg" />
        
        {/* Coordinate indicator overlay */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="px-3 py-1.5 bg-proton-card/95 backdrop-blur-md rounded-xl border border-proton-border flex items-center gap-2 shadow-lg">
            <MapPin size={10} className="text-proton-accent" />
            <span className="text-[8px] font-mono font-black text-proton-muted">
              {typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)
                ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                : (language === 'ka' ? 'მიუთითეთ ლოკაცია' : 'Click map to pin asset')}
            </span>
            {typeof lat === 'number' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(undefined, undefined);
                }}
                className="pointer-events-auto ml-1.5 text-rose-500 hover:text-rose-400 text-[8px] font-black uppercase"
              >
                {language === 'ka' ? 'წაშლა' : 'Clear'}
              </button>
            )}
          </div>
        </div>
        
        <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
          <span className="px-3 py-1 bg-proton-card/90 backdrop-blur-md rounded-lg text-[7px] text-proton-muted font-bold uppercase tracking-widest leading-none border border-proton-border block">
            {language === 'ka' ? 'დააკლიკეთ ან აწიეთ მარკერი' : 'Click anywhere or drag marker'}
          </span>
        </div>
      </div>
    </div>
  );
}
