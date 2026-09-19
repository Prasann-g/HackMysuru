import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  analyzeEvidenceQuality,
  parseExifBuffer,
  EVIDENCE_QUALITY_THRESHOLDS,
} from '../src/utils/evidenceQuality.js';
import { verifyComplaint } from '../src/services/verificationEngine.js';
import type { ComplaintInput } from '../src/types/verification.js';

describe('Phase 2 — Stage 2: Evidence Quality & Forensic Checks', () => {
  // Helper to generate test images in memory using Sharp
  const createTestImage = async (options: {
    width?: number;
    height?: number;
    format?: 'jpeg' | 'png' | 'webp';
    color?: { r: number; g: number; b: number };
    pattern?: 'blank' | 'checker' | 'gradient';
    blurRadius?: number;
    exif?: {
      make?: string;
      model?: string;
      software?: string;
      dateTimeOriginal?: string;
      gps?: { lat: number; lon: number };
    };
  }): Promise<Buffer> => {
    const width = options.width || 200;
    const height = options.height || 200;
    const format = options.format || 'jpeg';

    let instance: sharp.Sharp;

    if (options.pattern === 'checker') {
      const svg = `<svg width="${width}" height="${height}">
        <rect width="${width / 2}" height="${height / 2}" fill="black" />
        <rect x="${width / 2}" width="${width / 2}" height="${height / 2}" fill="white" />
        <rect y="${height / 2}" width="${width / 2}" height="${height / 2}" fill="white" />
        <rect x="${width / 2}" y="${height / 2}" width="${width / 2}" height="${height / 2}" fill="black" />
      </svg>`;
      instance = sharp(Buffer.from(svg));
    } else if (options.pattern === 'gradient') {
      const svg = `<svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#203040" />
            <stop offset="100%" stop-color="#f0a020" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#g)" />
      </svg>`;
      instance = sharp(Buffer.from(svg));
    } else {
      const bg = options.color || { r: 128, g: 128, b: 128 };
      instance = sharp({
        create: {
          width,
          height,
          channels: 3,
          background: bg,
        },
      });
    }

    if (options.blurRadius && options.blurRadius > 0) {
      instance = instance.blur(options.blurRadius);
    }

    if (options.exif) {
      const ifd0: Record<string, string> = {};
      if (options.exif.make) ifd0.Make = options.exif.make;
      if (options.exif.model) ifd0.Model = options.exif.model;
      if (options.exif.software) ifd0.Software = options.exif.software;

      const ifd2: Record<string, string> = {};
      if (options.exif.dateTimeOriginal) ifd2.DateTimeOriginal = options.exif.dateTimeOriginal;

      const ifd3: Record<string, string> = {};
      if (options.exif.gps) {
        const lat = options.exif.gps.lat;
        const lon = options.exif.gps.lon;
        const latDeg = Math.floor(Math.abs(lat));
        const latMin = Math.floor((Math.abs(lat) - latDeg) * 60);
        const latSec = Math.round(((Math.abs(lat) - latDeg) * 60 - latMin) * 60);

        const lonDeg = Math.floor(Math.abs(lon));
        const lonMin = Math.floor((Math.abs(lon) - lonDeg) * 60);
        const lonSec = Math.round(((Math.abs(lon) - lonDeg) * 60 - lonMin) * 60);

        ifd3.GPSLatitudeRef = lat >= 0 ? 'N' : 'S';
        ifd3.GPSLatitude = `${latDeg}/1 ${latMin}/1 ${latSec}/1`;
        ifd3.GPSLongitudeRef = lon >= 0 ? 'E' : 'W';
        ifd3.GPSLongitude = `${lonDeg}/1 ${lonMin}/1 ${lonSec}/1`;
      }

      instance = instance.withExif({
        IFD0: ifd0,
        IFD1: {},
        IFD2: ifd2,
        IFD3: ifd3,
      });
    }

    if (format === 'png') return instance.png().toBuffer();
    if (format === 'webp') return instance.webp().toBuffer();
    return instance.jpeg().toBuffer();
  };

  describe('1. Image Validity & Format Verification', () => {
    it('successfully validates and analyzes genuine JPEG images', async () => {
      const buffer = await createTestImage({ format: 'jpeg', pattern: 'checker' });
      const analysis = await analyzeEvidenceQuality(buffer);

      expect(analysis.isValidImage).toBe(true);
      expect(analysis.mimeType).toBe('image/jpeg');
      expect(analysis.format).toBe('jpeg');
      expect(analysis.width).toBe(200);
      expect(analysis.height).toBe(200);
      expect(analysis.qualityScore).toBeGreaterThanOrEqual(70);
      expect(analysis.recommendedReviewLevel).toBe('NONE');
    });

    it('successfully validates and analyzes genuine PNG images', async () => {
      const buffer = await createTestImage({ format: 'png', pattern: 'checker' });
      const analysis = await analyzeEvidenceQuality(buffer);

      expect(analysis.isValidImage).toBe(true);
      expect(analysis.mimeType).toBe('image/png');
      expect(analysis.format).toBe('png');
      expect(analysis.qualityScore).toBeGreaterThanOrEqual(70);
    });

    it('successfully validates and analyzes genuine WebP images', async () => {
      const buffer = await createTestImage({ format: 'webp', pattern: 'gradient' });
      const analysis = await analyzeEvidenceQuality(buffer);

      expect(analysis.isValidImage).toBe(true);
      expect(analysis.mimeType).toBe('image/webp');
      expect(analysis.format).toBe('webp');
      expect(analysis.qualityScore).toBeGreaterThanOrEqual(70);
    });

    it('rejects unsupported file formats gracefully (e.g. plain text or executable)', async () => {
      const fakeBuffer = Buffer.from('CIVIC_COMPLAINT_TEXT_FILE_NOT_AN_IMAGE');
      const analysis = await analyzeEvidenceQuality(fakeBuffer);

      expect(analysis.isValidImage).toBe(false);
      expect(analysis.qualityScore).toBe(0);
      expect(analysis.recommendedReviewLevel).toBe('REJECT');
      expect(analysis.signals).toContain(
        'INVALID_FILE_SIGNATURE: Uploaded binary content does not match JPEG, PNG, or WebP magic bytes.'
      );
    });

    it('detects corrupt or truncated image data gracefully', async () => {
      // Create valid JPEG header followed by junk that cannot be decoded
      const corruptBuffer = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
        Buffer.from('CORRUPTED_TRUNCATED_RASTER_DATA_XYZ_123456789'),
      ]);

      const analysis = await analyzeEvidenceQuality(corruptBuffer);
      expect(analysis.isValidImage).toBe(false);
      expect(analysis.qualityScore).toBe(0);
      expect(analysis.recommendedReviewLevel).toBe('REJECT');
      expect(analysis.signals.some((s) => s.includes('CORRUPTED_IMAGE_DATA'))).toBe(true);
    });

    it('flags images with dimensions smaller than the minimum threshold (< 64x64)', async () => {
      const tinyBuffer = await createTestImage({ width: 32, height: 32, pattern: 'checker' });
      const analysis = await analyzeEvidenceQuality(tinyBuffer);

      expect(analysis.isValidImage).toBe(true);
      expect(analysis.width).toBe(32);
      expect(analysis.height).toBe(32);
      expect(analysis.warnings.some((w) => w.includes('below the minimum threshold'))).toBe(true);
      expect(analysis.qualityScore).toBeLessThan(70);
      expect(analysis.recommendedReviewLevel).toBe('ADVISORY');
    });
  });

  describe('2. Photometric Quality & Scene Exposure', () => {
    it('detects near-blank or solid-color images with near-zero contrast', async () => {
      const blankBuffer = await createTestImage({
        width: 200,
        height: 200,
        color: { r: 120, g: 120, b: 120 },
        pattern: 'blank',
      });
      const analysis = await analyzeEvidenceQuality(blankBuffer);

      expect(analysis.isValidImage).toBe(true);
      expect(analysis.contrast.isBlankOrUniform).toBe(true);
      expect(analysis.contrast.stdev).toBeLessThan(EVIDENCE_QUALITY_THRESHOLDS.UNIFORM_CONTRAST_STDEV_MAX);
      expect(analysis.warnings.some((w) => w.includes('Near-blank or solid-color image'))).toBe(true);
      expect(analysis.qualityScore).toBeLessThanOrEqual(40);
      expect(analysis.recommendedReviewLevel).toBe('MANUAL_REVIEW_RECOMMENDED');
    });

    it('detects severely underexposed/dark images without declaring fraud', async () => {
      // Dark scene (e.g. night-time broken streetlight)
      const darkBuffer = await createTestImage({
        width: 200,
        height: 200,
        color: { r: 10, g: 10, b: 10 },
        pattern: 'blank',
      });
      const analysis = await analyzeEvidenceQuality(darkBuffer);

      expect(analysis.isValidImage).toBe(true);
      expect(analysis.brightness.isSeverelyDark).toBe(true);
      expect(analysis.brightness.mean).toBeLessThan(EVIDENCE_QUALITY_THRESHOLDS.DARK_MEAN_BRIGHTNESS_MAX);
      expect(
        analysis.signals.some((s) => s.includes('Low-light photo detected') && s.includes('valid context'))
      ).toBe(true);
    });

    it('detects severely overexposed images', async () => {
      const overexposedBuffer = await createTestImage({
        width: 200,
        height: 200,
        color: { r: 250, g: 250, b: 250 },
        pattern: 'blank',
      });
      const analysis = await analyzeEvidenceQuality(overexposedBuffer);

      expect(analysis.isValidImage).toBe(true);
      expect(analysis.brightness.isSeverelyOverexposed).toBe(true);
      expect(analysis.brightness.mean).toBeGreaterThan(EVIDENCE_QUALITY_THRESHOLDS.OVEREXPOSED_MEAN_BRIGHTNESS_MIN);
    });
  });

  describe('3. Sharpness & Blur Estimation', () => {
    it('measures high Laplacian variance on sharp scenes with strong edges', async () => {
      const sharpBuffer = await createTestImage({ width: 256, height: 256, pattern: 'checker' });
      const analysis = await analyzeEvidenceQuality(sharpBuffer);

      expect(analysis.sharpness.isBlurry).toBe(false);
      expect(analysis.sharpness.laplacianVariance).toBeGreaterThan(
        EVIDENCE_QUALITY_THRESHOLDS.BLUR_LAPLACIAN_VARIANCE_MIN
      );
      expect(analysis.signals.some((s) => s.includes('Edge sharpness verified'))).toBe(true);
    });

    it('detects blurry images with low edge-energy variance', async () => {
      const blurryBuffer = await createTestImage({
        width: 256,
        height: 256,
        pattern: 'checker',
        blurRadius: 15,
      });
      const analysis = await analyzeEvidenceQuality(blurryBuffer);

      expect(analysis.sharpness.isBlurry).toBe(true);
      expect(analysis.sharpness.laplacianVariance).toBeLessThan(
        EVIDENCE_QUALITY_THRESHOLDS.BLUR_LAPLACIAN_VARIANCE_MIN
      );
      expect(analysis.warnings.some((w) => w.includes('Low sharpness detected'))).toBe(true);
      expect(analysis.recommendedReviewLevel).toBe('ADVISORY');
    });
  });

  describe('4. Safe EXIF Metadata & Advisory GPS Inspection', () => {
    it('safely extracts Make, Model, Software, DateTimeOriginal, and GPS from EXIF', async () => {
      const exifBuffer = await createTestImage({
        width: 200,
        height: 200,
        pattern: 'checker',
        exif: {
          make: 'MysuruCameraCorp',
          model: 'MCC-Cam-V1',
          software: 'GPS Map Camera App',
          dateTimeOriginal: '2026:09:19 11:30:00',
          gps: { lat: 12.308333, lon: 76.6625 },
        },
      });

      const analysis = await analyzeEvidenceQuality(exifBuffer);

      expect(analysis.metadata.hasExif).toBe(true);
      expect(analysis.metadata.cameraMake).toBe('MysuruCameraCorp');
      expect(analysis.metadata.cameraModel).toBe('MCC-Cam-V1');
      expect(analysis.metadata.software).toBe('GPS Map Camera App');
      expect(analysis.metadata.dateTimeOriginal).toBe('2026:09:19 11:30:00');
      expect(analysis.metadata.hasGpsMetadata).toBe(true);
      expect(analysis.metadata.gpsLatitude).toBeCloseTo(12.308333, 3);
      expect(analysis.metadata.gpsLongitude).toBeCloseTo(76.6625, 3);

      // Verify non-authoritative disclaimers are present
      expect(analysis.metadata.gpsDisclaimer).toContain('non-authoritative');
      expect(analysis.uncertainties.some((u) => u.includes('non-authoritative'))).toBe(true);
    });

    it('handles images with missing or stripped EXIF gracefully without penalizing legitimacy', async () => {
      const strippedBuffer = await createTestImage({
        width: 200,
        height: 200,
        pattern: 'checker',
        // No EXIF supplied
      });

      const analysis = await analyzeEvidenceQuality(strippedBuffer);

      expect(analysis.metadata.hasExif).toBe(false);
      expect(analysis.metadata.hasGpsMetadata).toBe(false);
      expect(
        analysis.signals.some((s) => s.includes('Standard privacy tools, messaging apps') && s.includes('without diminishing evidence legitimacy'))
      ).toBe(true);
      // Clean image without EXIF must still receive a high quality score
      expect(analysis.qualityScore).toBeGreaterThanOrEqual(70);
    });

    it('parseExifBuffer handles empty or corrupt raw buffers safely without throwing', () => {
      expect(parseExifBuffer(undefined)).toEqual({ hasExif: false, hasGpsMetadata: false });
      expect(parseExifBuffer(Buffer.from([]))).toEqual({ hasExif: false, hasGpsMetadata: false });
      expect(parseExifBuffer(Buffer.from('EXIF_GARBAGE_HEADER_1234'))).toEqual({
        hasExif: false,
        hasGpsMetadata: false,
      });
    });
  });

  describe('5. Verification Engine Integration', () => {
    it('produces RECOMMENDED_VERIFIED when clean evidence quality is attached', async () => {
      const buffer = await createTestImage({ pattern: 'checker' });
      const eq = await analyzeEvidenceQuality(buffer);

      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Dangerous road crater and deep asphalt damage near Kuvempunagar 4th cross.',
        observedDate: '2026-03-01',
        locationArea: 'Kuvempunagar',
        hasImage: true,
        evidenceQuality: eq,
      };

      const result = verifyComplaint(input, []);

      expect(result.outcome).toBe('RECOMMENDED_VERIFIED');
      expect(result.evidenceQuality).toBeDefined();
      expect(result.evidenceQuality?.qualityScore).toBeGreaterThanOrEqual(70);
      expect(result.signals.some((s) => s.includes('Image verified'))).toBe(true);
      expect(result.uncertainties.some((u) => u.includes('non-authoritative'))).toBe(true);
    });

    it('routes complaint to REQUIRES_HUMAN_REVIEW when evidence is near-blank or severely degraded', async () => {
      const blankBuffer = await createTestImage({
        pattern: 'blank',
        color: { r: 100, g: 100, b: 100 },
      });
      const eq = await analyzeEvidenceQuality(blankBuffer);

      const input: ComplaintInput = {
        category: 'pothole',
        description: 'Road crater and tar pothole observed in Kuvempunagar main road.',
        observedDate: '2026-03-01',
        locationArea: 'Kuvempunagar',
        hasImage: true,
        evidenceQuality: eq,
      };

      const result = verifyComplaint(input, []);

      expect(result.outcome).toBe('REQUIRES_HUMAN_REVIEW');
      expect(result.recommendedAction).toContain('Officer visual review recommended');
      expect(result.recommendedAction).toContain('uploaded evidence exhibits significant quality degradation');
    });

    it('marks outcome as INCONSISTENT_EVIDENCE when attached image file is corrupt or invalid', async () => {
      const invalidBuffer = Buffer.from('NOT_AN_IMAGE');
      const eq = await analyzeEvidenceQuality(invalidBuffer);

      const input: ComplaintInput = {
        category: 'garbage_dumping',
        description: 'Large waste heap and unattended garbage dumping near the commercial street.',
        observedDate: '2026-03-01',
        locationArea: 'Vijayanagar',
        hasImage: true,
        evidenceQuality: eq,
      };

      const result = verifyComplaint(input, []);

      expect(result.outcome).toBe('INCONSISTENT_EVIDENCE');
      expect(result.recommendedAction).toContain('attached photographic evidence is corrupted');
    });
  });
});
