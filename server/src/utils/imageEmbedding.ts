import sharp from 'sharp';

/**
 * Image Feature Embedding Configuration & Thresholds
 * 
 * NOTE: This feature vector is an image-processing representation based on spatial luminance
 * and chromatic distribution histograms computed via Sharp. It is a deterministic, lightweight
 * image vector layer designed for explainable similarity comparison, NOT a multi-gigabyte deep neural network.
 */
export const IMAGE_EMBEDDING_THRESHOLDS = {
  HIGH_SIMILARITY_COSINE: 0.88,    // High visual content, color palette, and layout resemblance
  MODERATE_SIMILARITY_COSINE: 0.75, // Moderate visual resemblance across lighting or angle shifts
} as const;

export const EMBEDDING_DIMENSIONS = 32;

/**
 * Computes a normalized 32-dimensional feature vector from an image buffer.
 * 
 * Feature composition:
 * - Dimensions 0-15 (16 features): 4x4 spatial luminance grid (macro-structural spatial layout)
 * - Dimensions 16-23 (8 features): 8-bin chromatic warm/red ratio distribution
 * - Dimensions 24-31 (8 features): 8-bin chromatic cool/blue ratio distribution
 * 
 * Vector is L2-normalized: ||v||_2 = 1.0.
 * Returns null if the image buffer is corrupt or cannot be decoded.
 */
export async function computeImageEmbedding(buffer: Buffer): Promise<number[] | null> {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  try {
    // 1. Compute 4x4 spatial luminance grid (16 features)
    const { data: spatialData, info: spatialInfo } = await sharp(buffer)
      .resize(4, 4, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (spatialInfo.width !== 4 || spatialInfo.height !== 4 || spatialData.length < 16) {
      return null;
    }

    const spatialFeatures: number[] = [];
    for (let i = 0; i < 16; i++) {
      spatialFeatures.push(spatialData[i] / 255.0);
    }

    // 2. Compute 16x16 RGB representation to extract 16 chromatic histogram bins
    const { data: rgbData, info: rgbInfo } = await sharp(buffer)
      .resize(16, 16, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixelCount = rgbInfo.width * rgbInfo.height;
    if (pixelCount === 0 || rgbData.length < pixelCount * 3) {
      return null;
    }

    const warmBins = new Array(8).fill(0);
    const coolBins = new Array(8).fill(0);

    for (let i = 0; i < pixelCount; i++) {
      const r = rgbData[i * 3];
      const g = rgbData[i * 3 + 1];
      const b = rgbData[i * 3 + 2];
      const sum = r + g + b + 1; // avoid division by zero

      const rRatio = r / sum; // 0.0 to ~1.0
      const bRatio = b / sum; // 0.0 to ~1.0

      const warmIndex = Math.min(7, Math.floor(rRatio * 8));
      const coolIndex = Math.min(7, Math.floor(bRatio * 8));

      warmBins[warmIndex]++;
      coolBins[coolIndex]++;
    }

    // Normalize histogram bins by total pixels
    const chromaticFeatures: number[] = [
      ...warmBins.map((count) => count / pixelCount),
      ...coolBins.map((count) => count / pixelCount),
    ];

    // Combine into 32-dimensional raw feature vector
    const rawVector = [...spatialFeatures, ...chromaticFeatures];

    // 3. L2 normalize the vector
    let sumSquares = 0;
    for (let i = 0; i < rawVector.length; i++) {
      sumSquares += rawVector[i] * rawVector[i];
    }

    const magnitude = Math.sqrt(sumSquares);
    if (magnitude === 0) {
      return new Array(EMBEDDING_DIMENSIONS).fill(0);
    }

    const normalizedVector = rawVector.map((val) => Number((val / magnitude).toFixed(6)));
    return normalizedVector;
  } catch {
    // Corrupted buffer or unsupported sub-format handled gracefully
    return null;
  }
}

/**
 * Calculates cosine similarity between two normalized feature vectors.
 * Returns a number between 0.00 and 1.00 (rounded to 4 decimal places),
 * or null if either vector is missing or malformed.
 */
export function calculateCosineSimilarity(
  vecA?: number[] | null,
  vecB?: number[] | null
): number | null {
  if (!vecA || !vecB || !Array.isArray(vecA) || !Array.isArray(vecB)) {
    return null;
  }

  if (vecA.length !== EMBEDDING_DIMENSIONS || vecB.length !== EMBEDDING_DIMENSIONS) {
    return null;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const a = vecA[i];
    const b = vecB[i];
    if (typeof a !== 'number' || typeof b !== 'number' || isNaN(a) || isNaN(b)) {
      return null;
    }
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  const rawCosine = dotProduct / denominator;
  // Clamp between 0.0 and 1.0 for non-negative feature representations
  const clamped = Math.max(0, Math.min(1, rawCosine));
  return Number(clamped.toFixed(4));
}
