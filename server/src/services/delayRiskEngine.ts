import type { ComplaintRecord } from '../types/complaint.js';
import {
  HeuristicDelayRiskPredictor,
  type IDelayRiskPredictor,
  type DelayRiskPredictionResult,
} from './ml/delayRiskPredictor.js';

let activePredictor: IDelayRiskPredictor = new HeuristicDelayRiskPredictor();

/**
 * Assesses the delay risk and SLA status for a live complaint record.
 */
export function assessDelayRisk(
  complaint: ComplaintRecord,
  now: Date = new Date()
): DelayRiskPredictionResult {
  return activePredictor.predict({ complaint, now });
}

/**
 * Returns the currently active delay-risk predictor instance.
 */
export function getActivePredictor(): IDelayRiskPredictor {
  return activePredictor;
}

/**
 * Allows swapping the predictor (useful for testing or future ML model activation).
 */
export function setActivePredictor(predictor: IDelayRiskPredictor): void {
  activePredictor = predictor;
}

/**
 * Resets the active predictor back to the default Heuristic predictor.
 */
export function resetActivePredictor(): void {
  activePredictor = new HeuristicDelayRiskPredictor();
}
