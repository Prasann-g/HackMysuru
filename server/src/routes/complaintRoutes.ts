import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { complaintStore } from '../db/complaintStore.js';
import { evidenceUpload } from '../middleware/upload.js';
import { CONFIG } from '../config.js';
import {
  verifyComplaint,
  validateDescription,
  validateObservedDate,
} from '../services/verificationEngine.js';
import {
  validateImageMagicBytes,
  computeImageSha256,
  computeImageDHash,
} from '../utils/imageHash.js';
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

    const now = new Date().toISOString();
    let hasImage = Boolean(input.hasImage);
    let imagePath: string | undefined;
    let imageSha256: string | undefined;
    let imagePhash: string | undefined;
    let evidenceMetadata = input.evidenceMetadata;
    let diskPath: string | undefined;

    if (req.file) {
      // Content-based magic bytes validation (Security Rule 5)
      const magicValidation = validateImageMagicBytes(req.file.buffer);
      if (!magicValidation.valid) {
        res.status(400).json({ error: magicValidation.error });
        return;
      }

      hasImage = true;
      imageSha256 = computeImageSha256(req.file.buffer);
      imagePhash = (await computeImageDHash(req.file.buffer)) || undefined;

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
    }

    // Run Verification Engine against active open complaints + historical complaints with images
    const verificationCandidates = complaintStore.listCandidatesForVerification();

    const verificationResult = verifyComplaint(
      {
        category: input.category,
        customCategory: input.customCategory,
        description: input.description,
        observedDate: input.observedDate,
        locationArea: input.locationArea,
        addressText: input.addressText,
        hasImage,
        imageSha256,
        imagePhash,
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
      saved = complaintStore.create(newComplaint);
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
complaintRouter.get('/my', requireAuth, requireRole(['CITIZEN']), (req, res) => {
  const complaints = complaintStore.findByCitizenId(req.user!.userId);
  res.status(200).json({ complaints });
});

// 3. Public Tracking by Token (Zero Citizen PII)
complaintRouter.get('/track/:token', (req, res) => {
  const token = req.params.token as string;
  if (!token) {
    res.status(400).json({ error: 'Tracking token is required.' });
    return;
  }

  const complaint = complaintStore.findByTrackingToken(token);
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
    observedDate: complaint.observedDate,
    status: complaint.status,
    assignedDepartment: complaint.assignedDepartment,
    verificationOutcome: complaint.verificationResult?.outcome,
    duplicateRisk: complaint.verificationResult?.duplicateRisk,
    signals: complaint.verificationResult?.signals || [],
    isDemo: complaint.isDemo,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    disclaimer:
      'Photo evidence is treated as citizen-submitted visual evidence only. Authenticity unverified. Physical site veracity requires human inspection.',
  };

  res.status(200).json(publicResult);
});

// 4. Public Synthetic Demo Candidates Pool
complaintRouter.get('/demo-pool', (_req, res) => {
  const demoRecords = complaintStore.listDemoComplaints();
  res.status(200).json({
    disclaimer: SYNTHETIC_DISCLAIMER,
    count: demoRecords.length,
    complaints: demoRecords,
  });
});

// 5. View Single Complaint (Authorized Citizen or Officer)
complaintRouter.get('/:id', requireAuth, (req, res) => {
  const id = req.params.id as string;
  const complaint = complaintStore.findById(id);
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
complaintRouter.get('/:id/image', requireAuth, (req, res) => {
  const id = req.params.id as string;
  const complaint = complaintStore.findById(id);
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
  const absoluteDiskPath = path.resolve(process.cwd(), complaint.imagePath);

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
