import { getSupabaseClient } from '../src/db/supabase.js';
import { initDatabase } from '../src/db/sqlite.js';
import fs from 'node:fs';
import path from 'node:path';

async function executeCompletePurge() {
  console.log('================================================================');
  console.log('CIVICBRIDGE COMPLETE PURGE & ZERO-RECORD INITIALIZATION');
  console.log('Target User to Delete: gallikattip@gmail.com (USR-CITIZEN-MU7GB0J8-7S0B)');
  console.log('Target State: 0 users, 0 complaints, 0 audits across all stores');
  console.log('================================================================');

  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client failed to initialize. Cannot proceed.');
  }

  // Pre-cleanup audit
  console.log('\n--- PRE-CLEANUP AUDIT ---');
  const { count: preSbAudit } = await client.from('complaint_resolution_audit').select('*', { count: 'exact', head: true });
  const { count: preSbComplaints } = await client.from('complaints').select('*', { count: 'exact', head: true });
  const { data: preSbUsers, count: preSbUsersCount } = await client.from('users').select('id, email, name, role');

  console.log(`Supabase users count                 : ${preSbUsersCount ?? preSbUsers?.length ?? 0}`);
  preSbUsers?.forEach((u, i) => console.log(`  [${i + 1}] ID: ${u.id} | Email: ${u.email} | Name: ${u.name} | Role: ${u.role}`));
  console.log(`Supabase complaints count            : ${preSbComplaints ?? 0}`);
  console.log(`Supabase complaint_resolution_audit   : ${preSbAudit ?? 0}`);

  const sqlite = initDatabase();
  const preSqliteUsers = sqlite.prepare('SELECT id, email, name, role FROM users').all() as any[];
  const preSqliteComplaints = sqlite.prepare('SELECT id FROM complaints').all() as any[];
  const preSqliteAudit = sqlite.prepare('SELECT id FROM complaint_resolution_audit').all() as any[];

  console.log(`SQLite users count                   : ${preSqliteUsers.length}`);
  preSqliteUsers.forEach((u, i) => console.log(`  [${i + 1}] ID: ${u.id} | Email: ${u.email} | Name: ${u.name} | Role: ${u.role}`));
  console.log(`SQLite complaints count              : ${preSqliteComplaints.length}`);
  console.log(`SQLite complaint_resolution_audit    : ${preSqliteAudit.length}`);

  // DELETION STEP 1: Supabase complaint_resolution_audit
  console.log('\n[STEP 1] Clearing Supabase complaint_resolution_audit...');
  const { error: sbAuditDelErr } = await client
    .from('complaint_resolution_audit')
    .delete()
    .neq('id', 'IMPOSSIBLE_VALUE_FILTER');
  if (sbAuditDelErr) {
    throw new Error(`Failed to delete from Supabase complaint_resolution_audit: ${sbAuditDelErr.message}`);
  }
  console.log('  -> Supabase complaint_resolution_audit cleared.');

  // DELETION STEP 2: Supabase complaints
  console.log('\n[STEP 2] Clearing Supabase complaints...');
  const { error: sbCompDelErr } = await client
    .from('complaints')
    .delete()
    .neq('id', 'IMPOSSIBLE_VALUE_FILTER');
  if (sbCompDelErr) {
    throw new Error(`Failed to delete from Supabase complaints: ${sbCompDelErr.message}`);
  }
  console.log('  -> Supabase complaints cleared.');

  // DELETION STEP 3: Delete target user & all remaining users from Supabase
  console.log('\n[STEP 3] Deleting user gallikattip@gmail.com and all remaining users from Supabase...');
  const { error: sbTargetUserDelErr } = await client
    .from('users')
    .delete()
    .eq('email', 'gallikattip@gmail.com');
  if (sbTargetUserDelErr) {
    throw new Error(`Failed to delete target user gallikattip@gmail.com: ${sbTargetUserDelErr.message}`);
  }
  console.log('  -> Target user gallikattip@gmail.com deleted.');

  const { error: sbAllUsersDelErr } = await client
    .from('users')
    .delete()
    .neq('id', 'IMPOSSIBLE_VALUE_FILTER');
  if (sbAllUsersDelErr) {
    throw new Error(`Failed to clear remaining Supabase users: ${sbAllUsersDelErr.message}`);
  }
  console.log('  -> All Supabase users cleared.');

  // DELETION STEP 4: Supabase Storage files
  console.log('\n[STEP 4] Purging Supabase Storage complaint-evidence bucket...');
  let totalStorageFilesDeleted = 0;
  try {
    const { data: rootObjects, error: listRootErr } = await client.storage.from('complaint-evidence').list();
    if (listRootErr) {
      console.warn('  Notice listing storage root:', listRootErr.message);
    } else if (rootObjects && rootObjects.length > 0) {
      for (const item of rootObjects) {
        if (item.name === 'evidence') {
          // List files in evidence directory
          const { data: subFiles } = await client.storage.from('complaint-evidence').list('evidence');
          if (subFiles && subFiles.length > 0) {
            const paths = subFiles.map(f => `evidence/${f.name}`);
            const { error: delSubErr } = await client.storage.from('complaint-evidence').remove(paths);
            if (delSubErr) {
              throw new Error(`Failed to remove storage evidence files: ${delSubErr.message}`);
            }
            totalStorageFilesDeleted += paths.length;
            console.log(`  -> Removed ${paths.length} files from evidence folder.`);
          }
        } else if (item.id) {
          const { error: delFileErr } = await client.storage.from('complaint-evidence').remove([item.name]);
          if (!delFileErr) {
            totalStorageFilesDeleted++;
          }
        }
      }
    }
  } catch (stErr: any) {
    throw new Error(`Storage purge error: ${stErr.message}`);
  }
  console.log(`  -> Storage purge complete. Total deleted: ${totalStorageFilesDeleted}.`);

  // DELETION STEP 5: SQLite Database Purge
  console.log('\n[STEP 5] Purging local SQLite database (civictrust.db)...');
  sqlite.exec('PRAGMA foreign_keys = OFF;');
  const delSqAudit = sqlite.prepare('DELETE FROM complaint_resolution_audit').run();
  const delSqComplaints = sqlite.prepare('DELETE FROM complaints').run();
  const delSqUsers = sqlite.prepare('DELETE FROM users').run();
  sqlite.exec('PRAGMA foreign_keys = ON;');
  console.log(`  -> SQLite cleared: ${delSqAudit.changes} audits, ${delSqComplaints.changes} complaints, ${delSqUsers.changes} users.`);

  // DELETION STEP 6: Local server/uploads/complaints cleanup
  console.log('\n[STEP 6] Cleaning local uploads directory...');
  const uploadsDir = path.resolve(process.cwd(), 'uploads', 'complaints');
  let localFilesRemoved = 0;
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      const fullPath = path.join(uploadsDir, f);
      if (fs.statSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
        localFilesRemoved++;
      }
    }
  }
  console.log(`  -> Local uploads cleared. Total removed: ${localFilesRemoved} files.`);

  // FINAL POST-CLEANUP VERIFICATION
  console.log('\n================================================================');
  console.log('LIVE DATABASE POST-CLEANUP VERIFICATION');
  console.log('================================================================');

  const { data: postUsers, count: postSbUsersCount } = await client.from('users').select('*', { count: 'exact' });
  const { count: postSbComplaintsCount } = await client.from('complaints').select('*', { count: 'exact', head: true });
  const { count: postSbAuditCount } = await client.from('complaint_resolution_audit').select('*', { count: 'exact', head: true });

  const { data: postStorageFiles } = await client.storage.from('complaint-evidence').list('evidence');

  const postSqUsers = sqlite.prepare('SELECT COUNT(*) as c FROM users').get() as any;
  const postSqComplaints = sqlite.prepare('SELECT COUNT(*) as c FROM complaints').get() as any;
  const postSqAudit = sqlite.prepare('SELECT COUNT(*) as c FROM complaint_resolution_audit').get() as any;

  console.log(`Supabase users count                 : ${postSbUsersCount ?? postUsers?.length ?? 0}`);
  console.log(`Supabase complaints count            : ${postSbComplaintsCount ?? 0}`);
  console.log(`Supabase complaint_resolution_audit   : ${postSbAuditCount ?? 0}`);
  console.log(`Supabase storage evidence files      : ${postStorageFiles?.length ?? 0}`);
  console.log(`SQLite users count                   : ${postSqUsers.c}`);
  console.log(`SQLite complaints count              : ${postSqComplaints.c}`);
  console.log(`SQLite complaint_resolution_audit    : ${postSqAudit.c}`);

  const allZero =
    (postSbUsersCount ?? postUsers?.length ?? 0) === 0 &&
    (postSbComplaintsCount ?? 0) === 0 &&
    (postSbAuditCount ?? 0) === 0 &&
    (postStorageFiles?.length ?? 0) === 0 &&
    postSqUsers.c === 0 &&
    postSqComplaints.c === 0 &&
    postSqAudit.c === 0;

  if (allZero) {
    console.log('\n>>> SUCCESS: ALL PROJECT DATABASES ARE COMPLETELY EMPTY (ZERO RECORDS) <<<');
  } else {
    throw new Error('VERIFICATION FAILED: One or more stores still contain records!');
  }
}

executeCompletePurge().catch((err) => {
  console.error('Purge script failed:', err.message);
  process.exit(1);
});
