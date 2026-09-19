import sharp from 'sharp';
import { parseExifBuffer } from './evidenceQuality.js';
import type {
  GeoEvidenceResult,
  GeoEvidenceStatus,
  GeoCoordinates,
} from '../types/verification.js';

export const GEO_DISTANCE_THRESHOLDS = {
  CLOSE_MATCH_MAX_METERS: 500,
  ACCEPTABLE_DRIFT_MAX_METERS: 1500,
} as const;

/**
 * Mysuru Municipal / MCC Operational Service Area Bounding Box.
 * Latitude: 12.15° N to 12.45° N
 * Longitude: 76.50° E to 76.80° E
 */
export const MYSURU_SERVICE_BOUNDS = {
  MIN_LATITUDE: 12.15,
  MAX_LATITUDE: 12.45,
  MIN_LONGITUDE: 76.50,
  MAX_LONGITUDE: 76.80,
} as const;

/**
 * Validates whether latitude and longitude are within standard geographical ranges.
 */
export function isValidCoordinate(latitude?: number, longitude?: number): boolean {
  if (
    latitude === undefined ||
    longitude === undefined ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
    return false;
  }
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/**
 * Checks whether coordinates lie within the supported Mysuru municipal service area.
 */
export function isWithinMysuruServiceArea(latitude?: number, longitude?: number): boolean {
  if (!isValidCoordinate(latitude, longitude)) {
    return false;
  }
  return (
    latitude! >= MYSURU_SERVICE_BOUNDS.MIN_LATITUDE &&
    latitude! <= MYSURU_SERVICE_BOUNDS.MAX_LATITUDE &&
    longitude! >= MYSURU_SERVICE_BOUNDS.MIN_LONGITUDE &&
    longitude! <= MYSURU_SERVICE_BOUNDS.MAX_LONGITUDE
  );
}

/**
 * Calculates great-circle distance between two points using the Haversine formula.
 * Earth mean radius: 6,371,000 meters.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return NaN;
  }

  const R = 6371000; // Radius of the Earth in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export interface ValidateGeoEvidenceOptions {
  hasImage: boolean;
  imageBuffer?: Buffer;
  capturedLatitude?: number;
  capturedLongitude?: number;
  imageRequired?: boolean;
}

/**
 * Modular GeoEvidenceValidator
 * Inspects image EXIF GPS metadata, validates geographical boundaries,
 * and performs distance correlation against citizen-reported location coordinates.
 *
 * NOTE: Non-authoritative disclosure is strictly enforced. Missing EXIF does not indicate
 * dishonesty or fraud as social platforms and messaging apps regularly strip metadata.
 */
export async function validateGeoEvidence(
  options: ValidateGeoEvidenceOptions
): Promise<GeoEvidenceResult> {
  const {
    hasImage,
    imageBuffer,
    capturedLatitude,
    capturedLongitude,
    imageRequired = true,
  } = options;

  const signals: string[] = [];
  const limitations: string[] = [
    'EXIF GPS metadata is non-authoritative: camera coordinates can be stripped or modified by third-party messaging apps.',
    'Absence of EXIF GPS coordinates does not indicate fraud or inauthenticity.',
    'Distance calculation uses the spherical Haversine formula across great-circle coordinates.',
  ];

  let capturedCoordinates: GeoCoordinates | undefined;
  let withinServiceArea: boolean | undefined;
  if (isValidCoordinate(capturedLatitude, capturedLongitude)) {
    capturedCoordinates = {
      latitude: capturedLatitude!,
      longitude: capturedLongitude!,
    };
    withinServiceArea = isWithinMysuruServiceArea(capturedLatitude, capturedLongitude);
    if (!withinServiceArea) {
      signals.push(
        'OUT_OF_BOUNDS_LOCATION: Application GPS coordinates lie outside the supported Mysuru municipal service area.'
      );
    }
  }

  // 1. Missing Image Handling
  if (!hasImage || !imageBuffer) {
    if (imageRequired) {
      signals.push('Photographic evidence is mandatory for complaint verification.');
    } else {
      signals.push('No photographic evidence was attached to this complaint.');
    }

    return {
      imageRequired,
      imagePresent: false,
      exifGpsPresent: false,
      capturedCoordinates,
      withinServiceArea,
      status: 'UNAVAILABLE',
      reviewRequired: imageRequired,
      signals,
      limitations,
    };
  }

  // 2. Extract EXIF GPS Metadata safely
  let exifGpsLatitude: number | undefined;
  let exifGpsLongitude: number | undefined;
  let hasGpsMetadata = false;

  try {
    let exifBuf: Buffer | undefined;

    // Try Sharp metadata extraction first
    try {
      const meta = await sharp(imageBuffer).metadata();
      exifBuf = meta.exif;
    } catch {
      // If Sharp cannot process as standard image, fallback to raw buffer check
      exifBuf = undefined;
    }

    // Parse the EXIF buffer or fallback to raw buffer directly if it contains TIFF markers
    const parsedExif = parseExifBuffer(exifBuf || imageBuffer);

    if (parsedExif.hasGpsMetadata) {
      exifGpsLatitude = parsedExif.gpsLatitude;
      exifGpsLongitude = parsedExif.gpsLongitude;
      hasGpsMetadata = true;
    }
  } catch {
    hasGpsMetadata = false;
  }

  // 3. Case: EXIF GPS is Missing
  if (!hasGpsMetadata || exifGpsLatitude === undefined || exifGpsLongitude === undefined) {
    signals.push(
      'Image metadata does not contain embedded GPS coordinates (common for photos shared via messaging apps or privacy cameras).'
    );
    const isOutOfBounds = withinServiceArea === false;
    return {
      imageRequired,
      imagePresent: true,
      exifGpsPresent: false,
      capturedCoordinates,
      withinServiceArea,
      status: isOutOfBounds ? 'OUT_OF_BOUNDS' : 'MISSING',
      reviewRequired: isOutOfBounds,
      signals,
      limitations,
    };
  }

  // 4. Case: EXIF GPS is Out of Bounds or Malformed
  if (!isValidCoordinate(exifGpsLatitude, exifGpsLongitude)) {
    signals.push(
      `Embedded EXIF GPS metadata contains out-of-range or malformed coordinates (lat: ${exifGpsLatitude}, lon: ${exifGpsLongitude}).`
    );
    return {
      imageRequired,
      imagePresent: true,
      exifGpsPresent: true,
      capturedCoordinates,
      withinServiceArea,
      status: 'INVALID',
      reviewRequired: true,
      signals,
      limitations,
    };
  }

  const exifCoordinates: GeoCoordinates = {
    latitude: exifGpsLatitude,
    longitude: exifGpsLongitude,
  };

  // 5. Case: EXIF GPS present, but no captured complaint coordinates provided
  if (!capturedCoordinates) {
    signals.push(
      `EXIF GPS coordinates detected (${exifCoordinates.latitude.toFixed(5)}, ${exifCoordinates.longitude.toFixed(5)}). Complaint location coordinates were not provided for distance verification.`
    );
    return {
      imageRequired,
      imagePresent: true,
      exifGpsPresent: true,
      exifCoordinates,
      withinServiceArea,
      status: 'VALID',
      reviewRequired: false,
      signals,
      limitations,
    };
  }

  // 6. Case: Compare EXIF GPS against Captured Complaint GPS
  const distanceMeters = calculateHaversineDistanceMeters(
    exifCoordinates.latitude,
    exifCoordinates.longitude,
    capturedCoordinates.latitude,
    capturedCoordinates.longitude
  );

  if (distanceMeters > GEO_DISTANCE_THRESHOLDS.ACCEPTABLE_DRIFT_MAX_METERS) {
    signals.push(
      `EXIF GPS coordinates (${exifCoordinates.latitude.toFixed(5)}, ${exifCoordinates.longitude.toFixed(5)}) diverge by ${distanceMeters}m from reported complaint coordinates (${capturedCoordinates.latitude.toFixed(5)}, ${capturedCoordinates.longitude.toFixed(5)}), exceeding the ${GEO_DISTANCE_THRESHOLDS.ACCEPTABLE_DRIFT_MAX_METERS}m threshold.`
    );
    return {
      imageRequired,
      imagePresent: true,
      exifGpsPresent: true,
      exifCoordinates,
      capturedCoordinates,
      distanceMeters,
      withinServiceArea,
      status: 'MISMATCH',
      reviewRequired: true,
      signals,
      limitations,
    };
  }

  if (distanceMeters > GEO_DISTANCE_THRESHOLDS.CLOSE_MATCH_MAX_METERS) {
    signals.push(
      `EXIF GPS coordinates correlate with reported location within ${distanceMeters}m (acceptable urban tolerance).`
    );
  } else {
    signals.push(
      `EXIF GPS coordinates match reported complaint location within ${distanceMeters}m.`
    );
  }

  const isOutOfBounds = withinServiceArea === false;
  return {
    imageRequired,
    imagePresent: true,
    exifGpsPresent: true,
    exifCoordinates,
    capturedCoordinates,
    distanceMeters,
    withinServiceArea,
    status: isOutOfBounds ? 'OUT_OF_BOUNDS' : 'VALID',
    reviewRequired: isOutOfBounds,
    signals,
    limitations,
  };
}
