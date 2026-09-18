import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../src/index.js';
import { complaintStore, sqliteComplaintStore } from '../src/db/complaintStore.js';
import { DatabaseSync } from 'node:sqlite';
import { initDatabase, setDbForTesting, closeDatabase } from '../src/db/sqlite.js';

describe('Public Map & Analytics Endpoints (Step 7)', () => {
  let server: Server;
  let baseUrl: string;

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

  it('GET /api/complaints/public-analytics returns 200 with structured aggregate metrics', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/public-analytics`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.totalComplaints).toBeDefined();
    expect(typeof data.totalComplaints).toBe('number');
    expect(data.byStatus).toBeDefined();
    expect(typeof data.byStatus).toBe('object');
    expect(data.byCategory).toBeDefined();
    expect(typeof data.byCategory).toBe('object');
    expect(data.byArea).toBeDefined();
    expect(typeof data.byArea).toBe('object');
    expect(data.byVerificationOutcome).toBeDefined();
    expect(typeof data.byVerificationOutcome).toBe('object');
    expect(data.byDuplicateRisk).toBeDefined();
    expect(typeof data.byDuplicateRisk).toBe('object');
    expect(data.coordinatesCoverage).toBeDefined();
    expect(typeof data.coordinatesCoverage.totalWithCoordinates).toBe('number');
    expect(typeof data.coordinatesCoverage.totalWithoutCoordinates).toBe('number');
    expect(typeof data.resolutionRatePercent).toBe('number');
    expect(typeof data.verifiedRatePercent).toBe('number');
    expect(Array.isArray(data.recentComplaints)).toBe(true);
    expect(typeof data.disclaimer).toBe('string');
  });

  it('Strict PII Protection: Public analytics payload contains NO citizen personal details', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/public-analytics`);
    expect(res.status).toBe(200);
    const data = await res.json();

    for (const item of data.recentComplaints) {
      // Sensitive citizen details must never leak into public analytics
      expect(item.citizenId).toBeUndefined();
      expect(item.citizen_id).toBeUndefined();
      expect(item.trackingToken).toBeUndefined();
      expect(item.tracking_token).toBeUndefined();
      expect(item.email).toBeUndefined();
      expect(item.phone).toBeUndefined();
      expect(item.name).toBeUndefined();
      // Raw description text is omitted to prevent accidental disclosure of phone/names written in freeform text
      expect(item.description).toBeUndefined();

      // Only sanitized public metadata is exposed
      expect(item.id).toBeDefined();
      expect(item.category).toBeDefined();
      expect(item.locationArea).toBeDefined();
      expect(item.status).toBeDefined();
      expect(item.observedDate).toBeDefined();
      expect(item.createdAt).toBeDefined();
      expect(typeof item.hasCoordinates).toBe('boolean');
    }
  });

  it('Handles zero-complaint empty state without division by zero or errors', async () => {
    // Create an isolated in-memory database to test zero-complaints edge case
    const testDb = new DatabaseSync(':memory:');
    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, name TEXT,
        role TEXT, ward TEXT, department TEXT, is_active INTEGER, created_at TEXT, last_login_at TEXT
      );
      CREATE TABLE complaints (
        id TEXT PRIMARY KEY, tracking_token TEXT, citizen_id TEXT,
        category TEXT, custom_category TEXT, description TEXT, observed_date TEXT,
        location_area TEXT, address_text TEXT, latitude REAL, longitude REAL,
        has_image INTEGER, evidence_metadata TEXT, image_path TEXT, image_sha256 TEXT, image_phash TEXT,
        status TEXT, verification_result TEXT, assigned_officer_id TEXT, assigned_department TEXT,
        review_notes TEXT, is_demo INTEGER, created_at TEXT, updated_at TEXT
      );
    `);

    // Temporarily point store to isolated in-memory DB
    setDbForTesting(testDb);

    try {
      const analytics = await sqliteComplaintStore.getPublicAnalytics();
      expect(analytics.totalComplaints).toBe(0);
      expect(analytics.resolutionRatePercent).toBe(0);
      expect(analytics.verifiedRatePercent).toBe(0);
      expect(analytics.coordinatesCoverage.totalWithCoordinates).toBe(0);
      expect(analytics.coordinatesCoverage.totalWithoutCoordinates).toBe(0);
      expect(Object.keys(analytics.byStatus).length).toBe(0);
      expect(Object.keys(analytics.byCategory).length).toBe(0);
      expect(Object.keys(analytics.byArea).length).toBe(0);
      expect(analytics.recentComplaints.length).toBe(0);
    } finally {
      // Reconnect back to production/test database
      closeDatabase();
      initDatabase();
    }
  });
});
