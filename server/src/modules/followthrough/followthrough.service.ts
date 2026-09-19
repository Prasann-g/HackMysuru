import type {
  ComplaintRecord,
  ComplaintResolutionAuditRecord,
} from '../../types/complaint.js';
import { followthroughRepository } from './followthrough.repository.js';
import {
  PROTOTYPE_SLA_DISCLAIMER,
  DUE_SOON_THRESHOLD_HOURS,
  INACTIVITY_THRESHOLD_HOURS,
} from './followthroughConfig.js';
import { calculateSlaMetrics } from '../../utils/slaBenchmarks.js';
import { assessDelayRisk } from '../../services/delayRiskEngine.js';
import type {
  ActivityLogRecord,
  TimelineEvent,
  SlaIndicator,
  InactivityIndicator,
  FollowThroughDossier,
  SlaState,
  ActivityState,
} from './followthrough.types.js';

export class FollowthroughService {
  /**
   * Assembles a chronological, deduplicated timeline of real observed events.
   * Citizen view strictly sanitizes internal officer review notes, officer personal names,
   * verification internals, and sensitive source record metadata.
   */
  public assembleTimeline(
    complaint: ComplaintRecord,
    activities: ActivityLogRecord[],
    audits: ComplaintResolutionAuditRecord[],
    isCitizenView: boolean = false
  ): TimelineEvent[] {
    const rawEvents: TimelineEvent[] = [];

    // Track event identifiers to prevent accidental duplication
    const seenEventKeys = new Set<string>();

    // 1. Complaint Created Event (from complaints.created_at)
    const createKey = `COMPLAINT_CREATED:${complaint.id}`;
    seenEventKeys.add(createKey);

    rawEvents.push({
      id: `EVT-CREATE-${complaint.id}`,
      eventType: 'COMPLAINT_CREATED',
      timestamp: complaint.createdAt,
      title: 'Complaint Registered',
      description: isCitizenView
        ? `Grievance registered in ward ${complaint.locationArea || 'Mysuru'} under category: ${(complaint.category || 'other').replace(/_/g, ' ')}.`
        : `Grievance registered in ward ${complaint.locationArea || 'Mysuru'} under category: ${(complaint.category || 'other').replace(/_/g, ' ')}. Description: ${complaint.description.substring(0, 100)}${complaint.description.length > 100 ? '...' : ''}`,
      actor: isCitizenView
        ? { role: 'Citizen' }
        : { name: 'Citizen Submitter', role: 'CITIZEN' },
      details: isCitizenView
        ? undefined
        : {
            category: complaint.category,
            locationArea: complaint.locationArea,
            hasImage: complaint.hasImage,
          },
      source: {
        table: 'complaints',
        recordId: complaint.id,
      },
    });

    // 2. Automated Verification Event (from complaints.verification_result)
    if (complaint.verificationResult) {
      const vResult = complaint.verificationResult;
      const vTime = vResult.processedAt || complaint.createdAt;

      rawEvents.push({
        id: `EVT-VERIFY-${complaint.id}`,
        eventType: 'VERIFICATION_PROCESSED',
        timestamp: vTime,
        title: 'Verification Signals Computed',
        description: isCitizenView
          ? 'Automated municipal intake verification completed.'
          : `Automated intake analysis completed. Outcome: ${vResult.outcome.replace(/_/g, ' ')}. Duplicate risk: ${vResult.duplicateRisk}.`,
        actor: {
          name: isCitizenView ? undefined : 'CivicTrust Verification Engine',
          role: 'SYSTEM',
        },
        details: isCitizenView
          ? undefined
          : {
              outcome: vResult.outcome,
              duplicateRisk: vResult.duplicateRisk,
              signalsCount: vResult.signals?.length || 0,
            },
        source: {
          table: 'complaints',
          recordId: complaint.id,
        },
      });
    }

    // 3. Activity Log Events (from complaint_activity_log)
    for (const act of activities) {
      // Avoid duplicate initial complaint created event if logged in activity table as well
      if (act.eventType === 'COMPLAINT_CREATED' && act.sourceRecordId === complaint.id) {
        continue;
      }

      const dedupeKey = `${act.eventType}:${act.sourceTable}:${act.sourceRecordId}:${act.createdAt}`;
      if (seenEventKeys.has(dedupeKey)) {
        continue;
      }
      seenEventKeys.add(dedupeKey);

      let title = 'Lifecycle Activity Logged';
      let description = isCitizenView
        ? 'Activity recorded in municipal workflow.'
        : act.notes || 'Activity recorded in municipal workflow.';

      if (act.eventType === 'STATUS_CHANGED') {
        title = `Status Changed to ${act.newStatus || 'Updated'}`;
        description = act.oldStatus
          ? `Status transitioned from ${act.oldStatus} to ${act.newStatus}.`
          : `Status set to ${act.newStatus}.`;
      } else if (act.eventType === 'OFFICER_REVIEW') {
        title = 'Officer Review Committed';
        description = isCitizenView
          ? 'Municipal officer reviewed grievance particulars and updated work status.'
          : act.notes || 'Officer review notes and action recorded.';
      } else if (act.eventType === 'DEPARTMENT_ROUTED') {
        title = 'Department Routing Updated';
        description = `Assigned to ${act.metadata?.department || 'responsible division'}.`;
      } else if (act.eventType === 'OFFICER_ASSIGNED') {
        title = 'Field Officer Assigned';
        description = isCitizenView
          ? 'Assigned to designated ward engineer for field remediation.'
          : `Assigned to officer ID: ${act.actorId || 'Staff'}.`;
      } else if (act.eventType === 'RESOLVED') {
        title = 'Grievance Resolved';
        description = isCitizenView
          ? 'Grievance resolution verified and marked complete.'
          : act.notes || 'Grievance resolved by assigned officer.';
      } else if (act.eventType === 'CLOSED') {
        title = 'Grievance Closed';
        description = isCitizenView
          ? 'Grievance administrative cycle concluded.'
          : act.notes || 'Complaint closed.';
      } else if (act.eventType === 'LOCATION_UPDATED') {
        title = 'Location Refined';
        description = isCitizenView
          ? (act.metadata?.wardNumber ? `Grievance location updated to Ward ${act.metadata.wardNumber} (${act.metadata.wardName || ''}).` : 'Grievance GPS location refined by submitter.')
          : act.notes || 'Complaint GPS location updated by submitter.';
      }

      rawEvents.push({
        id: `EVT-ACT-${act.id}`,
        eventType: act.eventType,
        timestamp: act.createdAt,
        title,
        description,
        actor: {
          name: isCitizenView ? undefined : act.actorName,
          role: isCitizenView ? (act.actorRole === 'CITIZEN' ? 'Citizen' : 'Municipal Officer') : (act.actorRole || 'OFFICER'),
        },
        statusTransition: act.newStatus
          ? { from: act.oldStatus, to: act.newStatus }
          : undefined,
        details: isCitizenView ? undefined : act.metadata,
        source: {
          table: act.sourceTable || 'complaint_activity_log',
          recordId: act.sourceRecordId || act.id,
        },
      });
    }

    // 4. Duplicate Cluster Audit Events (from complaint_resolution_audit)
    for (const audit of audits) {
      const isPrimary = audit.primaryComplaintId === complaint.id;
      const actionLabel = audit.actionType.replace(/_/g, ' ');
      const desc = isCitizenView
        ? `Administrative cluster evaluation: ${actionLabel}.`
        : `Duplicate cluster review by ${audit.officerName}: ${audit.decisionNotes}`;

      rawEvents.push({
        id: `EVT-AUDIT-${audit.id}`,
        eventType: 'DUPLICATE_ACTION',
        timestamp: audit.createdAt,
        title: `Cluster Decision: ${actionLabel}`,
        description: desc,
        actor: {
          name: isCitizenView ? undefined : audit.officerName,
          role: isCitizenView ? 'Municipal Officer' : 'OFFICER',
        },
        details: isCitizenView
          ? undefined
          : {
              clusterId: audit.clusterId,
              actionType: audit.actionType,
              isPrimary,
            },
        source: {
          table: 'complaint_resolution_audit',
          recordId: audit.id,
        },
      });
    }

    // Sort chronologically (earliest first). Handle missing or invalid timestamps safely.
    return rawEvents.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      const validA = !isNaN(tA) ? tA : 0;
      const validB = !isNaN(tB) ? tB : 0;
      return validA - validB;
    });
  }

  /**
   * Calculates operational SLA monitoring indicator using the main project's existing slaBenchmarks.ts.
   * Zero duplication of category target hours.
   */
  public calculateSla(complaint: ComplaintRecord, now: Date = new Date()): SlaIndicator {
    const isCompleted = complaint.status === 'RESOLVED' || complaint.status === 'CLOSED';
    const metrics = calculateSlaMetrics(complaint.category, complaint.createdAt, now);

    const createdDate = new Date(complaint.createdAt);
    const validCreated = !isNaN(createdDate.getTime()) ? createdDate : now;
    const targetMs = metrics.slaTargetHours * 60 * 60 * 1000;
    const dueTime = new Date(validCreated.getTime() + targetMs).toISOString();

    let slaState: SlaState = 'UNKNOWN';
    if (isCompleted) {
      slaState = 'COMPLETED';
    } else if (metrics.status === 'BREACHED') {
      slaState = 'OVERDUE';
    } else if (metrics.remainingHours <= DUE_SOON_THRESHOLD_HOURS) {
      slaState = 'DUE_SOON';
    } else {
      slaState = 'ON_TRACK';
    }

    return {
      slaStartTime: validCreated.toISOString(),
      slaDueTime: dueTime,
      targetHours: metrics.slaTargetHours,
      elapsedHours: metrics.elapsedHours,
      remainingHours: isCompleted ? 0 : metrics.remainingHours,
      overdue: !isCompleted && metrics.status === 'BREACHED',
      slaState,
      disclaimer: PROTOTYPE_SLA_DISCLAIMER,
    };
  }

  /**
   * Calculates dormancy and meaningful activity indicator based on real observed timestamps.
   * Handles missing, malformed, or incomplete timestamps safely without crashing.
   */
  public calculateInactivity(
    complaint: ComplaintRecord,
    activities: ActivityLogRecord[],
    audits: ComplaintResolutionAuditRecord[],
    now: Date = new Date()
  ): InactivityIndicator {
    const isCompleted = complaint.status === 'RESOLVED' || complaint.status === 'CLOSED';

    // Collect all valid timestamps from complaint, activities, audits, and resolution
    const timestamps: number[] = [];

    const rootCreated = new Date(complaint.createdAt).getTime();
    if (!isNaN(rootCreated)) timestamps.push(rootCreated);

    const rootUpdated = new Date(complaint.updatedAt).getTime();
    if (!isNaN(rootUpdated)) timestamps.push(rootUpdated);

    for (const act of activities) {
      const t = new Date(act.createdAt).getTime();
      if (!isNaN(t)) timestamps.push(t);
    }

    for (const audit of audits) {
      const t = new Date(audit.createdAt).getTime();
      if (!isNaN(t)) timestamps.push(t);
    }

    if (complaint.resolvedAt) {
      const t = new Date(complaint.resolvedAt).getTime();
      if (!isNaN(t)) timestamps.push(t);
    }

    const validTimestamps = timestamps.filter((t) => !isNaN(t) && t > 0);
    const latestMs = validTimestamps.length > 0 ? Math.max(...validTimestamps) : (isNaN(rootCreated) ? now.getTime() : rootCreated);
    const lastMeaningfulActivityAt = new Date(latestMs).toISOString();

    if (isCompleted) {
      return {
        lastMeaningfulActivityAt,
        inactivityHours: 0,
        thresholdHours: INACTIVITY_THRESHOLD_HOURS,
        activityState: 'COMPLETED',
        explanation: 'Complaint lifecycle is complete (Resolved or Closed). Dormancy monitoring concluded.',
      };
    }

    const nowMs = now.getTime();
    const inactivityMs = Math.max(0, nowMs - latestMs);
    const inactivityHours = Math.round((inactivityMs / (3600 * 1000)) * 10) / 10;

    const isInactive = inactivityHours >= INACTIVITY_THRESHOLD_HOURS;
    const activityState: ActivityState = isInactive ? 'INACTIVE' : 'ACTIVE';

    const explanation = isInactive
      ? `No recorded meaningful activity for ${inactivityHours} hours according to the configured monitoring threshold (${INACTIVITY_THRESHOLD_HOURS} hours).`
      : `Active: Last recorded meaningful activity was ${inactivityHours} hours ago (threshold: ${INACTIVITY_THRESHOLD_HOURS} hours).`;

    return {
      lastMeaningfulActivityAt,
      inactivityHours,
      thresholdHours: INACTIVITY_THRESHOLD_HOURS,
      activityState,
      explanation,
    };
  }

  /**
   * Builds the comprehensive FollowThroughDossier for a given complaint ID.
   * Strictly uses the main project's existing assessDelayRisk() engine and slaBenchmarks.ts.
   * No duplicated models or contradictory SLA hours.
   */
  public async getFollowThroughDossier(
    complaintId: string,
    isCitizenView: boolean = false
  ): Promise<FollowThroughDossier | undefined> {
    const complaint = await followthroughRepository.getComplaintById(complaintId);
    if (!complaint) return undefined;

    const activities = await followthroughRepository.getActivitiesForComplaint(complaintId);
    const audits = await followthroughRepository.getAuditLogsForComplaint(complaintId);

    const now = new Date();
    const timeline = this.assembleTimeline(complaint, activities, audits, isCitizenView);
    const sla = this.calculateSla(complaint, now);
    const inactivity = this.calculateInactivity(complaint, activities, audits, now);

    // Reuse the main project's existing delay-risk prediction engine
    const delayRisk = assessDelayRisk(complaint, now);

    return {
      complaintId: complaint.id,
      trackingToken: complaint.trackingToken,
      currentStatus: complaint.status,
      category: complaint.category,
      observed: {
        createdAt: complaint.createdAt,
        observedDate: complaint.observedDate,
        resolvedAt: complaint.resolvedAt,
        lastActivityAt: inactivity.lastMeaningfulActivityAt,
        assignedDepartment: complaint.assignedDepartment,
        assignedOfficerId: isCitizenView ? undefined : complaint.assignedOfficerId,
      },
      timeline,
      sla,
      inactivity,
      delayRisk,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Retrieves active complaints exceeding the operational SLA benchmark.
   */
  public async listOverdueComplaints(): Promise<Array<{ complaint: ComplaintRecord; sla: SlaIndicator }>> {
    const active = await followthroughRepository.listActiveComplaints();
    const now = new Date();
    const results: Array<{ complaint: ComplaintRecord; sla: SlaIndicator }> = [];

    for (const c of active) {
      const sla = this.calculateSla(c, now);
      if (sla.overdue) {
        results.push({ complaint: c, sla });
      }
    }

    return results;
  }

  /**
   * Retrieves active complaints with inactivity exceeding the configured threshold (48h).
   */
  public async listInactiveComplaints(): Promise<Array<{ complaint: ComplaintRecord; inactivity: InactivityIndicator }>> {
    const active = await followthroughRepository.listActiveComplaints();
    const now = new Date();
    const results: Array<{ complaint: ComplaintRecord; inactivity: InactivityIndicator }> = [];

    for (const c of active) {
      const activities = await followthroughRepository.getActivitiesForComplaint(c.id);
      const audits = await followthroughRepository.getAuditLogsForComplaint(c.id);
      const inactivity = this.calculateInactivity(c, activities, audits, now);

      if (inactivity.activityState === 'INACTIVE') {
        results.push({ complaint: c, inactivity });
      }
    }

    return results;
  }
}

export const followthroughService = new FollowthroughService();
