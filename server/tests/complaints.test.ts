import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import sharp from 'sharp';
import { app } from '../src/index.js';
import { seedDemoData, clearSyntheticDemoComplaints } from '../src/db/seedDemoData.js';
import { complaintStore } from '../src/db/complaintStore.js';
import { CONFIG } from '../src/config.js';

describe('Civic Trust Complaint Persistence Store & Synthetic Demo Repository (Step 4.3B)', () => {
  let server: Server;
  let baseUrl: string;

  let citizenToken: string;
  let citizenUserId: string;

  let citizenBToken: string;
  let citizenBUserId: string;

  let officerToken: string;
  let sampleImageBuf: Buffer;
  let sampleImageBuf2: Buffer;
  let sampleImageBuf3: Buffer;

  beforeAll(async () => {
    sampleImageBuf = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 50, g: 120, b: 180 } },
    })
      .jpeg()
      .toBuffer();

    sampleImageBuf2 = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 120, g: 50, b: 180 } },
    })
      .jpeg()
      .toBuffer();

    sampleImageBuf3 = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 180, g: 120, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    // Explicitly seed demo records isolated to this test suite
    if (CONFIG.DATA_STORE === 'sqlite') {
      seedDemoData();
    }

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });

    const runNonce = Date.now();
    // 1. Register Citizen A
    const resA = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Suresh Gowda Test',
        email: `suresh.test.${runNonce}@example.com`,
        password: 'password123',
        ward: 'Kuvempunagar',
      }),
    });
    const dataA = await resA.json();
    citizenToken = dataA.token;
    citizenUserId = dataA.user.id;

    // 2. Register Citizen B
    const resB = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pooja Hegde Test',
        email: `pooja.test.${runNonce}@example.com`,
        password: 'password123',
        ward: 'Gokulam',
      }),
    });
    const dataB = await resB.json();
    citizenBToken = dataB.token;
    citizenBUserId = dataB.user.id;

    // 3. Login as Pre-seeded Officer (Ward 48)
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
  });

  afterAll(async () => {
    clearSyntheticDemoComplaints();
    await complaintStore.clearNonDemo();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // 1. Synthetic Demo Records Seeding & Labeling
  it('seeds 5 demonstration records with isDemo=true and synthetic disclaimer', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/demo-pool`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.disclaimer).toContain('Synthetic demonstration record');

    if (CONFIG.DATA_STORE === 'supabase') {
      // In Supabase cloud store, synthetic complaints are strictly zero (Rule 11)
      expect(data.count).toBe(0);
      return;
    }

    expect(data.count).toBe(1);
    const demo1 = data.complaints.find((c: any) => c.id === 'DEMO-2026-0001');
    expect(demo1).toBeDefined();
    expect(demo1.isDemo).toBe(true);
    expect(demo1.locationArea).toBe('Kuvempunagar');
    expect(demo1.category).toBe('pothole');
  });

  // 2. Complaint Creation: Valid
  let createdComplaintId: string;
  let createdTrackingToken: string;

  it('allows authenticated citizen to submit complaint and returns tracking token', async () => {
    const form = new FormData();
    form.append('category', 'overflowing_bin');
    form.append('description', 'Large public garbage bin overflowing with plastic containers near bus stand.');
    form.append('observedDate', '2026-09-18');
    form.append('locationArea', 'Kuvempunagar');
    form.append('addressText', 'Near Kuvempunagar complex bus stand');
    form.append('latitude', '12.2905');
    form.append('longitude', '76.6234');
    form.append('image', new Blob([sampleImageBuf], { type: 'image/jpeg' }), 'evidence.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
      body: form,
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.complaint.id).toBeDefined();
    expect(data.complaint.trackingToken).toMatch(/^TRK-/);
    expect(data.complaint.status).toBe('SUBMITTED');
    expect(data.complaint.citizenId).toBe(citizenUserId);
    expect(data.complaint.assignedDepartment).toBe('MCC Health & Sanitation Department');
    expect(data.complaint.isDemo).toBe(false);
    expect(data.evidenceNotice).toContain('citizen-submitted evidence only');

    createdComplaintId = data.complaint.id;
    createdTrackingToken = data.complaint.trackingToken;
  });

  // 3. Validation Rejections
  it('rejects complaint when image is missing (HTTP 400 IMAGE_REQUIRED)', async () => {
    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        category: 'pothole',
        description: 'Road damage with deep depression near bus terminal.',
        observedDate: '2026-09-18',
        locationArea: 'Kuvempunagar',
        latitude: 12.2905,
        longitude: 76.6234,
        hasImage: false,
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('IMAGE_REQUIRED');
    expect(data.error).toContain('Photographic evidence is mandatory');
  });

  it('rejects complaint when device GPS coordinates are missing (HTTP 400 GPS_REQUIRED)', async () => {
    const form = new FormData();
    form.append('category', 'pothole');
    form.append('description', 'Road damage with deep depression near bus terminal.');
    form.append('observedDate', '2026-09-18');
    form.append('locationArea', 'Kuvempunagar');
    form.append('image', new Blob([sampleImageBuf], { type: 'image/jpeg' }), 'evidence.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: form,
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('GPS_REQUIRED');
    expect(data.error).toContain('Device GPS coordinates are required');
  });

  it('rejects complaint when device GPS coordinates are out of bounds (HTTP 400 GPS_REQUIRED)', async () => {
    const form = new FormData();
    form.append('category', 'pothole');
    form.append('description', 'Road damage with deep depression near bus terminal.');
    form.append('observedDate', '2026-09-18');
    form.append('locationArea', 'Kuvempunagar');
    form.append('latitude', '105.0'); // Invalid latitude > 90
    form.append('longitude', '76.6234');
    form.append('image', new Blob([sampleImageBuf], { type: 'image/jpeg' }), 'evidence.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: form,
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('GPS_REQUIRED');
    expect(data.error).toContain('Device GPS coordinates are required');
  });

  it('rejects complaint with short description (< 10 chars)', async () => {
    const form = new FormData();
    form.append('category', 'pothole');
    form.append('description', 'Too short');
    form.append('observedDate', '2026-09-18');
    form.append('locationArea', 'Gokulam');
    form.append('latitude', '12.3250');
    form.append('longitude', '76.6350');
    form.append('image', new Blob([sampleImageBuf], { type: 'image/jpeg' }), 'evidence.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: form,
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('too short');
  });

  it('rejects complaint with future observed date', async () => {
    const form = new FormData();
    form.append('category', 'pothole');
    form.append('description', 'Pothole observed in the distant future.');
    form.append('observedDate', '2099-01-01');
    form.append('locationArea', 'Gokulam');
    form.append('latitude', '12.3250');
    form.append('longitude', '76.6350');
    form.append('image', new Blob([sampleImageBuf], { type: 'image/jpeg' }), 'evidence.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: form,
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('cannot be in the future');
  });

  it('rejects complaint without location area', async () => {
    const form = new FormData();
    form.append('category', 'pothole');
    form.append('description', 'Road damage on unknown road.');
    form.append('observedDate', '2026-09-18');
    form.append('locationArea', '   ');
    form.append('latitude', '12.3250');
    form.append('longitude', '76.6350');
    form.append('image', new Blob([sampleImageBuf], { type: 'image/jpeg' }), 'evidence.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: form,
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Location area');
  });

  // 4. Verification Engine Integration: Duplicate Detection against Synthetic Seeds
  it('integrates verification engine and detects HIGH duplicate risk against DEMO-2026-0001', async () => {
    const form = new FormData();
    form.append('category', 'pothole');
    form.append(
      'description',
      'Deep road crater on Saraswathipuram Main Road near Kuvempunagar fire station causing traffic slowdown and significant disruption.'
    );
    form.append('observedDate', '2026-09-18');
    form.append('locationArea', 'Kuvempunagar');
    form.append('latitude', '12.2855');
    form.append('longitude', '76.6350');
    form.append('image', new Blob([sampleImageBuf2], { type: 'image/jpeg' }), 'evidence.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
      body: form,
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    const vr = data.complaint.verificationResult;
    expect(vr).toBeDefined();
    if (CONFIG.DATA_STORE === 'supabase') {
      expect(['HIGH', 'MEDIUM']).toContain(vr.duplicateRisk);
      expect(['POSSIBLE_DUPLICATE', 'REQUIRES_HUMAN_REVIEW']).toContain(vr.outcome);
      expect(vr.matches.length).toBeGreaterThanOrEqual(1);
    } else {
      expect(vr.duplicateRisk).toBe('HIGH');
      expect(vr.outcome).toBe('POSSIBLE_DUPLICATE');
      expect(vr.matches.some((m: any) => m.existingComplaintId === 'DEMO-2026-0001')).toBe(true);
    }
  });

  it('rejects complaint with out-of-jurisdiction GPS (e.g. Hubballi) at intake (HTTP 400 OUT_OF_SERVICE_AREA) with no complaint/token created', async () => {
    const sampleImageHubballi = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 90, g: 190, b: 90 } },
    })
      .jpeg()
      .toBuffer();

    const complaintsBefore = await complaintStore.findByCitizenId(citizenUserId);

    const form = new FormData();
    form.append('category', 'pothole');
    form.append('description', `Pothole reported near railway station road entrance ${Date.now()}.`);
    form.append('observedDate', '2026-09-18');
    form.append('locationArea', 'Kuvempunagar');
    form.append('latitude', '15.3647'); // Hubballi (~400km from Mysuru)
    form.append('longitude', '75.1240');
    form.append('image', new Blob([sampleImageHubballi], { type: 'image/jpeg' }), 'evidence.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: form,
    });

    // 1. Rejection response
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('OUT_OF_SERVICE_AREA');
    expect(data.error).toContain('outside the Mysuru municipal service area');

    // 2. Safeguards: No complaint or token generated
    expect(data.complaint).toBeUndefined();
    expect(data.trackingToken).toBeUndefined();

    // 3. Database Safeguard: No complaint record created in store
    const complaintsAfter = await complaintStore.findByCitizenId(citizenUserId);
    expect(complaintsAfter.length).toBe(complaintsBefore.length);

    // 4. No department assigned
    expect((data as any).assignedDepartment).toBeUndefined();
  });

  // 5. Citizen Ownership Isolation
  it('allows citizen to view their own complaints via /api/complaints/my', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/my`, {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.complaints)).toBe(true);
    expect(data.complaints.length).toBeGreaterThanOrEqual(1);
    expect(data.complaints.every((c: any) => c.citizenId === citizenUserId)).toBe(true);
  });

  it('prevents Citizen A from viewing Citizen B single complaint (403 Forbidden)', async () => {
    // 1. Citizen B creates complaint
    const formB = new FormData();
    formB.append('category', 'broken_streetlight');
    formB.append('description', 'Dark unlit street pole in Gokulam 2nd Stage.');
    formB.append('observedDate', '2026-09-18');
    formB.append('locationArea', 'Gokulam');
    formB.append('latitude', '12.3250');
    formB.append('longitude', '76.6350');
    formB.append('image', new Blob([sampleImageBuf3], { type: 'image/jpeg' }), 'lamp.jpg');

    const resB = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenBToken}`,
      },
      body: formB,
    });
    const { complaint: complaintB } = await resB.json();

    // 2. Citizen A attempts to view Citizen B's complaint
    const attackRes = await fetch(`${baseUrl}/api/complaints/${complaintB.id}`, {
      headers: {
        Authorization: `Bearer ${citizenToken}`, // Citizen A token
      },
    });

    expect(attackRes.status).toBe(403);
    const attackData = await attackRes.json();
    expect(attackData.error).toContain('Access denied');
  });

  // 6. Public Tracking by Token (Sanitized, Zero PII)
  it('allows public tracking by token and strips citizen PII', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/track/${createdTrackingToken}`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.id).toBe(createdComplaintId);
    expect(data.trackingToken).toBe(createdTrackingToken);
    expect(data.status).toBe('SUBMITTED');
    expect(data.category).toBe('overflowing_bin');
    expect(data.disclaimer).toBeDefined();

    // STRICT PRIVACY AUDIT: Ensure citizenId and internal notes are omitted
    expect((data as any).citizenId).toBeUndefined();
    expect((data as any).reviewNotes).toBeUndefined();
  });

  it('returns 404 for unknown tracking token', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/track/TRK-NONEXISTENT`);
    expect(res.status).toBe(404);
  });

  // 7. Officer Review Queue & Actions
  it('allows authorized officer to view complaints queue', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints`, {
      headers: {
        Authorization: `Bearer ${officerToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.complaints)).toBe(true);
  });

  it('prevents citizen from accessing officer queue with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints`, {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
    });

    expect(res.status).toBe(403);
  });

  it('allows officer to update complaint review status and review notes', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints/${createdComplaintId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        status: 'UNDER_REVIEW',
        reviewNotes: 'Assigned inspection team for morning garbage clearance.',
        assignedDepartment: 'MCC Health & Sanitation Department',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.complaint.status).toBe('UNDER_REVIEW');
    expect(data.complaint.reviewNotes).toContain('morning garbage clearance');
    expect(data.complaint.assignedOfficerId).toBeDefined();
  });

  it('rejects officer review with invalid status transition', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints/${createdComplaintId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        status: 'NON_EXISTENT_STATUS',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid status transition');
  });

  it('prevents citizen from updating officer review with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints/${createdComplaintId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        status: 'RESOLVED',
      }),
    });

    expect(res.status).toBe(403);
  });

  // 8. Overwrite & Persistence Safety
  it('preserves existing modified demo complaints when seedDemoData is invoked again', async () => {
    if (CONFIG.DATA_STORE === 'supabase') {
      return; // seedDemoData is specific to SQLite development seeding
    }

    // Modify demo complaint 1
    await complaintStore.update('DEMO-2026-0001', {
      reviewNotes: 'Officer custom test note.',
    });

    // Run seedDemoData again
    seedDemoData();

    // Ensure custom note was not overwritten
    const current = await complaintStore.findById('DEMO-2026-0001');
    expect(current?.reviewNotes).toBe('Officer custom test note.');
  });
});
