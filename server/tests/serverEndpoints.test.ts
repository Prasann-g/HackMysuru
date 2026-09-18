import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../src/index.js';

describe('Civic Trust Backend Server Endpoints (Step 4.1)', () => {
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

  it('GET /api/health returns 200 and Civic Trust service info', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('Civic Trust Verification Service');
    expect(data.timestamp).toBeDefined();
  });

  it('POST /api/verify returns 400 when missing required parameters', async () => {
    const res = await fetch(`${baseUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing required');
  });

  it('POST /api/verify returns 200 with explainable verification result for valid payload', async () => {
    const payload = {
      category: 'pothole',
      description: 'Major road crater on Saraswathipuram Main Road near fire station.',
      observedDate: '2026-09-18',
      referencePool: [
        {
          id: 'MCC-2026-0001',
          category: 'pothole',
          description: 'Major road crater on Saraswathipuram Main Road near fire station.',
          observedDate: '2026-09-17',
          status: 'SUBMITTED',
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.outcome).toBe('POSSIBLE_DUPLICATE');
    expect(data.duplicateRisk).toBe('HIGH');
    expect(data.signals.length).toBeGreaterThan(0);
    expect(data.uncertainties.length).toBeGreaterThan(0);
    expect(data.limitations.length).toBeGreaterThan(0);
  });
});
