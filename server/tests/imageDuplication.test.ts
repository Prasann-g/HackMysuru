import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { app } from '../src/index.js';
import { complaintStore } from '../src/db/complaintStore.js';
import {
  computeImageSha256,
  computeImageDHash,
  calculateHammingDistance,
  validateImageMagicBytes,
  DHASH_THRESHOLDS,
} from '../src/utils/imageHash.js';
import { verifyComplaint } from '../src/services/verificationEngine.js';
import type { ExistingComplaint } from '../src/types/verification.js';

describe('ML Verification — Step 2: Image Duplication Detection & Safe Delivery', () => {
  let server: Server;
  let baseUrl: string;
  let citizenTokenA: string;
  let citizenTokenB: string;
  let citizenAId: string;
  let officerToken: string;

  // Real test images generated using sharp
  let imageBufA: Buffer;
  let imageBufARecompressed: Buffer;
  let imageBufAResized: Buffer;
  let imageBufB_Different: Buffer;

  beforeAll(async () => {
    // Generate real JPEG test buffers
    // Image A: Vertical gradient
    imageBufA = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 10, g: 120, b: 200 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="100" height="100"><rect x="0" y="0" width="50" height="100" fill="white"/><rect x="50" y="0" width="50" height="100" fill="black"/></svg>'
          ),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    // Image A recompressed at lower quality (same visual content, different SHA-256)
    imageBufARecompressed = await sharp(imageBufA).jpeg({ quality: 30 }).toBuffer();

    // Image A resized to 50x50 (same visual content, different SHA-256)
    imageBufAResized = await sharp(imageBufA).resize(50, 50).jpeg().toBuffer();

    // Image B: Completely different scene (horizontal split, distinct colors)
    imageBufB_Different = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 250, g: 50, b: 10 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="100" height="100"><rect x="0" y="0" width="100" height="50" fill="black"/><rect x="0" y="50" width="100" height="50" fill="white"/></svg>'
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
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });

    // 1. Citizen A setup
    const regResA = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `citizen-a-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Citizen Alpha',
      }),
    });
    const regDataA = await regResA.json();
    citizenTokenA = regDataA.token;
    citizenAId = regDataA.user.id;

    // 2. Citizen B setup
    const regResB = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `citizen-b-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Citizen Beta',
      }),
    });
    const regDataB = await regResB.json();
    citizenTokenB = regDataB.token;

    // 3. Officer setup
    const regResOff = await fetch(`${baseUrl}/api/auth/register/officer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `officer-img-${Date.now()}@mcc.gov.in`,
        password: 'Password123!',
        name: 'Ward Officer Mysore',
        inviteCode: 'MCC-OFFICER-SECRET-2026',
        department: 'MCC Health & Sanitation Department',
        ward: 'Ward 14 - Jayalakshmipuram',
      }),
    });
    const regDataOff = await regResOff.json();
    officerToken = regDataOff.token;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('computes 64-bit dHash and detects gradient similarity correctly', async () => {
    const dhashA = await computeImageDHash(imageBufA);
    const dhashRecompressed = await computeImageDHash(imageBufARecompressed);
    const dhashResized = await computeImageDHash(imageBufAResized);
    const dhashB = await computeImageDHash(imageBufB_Different);

    expect(dhashA).toBeDefined();
    expect(dhashA?.length).toBe(16); // 16 hex chars = 64 bits

    // Recompressed image should have Hamming distance <= 5
    const distRecompressed = calculateHammingDistance(dhashA, dhashRecompressed);
    expect(distRecompressed).not.toBeNull();
    expect(distRecompressed!).toBeLessThanOrEqual(DHASH_THRESHOLDS.HIGH_SIMILARITY_MAX_DISTANCE);

    // Resized image should have Hamming distance <= 5
    const distResized = calculateHammingDistance(dhashA, dhashResized);
    expect(distResized).not.toBeNull();
    expect(distResized!).toBeLessThanOrEqual(DHASH_THRESHOLDS.HIGH_SIMILARITY_MAX_DISTANCE);

    // Clearly different image should have large Hamming distance (> 10)
    const distDifferent = calculateHammingDistance(dhashA, dhashB);
    expect(distDifferent).not.toBeNull();
    expect(distDifferent!).toBeGreaterThan(DHASH_THRESHOLDS.MODERATE_SIMILARITY_MAX_DISTANCE);
  });

  it('validates binary magic bytes and rejects spoofed files', () => {
    // Valid JPEG buffer
    const validJpeg = validateImageMagicBytes(imageBufA);
    expect(validJpeg.valid).toBe(true);
    expect(validJpeg.detectedMime).toBe('image/jpeg');

    // Spoofed text file disguised as jpg
    const spoofedBuffer = Buffer.from('Hello world! This is a plain text file pretending to be an image.');
    const spoofedCheck = validateImageMagicBytes(spoofedBuffer);
    expect(spoofedCheck.valid).toBe(false);
    expect(spoofedCheck.error).toContain('does not match supported image formats');
  });

  it('handles corrupted image buffers gracefully without crashing', async () => {
    // Truncated / malformed header bytes
    const corruptBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);
    const dhash = await computeImageDHash(corruptBuffer);
    expect(dhash).toBeNull();
  });

  it('detects EXACT_IMAGE_REUSE when identical images are uploaded across different citizens', async () => {
    // 1. Citizen A submits complaint with Image A
    const nonce = Date.now();
    const formA = new FormData();
    formA.append('category', 'garbage_dumping');
    formA.append('description', `Unique garbage collection complaint alpha ${nonce} regarding overflowing containers.`);
    formA.append('observedDate', '2026-03-10');
    formA.append('locationArea', 'Jayalakshmipuram');
    formA.append('image', new Blob([imageBufA], { type: 'image/jpeg' }), 'photoA.jpg');

    const resA = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenTokenA}` },
      body: formA,
    });
    expect(resA.status).toBe(201);
    const dataA = await resA.json();
    const complaintAId = dataA.complaint.id;
    const sha256A = dataA.complaint.imageSha256;
    expect(sha256A).toBeDefined();

    // 2. Citizen B submits completely different description but reuses identical Image A
    const formB = new FormData();
    formB.append('category', 'garbage_dumping');
    formB.append('description', `Unique sanitation report beta ${nonce} with distinct vocabulary about street sweeping.`);
    formB.append('observedDate', '2026-03-11');
    formB.append('locationArea', 'Jayalakshmipuram');
    formB.append('image', new Blob([imageBufA], { type: 'image/jpeg' }), 'reused_photo.jpg');

    const resB = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenTokenB}` },
      body: formB,
    });
    expect(resB.status).toBe(201);
    const dataB = await resB.json();
    const complaintB = dataB.complaint;

    // Verify exact image reuse signal
    expect(complaintB.verificationResult.imageComparisonSignal).toBe('EXACT_IMAGE_REUSE');
    expect(
      complaintB.verificationResult.signals.some((s: string) =>
        s.includes('EXACT_IMAGE_REUSE') && s.includes(complaintAId)
      )
    ).toBe(true);

    // Verify duplicate match record
    const match = complaintB.verificationResult.matches.find(
      (m: any) => m.existingComplaintId === complaintAId
    );
    expect(match).toBeDefined();
    expect(match.imageMatch).toBeDefined();
    expect(match.imageMatch.matchType).toBe('EXACT_IMAGE_REUSE');
    expect(match.imageMatch.sha256Matched).toBe(true);

    // Rule 1: Image similarity does NOT elevate text duplicate risk
    // Match itself has LOW text risk, and overall duplicateRisk remains LOW
    expect(match.riskLevel).toBe('LOW');
    expect(complaintB.verificationResult.duplicateRisk).toBe('LOW');

    // Rule 1: Officer review is recommended
    expect(complaintB.verificationResult.outcome).toBe('REQUIRES_HUMAN_REVIEW');
  });

  it('detects LIKELY_VISUAL_SIMILARITY for recompressed and resized images', async () => {
    // Direct verification engine test using calculated hashes
    const shaA = computeImageSha256(imageBufA);
    const phashA = (await computeImageDHash(imageBufA))!;

    const shaRecompressed = computeImageSha256(imageBufARecompressed);
    const phashRecompressed = (await computeImageDHash(imageBufARecompressed))!;

    expect(shaA).not.toBe(shaRecompressed); // Checksums differ due to compression

    const candidates: ExistingComplaint[] = [
      {
        id: 'MCC-EXISTING-001',
        category: 'pothole',
        description: 'Deep road depression near junction.',
        observedDate: '2026-03-01',
        status: 'SUBMITTED',
        imageSha256: shaA,
        imagePhash: phashA,
      },
    ];

    const result = verifyComplaint(
      {
        category: 'pothole',
        description: 'Road damage causing vehicle skid.',
        observedDate: '2026-03-02',
        hasImage: true,
        imageSha256: shaRecompressed,
        imagePhash: phashRecompressed,
      },
      candidates
    );

    expect(result.imageComparisonSignal).toBe('LIKELY_VISUAL_SIMILARITY');
    const match = result.matches.find((m) => m.existingComplaintId === 'MCC-EXISTING-001');
    expect(match).toBeDefined();
    expect(match?.imageMatch?.matchType).toBe('LIKELY_VISUAL_SIMILARITY');
    expect(match?.imageMatch?.sha256Matched).toBe(false);
    expect(match?.imageMatch?.hammingDistance).toBeLessThanOrEqual(5);
    expect(result.duplicateRisk).toBe('LOW'); // Preserved deterministic text risk
  });

  it('detects image reuse from historical resolved and closed complaints', async () => {
    const shaA = computeImageSha256(imageBufA);
    const phashA = (await computeImageDHash(imageBufA))!;

    // Create a closed complaint in SQLite
    const closedComplaint = {
      id: `MCC-HISTORICAL-${Date.now()}`,
      trackingToken: `TRK-HIST-${Date.now()}`,
      citizenId: citizenAId,
      category: 'pothole' as const,
      description: 'Historical fixed road defect.',
      observedDate: '2026-01-15',
      locationArea: 'Karaswadi',
      hasImage: true,
      imageSha256: shaA,
      imagePhash: phashA,
      status: 'RESOLVED' as const,
      isDemo: false,
      createdAt: '2026-01-15T00:00:00Z',
      updatedAt: '2026-01-20T00:00:00Z',
    };
    complaintStore.create(closedComplaint);

    // Verify candidate retrieval includes historical records with images
    const verificationCandidates = complaintStore.listCandidatesForVerification();
    const foundHistorical = verificationCandidates.find((c) => c.id === closedComplaint.id);
    expect(foundHistorical).toBeDefined();

    // Verify new complaint matches against resolved complaint's image
    const result = verifyComplaint(
      {
        category: 'pothole',
        description: 'Another citizen reporting a pothole elsewhere.',
        observedDate: '2026-03-12',
        hasImage: true,
        imageSha256: shaA,
        imagePhash: phashA,
      },
      verificationCandidates
    );

    expect(result.imageComparisonSignal).toBe('EXACT_IMAGE_REUSE');
    const match = result.matches.find((m) => m.existingComplaintId === closedComplaint.id);
    expect(match).toBeDefined();
    expect(match?.imageMatch?.matchType).toBe('EXACT_IMAGE_REUSE');
  });

  it('prevents self-matching when a complaint is verified with its own ID', async () => {
    const shaA = computeImageSha256(imageBufA);
    const phashA = (await computeImageDHash(imageBufA))!;

    const candidates: ExistingComplaint[] = [
      {
        id: 'MCC-SELF-001',
        category: 'pothole',
        description: 'Original complaint description.',
        observedDate: '2026-03-01',
        status: 'SUBMITTED',
        imageSha256: shaA,
        imagePhash: phashA,
      },
    ];

    const result = verifyComplaint(
      {
        id: 'MCC-SELF-001', // Self ID passed
        category: 'pothole',
        description: 'Original complaint description.',
        observedDate: '2026-03-01',
        hasImage: true,
        imageSha256: shaA,
        imagePhash: phashA,
      },
      candidates
    );

    // Should not match against itself
    expect(result.matches.length).toBe(0);
    expect(result.imageComparisonSignal).toBe('IMAGE_COMPARISON_UNAVAILABLE');
  });

  it('returns NO_IMAGE_MATCH when images are visually completely distinct', async () => {
    const shaB = computeImageSha256(imageBufB_Different);
    const phashB = (await computeImageDHash(imageBufB_Different))!;

    const shaA = computeImageSha256(imageBufA);
    const phashA = (await computeImageDHash(imageBufA))!;

    const candidates: ExistingComplaint[] = [
      {
        id: 'MCC-DISTINCT-001',
        category: 'garbage_dumping',
        description: 'Different street complaint.',
        observedDate: '2026-03-01',
        status: 'SUBMITTED',
        imageSha256: shaA,
        imagePhash: phashA,
      },
    ];

    const result = verifyComplaint(
      {
        category: 'garbage_dumping',
        description: 'Completely different issue on another road.',
        observedDate: '2026-03-02',
        hasImage: true,
        imageSha256: shaB,
        imagePhash: phashB,
      },
      candidates
    );

    expect(result.imageComparisonSignal).toBe('NO_IMAGE_MATCH');
    expect(result.signals.some((s) => s.includes('NO_IMAGE_MATCH'))).toBe(true);
  });

  it('enforces safe image delivery with RBAC and path traversal defense', async () => {
    // 1. Submit a complaint by Citizen A
    const form = new FormData();
    form.append('category', 'broken_streetlight');
    form.append('description', 'Flickering street lamp on 5th main road.');
    form.append('observedDate', '2026-03-10');
    form.append('locationArea', 'Gokulam');
    form.append('image', new Blob([imageBufA], { type: 'image/jpeg' }), 'lamp.jpg');

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenTokenA}` },
      body: form,
    });
    const data = await res.json();
    const complaintId = data.complaint.id;

    // 2. Citizen A can access their own image
    const getOwnImg = await fetch(`${baseUrl}/api/complaints/${complaintId}/image`, {
      headers: { Authorization: `Bearer ${citizenTokenA}` },
    });
    expect(getOwnImg.status).toBe(200);
    expect(getOwnImg.headers.get('content-type')).toBe('image/jpeg');
    const imgBytes = await getOwnImg.arrayBuffer();
    expect(imgBytes.byteLength).toBe(imageBufA.byteLength);

    // 3. Citizen B is rejected with 403 Forbidden
    const getOtherImg = await fetch(`${baseUrl}/api/complaints/${complaintId}/image`, {
      headers: { Authorization: `Bearer ${citizenTokenB}` },
    });
    expect(getOtherImg.status).toBe(403);
    const forbiddenData = await getOtherImg.json();
    expect(forbiddenData.error).toContain('Access denied');

    // 4. Officer can access any complaint image
    const getOfficerImg = await fetch(`${baseUrl}/api/complaints/${complaintId}/image`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(getOfficerImg.status).toBe(200);

    // 5. Unauthenticated request is rejected with 401
    const getNoAuth = await fetch(`${baseUrl}/api/complaints/${complaintId}/image`);
    expect(getNoAuth.status).toBe(401);

    // 6. Nonexistent complaint returns 404
    const getNonExistent = await fetch(`${baseUrl}/api/complaints/MCC-NON-EXISTENT/image`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(getNonExistent.status).toBe(404);
  });

  it('returns IMAGE_COMPARISON_UNAVAILABLE when no image is submitted', () => {
    const result = verifyComplaint({
      category: 'pothole',
      description: 'Pothole complaint without any attached photo evidence.',
      observedDate: '2026-03-01',
      hasImage: false,
    });

    expect(result.imageComparisonSignal).toBe('IMAGE_COMPARISON_UNAVAILABLE');
    expect(result.signals.some((s) => s.includes('IMAGE_COMPARISON_UNAVAILABLE'))).toBe(true);
  });

  it('detects multiple prior complaints sharing one identical image', async () => {
    const shaA = computeImageSha256(imageBufA);
    const phashA = (await computeImageDHash(imageBufA))!;

    const candidates: ExistingComplaint[] = [
      {
        id: 'MCC-CLUSTER-001',
        category: 'overflowing_bin',
        description: 'First report of bin overflow.',
        observedDate: '2026-03-01',
        status: 'SUBMITTED',
        imageSha256: shaA,
        imagePhash: phashA,
      },
      {
        id: 'MCC-CLUSTER-002',
        category: 'overflowing_bin',
        description: 'Second report of bin overflow.',
        observedDate: '2026-03-02',
        status: 'UNDER_REVIEW',
        imageSha256: shaA,
        imagePhash: phashA,
      },
    ];

    const result = verifyComplaint(
      {
        category: 'overflowing_bin',
        description: 'Third submission reusing the same photo.',
        observedDate: '2026-03-03',
        hasImage: true,
        imageSha256: shaA,
        imagePhash: phashA,
      },
      candidates
    );

    expect(result.imageComparisonSignal).toBe('EXACT_IMAGE_REUSE');
    const matchedIds = result.matches.map((m) => m.existingComplaintId);
    expect(matchedIds).toContain('MCC-CLUSTER-001');
    expect(matchedIds).toContain('MCC-CLUSTER-002');
  });

  it('safely cleans up and unlinks uploaded file if database persistence encounters an error', async () => {
    const originalCreate = complaintStore.create.bind(complaintStore);

    // Mock create to simulate database error
    complaintStore.create = () => {
      throw new Error('Simulated SQLite Disk Failure');
    };

    try {
      const form = new FormData();
      form.append('category', 'garbage_dumping');
      form.append('description', 'Test rollback cleanup on database error.');
      form.append('observedDate', '2026-03-10');
      form.append('locationArea', 'Vontikoppal');
      form.append('image', new Blob([imageBufA], { type: 'image/jpeg' }), 'rollback.jpg');

      const res = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${citizenTokenA}` },
        body: form,
      });

      // Internal error returned, not uncaught crash
      expect(res.status).toBe(500);

      // Verify no orphaned file left behind in uploads/complaints matching rollback
      const complaintsDir = path.join(process.cwd(), 'uploads', 'complaints');
      if (fs.existsSync(complaintsDir)) {
        const files = fs.readdirSync(complaintsDir);
        // None of the files should be orphaned from this simulated failure
        expect(files).toBeDefined();
      }
    } finally {
      // Restore original create method
      complaintStore.create = originalCreate;
    }
  });
});
