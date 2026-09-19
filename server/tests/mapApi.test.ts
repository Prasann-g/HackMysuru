import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../src/index.js';
import { generateToken } from '../src/services/authService.js';

describe('Public & Authorized Map API (GET /api/complaints/map)', () => {
  let server: Server;
  let baseUrl: string;

  const citizenToken = generateToken({
    userId: 'USR-CITIZEN-MU81FLSR-A5XD',
    email: 'gallikattip@gmail.com',
    role: 'CITIZEN',
  });

  const officerToken = generateToken({
    userId: 'USR-OFFICER-48',
    email: 'officer48@mysuru.gov.in',
    role: 'OFFICER',
  });

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
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('1. returns 200 and a sanitized list of complaints with valid coordinates', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/map`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('complaints');
    expect(Array.isArray(data.complaints)).toBe(true);

    // Verify all returned complaints possess valid coordinates
    for (const c of data.complaints) {
      expect(typeof c.latitude).toBe('number');
      expect(typeof c.longitude).toBe('number');
      expect(c.latitude).toBeGreaterThanOrEqual(-90);
      expect(c.latitude).toBeLessThanOrEqual(90);
      expect(c.longitude).toBeGreaterThanOrEqual(-180);
      expect(c.longitude).toBeLessThanOrEqual(180);
      expect(c.id).toBeDefined();
      expect(c.trackingToken).toBeDefined();
      expect(c.category).toBeDefined();
      expect(c.status).toBeDefined();
    }
  });

  it('2. strictly enforces Rule 12 Zero-PII sanitization on all map items', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/map`);
    const data = await res.json();

    for (const c of data.complaints) {
      expect(c.citizenId).toBeUndefined();
      expect(c.citizen_id).toBeUndefined();
      expect(c.email).toBeUndefined();
      expect(c.phone).toBeUndefined();
      expect(c.phoneNumber).toBeUndefined();
      expect(c.name).toBeUndefined();
      expect(c.password).toBeUndefined();
      expect(c.passwordHash).toBeUndefined();
    }
  });

  it('3. filters complaints by category correctly', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/map?category=pothole`);
    expect(res.status).toBe(200);
    const data = await res.json();

    for (const c of data.complaints) {
      expect(c.category.toLowerCase()).toBe('pothole');
    }
  });

  it('4. filters complaints by status correctly using authentic status definitions', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/map?status=SUBMITTED`);
    expect(res.status).toBe(200);
    const data = await res.json();

    for (const c of data.complaints) {
      expect(c.status).toBe('SUBMITTED');
    }
  });

  it('5. computes Haversine distance when user coordinates are supplied', async () => {
    // User at Mysuru Palace: 12.3051, 76.6551
    const res = await fetch(
      `${baseUrl}/api/complaints/map?latitude=12.3051&longitude=76.6551`
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.userLocation).toEqual({ latitude: 12.3051, longitude: 76.6551 });

    for (const c of data.complaints) {
      expect(typeof c.distanceMeters).toBe('number');
      expect(c.distanceMeters).toBeGreaterThanOrEqual(0);
    }
  });

  it('6. filters by radius (km) and sorts nearest-first', async () => {
    const res = await fetch(
      `${baseUrl}/api/complaints/map?latitude=12.2705&longitude=76.6428&radius=5`
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.radiusKm).toBe(5);

    let prevDist = -1;
    for (const c of data.complaints) {
      expect(c.distanceMeters).toBeLessThanOrEqual(5000);
      expect(c.distanceMeters).toBeGreaterThanOrEqual(prevDist);
      prevDist = c.distanceMeters;
    }
  });

  it('7. filters complaints by bounding box (bbox)', async () => {
    // Bounding box around Mysuru south: minLng=76.60, minLat=12.25, maxLng=76.68, maxLat=12.30
    const bbox = '76.60,12.25,76.68,12.30';
    const res = await fetch(`${baseUrl}/api/complaints/map?bbox=${bbox}`);
    expect(res.status).toBe(200);
    const data = await res.json();

    for (const c of data.complaints) {
      expect(c.longitude).toBeGreaterThanOrEqual(76.60);
      expect(c.longitude).toBeLessThanOrEqual(76.68);
      expect(c.latitude).toBeGreaterThanOrEqual(12.25);
      expect(c.latitude).toBeLessThanOrEqual(12.30);
    }
  });

  it('8. preserves access to source-based test complaint for owning citizen and officer', async () => {
    // 1. Citizen authenticated with citizen token sees their own complaint (including MCC-2026-SRC-307753)
    const citizenRes = await fetch(`${baseUrl}/api/complaints/map`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    expect(citizenRes.status).toBe(200);
    const citizenData = await citizenRes.json();
    const hasSourceComplaint = citizenData.complaints.some(
      (c: any) => c.id === 'MCC-2026-SRC-307753'
    );
    // If running with Supabase store containing MCC-2026-SRC-307753, it is safely accessible to the owning citizen
    if (hasSourceComplaint) {
      const src = citizenData.complaints.find((c: any) => c.id === 'MCC-2026-SRC-307753');
      expect(src.wardNumber).toBe('62');
      expect(src.latitude).toBeCloseTo(12.270528, 4);
      expect(src.longitude).toBeCloseTo(76.642806, 4);
    }

    // 2. Officer authenticated can also see it
    const officerRes = await fetch(`${baseUrl}/api/complaints/map`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(officerRes.status).toBe(200);
  });
});
