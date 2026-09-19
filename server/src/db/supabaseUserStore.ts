import type { UserRecord, UserRole } from '../types/auth.js';
import type { IUserStore } from './interfaces.js';
import { AUTHENTIC_USER_IDS } from './interfaces.js';
import { getSupabaseClient } from './supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

function mapRowToUser(row: any): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    role: row.role as UserRole,
    ward: row.ward || undefined,
    department: row.department || undefined,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at || undefined,
  };
}

export class SupabaseUserStore implements IUserStore {
  private getClient() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        'Supabase client is not initialized. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      );
    }
    return client;
  }

  public async findByEmail(email: string): Promise<UserRecord | undefined> {
    const client = this.getClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase user lookup failed: ${error.message}`);
    }
    return data ? mapRowToUser(data) : undefined;
  }

  public async findById(id: string): Promise<UserRecord | undefined> {
    const client = this.getClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase user lookup by ID failed: ${error.message}`);
    }
    return data ? mapRowToUser(data) : undefined;
  }

  public async save(user: UserRecord): Promise<UserRecord> {
    const client = this.getClient();
    const row = {
      id: user.id,
      email: user.email.toLowerCase(),
      password_hash: user.passwordHash,
      name: user.name,
      role: user.role,
      ward: user.ward || null,
      department: user.department || null,
      is_active: user.isActive,
      created_at: user.createdAt,
      last_login_at: user.lastLoginAt || null,
    };

    const { error } = await client
      .from('users')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      throw new Error(`Supabase save user failed: ${error.message}`);
    }
    return user;
  }

  public async listAll(): Promise<UserRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase list users failed: ${error.message}`);
    }
    return (data || []).map(mapRowToUser);
  }

  public async clearNonDefault(): Promise<void> {
    const client = this.getClient();
    const { error } = await client
      .from('users')
      .delete()
      .not('id', 'in', `(${AUTHENTIC_USER_IDS.map((id) => `"${id}"`).join(',')})`);

    if (error) {
      throw new Error(`Supabase clearNonDefault failed: ${error.message}`);
    }
  }

  public async resetAll(): Promise<void> {
    const client = this.getClient();
    await client.from('complaints').delete().neq('id', '');
    const { error } = await client.from('users').delete().neq('id', '');
    if (error) {
      throw new Error(`Supabase resetAll failed: ${error.message}`);
    }
  }
}
