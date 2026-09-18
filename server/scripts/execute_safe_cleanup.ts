import { getSupabaseClient } from '../src/db/supabase.js';
import { initDatabase } from '../src/db/sqlite.js';
import fs from 'node:fs';
import path from 'node:path';

const PRESERVED_EMAIL = 'gallikattip@gmail.com';

async function safeCleanup() {
  console.log('================================================================');
  console.log('CIVICBRIDGE SAFE CLEANUP — TARGETED DELETION EXECUTION');
  console.log('Preserving Account:', PRESERVED_EMAIL);
  console.log('================================================================');

  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client failed to initialize. Aborting deletion.');
  }

  // PRE-FLIGHT CHECK: Ensure the preserved account exists
  const { data: userToKeep, error: keepErr } = await client
    .from('users')
    .select('id, email, name, role, ward, department, created_at, password_hash')
    .eq('email', PRESERVED_EMAIL)
    .single();

  if (keepErr || !userToKeep) {
    throw new Error(`CRITICAL: Account to preserve (${PRESERVED_EMAIL}) was not found in Supabase! Aborting to prevent data loss. Error: ${keepErr?.message}`);
  }

  console.log(`[CONFIRMED] Preserved user identified: ID: ${userToKeep.id} | Email: ${userToKeep.email} | Name: ${userToKeep.name} | Role: ${userToKeep.role}`);

  // 1. SUPABASE INVENTORY BEFORE DELETION
  const { count: auditCountBefore } = await client.from('complaint_resolution_audit').select('*', { count: 'exact', head: true });
  const { count: complaintsCountBefore } = await client.from('complaints').select('*', { count: 'exact', head: true });
  const { count: usersCountBefore } = await client.from('users').select('*', { count: 'exact', head: true });

  console.log('\n--- PRE-DELETION SUPABASE COUNTS ---');
  console.log(`complaint_resolution_audit : ${auditCountBefore}`);
  console.log(`complaints                 : ${complaintsCountBefore}`);
  console.log(`users (including preserved): ${usersCountBefore}`);

  // 2. EXECUTE STEP 1: Delete all records from public.complaint_resolution_audit
  console.log('\n[STEP 1] Deleting all records from public.complaint_resolution_audit...');
  const { error: delAuditErr } = await client
    .from('complaint_resolution_audit')
    .delete()
    .neq('id', 'DO_NOT_MATCH_ANYTHING'); // Supabase delete requires a filter
  if (delAuditErr) {
    throw new Error(`Failed to delete complaint_resolution_audit: ${delAuditErr.message}`);
  }
  console.log('  -> Success: complaint_resolution_audit cleared.');

  // 3. EXECUTE STEP 2: Delete all records from public.complaints
  console.log('\n[STEP 2] Deleting all records from public.complaints...');
  const { error: delComplaintsErr } = await client
    .from('complaints')
    .delete()
    .neq('id', 'DO_NOT_MATCH_ANYTHING');
  if (delComplaintsErr) {
    throw new Error(`Failed to delete complaints: ${delComplaintsErr.message}`);
  }
  console.log('  -> Success: complaints cleared.');

  // 4. EXECUTE STEP 3: Delete all users EXCEPT gallikattip@gmail.com
  console.log(`\n[STEP 3] Deleting all users EXCEPT ${PRESERVED_EMAIL}...`);
  const { error: delUsersErr } = await client
    .from('users')
    .delete()
    .neq('email', PRESERVED_EMAIL);
  if (delUsersErr) {
    throw new Error(`Failed to delete users: ${delUsersErr.message}`);
  }
  console.log(`  -> Success: All other users deleted. Only ${PRESERVED_EMAIL} preserved.`);

  // 5. EXECUTE STEP 4: Clean Supabase Storage evidence bucket
  console.log('\n[STEP 4] Cleaning Supabase Storage bucket (complaint-evidence)...');
  try {
    const { data: files } = await client.storage.from('complaint-evidence').list('evidence');
    if (files && files.length > 0) {
      const pathsToDelete = files.map(f => `evidence/${f.name}`);
      console.log(`  Removing ${pathsToDelete.length} files from storage:`, pathsToDelete);
      const { error: removeErr } = await client.storage.from('complaint-evidence').remove(pathsToDelete);
      if (removeErr) {
        console.warn('  Notice removing storage files:', removeErr.message);
      } else {
        console.log('  -> Success: Evidence files removed from Supabase storage.');
      }
    } else {
      console.log('  -> Notice: No files found in evidence folder.');
    }
  } catch (stErr: any) {
    console.warn('  Notice checking storage:', stErr.message);
  }

  // 6. EXECUTE STEP 5: Clean SQLite local database (civictrust.db)
  console.log('\n[STEP 5] Cleaning local SQLite database (civictrust.db)...');
  try {
    const sqlite = initDatabase();
    sqlite.exec('PRAGMA foreign_keys = OFF;');
    const delAudit = sqlite.prepare('DELETE FROM complaint_resolution_audit').run();
    const delComp = sqlite.prepare('DELETE FROM complaints').run();
    const delUsr = sqlite.prepare('DELETE FROM users').run();
    sqlite.exec('PRAGMA foreign_keys = ON;');
    console.log(`  -> Success: SQLite tables cleared (Audit: ${delAudit.changes}, Complaints: ${delComp.changes}, Users: ${delUsr.changes}).`);
  } catch (sqErr: any) {
    console.warn('  SQLite cleanup notice:', sqErr.message);
  }

  // 7. EXECUTE STEP 6: Clean local server/uploads/complaints folder
  console.log('\n[STEP 6] Cleaning local uploads directory...');
  const uploadsDir = path.resolve(process.cwd(), 'uploads', 'complaints');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    let removedCount = 0;
    for (const file of files) {
      const fullPath = path.join(uploadsDir, file);
      if (fs.statSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
        removedCount++;
      }
    }
    console.log(`  -> Success: Removed ${removedCount} files from ${uploadsDir}.`);
  } else {
    console.log(`  -> Notice: Uploads directory does not exist or empty.`);
  }

  // 8. VERIFICATION: Post-cleanup checks
  console.log('\n================================================================');
  console.log('POST-CLEANUP VERIFICATION');
  console.log('================================================================');

  const { data: remainingUsers, count: userCountAfter } = await client
    .from('users')
    .select('id, email, name, role, created_at, password_hash');

  const { count: complaintsCountAfter } = await client
    .from('complaints')
    .select('*', { count: 'exact', head: true });

  const { count: auditCountAfter } = await client
    .from('complaint_resolution_audit')
    .select('*', { count: 'exact', head: true });

  console.log(`Remaining Supabase users count: ${userCountAfter || remainingUsers?.length || 0}`);
  remainingUsers?.forEach(u => {
    console.log(`  - ID: ${u.id} | Email: ${u.email} | Name: ${u.name} | Role: ${u.role} | PasswordHash intact: ${!!u.password_hash}`);
  });

  console.log(`Remaining Supabase complaints count: ${complaintsCountAfter}`);
  console.log(`Remaining Supabase audit records count: ${auditCountAfter}`);

  if (remainingUsers?.length === 1 && remainingUsers[0].email === PRESERVED_EMAIL) {
    console.log(`\n>>> VERIFICATION PASSED: ONLY ${PRESERVED_EMAIL} EXISTS IN THE SYSTEM! <<<`);
  } else {
    console.error(`\n>>> VERIFICATION WARNING: Unexpected users state! <<<`);
  }

  if (complaintsCountAfter === 0 && auditCountAfter === 0) {
    console.log(`>>> VERIFICATION PASSED: 0 COMPLAINTS & 0 AUDIT RECORDS REMAIN! <<<`);
  } else {
    console.error(`>>> VERIFICATION WARNING: Residual complaints or audits detected! <<<`);
  }
}

safeCleanup().catch(err => {
  console.error('Fatal error during cleanup:', err);
  process.exit(1);
});
