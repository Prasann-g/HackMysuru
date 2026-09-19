import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  calculateHaversineDistanceMeters,
  isValidCoordinate,
  isNullIsland,
  isWithinMysuruServiceArea,
  MYSURU_SERVICE_BOUNDS,
  validateGeoEvidence,
  GEO_DISTANCE_THRESHOLDS,
} from '../src/utils/geoEvidenceValidator.js';
import { verifyComplaint } from '../src/services/verificationEngine.js';
import type { ComplaintInput } from '../src/types/verification.js';

describe('Phase 2 — Stage 2: GeoEvidenceValidator (Geo-Tagged Evidence Verification)', () => {
  // Helper to create test JPEG images with or without EXIF GPS
  const createTestImage = async (gps?: { lat: number; lon: number }): Promise<Buffer> => {
    let instance = sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    });

    if (gps) {
      const latDeg = Math.floor(Math.abs(gps.lat));
      const latMin = Math.floor((Math.abs(gps.lat) - latDeg) * 60);
      const latSec = Math.round(((Math.abs(gps.lat) - latDeg) * 60 - latMin) * 60);

      const lonDeg = Math.floor(Math.abs(gps.lon));
      const lonMin = Math.floor((Math.abs(gps.lon) - lonDeg) * 60);
      const lonSec = Math.round(((Math.abs(gps.lon) - lonDeg) * 60 - lonMin) * 60);

      instance = instance.withExif({
        IFD0: { Make: 'MysuruMobile', Model: 'CivicCam-X1' },
        IFD1: {},
        IFD2: { DateTimeOriginal: '2026:03:18 10:15:30' },
        IFD3: {
          GPSLatitudeRef: gps.lat >= 0 ? 'N' : 'S',
          GPSLatitude: `${latDeg}/1 ${latMin}/1 ${latSec}/1`,
          GPSLongitudeRef: gps.lon >= 0 ? 'E' : 'W',
          GPSLongitude: `${lonDeg}/1 ${lonMin}/1 ${lonSec}/1`,
        },
      });
    }

    return instance.jpeg().toBuffer();
  };

  describe('1. Haversine Distance & Coordinate Validation', () => {
    it('validates coordinates accurately within latitude [-90, 90] and longitude [-180, 180]', () => {
      expect(isValidCoordinate(12.305175, 76.655184)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);

      expect(isValidCoordinate(90.1, 76.6)).toBe(false);
      expect(isValidCoordinate(-90.1, 76.6)).toBe(false);
      expect(isValidCoordinate(12.3, 180.1)).toBe(false);
      expect(isValidCoordinate(12.3, -180.1)).toBe(false);
      expect(isValidCoordinate(NaN, 76.6)).toBe(false);
      expect(isValidCoordinate(undefined, 76.6)).toBe(false);
      expect(isValidCoordinate(Infinity, 76.6)).toBe(false);
      expect(isValidCoordinate(-Infinity, 76.6)).toBe(false);
      expect(isValidCoordinate('12.3' as any, 76.6)).toBe(false);
    });

    it('detects Null Island (0, 0) uninitialized GPS coordinates', () => {
      expect(isNullIsland(0, 0)).toBe(true);
      expect(isNullIsland(12.305175, 76.655184)).toBe(false);
      expect(isWithinMysuruServiceArea(0, 0)).toBe(false);
    });

    it('calculates zero distance for identical coordinates', () => {
      const dist = calculateHaversineDistanceMeters(12.305175, 76.655184, 12.305175, 76.655184);
      expect(dist).toBe(0);
    });

    it('calculates accurate distance between Mysore Palace and nearby locations', () => {
      // Mysore Palace (12.305175, 76.655184) to Mysore Zoo (12.3021, 76.6660) ~1.2 km
      const dist = calculateHaversineDistanceMeters(12.305175, 76.655184, 12.3021, 76.666);
      expect(dist).toBeGreaterThan(1000);
      expect(dist).toBeLessThan(1500);
    });

    it('returns NaN when coordinates are invalid', () => {
      expect(calculateHaversineDistanceMeters(100, 76.6, 12.3, 76.6)).toBeNaN();
    });

    it('validates whether coordinates lie within the Mysuru MCC municipal service area', () => {
      // Valid Mysuru locations
      expect(isWithinMysuruServiceArea(12.305175, 76.655184)).toBe(true); // Mysore Palace
      expect(isWithinMysuruServiceArea(12.2855, 76.6350)).toBe(true); // Kuvempunagar
      expect(isWithinMysuruServiceArea(12.3250, 76.6350)).toBe(true); // Gokulam

      // Out-of-jurisdiction locations
      expect(isWithinMysuruServiceArea(15.3647, 75.1240)).toBe(false); // Hubballi (~400km away)
      expect(isWithinMysuruServiceArea(12.9716, 77.5946)).toBe(false); // Bengaluru (~140km away)
      expect(isWithinMysuruServiceArea(28.6139, 77.2090)).toBe(false); // New Delhi
      expect(isWithinMysuruServiceArea(undefined, 76.65)).toBe(false);
      expect(isWithinMysuruServiceArea(12.30, NaN)).toBe(false);
      expect(isWithinMysuruServiceArea(0, 0)).toBe(false);
    });
  });

  describe('2. Image Presence Enforcement', () => {
    it('returns UNAVAILABLE and flags review when image is missing and imageRequired is true', async () => {
      const result = await validateGeoEvidence({
        hasImage: false,
        imageRequired: true,
      });

      expect(result.status).toBe('UNAVAILABLE');
      expect(result.imagePresent).toBe(false);
      expect(result.imageRequired).toBe(true);
      expect(result.reviewRequired).toBe(true);
      expect(result.signals.some((s) => s.includes('Photographic evidence is mandatory'))).toBe(true);
    });

    it('returns UNAVAILABLE without requiring review when imageRequired is false', async () => {
      const result = await validateGeoEvidence({
        hasImage: false,
        imageRequired: false,
      });

      expect(result.status).toBe('UNAVAILABLE');
      expect(result.imagePresent).toBe(false);
      expect(result.imageRequired).toBe(false);
      expect(result.reviewRequired).toBe(false);
      expect(result.signals.some((s) => s.includes('No photographic evidence was attached'))).toBe(true);
    });
  });

  describe('3. EXIF GPS Metadata Extraction & Location Correlation', () => {
    it('handles image without EXIF GPS metadata gracefully with explainable non-punitive advisory', async () => {
      const plainImage = await createTestImage(); // No EXIF
      const result = await validateGeoEvidence({
        hasImage: true,
        imageBuffer: plainImage,
        capturedLatitude: 12.305175,
        capturedLongitude: 76.655184,
      });

      expect(result.status).toBe('MISSING');
      expect(result.imagePresent).toBe(true);
      expect(result.exifGpsPresent).toBe(false);
      expect(result.reviewRequired).toBe(false);
      expect(result.signals.some((s) => s.includes('does not contain embedded GPS'))).toBe(true);
      expect(result.limitations.some((l) => l.includes('non-authoritative'))).toBe(true);
    });

    it('successfully validates matching EXIF GPS coordinates within 500m tolerance', async () => {
      // Photo taken at Mysore Palace (12.305175, 76.655184)
      const palaceCoords = { lat: 12.305175, lon: 76.655184 };
      const photoWithExif = await createTestImage(palaceCoords);

      // Reported complaint coordinates 120m away on Palace Road
      const result = await validateGeoEvidence({
        hasImage: true,
        imageBuffer: photoWithExif,
        capturedLatitude: 12.306000,
        capturedLongitude: 76.656000,
      });

      expect(result.status).toBe('VALID');
      expect(result.imagePresent).toBe(true);
      expect(result.exifGpsPresent).toBe(true);
      expect(result.reviewRequired).toBe(false);
      expect(result.distanceMeters).toBeDefined();
      expect(result.distanceMeters!).toBeLessThanOrEqual(GEO_DISTANCE_THRESHOLDS.CLOSE_MATCH_MAX_METERS);
      expect(result.signals.some((s) => s.includes('match reported complaint location'))).toBe(true);
    });

    it('detects MISMATCH and requires human review when EXIF GPS diverges > 1500m', async () => {
      // Photo taken at Mysore Palace (12.305175, 76.655184)
      const palaceCoords = { lat: 12.305175, lon: 76.655184 };
      const photoWithExif = await createTestImage(palaceCoords);

      // Reported complaint location is in Kuvempunagar (~3.8 km away)
      const result = await validateGeoEvidence({
        hasImage: true,
        imageBuffer: photoWithExif,
        capturedLatitude: 12.290500,
        capturedLongitude: 76.623400,
      });

      expect(result.status).toBe('MISMATCH');
      expect(result.imagePresent).toBe(true);
      expect(result.exifGpsPresent).toBe(true);
      expect(result.reviewRequired).toBe(true);
      expect(result.distanceMeters).toBeGreaterThan(GEO_DISTANCE_THRESHOLDS.ACCEPTABLE_DRIFT_MAX_METERS);
      expect(result.signals.some((s) => s.includes('exceeding the 1500m threshold'))).toBe(true);
    });

    it('marks VALID with informational signal when EXIF GPS is present but no complaint coordinates provided', async () => {
      const palaceCoords = { lat: 12.305175, lon: 76.655184 };
      const photoWithExif = await createTestImage(palaceCoords);

      const result = await validateGeoEvidence({
        hasImage: true,
        imageBuffer: photoWithExif,
        // No captured coordinates
      });

      expect(result.status).toBe('VALID');
      expect(result.exifGpsPresent).toBe(true);
      expect(result.reviewRequired).toBe(false);
      expect(result.distanceMeters).toBeUndefined();
      expect(result.signals.some((s) => s.includes('were not provided for distance verification'))).toBe(true);
    });

    it('handles corrupt image buffer without crashing and records safe output', async () => {
      const corruptBuffer = Buffer.from('NOT_AN_IMAGE_RANDOM_BYTES_DEADBEEF');
      const result = await validateGeoEvidence({
        hasImage: true,
        imageBuffer: corruptBuffer,
        capturedLatitude: 12.305175,
        capturedLongitude: 76.655184,
      });

      expect(result.imagePresent).toBe(true);
      expect(result.exifGpsPresent).toBe(false);
      expect(result.status).toBe('MISSING');
    });

    it('detects OUT_OF_BOUNDS and requires human review when captured GPS is from Hubballi even without EXIF GPS', async () => {
      const plainImage = await createTestImage(); // No EXIF
      const result = await validateGeoEvidence({
        hasImage: true,
        imageBuffer: plainImage,
        capturedLatitude: 15.3647, // Hubballi (~400km away)
        capturedLongitude: 75.1240,
      });

      expect(result.status).toBe('OUT_OF_BOUNDS');
      expect(result.withinServiceArea).toBe(false);
      expect(result.reviewRequired).toBe(true);
      expect(result.signals.some((s) => s.includes('OUT_OF_BOUNDS_LOCATION'))).toBe(true);
    });

    it('emits NULL_ISLAND_COORDINATES signal when uninitialized (0, 0) coordinates are supplied', async () => {
      const plainImage = await createTestImage();
      const result = await validateGeoEvidence({
        hasImage: true,
        imageBuffer: plainImage,
        capturedLatitude: 0,
        capturedLongitude: 0,
      });

      expect(result.withinServiceArea).toBe(false);
      expect(result.status).toBe('OUT_OF_BOUNDS');
      expect(result.signals.some((s) => s.includes('NULL_ISLAND_COORDINATES'))).toBe(true);
    });

    it('enforces that EXIF GPS is supplementary: generates MISMATCH without overriding captured GPS', async () => {
      // Photo has EXIF GPS from Hubballi (15.3647, 75.1240)
      const hubballiCoords = { lat: 15.3647, lon: 75.124 };
      const photoWithExif = await createTestImage(hubballiCoords);

      // Reported intake GPS is from Mysuru Palace (12.305175, 76.655184)
      const result = await validateGeoEvidence({
        hasImage: true,
        imageBuffer: photoWithExif,
        capturedLatitude: 12.305175,
        capturedLongitude: 76.655184,
      });

      // Status must be MISMATCH because distance is ~400km
      expect(result.status).toBe('MISMATCH');
      expect(result.reviewRequired).toBe(true);
      expect(result.distanceMeters).toBeGreaterThan(1500);

      // CRITICAL: capturedCoordinates are strictly preserved and withinServiceArea reflects intake GPS
      expect(result.capturedCoordinates?.latitude).toBe(12.305175);
      expect(result.capturedCoordinates?.longitude).toBe(76.655184);
      expect(result.withinServiceArea).toBe(true);
      expect(result.limitations.some((l) => l.includes('never overrides device GPS'))).toBe(true);
    });
  });

  describe('4. Verification Engine Integration', () => {
    it('sets INCOMPLETE_EVIDENCE when image is required but missing from verification input', () => {
      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Large road crater on Sayyaji Rao Road disrupting vehicular movement.',
        observedDate: '2026-03-18',
        locationArea: 'Mandi Mohalla',
        hasImage: false,
        geoEvidence: {
          imageRequired: true,
          imagePresent: false,
          exifGpsPresent: false,
          status: 'UNAVAILABLE',
          reviewRequired: true,
          signals: ['Photographic evidence is mandatory for complaint verification.'],
          limitations: ['EXIF GPS metadata is non-authoritative.'],
        },
      };

      const result = verifyComplaint(input, []);
      expect(result.outcome).toBe('INCOMPLETE_EVIDENCE');
      expect(result.recommendedAction).toContain('photographic evidence is mandatory');
      expect(result.signals.some((s) => s.includes('Photographic evidence is mandatory'))).toBe(true);
    });

    it('sets REQUIRES_HUMAN_REVIEW when geoEvidence status is MISMATCH', () => {
      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Large road crater on Sayyaji Rao Road disrupting vehicular movement.',
        observedDate: '2026-03-18',
        locationArea: 'Mandi Mohalla',
        hasImage: true,
        geoEvidence: {
          imageRequired: true,
          imagePresent: true,
          exifGpsPresent: true,
          exifCoordinates: { latitude: 12.305175, longitude: 76.655184 },
          capturedCoordinates: { latitude: 12.290500, longitude: 76.623400 },
          distanceMeters: 3820,
          status: 'MISMATCH',
          reviewRequired: true,
          signals: ['EXIF GPS coordinates diverge by 3820m from reported complaint coordinates.'],
          limitations: ['EXIF GPS metadata is non-authoritative.'],
        },
      };

      const result = verifyComplaint(input, []);
      expect(result.outcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(result.recommendedAction).toContain('diverges from reported complaint coordinates');
      expect(result.geoEvidence?.status).toBe('MISMATCH');
    });

    it('allows RECOMMENDED_VERIFIED when geoEvidence is VALID and all other checks pass', () => {
      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Large road crater on Sayyaji Rao Road disrupting vehicular movement.',
        observedDate: '2026-03-18',
        locationArea: 'Mandi Mohalla',
        hasImage: true,
        geoEvidence: {
          imageRequired: true,
          imagePresent: true,
          exifGpsPresent: true,
          exifCoordinates: { latitude: 12.305175, longitude: 76.655184 },
          capturedCoordinates: { latitude: 12.305200, longitude: 76.655200 },
          distanceMeters: 3,
          status: 'VALID',
          reviewRequired: false,
          signals: ['EXIF GPS coordinates match reported complaint location within 3m.'],
          limitations: ['EXIF GPS metadata is non-authoritative.'],
        },
      };

      const result = verifyComplaint(input, []);
      expect(result.outcome).toBe('RECOMMENDED_VERIFIED');
      expect(result.geoEvidence?.status).toBe('VALID');
    });

    it('sets REQUIRES_HUMAN_REVIEW when geoEvidence status is OUT_OF_BOUNDS', () => {
      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Large road crater on Sayyaji Rao Road disrupting vehicular movement.',
        observedDate: '2026-03-18',
        locationArea: 'Mandi Mohalla',
        hasImage: true,
        geoEvidence: {
          imageRequired: true,
          imagePresent: true,
          exifGpsPresent: false,
          capturedCoordinates: { latitude: 15.3647, longitude: 75.1240 },
          withinServiceArea: false,
          status: 'OUT_OF_BOUNDS',
          reviewRequired: true,
          signals: [
            'OUT_OF_BOUNDS_LOCATION: Application GPS coordinates lie outside the supported Mysuru municipal service area.',
          ],
          limitations: ['EXIF GPS metadata is non-authoritative.'],
        },
      };

      const result = verifyComplaint(input, []);
      expect(result.outcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(result.recommendedAction).toContain('outside the Mysuru municipal service area');
    });

    it('sets REQUIRES_HUMAN_REVIEW when evidence image is blurry', () => {
      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Large road crater on Sayyaji Rao Road disrupting vehicular movement.',
        observedDate: '2026-03-18',
        locationArea: 'Mandi Mohalla',
        latitude: 12.305175,
        longitude: 76.655184,
        hasImage: true,
        evidenceQuality: {
          isValidImage: true,
          mimeType: 'image/jpeg',
          fileSizeBytes: 50000,
          qualityScore: 75,
          sharpness: {
            laplacianVariance: 45.2,
            isBlurry: true,
            explanation: 'Edge variance is below threshold, indicating noticeable blur.',
          },
          brightness: { mean: 128, isSeverelyDark: false, isSeverelyOverexposed: false, explanation: 'Normal' },
          contrast: { stdev: 50, isBlankOrUniform: false, explanation: 'Normal' },
          metadata: { hasExif: false, hasGpsMetadata: false, gpsDisclaimer: 'No GPS' },
          signals: ['Low sharpness detected: blur.'],
          warnings: ['Photo appears blurred.'],
          uncertainties: [],
          limitations: [],
          recommendedReviewLevel: 'ADVISORY',
        },
      };

      const result = verifyComplaint(input, []);
      expect(result.outcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(result.recommendedAction).toContain('noticeable blur or focus degradation');
    });

    it('strictly prevents false RECOMMENDED_VERIFIED under user test conditions: Hubballi GPS + blurry image + missing EXIF', () => {
      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Dangerous pothole on Kuvempunagar main road causing traffic disruption.',
        observedDate: '2026-03-18',
        locationArea: 'Kuvempunagar',
        latitude: 15.3647, // Hubballi (~400km away)
        longitude: 75.1240,
        hasImage: true,
        evidenceQuality: {
          isValidImage: true,
          mimeType: 'image/jpeg',
          fileSizeBytes: 45000,
          qualityScore: 75,
          sharpness: {
            laplacianVariance: 38.0,
            isBlurry: true,
            explanation: 'Blur detected.',
          },
          brightness: { mean: 120, isSeverelyDark: false, isSeverelyOverexposed: false, explanation: 'Normal' },
          contrast: { stdev: 48, isBlankOrUniform: false, explanation: 'Normal' },
          metadata: { hasExif: false, hasGpsMetadata: false, gpsDisclaimer: 'No GPS' },
          signals: ['Low sharpness detected.'],
          warnings: ['Photo appears blurred.'],
          uncertainties: [],
          limitations: [],
          recommendedReviewLevel: 'ADVISORY',
        },
        geoEvidence: {
          imageRequired: true,
          imagePresent: true,
          exifGpsPresent: false,
          capturedCoordinates: { latitude: 15.3647, longitude: 75.1240 },
          withinServiceArea: false,
          status: 'OUT_OF_BOUNDS',
          reviewRequired: true,
          signals: [
            'OUT_OF_BOUNDS_LOCATION: Application GPS coordinates lie outside the supported Mysuru municipal service area.',
          ],
          limitations: ['EXIF GPS metadata is non-authoritative.'],
        },
      };

      const result = verifyComplaint(input, []);
      // STRICT REQUIREMENT: Must NEVER return RECOMMENDED_VERIFIED
      expect(result.outcome).not.toBe('RECOMMENDED_VERIFIED');
      expect(result.outcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(result.recommendedAction).toContain('outside the Mysuru municipal service area');
    });
  });
});
