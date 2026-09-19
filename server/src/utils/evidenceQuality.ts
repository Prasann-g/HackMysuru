import sharp, { type Metadata } from 'sharp';
import { validateImageMagicBytes } from './imageHash.js';
import type { EvidenceQualityAnalysis } from '../types/verification.js';

export interface ExifParseResult {
  hasExif: boolean;
  cameraMake?: string;
  cameraModel?: string;
  software?: string;
  dateTimeOriginal?: string;
  hasGpsMetadata: boolean;
  gpsLatitude?: number;
  gpsLongitude?: number;
}

/**
 * Safe, bounded pure-TypeScript TIFF/EXIF parser.
 * Operates strictly with bounds checking to prevent buffer overruns on malformed metadata.
 */
export function parseExifBuffer(rawBuffer?: Buffer): ExifParseResult {
  const result: ExifParseResult = {
    hasExif: false,
    hasGpsMetadata: false,
  };

  if (!rawBuffer || rawBuffer.length < 14) {
    return result;
  }

  try {
    let tiffStart = 0;
    // Standard JPEG EXIF markers begin with 'Exif\0\0' (6 bytes)
    if (
      rawBuffer[0] === 0x45 &&
      rawBuffer[1] === 0x78 &&
      rawBuffer[2] === 0x69 &&
      rawBuffer[3] === 0x66 &&
      rawBuffer[4] === 0x00 &&
      rawBuffer[5] === 0x00
    ) {
      tiffStart = 6;
    }

    const tiff = rawBuffer.subarray(tiffStart);
    if (tiff.length < 8) return result;

    const isLE = tiff[0] === 0x49 && tiff[1] === 0x49; // 'II' (Little Endian)
    const isBE = tiff[0] === 0x4d && tiff[1] === 0x4d; // 'MM' (Big Endian)
    if (!isLE && !isBE) return result;

    result.hasExif = true;

    const readU16 = (o: number): number =>
      o + 2 <= tiff.length ? (isLE ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o)) : 0;
    const readU32 = (o: number): number =>
      o + 4 <= tiff.length ? (isLE ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o)) : 0;

    if (readU16(2) !== 42) return result;

    const firstIfdOffset = readU32(4);
    if (firstIfdOffset >= tiff.length || firstIfdOffset < 8) return result;

    const readString = (valOrOffset: number, count: number): string | undefined => {
      let strOffset = valOrOffset;
      if (count > 4) {
        if (valOrOffset + count > tiff.length) return undefined;
        strOffset = valOrOffset;
      }
      return tiff
        .subarray(strOffset, Math.min(strOffset + count, tiff.length))
        .toString('utf8')
        .replace(/\0.*$/g, '')
        .trim();
    };

    const readRational = (offset: number): number => {
      if (offset + 8 > tiff.length) return 0;
      const num = readU32(offset);
      const den = readU32(offset + 4);
      return den === 0 ? 0 : num / den;
    };

    let exifIfdOffset: number | undefined;
    let gpsIfdOffset: number | undefined;

    const parseIfd = (ifdOffset: number, isGps = false, isExifSub = false) => {
      if (ifdOffset + 2 > tiff.length) return;
      const numEntries = readU16(ifdOffset);
      let offset = ifdOffset + 2;

      let gpsLatRef = 'N';
      let gpsLatVals: number[] = [];
      let gpsLonRef = 'E';
      let gpsLonVals: number[] = [];

      // Limit iteration to prevent infinite loops on malformed structures
      const maxEntries = Math.min(numEntries, 100);
      for (let i = 0; i < maxEntries; i++) {
        if (offset + 12 > tiff.length) break;
        const tag = readU16(offset);
        const type = readU16(offset + 2);
        const count = readU32(offset + 4);
        const valOffset = readU32(offset + 8);

        if (!isGps && !isExifSub) {
          if (tag === 0x010f && type === 2) result.cameraMake = readString(valOffset, count);
          else if (tag === 0x0110 && type === 2) result.cameraModel = readString(valOffset, count);
          else if (tag === 0x0131 && type === 2) result.software = readString(valOffset, count);
          else if (tag === 0x8769 && type === 4) exifIfdOffset = valOffset;
          else if (tag === 0x8825 && type === 4) gpsIfdOffset = valOffset;
        } else if (isExifSub) {
          if ((tag === 0x9003 || tag === 0x9004) && type === 2) {
            result.dateTimeOriginal = readString(valOffset, count);
          }
        } else if (isGps) {
          if (tag === 0x0001 && type === 2) {
            gpsLatRef = tiff.subarray(offset + 8, offset + 9).toString('ascii').toUpperCase();
          } else if (tag === 0x0002 && type === 5 && count >= 3) {
            gpsLatVals = [
              readRational(valOffset),
              readRational(valOffset + 8),
              readRational(valOffset + 16),
            ];
          } else if (tag === 0x0003 && type === 2) {
            gpsLonRef = tiff.subarray(offset + 8, offset + 9).toString('ascii').toUpperCase();
          } else if (tag === 0x0004 && type === 5 && count >= 3) {
            gpsLonVals = [
              readRational(valOffset),
              readRational(valOffset + 8),
              readRational(valOffset + 16),
            ];
          }
        }

        offset += 12;
      }

      if (isGps && gpsLatVals.length === 3 && gpsLonVals.length === 3) {
        let lat = gpsLatVals[0] + gpsLatVals[1] / 60 + gpsLatVals[2] / 3600;
        let lon = gpsLonVals[0] + gpsLonVals[1] / 60 + gpsLonVals[2] / 3600;
        if (gpsLatRef === 'S') lat = -lat;
        if (gpsLonRef === 'W') lon = -lon;
        if (
          !isNaN(lat) &&
          !isNaN(lon) &&
          lat >= -90 &&
          lat <= 90 &&
          lon >= -180 &&
          lon <= 180
        ) {
          result.hasGpsMetadata = true;
          result.gpsLatitude = Math.round(lat * 1000000) / 1000000;
          result.gpsLongitude = Math.round(lon * 1000000) / 1000000;
        }
      }
    };

    parseIfd(firstIfdOffset);
    if (exifIfdOffset && exifIfdOffset < tiff.length && exifIfdOffset > 0) {
      parseIfd(exifIfdOffset, false, true);
    }
    if (gpsIfdOffset && gpsIfdOffset < tiff.length && gpsIfdOffset > 0) {
      parseIfd(gpsIfdOffset, true, false);
    }

    return result;
  } catch {
    return result;
  }
}

/**
 * 3x3 Discrete Laplacian convolution kernel for edge-energy variance estimation.
 */
const LAPLACIAN_KERNEL = {
  width: 3,
  height: 3,
  kernel: [
    0,  1, 0,
    1, -4, 1,
    0,  1, 0,
  ],
};

export const EVIDENCE_QUALITY_THRESHOLDS = {
  MIN_WIDTH: 64,
  MIN_HEIGHT: 64,
  MAX_DIMENSION: 12000,
  BLUR_LAPLACIAN_VARIANCE_MIN: 20.0,
  DARK_MEAN_BRIGHTNESS_MAX: 20.0,
  OVEREXPOSED_MEAN_BRIGHTNESS_MIN: 240.0,
  UNIFORM_CONTRAST_STDEV_MAX: 3.0,
};

/**
 * Evaluates uploaded photographic evidence for integrity, dimensions, sharpness, exposure,
 * and non-authoritative EXIF metadata.
 * 
 * DESIGN PRINCIPLE:
 * Evidence quality signals are decision-support heuristics, NOT definitive proof of fraud.
 * Missing EXIF or night-time lighting conditions must never automatically mark a complaint as fake.
 */
export async function analyzeEvidenceQuality(buffer: Buffer): Promise<EvidenceQualityAnalysis> {
  const signals: string[] = [];
  const warnings: string[] = [];
  const uncertainties: string[] = [];
  const limitations: string[] = [];

  const fileSizeBytes = buffer?.length || 0;

  // 1. Magic Bytes & Format Verification
  const magic = validateImageMagicBytes(buffer);
  if (!magic.valid) {
    return {
      isValidImage: false,
      fileSizeBytes,
      qualityScore: 0,
      sharpness: {
        laplacianVariance: 0,
        isBlurry: false,
        explanation: 'Image decoding unavailable: unrecognized file signature.',
      },
      brightness: {
        mean: 0,
        isSeverelyDark: false,
        isSeverelyOverexposed: false,
        explanation: 'Brightness calculation unavailable.',
      },
      contrast: {
        stdev: 0,
        isBlankOrUniform: false,
        explanation: 'Contrast calculation unavailable.',
      },
      metadata: {
        hasExif: false,
        hasGpsMetadata: false,
        gpsDisclaimer: 'No image metadata available.',
      },
      signals: ['INVALID_FILE_SIGNATURE: Uploaded binary content does not match JPEG, PNG, or WebP magic bytes.'],
      warnings: ['Uploaded file is corrupted or unsupported.'],
      uncertainties: ['File content cannot be visually verified.'],
      limitations: ['Deterministic header validation failed.'],
      recommendedReviewLevel: 'REJECT',
    };
  }

  // 2. Image Decoding & Metadata Inspection via Sharp
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (decodeErr: any) {
    return {
      isValidImage: false,
      mimeType: magic.detectedMime,
      fileSizeBytes,
      qualityScore: 0,
      sharpness: {
        laplacianVariance: 0,
        isBlurry: false,
        explanation: 'Image decoding failed: file data corrupted.',
      },
      brightness: {
        mean: 0,
        isSeverelyDark: false,
        isSeverelyOverexposed: false,
        explanation: 'Image decoding failed.',
      },
      contrast: {
        stdev: 0,
        isBlankOrUniform: false,
        explanation: 'Image decoding failed.',
      },
      metadata: {
        hasExif: false,
        hasGpsMetadata: false,
        gpsDisclaimer: 'Corrupted image metadata.',
      },
      signals: ['CORRUPTED_IMAGE_DATA: Sharp failed to decode raster data.'],
      warnings: ['Corrupted or truncated image payload.'],
      uncertainties: ['File payload damaged in transit.'],
      limitations: ['Decoder aborted.'],
      recommendedReviewLevel: 'REJECT',
    };
  }

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const format = metadata.format || 'unknown';

  signals.push(`Image verified: ${format.toUpperCase()} raster stream decoded (${width}x${height} px, ${(fileSizeBytes / 1024).toFixed(1)} KB).`);

  // 3. Dimension Boundaries
  let dimensionsOk = true;
  if (width < EVIDENCE_QUALITY_THRESHOLDS.MIN_WIDTH || height < EVIDENCE_QUALITY_THRESHOLDS.MIN_HEIGHT) {
    dimensionsOk = false;
    warnings.push(
      `Image dimensions (${width}x${height}) are below the minimum threshold (${EVIDENCE_QUALITY_THRESHOLDS.MIN_WIDTH}x${EVIDENCE_QUALITY_THRESHOLDS.MIN_HEIGHT} px). Small images lack sufficient detail for civic inspection.`
    );
  } else if (width > EVIDENCE_QUALITY_THRESHOLDS.MAX_DIMENSION || height > EVIDENCE_QUALITY_THRESHOLDS.MAX_DIMENSION) {
    warnings.push(
      `Image resolution (${width}x${height}) exceeds safe processing boundaries.`
    );
  }

  // 4. Photometric Channel Statistics (Brightness & Contrast)
  let meanBrightness = 128;
  let contrastStdev = 50;
  let isSeverelyDark = false;
  let isSeverelyOverexposed = false;
  let isBlankOrUniform = false;

  try {
    const stats = await sharp(buffer).stats();
    if (stats.channels && stats.channels.length > 0) {
      // Calculate overall luminance mean and standard deviation
      meanBrightness =
        stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
      contrastStdev =
        stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;

      if (contrastStdev < EVIDENCE_QUALITY_THRESHOLDS.UNIFORM_CONTRAST_STDEV_MAX) {
        isBlankOrUniform = true;
        warnings.push(
          `Near-blank or solid-color image detected (contrast stdev: ${contrastStdev.toFixed(1)}). The photo appears blank, blocked, or lacking civic scene content.`
        );
      }

      if (meanBrightness < EVIDENCE_QUALITY_THRESHOLDS.DARK_MEAN_BRIGHTNESS_MAX) {
        isSeverelyDark = true;
        signals.push(
          `Low-light photo detected (average brightness: ${meanBrightness.toFixed(1)}/255). Officer review recommended to ensure subject visibility; valid context for night-time streetlight or road hazard reports.`
        );
      } else if (meanBrightness > EVIDENCE_QUALITY_THRESHOLDS.OVEREXPOSED_MEAN_BRIGHTNESS_MIN) {
        isSeverelyOverexposed = true;
        warnings.push(
          `Severely overexposed image (average brightness: ${meanBrightness.toFixed(1)}/255). High glare or blown-out highlights may obscure physical defects.`
        );
      } else if (!isBlankOrUniform) {
        signals.push(`Photometric exposure within normal balanced range (mean brightness: ${meanBrightness.toFixed(1)}/255, contrast: ${contrastStdev.toFixed(1)}).`);
      }
    }
  } catch {
    signals.push('Photometric statistics calculation bypassed.');
  }

  // 5. Sharpness & Blur Estimation via Laplacian Variance
  let laplacianVariance = 100.0;
  let isBlurry = false;
  try {
    // Normalize to reference dimensions (max 512px) for scale-independent edge energy measurement
    const laplacianBuffer = await sharp(buffer)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: false })
      .grayscale()
      .convolve(LAPLACIAN_KERNEL)
      .raw()
      .toBuffer();

    let sum = 0;
    let sqSum = 0;
    const len = laplacianBuffer.length;
    for (let i = 0; i < len; i++) {
      const v = laplacianBuffer[i];
      sum += v;
      sqSum += v * v;
    }
    const lapMean = sum / len;
    laplacianVariance = sqSum / len - lapMean * lapMean;

    if (!isBlankOrUniform && laplacianVariance < EVIDENCE_QUALITY_THRESHOLDS.BLUR_LAPLACIAN_VARIANCE_MIN) {
      isBlurry = true;
      warnings.push(
        `Low sharpness detected (Laplacian edge variance: ${laplacianVariance.toFixed(1)}). Photo appears blurred, out of focus, or taken in rapid motion.`
      );
    } else if (!isBlankOrUniform) {
      signals.push(`Edge sharpness verified (Laplacian variance: ${laplacianVariance.toFixed(1)}).`);
    }
  } catch {
    signals.push('Sharpness estimation bypassed.');
  }

  // 6. EXIF Metadata Inspection
  const parsedExif = parseExifBuffer(metadata.exif);
  if (parsedExif.hasExif) {
    const metaParts: string[] = [];
    if (parsedExif.cameraMake || parsedExif.cameraModel) {
      metaParts.push(`Device: ${[parsedExif.cameraMake, parsedExif.cameraModel].filter(Boolean).join(' ')}`);
    }
    if (parsedExif.software) {
      metaParts.push(`App: ${parsedExif.software}`);
    }
    if (parsedExif.dateTimeOriginal) {
      metaParts.push(`Recorded Date: ${parsedExif.dateTimeOriginal}`);
    }
    if (parsedExif.hasGpsMetadata) {
      metaParts.push(`Embedded GPS: (${parsedExif.gpsLatitude}, ${parsedExif.gpsLongitude})`);
    }

    signals.push(
      `EXIF metadata detected: ${metaParts.length > 0 ? metaParts.join(' | ') : 'Present in file headers'}.`
    );
  } else {
    signals.push(
      'No EXIF header present. Note: Standard privacy tools, messaging apps, and screenshot utilities routinely strip EXIF without diminishing evidence legitimacy.'
    );
  }

  // Non-authoritative disclaimers
  uncertainties.push(
    'EXIF metadata and embedded GPS coordinates are citizen-submitted and non-authoritative. They can be modified, simulated, or stripped by camera apps.'
  );
  uncertainties.push(
    'Image sharpness and photometric signals indicate image clarity only, NOT physical scene authenticity or the veracity of the citizen.'
  );

  limitations.push(
    'Sharpness is evaluated via discrete 3x3 Laplacian convolution edge-energy variance on a 512px normalized thumbnail.'
  );
  limitations.push(
    'Exposure analysis evaluates 8-bit channel luminance distribution; it does not replace human visual assessment by ward engineers.'
  );

  // 7. Explainable 0-100 Quality Score Heuristic
  let qualityScore = 100;
  if (isBlankOrUniform) qualityScore -= 60;
  if (isBlurry) qualityScore -= 25;
  if (isSeverelyDark) qualityScore -= 15;
  if (isSeverelyOverexposed) qualityScore -= 20;
  if (!dimensionsOk) qualityScore -= 35;
  qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

  // 8. Recommended Review Level
  let recommendedReviewLevel: EvidenceQualityAnalysis['recommendedReviewLevel'] = 'NONE';
  if (isBlankOrUniform || qualityScore < 40) {
    recommendedReviewLevel = 'MANUAL_REVIEW_RECOMMENDED';
  } else if (isBlurry || isSeverelyDark || isSeverelyOverexposed || !dimensionsOk) {
    recommendedReviewLevel = 'ADVISORY';
  }

  return {
    isValidImage: true,
    mimeType: magic.detectedMime,
    format,
    width,
    height,
    fileSizeBytes,
    qualityScore,
    sharpness: {
      laplacianVariance: Math.round(laplacianVariance * 10) / 10,
      isBlurry,
      explanation: isBlurry
        ? `Edge variance (${laplacianVariance.toFixed(1)}) is below threshold (${EVIDENCE_QUALITY_THRESHOLDS.BLUR_LAPLACIAN_VARIANCE_MIN}), indicating noticeable blur.`
        : `Edge variance (${laplacianVariance.toFixed(1)}) is sufficient for visual inspection.`,
    },
    brightness: {
      mean: Math.round(meanBrightness * 10) / 10,
      isSeverelyDark,
      isSeverelyOverexposed,
      explanation: isSeverelyDark
        ? `Average brightness (${meanBrightness.toFixed(1)}) is very low. Officer review recommended to ensure subject visibility.`
        : isSeverelyOverexposed
        ? `Average brightness (${meanBrightness.toFixed(1)}) is near white; details may be washed out.`
        : `Average brightness (${meanBrightness.toFixed(1)}) is within acceptable daylight/ambient range.`,
    },
    contrast: {
      stdev: Math.round(contrastStdev * 10) / 10,
      isBlankOrUniform,
      explanation: isBlankOrUniform
        ? 'Standard deviation is near zero; image appears uniform or blank.'
        : 'Sufficient scene contrast detected.',
    },
    metadata: {
      hasExif: parsedExif.hasExif,
      cameraMake: parsedExif.cameraMake,
      cameraModel: parsedExif.cameraModel,
      software: parsedExif.software,
      dateTimeOriginal: parsedExif.dateTimeOriginal,
      hasGpsMetadata: parsedExif.hasGpsMetadata,
      gpsLatitude: parsedExif.gpsLatitude,
      gpsLongitude: parsedExif.gpsLongitude,
      gpsDisclaimer:
        'EXIF metadata is citizen-submitted and non-authoritative. Embedded GPS or timestamps must never be treated as verified ground truth.',
    },
    signals,
    warnings,
    uncertainties,
    limitations,
    recommendedReviewLevel,
  };
}
