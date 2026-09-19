import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../src/index.js';
import { userStore } from '../src/db/userStore.js';
import { followthroughRepository } from '../src/modules/followthrough/followthrough.repository.js';
import type { ComplaintRecord } from '../src/types/complaint.js';

// Minimal 1x1 valid JPEG image buffer for upload tests
const sampleJpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

describe('Follow-Through Routes & Activity Hooks (Step 3 Integration)', () => {
  let server: Server;
  let baseUrl: string;
  let citizenAToken: string;
  let citizenAId: string;
  let citizenBToken: string;
  let citizenBId: string;
  let officerToken: string;
  let testComplaint: ComplaintRecord;

  beforeAll(async () => {
    userStore.seedDefaultUsers();

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });

    const nonce = Date.now();
    // 1. Register Citizen A
    const resA = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Followthrough Citizen A',
        email: `citizen.a.${nonce}@example.com`,
        password: 'password123',
        ward: 'Kuvempunagar',
      }),
    });
    const dataA = await resA.json();
    citizenAToken = dataA.token;
    citizenAId = dataA.user.id;

    // 2. Register Citizen B
    const resB = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Followthrough Citizen B',
        email: `citizen.b.${nonce}@example.com`,
        password: 'password123',
        ward: 'Gokulam',
      }),
    });
    const dataB = await resB.json();
    citizenBToken = dataB.token;
    citizenBId = dataB.user.id;

    // 3. Login Officer (Pre-seeded Ward 48 Officer)
    const resOff = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'officer.ward48@mcc.gov.in',
        password: 'Officer@Mysuru48',
      }),
    });
    const dataOff = await resOff.json();
    officerToken = dataOff.token;

    // 4. Create a complaint by Citizen A with valid coordinates and photographic evidence
    const form = new FormData();
    form.append('category', 'pothole');
    form.append('description', 'Large road crater on temple road causing traffic congestion.');
    form.append('observedDate', '2026-09-18');
    form.append('locationArea', 'Kuvempunagar');
    form.append('latitude', '12.2905');
    form.append('longitude', '76.6234');
    form.append('image', new Blob([sampleJpeg], { type: 'image/jpeg' }), 'pothole.jpg');

    const compRes = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenAToken}`,
      },
      body: form,
    });
    const compData = await compRes.json();
    testComplaint = compData.complaint;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('Activity Logging on Confirmed Operations', () => {
    it('automatically records COMPLAINT_CREATED activity when complaint registration succeeds', async () => {
      expect(testComplaint).toBeDefined();
      expect(testComplaint.id).toBeDefined();

      const activities = await followthroughRepository.getActivitiesForComplaint(testComplaint.id);
      const createdAct = activities.find((a) => a.eventType === 'COMPLAINT_CREATED');

      expect(createdAct).toBeDefined();
      expect(createdAct?.actorId).toBe(citizenAId);
      expect(createdAct?.newStatus).toBe('SUBMITTED');
    });

    it('records STATUS_CHANGED activity when an officer changes complaint status', async () => {
      const reviewRes = await fetch(`${baseUrl}/api/officer/complaints/${testComplaint.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officerToken}`,
        },
        body: JSON.stringify({
          status: 'UNDER_REVIEW',
          reviewNotes: 'Verified pothole on ward road map.',
        }),
      });

      expect(reviewRes.status).toBe(200);

      const activities = await followthroughRepository.getActivitiesForComplaint(testComplaint.id);
      const statusAct = activities.find((a) => a.eventType === 'STATUS_CHANGED' && a.newStatus === 'UNDER_REVIEW');

      expect(statusAct).toBeDefined();
      expect(statusAct?.oldStatus).toBe('SUBMITTED');
      expect(statusAct?.notes).toBe('Verified pothole on ward road map.');
    });

    it('records OFFICER_REVIEW activity when an officer updates notes without status change', async () => {
      const reviewRes = await fetch(`${baseUrl}/api/officer/complaints/${testComplaint.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officerToken}`,
        },
        body: JSON.stringify({
          reviewNotes: 'Assigned inspection engineer for site visit.',
        }),
      });

      expect(reviewRes.status).toBe(200);

      const activities = await followthroughRepository.getActivitiesForComplaint(testComplaint.id);
      const reviewAct = activities.find((a) => a.eventType === 'OFFICER_REVIEW');

      expect(reviewAct).toBeDefined();
      expect(reviewAct?.notes).toBe('Assigned inspection engineer for site visit.');
    });
  });

  describe('GET /api/followthrough/complaints/:id/timeline', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await fetch(`${baseUrl}/api/followthrough/complaints/${testComplaint.id}/timeline`);
      expect(res.status).toBe(401);
    });

    it('allows owner citizen to access timeline and sanitizes officer internal details', async () => {
      const res = await fetch(`${baseUrl}/api/followthrough/complaints/${testComplaint.id}/timeline`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.complaintId).toBe(testComplaint.id);
      expect(data.timeline).toBeInstanceOf(Array);
      expect(data.count).toBeGreaterThanOrEqual(1);

      // Verify privacy: no raw details or officer personal name exposed to citizen
      for (const evt of data.timeline) {
        if (evt.eventType === 'OFFICER_REVIEW') {
          expect(evt.actor?.name).toBeUndefined();
          expect(evt.details).toBeUndefined();
        }
      }
    });

    it('blocks unauthorized citizen from accessing another citizen complaint timeline (403)', async () => {
      const res = await fetch(`${baseUrl}/api/followthrough/complaints/${testComplaint.id}/timeline`, {
        headers: { Authorization: `Bearer ${citizenBToken}` }, // Citizen B
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Access denied');
    });

    it('allows officer to access timeline with full internal details', async () => {
      const res = await fetch(`${baseUrl}/api/followthrough/complaints/${testComplaint.id}/timeline`, {
        headers: { Authorization: `Bearer ${officerToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.timeline).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/followthrough/complaints/:id/dossier', () => {
    it('allows owner citizen to access dossier', async () => {
      const res = await fetch(`${baseUrl}/api/followthrough/complaints/${testComplaint.id}/dossier`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });

      expect(res.status).toBe(200);
      const dossier = await res.json();
      expect(dossier.complaintId).toBe(testComplaint.id);
      expect(dossier.timeline).toBeInstanceOf(Array);
      expect(dossier.sla).toBeDefined();
      expect(dossier.inactivity).toBeDefined();
      expect(dossier.delayRisk).toBeDefined();
    });

    it('blocks unauthorized citizen from accessing another citizen dossier (403)', async () => {
      const res = await fetch(`${baseUrl}/api/followthrough/complaints/${testComplaint.id}/dossier`, {
        headers: { Authorization: `Bearer ${citizenBToken}` },
      });

      expect(res.status).toBe(403);
    });
  });

  describe('Officer Queue Filters (/officer/overdue, /officer/inactive)', () => {
    it('blocks citizens from accessing officer queues (403)', async () => {
      const resOverdue = await fetch(`${baseUrl}/api/followthrough/officer/overdue`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      expect(resOverdue.status).toBe(403);

      const resInactive = await fetch(`${baseUrl}/api/followthrough/officer/inactive`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      expect(resInactive.status).toBe(403);
    });

    it('allows officers to access overdue and inactive queues (200)', async () => {
      const resOverdue = await fetch(`${baseUrl}/api/followthrough/officer/overdue`, {
        headers: { Authorization: `Bearer ${officerToken}` },
      });
      expect(resOverdue.status).toBe(200);
      const dataOverdue = await resOverdue.json();
      expect(dataOverdue.items).toBeInstanceOf(Array);
      expect(dataOverdue.disclaimer).toBeDefined();

      const resInactive = await fetch(`${baseUrl}/api/followthrough/officer/inactive`, {
        headers: { Authorization: `Bearer ${officerToken}` },
      });
      expect(resInactive.status).toBe(200);
      const dataInactive = await resInactive.json();
      expect(dataInactive.items).toBeInstanceOf(Array);
    });
  });
});
