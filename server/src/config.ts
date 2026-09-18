import path from 'path';

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
};
