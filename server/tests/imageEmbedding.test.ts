import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  computeImageEmbedding,
  calculateCosineSimilarity,
  IMAGE_EMBEDDING_THRESHOLDS,
  EMBEDDING_DIMENSIONS,
} from '../src/utils/imageEmbedding.js';

describe('Image Feature Embedding & Cosine Similarity Layer', () => {
  it('generates a normalized 32-dimensional feature vector for a valid JPEG image', async () => {
    const testImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 220, g: 80, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();

    const embedding = await computeImageEmbedding(testImage);
    expect(embedding).not.toBeNull();
    expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);

    // Assert L2 unit normalization: sum(v_i^2) ~= 1.0
    const sumSquares = embedding!.reduce((sum, val) => sum + val * val, 0);
    expect(Math.abs(sumSquares - 1.0)).toBeLessThan(0.01);
  });

  it('produces identical feature vectors for identical image buffers (deterministic)', async () => {
    const testImage = await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: { r: 30, g: 150, b: 210 },
      },
    })
      .png()
      .toBuffer();

    const embedding1 = await computeImageEmbedding(testImage);
    const embedding2 = await computeImageEmbedding(testImage);

    expect(embedding1).toEqual(embedding2);

    const cosineSim = calculateCosineSimilarity(embedding1, embedding2);
    expect(cosineSim).toBe(1.0);
  });

  it('maintains high cosine similarity (>= 0.88) across recompression and resizing', async () => {
    // Base image with spatial features and color
    const baseImage = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 3,
        background: { r: 45, g: 120, b: 190 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="120" height="120"><rect x="10" y="10" width="50" height="50" fill="yellow"/><circle cx="80" cy="80" r="30" fill="red"/></svg>'
          ),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    // Recompressed at 25% quality
    const recompressed = await sharp(baseImage).jpeg({ quality: 25 }).toBuffer();

    // Resized to 60x60
    const resized = await sharp(baseImage).resize(60, 60).jpeg().toBuffer();

    const baseEmbed = await computeImageEmbedding(baseImage);
    const recompEmbed = await computeImageEmbedding(recompressed);
    const resizedEmbed = await computeImageEmbedding(resized);

    expect(baseEmbed).not.toBeNull();
    expect(recompEmbed).not.toBeNull();
    expect(resizedEmbed).not.toBeNull();

    const recompSim = calculateCosineSimilarity(baseEmbed, recompEmbed);
    const resizedSim = calculateCosineSimilarity(baseEmbed, resizedEmbed);

    expect(recompSim).not.toBeNull();
    expect(recompSim!).toBeGreaterThanOrEqual(IMAGE_EMBEDDING_THRESHOLDS.HIGH_SIMILARITY_COSINE);

    expect(resizedSim).not.toBeNull();
    expect(resizedSim!).toBeGreaterThanOrEqual(IMAGE_EMBEDDING_THRESHOLDS.HIGH_SIMILARITY_COSINE);
  });

  it('yields distinctly lower similarity for visually distinct images', async () => {
    // Image 1: High blue background with small white rectangle
    const blueImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 10, g: 20, b: 220 },
      },
    })
      .jpeg()
      .toBuffer();

    // Image 2: High green background with red elements
    const greenRedImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 220, g: 10, b: 10 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="100" height="100"><rect x="0" y="0" width="100" height="100" fill="green"/></svg>'
          ),
          top: 0,
          left: 0,
        },
      ])
      .jpeg()
      .toBuffer();

    const embed1 = await computeImageEmbedding(blueImage);
    const embed2 = await computeImageEmbedding(greenRedImage);

    const sim = calculateCosineSimilarity(embed1, embed2);
    expect(sim).not.toBeNull();
    // Distant palettes and inverted spatial channels must not trigger high similarity
    expect(sim!).toBeLessThan(IMAGE_EMBEDDING_THRESHOLDS.HIGH_SIMILARITY_COSINE);
  });

  it('safely handles corrupted or invalid image buffers', async () => {
    const corruptBuffer = Buffer.from('NOT_AN_IMAGE_CORRUPTED_PAYLOAD_STRING');
    const embedding = await computeImageEmbedding(corruptBuffer);
    expect(embedding).toBeNull();

    const emptyBuffer = Buffer.alloc(0);
    const emptyEmbedding = await computeImageEmbedding(emptyBuffer);
    expect(emptyEmbedding).toBeNull();
  });

  it('safely handles null or malformed vector inputs in calculateCosineSimilarity', () => {
    expect(calculateCosineSimilarity(null, null)).toBeNull();
    expect(calculateCosineSimilarity([1, 2], [1, 2, 3])).toBeNull();
    expect(calculateCosineSimilarity(new Array(32).fill(0), new Array(32).fill(0))).toBe(0);
  });
});
