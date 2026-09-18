import fs from 'node:fs';
import path from 'node:path';

// Safely load local .env file if present
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
];
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // Ignore load errors
    }
  }
}

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  UPLOAD_DIR: path.resolve(process.cwd(), 'uploads'),
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  ACCEPTED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  JWT_SECRET: process.env.JWT_SECRET || 'civictrust-mysuru-dev-secret-key-2026',
  JWT_EXPIRES_IN: '2h',
  OFFICER_INVITE_SECRET: process.env.OFFICER_INVITE_SECRET || 'MCC-OFFICER-SECRET-2026',
  DB_PATH: process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'civictrust.db'),
  DATA_STORE: (process.env.DATA_STORE || 'sqlite') as 'sqlite' | 'supabase',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'complaint-evidence',
};

