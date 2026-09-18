import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { complaintStore } from '../db/complaintStore.js';
import {
  verifyComplaint,
  validateDescription,
  validateObservedDate,
} from '../services/verificationEngine.js';
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

// 1. Create a Complaint (Citizen only)
complaintRouter.post('/', requireAuth, requireRole(['CITIZEN']), (req, res) => {
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

  // Run Verification Engine against active open complaints
  const openCandidates = complaintStore.listOpenCandidates();
  const verificationResult = verifyComplaint(
    {
      category: input.category,
      customCategory: input.customCategory,
      description: input.description,
      observedDate: input.observedDate,
      locationArea: input.locationArea,
      addressText: input.addressText,
      hasImage: Boolean(input.hasImage),
    },
    openCandidates
  );

  const now = new Date().toISOString();
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
    latitude: input.latitude,
    longitude: input.longitude,
    hasImage: Boolean(input.hasImage),
    evidenceMetadata: input.evidenceMetadata,
    status: 'SUBMITTED',
    verificationResult,
    assignedDepartment: getDefaultDepartment(input.category),
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };

  const saved = complaintStore.create(newComplaint);

  res.status(201).json({
    message: 'Complaint registered successfully.',
    complaint: saved,
    evidenceNotice:
      'Attached photo evidence is treated as citizen-submitted evidence only. Authenticity unverified.',
  });
});

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
