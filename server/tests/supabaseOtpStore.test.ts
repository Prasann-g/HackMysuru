import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseOtpStore } from '../src/db/supabaseOtpStore.js';
import type { OtpChallenge } from '../src/types/otp.js';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('SupabaseOtpStore (Isolated Repository Tests)', () => {
  let store: SupabaseOtpStore;
  let mockUpsert: ReturnType<typeof vi.fn>;
  let mockSelect: ReturnType<typeof vi.fn>;
  let mockEq: ReturnType<typeof vi.fn>;
  let mockMaybeSingle: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;
  let mockDeleteEq: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    mockUpsert = vi.fn().mockResolvedValue({ error: null });
    
    mockMaybeSingle = vi.fn().mockResolvedValue({ 
      data: {
        id: 'test-id',
        identifier: 'test@example.com',
        hashed_code: 'hash',
        delivery_method: 'EMAIL',
        purpose: 'LOGIN',
        created_at: '2026-09-01T00:00:00Z',
        expires_at: '2026-10-01T00:00:00Z',
        attempts: 0,
        max_attempts: 3
      }, 
      error: null 
    });
    mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    
    mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
    mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'otp_challenges') {
          return {
            upsert: mockUpsert,
            select: mockSelect,
            delete: mockDelete
          };
        }
        return {};
      })
    } as unknown as SupabaseClient;

    store = new SupabaseOtpStore(mockSupabase);
  });

  it('should save a challenge using atomic UPSERT mapped correctly to DB columns', async () => {
    const challenge: OtpChallenge = {
      id: 'test-id',
      identifier: 'test@example.com',
      hashedCode: 'hash',
      deliveryMethod: 'EMAIL',
      purpose: 'LOGIN',
      createdAt: '2026-09-01T00:00:00Z',
      expiresAt: '2026-10-01T00:00:00Z',
      attempts: 0,
      maxAttempts: 3
    };

    await store.save(challenge);
    
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-id',
        identifier: 'test@example.com',
        hashed_code: 'hash',
        delivery_method: 'EMAIL',
        purpose: 'LOGIN',
        expires_at: '2026-10-01T00:00:00Z',
        attempts: 0,
        max_attempts: 3
      }),
      { onConflict: 'identifier' }
    );
  });

  it('should correctly fetch and map DB columns back to domain object', async () => {
    const result = await store.findByIdentifier('test@example.com');
    
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('identifier', 'test@example.com');
    expect(mockMaybeSingle).toHaveBeenCalled();
    
    expect(result).toBeDefined();
    expect(result?.hashedCode).toBe('hash'); // verify camelCase mapping
    expect(result?.deliveryMethod).toBe('EMAIL');
  });

  it('should delete using the exact challenge ID', async () => {
    await store.delete('test-id');
    
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'test-id');
  });
  
  it('should throw an error if Supabase UPSERT fails', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'DB Constraint Violation' } });
    
    const challenge: OtpChallenge = {
      id: 'test-id',
      identifier: 'fail@example.com',
      hashedCode: 'hash',
      deliveryMethod: 'EMAIL',
      purpose: 'LOGIN',
      createdAt: '2026-09-01T00:00:00Z',
      expiresAt: '2026-10-01T00:00:00Z',
      attempts: 0,
      maxAttempts: 3
    };

    await expect(store.save(challenge)).rejects.toThrow('Failed to save OTP challenge: DB Constraint Violation');
  });
});
