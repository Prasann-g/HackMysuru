import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { complaintStore } from '../db/complaintStore.js';
import { getSupabaseClient } from '../db/supabase.js';
import { evidenceUpload } from '../middleware/upload.js';
import { CONFIG } from '../config.js';
import {
  verifyComplaint,
  validateDescription,
  validateObservedDate,
  tokenizeAndNormalize,
  calculateJaccardSimilarity,
} from '../services/verificationEngine.js';
import {
  validateImageMagicBytes,
  computeImageSha256,
  computeImageDHash,
} from '../utils/imageHash.js';
import { analyzeEvidenceQuality } from '../utils/evidenceQuality.js';
import {
  validateGeoEvidence,
  isValidCoordinate,
  isWithinMysuruServiceArea,
} from '../utils/geoEvidenceValidator.js';
import { validateTemporalEvidence } from '../utils/temporalEvidenceValidator.js';
import { calculateSlaMetrics } from '../utils/slaBenchmarks.js';
import { followthroughRepository } from '../modules/followthrough/followthrough.repository.js';
import type {
  EvidenceQualityAnalysis,
  GeoEvidenceResult,
  TemporalEvidenceResult,
} from '../types/verification.js';
import type {
  ComplaintRecord,
  CreateComplaintInput,
  PublicTrackResult,
} from '../types/complaint.js';
import type { IssueCategory } from '../types/verification.js';
import { SYNTHETIC_DISCLAIMER } from '../db/seedDemoData.js';

export const complaintRouter = Router();

// Department routing recommendation helper
function getDefaultDepartment(category: IssueCategory): string {
  switch (category) {
    case 'pothole':
      return 'MCC Engineering Division';
    case 'garbage_dumping':
    case 'overflowing_bin':
    case 'unsegregated_waste':
      return 'MCC Health & Sanitation Department';
    case 'broken_streetlight':
      return 'CHESCOM / MCC Electrical Division';
    case 'construction_debris':
      return 'MCC Town Planning & Public Works';
    default:
      return 'MCC General Grievance Cell';
  }
}

// 1. Create a Complaint (Citizen only - supports JSON and multipart/form-data with photo evidence)
complaintRouter.post(
  '/',
  requireAuth,
  requireRole(['CITIZEN']),
  (req, res, next) => {
    evidenceUpload.single('image')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
              error: `File size exceeds the allowed limit of ${Math.round(CONFIG.MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`,
            });
            return;
          }
          res.status(400).json({ error: `Upload error: ${err.message}` });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const input = req.body as CreateComplaintInput;

    // Validation 1: Description
    const descValidation = validateDescription(input.description);
    if (!descValidation.valid) {
      res.status(400).json({ error: descValidation.error });
      return;
    }

    // Validation 2: Observed Date
    const dateValidation = validateObservedDate(input.observedDate);
    if (!dateValidation.valid) {
      res.status(400).json({ error: dateValidation.error });
      return;
    }

    // Validation 3: Category
    const validCategories: IssueCategory[] = [
      'garbage_dumping',
      'overflowing_bin',
      'pothole',
      'broken_streetlight',
      'unsegregated_waste',
      'construction_debris',
      'other',
    ];
    if (!input.category || !validCategories.includes(input.category)) {
      res.status(400).json({
        error: `Invalid issue category. Must be one of: ${validCategories.join(', ')}.`,
      });
      return;
    }

    // Validation 4: Location Area
    if (!input.locationArea || input.locationArea.trim().length === 0) {
      res.status(400).json({ error: 'Location area or neighborhood is required.' });
      return;
    }

    const rawLat = input.latitude as unknown;
    const rawLon = input.longitude as unknown;
    const latNum =
      rawLat !== undefined && rawLat !== null && rawLat !== '' && !isNaN(Number(rawLat))
        ? Number(rawLat)
        : undefined;
    const lonNum =
      rawLon !== undefined && rawLon !== null && rawLon !== '' && !isNaN(Number(rawLon))
        ? Number(rawLon)
        : undefined;

    // Validation 5: Mandatory Photographic Evidence Gate
    if (!req.file && !Boolean(input.hasImage)) {
      res.status(400).json({
        error: 'Photographic evidence is mandatory for complaint verification. Please attach an image of the civic issue.',
        code: 'IMAGE_REQUIRED',
      });
      return;
    }

    // Validation 6: Mandatory Application-Captured Device GPS Gate
    if (latNum === undefined || lonNum === undefined || !isValidCoordinate(latNum, lonNum)) {
      res.status(400).json({
        error: 'Device GPS coordinates are required for complaint verification. Please allow location access.',
        code: 'GPS_REQUIRED',
      });
      return;
    }

    // Validation 7: Mysuru Municipal Service Area Gate (Option B — Reject Intake)
    // This check happens BEFORE any file processing, disk writes, database inserts, or token generation.
    // Out-of-jurisdiction complaints must never be created as records.
    if (!isWithinMysuruServiceArea(latNum, lonNum)) {
      res.status(400).json({
        error:
          'The captured device location is outside the Mysuru municipal service area. The locality entered in the form does not override the device GPS location. Complaints can only be submitted from within the supported Mysuru City Corporation jurisdiction.',
        code: 'OUT_OF_SERVICE_AREA',
      });
      return;
    }

    const now = new Date().toISOString();
    let hasImage = Boolean(input.hasImage);

    let imagePath: string | undefined;
    let imageSha256: string | undefined;
    let imagePhash: string | undefined;
    let evidenceMetadata = input.evidenceMetadata;
    let evidenceQuality: EvidenceQualityAnalysis | undefined;
    let geoEvidence: GeoEvidenceResult | undefined;
    let temporalEvidence: TemporalEvidenceResult | undefined;
    let diskPath: string | undefined;

    let magicValidation: ReturnType<typeof validateImageMagicBytes> | undefined;
    if (req.file) {
      // Content-based magic bytes validation (Security Rule 5)
      magicValidation = validateImageMagicBytes(req.file.buffer);
      if (!magicValidation.valid) {
        res.status(400).json({ error: magicValidation.error });
        return;
      }

      hasImage = true;
      imageSha256 = computeImageSha256(req.file.buffer);
      imagePhash = (await computeImageDHash(req.file.buffer)) || undefined;

      // Evidence Quality & Forensic Signal Evaluation
      evidenceQuality = await analyzeEvidenceQuality(req.file.buffer);

      // Geo-Tagged Evidence Verification
      geoEvidence = await validateGeoEvidence({
        hasImage: true,
        imageBuffer: req.file.buffer,
        capturedLatitude: latNum,
        capturedLongitude: lonNum,
        imageRequired: true,
      });

      // Temporal Evidence Verification (EXIF Capture Date vs Observed vs Submission)
      temporalEvidence = validateTemporalEvidence({
        hasImage: true,
        rawExifDateTime: evidenceQuality?.metadata?.dateTimeOriginal,
        submissionDate: now,
        observedDate: input.observedDate,
      });

      // Pre-submission Exact Image Duplicate Check (Zero-Orphan Disk & Database Safety)
      const exactMatches = await complaintStore.findByImageSha256(imageSha256);
      if (exactMatches.length > 0) {
        const existing = exactMatches[0];
        res.status(409).json({
          error: 'This exact photograph has already been submitted for an existing complaint in Mysuru.',
          code: 'EXACT_IMAGE_DUPLICATE',
          duplicateType: 'IMAGE_EXACT_MATCH',
          existingComplaint: {
            id: existing.id,
            trackingToken: existing.trackingToken,
            category: existing.category,
            status: existing.status,
            locationArea: existing.locationArea,
            observedDate: existing.observedDate,
            createdAt: existing.createdAt,
          },
        });
        return;
      }
    }

    // Retrieve candidates for duplicate checking & officer decision support
    const verificationCandidates = await complaintStore.listCandidatesForVerification();

    // Pre-submission High-Confidence Text Duplicate Check (Option A: Jaccard >= 0.90 in same category & area)
    const inputTokens = tokenizeAndNormalize(input.description);
    const textDuplicate = verificationCandidates.find((c) => {
      if (c.status === 'RESOLVED' || c.status === 'CLOSED') return false;
      if (c.category !== input.category) return false;
      if (
        !c.locationArea ||
        c.locationArea.trim().toLowerCase() !== input.locationArea.trim().toLowerCase()
      ) {
        return false;
      }
      const candidateTokens = tokenizeAndNormalize(c.description);
      const jaccard = calculateJaccardSimilarity(inputTokens, candidateTokens);
      return jaccard >= 0.90;
    });

    if (textDuplicate) {
      const fullExisting = await complaintStore.findById(textDuplicate.id);
      res.status(409).json({
        error: 'An identical or near-identical complaint has already been submitted and is active in this area.',
        code: 'EXACT_TEXT_DUPLICATE',
        duplicateType: 'TEXT_EXACT_MATCH',
        existingComplaint: {
          id: textDuplicate.id,
          trackingToken: fullExisting?.trackingToken || textDuplicate.id,
          category: textDuplicate.category,
          status: textDuplicate.status,
          locationArea: textDuplicate.locationArea,
          observedDate: textDuplicate.observedDate,
          createdAt: fullExisting?.createdAt,
        },
      });
      return;
    }

    // Safe File Storage: Only write to disk AFTER all duplicate checks have passed
    if (req.file && magicValidation) {
      const complaintsDir = path.join(CONFIG.UPLOAD_DIR, 'complaints');
      if (!fs.existsSync(complaintsDir)) {
        fs.mkdirSync(complaintsDir, { recursive: true });
      }

      const ext =
        path.extname(req.file.originalname) ||
        (magicValidation.detectedMime === 'image/png'
          ? '.png'
          : magicValidation.detectedMime === 'image/webp'
          ? '.webp'
          : '.jpg');
      const storedFilename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      diskPath = path.join(complaintsDir, storedFilename);
      fs.writeFileSync(diskPath, req.file.buffer);
      imagePath = path.join('uploads', 'complaints', storedFilename).replace(/\\/g, '/');

      evidenceMetadata = {
        filename: req.file.originalname,
        sizeBytes: req.file.size,
        mimetype: magicValidation.detectedMime || req.file.mimetype,
        submittedAt: now,
        note: 'Uploaded via citizen complaint portal',
      };
    } else {
      geoEvidence = await validateGeoEvidence({
        hasImage: Boolean(input.hasImage),
        capturedLatitude: latNum,
        capturedLongitude: lonNum,
        imageRequired: true,
      });
      temporalEvidence = validateTemporalEvidence({
        hasImage: false,
        submissionDate: now,
        observedDate: input.observedDate,
      });
    }

    const verificationResult = verifyComplaint(
      {
        category: input.category,
        customCategory: input.customCategory,
        description: input.description,
        observedDate: input.observedDate,
        locationArea: input.locationArea,
        addressText: input.addressText,
        latitude: latNum,
        longitude: lonNum,
        hasImage,
        imageSha256,
        imagePhash,
        evidenceQuality,
        geoEvidence,
        temporalEvidence,
      },
      verificationCandidates
    );

    const id = `MCC-2026-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const trackingToken = `TRK-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const newComplaint: ComplaintRecord = {
      id,
      trackingToken,
      citizenId: req.user!.userId,
      category: input.category,
      customCategory: input.customCategory,
      description: input.description.trim(),
      observedDate: input.observedDate,
      locationArea: input.locationArea.trim(),
      addressText: input.addressText?.trim() || undefined,
      latitude: input.latitude ? Number(input.latitude) : undefined,
      longitude: input.longitude ? Number(input.longitude) : undefined,
      hasImage,
      evidenceMetadata,
      imagePath,
      imageSha256,
      imagePhash,
      status: 'SUBMITTED',
      verificationResult,
      assignedDepartment: getDefaultDepartment(input.category),
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };

    let saved: ComplaintRecord;
    try {
      saved = await complaintStore.create(newComplaint);

      // Record initial activity log for Follow-through lifecycle tracking (only after create succeeds)
      try {
        await followthroughRepository.logActivity({
          id: `ACT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          complaintId: saved.id,
          eventType: 'COMPLAINT_CREATED',
          sourceTable: 'complaints',
          sourceRecordId: saved.id,
          actorId: req.user!.userId,
          actorName: req.user?.email,
          actorRole: 'CITIZEN',
          newStatus: 'SUBMITTED',
          notes: 'Complaint registered by citizen.',
          createdAt: now,
        });
      } catch (logErr: any) {
        console.error('[complaintRoutes] Failed to log initial activity:', logErr.message);
      }

      // In Supabase mode, also sync image to Supabase Storage
      if (req.file && diskPath && CONFIG.DATA_STORE === 'supabase') {
        const supabase = getSupabaseClient();
        if (supabase) {
          const storedFilename = path.basename(diskPath);
          const ext = path.extname(storedFilename).toLowerCase();
          const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          await supabase.storage
            .from(CONFIG.SUPABASE_STORAGE_BUCKET)
            .upload(`evidence/${id}/${storedFilename}`, req.file.buffer, {
              contentType,
              upsert: true,
            });
        }
      }
    } catch {
      // Rollback: delete physical file from disk to prevent orphaned files
      if (diskPath && fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch {
          // ignore cleanup error
        }
      }
      res.status(500).json({ error: 'Failed to persist complaint in database.' });
      return;
    }

    res.status(201).json({
      message: 'Complaint registered successfully.',
      complaint: saved,
      evidenceNotice:
        'Attached photo evidence is treated as citizen-submitted evidence only. Authenticity unverified.',
    });
  }
);

// 2. View Citizen's Own Complaints (Citizen only)
complaintRouter.get('/my', requireAuth, requireRole(['CITIZEN']), async (req, res) => {
  const complaints = await complaintStore.findByCitizenId(req.user!.userId);
  res.status(200).json({ complaints });
});

// 3. Public Tracking by Token (Zero Citizen PII)
complaintRouter.get('/track/:token', async (req, res) => {
  const token = req.params.token as string;
  if (!token) {
    res.status(400).json({ error: 'Tracking token is required.' });
    return;
  }

  const complaint = await complaintStore.findByTrackingToken(token);
  if (!complaint) {
    res.status(404).json({
      error: 'Complaint not found with the provided tracking token. Please check your token.',
    });
    return;
  }

  // Strict PII Sanitization
  const publicResult: PublicTrackResult = {
    id: complaint.id,
    trackingToken: complaint.trackingToken,
    category: complaint.category,
    customCategory: complaint.customCategory,
    description: complaint.description,
    locationArea: complaint.locationArea,
    addressText: complaint.addressText,
    hasImage: complaint.hasImage,
    observedDate: complaint.observedDate,
    status: complaint.status,
    assignedDepartment: complaint.assignedDepartment,
    verificationOutcome: complaint.verificationResult?.outcome,
    duplicateRisk: complaint.verificationResult?.duplicateRisk,
    signals: complaint.verificationResult?.signals || [],
    recommendedAction: complaint.verificationResult?.recommendedAction,
    uncertainties: complaint.verificationResult?.uncertainties,
    limitations: complaint.verificationResult?.limitations,
    evidenceQuality: complaint.verificationResult?.evidenceQuality
      ? {
          qualityScore: complaint.verificationResult.evidenceQuality.qualityScore,
          sharpness: complaint.verificationResult.evidenceQuality.sharpness,
          brightness: complaint.verificationResult.evidenceQuality.brightness,
          contrast: complaint.verificationResult.evidenceQuality.contrast,
          metadata: complaint.verificationResult.evidenceQuality.metadata,
          warnings: complaint.verificationResult.evidenceQuality.warnings,
        }
      : undefined,
    geoEvidence: complaint.verificationResult?.geoEvidence
      ? {
          status: complaint.verificationResult.geoEvidence.status,
          reviewRequired: complaint.verificationResult.geoEvidence.reviewRequired,
          signals: complaint.verificationResult.geoEvidence.signals,
          withinServiceArea: complaint.verificationResult.geoEvidence.withinServiceArea,
          distanceMeters: complaint.verificationResult.geoEvidence.distanceMeters,
        }
      : undefined,
    temporalEvidence: complaint.verificationResult?.temporalEvidence
      ? {
          status: complaint.verificationResult.temporalEvidence.status,
          hasTimestamp: complaint.verificationResult.temporalEvidence.hasTimestamp,
          exifDateTime: complaint.verificationResult.temporalEvidence.exifDateTime,
          parsedCaptureDate: complaint.verificationResult.temporalEvidence.parsedCaptureDate,
          reviewRequired: complaint.verificationResult.temporalEvidence.reviewRequired,
          signals: complaint.verificationResult.temporalEvidence.signals,
          diffDaysWithObservedDate:
            complaint.verificationResult.temporalEvidence.diffDaysWithObservedDate,
          evidenceAgeDays: complaint.verificationResult.temporalEvidence.evidenceAgeDays,
        }
      : undefined,
    slaTracking: (() => {
      const sla = calculateSlaMetrics(complaint.category, complaint.createdAt);
      return {
        slaTargetHours: sla.slaTargetHours,
        elapsedHours: sla.elapsedHours,
        remainingHours: sla.remainingHours,
        slaProgressPercent: sla.slaProgressPercent,
        status: sla.status,
        standardResolutionWindow: sla.standardResolutionWindow,
      };
    })(),
    isDemo: complaint.isDemo,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    disclaimer:
      'Photo evidence is treated as citizen-submitted visual evidence only. Authenticity unverified. Physical site veracity requires human inspection.',
  };

  res.status(200).json(publicResult);
});

// 4. Public Synthetic Demo Candidates Pool
complaintRouter.get('/demo-pool', async (_req, res) => {
  const demoRecords = await complaintStore.listDemoComplaints();
  res.status(200).json({
    disclaimer: SYNTHETIC_DISCLAIMER,
    count: demoRecords.length,
    complaints: demoRecords,
  });
});

// 4b. Public Aggregated Transparency & Analytics (Unauthenticated)
complaintRouter.get('/public-analytics', async (_req, res) => {
  try {
    const analytics = await complaintStore.getPublicAnalytics();
    res.status(200).json({
      ...analytics,
      disclaimer:
        'Public transparency data aggregated strictly from authentic complaint records in Mysuru. Citizen personal information is strictly protected under CivicTrust Security Rule 12.',
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Failed to compute public municipal analytics.',
      details: err.message,
    });
  }
});

// 5. View Single Complaint (Authorized Citizen or Officer)
complaintRouter.get('/:id', requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const complaint = await complaintStore.findById(id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found.' });
    return;
  }

  // Authorization Gate: Citizens can ONLY view their own complaints
  if (req.user!.role === 'CITIZEN' && complaint.citizenId !== req.user!.userId) {
    res.status(403).json({
      error: 'Access denied: You are not authorized to view this complaint.',
    });
    return;
  }

  res.status(200).json(complaint);
});

// 6. Safe Image Delivery Endpoint (Authorized Citizen or Officer/Admin)
complaintRouter.get('/:id/image', requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const complaint = await complaintStore.findById(id);
  if (!complaint || !complaint.imagePath) {
    res.status(404).json({ error: 'No image found for this complaint.' });
    return;
  }

  // Authorization Gate: Citizens can only view images from their own complaints
  if (req.user!.role === 'CITIZEN' && complaint.citizenId !== req.user!.userId) {
    res.status(403).json({
      error: 'Access denied: You are not authorized to view this complaint evidence photo.',
    });
    return;
  }

  // Prevent Path Traversal (Security Rule 5)
  const uploadRoot = path.resolve(CONFIG.UPLOAD_DIR);
  let absoluteDiskPath = path.resolve(process.cwd(), complaint.imagePath);
  if (!fs.existsSync(absoluteDiskPath)) {
    absoluteDiskPath = path.resolve(process.cwd(), 'server', complaint.imagePath);
  }

  // Fallback to Supabase Storage if file is not on local disk
  if (!fs.existsSync(absoluteDiskPath) && CONFIG.DATA_STORE === 'supabase') {
    const supabase = getSupabaseClient();
    if (supabase) {
      const fileName = path.basename(complaint.imagePath);
      const { data: fileData, error: storageErr } = await supabase.storage
        .from(CONFIG.SUPABASE_STORAGE_BUCKET)
        .download(`evidence/${complaint.id}/${fileName}`);
      if (!storageErr && fileData) {
        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = path.extname(fileName).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(buffer);
        return;
      }
    }
  }

  if (!absoluteDiskPath.startsWith(uploadRoot)) {
    res.status(403).json({ error: 'Access denied: Invalid image path.' });
    return;
  }

  if (!fs.existsSync(absoluteDiskPath)) {
    res.status(404).json({ error: 'Evidence image file not found on disk.' });
    return;
  }

  // Content type mapping
  const ext = path.extname(absoluteDiskPath).toLowerCase();
  const mimeType =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
      ? 'image/webp'
      : 'image/jpeg';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const stream = fs.createReadStream(absoluteDiskPath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error reading image file.' });
    }
  });
  stream.pipe(res);
});
