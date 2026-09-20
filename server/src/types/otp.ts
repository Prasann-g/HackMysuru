export type DeliveryMethod = 'EMAIL' | 'SMS';

export interface OtpChallenge {
  id: string; // unique challenge ID
  identifier: string; // email or phone number (normalized)
  hashedCode: string; // bcrypt hashed OTP
  deliveryMethod: DeliveryMethod;
  purpose: 'REGISTER' | 'LOGIN';
  expiresAt: string; // ISO string
  createdAt: string; // ISO string
  attempts: number;
  maxAttempts: number;
}

export interface OtpProvider {
  sendChallenge(identifier: string, code: string, method: DeliveryMethod): Promise<void>;
}

export interface IOtpStore {
  /**
   * Persists the challenge. 
   * CONCURRENCY REQUIREMENT: Implementations (e.g., Supabase) MUST execute this 
   * as an atomic UPSERT (ON CONFLICT (identifier) DO UPDATE) to guarantee that 
   * only one active challenge exists per identifier, preventing race conditions.
   */
  save(challenge: OtpChallenge): Promise<void>;
  findByIdentifier(identifier: string): Promise<OtpChallenge | null>;
  delete(id: string): Promise<void>;
}
