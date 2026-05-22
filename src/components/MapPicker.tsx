import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface MapPickerProps {
  lat?: number;
  lng?: number;
  onChange: (lat?: number, lng?: number) => void;
  language: 'en' | 'ka';
  currentTheme: any;
}

export function MapPicker({ lat, lng, onChange, language, currentTheme }: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [detecting, setDetecting] = useState(false);

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

    // Add CartoDB Dark Matter tile layer (gorgeous, dark, sleek tech theme)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OSM</a>'
    }).addTo(map);

    // Zoom buttons in bottom right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    mapRef.current = map;

    // Create marker if coordinates exist
    const pinColor = '#2e5bff';
    const markerIconHtml = `
      <div class="relative w-8 h-8 flex items-center justify-center">
        <div class="absolute w-5 h-5 rounded-full bg-[#2e5bff]/30 animate-ping"></div>
        <div class="w-6 h-6 rounded-full bg-[#141414] border-2 border-[#2e5bff] shadow-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${pinColor}" stroke-width="2.5">
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

    // Cleanup unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
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
        const pinColor = '#2e5bff';
        const markerIconHtml = `
          <div class="relative w-8 h-8 flex items-center justify-center">
            <div class="absolute w-5 h-5 rounded-full bg-[#2e5bff]/35 animate-ping"></div>
            <div class="w-6 h-6 rounded-full bg-[#141414] border-2 border-[#2e5bff] shadow-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${pinColor}" stroke-width="2.5">
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

  // Geolocation detector
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert(language === 'ka' ? 'გეოლოკაცია არ არის მხარდაჭერილი თქვენი ბრაუზერის მიერ.' : 'Geolocation is not supported by your browser.');
      return;
    }

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDetecting(false);
        const { latitude, longitude } = position.coords;
        onChange(latitude, longitude);
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 15);
        }
      },
      (error) => {
        setDetecting(false);
        console.error("Geolocation error:", error);
        alert(language === 'ka' 
          ? 'ლოკაციის დადგენა ვერ მოხერხდა. მიუთითეთ ხელით რუკაზე.' 
          : 'Could not fetch geolocation. Please click on the map to pin manually.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between ml-2">
        <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-40 leading-none", currentTheme.muted)}>
          {language === 'ka' ? 'რუკის კოორდინატები' : 'Geographical coordinates'}
        </label>
        
        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={detecting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
        >
          {detecting ? (
            <Loader2 size={10} className="animate-spin text-[#2e5bff]" />
          ) : (
            <Navigation size={10} className="text-[#2e5bff]" />
          )}
          {language === 'ka' ? 'ჩემი ლოკაცია' : 'Auto Detect'}
        </button>
      </div>

      <div className="relative w-full h-80 rounded-[30px] overflow-hidden border border-white/5 shadow-inner bg-[#0a0a0a]">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
        
        {/* Coordinate indicator overlay */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="px-3 py-1.5 bg-black/90 rounded-xl border border-white/10 flex items-center gap-2 shadow-lg">
            <MapPin size={10} className="text-[#2e5bff]" />
            <span className="text-[8px] font-mono font-black text-gray-400">
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
                className="pointer-events-auto ml-1.5 text-red-400 hover:text-red-300 text-[8px] font-black uppercase"
              >
                {language === 'ka' ? 'წაშლა' : 'Clear'}
              </button>
            )}
          </div>
        </div>
        
        <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
          <span className="px-3 py-1 bg-black/70 rounded-lg text-[7px] text-gray-500 font-bold uppercase tracking-widest leading-none border border-white/5 block">
            {language === 'ka' ? 'დააკლიკეთ ან აწიეთ მარკერი' : 'Click anywhere or drag marker'}
          </span>
        </div>
      </div>
    </div>
  );
}
