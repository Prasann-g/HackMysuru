import { getSupabaseClient } from '../src/db/supabase.js';
import { AUTHENTIC_USER_IDS, AUTHENTIC_COMPLAINT_IDS } from '../src/db/interfaces.js';

async function main() {
  const client = getSupabaseClient();
  if (!client) {
    console.error('Supabase client failed to initialize');
    process.exit(1);
  }

  const { count: userCount, data: users, error: uErr } = await client
    .from('users')
    .select('id, email', { count: 'exact' });

  if (uErr) {
    console.error('User count error:', uErr);
    process.exit(1);
  }

  const { count: compCount, data: comps, error: cErr } = await client
    .from('complaints')
    .select('id', { count: 'exact' });

  if (cErr) {
    console.error('Complaint count error:', cErr);
    process.exit(1);
  }

  const { data: storageFiles, error: sErr } = await client.storage
    .from('complaint-evidence')
    .list('evidence');

  if (sErr) {
    console.error('Storage error:', sErr);
    process.exit(1);
  }

  const authenticUsersPresent = AUTHENTIC_USER_IDS.every((id) =>
    users?.some((u) => u.id === id)
  );
  const authenticCompsPresent = AUTHENTIC_COMPLAINT_IDS.every((id) =>
    comps?.some((c) => c.id === id)
  );

  console.log('=== SUPABASE BASELINE AUDIT ===');
  console.log('Total users in DB:', userCount);
  console.log('Total complaints in DB:', compCount);
  console.log('Storage evidence folders/objects:', storageFiles?.length ?? 0);
  console.log('All 13 authentic users present:', authenticUsersPresent);
  console.log('All 11 authentic complaints present:', authenticCompsPresent);

  if (authenticUsersPresent && authenticCompsPresent && (storageFiles?.length ?? 0) >= 7) {
    console.log('STATUS: INTEGRITY CONFIRMED');
    process.exit(0);
  } else {
    console.error('STATUS: INTEGRITY MISMATCH');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
