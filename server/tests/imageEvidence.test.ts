import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from '../src/index.js';
import { complaintStore } from '../src/db/complaintStore.js';

describe('ML Verification — Step 1: Image Evidence Infrastructure', () => {
  let server: Server;
  let baseUrl: string;
  let citizenToken: string;

  const runNonce = Date.now();
  // Minimal valid JPEG header bytes with unique runNonce payload
  const sampleJpeg = Buffer.concat([
    Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0xff, 0xd9,
    ]),
    Buffer.from(`-jpeg-${runNonce}`),
  ]);

  // Minimal valid PNG header bytes with unique runNonce payload
  const samplePng = Buffer.concat([
    Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]),
    Buffer.from(`-png-${runNonce}`),
  ]);

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

    // Register test citizen
    const testEmail = `citizen.evidence.${Date.now()}@example.com`;
    const resCit = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Darshan Citizen',
        email: testEmail,
        password: 'Password123!',
        ward: 'Saraswathipuram',
      }),
    });
    const citData = await resCit.json();
    citizenToken = citData.token;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // 1. Successful Image Upload & SHA-256 Computation
  it('successfully uploads a JPEG image, generates SHA-256 hash, and saves file to upload directory', async () => {
    const expectedSha256 = crypto
      .createHash('sha256')
      .update(sampleJpeg)
      .digest('hex');

    const formData = new FormData();
    formData.append('category', 'pothole');
    formData.append(
      'description',
      `Severe hazardous road crater causing traffic disruption in Saraswathipuram ${runNonce}.`
    );
    formData.append('observedDate', '2026-09-18');
    formData.append('locationArea', 'Saraswathipuram');
    formData.append('latitude', '12.3051');
    formData.append('longitude', '76.6551');
    formData.append(
      'image',
      new Blob([sampleJpeg], { type: 'image/jpeg' }),
      'pothole_evidence.jpg'
    );

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
      body: formData,
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.complaint).toBeDefined();
    expect(data.complaint.hasImage).toBe(true);
    expect(data.complaint.imageSha256).toBe(expectedSha256);
    expect(data.complaint.imagePath).toBeDefined();
    expect(data.complaint.imagePath).toContain('uploads/complaints');

    // Verify physical file existence on disk
    const diskPath = path.resolve(process.cwd(), data.complaint.imagePath);
    expect(fs.existsSync(diskPath)).toBe(true);
    const fileBytes = fs.readFileSync(diskPath);
    expect(fileBytes.equals(sampleJpeg)).toBe(true);

    // Verify database persistence directly from store
    const stored = await complaintStore.findById(data.complaint.id);
    expect(stored).toBeDefined();
    expect(stored!.hasImage).toBe(true);
    expect(stored!.imageSha256).toBe(expectedSha256);
    expect(stored!.imagePath).toBe(data.complaint.imagePath);
    expect(stored!.imagePhash).toBeUndefined(); // Perceptual hash not yet active
  });

  // 2. Successful PNG Image Upload
  it('successfully processes PNG image evidence and computes exact SHA-256 hash', async () => {
    const expectedSha256 = crypto
      .createHash('sha256')
      .update(samplePng)
      .digest('hex');

    const formData = new FormData();
    formData.append('category', 'garbage_dumping');
    formData.append(
      'description',
      `Illegal municipal solid waste accumulation near community park ${runNonce}.`
    );
    formData.append('observedDate', '2026-09-18');
    formData.append('locationArea', 'Kuvempunagar');
    formData.append('latitude', '12.3051');
    formData.append('longitude', '76.6551');
    formData.append(
      'image',
      new Blob([samplePng], { type: 'image/png' }),
      'waste_evidence.png'
    );

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
      body: formData,
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.complaint.hasImage).toBe(true);
    expect(data.complaint.imageSha256).toBe(expectedSha256);

    // Verify lookup by SHA-256
    const matches = await complaintStore.findByImageSha256(expectedSha256);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((m) => m.id === data.complaint.id)).toBe(true);
  });

  // 3. Rejection When No Image is Uploaded
  it('rejects complaint when no photo evidence is uploaded (HTTP 400 IMAGE_REQUIRED)', async () => {
    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        category: 'broken_streetlight',
        description: `Completely unique dark alleyway without street lights near old post office ${runNonce}.`,
        observedDate: '2026-09-18',
        locationArea: 'Jayalakshmipuram',
        latitude: 12.3051,
        longitude: 76.6551,
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('IMAGE_REQUIRED');
    expect(data.error).toContain('Photographic evidence is mandatory');
  });

  // 4. Invalid File Type Rejection
  it('rejects unsupported file formats with 400 Bad Request', async () => {
    const textBuffer = Buffer.from('This is not an image file content.');

    const formData = new FormData();
    formData.append('category', 'pothole');
    formData.append(
      'description',
      'Test description for invalid file upload format verification.'
    );
    formData.append('observedDate', '2026-09-18');
    formData.append('locationArea', 'Vijayanagar');
    formData.append('latitude', '12.3051');
    formData.append('longitude', '76.6551');
    formData.append(
      'image',
      new Blob([textBuffer], { type: 'text/plain' }),
      'fake_evidence.txt'
    );

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
      body: formData,
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Unsupported file type|Only JPEG, PNG, and WebP/i);
  });

  // 5. Oversized File Rejection
  it('rejects oversized files exceeding size limit with 400 Bad Request', async () => {
    // Exceed CONFIG.MAX_FILE_SIZE_BYTES (10MB) with 11MB payload
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024, 0x00);

    const formData = new FormData();
    formData.append('category', 'pothole');
    formData.append(
      'description',
      'Test description for oversized image rejection verification.'
    );
    formData.append('observedDate', '2026-09-18');
    formData.append('locationArea', 'Gokulam');
    formData.append('latitude', '12.3051');
    formData.append('longitude', '76.6551');
    formData.append(
      'image',
      new Blob([oversizedBuffer], { type: 'image/jpeg' }),
      'huge_evidence.jpg'
    );

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenToken}`,
      },
      body: formData,
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/exceeds the allowed limit|File size exceeds/i);
  });
});
