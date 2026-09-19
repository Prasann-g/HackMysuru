import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { app } from '../src/index.js';
import { complaintStore } from '../src/db/complaintStore.js';
import { CONFIG } from '../src/config.js';

describe('Intake Duplicate Rejection Workflow (HTTP 409 Conflict)', () => {
  let server: Server;
  let baseUrl: string;
  let citizenTokenA: string;
  let citizenAId: string;
  let citizenTokenB: string;
  let officerToken: string;

  let imageBufOriginal: Buffer;
  let imageBufRecompressed: Buffer;
  let imageBufDistinct: Buffer;
  let nonce: number;

  beforeAll(async () => {
    nonce = Date.now();

    // Clean any prior ephemeral test complaints while strictly preserving authentic records
    await complaintStore.clearNonDemo();

    // Generate test images using sharp
    // 1. Original Image (geometric white/black split with blue background + unique nonce circle)
    imageBufOriginal = await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: { r: 15, g: 110, b: 220 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="80" height="80"><rect x="0" y="0" width="40" height="80" fill="white"/><rect x="40" y="0" width="40" height="80" fill="black"/><circle cx="${(nonce % 30) + 15}" cy="40" r="12" fill="yellow"/></svg>`
          ),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    // 2. Recompressed Image (identical visual scene, lower quality -> different SHA-256, dHash <= 5)
    imageBufRecompressed = await sharp(imageBufOriginal).jpeg({ quality: 25 }).toBuffer();

    // 3. Distinct Image (distinct red scene with dynamic cyan rectangle)
    imageBufDistinct = await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: { r: 230, g: 30, b: 30 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="80" height="80"><rect x="${(nonce % 30) + 5}" y="${((nonce >> 3) % 30) + 5}" width="25" height="25" fill="cyan"/></svg>`
          ),
          top: 0,
          left: 0,
        },
      ])
      .jpeg()
      .toBuffer();

    // Start HTTP server on dynamic port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });

    // Register Citizen A
    const resA = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `citizen-reject-a-${nonce}@example.com`,
        password: 'Password123!',
        name: 'Citizen Alpha Rejection Test',
      }),
    });
    const dataA = await resA.json();
    citizenTokenA = dataA.token;
    citizenAId = dataA.user.id;

    // Register Citizen B
    const resB = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `citizen-reject-b-${nonce}@example.com`,
        password: 'Password123!',
        name: 'Citizen Beta Rejection Test',
      }),
    });
    const dataB = await resB.json();
    citizenTokenB = dataB.token;

    // Register Officer
    const resOff = await fetch(`${baseUrl}/api/auth/register/officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `officer-reject-${nonce}@mcc.gov.in`,
        password: 'Password123!',
        name: 'Officer Reviewer',
        inviteCode: 'MCC-OFFICER-SECRET-2026',
        department: 'MCC Engineering Division',
        ward: 'Kuvempunagar',
      }),
    });
    const dataOff = await resOff.json();
    officerToken = dataOff.token;
  });

  afterAll(async () => {
    await complaintStore.clearNonDemo();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  let originalComplaintId: string;
  let originalTrackingToken: string;

  it('allows Citizen A to submit original complaint with photo evidence (HTTP 201 Created)', async () => {
    const form = new FormData();
    form.append('category', 'pothole');
    form.append('description', `Dangerous road depression on Kuvempunagar Double Road near junction ${nonce}.`);
    form.append('observedDate', '2026-03-15');
    form.append('locationArea', 'Kuvempunagar');
    form.append('latitude', '12.2855');
    form.append('longitude', '76.6350');
    form.append('image', new Blob([imageBufOriginal], { type: 'image/jpeg' }), 'evidence.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenTokenA}` },
      body: form,
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.complaint.id).toBeDefined();
    expect(data.complaint.trackingToken).toMatch(/^TRK-/);
    expect(data.complaint.citizenId).toBe(citizenAId);
    expect(data.complaint.imageSha256).toBeDefined();

    originalComplaintId = data.complaint.id;
    originalTrackingToken = data.complaint.trackingToken;
  });

  it('rejects Citizen B with HTTP 409 Conflict when submitting exact duplicate image (SHA-256 match)', async () => {
    // 1. Snapshot counts before Citizen B attempts submission
    const complaintsDir = path.join(CONFIG.UPLOAD_DIR, 'complaints');
    const initialFiles = fs.existsSync(complaintsDir) ? fs.readdirSync(complaintsDir) : [];
    const initialCandidates = await complaintStore.listCandidatesForVerification();

    const officerQueueBefore = await fetch(`${baseUrl}/api/officer/complaints`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    const queueDataBefore = await officerQueueBefore.json();
    const initialOfficerCount = queueDataBefore.count;

    // 2. Citizen B attempts to submit the exact same image with different description
    const form = new FormData();
    form.append('category', 'garbage_dumping');
    form.append('description', `Unattended trash accumulating on the sidewalk near market ${nonce}.`);
    form.append('observedDate', '2026-03-16');
    form.append('locationArea', 'Vontikoppal');
    form.append('latitude', '12.2855');
    form.append('longitude', '76.6350');
    form.append('image', new Blob([imageBufOriginal], { type: 'image/jpeg' }), 'reused.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenTokenB}` },
      body: form,
    });

    // 3. Assert HTTP 409 Conflict response
    expect(res.status).toBe(409);
    const data = await res.json();

    expect(data.error).toContain('This exact photograph has already been submitted');
    expect(data.code).toBe('EXACT_IMAGE_DUPLICATE');
    expect(data.duplicateType).toBe('IMAGE_EXACT_MATCH');

    // 4. Assert safe reference to existing complaint
    expect(data.existingComplaint).toBeDefined();
    expect(data.existingComplaint.id).toBe(originalComplaintId);
    expect(data.existingComplaint.trackingToken).toBe(originalTrackingToken);
    expect(data.existingComplaint.category).toBe('pothole');
    expect(data.existingComplaint.status).toBe('SUBMITTED');
    expect(data.existingComplaint.locationArea).toBe('Kuvempunagar');

    // 5. Anti-leakage / Privacy: Zero citizen personal data exposed
    expect(data.existingComplaint.citizenId).toBeUndefined();
    expect(data.existingComplaint.name).toBeUndefined();
    expect(data.existingComplaint.email).toBeUndefined();
    expect(data.existingComplaint.reviewNotes).toBeUndefined();
    expect(data.existingComplaint.imagePath).toBeUndefined();

    // 6. Zero Database Records: count remains unchanged
    const finalCandidates = await complaintStore.listCandidatesForVerification();
    expect(finalCandidates.length).toBe(initialCandidates.length);

    // 7. Zero Orphaned Files: disk file count remains unchanged
    const finalFiles = fs.existsSync(complaintsDir) ? fs.readdirSync(complaintsDir) : [];
    expect(finalFiles.length).toBe(initialFiles.length);

    // 8. Zero Officer Alerts / Queue Items: queue count remains unchanged
    const officerQueueAfter = await fetch(`${baseUrl}/api/officer/complaints`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    const queueDataAfter = await officerQueueAfter.json();
    expect(queueDataAfter.count).toBe(initialOfficerCount);
  });

  it('accepts distinct photograph with HTTP 201 Created', async () => {
    const form = new FormData();
    form.append('category', 'broken_streetlight');
    form.append('description', `Extinguished overhead luminaire on 8th cross avenue ${nonce}.`);
    form.append('observedDate', '2026-03-16');
    form.append('locationArea', 'Saraswathipuram');
    form.append('latitude', '12.2955');
    form.append('longitude', '76.6450');
    form.append('image', new Blob([imageBufDistinct], { type: 'image/jpeg' }), 'distinct.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenTokenB}` },
      body: form,
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.complaint.id).toBeDefined();
    expect(data.complaint.status).toBe('SUBMITTED');
    expect(data.complaint.imageSha256).toBeDefined();
  });

  it('does NOT reject visually similar images (dHash match without SHA-256 match); preserves officer review workflow', async () => {
    // Recompressed image has different SHA-256 from original, but close dHash
    const form = new FormData();
    form.append('category', 'pothole');
    form.append('description', `Unique roadway depression inspection record ${nonce} with isolated phrasing.`);
    form.append('observedDate', '2026-03-16');
    form.append('locationArea', 'Kuvempunagar');
    form.append('latitude', '12.2855');
    form.append('longitude', '76.6350');
    form.append('image', new Blob([imageBufRecompressed], { type: 'image/jpeg' }), 'recompressed.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenTokenB}` },
      body: form,
    });

    // Perceptual similarity is NOT automatically rejected
    expect(res.status).toBe(201);
    const data = await res.json();
    const complaint = data.complaint;

    // Preserved as officer review signal
    expect(complaint.verificationResult.imageComparisonSignal).toBe('LIKELY_VISUAL_SIMILARITY');
    expect(complaint.verificationResult.outcome).toBe('REQUIRES_HUMAN_REVIEW');
    expect(
      complaint.verificationResult.signals.some((s: string) =>
        s.includes('LIKELY_VISUAL_SIMILARITY')
      )
    ).toBe(true);
  });

  it('rejects identical text complaint in the same category and area (HTTP 409 Conflict)', async () => {
    const imageBufTextA = await sharp({
      create: { width: 60, height: 60, channels: 3, background: { r: 10, g: 150, b: 20 } },
    }).jpeg().toBuffer();
    const imageBufTextB = await sharp({
      create: { width: 60, height: 60, channels: 3, background: { r: 150, g: 10, b: 120 } },
    }).jpeg().toBuffer();

    // 1. Citizen A submits a unique text complaint with image and GPS
    const uniqueText = `Fallen eucalyptus branch obstructing pedestrian footbridge in Gokulam Park ${nonce}.`;
    const formA = new FormData();
    formA.append('category', 'other');
    formA.append('description', uniqueText);
    formA.append('observedDate', '2026-03-17');
    formA.append('locationArea', 'Gokulam');
    formA.append('latitude', '12.3250');
    formA.append('longitude', '76.6350');
    formA.append('image', new Blob([imageBufTextA], { type: 'image/jpeg' }), 'footbridgeA.jpg');

    const resA = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenTokenA}`,
      },
      body: formA,
    });
    expect(resA.status).toBe(201);
    const dataA = await resA.json();
    const existingId = dataA.complaint.id;
    const existingToken = dataA.complaint.trackingToken;

    // 2. Citizen B submits near-identical text (Jaccard >= 0.90) in the same category and area with distinct image
    const formB = new FormData();
    formB.append('category', 'other');
    formB.append('description', `Fallen eucalyptus branch obstructing pedestrian footbridge in Gokulam Park near path ${nonce}.`);
    formB.append('observedDate', '2026-03-17');
    formB.append('locationArea', 'Gokulam');
    formB.append('latitude', '12.3250');
    formB.append('longitude', '76.6350');
    formB.append('image', new Blob([imageBufTextB], { type: 'image/jpeg' }), 'footbridgeB.jpg');

    const resB = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenTokenB}`,
      },
      body: formB,
    });

    // 3. Assert HTTP 409 Conflict
    expect(resB.status).toBe(409);
    const dataB = await resB.json();
    expect(dataB.code).toBe('EXACT_TEXT_DUPLICATE');
    expect(dataB.duplicateType).toBe('TEXT_EXACT_MATCH');
    expect(dataB.existingComplaint.id).toBe(existingId);
    expect(dataB.existingComplaint.trackingToken).toBe(existingToken);
    expect(dataB.existingComplaint.citizenId).toBeUndefined();
  });
});
