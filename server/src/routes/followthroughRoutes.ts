import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { followthroughService } from '../modules/followthrough/followthrough.service.js';
import { followthroughRepository } from '../modules/followthrough/followthrough.repository.js';
import { PROTOTYPE_SLA_DISCLAIMER } from '../modules/followthrough/followthroughConfig.js';

export const followthroughRouter = Router();

// 1. Complaint Chronological Timeline (Citizen or Officer)
followthroughRouter.get('/complaints/:id/timeline', requireAuth, async (req, res) => {
  const id = req.params.id as string;

  try {
    const complaint = await followthroughRepository.getComplaintById(id);
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found.' });
      return;
    }

    // Citizen Isolation: Citizens can ONLY view timeline of their own complaints
    const isCitizen = req.user!.role === 'CITIZEN';
    if (isCitizen && complaint.citizenId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied: You can only view your own complaints.' });
      return;
    }

    const activities = await followthroughRepository.getActivitiesForComplaint(id);
    const audits = await followthroughRepository.getAuditLogsForComplaint(id);
    const timeline = followthroughService.assembleTimeline(complaint, activities, audits, isCitizen);

    res.status(200).json({
      complaintId: id,
      count: timeline.length,
      timeline,
    });
  } catch (err: any) {
    console.error('[followthroughRoutes] Failed to retrieve timeline:', err.message);
    res.status(500).json({ error: 'Failed to retrieve complaint timeline.' });
  }
});

// 2. Complaint Follow-Through Dossier (Timeline + SLA + Inactivity + Delay-Risk)
followthroughRouter.get('/complaints/:id/dossier', requireAuth, async (req, res) => {
  const id = req.params.id as string;

  try {
    const complaint = await followthroughRepository.getComplaintById(id);
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found.' });
      return;
    }

    // Citizen Isolation: Citizens can ONLY view dossier of their own complaints
    const isCitizen = req.user!.role === 'CITIZEN';
    if (isCitizen && complaint.citizenId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied: You can only view your own complaints.' });
      return;
    }

    const dossier = await followthroughService.getFollowThroughDossier(id, isCitizen);
    if (!dossier) {
      res.status(404).json({ error: 'Failed to assemble follow-through dossier.' });
      return;
    }

    res.status(200).json(dossier);
  } catch (err: any) {
    console.error('[followthroughRoutes] Failed to retrieve dossier:', err.message);
    res.status(500).json({ error: 'Failed to retrieve follow-through dossier.' });
  }
});

// 3. Officer Queue Filter: Overdue Complaints
followthroughRouter.get(
  '/officer/overdue',
  requireAuth,
  requireRole(['OFFICER', 'ADMIN']),
  async (_req, res) => {
    try {
      const overdue = await followthroughService.listOverdueComplaints();
      res.status(200).json({
        count: overdue.length,
        items: overdue,
        disclaimer: PROTOTYPE_SLA_DISCLAIMER,
      });
    } catch (err: any) {
      console.error('[followthroughRoutes] Failed to retrieve overdue queue:', err.message);
      res.status(500).json({ error: 'Failed to retrieve overdue complaints queue.' });
    }
  }
);

// 4. Officer Queue Filter: Inactive / Dormant Complaints
followthroughRouter.get(
  '/officer/inactive',
  requireAuth,
  requireRole(['OFFICER', 'ADMIN']),
  async (_req, res) => {
    try {
      const inactive = await followthroughService.listInactiveComplaints();
      res.status(200).json({
        count: inactive.length,
        items: inactive,
        disclaimer: 'Follow-up indicator triggered according to configured monitoring threshold.',
      });
    } catch (err: any) {
      console.error('[followthroughRoutes] Failed to retrieve inactive queue:', err.message);
      res.status(500).json({ error: 'Failed to retrieve inactive complaints queue.' });
    }
  }
);
