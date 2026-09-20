import { generateSecureOtp, hashOtp, verifyOtpHash, isExpired, normalizeIdentifier } from '../utils/otpUtils.js';
import type { OtpChallenge, IOtpStore, DeliveryMethod, OtpProvider } from '../types/otp.js';

export class OtpService {
  constructor(
    private store: IOtpStore, 
    private provider: OtpProvider,
    private validityMinutes: number = 10, 
    private maxAttempts: number = 3
  ) {}

  async createChallenge(identifier: string, method: DeliveryMethod, purpose: 'REGISTER' | 'LOGIN'): Promise<{ challengeId: string }> {
    const normalizedId = normalizeIdentifier(identifier, method);

    const existing = await this.store.findByIdentifier(normalizedId);
    if (existing && existing.createdAt) {
      const ageMs = Date.now() - new Date(existing.createdAt).getTime();
      if (ageMs < 30000) {
        const remaining = Math.ceil((30000 - ageMs) / 1000);
        throw new Error(`Please wait ${remaining} seconds before requesting a new code.`);
      }
    }

    // NOTE: Concurrency safety natively relies on the Store implementation executing an atomic UPSERT.
    // The underlying store MUST overwrite any existing challenge with the same identifier.

    const rawCode = generateSecureOtp(6);
    const hashedCode = await hashOtp(rawCode);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.validityMinutes * 60000);

    const challengeId = `OTP-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const challenge: OtpChallenge = {
      id: challengeId,
      identifier: normalizedId,
      hashedCode,
      deliveryMethod: method,
      purpose,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      attempts: 0,
      maxAttempts: this.maxAttempts
    };

    await this.store.save(challenge);
    
    try {
      // SECURITY: Send OTP internally so rawCode NEVER leaks to controllers or HTTP responses
      await this.provider.sendChallenge(normalizedId, rawCode, method);
    } catch (error) {
      // If provider fails (e.g. SMTP down), clean up the unusable challenge immediately
      await this.store.delete(challengeId);
      throw new Error('Failed to send OTP challenge. Please try again later.');
    }
    
    // Only return safe, non-sensitive challenge metadata
    return { challengeId };
  }

  async verifyChallenge(identifier: string, method: DeliveryMethod, submittedCode: string): Promise<boolean> {
    const normalizedId = normalizeIdentifier(identifier, method);
    const challenge = await this.store.findByIdentifier(normalizedId);
    
    if (!challenge) {
      throw new Error('No active OTP challenge found.');
    }

    if (isExpired(challenge.expiresAt)) {
      await this.store.delete(challenge.id);
      throw new Error('OTP has expired. Please request a new one.');
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      await this.store.delete(challenge.id);
      throw new Error('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    // Increment attempts immediately to track velocity
    challenge.attempts += 1;
    await this.store.save(challenge);

    // Cryptographic timing-safe comparison via bcrypt
    const isValid = await verifyOtpHash(submittedCode, challenge.hashedCode);
    
    if (isValid) {
      // SECURITY: Single-use enforcement. Destroy challenge immediately upon success.
      await this.store.delete(challenge.id);
      return true;
    }

    return false;
  }
}
