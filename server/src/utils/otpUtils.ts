import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { DeliveryMethod } from '../types/otp.js';

/**
 * Generates a cryptographically secure numeric OTP of the specified length.
 */
export function generateSecureOtp(length: number = 6): string {
  let otp = '';
  for (let i = 0; i < length; i++) {
    // randomInt(0, 10) uses system CSPRNG
    otp += randomInt(0, 10).toString();
  }
  return otp;
}

/**
 * Hashes the OTP using bcrypt (cost factor 10) to prevent offline database brute-force.
 */
export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

/**
 * Verifies a plaintext OTP against its hashed version.
 */
export async function verifyOtpHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * Checks if the ISO timestamp has passed the current time.
 */
export function isExpired(expiresAt: string): boolean {
  return new Date() > new Date(expiresAt);
}

/**
 * Normalizes identifiers to prevent mismatch vulnerabilities.
 * Emails: trimmed and lowercased.
 * Phones: trimmed, spaces removed, retaining only '+' and digits.
 */
export function normalizeIdentifier(identifier: string, method: DeliveryMethod): string {
  if (!identifier) return '';
  
  if (method === 'EMAIL') {
    return identifier.trim().toLowerCase();
  } else if (method === 'SMS') {
    const trimmed = identifier.trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    return hasPlus ? `+${digits}` : digits;
  }
  return identifier.trim();
}
