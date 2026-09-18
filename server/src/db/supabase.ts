import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '../config.js';

let supabaseInstance: SupabaseClient | null = null;

export interface SupabaseConnectionStatus {
  configured: boolean;
  url: string;
  hasServiceRoleKey: boolean;
  postgresAccessible: boolean;
  storageAccessible: boolean;
  message: string;
  error?: string;
}

/**
 * Initializes or retrieves the singleton Supabase client.
 * Uses the privileged SUPABASE_SERVICE_ROLE_KEY for server operations.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (!CONFIG.SUPABASE_URL || (!CONFIG.SUPABASE_SERVICE_ROLE_KEY && !CONFIG.SUPABASE_ANON_KEY)) {
    return null;
  }

  try {
    const key = CONFIG.SUPABASE_SERVICE_ROLE_KEY || CONFIG.SUPABASE_ANON_KEY;
    supabaseInstance = createClient(CONFIG.SUPABASE_URL, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return supabaseInstance;
  } catch {
    return null;
  }
}

/**
 * Performs a harmless, non-destructive read-only health check against Supabase PostgreSQL and Storage.
 * Does NOT write, mutate, migrate, or delete any data.
 */
export async function checkSupabaseConnectivity(): Promise<SupabaseConnectionStatus> {
  const configured = !!(CONFIG.SUPABASE_URL && (CONFIG.SUPABASE_SERVICE_ROLE_KEY || CONFIG.SUPABASE_ANON_KEY));

  if (!configured) {
    return {
      configured: false,
      url: CONFIG.SUPABASE_URL || 'Not configured',
      hasServiceRoleKey: !!CONFIG.SUPABASE_SERVICE_ROLE_KEY,
      postgresAccessible: false,
      storageAccessible: false,
      message: 'Supabase credentials not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment or .env file.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      configured: true,
      url: CONFIG.SUPABASE_URL,
      hasServiceRoleKey: !!CONFIG.SUPABASE_SERVICE_ROLE_KEY,
      postgresAccessible: false,
      storageAccessible: false,
      message: 'Failed to create Supabase client from provided credentials.',
    };
  }

  let postgresAccessible = false;
  let storageAccessible = false;
  const errors: string[] = [];

  // 1. Non-destructive PostgreSQL read check: count query on public.users
  try {
    const { error: pgError } = await client
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (pgError) {
      errors.push(`PostgreSQL check failed: ${pgError.message} (${pgError.code || 'UNKNOWN'})`);
    } else {
      postgresAccessible = true;
    }
  } catch (err: any) {
    errors.push(`PostgreSQL connection error: ${err.message}`);
  }

  // 2. Non-destructive Storage read check: check if bucket exists
  try {
    const { data: bucket, error: bucketError } = await client.storage.getBucket(CONFIG.SUPABASE_STORAGE_BUCKET);
    if (bucketError) {
      errors.push(`Storage check failed: ${bucketError.message}`);
    } else if (bucket) {
      storageAccessible = true;
    }
  } catch (err: any) {
    errors.push(`Storage connection error: ${err.message}`);
  }

  return {
    configured: true,
    url: CONFIG.SUPABASE_URL,
    hasServiceRoleKey: !!CONFIG.SUPABASE_SERVICE_ROLE_KEY,
    postgresAccessible,
    storageAccessible,
    message: postgresAccessible
      ? `Supabase connectivity confirmed for ${CONFIG.SUPABASE_URL}. PostgreSQL is online.`
      : 'Supabase client initialized, but database verification failed.',
    error: errors.length > 0 ? errors.join(' | ') : undefined,
  };
}

// CLI runner: `npm run supabase:check` or `tsx src/db/supabase.ts`
if (process.argv[1]?.endsWith('supabase.ts') || process.argv[1]?.endsWith('supabase.js')) {
  console.log('=== CIVICTRUST AI — SUPABASE CONNECTION AUDIT ===');
  console.log(`Target URL: ${CONFIG.SUPABASE_URL || '(Not set)'}`);
  console.log(`Storage Target Bucket: ${CONFIG.SUPABASE_STORAGE_BUCKET}`);
  console.log('Running non-destructive connection check...\n');

  checkSupabaseConnectivity().then((res) => {
    console.log(JSON.stringify(res, null, 2));
    if (!res.configured) {
      console.log('\n[STATUS]: AWAITING SUPABASE CREDENTIALS');
      console.log('Set the following in server/.env:');
      console.log('  SUPABASE_URL=https://<your-project>.supabase.co');
      console.log('  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>');
    } else if (!res.postgresAccessible) {
      console.log('\n[STATUS]: CREDENTIALS PRESENT, BUT CONNECTION BLOCKED');
      console.log(res.error);
    } else {
      console.log('\n[STATUS]: SUPABASE CONNECTIVITY VERIFIED');
    }
  });
}
