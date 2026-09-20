import type { SupabaseClient } from '@supabase/supabase-js';
import type { OtpChallenge, IOtpStore } from '../types/otp.js';

export class SupabaseOtpStore implements IOtpStore {
  constructor(private supabase: SupabaseClient) {}

  async save(challenge: OtpChallenge): Promise<void> {
    // SECURITY/CONCURRENCY: We rely on the `unique_active_otp_identifier` constraint 
    // to perform an atomic UPSERT. This prevents race conditions where multiple
    // concurrent OTP requests might otherwise spawn multiple valid OTP records.
    const { error } = await this.supabase
      .from('otp_challenges')
      .upsert({
        id: challenge.id,
        identifier: challenge.identifier,
        hashed_code: challenge.hashedCode,
        delivery_method: challenge.deliveryMethod,
        purpose: challenge.purpose,
        expires_at: challenge.expiresAt,
        attempts: challenge.attempts,
        max_attempts: challenge.maxAttempts,
        created_at: challenge.createdAt
      }, {
        onConflict: 'identifier'
      });
    
    if (error) {
      throw new Error(`Failed to save OTP challenge: ${error.message}`);
    }
  }

  async findByIdentifier(identifier: string): Promise<OtpChallenge | null> {
    const { data, error } = await this.supabase
      .from('otp_challenges')
      .select('*')
      .eq('identifier', identifier)
      .maybeSingle();
    
    if (error) {
      throw new Error(`Failed to fetch OTP challenge: ${error.message}`);
    }
    
    if (!data) return null;

    return {
      id: data.id,
      identifier: data.identifier,
      hashedCode: data.hashed_code,
      deliveryMethod: data.delivery_method,
      purpose: data.purpose,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      attempts: data.attempts,
      maxAttempts: data.max_attempts
    };
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('otp_challenges')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to delete OTP challenge: ${error.message}`);
    }
  }
}
