import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  calculateSlaMetrics,
  DEFAULT_SLA_HOURS_BY_CATEGORY,
} from '../src/utils/slaBenchmarks.js';
import { extractDelayRiskFeatures } from '../src/services/ml/featureExtractor.js';
import {
  HeuristicDelayRiskPredictor,
  SupervisedMLDelayRiskPredictor,
} from '../src/services/ml/delayRiskPredictor.js';
import {
  assessDelayRisk,
  setActivePredictor,
  resetActivePredictor,
} from '../src/services/delayRiskEngine.js';
import type { ComplaintRecord } from '../src/types/complaint.js';
import type { IssueCategory } from '../src/types/verification.js';

describe('ML-2: Delay-Risk Prediction & SLA Architecture', () => {
  const baseComplaint: ComplaintRecord = {
    id: 'MCC-2026-TEST-001',
    trackingToken: 'TRK-TEST-001',
    citizenId: 'USR-CITIZEN-001',
    category: 'pothole',
    description: 'Hazardous deep asphalt road depression causing vehicular skidding.',
    observedDate: '2026-09-18',
    locationArea: 'Kuvempunagar',
    hasImage: true,
    status: 'SUBMITTED',
    isDemo: false,
    createdAt: '2026-09-18T10:00:00.000Z',
    updatedAt: '2026-09-18T10:00:00.000Z',
  };

  describe('1. Municipal SLA Benchmarks & Calculations', () => {
    it('defines transparent default SLA targets for all 7 complaint categories', () => {
      const categories: IssueCategory[] = [
        'garbage_dumping',
        'overflowing_bin',
        'broken_streetlight',
        'unsegregated_waste',
        'pothole',
        'construction_debris',
        'other',
      ];

      for (const cat of categories) {
        expect(DEFAULT_SLA_HOURS_BY_CATEGORY[cat]).toBeGreaterThan(0);
      }
      expect(DEFAULT_SLA_HOURS_BY_CATEGORY.garbage_dumping).toBe(24);
      expect(DEFAULT_SLA_HOURS_BY_CATEGORY.broken_streetlight).toBe(48);
      expect(DEFAULT_SLA_HOURS_BY_CATEGORY.pothole).toBe(72);
      expect(DEFAULT_SLA_HOURS_BY_CATEGORY.construction_debris).toBe(120);
    });

    it('calculates ON_TRACK status when elapsed time is under 75% of SLA target', () => {
      const createdAt = new Date('2026-09-18T10:00:00.000Z');
      // 10 hours elapsed on a 72h pothole target (~13.8%)
      const now = new Date('2026-09-18T20:00:00.000Z');

      const metrics = calculateSlaMetrics('pothole', createdAt, now);
      expect(metrics.slaTargetHours).toBe(72);
      expect(metrics.elapsedHours).toBe(10);
      expect(metrics.remainingHours).toBe(62);
      expect(metrics.slaProgressPercent).toBe(14);
      expect(metrics.status).toBe('ON_TRACK');
      expect(metrics.standardResolutionWindow).toBe('72 hours');
    });

    it('calculates AT_RISK status when elapsed time is between 75% and 100% of SLA target', () => {
      const createdAt = new Date('2026-09-18T10:00:00.000Z');
      // 58 hours elapsed on a 72h pothole target (~80.5%)
      const now = new Date('2026-09-20T20:00:00.000Z');

      const metrics = calculateSlaMetrics('pothole', createdAt, now);
      expect(metrics.slaTargetHours).toBe(72);
      expect(metrics.elapsedHours).toBe(58);
      expect(metrics.remainingHours).toBe(14);
      expect(metrics.slaProgressPercent).toBe(81);
      expect(metrics.status).toBe('AT_RISK');
    });

    it('calculates BREACHED status when elapsed time meets or exceeds 100% of SLA target', () => {
      const createdAt = new Date('2026-09-18T10:00:00.000Z');
      // 80 hours elapsed on a 72h pothole target
      const now = new Date('2026-09-21T18:00:00.000Z');

      const metrics = calculateSlaMetrics('pothole', createdAt, now);
      expect(metrics.slaTargetHours).toBe(72);
      expect(metrics.elapsedHours).toBe(80);
      expect(metrics.remainingHours).toBe(0);
      expect(metrics.slaProgressPercent).toBe(100);
      expect(metrics.status).toBe('BREACHED');
    });

    it('handles zero or negative elapsed boundary cleanly', () => {
      const createdAt = new Date('2026-09-18T10:00:00.000Z');
      const metrics = calculateSlaMetrics('pothole', createdAt, createdAt);

      expect(metrics.elapsedHours).toBe(0);
      expect(metrics.remainingHours).toBe(72);
      expect(metrics.slaProgressPercent).toBe(0);
      expect(metrics.status).toBe('ON_TRACK');
    });
  });

  describe('2. ML-Ready Feature Extractor', () => {
    it('extracts real schema features without inventing unavailable attributes', () => {
      const complaintWithVerification: ComplaintRecord = {
        ...baseComplaint,
        latitude: 12.2958,
        longitude: 76.6394,
        assignedOfficerId: 'USR-OFFICER-48',
        assignedDepartment: 'MCC Engineering Division',
        verificationResult: {
          outcome: 'REQUIRES_HUMAN_REVIEW',
          duplicateRisk: 'MEDIUM',
          matches: [],
          signals: ['Visual pothole resemblance'],
          uncertainties: [],
          limitations: [],
          evidenceQuality: {
            isValidImage: true,
            qualityScore: 65,
            sharpness: { laplacianVariance: 80, isBlurry: true, explanation: 'Noticeable motion blur' },
            brightness: { meanLuminance: 120, isSeverelyDark: false, isSeverelyOverexposed: false, explanation: 'Normal' },
            contrast: { standardDeviation: 45, isBlankOrUniform: false, explanation: 'Normal' },
            metadata: { hasExif: true, hasGpsMetadata: false, gpsDisclaimer: 'None' },
            signals: [],
            warnings: [],
            uncertainties: [],
            limitations: [],
            recommendedReviewLevel: 'ADVISORY',
          },
          geoEvidence: {
            imageRequired: true,
            imagePresent: true,
            exifGpsPresent: false,
            status: 'VALID',
            reviewRequired: false,
            signals: [],
            limitations: [],
          },
          temporalEvidence: {
            status: 'FUTURE_DATED',
            hasTimestamp: true,
            reviewRequired: true,
            signals: ['Future timestamp detected'],
          },
        },
      };

      const now = new Date('2026-09-18T22:00:00.000Z'); // 12 hours later (Friday)
      const features = extractDelayRiskFeatures(complaintWithVerification, now);

      expect(features.complaintId).toBe('MCC-2026-TEST-001');
      expect(features.category).toBe('pothole');
      expect(features.status).toBe('SUBMITTED');
      expect(features.isAssigned).toBe(1);
      expect(features.hasImage).toBe(1);
      expect(features.hasCoordinates).toBe(1);
      expect(features.verificationOutcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(features.duplicateRiskLevel).toBe('MEDIUM');
      expect(features.isImageBlurry).toBe(1);
      expect(features.evidenceQualityScore).toBe(65);
      expect(features.hasGeoMismatch).toBe(0);
      expect(features.hasTemporalAnomaly).toBe(1);
      expect(features.slaTargetHours).toBe(72);
      expect(features.elapsedHours).toBe(12);
      expect(features.remainingHours).toBe(60);
      expect(features.slaConsumptionRatio).toBeCloseTo(0.167, 2);
    });
  });

  describe('3. Heuristic Delay Risk Predictor', () => {
    const predictor = new HeuristicDelayRiskPredictor();

    it('evaluates freshly submitted unassigned complaint as LOW risk with normal progression', () => {
      const now = new Date('2026-09-18T12:00:00.000Z'); // 2 hours elapsed
      const result = predictor.predict({ complaint: baseComplaint, now });

      expect(result.riskLevel).toBe('LOW');
      expect(result.riskScore).toBeLessThan(40);
      expect(result.slaStatus).toBe('ON_TRACK');
      expect(result.isRealMl).toBe(false);
      expect(result.contributingFactors.length).toBeGreaterThan(0);
      expect(result.limitations.some((l) => l.includes('explainable multi-factor heuristic'))).toBe(true);
    });

    it('evaluates unassigned complaint with triage friction as MEDIUM or HIGH risk', () => {
      const complaintWithFriction: ComplaintRecord = {
        ...baseComplaint,
        // Still unassigned after 24 hours (1/3 of SLA)
        verificationResult: {
          outcome: 'REQUIRES_HUMAN_REVIEW',
          duplicateRisk: 'HIGH',
          matches: [],
          signals: ['Possible duplicate'],
          uncertainties: [],
          limitations: [],
        },
      };

      const now = new Date('2026-09-19T10:00:00.000Z'); // 24 hours elapsed
      const result = predictor.predict({ complaint: complaintWithFriction, now });

      expect(['MEDIUM', 'HIGH']).toContain(result.riskLevel);
      expect(result.riskScore).toBeGreaterThanOrEqual(40);
      expect(result.contributingFactors.some((f) => f.includes('Unassigned'))).toBe(true);
      expect(result.contributingFactors.some((f) => f.includes('duplicate'))).toBe(true);
      if (result.riskLevel === 'HIGH') {
        expect(result.recommendedAction).toContain('Priority triage recommended');
      } else {
        expect(result.recommendedAction).toContain('Monitor progress');
      }
    });

    it('evaluates complaint exceeding 75% SLA as HIGH risk', () => {
      const nearBreachComplaint: ComplaintRecord = {
        ...baseComplaint,
        assignedOfficerId: 'USR-OFFICER-48',
        status: 'IN_PROGRESS',
      };

      const now = new Date('2026-09-20T21:00:00.000Z'); // 59 hours elapsed on 72h target (>75%)
      const result = predictor.predict({ complaint: nearBreachComplaint, now });

      expect(result.riskLevel).toBe('HIGH');
      expect(result.slaStatus).toBe('AT_RISK');
      expect(result.contributingFactors.some((f) => f.includes('Over 75% of operational SLA'))).toBe(true);
    });

    it('evaluates complaint exceeding 100% SLA as BREACHED with maximum score', () => {
      const breachedComplaint: ComplaintRecord = {
        ...baseComplaint,
        assignedOfficerId: 'USR-OFFICER-48',
        status: 'IN_PROGRESS',
      };

      const now = new Date('2026-09-21T18:00:00.000Z'); // 80 hours elapsed on 72h target
      const result = predictor.predict({ complaint: breachedComplaint, now });

      expect(result.riskLevel).toBe('BREACHED');
      expect(result.riskScore).toBe(100);
      expect(result.slaStatus).toBe('BREACHED');
      expect(result.remainingHours).toBe(0);
      expect(result.contributingFactors.some((f) => f.includes('SLA benchmark exceeded'))).toBe(true);
      expect(result.recommendedAction).toContain('Immediate supervisor escalation');
    });

    it('evaluates resolved complaint with LOW risk and concluded lifecycle', () => {
      const resolvedComplaint: ComplaintRecord = {
        ...baseComplaint,
        status: 'RESOLVED',
        resolvedAt: '2026-09-19T14:00:00.000Z',
      };

      const now = new Date('2026-09-20T10:00:00.000Z');
      const result = predictor.predict({ complaint: resolvedComplaint, now });

      expect(result.riskLevel).toBe('LOW');
      expect(result.riskScore).toBe(0);
      expect(result.remainingHours).toBe(0);
      expect(result.contributingFactors.some((f) => f.includes('concluded lifecycle'))).toBe(true);
    });
  });

  describe('4. Supervised ML Predictor Stub (Anti-Hallucination Compliance)', () => {
    it('explicitly reports isTrained = false and refuses to pretend to be trained', () => {
      const mlStub = new SupervisedMLDelayRiskPredictor();
      expect(mlStub.isTrained).toBe(false);
      expect(mlStub.name).toContain('SupervisedMLDelayRiskPredictor');

      expect(() => {
        mlStub.predict({ complaint: baseComplaint });
      }).toThrowError(/insufficient historical resolution records/);
    });
  });

  describe('5. Delay-Risk Engine Service Facade', () => {
    beforeEach(() => {
      resetActivePredictor();
    });

    afterEach(() => {
      resetActivePredictor();
    });

    it('assesses delay risk using the active default predictor', () => {
      const now = new Date('2026-09-18T14:00:00.000Z');
      const assessment = assessDelayRisk(baseComplaint, now);

      expect(assessment).toBeDefined();
      expect(assessment.riskLevel).toBe('LOW');
      expect(assessment.slaTargetHours).toBe(72);
      expect(assessment.elapsedHours).toBe(4);
    });

    it('supports dependency injection for testing and future model swaps', () => {
      const mockPredictor = {
        name: 'MockPredictor',
        isTrained: false,
        predict: () => ({
          riskLevel: 'HIGH' as const,
          riskScore: 88,
          slaTargetHours: 72,
          elapsedHours: 50,
          remainingHours: 22,
          slaStatus: 'AT_RISK' as const,
          contributingFactors: ['Mock factor'],
          recommendedAction: 'Mock action',
          limitations: ['Mock limitation'],
          modelVersion: 'Mock-v1',
          isRealMl: false,
        }),
      };

      setActivePredictor(mockPredictor);
      const assessment = assessDelayRisk(baseComplaint);
      expect(assessment.riskScore).toBe(88);
      expect(assessment.riskLevel).toBe('HIGH');
    });
  });
});
