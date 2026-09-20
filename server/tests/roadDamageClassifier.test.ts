import { describe, it, expect } from 'vitest';
import {
  classifyRoadDamage,
  isRoadDamageModelLoaded,
  getClassifierName,
  type VisualClassificationResult,
} from '../src/services/ml/roadDamageClassifier.js';
import { verifyComplaint } from '../src/services/verificationEngine.js';
import type { ComplaintInput } from '../src/types/verification.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal valid 1×1 JPEG buffer for testing. */
function minimalJpegBuffer(): Buffer {
  // Smallest valid JPEG (1x1 white pixel, no EXIF)
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4,
    0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7,
    0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca,
    0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3,
    0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5,
    0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00,
    0x00, 0x3f, 0x00, 0xfb, 0x37, 0xff, 0xd9,
  ]);
}

/** Creates a minimal ComplaintInput for verification engine tests. */
function makeComplaintInput(
  overrides: Partial<ComplaintInput> = {}
): ComplaintInput {
  return {
    category: 'pothole',
    description: 'Large pothole near the junction causing hazard to two-wheelers',
    observedDate: '2026-09-01',
    locationArea: 'Kuvempunagar',
    latitude: 12.3051,
    longitude: 76.6551,
    hasImage: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite 1 — Classifier: MODEL_NOT_AVAILABLE state
// ---------------------------------------------------------------------------

describe('Road-Damage Classifier — MODEL_NOT_AVAILABLE state', () => {
  it('returns MODEL_NOT_AVAILABLE status for a valid image buffer', async () => {
    const buffer = minimalJpegBuffer();
    const result = await classifyRoadDamage(buffer);

    expect(result.status).toBe('MODEL_NOT_AVAILABLE');
  });

  it('does not return a predictedClass when model is not available', async () => {
    const buffer = minimalJpegBuffer();
    const result = await classifyRoadDamage(buffer);

    expect(result.predictedClass).toBeUndefined();
  });

  it('sets isRealMl to false when model is not available', async () => {
    const buffer = minimalJpegBuffer();
    const result = await classifyRoadDamage(buffer);

    expect(result.isRealMl).toBe(false);
  });

  it('returns a non-empty explanation string', async () => {
    const buffer = minimalJpegBuffer();
    const result = await classifyRoadDamage(buffer);

    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(10);
  });

  it('returns at least one limitation describing training status', async () => {
    const buffer = minimalJpegBuffer();
    const result = await classifyRoadDamage(buffer);

    expect(Array.isArray(result.limitations)).toBe(true);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it('explanation does not contain a confidence score or percentage', async () => {
    const buffer = minimalJpegBuffer();
    const result = await classifyRoadDamage(buffer);

    // Must never claim a confidence level or accuracy metric when model unavailable
    expect(result.explanation).not.toMatch(/\d+%/);
    expect(result.explanation).not.toMatch(/confidence/i);
    expect(result.explanation).not.toMatch(/accuracy/i);
  });

  it('returns MODEL_NOT_AVAILABLE for an empty buffer', async () => {
    const result = await classifyRoadDamage(Buffer.alloc(0));

    // Must not throw; must return a safe fallback result
    expect(result.status).toBe('MODEL_NOT_AVAILABLE');
    expect(result.isRealMl).toBe(false);
  });

  it('returns MODEL_NOT_AVAILABLE for a non-image binary buffer', async () => {
    const buffer = Buffer.from('this is not an image', 'utf8');
    const result = await classifyRoadDamage(buffer);

    expect(result.status).toBe('MODEL_NOT_AVAILABLE');
  });

  it('returns signals as an empty array when model is unavailable', async () => {
    const buffer = minimalJpegBuffer();
    const result = await classifyRoadDamage(buffer);

    // No fake signal content should be produced when no model is loaded
    expect(Array.isArray(result.signals)).toBe(true);
    expect(result.signals).toHaveLength(0);
  });

  it('includes a classifierVersion string', async () => {
    const buffer = minimalJpegBuffer();
    const result = await classifyRoadDamage(buffer);

    expect(typeof result.classifierVersion).toBe('string');
    expect(result.classifierVersion.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Classifier: Utility functions
// ---------------------------------------------------------------------------

describe('Road-Damage Classifier — Utility functions', () => {
  it('isRoadDamageModelLoaded returns false when stub is active', () => {
    expect(isRoadDamageModelLoaded()).toBe(false);
  });

  it('getClassifierName returns a non-empty string', () => {
    const name = getClassifierName();
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('getClassifierName does not claim a trained or production model', () => {
    const name = getClassifierName();
    // Should not imply training has occurred
    expect(name.toLowerCase()).not.toContain('trained');
    expect(name.toLowerCase()).not.toContain('production');
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Verification Engine: visualClassification pass-through
// ---------------------------------------------------------------------------

describe('Verification Engine — visualClassification pass-through (Phase 2E)', () => {
  it('includes visualClassification in result when provided in input', () => {
    const mockClassification: VisualClassificationResult = {
      status: 'MODEL_NOT_AVAILABLE',
      explanation: 'No model loaded.',
      signals: [],
      limitations: ['No model trained.'],
      classifierVersion: 'NotAvailableClassifier-v1.0',
      isRealMl: false,
    };

    const input = makeComplaintInput({ visualClassification: mockClassification });
    const result = verifyComplaint(input, []);

    expect(result.visualClassification).toBeDefined();
    expect(result.visualClassification?.status).toBe('MODEL_NOT_AVAILABLE');
    expect(result.visualClassification?.isRealMl).toBe(false);
  });

  it('visualClassification is undefined in result when not provided in input', () => {
    const input = makeComplaintInput();
    const result = verifyComplaint(input, []);

    // No classifier result means the field should be absent
    expect(result.visualClassification).toBeUndefined();
  });

  it('does not modify any other verification result field when visualClassification is present', () => {
    const mockClassification: VisualClassificationResult = {
      status: 'MODEL_NOT_AVAILABLE',
      explanation: 'No model loaded.',
      signals: [],
      limitations: [],
      classifierVersion: 'NotAvailableClassifier-v1.0',
      isRealMl: false,
    };

    const input = makeComplaintInput({ visualClassification: mockClassification });
    const result = verifyComplaint(input, []);

    // Core verification fields must remain unaffected
    expect(result.outcome).toBeDefined();
    expect(result.duplicateRisk).toBeDefined();
    expect(result.processedAt).toBeDefined();
    expect(typeof result.recommendedAction).toBe('string');
    expect(Array.isArray(result.signals)).toBe(true);
    expect(Array.isArray(result.limitations)).toBe(true);
  });

  it('passes visualClassification with CLASSIFIED status through correctly', () => {
    const mockClassification: VisualClassificationResult = {
      status: 'CLASSIFIED',
      predictedClass: 'pothole',
      explanation: 'Pothole detected.',
      signals: ['D40 pattern confidence above threshold'],
      limitations: ['Assistive signal only — physical inspection required.'],
      classifierVersion: 'MockClassifier-v1.0',
      isRealMl: true,
    };

    const input = makeComplaintInput({ visualClassification: mockClassification });
    const result = verifyComplaint(input, []);

    expect(result.visualClassification?.status).toBe('CLASSIFIED');
    expect(result.visualClassification?.predictedClass).toBe('pothole');
    expect(result.visualClassification?.isRealMl).toBe(true);
  });

  it('passes visualClassification with INFERENCE_ERROR status through correctly', () => {
    const mockClassification: VisualClassificationResult = {
      status: 'INFERENCE_ERROR',
      explanation: 'Model threw an internal error.',
      signals: [],
      limitations: ['Officer site inspection required.'],
      classifierVersion: 'TestClassifier-v1.0',
      isRealMl: false,
    };

    const input = makeComplaintInput({ visualClassification: mockClassification });
    const result = verifyComplaint(input, []);

    expect(result.visualClassification?.status).toBe('INFERENCE_ERROR');
    expect(result.visualClassification?.predictedClass).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — End-to-end: classifier is safe and non-throwing
// ---------------------------------------------------------------------------

describe('Road-Damage Classifier — Non-blocking safety guarantee', () => {
  it('classifyRoadDamage never throws for any buffer input', async () => {
    const inputs = [
      Buffer.alloc(0),
      Buffer.from('not an image'),
      minimalJpegBuffer(),
      Buffer.alloc(100, 0xff),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG magic bytes only
    ];

    for (const buf of inputs) {
      let result: VisualClassificationResult;
      // Must never throw
      await expect(async () => {
        result = await classifyRoadDamage(buf);
      }).not.toThrow();

      // Must always return a result with a valid status
      result = await classifyRoadDamage(buf);
      expect(['MODEL_NOT_AVAILABLE', 'CLASSIFIED', 'INFERENCE_ERROR', 'IMAGE_UNREADABLE']).toContain(
        result.status
      );
    }
  });

  it('classifyRoadDamage result always has isRealMl as boolean', async () => {
    const result = await classifyRoadDamage(minimalJpegBuffer());
    expect(typeof result.isRealMl).toBe('boolean');
  });

  it('classifyRoadDamage result always has limitations as array', async () => {
    const result = await classifyRoadDamage(minimalJpegBuffer());
    expect(Array.isArray(result.limitations)).toBe(true);
  });
});
