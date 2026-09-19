import type { ComplaintRecord } from '../../types/complaint.js';
import { calculateSlaMetrics } from '../../utils/slaBenchmarks.js';

export interface DelayRiskFeatureVector {
  // Categorical identifiers
  complaintId: string;
  category: string;
  status: string;
  locationArea: string;
  department: string;

  // Numerical & Boolean real schema indicators
  isAssigned: number;             // 1 if assignedOfficerId is present, 0 otherwise
  hasImage: number;                // 1 if hasImage is true, 0 otherwise
  hasCoordinates: number;          // 1 if latitude & longitude are present
  
  // Verification signals
  verificationOutcome: string;     // 'RECOMMENDED_VERIFIED' | 'REQUIRES_HUMAN_REVIEW' | 'INCONSISTENT_EVIDENCE' | 'INCOMPLETE_EVIDENCE' | 'POSSIBLE_DUPLICATE' | 'UNKNOWN'
  duplicateRiskLevel: string;      // 'LOW' | 'MEDIUM' | 'HIGH'
  isImageBlurry: number;           // 1 if evidenceQuality.sharpness.isBlurry, 0 otherwise
  evidenceQualityScore: number;    // 0-100 or -1 if unavailable
  hasGeoMismatch: number;          // 1 if geoEvidence.status === 'MISMATCH', 0 otherwise
  hasTemporalAnomaly: number;      // 1 if temporalEvidence status is FUTURE_DATED, DISCREPANCY, or INVALID, 0 otherwise
  
  // Temporal & Cadence features
  submissionDayOfWeek: number;     // 0 (Sunday) to 6 (Saturday)
  submissionHourOfDay: number;     // 0 to 23
  isWeekendSubmission: number;     // 1 if Sunday or Saturday, 0 otherwise

  // SLA Time Consumption features
  slaTargetHours: number;
  elapsedHours: number;
  remainingHours: number;
  slaConsumptionRatio: number;     // elapsedHours / slaTargetHours
}

/**
 * Extracts a normalized, ML-ready feature vector from a live ComplaintRecord.
 * 
 * Strict Constraint: Operates ONLY on actual schema fields. Invented features, 
 * simulated historical attributes, or hallucinated variables are strictly forbidden.
 */
export function extractDelayRiskFeatures(
  complaint: ComplaintRecord,
  now: Date = new Date()
): DelayRiskFeatureVector {
  const slaMetrics = calculateSlaMetrics(complaint.category, complaint.createdAt, now);
  const createdDate = new Date(complaint.createdAt);
  const validCreated = !isNaN(createdDate.getTime()) ? createdDate : now;

  const dayOfWeek = validCreated.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
  const hourOfDay = validCreated.getHours();

  const ver = complaint.verificationResult;
  const eq = ver?.evidenceQuality;
  const geo = ver?.geoEvidence;
  const temp = ver?.temporalEvidence;

  const hasTemporalAnomaly =
    temp && (temp.status === 'FUTURE_DATED' || temp.status === 'DISCREPANCY' || temp.status === 'INVALID' || temp.status === 'EXCESSIVE_AGE')
      ? 1
      : 0;

  return {
    complaintId: complaint.id,
    category: complaint.category,
    status: complaint.status,
    locationArea: complaint.locationArea || 'UNKNOWN',
    department: complaint.assignedDepartment || 'UNASSIGNED',

    isAssigned: complaint.assignedOfficerId ? 1 : 0,
    hasImage: complaint.hasImage ? 1 : 0,
    hasCoordinates: complaint.latitude !== undefined && complaint.longitude !== undefined ? 1 : 0,

    verificationOutcome: ver?.outcome || 'UNKNOWN',
    duplicateRiskLevel: ver?.duplicateRisk || 'LOW',
    isImageBlurry: eq?.sharpness.isBlurry ? 1 : 0,
    evidenceQualityScore: eq?.qualityScore ?? -1,
    hasGeoMismatch: geo?.status === 'MISMATCH' || geo?.status === 'OUT_OF_BOUNDS' ? 1 : 0,
    hasTemporalAnomaly,

    submissionDayOfWeek: dayOfWeek,
    submissionHourOfDay: hourOfDay,
    isWeekendSubmission: isWeekend,

    slaTargetHours: slaMetrics.slaTargetHours,
    elapsedHours: slaMetrics.elapsedHours,
    remainingHours: slaMetrics.remainingHours,
    slaConsumptionRatio:
      slaMetrics.slaTargetHours > 0
        ? Math.round((slaMetrics.elapsedHours / slaMetrics.slaTargetHours) * 1000) / 1000
        : 0,
  };
}
