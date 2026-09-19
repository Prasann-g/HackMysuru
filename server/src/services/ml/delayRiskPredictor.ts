import type { ComplaintRecord } from '../../types/complaint.js';
import { calculateSlaMetrics, type SlaStatus } from '../../utils/slaBenchmarks.js';

export type DelayRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BREACHED';

export interface DelayRiskPredictionInput {
  complaint: ComplaintRecord;
  now?: Date;
}

export interface DelayRiskPredictionResult {
  riskLevel: DelayRiskLevel;
  riskScore: number; // 0 to 100
  slaTargetHours: number;
  elapsedHours: number;
  remainingHours: number;
  slaStatus: SlaStatus;
  contributingFactors: string[];
  recommendedAction: string;
  limitations: string[];
  modelVersion: string;
  isRealMl: boolean;
}

export interface IDelayRiskPredictor {
  readonly name: string;
  readonly isTrained: boolean;
  predict(input: DelayRiskPredictionInput): DelayRiskPredictionResult;
}

/**
 * Heuristic Delay Risk Predictor (Active Default Engine)
 * 
 * Synthesizes explainable risk metrics based on:
 * 1. SLA consumption ratio
 * 2. Unassigned / triage inactivity
 * 3. Verification friction (blurry photo, duplicate cluster, discrepancy)
 * 4. Civil works defect complexity
 */
export class HeuristicDelayRiskPredictor implements IDelayRiskPredictor {
  public readonly name = 'HeuristicDelayRiskPredictor-v1.0';
  public readonly isTrained = false;

  public predict(input: DelayRiskPredictionInput): DelayRiskPredictionResult {
    const { complaint, now = new Date() } = input;
    const sla = calculateSlaMetrics(complaint.category, complaint.createdAt, now);

    const contributingFactors: string[] = [];
    const limitations: string[] = [
      'Delay-risk indicators are computed using an explainable multi-factor heuristic model based on operational SLA consumption and verification friction.',
      'Supervised machine learning model is not currently trained due to insufficient historical resolution data in the repository (Rule 3 anti-hallucination compliance).',
      'SLA targets are default operational benchmarks rather than statutory MCC commitments.',
    ];

    // Completed complaints have zero remaining delay risk
    if (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') {
      return {
        riskLevel: 'LOW',
        riskScore: 0,
        slaTargetHours: sla.slaTargetHours,
        elapsedHours: sla.elapsedHours,
        remainingHours: 0,
        slaStatus: sla.status === 'BREACHED' ? 'BREACHED' : 'ON_TRACK',
        contributingFactors: [`Grievance has concluded lifecycle with status ${complaint.status}.`],
        recommendedAction: 'No action required: complaint lifecycle completed.',
        limitations,
        modelVersion: this.name,
        isRealMl: false,
      };
    }

    // Explicit Breach Handling
    if (sla.status === 'BREACHED') {
      const breachHours = Math.round((sla.elapsedHours - sla.slaTargetHours) * 10) / 10;
      contributingFactors.push(
        `Operational SLA benchmark exceeded by ${breachHours} hours (${sla.elapsedHours}h elapsed vs ${sla.slaTargetHours}h target).`
      );

      if (!complaint.assignedOfficerId) {
        contributingFactors.push('Grievance remains unassigned to a ward officer despite SLA breach.');
      }

      return {
        riskLevel: 'BREACHED',
        riskScore: 100,
        slaTargetHours: sla.slaTargetHours,
        elapsedHours: sla.elapsedHours,
        remainingHours: 0,
        slaStatus: 'BREACHED',
        contributingFactors,
        recommendedAction:
          'Immediate supervisor escalation: municipal turnaround window exceeded. Expedite immediate field dispatch and status update.',
        limitations,
        modelVersion: this.name,
        isRealMl: false,
      };
    }

    // Active in-flight risk scoring (0 to 100)
    let score = 0;

    // 1. Base score from SLA consumption (up to 50 points)
    const slaPoints = Math.round((sla.elapsedHours / sla.slaTargetHours) * 50);
    score += slaPoints;
    if (sla.status === 'AT_RISK') {
      contributingFactors.push(
        `Over 75% of operational SLA window elapsed (${sla.elapsedHours}h of ${sla.slaTargetHours}h).`
      );
    }

    // 2. Unassigned / Triage Inactivity Penalty (up to 25 points)
    if (!complaint.assignedOfficerId) {
      if (sla.elapsedHours >= sla.slaTargetHours * 0.5) {
        score += 25;
        contributingFactors.push(
          'Awaiting officer assignment with more than 50% of SLA duration consumed.'
        );
      } else if (sla.elapsedHours >= sla.slaTargetHours * 0.25) {
        score += 15;
        contributingFactors.push('Unassigned to a specific ward engineer or field officer.');
      } else {
        score += 5;
      }
    }

    // 3. Status Pipeline Inactivity (up to 15 points)
    if (complaint.status === 'SUBMITTED' && sla.elapsedHours >= 12) {
      score += 10;
      contributingFactors.push('Remains in initial SUBMITTED state without preliminary review.');
    } else if (complaint.status === 'NEEDS_CLARIFICATION') {
      score += 15;
      contributingFactors.push('Citizen clarification pending: progress blocked awaiting additional details.');
    }

    // 4. Verification & Evidence Friction (up to 20 points)
    const ver = complaint.verificationResult;
    if (ver) {
      if (ver.outcome === 'REQUIRES_HUMAN_REVIEW') {
        score += 10;
        contributingFactors.push('Evidence requires manual officer review before field assignment.');
      } else if (ver.outcome === 'INCOMPLETE_EVIDENCE' || ver.outcome === 'INCONSISTENT_EVIDENCE') {
        score += 15;
        contributingFactors.push(`Verification flagged ${ver.outcome.toLowerCase().replace(/_/g, ' ')}.`);
      }

      if (ver.duplicateRisk === 'HIGH') {
        score += 10;
        contributingFactors.push('High duplicate similarity: requires cluster deduplication review.');
      }

      if (ver.evidenceQuality?.sharpness.isBlurry) {
        score += 5;
        contributingFactors.push('Photographic evidence exhibits noticeable blur, impeding defect assessment.');
      }

      if (ver.geoEvidence?.status === 'MISMATCH') {
        score += 10;
        contributingFactors.push('Geographical mismatch detected between photo EXIF GPS and reported location.');
      }

      if (ver.temporalEvidence?.status === 'FUTURE_DATED' || ver.temporalEvidence?.status === 'DISCREPANCY') {
        score += 10;
        contributingFactors.push('Temporal timestamp anomaly detected on submitted evidence.');
      }
    }

    // 5. Category Complexity Adjustment (up to 5 points)
    if (complaint.category === 'construction_debris' || complaint.category === 'pothole') {
      score += 5;
      contributingFactors.push('Civil infrastructure works: defect requires equipment or contractor logistics.');
    }

    // Clamp score
    const finalScore = Math.min(99, Math.max(5, score));

    // Determine Risk Level
    let riskLevel: DelayRiskLevel = 'LOW';
    if (finalScore >= 70 || sla.status === 'AT_RISK') {
      riskLevel = 'HIGH';
    } else if (finalScore >= 40) {
      riskLevel = 'MEDIUM';
    }

    if (contributingFactors.length === 0) {
      contributingFactors.push('Grievance is progressing within normal operational time parameters.');
    }

    // Generate Recommended Action
    let recommendedAction = 'Proceed with standard department workflow.';
    if (riskLevel === 'HIGH') {
      recommendedAction =
        'Priority triage recommended: assign ward engineer promptly and dispatch work crew before SLA breach.';
    } else if (riskLevel === 'MEDIUM') {
      recommendedAction =
        'Monitor progress: verify preliminary report and ensure field assignment within next operational shift.';
    }

    return {
      riskLevel,
      riskScore: finalScore,
      slaTargetHours: sla.slaTargetHours,
      elapsedHours: sla.elapsedHours,
      remainingHours: sla.remainingHours,
      slaStatus: sla.status,
      contributingFactors,
      recommendedAction,
      limitations,
      modelVersion: this.name,
      isRealMl: false,
    };
  }
}

/**
 * Supervised ML Delay Risk Predictor (Future Extensible Stub)
 * 
 * Strict Constraint: This class explicitly declares isTrained = false.
 * It will NOT pretend to have learned weights or fabricated accuracy metrics.
 */
export class SupervisedMLDelayRiskPredictor implements IDelayRiskPredictor {
  public readonly name = 'SupervisedMLDelayRiskPredictor-Stub';
  public readonly isTrained = false;

  public predict(_input: DelayRiskPredictionInput): DelayRiskPredictionResult {
    throw new Error(
      'SupervisedMLDelayRiskPredictor is not trained: insufficient historical resolution records (N=0 resolved complaints in database). Use HeuristicDelayRiskPredictor.'
    );
  }
}
