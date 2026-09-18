import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config.js';
import { userStore } from '../db/userStore.js';
import type {
  AuthResponse,
  AuthTokenPayload,
  CitizenRegisterInput,
  LoginInput,
  OfficerRegisterInput,
  PublicUser,
  UserRecord,
} from '../types/auth.js';

export function sanitizeUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ward: user.ward,
    department: user.department,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: AuthTokenPayload): string {
  // Signs standard JWT with HMAC-SHA256
  return jwt.sign(payload, CONFIG.JWT_SECRET, {
    expiresIn: CONFIG.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as AuthTokenPayload;
  return decoded;
}

export async function registerCitizen(input: CitizenRegisterInput): Promise<AuthResponse> {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Full name is required.');
  }

  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    throw new Error('A valid email address is required.');
  }

  if (!input.password || input.password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = userStore.findByEmail(normalizedEmail);
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date().toISOString();
  const id = `USR-CITIZEN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // SECURITY RULE: Public registration ALWAYS assigns role 'CITIZEN'
  const user: UserRecord = {
    id,
    email: normalizedEmail,
    passwordHash,
    name: input.name.trim(),
    role: 'CITIZEN',
    ward: input.ward?.trim() || undefined,
    isActive: true,
    createdAt: now,
    lastLoginAt: now,
  };

  userStore.save(user);

  const tokenPayload: AuthTokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    ward: user.ward,
  };

  const token = generateToken(tokenPayload);

  return {
    token,
    user: sanitizeUser(user),
  };
}

export async function registerOfficer(input: OfficerRegisterInput): Promise<AuthResponse> {
  // 1. Verify Officer Invite Code
  if (!input.inviteCode || input.inviteCode.trim() !== CONFIG.OFFICER_INVITE_SECRET) {
    throw new Error('Invalid officer invite authorization code. Contact MCC Administrator.');
  }

  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Officer full name is required.');
  }

  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    throw new Error('A valid official email address is required.');
  }

  if (!input.password || input.password.length < 8) {
    throw new Error('Officer password must be at least 8 characters long.');
  }

  if (!input.ward || input.ward.trim().length === 0) {
    throw new Error('Assigned MCC Ward is required.');
  }

  if (!input.department || input.department.trim().length === 0) {
    throw new Error('Assigned Department is required.');
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = userStore.findByEmail(normalizedEmail);
  if (existing) {
    throw new Error('An account with this official email already exists.');
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date().toISOString();
  const id = `USR-OFFICER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const user: UserRecord = {
    id,
    email: normalizedEmail,
    passwordHash,
    name: input.name.trim(),
    role: 'OFFICER',
    ward: input.ward.trim(),
    department: input.department.trim(),
    isActive: true,
    createdAt: now,
    lastLoginAt: now,
  };

  userStore.save(user);

  const tokenPayload: AuthTokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    ward: user.ward,
  };

  const token = generateToken(tokenPayload);

  return {
    token,
    user: sanitizeUser(user),
  };
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  if (!input.email || !input.password) {
    throw new Error('Email and password are required.');
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const user = userStore.findByEmail(normalizedEmail);

  if (!user) {
    // Constant-time mitigation: generic error message
    throw new Error('Invalid email or password.');
  }

  if (!user.isActive) {
    throw new Error('This account has been deactivated. Please contact support.');
  }

  const isPasswordValid = await comparePassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password.');
  }

  // Update last login timestamp
  user.lastLoginAt = new Date().toISOString();
  userStore.save(user);

  const tokenPayload: AuthTokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    ward: user.ward,
  };

  const token = generateToken(tokenPayload);

  return {
    token,
    user: sanitizeUser(user),
  };
}
