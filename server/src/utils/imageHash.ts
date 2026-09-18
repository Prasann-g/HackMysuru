import crypto from 'node:crypto';
import sharp from 'sharp';

export interface MagicBytesValidation {
  valid: boolean;
  detectedMime?: 'image/jpeg' | 'image/png' | 'image/webp';
  error?: string;
}

/**
 * Validates actual binary file headers (magic bytes) to ensure uploaded content
 * is authentically a JPEG, PNG, or WebP image, independent of file extension or client MIME.
 */
export function validateImageMagicBytes(buffer: Buffer): MagicBytesValidation {
  if (!buffer || buffer.length < 12) {
    return {
      valid: false,
      error: 'File buffer is too small to be a valid image.',
    };
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: 'image/png' };
  }

  // 3. WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { valid: true, detectedMime: 'image/webp' };
  }

  return {
    valid: false,
    error: 'File content does not match supported image formats (JPEG, PNG, WebP).',
  };
}

/**
 * Computes exact cryptographic SHA-256 checksum from raw image bytes.
 */
export function computeImageSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Difference Hash (dHash) implementation for perceptual image comparison.
 * Algorithm:
 * 1. Resizes image to 9 columns x 8 rows (72 pixels) in 8-bit grayscale.
 * 2. Compares adjacent horizontal pixels: if left > right, bit is 1, else 0.
 * 3. Produces 8 bits per row x 8 rows = 64-bit gradient hash represented as 16 hex chars.
 * 
 * NOTE: dHash is an image-processing heuristic measuring luminance gradients, NOT a trained ML model.
 * Limitations: Resilient to compression and uniform scaling; sensitive to heavy cropping,
 * 90° rotations, perspective distortion, or significant occlusions.
 * 
 * Returns 16-character hex string, or null if image decoding fails (corrupted buffer).
 */
export async function computeImageDHash(buffer: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.width !== 9 || info.height !== 8 || data.length < 72) {
      return null;
    }

    let binaryString = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = data[row * 9 + col];
        const right = data[row * 9 + col + 1];
        binaryString += left > right ? '1' : '0';
      }
    }

    let hex = '';
    for (let i = 0; i < 64; i += 4) {
      const nibble = binaryString.substring(i, i + 4);
      hex += parseInt(nibble, 2).toString(16);
    }
    return hex.padStart(16, '0');
  } catch {
    // Corrupted image data or unsupported sub-format handled gracefully
    return null;
  }
}

/**
 * Calculates bitwise Hamming distance between two 64-bit hex difference hashes.
 * Returns a number between 0 (identical gradients) and 64 (complete inverse),
 * or null if either hash is missing or invalid.
 */
export function calculateHammingDistance(
  hashA?: string | null,
  hashB?: string | null
): number | null {
  if (!hashA || !hashB || hashA.length !== 16 || hashB.length !== 16) {
    return null;
  }

  let distance = 0;
  for (let i = 0; i < 16; i++) {
    const valA = parseInt(hashA[i], 16);
    const valB = parseInt(hashB[i], 16);
    if (isNaN(valA) || isNaN(valB)) return null;

    let xor = valA ^ valB;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Configurable thresholds for difference hash comparison.
 */
export const DHASH_THRESHOLDS = {
  HIGH_SIMILARITY_MAX_DISTANCE: 5,     // Likely recompressed, resized, or near-identical image
  MODERATE_SIMILARITY_MAX_DISTANCE: 10, // Possible visually similar scene, needs review
};
