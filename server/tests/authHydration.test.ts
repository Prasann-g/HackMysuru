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
  apiGetMe,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  TOKEN_KEY,
  USER_SESSION_KEY,
  UNAUTHORIZED_EVENT,
  resetUnauthorizedEvictionState,
} from '../../client/src/services/api.js';

describe('CivicBridge Phase 3.3.2: Auth Hydration & apiGetMe Contract', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetUnauthorizedEvictionState();
    Object.keys(eventListeners).forEach((k) => delete eventListeners[k]);
    vi.restoreAllMocks();
  });

  it('returns null immediately without calling fetch when no token is stored', async () => {
    const fetchSpy = vi.fn();
    (globalThis as any).fetch = fetchSpy;

    const user = await apiGetMe();
    expect(user).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('treats /api/auth/me as authoritative and returns verified user on 200 OK', async () => {
    const mockVerifiedOfficer = {
      id: 'USR-OFFICER-48',
      name: 'Ward 48 Officer',
      email: 'officer.ward48@mcc.gov.in',
      role: 'OFFICER',
      department: 'MCC Engineering Division',
      ward: 'Ward 48 - Kuvempunagar',
      isActive: true,
    };

    setStoredToken('valid-officer-token');

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: mockVerifiedOfficer }),
    });

    const user = await apiGetMe();
    expect(user).toEqual(mockVerifiedOfficer);
    expect(getStoredToken()).toBe('valid-officer-token');
  });

  it('authenticates ADMIN role and preserves admin session claims', async () => {
    const mockVerifiedAdmin = {
      id: 'USR-ADMIN-01',
      name: 'System Administrator',
      email: 'admin@mcc.gov.in',
      role: 'ADMIN',
      isActive: true,
    };

    setStoredToken('valid-admin-token');

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: mockVerifiedAdmin }),
    });

    const user = await apiGetMe();
    expect(user).toEqual(mockVerifiedAdmin);
    expect(user?.role).toBe('ADMIN');
    expect(getStoredToken()).toBe('valid-admin-token');
  });

  it('clears token, removes user session, and dispatches civictrust:unauthorized when /api/auth/me returns 401', async () => {
    setStoredToken('expired-invalid-token');
    sessionStorage.setItem(
      USER_SESSION_KEY,
      JSON.stringify({ id: 'OLD-USER', role: 'OFFICER' })
    );

    let eventFired = false;
    window.addEventListener(UNAUTHORIZED_EVENT, () => {
      eventFired = true;
    });

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Token expired or invalid' }),
    });

    const user = await apiGetMe();
    expect(user).toBeNull();
    expect(getStoredToken()).toBeNull();
    expect(sessionStorage.getItem(USER_SESSION_KEY)).toBeNull();
    expect(eventFired).toBe(true);
  });

  it('safely clears stored token and returns null when backend returns 500 error', async () => {
    setStoredToken('token-with-server-error');

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    const user = await apiGetMe();
    expect(user).toBeNull();
    expect(getStoredToken()).toBeNull();
  });

  it('handles network throw/offline gracefully by returning null', async () => {
    setStoredToken('token-network-offline');

    (globalThis as any).fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const user = await apiGetMe();
    expect(user).toBeNull();
  });
});
