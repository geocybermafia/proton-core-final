import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Listing } from '../types';

// Fix Leaflet's default marker icon mismatch in bundled builds
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RegionalMapProps {
  listings: Listing[];
  selectedListing: Listing | null;
  onSelectListing: (listing: Listing) => void;
}

export default function RegionalMap({ listings, selectedListing, onSelectListing }: RegionalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create the map instance
    // Georgia coordinates: lat: 41.9, lng: 43.5, zoom: 7
    const map = L.map(mapContainerRef.current, {
      center: [42.1, 43.8],
      zoom: 7,
      zoomControl: true,
      fadeAnimation: true,
    });

    mapRef.current = map;

    // Dark elegant theme tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    // Initial resize trigger to fix canvas container size issues
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync Markers and selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers from the map of listings
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    // Map customization: create custom marker style for emerald/neon look
    const customEmeraldIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div class="relative w-8 h-8 flex items-center justify-center">
          <span class="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const selectedIcon = L.divIcon({
      className: 'custom-leaflet-marker selected',
      html: `
        <div class="relative w-10 h-10 flex items-center justify-center">
          <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-cyan-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-5 w-5 bg-cyan-500 shadow-[0_0_15px_#06b6d4] border-2 border-slate-950"></span>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    // Populate markers on map
    listings.forEach((listing) => {
      if (!listing.lat || !listing.lng) return;

      const isSelected = selectedListing?.id === listing.id;
      const marker = L.marker([listing.lat, listing.lng], {
        icon: isSelected ? selectedIcon : customEmeraldIcon,
      }).addTo(map);

      // Simple popup
      marker.bindPopup(`
        <div class="text-slate-950 p-2 font-sans max-w-xs">
          <strong class="block text-xs font-bold uppercase mb-1 tracking-wide">${listing.title}</strong>
          <span class="block text-[10px] text-emerald-600 font-mono font-bold mb-1">₾ ${listing.price.toLocaleString()}</span>
          <span class="block text-[9px] text-slate-500">კატეგორია: ${listing.category}</span>
          <span class="block text-[9px] text-slate-500">ქალაქი: ${listing.location}</span>
        </div>
      `);

      marker.on('click', () => {
        onSelectListing(listing);
      });

      markersRef.current[listing.id] = marker;
    });
  }, [listings, selectedListing, onSelectListing]);

  // Smooth flyTo transitions when selected listing is changed from spreadsheet
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedListing || !selectedListing.lat || !selectedListing.lng) return;

    map.flyTo([selectedListing.lat, selectedListing.lng], 10, {
      animate: true,
      duration: 1.5,
    });

    // Open listing popup shortly after flight
    setTimeout(() => {
      const activeMarker = markersRef.current[selectedListing.id];
      if (activeMarker) {
        activeMarker.openPopup();
      }
    }, 1500);
  }, [selectedListing]);

  // Keep map container responsive on window/rail resizing
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
    <div className="w-full h-full relative" id="leaflet-map-wrapper">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full bg-slate-950 rounded-xl overflow-hidden min-h-[350px] shadow-inner relative z-10 border border-slate-800"
        id="leaflet-map-container"
      />
      <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-800/80 rounded-lg px-2 py-1.5 z-20 text-[9px] font-mono tracking-wider text-slate-300 pointer-events-none shadow-lg">
        <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
        LIVE MAP: ACTIVE
      </div>
    </div>
  );
}
