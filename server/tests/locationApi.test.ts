import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { app } from '../src/index.js';
import { sqliteUserStore } from '../src/db/userStore.js';
import { complaintStore } from '../src/db/complaintStore.js';

describe('GPS & Ward Resolution API Endpoints (locationApi.test.ts)', () => {
  let server: Server;
  let baseUrl: string;
  let citizenToken: string;
  let otherCitizenToken: string;
  let testComplaintId: string;

  beforeAll(async () => {
    // Start test server on dynamic port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });

    sqliteUserStore.seedDefaultUsers();

    // Register citizen 1
    const citRes1 = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Location Test Citizen 1',
        email: `loc.cit1.${Date.now()}@example.com`,
        password: 'password123',
        ward: 'Hebbalu',
      }),
    });
    const citData1 = await citRes1.json();
    citizenToken = citData1.token;

    // Register citizen 2
    const citRes2 = await fetch(`${baseUrl}/api/auth/register/citizen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Location Test Citizen 2',
        email: `loc.cit2.${Date.now()}@example.com`,
        password: 'password123',
        ward: 'Saraswathipuram',
      }),
    });
    const citData2 = await citRes2.json();
    otherCitizenToken = citData2.token;

    // Create a base complaint with Citizen 1 (no GPS coordinates initially)
    const now = new Date().toISOString();
    const baseComplaint = await complaintStore.create({
      id: `CMP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      trackingToken: `TRK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      citizenId: citData1.user.id,
      category: 'pothole',
      description: `Unique road damage near Hebbalu lake waiting for GPS tag ${Date.now()}.`,
      observedDate: '2026-09-19',
      locationArea: 'Hebbalu',
      hasImage: true,
      status: 'SUBMITTED',
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    });
    testComplaintId = baseComplaint.id;
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('PATCH /api/complaints/:id/location', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: 12.349695,
          longitude: 76.609568,
        }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects unauthorized citizens attempting to modify another user complaint with 403', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherCitizenToken}`,
        },
        body: JSON.stringify({
          latitude: 12.349695,
          longitude: 76.609568,
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('authorized');
    });

    it('rejects missing or invalid coordinates with 400', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`,
        },
        body: JSON.stringify({
          latitude: 'invalid_lat',
          longitude: 76.609568,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('updates GPS coordinates and resolves Ward 1 for authentic centroid', async () => {
      // Authentic Ward 1 centroid: 12.349695, 76.609568
      const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`,
        },
        body: JSON.stringify({
          latitude: 12.349695,
          longitude: 76.609568,
          locationAccuracy: 6.4,
          locationSource: 'browser_gps',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ward).toBeDefined();
      expect(data.ward.status).toBe('matched');
      expect(data.ward.number).toBe('1');
      expect(data.ward.name).toBe('Hebbalu Lakshmikanthanagar');
      expect(data.ward.boundaryVersion).toBe('mysuru-mcc-wards-65');

      // Verify persistence in complaintStore
      const updated = await complaintStore.findById(testComplaintId);
      expect(updated).toBeDefined();
      expect(updated?.latitude).toBeCloseTo(12.349695, 5);
      expect(updated?.longitude).toBeCloseTo(76.609568, 5);
      expect(updated?.locationAccuracy).toBe(6.4);
      expect(updated?.locationSource).toBe('browser_gps');
      expect(updated?.wardNumber).toBe('1');
      expect(updated?.wardName).toBe('Hebbalu Lakshmikanthanagar');
      expect(updated?.wardId).toBe(6354);
      expect(updated?.boundaryVersion).toBe('mysuru-mcc-wards-65');
      expect(updated?.routingDecision?.authorityType).toBe('MCC');
    });

    it('handles outside-boundary coordinate gracefully without failing or assigning default ward', async () => {
      // Bengaluru coordinate: 12.9716, 77.5946
      const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`,
        },
        body: JSON.stringify({
          latitude: 12.9716,
          longitude: 77.5946,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ward).toBeDefined();
      expect(data.ward.status).toBe('outside_boundary');
      expect(data.ward.number == null).toBe(true);
      expect(data.ward.name == null).toBe(true);

      // Verify database preserves GPS but leaves ward empty
      const updated = await complaintStore.findById(testComplaintId);
      expect(updated?.latitude).toBeCloseTo(12.9716, 4);
      expect(updated?.longitude).toBeCloseTo(77.5946, 4);
      expect(updated?.wardNumber).toBeUndefined();
      expect(updated?.routingDecision?.authorityType).toBe('UNKNOWN');
      expect(updated?.routingDecision?.status).toBe('REVIEW_REQUIRED');
    });
  });

  describe('POST /api/routing/ward-lookup', () => {
    it('returns matched ward details for authentic Mysuru coordinates', async () => {
      const res = await fetch(`${baseUrl}/api/routing/ward-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: 12.265741,
          longitude: 76.624681, // Ward 65 centroid
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('matched');
      expect(data.wardNumber).toBe('65');
      expect(data.wardName).toBe('Srirampura');
      expect(data.boundaryVersion).toBe('mysuru-mcc-wards-65');
    });

    it('returns outside_boundary for coordinates outside Mysuru', async () => {
      const res = await fetch(`${baseUrl}/api/routing/ward-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: 13.0827,
          longitude: 80.2707, // Chennai
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('outside_boundary');
      expect(data.wardNumber == null).toBe(true);
    });
  });

  describe('GET /api/wards/geojson', () => {
    it('serves authentic 65-ward FeatureCollection with CRS84 projection', async () => {
      const res = await fetch(`${baseUrl}/api/wards/geojson`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.type).toBe('FeatureCollection');
      expect(data.features.length).toBe(65);
      expect(data.features[0].geometry.type).toBe('Polygon');
      expect(data.features[0].properties.KGISWardNo).toBeDefined();
    });
  });
});
