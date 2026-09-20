import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../src/index.js';

describe('Auth Service - Rate Limiting & Cooldowns', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Disable logging for testing rate limit
    process.env.NODE_ENV = 'test';
    
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

  it('should enforce 30-second cooldown per identifier and return 429', async () => {
    const uniqueId = `cooldown_${Date.now()}@example.com`;
    const payload = {
      identifier: uniqueId,
      method: 'EMAIL',
      purpose: 'REGISTER'
    };

    // First request should succeed
    const res1 = await fetch(`${baseUrl}/api/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.1.100' },
      body: JSON.stringify(payload),
    });
    if (res1.status !== 200) {
      const b = await res1.json();
      console.error(b);
    }
    expect(res1.status).toBe(200);

    // Immediate second request should hit 30s cooldown and return 429
    const res2 = await fetch(`${baseUrl}/api/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.1.100' },
      body: JSON.stringify(payload),
    });

    expect(res2.status).toBe(429);
    const data = await res2.json();
    expect(data.error).toMatch(/Please wait \d+ seconds before requesting a new code/);
  });

  it('should enforce network-level express-rate-limit across different identifiers', async () => {
    // We will simulate requests to trigger the rate limit for a specific IP.
    const testIp = '192.168.1.200';
    
    // Test environment limit is 100 per IP, so we send 105.
    const requests = Array.from({ length: 105 }).map((_, i) => {
      return fetch(`${baseUrl}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': testIp },
        body: JSON.stringify({
          identifier: `spam_${Date.now()}_${i}@example.com`,
          method: 'EMAIL',
          purpose: 'REGISTER'
        }),
      });
    });

    const responses = await Promise.all(requests);
    
    // Most should be 200, but some should be 429 due to express-rate-limit
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0);
    
    // Check one of the rate limited responses
    const data = await rateLimited[0].json();
    expect(data.error).toBe('Too many requests from this IP. Please try again after 15 minutes.');
  });
});
