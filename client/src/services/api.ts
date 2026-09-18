import type { CitizenUser } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'civictrust_token';

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // SessionStorage may be restricted in private/sandboxed windows
  }
}

export function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore error on clearing
  }
}

interface AuthApiResponse {
  token: string;
  user: CitizenUser;
}

export async function apiLogin(credentials: {
  email: string;
  password: string;
}): Promise<AuthApiResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed. Please check your credentials.');
  }

  setStoredToken(data.token);
  return data;
}

export async function apiRegisterCitizen(payload: {
  name: string;
  email: string;
  password: string;
  ward?: string;
}): Promise<AuthApiResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register/citizen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed. Please try again.');
  }

  setStoredToken(data.token);
  return data;
}

export async function apiGetMe(): Promise<CitizenUser | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      clearStoredToken();
      return null;
    }

    const data = await res.json();
    return data.user;
  } catch {
    // If backend is unreachable or network is offline, return null
    return null;
  }
}
