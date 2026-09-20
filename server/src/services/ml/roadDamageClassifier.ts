/**
 * Road Damage Classifier — Integration Hook
 *
 * STATUS: MODEL_NOT_AVAILABLE
 *
 * This module defines the interface, types, and a safe stub implementation for
 * automated road-damage visual classification in the CivicBridge verification
 * pipeline. It is designed to integrate with the CivicBridge-ML workspace once
 * a trained model artifact is available.
 *
 * Current state:
 *   No trained model exists. The active implementation (NotAvailableClassifier)
 *   always returns status: 'MODEL_NOT_AVAILABLE' without performing any inference.
 *   No fake confidence scores, damage labels, or accuracy claims are generated.
 *
 * How to connect a trained model in the future:
 *   1. Train a model in the CivicBridge-ML workspace (see ML_PROJECT_PLAN.md Phase 3+).
 *   2. Export the model artifact to a file (e.g. ONNX or TorchScript).
 *   3. Place the artifact at the path referenced by MODEL_ARTIFACT_PATH below.
 *   4. Implement OnnxRoadDamageClassifier (or equivalent) to load and run inference.
 *   5. Replace the active export at the bottom of this file with the new implementation.
 *   6. Run the full test suite to confirm backward-compatible fallback behavior.
 *
 * IMPORTANT: The classifier output must never be used as automatic proof of road damage.
 * It must always be presented as an assistive signal requiring officer review.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The visual damage class predicted by the classifier.
 * Defined by the CivicBridge-ML 3-class taxonomy.
 */
export type VisualDamageClass = 'pothole' | 'crack' | 'normal';

/**
 * The operational status of the classifier at inference time.
 *
 * - MODEL_NOT_AVAILABLE: No model artifact is loaded. No inference was attempted.
 * - CLASSIFIED:          Model ran and produced a class prediction.
 * - INFERENCE_ERROR:     Model loaded but threw an error during inference.
 * - IMAGE_UNREADABLE:    The image buffer could not be decoded for inference.
 */
export type VisualClassificationStatus =
  | 'MODEL_NOT_AVAILABLE'
  | 'CLASSIFIED'
  | 'INFERENCE_ERROR'
  | 'IMAGE_UNREADABLE';

/**
 * The result returned by the classifier for a single image buffer.
 */
export interface VisualClassificationResult {
  /** Operational status of this classification attempt. */
  status: VisualClassificationStatus;

  /**
   * Predicted damage class. Only present when status === 'CLASSIFIED'.
   * Never inferred or guessed when status is any other value.
   */
  predictedClass?: VisualDamageClass;

  /**
   * Human-readable explanation of what this result means and what
   * action, if any, is recommended based on this signal alone.
   */
  explanation: string;

  /**
   * Signals that contributed to or describe this result.
   * Empty when model is unavailable.
   */
  signals: string[];

  /**
   * Known limitations of this classification result.
   * Always populated — even for MODEL_NOT_AVAILABLE — for transparency.
   */
  limitations: string[];

  /** Name and version of the classifier that produced this result. */
  classifierVersion: string;

  /** Whether this result was produced by a real trained ML model. */
  isRealMl: boolean;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Interface for road-damage image classifiers.
 *
 * Any classifier implementation — whether a stub, heuristic, or trained model —
 * must implement this interface to be pluggable into the verification pipeline.
 */
export interface IRoadDamageClassifier {
  /** Human-readable classifier name and version. */
  readonly name: string;

  /**
   * Whether a trained model artifact is loaded and ready for inference.
   * Must be false for all stub and pre-training implementations.
   */
  readonly isModelLoaded: boolean;

  /**
   * Classify an image buffer for road damage.
   *
   * @param imageBuffer - Raw image bytes from the uploaded evidence file.
   * @returns A VisualClassificationResult with an honest status and explanation.
   */
  classify(imageBuffer: Buffer): Promise<VisualClassificationResult>;
}

// ---------------------------------------------------------------------------
// Stub implementation — MODEL_NOT_AVAILABLE
// ---------------------------------------------------------------------------

/**
 * NotAvailableClassifier
 *
 * Safe stub that satisfies the IRoadDamageClassifier interface while no
 * trained model artifact exists.
 *
 * Behavior contract:
 *   - Always returns status: 'MODEL_NOT_AVAILABLE'.
 *   - Never attempts inference.
 *   - Never generates a predictedClass value.
 *   - Never generates confidence scores or accuracy metrics.
 *   - Always documents limitations clearly.
 *
 * Replace this implementation only after a trained model is validated.
 */
class NotAvailableClassifier implements IRoadDamageClassifier {
  public readonly name = 'NotAvailableClassifier-v1.0';
  public readonly isModelLoaded = false;

  public async classify(_imageBuffer: Buffer): Promise<VisualClassificationResult> {
    return {
      status: 'MODEL_NOT_AVAILABLE',
      explanation:
        'Visual road-damage classification is not available. ' +
        'A trained model artifact has not been loaded. ' +
        'Officer should assess road damage severity through physical site inspection.',
      signals: [],
      limitations: [
        'No road-damage classification model is currently trained or loaded.',
        'The CivicBridge-ML workspace has completed feasibility analysis and dataset research. ' +
          'Model training is pending dataset licensing approval and training pipeline setup.',
        'Damage type and severity must be assessed through physical site inspection by Ward Field Engineers.',
        'This field will populate automatically once a validated model artifact is deployed.',
      ],
      classifierVersion: this.name,
      isRealMl: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Active singleton — swap this to enable a trained model
// ---------------------------------------------------------------------------

/**
 * The active road-damage classifier instance used by the verification pipeline.
 *
 * To replace with a trained model implementation:
 *   1. Implement a class satisfying IRoadDamageClassifier.
 *   2. Instantiate it below in place of NotAvailableClassifier.
 *   3. Update the classifierVersion string to reflect the model version.
 *   4. Set isModelLoaded = true only if the artifact loads successfully at startup.
 */
const activeClassifier: IRoadDamageClassifier = new NotAvailableClassifier();

/**
 * Classify an uploaded image buffer for road-damage type.
 *
 * This is the single entry point for the verification pipeline.
 * Safe to call unconditionally — returns MODEL_NOT_AVAILABLE if no model is loaded.
 *
 * @param imageBuffer - Raw image bytes from an uploaded complaint evidence file.
 * @returns VisualClassificationResult — always returns a non-throwing honest result.
 */
export async function classifyRoadDamage(
  imageBuffer: Buffer
): Promise<VisualClassificationResult> {
  try {
    return await activeClassifier.classify(imageBuffer);
  } catch (err) {
    // Safety net: if the classifier itself throws unexpectedly, return a safe
    // INFERENCE_ERROR result rather than propagating the error to the caller.
    return {
      status: 'INFERENCE_ERROR',
      explanation:
        'An unexpected error occurred during the classification attempt. ' +
        'Visual damage classification is unavailable for this submission.',
      signals: [],
      limitations: [
        'Classifier encountered an internal error.',
        'Damage type must be assessed through physical site inspection.',
      ],
      classifierVersion: activeClassifier.name,
      isRealMl: false,
    };
  }
}

/**
 * Returns true if a trained road-damage model is currently loaded and ready.
 * Use this to conditionally show classification UI in the officer panel.
 */
export function isRoadDamageModelLoaded(): boolean {
  return activeClassifier.isModelLoaded;
}

/**
 * Returns the name and version of the currently active classifier.
 * Used for display in officer-facing audit trails.
 */
export function getClassifierName(): string {
  return activeClassifier.name;
}
