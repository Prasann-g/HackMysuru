import { describe, it, expect, beforeEach, vi } from 'vitest';

// Setup browser globals mock for Node environment
const storageMock: Record<string, string> = {};
const eventListeners: Record<string, Function[]> = {};

(globalThis as any).sessionStorage = {
  getItem: (key: string) => storageMock[key] ?? null,
  setItem: (key: string, value: string) => {
    storageMock[key] = String(value);
  },
  removeItem: (key: string) => {
    delete storageMock[key];
  },
  clear: () => {
    Object.keys(storageMock).forEach((k) => delete storageMock[k]);
  },
};

(globalThis as any).window = {
  dispatchEvent: (event: any) => {
    const list = eventListeners[event.type] || [];
    list.forEach((cb) => cb(event));
    return true;
  },
  addEventListener: (type: string, cb: Function) => {
    if (!eventListeners[type]) eventListeners[type] = [];
    eventListeners[type].push(cb);
  },
  removeEventListener: (type: string, cb: Function) => {
    if (eventListeners[type]) {
      eventListeners[type] = eventListeners[type].filter((fn) => fn !== cb);
    }
  },
};

(globalThis as any).CustomEvent = class CustomEvent {
  type: string;
  detail: any;
  constructor(type: string, params?: any) {
    this.type = type;
    this.detail = params?.detail;
  }
};

import {
  handleUnauthorizedResponse,
  getStoredToken,
  setStoredToken,
  TOKEN_KEY,
  USER_SESSION_KEY,
  UNAUTHORIZED_EVENT,
  resetUnauthorizedEvictionState,
  apiGetOfficerComplaints,
  apiGetMyComplaints,
  apiUpdateOfficerReview,
  apiResolveDuplicateCluster,
} from '../../client/src/services/api.js';

describe('Centralized 401 Session Eviction (Phase 3.3.1)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetUnauthorizedEvictionState();
    Object.keys(eventListeners).forEach((k) => delete eventListeners[k]);
    vi.restoreAllMocks();
  });

  it('detects HTTP 401 responses, removes stored token, removes cached user session, and dispatches civictrust:unauthorized event', () => {
    setStoredToken('test-jwt-token-123');
    sessionStorage.setItem(
      USER_SESSION_KEY,
      JSON.stringify({ id: 'USR-OFFICER-48', role: 'OFFICER', name: 'Ward 48 Officer' })
    );

    let eventFired = false;
    window.addEventListener(UNAUTHORIZED_EVENT, () => {
      eventFired = true;
    });

    const response401 = new Response(JSON.stringify({ error: 'Session expired or invalid.' }), {
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'Content-Type': 'application/json' },
    });

    const returned = handleUnauthorizedResponse(response401);

    expect(returned).toBe(response401);
    expect(getStoredToken()).toBeNull();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(USER_SESSION_KEY)).toBeNull();
    expect(eventFired).toBe(true);
  });

  it('does NOT clear session or dispatch unauthorized event on HTTP 403 Forbidden', () => {
    setStoredToken('test-jwt-token-456');
    sessionStorage.setItem(
      USER_SESSION_KEY,
      JSON.stringify({ id: 'USR-CITIZEN-01', role: 'CITIZEN', name: 'Citizen User' })
    );

    let eventFired = false;
    window.addEventListener(UNAUTHORIZED_EVENT, () => {
      eventFired = true;
    });

    const response403 = new Response(JSON.stringify({ error: 'Access denied: officer role required.' }), {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'Content-Type': 'application/json' },
    });

    const returned = handleUnauthorizedResponse(response403);

    expect(returned).toBe(response403);
    expect(getStoredToken()).toBe('test-jwt-token-456');
    expect(sessionStorage.getItem(USER_SESSION_KEY)).not.toBeNull();
    expect(eventFired).toBe(false);
  });

  it('does NOT clear session or dispatch unauthorized event on 200, 400, 404, or 500 responses', () => {
    setStoredToken('test-jwt-token-789');
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify({ id: 'USR-01' }));

    let eventFired = false;
    window.addEventListener(UNAUTHORIZED_EVENT, () => {
      eventFired = true;
    });

    [200, 400, 404, 500].forEach((status) => {
      const res = new Response(JSON.stringify({}), { status });
      handleUnauthorizedResponse(res);
      expect(getStoredToken()).toBe('test-jwt-token-789');
      expect(sessionStorage.getItem(USER_SESSION_KEY)).not.toBeNull();
      expect(eventFired).toBe(false);
    });
  });

  it('evicts session and dispatches unauthorized event when apiGetOfficerComplaints receives 401', async () => {
    setStoredToken('expired-officer-token');
    sessionStorage.setItem(
      USER_SESSION_KEY,
      JSON.stringify({ id: 'USR-OFFICER-48', role: 'OFFICER' })
    );

    let eventFired = false;
    window.addEventListener(UNAUTHORIZED_EVENT, () => {
      eventFired = true;
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'jwt expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(apiGetOfficerComplaints()).rejects.toThrow('jwt expired');

    expect(getStoredToken()).toBeNull();
    expect(sessionStorage.getItem(USER_SESSION_KEY)).toBeNull();
    expect(eventFired).toBe(true);
  });

  it('evicts session and dispatches unauthorized event when apiGetMyComplaints receives 401', async () => {
    setStoredToken('expired-citizen-token');
    sessionStorage.setItem(
      USER_SESSION_KEY,
      JSON.stringify({ id: 'USR-CITIZEN-01', role: 'CITIZEN' })
    );

    let eventFired = false;
    window.addEventListener(UNAUTHORIZED_EVENT, () => {
      eventFired = true;
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Token revoked or invalid.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(apiGetMyComplaints()).rejects.toThrow('Token revoked or invalid.');

    expect(getStoredToken()).toBeNull();
    expect(sessionStorage.getItem(USER_SESSION_KEY)).toBeNull();
    expect(eventFired).toBe(true);
  });

  it('preserves existing token when apiGetOfficerComplaints receives 403 Forbidden', async () => {
    setStoredToken('valid-token-insufficient-role');
    sessionStorage.setItem(
      USER_SESSION_KEY,
      JSON.stringify({ id: 'USR-CITIZEN-01', role: 'CITIZEN' })
    );

    let eventFired = false;
    window.addEventListener(UNAUTHORIZED_EVENT, () => {
      eventFired = true;
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Access denied: insufficient permissions.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(apiGetOfficerComplaints()).rejects.toThrow('Access denied: insufficient permissions.');

    expect(getStoredToken()).toBe('valid-token-insufficient-role');
    expect(sessionStorage.getItem(USER_SESSION_KEY)).not.toBeNull();
    expect(eventFired).toBe(false);
  });

  it('prevents duplicate unauthorized event dispatch during rapid concurrent 401 responses', () => {
    setStoredToken('concurrent-test-token');
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify({ id: 'USR-01' }));

    let eventCount = 0;
    window.addEventListener(UNAUTHORIZED_EVENT, () => {
      eventCount++;
    });

    const res1 = new Response(JSON.stringify({ error: '401 Unauthorized' }), { status: 401 });
    const res2 = new Response(JSON.stringify({ error: '401 Unauthorized' }), { status: 401 });
    const res3 = new Response(JSON.stringify({ error: '401 Unauthorized' }), { status: 401 });

    handleUnauthorizedResponse(res1);
    handleUnauthorizedResponse(res2);
    handleUnauthorizedResponse(res3);

    expect(eventCount).toBe(1);
    expect(getStoredToken()).toBeNull();
  });

  it('evicts session when apiUpdateOfficerReview receives 401', async () => {
    setStoredToken('expired-officer-token');
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify({ id: 'USR-01' }));

    let eventFired = false;
    window.addEventListener(UNAUTHORIZED_EVENT, () => {
      eventFired = true;
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'jwt expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      apiUpdateOfficerReview('CMP-123', { status: 'IN_PROGRESS' })
    ).rejects.toThrow('jwt expired');

    expect(getStoredToken()).toBeNull();
    expect(sessionStorage.getItem(USER_SESSION_KEY)).toBeNull();
    expect(eventFired).toBe(true);
  });

  it('evicts session when apiResolveDuplicateCluster receives 401', async () => {
    setStoredToken('expired-officer-token');
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify({ id: 'USR-01' }));

    let eventFired = false;
    window.addEventListener(UNAUTHORIZED_EVENT, () => {
      eventFired = true;
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'jwt expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      apiResolveDuplicateCluster('CMP-123', {
        actionType: 'MERGE_DUPLICATES',
        targetComplaintId: 'CMP-456',
        decisionNotes: 'Duplicate issue confirmed on field.',
      })
    ).rejects.toThrow('jwt expired');

    expect(getStoredToken()).toBeNull();
    expect(sessionStorage.getItem(USER_SESSION_KEY)).toBeNull();
    expect(eventFired).toBe(true);
  });
});
