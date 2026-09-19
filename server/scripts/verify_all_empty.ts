import { getSupabaseClient } from '../src/db/supabase.js';
import { initDatabase } from '../src/db/sqlite.js';
import fs from 'node:fs';
import path from 'node:path';

async function verifyAllEmpty() {
  console.log('================================================================');
  console.log('CIVICBRIDGE FINAL LIVE VERIFICATION — ZERO RECORD VALIDATION');
  console.log('================================================================');

  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client failed to initialize');
  }

  // 1. SUPABASE QUERIES
  const { data: sbUsers, count: sbUsersCount, error: uErr } = await client
    .from('users')
    .select('id, email', { count: 'exact' });
  if (uErr) throw new Error(`Supabase users query error: ${uErr.message}`);

  const { count: sbComplaintsCount, error: cErr } = await client
    .from('complaints')
    .select('id', { count: 'exact', head: true });
  if (cErr) throw new Error(`Supabase complaints query error: ${cErr.message}`);

  const { count: sbAuditCount, error: aErr } = await client
    .from('complaint_resolution_audit')
    .select('id', { count: 'exact', head: true });
  if (aErr) throw new Error(`Supabase audit query error: ${aErr.message}`);

  const { data: storageRoot, error: sErr } = await client.storage.from('complaint-evidence').list();
  if (sErr) throw new Error(`Supabase storage query error: ${sErr.message}`);

  // 2. SQLITE QUERIES
  const sqlite = initDatabase();
  const sqUsers = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const sqComplaints = sqlite.prepare('SELECT COUNT(*) as count FROM complaints').get() as { count: number };
  const sqAudit = sqlite.prepare('SELECT COUNT(*) as count FROM complaint_resolution_audit').get() as { count: number };

  // 3. LOCAL UPLOADS
  const uploadsDir = path.resolve(process.cwd(), 'uploads', 'complaints');
  let localFilesCount = 0;
  if (fs.existsSync(uploadsDir)) {
    localFilesCount = fs.readdirSync(uploadsDir).filter(f => fs.statSync(path.join(uploadsDir, f)).isFile()).length;
  }

  console.log('\n--- LIVE QUERY COUNTS ---');
  console.log(`Supabase users count                       : ${sbUsersCount ?? sbUsers?.length ?? 0}`);
  console.log(`Supabase complaints count                  : ${sbComplaintsCount ?? 0}`);
  console.log(`Supabase complaint_resolution_audit count  : ${sbAuditCount ?? 0}`);
  console.log(`Supabase complaint-evidence storage objects: ${storageRoot?.length ?? 0}`);
  console.log(`SQLite users count                         : ${sqUsers.count}`);
  console.log(`SQLite complaints count                    : ${sqComplaints.count}`);
  console.log(`SQLite complaint_resolution_audit count    : ${sqAudit.count}`);
  console.log(`Local uploads cached files count           : ${localFilesCount}`);

  const isCompletelyEmpty =
    (sbUsersCount ?? sbUsers?.length ?? 0) === 0 &&
    (sbComplaintsCount ?? 0) === 0 &&
    (sbAuditCount ?? 0) === 0 &&
    (storageRoot?.length ?? 0) === 0 &&
    sqUsers.count === 0 &&
    sqComplaints.count === 0 &&
    sqAudit.count === 0 &&
    localFilesCount === 0;

  if (isCompletelyEmpty) {
    console.log('\n>>> LIVE VERIFICATION PASSED: ALL PROJECT DATABASES AND STORAGES ARE 100% EMPTY! <<<');
  } else {
    console.error('\n>>> LIVE VERIFICATION FAILED: Residual records detected! <<<');
    process.exit(1);
  }
}

verifyAllEmpty().catch(err => {
  console.error('Verification error:', err.message);
  process.exit(1);
});
