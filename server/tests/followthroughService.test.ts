import { describe, it, expect, beforeEach } from 'vitest';
import { followthroughService } from '../src/modules/followthrough/followthrough.service.js';
import type { ComplaintRecord, ComplaintResolutionAuditRecord } from '../src/types/complaint.js';
import type { ActivityLogRecord } from '../src/modules/followthrough/followthrough.types.js';

describe('FollowthroughService (Step 2 Implementation)', () => {
  const baseComplaint: ComplaintRecord = {
    id: 'MCC-TEST-FT-001',
    trackingToken: 'TRK-FT-001',
    citizenId: 'CITIZEN-001',
    category: 'garbage_dumping',
    description: 'Waste dumped near community center.',
    observedDate: '2026-09-18',
    locationArea: 'Kuvempunagar',
    hasImage: false,
    status: 'IN_PROGRESS',
    isDemo: false,
    createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(), // 36 hours ago
    updatedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    assignedOfficerId: 'OFFICER-001',
    assignedDepartment: 'Solid Waste Management',
  };

  const sampleActivities: ActivityLogRecord[] = [
    {
      id: 'ACT-001',
      complaintId: baseComplaint.id,
      eventType: 'STATUS_CHANGED',
      sourceTable: 'complaints',
      sourceRecordId: baseComplaint.id,
      actorId: 'OFFICER-001',
      actorName: 'Inspector Kumar',
      actorRole: 'OFFICER',
      oldStatus: 'SUBMITTED',
      newStatus: 'UNDER_REVIEW',
      notes: 'Initial triage completed.',
      createdAt: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
    },
    {
      id: 'ACT-002',
      complaintId: baseComplaint.id,
      eventType: 'OFFICER_REVIEW',
      sourceTable: 'complaints',
      sourceRecordId: baseComplaint.id,
      actorId: 'OFFICER-001',
      actorName: 'Inspector Kumar',
      actorRole: 'OFFICER',
      notes: 'Internal inspection note: equipment scheduled for dispatch.',
      metadata: { internalCrewId: 'CREW-9' },
      createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    },
  ];

  const sampleAudits: ComplaintResolutionAuditRecord[] = [
    {
      id: 'AUD-001',
      clusterId: 'CLUSTER-001',
      primaryComplaintId: baseComplaint.id,
      secondaryComplaintIds: ['MCC-OTHER-002'],
      actionType: 'MARK_RELATED',
      officerId: 'OFFICER-001',
      officerName: 'Inspector Kumar',
      decisionNotes: 'Related grievance in same lane.',
      previousStates: {},
      createdAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    },
  ];

  describe('assembleTimeline', () => {
    it('orders events chronologically from earliest to latest', () => {
      const timeline = followthroughService.assembleTimeline(
        baseComplaint,
        sampleActivities,
        sampleAudits,
        false
      );

      expect(timeline.length).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < timeline.length - 1; i++) {
        const t1 = new Date(timeline[i].timestamp).getTime();
        const t2 = new Date(timeline[i + 1].timestamp).getTime();
        expect(t1).toBeLessThanOrEqual(t2);
      }
    });

    it('sanitizes officer personal names, internal notes, and metadata in citizen view', () => {
      const citizenTimeline = followthroughService.assembleTimeline(
        baseComplaint,
        sampleActivities,
        sampleAudits,
        true // isCitizenView
      );

      const reviewEvent = citizenTimeline.find((e) => e.eventType === 'OFFICER_REVIEW');
      expect(reviewEvent).toBeDefined();
      expect(reviewEvent?.actor?.name).toBeUndefined();
      expect(reviewEvent?.details).toBeUndefined();
      expect(reviewEvent?.description).toContain('Municipal officer reviewed grievance particulars');
      expect(reviewEvent?.description).not.toContain('CREW-9');
    });

    it('retains officer names, metadata, and internal notes in officer view', () => {
      const officerTimeline = followthroughService.assembleTimeline(
        baseComplaint,
        sampleActivities,
        sampleAudits,
        false // isCitizenView
      );

      const reviewEvent = officerTimeline.find((e) => e.eventType === 'OFFICER_REVIEW');
      expect(reviewEvent).toBeDefined();
      expect(reviewEvent?.actor?.name).toBe('Inspector Kumar');
      expect(reviewEvent?.description).toContain('Internal inspection note');
      expect(reviewEvent?.details).toEqual({ internalCrewId: 'CREW-9' });
    });

    it('handles malformed or missing timestamps safely without throwing', () => {
      const corruptActivity: ActivityLogRecord = {
        id: 'ACT-CORRUPT',
        complaintId: baseComplaint.id,
        eventType: 'STATUS_CHANGED',
        sourceTable: 'complaints',
        sourceRecordId: baseComplaint.id,
        createdAt: 'invalid-date-string',
      };

      expect(() => {
        followthroughService.assembleTimeline(
          baseComplaint,
          [corruptActivity],
          [],
          false
        );
      }).not.toThrow();
    });
  });

  describe('calculateSla', () => {
    it('calculates SLA using slaBenchmarks.ts targets and reports prototype disclaimer', () => {
      const sla = followthroughService.calculateSla(baseComplaint);
      // garbage_dumping benchmark is 24 hours
      expect(sla.targetHours).toBe(24);
      expect(sla.elapsedHours).toBeGreaterThanOrEqual(35);
      expect(sla.overdue).toBe(true);
      expect(sla.slaState).toBe('OVERDUE');
      expect(sla.disclaimer).toContain('Prototype monitoring target');
    });

    it('marks completed complaints as COMPLETED and not overdue', () => {
      const completedComplaint: ComplaintRecord = {
        ...baseComplaint,
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
      };

      const sla = followthroughService.calculateSla(completedComplaint);
      expect(sla.slaState).toBe('COMPLETED');
      expect(sla.overdue).toBe(false);
      expect(sla.remainingHours).toBe(0);
    });
  });

  describe('calculateInactivity', () => {
    it('evaluates elapsed hours since last meaningful activity', () => {
      const now = new Date();
      const inactivity = followthroughService.calculateInactivity(
        baseComplaint,
        sampleActivities,
        sampleAudits,
        now
      );

      // Latest activity was ACT-002 (12 hours ago)
      expect(inactivity.inactivityHours).toBeCloseTo(12, 0);
      expect(inactivity.activityState).toBe('ACTIVE');
      expect(inactivity.thresholdHours).toBe(48);
    });

    it('triggers INACTIVE state when dormancy exceeds threshold', () => {
      const staleComplaint: ComplaintRecord = {
        ...baseComplaint,
        createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      };

      const inactivity = followthroughService.calculateInactivity(
        staleComplaint,
        [], // no recent activities
        [],
        new Date()
      );

      expect(inactivity.inactivityHours).toBeGreaterThanOrEqual(48);
      expect(inactivity.activityState).toBe('INACTIVE');
      expect(inactivity.explanation).toContain('No recorded meaningful activity');
    });

    it('sets activityState to COMPLETED for resolved or closed complaints', () => {
      const resolvedComplaint: ComplaintRecord = {
        ...baseComplaint,
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
      };

      const inactivity = followthroughService.calculateInactivity(
        resolvedComplaint,
        sampleActivities,
        sampleAudits,
        new Date()
      );

      expect(inactivity.activityState).toBe('COMPLETED');
      expect(inactivity.inactivityHours).toBe(0);
    });
  });
});
