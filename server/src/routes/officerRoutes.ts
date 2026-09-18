import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { complaintStore } from '../db/complaintStore.js';
import type { ComplaintStatus, OfficerReviewInput } from '../types/complaint.js';

export const officerRouter = Router();

// All officer routes strictly enforce OFFICER or ADMIN role
officerRouter.use(requireAuth, requireRole(['OFFICER', 'ADMIN']));

// 1. Officer Review Queue with Filtering
officerRouter.get('/complaints', (req, res) => {
  const { status, locationArea, category } = req.query as {
    status?: string;
    locationArea?: string;
    category?: string;
  };

  const complaints = complaintStore.listForOfficer({
    status,
    locationArea,
    category,
  });

  res.status(200).json({
    count: complaints.length,
    complaints,
  });
});

// 2. Officer Review / Action on Complaint
officerRouter.patch('/complaints/:id/review', (req, res) => {
  const { id } = req.params;
  const { status, assignedDepartment, assignedOfficerId, reviewNotes } =
    req.body as OfficerReviewInput;

  const existing = complaintStore.findById(id);
  if (!existing) {
    res.status(404).json({ error: 'Complaint not found.' });
    return;
  }

  const validStatuses: ComplaintStatus[] = [
    'SUBMITTED',
    'UNDER_REVIEW',
    'NEEDS_CLARIFICATION',
    'FORWARDED',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED',
  ];

  if (status && !validStatuses.includes(status)) {
    res.status(400).json({
      error: `Invalid status transition. Allowed values: ${validStatuses.join(', ')}.`,
    });
    return;
  }

  const updated = complaintStore.update(id, {
    status: status || existing.status,
    assignedDepartment: assignedDepartment !== undefined ? assignedDepartment : existing.assignedDepartment,
    assignedOfficerId: assignedOfficerId !== undefined ? assignedOfficerId : (existing.assignedOfficerId || req.user!.userId),
    reviewNotes: reviewNotes !== undefined ? reviewNotes : existing.reviewNotes,
  });

  res.status(200).json({
    message: 'Complaint review updated successfully.',
    complaint: updated,
  });
});
