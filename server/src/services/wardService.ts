import fs from 'node:fs';
import path from 'node:path';

/**
 * Internal dataset identifier for the supplied 65-ward GeoJSON.
 * Note: Not an official government boundary version specification;
 * used strictly for internal provenance and boundary tracking.
 */
export const WARD_BOUNDARY_VERSION = 'mysuru-mcc-wards-65';

export type WardStatus = 'matched' | 'outside_boundary' | 'boundary_unavailable';

export interface WardLookupResult {
  wardId: number | null;
  wardName: string | null;
  wardNumber: string | null;
  wardCode: string | null;
  lgdWardCode: number | null;
  boundaryVersion: string;
  status: WardStatus;
}

export interface WardFeatureData {
  wardId: number;
  wardCode: string;
  wardName: string;
  wardNumber: string;
  lgdWardCode: number;
  coordinates: [number, number][]; // [longitude, latitude] in CRS84
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

interface WardsDataset {
  features: WardFeatureData[];
  totalWards: number;
  boundaryVersion: string;
}

let cachedDataset: WardsDataset | null = null;

/**
 * Distance squared from a point (px, py) to a line segment (x1, y1) - (x2, y2).
 */
function distToSegmentSquared(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

/**
 * Checks whether a point [lng, lat] is inside, on boundary, or outside a polygon ring.
 * - 'INSIDE': Point is strictly inside polygon ring.
 * - 'ON_BOUNDARY': Point lies directly on an edge or vertex (within epsilon tolerance).
 * - 'OUTSIDE': Point is strictly outside.
 */
function testPointInPolygonRing(
  lng: number,
  lat: number,
  ring: [number, number][]
): 'INSIDE' | 'ON_BOUNDARY' | 'OUTSIDE' {
  const epsSquared = 1e-14; // ~10cm threshold in geographical degrees
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    // Check if point lies on segment
    if (distToSegmentSquared(lng, lat, xi, yi, xj, yj) <= epsSquared) {
      return 'ON_BOUNDARY';
    }

    // Standard Jordan ray casting
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside ? 'INSIDE' : 'OUTSIDE';
}

/**
 * Loads and parses the Mysuru 65-ward GeoJSON safely.
 * Caches parsed polygon features and bounding boxes in memory.
 * Returns null if file is missing or invalid without crashing the server.
 */
export function loadWardsDataset(customPath?: string): WardsDataset | null {
  if (cachedDataset && !customPath) {
    return cachedDataset;
  }

  const defaultPath = path.resolve(process.cwd(), 'server', 'data', 'mysuru-wards.geojson');
  const fallbackPath = path.resolve(process.cwd(), 'data', 'mysuru-wards.geojson');
  const targetPath =
    customPath || (fs.existsSync(defaultPath) ? defaultPath : fallbackPath);

  try {
    if (!fs.existsSync(targetPath)) {
      console.warn(`[WardService] Mysuru ward GeoJSON not found at: ${targetPath}`);
      return null;
    }

    const raw = fs.readFileSync(targetPath, 'utf8');
    const parsed = JSON.parse(raw);

    if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
      console.error('[WardService] Invalid GeoJSON: Root is not a FeatureCollection.');
      return null;
    }

    const features: WardFeatureData[] = [];

    for (const feat of parsed.features) {
      if (!feat.geometry || feat.geometry.type !== 'Polygon') {
        console.warn('[WardService] Skipping non-polygon feature:', feat);
        continue;
      }

      const ring: [number, number][] = feat.geometry.coordinates?.[0];
      if (!Array.isArray(ring) || ring.length < 3) {
        console.warn('[WardService] Skipping polygon with invalid coordinates ring:', feat);
        continue;
      }

      const props = feat.properties || {};
      const wardId = Number(props.KGISWardID);
      const wardCode = String(props.KGISWardCode || '');
      const wardName = String(props.KGISWardName || '');
      const wardNumber = String(props.KGISWardNo || '');
      const lgdWardCode = Number(props.LGD_WardCode || 0);

      if (!wardId || !wardName || !wardNumber) {
        console.warn('[WardService] Feature missing essential KGIS properties:', props);
        continue;
      }

      // Compute bounding box [minLng, minLat, maxLng, maxLat] for fast rejection
      let minLng = Infinity;
      let minLat = Infinity;
      let maxLng = -Infinity;
      let maxLat = -Infinity;

      for (const pt of ring) {
        const pLng = pt[0];
        const pLat = pt[1];
        if (pLng < minLng) minLng = pLng;
        if (pLng > maxLng) maxLng = pLng;
        if (pLat < minLat) minLat = pLat;
        if (pLat > maxLat) maxLat = pLat;
      }

      features.push({
        wardId,
        wardCode,
        wardName,
        wardNumber,
        lgdWardCode,
        coordinates: ring,
        bbox: [minLng, minLat, maxLng, maxLat],
      });
    }

    // Sort features by wardNumber ascending for deterministic iteration & tie-breaking
    features.sort((a, b) => Number(a.wardNumber) - Number(b.wardNumber));

    const dataset: WardsDataset = {
      features,
      totalWards: features.length,
      boundaryVersion: WARD_BOUNDARY_VERSION,
    };

    if (!customPath) {
      cachedDataset = dataset;
    }

    return dataset;
  } catch (err) {
    console.error('[WardService] Failed to load/parse Mysuru wards GeoJSON:', err);
    return null;
  }
}

/**
 * Resets the in-memory cache (useful for testing).
 */
export function resetWardsCache(): void {
  cachedDataset = null;
}

/**
 * Resolves a GPS coordinate [latitude, longitude] to an authentic Mysuru Ward.
 * Coordinate handling:
 *   Input: latitude, longitude
 *   GeoJSON CRS84 Order: Point(longitude, latitude)
 * 
 * Performance:
 *   Fast bounding-box rejection followed by point-in-polygon testing across
 *   the 65 cached ward polygons.
 * 
 * Boundary handling:
 *   Points lying exactly on a boundary or shared edge between wards are resolved
 *   deterministically by selecting the lower numeric ward number.
 */
export function getWardForCoordinates(
  rawLat?: any,
  rawLng?: any
): WardLookupResult {
  // 1. Syntactic / Type validation
  if (rawLat === undefined || rawLat === null || rawLat === '' ||
      rawLng === undefined || rawLng === null || rawLng === '') {
    return {
      wardId: null,
      wardName: null,
      wardNumber: null,
      wardCode: null,
      lgdWardCode: null,
      boundaryVersion: WARD_BOUNDARY_VERSION,
      status: 'outside_boundary',
    };
  }

  const lat = typeof rawLat === 'string' ? Number(rawLat.trim()) : Number(rawLat);
  const lng = typeof rawLng === 'string' ? Number(rawLng.trim()) : Number(rawLng);

  if (!Number.isFinite(lat) || Number.isNaN(lat) || !Number.isFinite(lng) || Number.isNaN(lng)) {
    return {
      wardId: null,
      wardName: null,
      wardNumber: null,
      wardCode: null,
      lgdWardCode: null,
      boundaryVersion: WARD_BOUNDARY_VERSION,
      status: 'outside_boundary',
    };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      wardId: null,
      wardName: null,
      wardNumber: null,
      wardCode: null,
      lgdWardCode: null,
      boundaryVersion: WARD_BOUNDARY_VERSION,
      status: 'outside_boundary',
    };
  }

  // 2. Load cached dataset
  const dataset = loadWardsDataset();
  if (!dataset || dataset.features.length === 0) {
    return {
      wardId: null,
      wardName: null,
      wardNumber: null,
      wardCode: null,
      lgdWardCode: null,
      boundaryVersion: WARD_BOUNDARY_VERSION,
      status: 'boundary_unavailable',
    };
  }

  // 3. Point-in-polygon across 65 cached polygons (GeoJSON CRS84: [lng, lat])
  const boundaryMatches: WardFeatureData[] = [];

  for (const ward of dataset.features) {
    const [minLng, minLat, maxLng, maxLat] = ward.bbox;

    // Fast bounding-box rejection
    const margin = 1e-6;
    if (
      lng < minLng - margin ||
      lng > maxLng + margin ||
      lat < minLat - margin ||
      lat > maxLat + margin
    ) {
      continue;
    }

    const testRes = testPointInPolygonRing(lng, lat, ward.coordinates);

    if (testRes === 'INSIDE') {
      return {
        wardId: ward.wardId,
        wardName: ward.wardName,
        wardNumber: ward.wardNumber,
        wardCode: ward.wardCode,
        lgdWardCode: ward.lgdWardCode,
        boundaryVersion: dataset.boundaryVersion,
        status: 'matched',
      };
    }

    if (testRes === 'ON_BOUNDARY') {
      boundaryMatches.push(ward);
    }
  }

  // Deterministic boundary tie-breaker:
  // If point lies on one or more boundaries, pick the lowest wardNumber deterministically
  if (boundaryMatches.length > 0) {
    boundaryMatches.sort((a, b) => Number(a.wardNumber) - Number(b.wardNumber));
    const chosen = boundaryMatches[0];
    return {
      wardId: chosen.wardId,
      wardName: chosen.wardName,
      wardNumber: chosen.wardNumber,
      wardCode: chosen.wardCode,
      lgdWardCode: chosen.lgdWardCode,
      boundaryVersion: dataset.boundaryVersion,
      status: 'matched',
    };
  }

  // Point is outside all 65 polygons
  return {
    wardId: null,
    wardName: null,
    wardNumber: null,
    wardCode: null,
    lgdWardCode: null,
    boundaryVersion: dataset.boundaryVersion,
    status: 'outside_boundary',
  };
}

/**
 * Returns the raw GeoJSON text or parsed object for map delivery.
 */
export function getMysuruWardsGeoJson(): any | null {
  const defaultPath = path.resolve(process.cwd(), 'server', 'data', 'mysuru-wards.geojson');
  const fallbackPath = path.resolve(process.cwd(), 'data', 'mysuru-wards.geojson');
  const targetPath = fs.existsSync(defaultPath) ? defaultPath : fallbackPath;

  if (!fs.existsSync(targetPath)) return null;
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}
