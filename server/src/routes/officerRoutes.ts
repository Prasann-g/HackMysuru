import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { complaintStore } from '../db/complaintStore.js';
import { userStore } from '../db/userStore.js';
import { assessDelayRisk } from '../services/delayRiskEngine.js';
import { followthroughRepository } from '../modules/followthrough/followthrough.repository.js';
import type { ComplaintStatus, OfficerReviewInput } from '../types/complaint.js';

export const officerRouter = Router();

// All officer routes strictly enforce OFFICER or ADMIN role
officerRouter.use(requireAuth, requireRole(['OFFICER', 'ADMIN']));

// 1. Officer Review Queue with Filtering and Search
officerRouter.get('/complaints', async (req, res) => {
  const { status, locationArea, category, duplicateRisk, delayRisk, q } = req.query as {
    status?: string;
    locationArea?: string;
    category?: string;
    duplicateRisk?: string;
    delayRisk?: string;
    q?: string;
  };

  try {
    const complaints = await complaintStore.listForOfficer({
      status,
      locationArea,
      category,
      duplicateRisk,
      q,
    });

    // Compute live delay risk for each complaint in queue
    const complaintsWithRisk = complaints.map((c) => ({
      ...c,
      delayRisk: assessDelayRisk(c),
    }));

    const filtered = delayRisk
      ? complaintsWithRisk.filter((c) => c.delayRisk.riskLevel === delayRisk.toUpperCase())
      : complaintsWithRisk;

    res.status(200).json({
      count: filtered.length,
      complaints: filtered,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve complaints queue.', details: err.message });
  }
});

// 2. View Single Complaint with Duplicate Matches and Citizen Contact (Officer only)
officerRouter.get('/complaints/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const complaint = await complaintStore.findById(id);
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found.' });
      return;
    }

    const matchedCandidates = await complaintStore.findMatchesForComplaint(id);
    const citizen = await userStore.findById(complaint.citizenId);
    const complaintWithRisk = {
      ...complaint,
      delayRisk: assessDelayRisk(complaint),
    };

    res.status(200).json({
      complaint: complaintWithRisk,
      matchedCandidates,
      citizen: citizen
        ? {
            id: citizen.id,
            name: citizen.name,
            email: citizen.email,
            ward: citizen.ward,
          }
        : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve complaint details.', details: err.message });
  }
});

// 3. Officer Review / Action on Complaint
officerRouter.patch('/complaints/:id/review', async (req, res) => {
  const { id } = req.params;
  const { status, assignedDepartment, assignedOfficerId, reviewNotes } =
    req.body as OfficerReviewInput;

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

  try {
    const existing = await complaintStore.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'Complaint not found.' });
      return;
    }

    const isStatusChange = Boolean(status && status !== existing.status);
    const now = new Date().toISOString();

    const updated = await complaintStore.update(id, {
      status: status || existing.status,
      assignedDepartment: assignedDepartment !== undefined ? assignedDepartment : existing.assignedDepartment,
      assignedOfficerId: assignedOfficerId !== undefined ? assignedOfficerId : (existing.assignedOfficerId || req.user!.userId),
      reviewNotes: reviewNotes !== undefined ? reviewNotes : existing.reviewNotes,
      resolvedAt: status === 'RESOLVED' && !existing.resolvedAt ? now : existing.resolvedAt,
      resolvedByOfficerId: status === 'RESOLVED' && !existing.resolvedByOfficerId ? req.user!.userId : existing.resolvedByOfficerId,
    });

    // Record activity log for Follow-through lifecycle tracking (only after update succeeds)
    try {
      await followthroughRepository.logActivity({
        id: `ACT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        complaintId: id,
        eventType: isStatusChange ? 'STATUS_CHANGED' : 'OFFICER_REVIEW',
        sourceTable: 'complaints',
        sourceRecordId: id,
        actorId: req.user!.userId,
        actorName: req.user?.email,
        actorRole: 'OFFICER',
        oldStatus: existing.status,
        newStatus: status || existing.status,
        notes: reviewNotes !== undefined ? reviewNotes : (isStatusChange ? `Status changed to ${status}.` : 'Officer review committed.'),
        metadata: {
          assignedDepartment: assignedDepartment !== undefined ? assignedDepartment : existing.assignedDepartment,
          assignedOfficerId: assignedOfficerId !== undefined ? assignedOfficerId : existing.assignedOfficerId,
        },
        createdAt: now,
      });
    } catch (logErr: any) {
      console.error('[officerRoutes] Failed to log review activity:', logErr.message);
    }

    res.status(200).json({
      message: 'Complaint review updated successfully.',
      complaint: updated,
    });
  } catch (err: any) {
    console.error('[officerRoutes] Failed to update complaint review:', err.message);
    res.status(500).json({ error: 'Failed to update complaint review.' });
  }
});
