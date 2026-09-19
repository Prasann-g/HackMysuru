import { DEFAULT_SLA_HOURS_BY_CATEGORY } from '../../utils/slaBenchmarks.js';
import type { IssueCategory } from '../../types/verification.js';

export const PROTOTYPE_SLA_DISCLAIMER =
  'Prototype monitoring target - not an official government SLA.';

/**
 * Operational SLA targets by issue category (Reusing the main project's slaBenchmarks.ts values)
 * NOTE: These are monitoring heuristics for demonstration and triage support only.
 * They do NOT represent officially gazetted Mysuru City Corporation service delivery deadlines.
 */
export const PROTOTYPE_SLA_TARGET_HOURS: Record<IssueCategory, number> = DEFAULT_SLA_HOURS_BY_CATEGORY;

/** Default target hours if category is unlisted or custom */
export const DEFAULT_PROTOTYPE_SLA_HOURS = 72;

/**
 * Hours before SLA breach where a complaint is marked as DUE_SOON
 */
export const DUE_SOON_THRESHOLD_HOURS = 12;

/**
 * Threshold of hours without recorded meaningful activity before
 * an inactivity indicator is triggered.
 */
export const INACTIVITY_THRESHOLD_HOURS = 48;
