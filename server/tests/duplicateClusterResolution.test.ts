import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import sharp from 'sharp';
import { app } from '../src/index.js';
import { complaintStore, supabaseComplaintStore } from '../src/db/complaintStore.js';
import { userStore, supabaseUserStore } from '../src/db/userStore.js';
import { CONFIG } from '../src/config.js';
import { getDb } from '../src/db/sqlite.js';
import { getSupabaseClient } from '../src/db/supabase.js';
import type { ComplaintRecord } from '../src/types/complaint.js';
import type { UserRecord } from '../src/types/auth.js';
import type { IssueCategory } from '../src/types/verification.js';

describe('Duplicate-Cluster Resolution API & Officer Adjudication Workflow', () => {
  let server: Server;
  let baseUrl: string;
  let officerToken: string;
  let citizenToken: string;
  let nonce: number;
  let imgCounter = 0;

  // Ephemeral test record tracking for targeted teardown
  const trackedComplaintIds: string[] = [];
  const trackedUserIds: string[] = [];
  const trackedAuditIds: string[] = [];

  // Source-of-truth invariants
  let initialSourceComplaint: ComplaintRecord | undefined;
  let initialSourceUser: UserRecord | undefined;

  let testImageBuf: Buffer;

  beforeAll(async () => {
    nonce = Date.now();

    // 1. INVARIANT CHECK: MCC-2026-SRC-307753 and USR-CITIZEN-MU81FLSR-A5XD must exist and be untouched
    initialSourceComplaint = await complaintStore.findById('MCC-2026-SRC-307753');
    if (!initialSourceComplaint && CONFIG.SUPABASE_URL) {
      initialSourceComplaint = await supabaseComplaintStore.findById('MCC-2026-SRC-307753');
    }
    if (initialSourceComplaint) {
      expect(initialSourceComplaint.id).toBe('MCC-2026-SRC-307753');
      expect(initialSourceComplaint.status).toBe('SUBMITTED');
      expect(initialSourceComplaint.resolutionAction).toBe('NONE');
      expect(initialSourceComplaint.primaryComplaintId).toBeUndefined();
    }

    initialSourceUser = await userStore.findById('USR-CITIZEN-MU81FLSR-A5XD');
    if (!initialSourceUser && CONFIG.SUPABASE_URL) {
      initialSourceUser = await supabaseUserStore.findById('USR-CITIZEN-MU81FLSR-A5XD');
    }
    if (initialSourceUser) {
      expect(initialSourceUser.id).toBe('USR-CITIZEN-MU81FLSR-A5XD');
      expect(initialSourceUser.email).toBe('gallikattip@gmail.com');
    }

    // 2. Start HTTP server on dynamic port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });

    // 3. Officer login
    const resOff = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'officer.ward48@mcc.gov.in',
        password: 'Officer@Mysuru48',
      }),
    });
    const offData = await resOff.json();
    expect(resOff.status).toBe(200);
    officerToken = offData.token;

    // 4. Register ephemeral test citizen
    const resCit = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `ephemeral.citizen.${nonce}@example.com`,
        password: 'Password123!',
        name: 'Ephemeral Test Citizen',
        ward: 'Kuvempunagar',
      }),
    });
    const citData = await resCit.json();
    expect(resCit.status).toBe(201);
    citizenToken = citData.token;
    if (citData.user?.id) {
      trackedUserIds.push(citData.user.id);
    }

    // 5. Generate sample test image
    testImageBuf = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 60, g: 140, b: 200 } },
    })
      .jpeg()
      .toBuffer();
  });

  afterAll(async () => {
    // 1. INVARIANT POST-CHECK: Source records MUST be 100% untouched
    if (initialSourceComplaint) {
      const postSourceComplaint =
        (await complaintStore.findById('MCC-2026-SRC-307753')) ||
        (await supabaseComplaintStore.findById('MCC-2026-SRC-307753'));
      expect(postSourceComplaint).toBeDefined();
      expect(postSourceComplaint?.id).toBe('MCC-2026-SRC-307753');
      expect(postSourceComplaint?.status).toBe('SUBMITTED');
      expect(postSourceComplaint?.resolutionAction).toBe('NONE');
      expect(postSourceComplaint?.primaryComplaintId).toBeUndefined();
      expect(postSourceComplaint).toEqual(initialSourceComplaint);
    }

    if (initialSourceUser) {
      const postSourceUser =
        (await userStore.findById('USR-CITIZEN-MU81FLSR-A5XD')) ||
        (await supabaseUserStore.findById('USR-CITIZEN-MU81FLSR-A5XD'));
      expect(postSourceUser).toBeDefined();
      expect(postSourceUser?.id).toBe('USR-CITIZEN-MU81FLSR-A5XD');
      expect(postSourceUser?.email).toBe('gallikattip@gmail.com');
      expect(postSourceUser).toEqual(initialSourceUser);
    }

    // 2. Targeted cleanup of ephemeral test records only
    try {
      if (CONFIG.DATA_STORE === 'supabase') {
        const client = getSupabaseClient();
        if (client) {
          if (trackedAuditIds.length > 0) {
            await client.from('complaint_resolution_audit').delete().in('id', trackedAuditIds);
          }
          if (trackedComplaintIds.length > 0) {
            await client
              .from('complaint_resolution_audit')
              .delete()
              .in('primary_complaint_id', trackedComplaintIds);
            await client.from('complaints').delete().in('id', trackedComplaintIds);
          }
          if (trackedUserIds.length > 0) {
            await client.from('users').delete().in('id', trackedUserIds);
          }
        }
      } else {
        const db = getDb();
        for (const aId of trackedAuditIds) {
          db.prepare('DELETE FROM complaint_resolution_audit WHERE id = ?').run(aId);
        }
        for (const cId of trackedComplaintIds) {
          db.prepare('DELETE FROM complaint_resolution_audit WHERE primary_complaint_id = ?').run(cId);
          db.prepare('DELETE FROM complaints WHERE id = ?').run(cId);
        }
        for (const uId of trackedUserIds) {
          db.prepare('DELETE FROM users WHERE id = ?').run(uId);
        }
      }
    } catch {
      // Ignore teardown error on exit
    }

    // 3. Close test server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // Helper to create an ephemeral complaint via API with unique image & location
  async function createTestComplaint(
    description: string,
    category: IssueCategory = 'pothole'
  ): Promise<{ id: string; trackingToken: string }> {
    imgCounter++;
    const buf = await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: {
          r: (imgCounter * 43) % 240 + 10,
          g: (imgCounter * 83) % 240 + 10,
          b: (imgCounter * 127) % 240 + 10,
        },
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="80" height="80"><rect x="0" y="0" width="80" height="80" fill="none"/><text x="5" y="40" font-size="12" fill="white">T${nonce}_${imgCounter}</text></svg>`
          ),
          top: 0,
          left: 0,
        },
      ])
      .jpeg()
      .toBuffer();

    const form = new FormData();
    form.append('category', category);
    form.append('description', description);
    form.append('observedDate', '2026-09-18');
    form.append('locationArea', `Kuvempunagar Sector ${imgCounter}`);
    form.append('addressText', `Near Vishwamanava Double Road ${imgCounter}`);
    form.append('latitude', (12.2905 + imgCounter * 0.003).toFixed(6));
    form.append('longitude', (76.6234 + imgCounter * 0.003).toFixed(6));
    form.append('image', new Blob([buf], { type: 'image/jpeg' }), `test_${imgCounter}.jpg`);

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: form,
    });
    const data = await res.json();
    if (res.status !== 201) {
      throw new Error(`Failed to create test complaint: ${res.status} ${JSON.stringify(data)}`);
    }
    const compId = data.complaint.id;
    const token = data.complaint.trackingToken;
    trackedComplaintIds.push(compId);
    return { id: compId, trackingToken: token };
  }

  // 1. Authorization & RBAC Checks
  it('rejects unauthenticated request to /api/officer/complaints/:id/duplicate-resolution with 401', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints/dummy-id/duplicate-resolution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType: 'MERGE_DUPLICATES',
        targetComplaintId: 'dummy-target',
        decisionNotes: 'Valid notes length here',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects citizen token attempting /api/officer/complaints/:id/duplicate-resolution with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/officer/complaints/dummy-id/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        actionType: 'MERGE_DUPLICATES',
        targetComplaintId: 'dummy-target',
        decisionNotes: 'Valid notes length here',
      }),
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Access denied');
  });

  // 2. Input Validation Checks
  it('rejects duplicate-resolution when target complaint ID equals primary complaint ID (self-reference)', async () => {
    const comp = await createTestComplaint(`Pothole on Double Road self ref test ${nonce}_1`);
    const res = await fetch(`${baseUrl}/api/officer/complaints/${comp.id}/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        actionType: 'MERGE_DUPLICATES',
        targetComplaintId: comp.id,
        decisionNotes: 'Attempting self consolidation',
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('against itself');
  });

  it('rejects duplicate-resolution when decisionNotes is less than 5 characters', async () => {
    const compA = await createTestComplaint(`Pothole on Double Road note length test A ${nonce}_2`);
    const compB = await createTestComplaint(`Pothole on Double Road note length test B ${nonce}_2`);

    const res = await fetch(`${baseUrl}/api/officer/complaints/${compA.id}/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        actionType: 'MERGE_DUPLICATES',
        targetComplaintId: compB.id,
        decisionNotes: 'abc', // less than 5 characters
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('at least 5 characters');
  });

  it('rejects unsupported actionType UNLINK with 400 Bad Request', async () => {
    const compA = await createTestComplaint(`Pothole on Double Road unlink test A ${nonce}_3`);
    const compB = await createTestComplaint(`Pothole on Double Road unlink test B ${nonce}_3`);

    const res = await fetch(`${baseUrl}/api/officer/complaints/${compA.id}/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        actionType: 'UNLINK',
        targetComplaintId: compB.id,
        decisionNotes: 'Attempting excluded unlink action',
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('UNLINK is excluded');
  });

  // 3. Execution: MERGE_DUPLICATES
  it('executes MERGE_DUPLICATES: closes secondary, keeps master active, writes audit, and reflects on tracking', async () => {
    const master = await createTestComplaint(`Major crater near Kuvempunagar park master ${nonce}_4`);
    const duplicate = await createTestComplaint(`Crater near Kuvempunagar park duplicate ${nonce}_4`);

    const res = await fetch(`${baseUrl}/api/officer/complaints/${master.id}/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        actionType: 'MERGE_DUPLICATES',
        targetComplaintId: duplicate.id,
        decisionNotes: 'Verified duplicate via physical site inspection and identical road damage location.',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.actionType).toBe('MERGE_DUPLICATES');
    expect(data.auditId).toBeDefined();
    trackedAuditIds.push(data.auditId);

    // Verify master complaint state
    const masterRecord = await complaintStore.findById(master.id);
    expect(masterRecord).toBeDefined();
    expect(masterRecord?.status).toBe('SUBMITTED'); // remains active!
    expect(masterRecord?.resolutionAction).toBe('NONE'); // retains NONE
    expect(masterRecord?.primaryComplaintId).toBeUndefined(); // is the master anchor

    // Verify secondary duplicate complaint state
    const duplicateRecord = await complaintStore.findById(duplicate.id);
    expect(duplicateRecord).toBeDefined();
    expect(duplicateRecord?.status).toBe('CLOSED'); // consolidated & closed
    expect(duplicateRecord?.resolutionAction).toBe('MERGE_DUPLICATES');
    expect(duplicateRecord?.primaryComplaintId).toBe(master.id); // links to master anchor

    // Verify audit record exists and has correct fields
    const audits = await complaintStore.listAuditRecords(data.clusterId);
    const mergeAudit = audits.find((a) => a.id === data.auditId);
    expect(mergeAudit).toBeDefined();
    expect(mergeAudit?.actionType).toBe('MERGE_DUPLICATES');
    expect(mergeAudit?.primaryComplaintId).toBe(master.id);
    expect(mergeAudit?.secondaryComplaintIds).toContain(duplicate.id);

    // Verify public citizen tracking for secondary duplicate: safe, reassuring, zero PII
    const trackRes = await fetch(`${baseUrl}/api/complaints/track/${duplicate.trackingToken}`);
    expect(trackRes.status).toBe(200);
    const trackData = await trackRes.json();
    expect(trackData.status).toBe('CLOSED');
    expect(trackData.duplicateResolution).toBeDefined();
    expect(trackData.duplicateResolution.actionType).toBe('MERGE_DUPLICATES');
    expect(trackData.duplicateResolution.isMaster).toBe(false);
    expect(trackData.duplicateResolution.notice).toContain('consolidated with an active grievance');
    // Ensure no officer decision notes or internal private comments are leaked to citizen
    expect(JSON.stringify(trackData)).not.toContain('Verified duplicate via physical site inspection');

    // Double-close guard: attempting to merge an already closed complaint returns 400
    const doubleMergeRes = await fetch(`${baseUrl}/api/officer/complaints/${master.id}/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        actionType: 'MERGE_DUPLICATES',
        targetComplaintId: duplicate.id,
        decisionNotes: 'Attempting to double merge already closed complaint',
      }),
    });
    expect(doubleMergeRes.status).toBe(400);
    const doubleMergeData = await doubleMergeRes.json();
    expect(doubleMergeData.error).toContain('because it is already CLOSED');
  });

  // 4. Execution: MARK_DISTINCT
  it('executes MARK_DISTINCT: both complaints remain active, audit logged', async () => {
    const compA = await createTestComplaint(`Distinct streetlight issue ward 48 distinct ${nonce}_5`, 'broken_streetlight');
    const compB = await createTestComplaint(`Another streetlight issue ward 48 distinct ${nonce}_5`, 'broken_streetlight');

    const res = await fetch(`${baseUrl}/api/officer/complaints/${compA.id}/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        actionType: 'MARK_DISTINCT',
        targetComplaintId: compB.id,
        decisionNotes: 'Inspected both poles; pole #45 and pole #48 are distinct assets on opposite sides of road.',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.actionType).toBe('MARK_DISTINCT');
    trackedAuditIds.push(data.auditId);

    // Both remain active
    const recA = await complaintStore.findById(compA.id);
    const recB = await complaintStore.findById(compB.id);
    expect(recA?.status).toBe('SUBMITTED');
    expect(recB?.status).toBe('SUBMITTED');
    expect(recA?.resolutionAction).toBe('MARK_DISTINCT');
    expect(recB?.resolutionAction).toBe('MARK_DISTINCT');
  });

  // 5. Execution: MARK_RELATED
  it('executes MARK_RELATED: assigns cluster ID, both remain active, audit logged', async () => {
    const compA = await createTestComplaint(`Water leakage at corner A related ${nonce}_6`, 'other');
    const compB = await createTestComplaint(`Water contamination near valve B related ${nonce}_6`, 'other');

    const res = await fetch(`${baseUrl}/api/officer/complaints/${compA.id}/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        actionType: 'MARK_RELATED',
        targetComplaintId: compB.id,
        decisionNotes: 'Both incidents pertain to main feeder line junction rupture; linked for joint pipe repair.',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.actionType).toBe('MARK_RELATED');
    trackedAuditIds.push(data.auditId);

    const recA = await complaintStore.findById(compA.id);
    const recB = await complaintStore.findById(compB.id);
    expect(recA?.status).toBe('SUBMITTED');
    expect(recB?.status).toBe('SUBMITTED');
    expect(recA?.duplicateClusterId).toBeDefined();
    expect(recA?.duplicateClusterId).toBe(recB?.duplicateClusterId);
  });

  // 6. Cluster Collision Guard
  it('rejects MARK_RELATED when complaints belong to two different non-empty clusters', async () => {
    const comp1 = await createTestComplaint(`Cluster 1 item A ${nonce}_7`);
    const comp2 = await createTestComplaint(`Cluster 1 item B ${nonce}_7`);
    const comp3 = await createTestComplaint(`Cluster 2 item C ${nonce}_7`);
    const comp4 = await createTestComplaint(`Cluster 2 item D ${nonce}_7`);

    // Form Cluster 1
    const res1 = await fetch(`${baseUrl}/api/officer/complaints/${comp1.id}/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        actionType: 'MARK_RELATED',
        targetComplaintId: comp2.id,
        decisionNotes: 'Cluster 1 linking notes',
      }),
    });
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    trackedAuditIds.push(data1.auditId);

    // Form Cluster 2
    const res2 = await fetch(`${baseUrl}/api/officer/complaints/${comp3.id}/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        actionType: 'MARK_RELATED',
        targetComplaintId: comp4.id,
        decisionNotes: 'Cluster 2 linking notes',
      }),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    trackedAuditIds.push(data2.auditId);

    // Attempt to merge two distinct clusters via MARK_RELATED
    const collideRes = await fetch(`${baseUrl}/api/officer/complaints/${comp1.id}/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        actionType: 'MARK_RELATED',
        targetComplaintId: comp3.id,
        decisionNotes: 'Attempting cross-cluster collision',
      }),
    });
    expect(collideRes.status).toBe(400);
    const collideData = await collideRes.json();
    expect(collideData.error).toContain('belong to different existing clusters');
  });

  // 7. Officer Audit History Retrieval
  it('fetches duplicate audit history via GET /api/officer/complaints/:id/duplicate-audit', async () => {
    const compA = await createTestComplaint(`Audit fetch test item A ${nonce}_8`);
    const compB = await createTestComplaint(`Audit fetch test item B ${nonce}_8`);

    const res = await fetch(`${baseUrl}/api/officer/complaints/${compA.id}/duplicate-resolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        actionType: 'MARK_DISTINCT',
        targetComplaintId: compB.id,
        decisionNotes: 'Distinct inspection audit test verification notes.',
      }),
    });
    const resData = await res.json();
    trackedAuditIds.push(resData.auditId);

    const auditRes = await fetch(`${baseUrl}/api/officer/complaints/${compA.id}/duplicate-audit`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(auditRes.status).toBe(200);
    const auditData = await auditRes.json();
    expect(auditData.audits).toBeDefined();
    expect(Array.isArray(auditData.audits)).toBe(true);
    const recorded = auditData.audits.find((a: any) => a.id === resData.auditId);
    expect(recorded).toBeDefined();
    expect(recorded.actionType).toBe('MARK_DISTINCT');
  });
});
