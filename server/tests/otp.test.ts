import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { generateSecureOtp, hashOtp, verifyOtpHash, isExpired, normalizeIdentifier } from '../src/utils/otpUtils.js';
import { OtpService } from '../src/services/otpService.js';
import { MemoryOtpStore } from '../src/db/memoryOtpStore.js';
import type { DeliveryMethod, OtpProvider } from '../src/types/otp.js';

// Mock Provider to intercept codes securely within the test context
class MockOtpProvider implements OtpProvider {
  public sentCodes = new Map<string, string>();
  public shouldFail = false;

  async sendChallenge(identifier: string, code: string, method: DeliveryMethod): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Provider network failure');
    }
    this.sentCodes.set(identifier, code);
  }
}

describe('OTP Utilities & Normalization', () => {
  it('should generate a secure OTP of the specified length', () => {
    const otp = generateSecureOtp(6);
    expect(otp).toHaveLength(6);
    expect(otp).toMatch(/^\d+$/); 
  });

  it('should correctly normalize email identifiers', () => {
    expect(normalizeIdentifier(' Test@Example.com ', 'EMAIL')).toBe('test@example.com');
    expect(normalizeIdentifier('USER@example.COM', 'EMAIL')).toBe('user@example.com');
  });

  it('should correctly normalize SMS identifiers', () => {
    expect(normalizeIdentifier(' +91 (555) 123-4567 ', 'SMS')).toBe('+915551234567');
    expect(normalizeIdentifier('555-123-4567', 'SMS')).toBe('5551234567');
  });

  it('should hash and verify OTP correctly', async () => {
    const raw = '123456';
    const hash = await hashOtp(raw);
    expect(hash).not.toEqual(raw);
    
    const isValid = await verifyOtpHash(raw, hash);
    expect(isValid).toBe(true);
    
    const isInvalid = await verifyOtpHash('654321', hash);
    expect(isInvalid).toBe(false);
  });

  it('should correctly determine expiry', () => {
    const past = new Date(Date.now() - 10000).toISOString();
    const future = new Date(Date.now() + 10000).toISOString();
    
    expect(isExpired(past)).toBe(true);
    expect(isExpired(future)).toBe(false);
  });
});

describe('OtpService (Business Logic)', () => {
  let store: MemoryOtpStore;
  let provider: MockOtpProvider;
  let service: OtpService;

  beforeEach(() => {
    store = new MemoryOtpStore();
    provider = new MockOtpProvider();
    service = new OtpService(store, provider, 10, 3);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a challenge securely without leaking rawCode', async () => {
    const result = await service.createChallenge('test@example.com', 'EMAIL', 'LOGIN');
    
    // @ts-ignore - explicitly verifying rawCode is NOT returned
    expect(result.rawCode).toBeUndefined();
    expect(result.challengeId).toBeDefined();

    // Verify it was correctly normalized and sent internally
    const rawCode = provider.sentCodes.get('test@example.com');
    expect(rawCode).toBeDefined();
    
    const challenge = await store.findByIdentifier('test@example.com');
    expect(challenge).toBeDefined();
    expect(challenge!.hashedCode).not.toEqual(rawCode); 
  });

  it('should verify a valid OTP and enforce single-use', async () => {
    await service.createChallenge('user@example.com', 'EMAIL', 'LOGIN');
    const rawCode = provider.sentCodes.get('user@example.com')!;
    
    const isValid = await service.verifyChallenge('user@example.com', 'EMAIL', rawCode);
    expect(isValid).toBe(true);

    const challenge = await store.findByIdentifier('user@example.com');
    expect(challenge).toBeNull();
  });

  it('should reject invalid OTP and increment attempts', async () => {
    await service.createChallenge('user2@example.com', 'EMAIL', 'LOGIN');
    
    const isValid = await service.verifyChallenge('user2@example.com', 'EMAIL', '000000');
    expect(isValid).toBe(false);

    const challenge = await store.findByIdentifier('user2@example.com');
    expect(challenge!.attempts).toBe(1);
  });

  it('should clean up challenge and throw if provider fails to send', async () => {
    provider.shouldFail = true;
    
    await expect(service.createChallenge('fail@example.com', 'EMAIL', 'LOGIN')).rejects.toThrow('Failed to send OTP challenge');
    
    const challenge = await store.findByIdentifier('fail@example.com');
    expect(challenge).toBeNull(); // Ensure it didn't leave a dangling challenge
  });

  it('should normalize identifiers end-to-end', async () => {
    await service.createChallenge(' MixEd@Example.com ', 'EMAIL', 'LOGIN');
    const rawCode = provider.sentCodes.get('mixed@example.com')!;
    
    // Verify using a completely different casing and spacing
    const isValid = await service.verifyChallenge('MIXED@EXAMPLE.COM', 'EMAIL', rawCode);
    expect(isValid).toBe(true);
  });

  it('should enforce maximum attempts and delete challenge', async () => {
    await service.createChallenge('user3@example.com', 'EMAIL', 'LOGIN');
    
    await service.verifyChallenge('user3@example.com', 'EMAIL', '000000'); 
    await service.verifyChallenge('user3@example.com', 'EMAIL', '000000'); 
    await service.verifyChallenge('user3@example.com', 'EMAIL', '000000'); 
    
    await expect(service.verifyChallenge('user3@example.com', 'EMAIL', '000000')).rejects.toThrow('Maximum verification attempts exceeded');
    
    const challenge = await store.findByIdentifier('user3@example.com');
    expect(challenge).toBeNull();
  });

  it('should enforce expiry correctly', async () => {
    await service.createChallenge('user4@example.com', 'EMAIL', 'LOGIN');
    const rawCode = provider.sentCodes.get('user4@example.com')!;
    
    vi.advanceTimersByTime(11 * 60 * 1000);
    
    await expect(service.verifyChallenge('user4@example.com', 'EMAIL', rawCode)).rejects.toThrow('OTP has expired');
    
    const challenge = await store.findByIdentifier('user4@example.com');
    expect(challenge).toBeNull();
  });

  it('should save purpose and overwrite existing challenges atomically after cooldown', async () => {
    // 1. First request for REGISTER
    const res1 = await service.createChallenge('replace@example.com', 'EMAIL', 'REGISTER');
    let challenge = await store.findByIdentifier('replace@example.com');
    expect(challenge?.id).toBe(res1.challengeId);
    expect(challenge?.purpose).toBe('REGISTER');

    vi.advanceTimersByTime(31000); // Advance past cooldown

    // 2. Second request for LOGIN
    const res2 = await service.createChallenge('replace@example.com', 'EMAIL', 'LOGIN');
    challenge = await store.findByIdentifier('replace@example.com');
    
    expect(challenge?.id).toBe(res2.challengeId);
    expect(challenge?.id).not.toBe(res1.challengeId);
    expect(challenge?.purpose).toBe('LOGIN');
  });

  it('should enforce 30-second cooldown per identifier', async () => {
    await service.createChallenge('cooldown@example.com', 'EMAIL', 'LOGIN');
    
    // Immediate second request should fail
    await expect(service.createChallenge('cooldown@example.com', 'EMAIL', 'LOGIN'))
      .rejects.toThrow(/Please wait \d+ seconds before requesting a new code/);

    // After 10 seconds, it should still fail
    vi.advanceTimersByTime(10000);
    await expect(service.createChallenge('cooldown@example.com', 'EMAIL', 'LOGIN'))
      .rejects.toThrow(/Please wait \d+ seconds before requesting a new code/);

    // After 30 seconds total, it should succeed
    vi.advanceTimersByTime(21000);
    await expect(service.createChallenge('cooldown@example.com', 'EMAIL', 'LOGIN')).resolves.toBeDefined();
  });
});
