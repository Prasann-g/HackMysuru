import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import {
  Compass,
  RefreshCw,
  Search,
  AlertCircle,
  Building2,
  CheckCircle2,
  Navigation,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import {
  apiGetMapComplaints,
  apiGetWardsGeoJson,
  type PublicMapComplaintItem,
  type MapComplaintsFilter,
} from '../../services/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface MysuruCivicMapProps {
  onSelectComplaint?: (trackingToken: string) => void;
  title?: string;
  subtitle?: string;
  initialRadius?: number;
  initialWard?: string;
  heightClass?: string;
  showFilters?: boolean;
}

const MYSURU_CENTER: [number, number] = [12.3052, 76.6554]; // Mysuru City Hall / Town Hall
const DEFAULT_ZOOM = 13;

const CATEGORY_LABELS: Record<string, string> = {
  pothole: 'Road Potholes & Craters',
  garbage_dumping: 'Garbage & Waste',
  broken_streetlight: 'Broken Streetlight',
  overflowing_bin: 'Overflowing Bin',
  unsegregated_waste: 'Unsegregated Waste',
  construction_debris: 'Construction Debris',
  other: 'Civic Maintenance',
};

const CATEGORY_COLORS: Record<string, { pin: string; text: string; bg: string }> = {
  pothole: { pin: '#D97706', text: 'text-amber-800', bg: 'bg-amber-50 border-amber-200' },
  garbage_dumping: { pin: '#059669', text: 'text-emerald-800', bg: 'bg-emerald-50 border-emerald-200' },
  broken_streetlight: { pin: '#2563EB', text: 'text-blue-800', bg: 'bg-blue-50 border-blue-200' },
  overflowing_bin: { pin: '#7C3AED', text: 'text-purple-800', bg: 'bg-purple-50 border-purple-200' },
  unsegregated_waste: { pin: '#65A30D', text: 'text-lime-800', bg: 'bg-lime-50 border-lime-200' },
  construction_debris: { pin: '#EA580C', text: 'text-orange-800', bg: 'bg-orange-50 border-orange-200' },
  other: { pin: '#64748B', text: 'text-stone-700', bg: 'bg-stone-50 border-stone-200' },
};

const STATUS_BADGES: Record<string, { label: string; variant: 'verified' | 'review' | 'info' | 'neutral' }> = {
  SUBMITTED: { label: 'Submitted', variant: 'neutral' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'review' },
  NEEDS_CLARIFICATION: { label: 'Needs Info', variant: 'review' },
  FORWARDED: { label: 'Forwarded', variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info' },
  RESOLVED: { label: 'Resolved', variant: 'verified' },
  CLOSED: { label: 'Closed', variant: 'neutral' },
};

export const MysuruCivicMap: React.FC<MysuruCivicMapProps> = ({
  onSelectComplaint,
  title = 'Interactive Mysuru Civic Map',
  subtitle = 'Explore authentic civic complaints across Mysuru City Corporation wards. Click markers to inspect evidence & verification lifecycle.',
  initialRadius = 0,
  initialWard = 'ALL',
  heightClass = 'h-[580px]',
  showFilters = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const wardGeoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const userLocationLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const connectionLineLayerRef = useRef<L.Polyline | null>(null);

  // Map state
  const [complaints, setComplaints] = useState<PublicMapComplaintItem[]>([]);
  const [wardsData, setWardsData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<PublicMapComplaintItem | null>(null);
  const [selectedWard, setSelectedWard] = useState<string>(initialWard);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [radiusKm, setRadiusKm] = useState<number>(initialRadius);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle');
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showWardBoundaries, setShowWardBoundaries] = useState<boolean>(true);
  const [hoveredWardName, setHoveredWardName] = useState<string | null>(null);

  // 1. Initialize Leaflet Map instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: MYSURU_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: false, // Customized controls below
    });

    // Add standard OpenStreetMap tile layer (zero API key dependency)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Add layer groups
    const wardLayer = L.geoJSON(undefined, {
      style: () => ({
        color: '#8E6E31', // Restrained champagne-gold border
        weight: 1.5,
        opacity: 0.7,
        fillColor: '#FAF6F0',
        fillOpacity: 0.12,
      }),
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    const userGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    wardGeoJsonLayerRef.current = wardLayer;
    markersLayerGroupRef.current = markersGroup;
    userLocationLayerGroupRef.current = userGroup;

    // Load GeoJSON ward boundaries
    apiGetWardsGeoJson()
      .then((geoData) => {
        if (geoData && mapInstanceRef.current && wardGeoJsonLayerRef.current) {
          setWardsData(geoData);
        }
      })
      .catch((err) => {
        console.warn('[MysuruCivicMap] Ward GeoJSON load notice:', err.message);
      });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Invalidate map size on fullscreen toggle
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen]);

  // 2. Fetch map complaints from API
  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: MapComplaintsFilter = {
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        ward: selectedWard !== 'ALL' ? selectedWard : undefined,
      };

      if (userLocation) {
        filters.latitude = userLocation.latitude;
        filters.longitude = userLocation.longitude;
        if (radiusKm > 0) {
          filters.radius = radiusKm;
        }
      }

      const res = await apiGetMapComplaints(filters);
      setComplaints(res.complaints || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load complaints for the map.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedStatus, selectedWard, userLocation, radiusKm]);

  // Initial and reactive fetch on filter changes
  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // 3. Lightweight 30-second live polling (pauses when backgrounded, cleans up on unmount)
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchComplaints();
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [fetchComplaints]);

  // 4. Render Ward Boundaries GeoJSON
  useEffect(() => {
    const wardLayer = wardGeoJsonLayerRef.current;
    if (!wardLayer || !wardsData) return;

    wardLayer.clearLayers();

    if (!showWardBoundaries) return;

    wardLayer.addData(wardsData);
    wardLayer.eachLayer((layer: any) => {
      const props = layer.feature?.properties || {};
      const wardNo = String(props.KGISWardNo || '');
      const wardName = String(props.KGISWardName || `Ward ${wardNo}`);

      const isSelected = selectedWard !== 'ALL' && selectedWard === wardNo;

      layer.setStyle({
        color: isSelected ? '#C5A059' : '#8E6E31',
        weight: isSelected ? 3 : 1.5,
        opacity: isSelected ? 0.95 : 0.65,
        fillColor: isSelected ? '#C5A059' : '#FAF6F0',
        fillOpacity: isSelected ? 0.3 : 0.1,
      });

      layer.on({
        mouseover: (e: any) => {
          setHoveredWardName(`Ward ${wardNo}: ${wardName}`);
          if (!isSelected) {
            e.target.setStyle({
              weight: 2.5,
              color: '#B08C44',
              fillOpacity: 0.22,
            });
          }
        },
        mouseout: (e: any) => {
          setHoveredWardName(null);
          if (!isSelected) {
            e.target.setStyle({
              weight: 1.5,
              color: '#8E6E31',
              fillOpacity: 0.1,
            });
          }
        },
        click: () => {
          setSelectedWard((curr) => (curr === wardNo ? 'ALL' : wardNo));
        },
      });

      // Simple tooltip
      layer.bindTooltip(`<strong>Ward ${wardNo}</strong>: ${wardName}`, {
        sticky: true,
        direction: 'top',
        className: 'text-xs font-medium text-bridge-charcoal-800 bg-white border border-bridge-almond-200 px-2 py-1 rounded-md shadow-civic-sm',
      });
    });
  }, [wardsData, showWardBoundaries, selectedWard]);

  // 5. Render User Position Marker & Accuracy Circle
  useEffect(() => {
    const userGroup = userLocationLayerGroupRef.current;
    const map = mapInstanceRef.current;
    if (!userGroup || !map) return;

    userGroup.clearLayers();

    if (userLocation) {
      // Accuracy Circle
      const circle = L.circle([userLocation.latitude, userLocation.longitude], {
        radius: userLocation.accuracy,
        color: '#C5A059',
        fillColor: '#C5A059',
        fillOpacity: 0.15,
        weight: 1.5,
        dashArray: '4, 4',
      });
      userGroup.addLayer(circle);

      // Radar pulse HTML Marker
      const radarIcon = L.divIcon({
        className: 'gps-radar-wrapper',
        html: '<div class="gps-radar-dot"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
        icon: radarIcon,
        zIndexOffset: 1000,
      });

      userMarker.bindPopup(
        `<div class="p-3 text-xs text-bridge-charcoal-800 font-sans">
          <strong class="text-bridge-gold-800 block text-sm mb-1">Your GPS Position</strong>
          <span>Coordinates: ${userLocation.latitude.toFixed(5)}° N, ${userLocation.longitude.toFixed(5)}° E</span>
          <span class="block text-[11px] text-bridge-charcoal-500 mt-1">Accuracy radius: ~${userLocation.accuracy}m</span>
        </div>`
      );

      userGroup.addLayer(userMarker);
    }
  }, [userLocation]);

  // 6. Render Complaint Markers & Clustering
  useEffect(() => {
    const markersGroup = markersLayerGroupRef.current;
    const map = mapInstanceRef.current;
    if (!markersGroup || !map) return;

    markersGroup.clearLayers();

    const zoom = map.getZoom();

    // Fast, lightweight spatial grid clustering for performance when zoomed out
    const CLUSTER_ZOOM_THRESHOLD = 14;
    const shouldCluster = zoom < CLUSTER_ZOOM_THRESHOLD;

    if (shouldCluster) {
      // Grid clustering bucket by ~0.015 degrees latitude/longitude (~1.5km)
      const gridSize = 0.012;
      const clusters: Record<string, { lat: number; lng: number; items: PublicMapComplaintItem[] }> = {};

      for (const c of complaints) {
        const key = `${Math.floor(c.latitude / gridSize)}_${Math.floor(c.longitude / gridSize)}`;
        if (!clusters[key]) {
          clusters[key] = { lat: c.latitude, lng: c.longitude, items: [] };
        }
        clusters[key].items.push(c);
      }

      Object.values(clusters).forEach((cluster) => {
        if (cluster.items.length === 1) {
          // Single item: render normal pin
          renderSinglePin(cluster.items[0], markersGroup);
        } else {
          // Cluster pin
          const clusterIcon = L.divIcon({
            className: 'civic-cluster-wrapper',
            html: `<div class="civic-cluster-marker" style="width: ${Math.min(48, 28 + cluster.items.length * 2)}px; height: ${Math.min(48, 28 + cluster.items.length * 2)}px;">
                    ${cluster.items.length}
                   </div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });

          const clusterMarker = L.marker([cluster.lat, cluster.lng], { icon: clusterIcon });
          clusterMarker.on('click', () => {
            map.flyTo([cluster.lat, cluster.lng], zoom + 2, { duration: 0.6 });
          });
          markersGroup.addLayer(clusterMarker);
        }
      });
    } else {
      // Zoomed in: render individual pins
      complaints.forEach((c) => renderSinglePin(c, markersGroup));
    }

    function renderSinglePin(c: PublicMapComplaintItem, targetGroup: L.LayerGroup) {
      const catConfig = CATEGORY_COLORS[c.category] || CATEGORY_COLORS.other;
      const isSelected = selectedComplaint?.id === c.id;

      // Custom SVG Pin Icon
      const pinColor = catConfig.pin;
      const svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="28" height="36" class="transition-transform hover:scale-110 drop-shadow-md">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="${isSelected ? '#1C1E21' : pinColor}" stroke="${isSelected ? '#C5A059' : '#FFFFFF'}" stroke-width="2"/>
          <circle cx="12" cy="12" r="5" fill="#FFFFFF"/>
        </svg>
      `;

      const markerIcon = L.divIcon({
        className: 'civic-complaint-pin',
        html: svgIcon,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        popupAnchor: [0, -34],
      });

      const marker = L.marker([c.latitude, c.longitude], { icon: markerIcon });

      marker.on('click', () => {
        setSelectedComplaint(c);
      });

      // Rich popup content
      const statusMeta = STATUS_BADGES[c.status] || STATUS_BADGES.SUBMITTED;
      const distanceText = c.distanceMeters !== undefined 
        ? (c.distanceMeters < 1000 ? `${Math.round(c.distanceMeters)}m away` : `${(c.distanceMeters / 1000).toFixed(1)} km away`)
        : null;

      const popupHtml = `
        <div class="p-4 space-y-2.5 max-w-[280px] font-sans">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-bridge-almond-100 text-bridge-charcoal-800 border border-bridge-almond-200">
              ${c.trackingToken}
            </span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.isDemo ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-bridge-almond-50 text-bridge-charcoal-700'}">
              ${c.isDemo ? 'Test Record' : statusMeta.label}
            </span>
          </div>

          <h4 class="text-xs font-bold text-bridge-charcoal-900 line-clamp-2">
            ${c.description}
          </h4>

          <div class="text-[11px] text-bridge-charcoal-600 space-y-1 pt-1 border-t border-bridge-almond-200">
            <div><strong>Location:</strong> ${c.locationArea} ${c.wardNumber ? `(Ward ${c.wardNumber})` : ''}</div>
            <div><strong>Civic Dept:</strong> ${c.assignedDepartment || 'Pending Assignment'}</div>
            ${distanceText ? `<div class="text-bridge-gold-800 font-semibold">📍 ${distanceText} from your position</div>` : ''}
          </div>

          <button
            id="popup-btn-${c.id}"
            class="w-full mt-2 py-1.5 px-3 bg-bridge-charcoal-900 hover:bg-bridge-charcoal-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-civic-sm"
          >
            <span>View Timeline & Details</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`popup-btn-${c.id}`);
        if (btn) {
          btn.onclick = () => {
            if (onSelectComplaint) {
              onSelectComplaint(c.trackingToken);
            }
          };
        }
      });

      targetGroup.addLayer(marker);
    }

    // Re-cluster on zoom change
    const onZoomEnd = () => {
      // Trigger re-render of markers by calling single render
      map.fire('render-markers');
    };

    map.on('zoomend', onZoomEnd);
    return () => {
      map.off('zoomend', onZoomEnd);
    };
  }, [complaints, selectedComplaint, onSelectComplaint]);

  // 7. Visual direct line between Citizen GPS and Selected Complaint (Rule 5: Clearly label direct distance, not road network)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (connectionLineLayerRef.current) {
      connectionLineLayerRef.current.remove();
      connectionLineLayerRef.current = null;
    }

    if (userLocation && selectedComplaint) {
      const line = L.polyline(
        [
          [userLocation.latitude, userLocation.longitude],
          [selectedComplaint.latitude, selectedComplaint.longitude],
        ],
        {
          color: '#C5A059',
          weight: 2,
          dashArray: '6, 8',
          opacity: 0.8,
        }
      ).addTo(map);

      connectionLineLayerRef.current = line;
    }
  }, [userLocation, selectedComplaint]);

  // 8. GPS "My Location" handler
  const handleAcquireGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsNotice('Geolocation is not supported by your browser.');
      return;
    }

    setGpsStatus('locating');
    setGpsNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy);

        setUserLocation({ latitude: lat, longitude: lng, accuracy: acc });
        setGpsStatus('success');

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 14, { duration: 1 });
        }
      },
      (err) => {
        setGpsStatus('error');
        if (err.code === err.PERMISSION_DENIED) {
          setGpsNotice('Location permission was denied. You can still browse Mysuru complaints manually.');
        } else if (err.code === err.TIMEOUT) {
          setGpsNotice('Location request timed out. Please retry or browse manually.');
        } else {
          setGpsNotice('Unable to acquire GPS position.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // Recenter to Mysuru City Center
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(MYSURU_CENTER, DEFAULT_ZOOM, { duration: 0.8 });
    }
  };

  // Search handler (searches by locality name, ward, or token)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const q = searchQuery.toLowerCase().trim();
    const match = complaints.find(
      (c) =>
        c.trackingToken.toLowerCase().includes(q) ||
        c.locationArea.toLowerCase().includes(q) ||
        (c.wardName && c.wardName.toLowerCase().includes(q)) ||
        (c.addressText && c.addressText.toLowerCase().includes(q))
    );

    if (match && mapInstanceRef.current) {
      setSelectedComplaint(match);
      mapInstanceRef.current.flyTo([match.latitude, match.longitude], 16, { duration: 0.8 });
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedCategory('ALL');
    setSelectedStatus('ALL');
    setSelectedWard('ALL');
    setRadiusKm(0);
    setSearchQuery('');
    setSelectedComplaint(null);
    handleRecenter();
  };

  return (
    <div className="space-y-4">
      {/* 1. Header with Title and Quick Controls */}
      <div className="bg-white border border-bridge-almond-200 rounded-2xl p-5 shadow-bridge-card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-semibold text-bridge-gold-700 uppercase tracking-wider bg-bridge-gold-50 border border-bridge-gold-200 px-2.5 py-0.5 rounded-full">
                Mysuru City Corporation (MCC) Spatial Grid
              </span>
              <Badge variant="verified" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                Authentic 65-Ward Dataset
              </Badge>
              {complaints.length > 0 && (
                <span className="text-xs font-mono font-bold text-bridge-charcoal-700 bg-bridge-almond-100 border border-bridge-almond-200 px-2 py-0.5 rounded-md">
                  {complaints.length} Pins Active
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-bridge-charcoal-900 tracking-tight">
              {title}
            </h2>
            <p className="text-xs text-bridge-charcoal-600 mt-0.5 max-w-3xl">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* GPS "My Location" Button */}
            <Button
              variant={userLocation ? 'primary' : 'outline'}
              size="sm"
              onClick={handleAcquireGps}
              disabled={gpsStatus === 'locating'}
              icon={
                gpsStatus === 'locating' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )
              }
            >
              {gpsStatus === 'locating' ? 'Acquiring GPS...' : userLocation ? 'GPS Active' : 'My Location'}
            </Button>

            {/* Recenter Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecenter}
              icon={<Compass className="w-4 h-4" />}
              title="Recenter map on Mysuru City Hall"
            >
              Recenter
            </Button>

            {/* Fullscreen Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen((prev) => !prev)}
              icon={isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'}
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>

            {/* Refresh Pins */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchComplaints}
              disabled={loading}
              icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
              title="Refresh grievance pins"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-700 hover:text-rose-900 p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* GPS Alert Notice if permission denied or error */}
        {gpsNotice && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{gpsNotice}</span>
            </div>
            <button
              onClick={() => setGpsNotice(null)}
              className="text-amber-700 hover:text-amber-900 p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Interactive Map Filters Bar */}
      {showFilters && (
        <div className="bg-white border border-bridge-almond-200 rounded-2xl p-4 shadow-bridge-card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="md:col-span-4 relative">
              <Search className="w-4 h-4 text-bridge-charcoal-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by locality, token, or landmark..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-bridge-ivory-50 border border-bridge-almond-200 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 text-bridge-charcoal-900 placeholder:text-bridge-charcoal-400"
              />
            </form>

            {/* Category Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-bridge-ivory-50 border border-bridge-almond-200 rounded-xl text-bridge-charcoal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([cat, lbl]) => (
                  <option key={cat} value={cat}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-bridge-ivory-50 border border-bridge-almond-200 rounded-xl text-bridge-charcoal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-gold-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                {Object.entries(STATUS_BADGES).map(([st, meta]) => (
                  <option key={st} value={st}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            <div className="md:col-span-2 flex items-center justify-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-bridge-gold-700 hover:text-bridge-gold-900 px-3 py-2 rounded-lg hover:bg-bridge-gold-50 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Nearby Radius Discovery Filter (Enabled especially when GPS is active) */}
          <div className="pt-2 border-t border-bridge-almond-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-bridge-charcoal-700">Nearby Discovery Radius:</span>
              {[
                { val: 0, label: 'All Mysuru' },
                { val: 1, label: 'Within 1 km' },
                { val: 3, label: 'Within 3 km' },
                { val: 5, label: 'Within 5 km' },
                { val: 10, label: 'Within 10 km' },
              ].map((r) => (
                <button
                  key={r.val}
                  type="button"
                  onClick={() => {
                    setRadiusKm(r.val);
                    if (!userLocation && r.val > 0) {
                      handleAcquireGps();
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                    radiusKm === r.val
                      ? 'bg-bridge-charcoal-900 text-white border-bridge-charcoal-900 shadow-civic-sm'
                      : 'bg-white border-bridge-almond-200 text-bridge-charcoal-700 hover:bg-bridge-almond-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Ward Boundaries Toggle */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-bridge-charcoal-700">
              <input
                type="checkbox"
                checked={showWardBoundaries}
                onChange={(e) => setShowWardBoundaries(e.target.checked)}
                className="rounded border-bridge-almond-300 text-bridge-gold-600 focus:ring-bridge-gold-500"
              />
              <span>Show 65 Ward Polygons</span>
            </label>
          </div>
        </div>
      )}

      {/* 3. Main Map Canvas Container */}
      <div className={`relative rounded-2xl overflow-hidden border border-bridge-almond-200 shadow-bridge-card bg-bridge-ivory-50 ${
        isFullscreen ? 'fixed inset-0 z-[9999] rounded-none border-none h-screen w-screen' : ''
      }`}>
        {/* The Leaflet Canvas */}
        <div ref={mapContainerRef} className={`w-full ${isFullscreen ? 'h-screen' : heightClass} z-0`} />

        {/* Hovered Ward Badge Indicator (Floating Top Left) */}
        {hoveredWardName && (
          <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-sm border border-bridge-almond-200 px-3 py-1.5 rounded-xl shadow-civic text-xs font-semibold text-bridge-charcoal-900 flex items-center gap-2 pointer-events-none animate-fadeIn">
            <Building2 className="w-3.5 h-3.5 text-bridge-gold-700" />
            <span>{hoveredWardName}</span>
          </div>
        )}

        {/* Selected Ward Banner (Floating Top Right if a ward is filtered) */}
        {selectedWard !== 'ALL' && (
          <div className="absolute top-3 right-3 z-[400] bg-white border border-bridge-gold-400 px-3 py-1.5 rounded-xl shadow-civic text-xs font-bold text-bridge-gold-900 flex items-center gap-2">
            <span>Filtered: Ward {selectedWard}</span>
            <button
              onClick={() => setSelectedWard('ALL')}
              className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 cursor-pointer"
              title="Clear Ward filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Floating Direct Distance Notice (Rule 5 compliance) */}
        {userLocation && selectedComplaint && (
          <div className="absolute bottom-3 left-3 z-[400] max-w-sm bg-white/95 backdrop-blur-sm border border-bridge-almond-200 p-2.5 rounded-xl shadow-civic text-[11px] text-bridge-charcoal-700 leading-snug">
            <span className="font-bold text-bridge-gold-800 block">
              📏 Direct Distance (As the crow flies):
            </span>
            <span>
              {selectedComplaint.distanceMeters !== undefined
                ? `${Math.round(selectedComplaint.distanceMeters)} meters between your GPS position and this complaint pin.`
                : 'Distance computed via spherical Haversine formula.'}
            </span>
            <span className="block text-[10px] text-bridge-charcoal-500 mt-0.5 italic">
              Note: Direct distance only; does not represent physical road-network routing.
            </span>
          </div>
        )}

        {/* Map Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-[500] flex items-center justify-center">
            <div className="bg-white border border-bridge-almond-200 px-4 py-2 rounded-xl shadow-civic flex items-center gap-2.5 text-xs font-semibold text-bridge-charcoal-800">
              <RefreshCw className="w-4 h-4 text-bridge-gold-600 animate-spin" />
              <span>Loading Mysuru spatial records...</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Selected Complaint Mini-Inspector Drawer / Card */}
      {selectedComplaint && (
        <div className="bg-white border border-bridge-almond-200 rounded-2xl p-5 shadow-bridge-card space-y-3 animate-fadeIn">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold bg-bridge-almond-100 border border-bridge-almond-200 px-2.5 py-0.5 rounded-lg text-bridge-charcoal-800">
                  {selectedComplaint.trackingToken}
                </span>
                <span className="text-xs font-semibold text-bridge-gold-800 bg-bridge-gold-50 border border-bridge-gold-200 px-2.5 py-0.5 rounded-full">
                  {CATEGORY_LABELS[selectedComplaint.category] || selectedComplaint.category}
                </span>
                <Badge variant={STATUS_BADGES[selectedComplaint.status]?.variant || 'neutral'} size="sm">
                  {STATUS_BADGES[selectedComplaint.status]?.label || selectedComplaint.status}
                </Badge>
                {selectedComplaint.isDemo && (
                  <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md">
                    Test Record
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-bridge-charcoal-900 mt-1">
                {selectedComplaint.description}
              </h3>
            </div>

            <button
              onClick={() => setSelectedComplaint(null)}
              className="text-bridge-charcoal-400 hover:text-bridge-charcoal-700 p-1.5 rounded-lg hover:bg-bridge-almond-50 cursor-pointer shrink-0"
              title="Close inspection card"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-bridge-charcoal-700 pt-2 border-t border-bridge-almond-100">
            <div>
              <span className="text-bridge-charcoal-500 block text-[11px]">Location & Ward</span>
              <span className="font-semibold block mt-0.5">
                {selectedComplaint.locationArea} {selectedComplaint.wardNumber ? `• Ward ${selectedComplaint.wardNumber}` : ''}
              </span>
            </div>

            <div>
              <span className="text-bridge-charcoal-500 block text-[11px]">Civic Administrative Routing</span>
              <span className="font-semibold block mt-0.5">
                {selectedComplaint.assignedDepartment || 'MCC General Grievance Cell'}
              </span>
            </div>

            <div>
              <span className="text-bridge-charcoal-500 block text-[11px]">Coordinates & Distance</span>
              <span className="font-semibold block mt-0.5">
                {selectedComplaint.latitude.toFixed(5)}° N, {selectedComplaint.longitude.toFixed(5)}° E
                {selectedComplaint.distanceMeters !== undefined && ` (~${Math.round(selectedComplaint.distanceMeters)}m away)`}
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (onSelectComplaint) {
                  onSelectComplaint(selectedComplaint.trackingToken);
                }
              }}
              icon={<ChevronRight className="w-4 h-4" />}
            >
              Inspect Full Timeline & Evidence
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
