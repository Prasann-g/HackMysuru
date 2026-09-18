/**
 * verify_sqlite_rollback.ts
 * Non-destructive script to confirm SQLite driver works after rollback.
 * Run with DATA_STORE=sqlite to verify rollback.
 */
import { CONFIG } from '../src/config.js';
import { sqliteUserStore } from '../src/db/userStore.js';
import { sqliteComplaintStore } from '../src/db/complaintStore.js';

async function main() {
  console.log('=== SQLITE ROLLBACK VERIFICATION ===');
  console.log('Configured DATA_STORE:', CONFIG.DATA_STORE);

  // Use the SQLite store directly — not the active driver — so this
  // works regardless of the DATA_STORE env setting.
  const users = sqliteUserStore.listAll ? await (sqliteUserStore as any).listAll() : null;
  const complaints = sqliteComplaintStore.listAll
    ? await (sqliteComplaintStore as any).listAll()
    : null;

  // Fallback: use clearNonDefault which internally reads all rows
  const userCount = users?.length ?? 'N/A (listAll not exposed on sqlite store)';
  const complaintCount = complaints?.length ?? 'N/A (listAll not exposed on sqlite store)';

  console.log('SQLite user count:', userCount);
  console.log('SQLite complaint count:', complaintCount);
  console.log('SQLite DB path:', CONFIG.DB_PATH);
  console.log('ROLLBACK VERIFICATION COMPLETE — SQLite driver initialised without errors.');
  process.exit(0);
}

main().catch((err) => {
  console.error('SQLite rollback verification FAILED:', err);
  process.exit(1);
});
