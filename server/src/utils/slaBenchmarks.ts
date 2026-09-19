import type { IssueCategory } from '../types/verification.js';

/**
 * Municipal Grievance SLA Operational Benchmarks
 * 
 * NOTE (Rule 3 Compliance): These values represent configurable default operational 
 * benchmarks for Mysore City Corporation (MCC) triage workflows. They do not constitute 
 * statutory Citizen's Charter commitments unless officially configured by the municipality.
 */
export const DEFAULT_SLA_HOURS_BY_CATEGORY: Record<IssueCategory, number> = {
  garbage_dumping: 24,       // Rapid public health and sanitation triage
  overflowing_bin: 24,       // Routine ward sanitation and collection
  broken_streetlight: 48,    // Public safety, electrical line and bulb repair
  unsegregated_waste: 48,    // Waste segregation compliance inspection
  pothole: 72,               // Asphalt patching, road safety and traffic repair
  construction_debris: 120,  // Heavy machinery clearance and transport
  other: 96,                 // General municipal grievance cell review
} as const;

export type SlaStatus = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

export interface SlaMetrics {
  slaTargetHours: number;
  elapsedHours: number;
  remainingHours: number;
  slaProgressPercent: number;
  status: SlaStatus;
  standardResolutionWindow: string;
}

/**
 * Calculates SLA consumption, remaining hours, and SLA status for a complaint.
 * 
 * - ON_TRACK: Elapsed < 75% of target
 * - AT_RISK:  Elapsed >= 75% and < 100% of target
 * - BREACHED: Elapsed >= 100% of target
 */
export function calculateSlaMetrics(
  category: IssueCategory,
  createdAt: string | Date,
  now: Date = new Date(),
  customSlaHours?: number
): SlaMetrics {
  const targetHours = customSlaHours && customSlaHours > 0
    ? customSlaHours
    : (DEFAULT_SLA_HOURS_BY_CATEGORY[category] || 72);

  const createdDate = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const validCreated = !isNaN(createdDate.getTime()) ? createdDate : now;

  const diffMs = Math.max(0, now.getTime() - validCreated.getTime());
  const rawElapsedHours = diffMs / (1000 * 60 * 60);
  const elapsedHours = Math.round(rawElapsedHours * 10) / 10;

  const rawRemainingHours = Math.max(0, targetHours - rawElapsedHours);
  const remainingHours = Math.round(rawRemainingHours * 10) / 10;

  const slaProgressPercent = Math.min(
    100,
    Math.max(0, Math.round((rawElapsedHours / targetHours) * 100))
  );

  let status: SlaStatus = 'ON_TRACK';
  if (rawElapsedHours >= targetHours) {
    status = 'BREACHED';
  } else if (rawElapsedHours >= targetHours * 0.75) {
    status = 'AT_RISK';
  }

  return {
    slaTargetHours: targetHours,
    elapsedHours,
    remainingHours,
    slaProgressPercent,
    status,
    standardResolutionWindow: `${targetHours} hours`,
  };
}
