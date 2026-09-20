import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistanceMeters,
  calculateTimeDelta,
  correlateDuplicateSignals,
} from '../src/utils/duplicateCorrelationEngine.js';
import { verifyComplaint } from '../src/services/verificationEngine.js';
import type { ExistingComplaint, ComplaintInput } from '../src/types/verification.js';

describe('Multi-Signal Image + GPS + Time Correlation Engine', () => {
  describe('1. Haversine Distance & Proximity Calculations', () => {
    it('calculates 0 meters for identical coordinates', () => {
      const dist = calculateHaversineDistanceMeters(12.315, 76.645, 12.315, 76.645);
      expect(dist).toBe(0);
    });

    it('accurately computes local street distance in Mysuru (~100m)', () => {
      // 0.0009 degree latitude in Mysuru is approx 100 meters
      const dist = calculateHaversineDistanceMeters(12.315, 76.645, 12.3159, 76.645);
      expect(dist).toBeGreaterThanOrEqual(95);
      expect(dist).toBeLessThanOrEqual(105);
    });

    it('accurately identifies cross-city distances (>4 km)', () => {
      // Gokulam (12.332, 76.635) to Chamundipuram (12.290, 76.655)
      const dist = calculateHaversineDistanceMeters(12.332, 76.635, 12.29, 76.655);
      expect(dist).not.toBeNull();
      expect(dist!).toBeGreaterThan(4500);
    });

    it('returns null gracefully when coordinates are undefined or non-finite', () => {
      expect(calculateHaversineDistanceMeters(undefined, 76.645, 12.315, 76.645)).toBeNull();
      expect(calculateHaversineDistanceMeters(12.315, NaN, 12.315, 76.645)).toBeNull();
    });
  });

  describe('2. Temporal Proximity Calculations', () => {
    it('calculates same-day diffHours and diffDays', () => {
      const delta = calculateTimeDelta('2026-03-15T10:00:00Z', '2026-03-15T14:30:00Z');
      expect(delta.diffHours).toBe(4.5);
      expect(delta.diffDays).toBeLessThanOrEqual(0.2);
    });

    it('calculates multi-day calendar difference', () => {
      const delta = calculateTimeDelta('2026-03-10', '2026-03-18');
      expect(delta.diffDays).toBe(8);
    });

    it('returns empty object when dates are malformed or missing', () => {
      expect(calculateTimeDelta(undefined, '2026-03-18')).toEqual({});
      expect(calculateTimeDelta('invalid-date', '2026-03-18')).toEqual({});
    });
  });

  describe('3. Multi-Signal Combined Correlation Rules', () => {
    const dummyEmbedding = new Array(32).fill(0.1767); // normalized vector

    it('flags HIGH_CONFIDENCE_DUPLICATE when visual resemblance, close proximity, and recent time align', () => {
      const input = {
        id: 'NEW-001',
        latitude: 12.315,
        longitude: 76.645,
        locationArea: 'Jayalakshmipuram',
        observedDate: '2026-03-15',
        imageSha256: 'abc123sha256hash',
        imagePhash: '0123456789abcdef',
        imageEmbedding: dummyEmbedding,
      };

      const candidate = {
        id: 'EXISTING-001',
        latitude: 12.3154, // ~45 meters away
        longitude: 76.645,
        locationArea: 'Jayalakshmipuram',
        observedDate: '2026-03-14', // 1 day apart
        createdAt: '2026-03-14T10:00:00Z',
        imageSha256: 'abc123sha256hash',
        imagePhash: '0123456789abcdef',
        imageEmbedding: dummyEmbedding,
      };

      const result = correlateDuplicateSignals(input, candidate);

      expect(result.confidenceLevel).toBe('HIGH_CONFIDENCE_DUPLICATE');
      expect(result.isPotentialDuplicate).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.8);
      expect(result.locationProximity.level).toBe('IMMEDIATE');
      expect(result.temporalProximity.level).toBe('SAME_DAY');
      expect(result.explanation).toContain('High confidence duplicate candidate');
    });

    it('ENFORCES LOCATION GUARDRAIL: A visually similar image from a DIFFERENT location (>1.5 km) is NEVER a high-confidence duplicate', () => {
      const input = {
        id: 'NEW-002',
        latitude: 12.335, // Gokulam area
        longitude: 76.635,
        locationArea: 'Gokulam',
        observedDate: '2026-03-15',
        imagePhash: '1122334455667788',
        imageEmbedding: dummyEmbedding,
      };

      const candidate = {
        id: 'EXISTING-002',
        latitude: 12.285, // Kuvempunagar area (~5.6 km away)
        longitude: 76.635,
        locationArea: 'Kuvempunagar',
        observedDate: '2026-03-15',
        imagePhash: '1122334455667788', // Identical dHash (same standard streetlight model or generic pothole)
        imageEmbedding: dummyEmbedding,
      };

      const result = correlateDuplicateSignals(input, candidate);

      // Must be classified as VISUALLY_SIMILAR_DIFFERENT_LOCATION, NOT duplicate!
      expect(result.confidenceLevel).toBe('VISUALLY_SIMILAR_DIFFERENT_LOCATION');
      expect(result.isPotentialDuplicate).toBe(false);
      expect(result.locationProximity.level).toBe('DISTANT');
      expect(result.locationProximity.distanceMeters).toBeGreaterThan(1500);
      expect(result.explanation).toContain('not classified as a duplicate');
      expect(result.explanation).toContain('separated by');
    });

    it('handles missing coordinates gracefully by falling back to text area matching', () => {
      const input = {
        id: 'NEW-003',
        locationArea: 'Vijayanagar 2nd Stage',
        observedDate: '2026-03-15',
        imagePhash: 'aabbccddeeff0011',
        imageEmbedding: dummyEmbedding,
      };

      const candidate = {
        id: 'EXISTING-003',
        locationArea: 'Vijayanagar 2nd Stage',
        observedDate: '2026-03-12',
        imagePhash: 'aabbccddeeff0011',
        imageEmbedding: dummyEmbedding,
      };

      const result = correlateDuplicateSignals(input, candidate);

      expect(result.locationProximity.sameAreaText).toBe(true);
      expect(result.locationProximity.distanceMeters).toBeUndefined();
      expect(result.locationProximity.level).toBe('SAME_WARD');
      expect(result.confidenceLevel).toBe('POTENTIAL_NEARBY_DUPLICATE');
      expect(result.isPotentialDuplicate).toBe(true);
    });
  });

  describe('4. Verification Engine End-to-End Integration', () => {
    it('populates duplicateCorrelation in verificationResult.matches for candidates', () => {
      const dummyEmbedding = new Array(32).fill(0.1767);

      const candidate: ExistingComplaint = {
        id: 'MCC-TEST-REF-01',
        category: 'pothole',
        description: 'Dangerous pothole near the post office corner causing traffic slowdown.',
        observedDate: '2026-03-14',
        locationArea: 'Saraswathipuram',
        status: 'SUBMITTED',
        latitude: 12.305,
        longitude: 76.635,
        createdAt: '2026-03-14T08:00:00Z',
        imagePhash: '123456789abcdef0',
        imageEmbedding: dummyEmbedding,
      };

      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Dangerous pothole near the post office corner on main road.',
        observedDate: '2026-03-15',
        locationArea: 'Saraswathipuram',
        latitude: 12.3053, // ~35 meters away
        longitude: 76.635,
        hasImage: true,
        imagePhash: '123456789abcdef0',
        imageEmbedding: dummyEmbedding,
      };

      const result = verifyComplaint(input, [candidate]);

      expect(result.matches.length).toBeGreaterThan(0);
      const match = result.matches[0];
      expect(match.existingComplaintId).toBe(candidate.id);
      expect(match.duplicateCorrelation).toBeDefined();

      const correlation = match.duplicateCorrelation!;
      expect(correlation.confidenceLevel).toBe('HIGH_CONFIDENCE_DUPLICATE');
      expect(correlation.visualResemblance.level).toBe('HIGH');
      expect(correlation.locationProximity.level).toBe('IMMEDIATE');
      expect(correlation.temporalProximity.level).toBe('SAME_DAY');

      // Signals should document the correlation
      expect(result.signals.some((s) => s.includes('HIGH_CONFIDENCE_CORRELATION'))).toBe(true);
    });

    it('records LOCATION_GUARDRAIL signal when similar image is from distant site (>1.5 km)', () => {
      const dummyEmbedding = new Array(32).fill(0.1767);

      const distantCandidate: ExistingComplaint = {
        id: 'MCC-TEST-DISTANT-01',
        category: 'broken_streetlight',
        description: 'Standard municipal sodium street light out of order on 3rd cross.',
        observedDate: '2026-03-15',
        locationArea: 'Hebbal',
        status: 'SUBMITTED',
        latitude: 12.355, // ~6 km away
        longitude: 76.615,
        createdAt: '2026-03-15T08:00:00Z',
        imagePhash: '9988776655443322',
        imageEmbedding: dummyEmbedding,
      };

      const input: ComplaintInput = {
        category: 'broken_streetlight',
        description: 'Street light out of order on main avenue.',
        observedDate: '2026-03-15',
        locationArea: 'Kuvempunagar',
        latitude: 12.295,
        longitude: 76.635,
        hasImage: true,
        imagePhash: '9988776655443322', // identical dHash
        imageEmbedding: dummyEmbedding,
      };

      const result = verifyComplaint(input, [distantCandidate]);

      expect(result.matches.length).toBeGreaterThan(0);
      const match = result.matches[0];
      expect(match.duplicateCorrelation).toBeDefined();
      expect(match.duplicateCorrelation!.confidenceLevel).toBe('VISUALLY_SIMILAR_DIFFERENT_LOCATION');
      expect(match.duplicateCorrelation!.isPotentialDuplicate).toBe(false);

      // Verify LOCATION_GUARDRAIL signal is documented
      expect(result.signals.some((s) => s.includes('LOCATION_GUARDRAIL'))).toBe(true);
    });
  });
});
