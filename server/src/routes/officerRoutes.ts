import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { complaintStore } from '../db/complaintStore.js';
import { userStore } from '../db/userStore.js';
import { assessDelayRisk } from '../services/delayRiskEngine.js';
import { followthroughRepository } from '../modules/followthrough/followthrough.repository.js';
import { applyOfficerOverride, evaluateRouting } from '../services/routingEngine.js';
import type {
  ComplaintRecord,
  ComplaintStatus,
  OfficerReviewInput,
  OfficerDuplicateResolutionInput,
  ComplaintResolutionAuditRecord,
  ResolutionActionType,
} from '../types/complaint.js';
import type { OfficerRerouteInput } from '../types/routing.js';

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

// 4. Officer Routing Override with Audit Trail
officerRouter.patch('/complaints/:id/reroute', async (req, res) => {
  const { id } = req.params;
  const { authorityType, department, overrideReason } = req.body as OfficerRerouteInput;

  if (!overrideReason || typeof overrideReason !== 'string' || overrideReason.trim().length === 0) {
    res.status(400).json({
      error: 'Override reason is mandatory and cannot be empty.',
    });
    return;
  }

  const validAuthorities = ['MCC', 'TOWN_PANCHAYAT', 'GRAM_PANCHAYAT', 'UNKNOWN'];
  if (authorityType && !validAuthorities.includes(authorityType)) {
    res.status(400).json({
      error: `Invalid authority type. Allowed values: ${validAuthorities.join(', ')}.`,
    });
    return;
  }

  try {
    const complaint = await complaintStore.findById(id);
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found.' });
      return;
    }

    // Ensure we have an existing routing decision, or create one on the fly for legacy records
    const currentDecision =
      complaint.routingDecision ||
      evaluateRouting({
        latitude: complaint.latitude,
        longitude: complaint.longitude,
        locationArea: complaint.locationArea,
        addressText: complaint.addressText,
        category: complaint.category,
        observedDate: complaint.observedDate,
        verificationOutcome: complaint.verificationResult?.outcome,
        duplicateRisk: complaint.verificationResult?.duplicateRisk,
      });

    // Derive officer identity strictly from server-side authenticated session
    const officerUser = await userStore.findById(req.user!.userId);
    const officerInfo = {
      id: req.user!.userId,
      name: officerUser?.name || 'Municipal Officer',
      role: req.user!.role,
    };

    const updatedDecision = applyOfficerOverride(currentDecision, officerInfo, {
      authorityType,
      department,
      overrideReason,
    });

    const now = new Date().toISOString();
    const updated = await complaintStore.update(id, {
      routingDecision: updatedDecision,
      assignedDepartment: updatedDecision.department,
    });

    // Record Follow-through activity log for officer routing override
    try {
      await followthroughRepository.logActivity({
        id: `ACT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        complaintId: id,
        eventType: 'OFFICER_REVIEW',
        sourceTable: 'complaints',
        sourceRecordId: id,
        actorId: req.user!.userId,
        actorName: officerUser?.name || req.user?.email || 'Officer',
        actorRole: 'OFFICER',
        oldStatus: complaint.status,
        newStatus: complaint.status,
        notes: `Jurisdiction rerouted to ${updatedDecision.authorityName} (${updatedDecision.department}): ${overrideReason}`,
        metadata: {
          rerouted: true,
          previousAuthority: currentDecision.authorityType,
          newAuthority: updatedDecision.authorityType,
          previousDepartment: currentDecision.department,
          newDepartment: updatedDecision.department,
          overrideReason,
        },
        createdAt: now,
      });
    } catch (logErr: any) {
      console.error('[officerRoutes] Failed to log reroute activity:', logErr.message);
    }

    res.status(200).json({
      message: 'Complaint routing decision overridden and audited successfully.',
      complaint: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to override complaint routing.', details: err.message });
  }
});

// 5. Officer Duplicate Cluster Resolution Decision
// Implements best-effort compensating rollback across store abstraction
officerRouter.post('/complaints/:id/duplicate-resolution', async (req, res) => {
  const { id } = req.params;
  const body = req.body as OfficerDuplicateResolutionInput;
  const { actionType, targetComplaintId, decisionNotes, clusterId: userClusterId, isCurrentSecondary } = body;

  // Validate decision notes
  if (!decisionNotes || typeof decisionNotes !== 'string' || decisionNotes.trim().length < 5) {
    res.status(400).json({
      error: 'Decision notes are mandatory and must be at least 5 characters long explaining the officer adjudication rationale.',
    });
    return;
  }

  // Validate supported resolution actions (UNLINK is explicitly excluded from this increment)
  const allowedActions = ['MERGE_DUPLICATES', 'MARK_DISTINCT', 'MARK_RELATED'];
  if (!actionType || !allowedActions.includes(actionType)) {
    res.status(400).json({
      error: `Invalid resolution action type. Allowed values for this increment: ${allowedActions.join(', ')}. UNLINK is excluded.`,
    });
    return;
  }

  // Validate identifiers
  if (!targetComplaintId || typeof targetComplaintId !== 'string') {
    res.status(400).json({ error: 'Target complaint identifier is required.' });
    return;
  }

  if (id === targetComplaintId) {
    res.status(400).json({ error: 'Cannot resolve a complaint against itself.' });
    return;
  }

  try {
    const currentComplaint = await complaintStore.findById(id);
    if (!currentComplaint) {
      res.status(404).json({ error: 'Complaint with specified ID not found.' });
      return;
    }

    const targetComplaint = await complaintStore.findById(targetComplaintId);
    if (!targetComplaint) {
      res.status(404).json({ error: 'Target candidate complaint with specified ID not found.' });
      return;
    }

    // Role and status verification for MERGE_DUPLICATES
    let primary: ComplaintRecord;
    let secondary: ComplaintRecord;
    let resolvedClusterId: string;

    if (actionType === 'MERGE_DUPLICATES') {
      if (isCurrentSecondary === true) {
        secondary = currentComplaint;
        primary = targetComplaint;
      } else if (isCurrentSecondary === false) {
        secondary = targetComplaint;
        primary = currentComplaint;
      } else {
        // Automatically determine primary vs secondary based on existing relationships or creation time
        if (currentComplaint.primaryComplaintId === targetComplaint.id) {
          secondary = currentComplaint;
          primary = targetComplaint;
        } else if (targetComplaint.primaryComplaintId === currentComplaint.id) {
          secondary = targetComplaint;
          primary = currentComplaint;
        } else {
          // Default: earlier reported grievance is master primary; newer is secondary duplicate
          const tCurrent = new Date(currentComplaint.createdAt).getTime();
          const tTarget = new Date(targetComplaint.createdAt).getTime();
          if (tTarget <= tCurrent) {
            primary = targetComplaint;
            secondary = currentComplaint;
          } else {
            primary = currentComplaint;
            secondary = targetComplaint;
          }
        }
      }

      // Guard: Cannot merge a complaint that is already closed or resolved
      if (secondary.status === 'CLOSED' || secondary.status === 'RESOLVED') {
        res.status(400).json({
          error: `Cannot merge complaint #${secondary.id} because it is already ${secondary.status}.`,
        });
        return;
      }

      if (primary.status === 'CLOSED') {
        res.status(400).json({
          error: `Cannot designate closed complaint #${primary.id} as the master primary complaint.`,
        });
        return;
      }

      resolvedClusterId =
        primary.duplicateClusterId ||
        secondary.duplicateClusterId ||
        userClusterId ||
        `CLUSTER-${primary.id}`;
    } else if (actionType === 'MARK_RELATED') {
      // Safeguard: do not overwrite an unrelated existing cluster without explicit compatibility
      const clusterA = currentComplaint.duplicateClusterId;
      const clusterB = targetComplaint.duplicateClusterId;
      if (clusterA && clusterB && clusterA !== clusterB) {
        res.status(400).json({
          error: `Cannot link complaints that already belong to different existing clusters ("${clusterA}" and "${clusterB}").`,
        });
        return;
      }

      resolvedClusterId = clusterA || clusterB || userClusterId || `CLUSTER-${currentComplaint.id}`;
      primary = currentComplaint;
      secondary = targetComplaint;
    } else {
      // MARK_DISTINCT: No shared cluster required
      resolvedClusterId = currentComplaint.duplicateClusterId || targetComplaint.duplicateClusterId || 'NONE';
      primary = currentComplaint;
      secondary = targetComplaint;
    }

    // Capture pre-snapshots for best-effort compensating rollback
    const previousStates: Record<string, any> = {
      [currentComplaint.id]: {
        status: currentComplaint.status,
        resolutionAction: currentComplaint.resolutionAction || 'NONE',
        duplicateClusterId: currentComplaint.duplicateClusterId || null,
        primaryComplaintId: currentComplaint.primaryComplaintId || null,
        reviewNotes: currentComplaint.reviewNotes || null,
      },
      [targetComplaint.id]: {
        status: targetComplaint.status,
        resolutionAction: targetComplaint.resolutionAction || 'NONE',
        duplicateClusterId: targetComplaint.duplicateClusterId || null,
        primaryComplaintId: targetComplaint.primaryComplaintId || null,
        reviewNotes: targetComplaint.reviewNotes || null,
      },
    };

    const officerUser = await userStore.findById(req.user!.userId);
    const officerName = officerUser?.name || req.user?.email || 'MCC Officer';
    const now = new Date().toISOString();

    const auditRecord: ComplaintResolutionAuditRecord = {
      id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      clusterId: resolvedClusterId,
      primaryComplaintId: actionType === 'MERGE_DUPLICATES' ? primary.id : currentComplaint.id,
      secondaryComplaintIds: actionType === 'MERGE_DUPLICATES' ? [secondary.id] : [targetComplaint.id],
      actionType: actionType as ResolutionActionType,
      officerId: req.user!.userId,
      officerName,
      decisionNotes: decisionNotes.trim(),
      previousStates,
      createdAt: now,
    };

    // Step 1: Persist audit record in authoritative store
    let savedAudit: ComplaintResolutionAuditRecord;
    try {
      savedAudit = await complaintStore.createAuditRecord(auditRecord);
    } catch (auditErr: any) {
      console.error('[officerRoutes] Failed to record duplicate resolution audit:', auditErr.message);
      res.status(500).json({
        error: 'Failed to record duplicate resolution audit record.',
        details: auditErr.message,
      });
      return;
    }

    // Step 2: Update secondary/target complaint
    try {
      if (actionType === 'MERGE_DUPLICATES') {
        await complaintStore.update(secondary.id, {
          status: 'CLOSED',
          primaryComplaintId: primary.id,
          duplicateClusterId: resolvedClusterId,
          resolutionAction: 'MERGE_DUPLICATES',
          resolvedByOfficerId: req.user!.userId,
          resolvedAt: now,
          reviewNotes: (secondary.reviewNotes ? secondary.reviewNotes + '\n' : '') +
            `[DUPLICATE CONSOLIDATION] Consolidated as duplicate of master #${primary.id}: ${decisionNotes.trim()}`,
        });
      } else if (actionType === 'MARK_DISTINCT') {
        await complaintStore.update(targetComplaint.id, {
          resolutionAction: 'MARK_DISTINCT',
          primaryComplaintId: targetComplaint.primaryComplaintId === currentComplaint.id ? undefined : targetComplaint.primaryComplaintId,
          reviewNotes: (targetComplaint.reviewNotes ? targetComplaint.reviewNotes + '\n' : '') +
            `[DISTINCT VERIFIED] Inspected and verified distinct from #${currentComplaint.id}: ${decisionNotes.trim()}`,
        });
      } else if (actionType === 'MARK_RELATED') {
        await complaintStore.update(targetComplaint.id, {
          duplicateClusterId: resolvedClusterId,
          resolutionAction: 'MARK_RELATED',
          reviewNotes: (targetComplaint.reviewNotes ? targetComplaint.reviewNotes + '\n' : '') +
            `[CLUSTER LINKED] Linked in cluster ${resolvedClusterId} with #${currentComplaint.id} for joint field dispatch: ${decisionNotes.trim()}`,
        });
      }
    } catch (secErr: any) {
      console.error('[officerRoutes] Secondary update failed; best-effort rollback of audit record:', secErr.message);
      res.status(500).json({
        error: 'Failed to update target complaint during duplicate resolution. Best-effort rollback initiated.',
        details: secErr.message,
      });
      return;
    }

    // Step 3: Update primary/current complaint
    try {
      if (actionType === 'MERGE_DUPLICATES') {
        // Master retains active status and resolutionAction 'NONE' (or existing valid action); master is identified by primaryComplaintId: null + clusterId
        await complaintStore.update(primary.id, {
          duplicateClusterId: resolvedClusterId,
          reviewNotes: (primary.reviewNotes ? primary.reviewNotes + '\n' : '') +
            `[CLUSTER MASTER] Consolidated with duplicate #${secondary.id}: ${decisionNotes.trim()}`,
        });
      } else if (actionType === 'MARK_DISTINCT') {
        await complaintStore.update(currentComplaint.id, {
          resolutionAction: 'MARK_DISTINCT',
          primaryComplaintId: currentComplaint.primaryComplaintId === targetComplaint.id ? undefined : currentComplaint.primaryComplaintId,
          reviewNotes: (currentComplaint.reviewNotes ? currentComplaint.reviewNotes + '\n' : '') +
            `[DISTINCT VERIFIED] Inspected and verified distinct from #${targetComplaint.id}: ${decisionNotes.trim()}`,
        });
      } else if (actionType === 'MARK_RELATED') {
        await complaintStore.update(currentComplaint.id, {
          duplicateClusterId: resolvedClusterId,
          resolutionAction: 'MARK_RELATED',
          reviewNotes: (currentComplaint.reviewNotes ? currentComplaint.reviewNotes + '\n' : '') +
            `[CLUSTER LINKED] Linked in cluster ${resolvedClusterId} with #${targetComplaint.id} for joint field dispatch: ${decisionNotes.trim()}`,
        });
      }
    } catch (primErr: any) {
      console.error('[officerRoutes] Primary update failed; attempting best-effort compensating rollback:', primErr.message);
      try {
        const secSnapshot = previousStates[actionType === 'MERGE_DUPLICATES' ? secondary.id : targetComplaint.id];
        await complaintStore.update(actionType === 'MERGE_DUPLICATES' ? secondary.id : targetComplaint.id, secSnapshot);
      } catch (rollbackErr: any) {
        console.error('[CRITICAL_ROLLBACK_FAILURE] Inconsistent state between complaints during rollback:', rollbackErr.message);
      }
      res.status(500).json({
        error: 'Failed to complete duplicate cluster resolution. Primary complaint update failed; compensating rollback was attempted.',
        details: primErr.message,
      });
      return;
    }

    // Step 4: Best-effort non-blocking Follow-Through activity log (never fails the response)
    try {
      await followthroughRepository.logActivity({
        id: `ACT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        complaintId: currentComplaint.id,
        eventType: 'OFFICER_REVIEW',
        sourceTable: 'complaints',
        sourceRecordId: currentComplaint.id,
        actorId: req.user!.userId,
        actorName: officerName,
        actorRole: 'OFFICER',
        oldStatus: currentComplaint.status,
        newStatus: (actionType === 'MERGE_DUPLICATES' && currentComplaint.id === secondary.id) ? 'CLOSED' : currentComplaint.status,
        notes: `Duplicate resolution decision recorded: ${actionType}. ${decisionNotes.trim()}`,
        metadata: {
          clusterId: resolvedClusterId,
          actionType,
          targetComplaintId,
        },
        createdAt: now,
      });
    } catch {
      // Best-effort non-blocking
    }

    const refreshedCurrent = await complaintStore.findById(id);
    res.status(200).json({
      success: true,
      message: `Duplicate cluster resolution successfully recorded: ${actionType}.`,
      auditRecord: savedAudit,
      auditId: savedAudit.id,
      clusterId: resolvedClusterId,
      actionType,
      primaryComplaintId: actionType === 'MERGE_DUPLICATES' ? primary.id : currentComplaint.id,
      secondaryComplaintIds: actionType === 'MERGE_DUPLICATES' ? [secondary.id] : [targetComplaint.id],
      updatedComplaint: refreshedCurrent,
    });
  } catch (err: any) {
    console.error('[officerRoutes] Duplicate resolution unhandled error:', err.message);
    res.status(500).json({
      error: 'Unexpected error during duplicate cluster resolution.',
      details: err.message,
    });
  }
});

// 6. Officer Duplicate Audit History for Complaint or Cluster
officerRouter.get('/complaints/:id/duplicate-audit', async (req, res) => {
  const { id } = req.params;

  try {
    const complaint = await complaintStore.findById(id);
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found.' });
      return;
    }

    const allAudits = await complaintStore.listAuditRecords();
    const clusterId = complaint.duplicateClusterId;

    const matchedAudits = allAudits.filter((a) => {
      if (a.primaryComplaintId === id) return true;
      if (Array.isArray(a.secondaryComplaintIds) && a.secondaryComplaintIds.includes(id)) return true;
      if (clusterId && a.clusterId === clusterId) return true;
      return false;
    });

    res.status(200).json({
      complaintId: id,
      count: matchedAudits.length,
      audits: matchedAudits,
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Failed to retrieve duplicate cluster audit history.',
      details: err.message,
    });
  }
});

