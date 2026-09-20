import type { OtpChallenge, IOtpStore } from '../types/otp.js';

export class MemoryOtpStore implements IOtpStore {
  private store = new Map<string, OtpChallenge>();

  async save(challenge: OtpChallenge): Promise<void> {
    // Emulate atomic UPSERT by removing any existing challenge for this identifier
    for (const [key, existing] of this.store.entries()) {
      if (existing.identifier === challenge.identifier) {
        this.store.delete(key);
      }
    }
    this.store.set(challenge.id, { ...challenge });
  }

  async findByIdentifier(identifier: string): Promise<OtpChallenge | null> {
    for (const challenge of this.store.values()) {
      if (challenge.identifier === identifier) {
        return { ...challenge };
      }
    }
    return null;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
  
  // Test utility
  async clear(): Promise<void> {
    this.store.clear();
  }
}
