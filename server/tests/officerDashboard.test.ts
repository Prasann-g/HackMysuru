import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../src/index.js';

describe('MCC Officer Verification & Review Dashboard (Step 4.4)', () => {
  let server: Server;
  let baseUrl: string;
  let citizenToken: string;
  let officerToken: string;
  let testComplaintId: string;
  let testCitizenEmail: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });

    // 1. Citizen login / registration
    testCitizenEmail = `darshan.officer.${Date.now()}@example.com`;
    const resCit = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Darshan Kumar',
        email: testCitizenEmail,
        password: 'password123',
        ward: 'Kuvempunagar',
      }),
    });
    const citData = await resCit.json();
    citizenToken = citData.token;

    // 2. Pre-seeded Officer login
    const resOff = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'officer.ward48@mcc.gov.in',
        password: 'Officer@Mysuru48',
      }),
    });
    const offData = await resOff.json();
    officerToken = offData.token;

    // 3. Create a test complaint to inspect and review
    const resComp = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        category: 'pothole',
        description: `Dangerous road crater in Kuvempunagar near Saraswathipuram fire station ${Date.now()}.`,
        observedDate: '2026-09-18',
        locationArea: 'Kuvempunagar',
        addressText: 'Near Fire Station Signal, Saraswathipuram',
      }),
    });
    const compData = await resComp.json();
    testComplaintId = compData.complaint.id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // 1. Security & RBAC Enforcement
  it('rejects unauthenticated request to /api/officer/complaints with 401', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints`);
    expect(res.status).toBe(401);
  });

  it('rejects citizen token accessing /api/officer/complaints with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints`, {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Access denied');
  });

  // 2. Officer Queue Retrieval & Filtering
  it('allows authorized officer to list all complaints in queue', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints`, {
      headers: {
        Authorization: `Bearer ${officerToken}`,
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.complaints)).toBe(true);
    expect(data.complaints.some((c: any) => c.id === testComplaintId)).toBe(true);
  });

  it('filters officer queue by status', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints?status=SUBMITTED`, {
      headers: {
        Authorization: `Bearer ${officerToken}`,
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.complaints.every((c: any) => c.status === 'SUBMITTED')).toBe(true);
  });

  it('filters officer queue by locationArea', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints?locationArea=Kuvempunagar`, {
      headers: {
        Authorization: `Bearer ${officerToken}`,
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.complaints.every((c: any) => c.locationArea === 'Kuvempunagar')).toBe(true);
  });

  it('filters officer queue by duplicateRisk', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints?duplicateRisk=HIGH`, {
      headers: {
        Authorization: `Bearer ${officerToken}`,
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(
      data.complaints.every(
        (c: any) => c.verificationResult && c.verificationResult.duplicateRisk === 'HIGH'
      )
    ).toBe(true);
  });

  it('searches complaints queue by search query q (tracking token or keyword)', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints?q=Kuvempunagar`, {
      headers: {
        Authorization: `Bearer ${officerToken}`,
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.complaints.length).toBeGreaterThanOrEqual(1);
    expect(
      data.complaints.some(
        (c: any) => c.locationArea.includes('Kuvempunagar') || c.description.includes('Kuvempunagar')
      )
    ).toBe(true);
  });

  // 3. Detailed Single Complaint & Duplicate Cluster Inspection
  it('retrieves detailed complaint record including matched duplicate candidates and citizen info', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints/${testComplaintId}`, {
      headers: {
        Authorization: `Bearer ${officerToken}`,
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.complaint.id).toBe(testComplaintId);
    expect(data.citizen).toBeDefined();
    expect(data.citizen.name).toBe('Darshan Kumar');
    expect(data.citizen.email).toBe(testCitizenEmail);
    expect(Array.isArray(data.matchedCandidates)).toBe(true);
  });

  it('returns 404 for non-existent complaint ID', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints/CMP-NONEXISTENT`, {
      headers: {
        Authorization: `Bearer ${officerToken}`,
      },
    });
    expect(res.status).toBe(404);
  });

  // 4. Officer Review Actions, Department Reassignment, & Audit Trail
  it('updates complaint review status, department, and internal review notes', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints/${testComplaintId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        assignedDepartment: 'MCC Engineering Division',
        reviewNotes: 'Road maintenance crew dispatched with asphalt batching unit.',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.complaint.status).toBe('IN_PROGRESS');
    expect(data.complaint.assignedDepartment).toBe('MCC Engineering Division');
    expect(data.complaint.reviewNotes).toContain('asphalt batching unit');
    expect(data.complaint.assignedOfficerId).toBe('USR-OFFICER-48');
  });

  it('rejects invalid status transitions with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints/${testComplaintId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        status: 'INVALID_STATUS',
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid status transition');
  });
});
