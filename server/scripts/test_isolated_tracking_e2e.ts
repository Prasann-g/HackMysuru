import { initDatabase } from '../src/db/sqlite.js';
import { verifyComplaint } from '../src/services/verificationEngine.js';
import { getSupabaseClient } from '../src/db/supabase.js';
import crypto from 'node:crypto';

async function runIsolatedE2ETest() {
  console.log('================================================================');
  console.log('ISOLATED E2E COMPLAINT SUBMISSION & TRACKING TEST');
  console.log('(Runs strictly in isolated memory/rollback; zero records in prod DB)');
  console.log('================================================================');

  // Step 1: Create isolated in-memory database
  console.log('\n[STEP 1] Initializing isolated in-memory SQLite database...');
  const isolatedDb = initDatabase(':memory:');

  // Create schema in isolated DB
  isolatedDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      ward TEXT,
      department TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      tracking_token TEXT UNIQUE NOT NULL,
      citizen_id TEXT NOT NULL,
      category TEXT NOT NULL,
      custom_category TEXT,
      description TEXT NOT NULL,
      observed_date TEXT NOT NULL,
      location_area TEXT NOT NULL,
      address_text TEXT,
      latitude REAL,
      longitude REAL,
      has_image INTEGER NOT NULL DEFAULT 0,
      evidence_metadata TEXT,
      image_path TEXT,
      image_sha256 TEXT,
      image_phash TEXT,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      verification_result TEXT,
      assigned_officer_id TEXT,
      assigned_department TEXT,
      review_notes TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      primary_complaint_id TEXT,
      duplicate_cluster_id TEXT,
      resolution_action TEXT DEFAULT 'NONE',
      resolved_by_officer_id TEXT,
      resolved_at TEXT
    );
  `);

  const testUserId = 'USR-TEST-ISOLATED-CITIZEN';
  isolatedDb.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(testUserId, 'isolated.citizen@example.com', 'dummy_hash', 'Isolated Citizen', 'CITIZEN', new Date().toISOString());

  console.log('  -> Isolated environment established successfully.');

  // Step 2: Citizen Complaint Submission Simulation
  console.log('\n[STEP 2] Submitting citizen complaint to isolated engine...');
  const trackingToken = `TRK-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const complaintId = `MCC-2026-TEST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();

  const newSubmission = {
    category: 'pothole' as const,
    description: 'Deep road depression near Ballal Circle Kuvempunagar causing vehicular instability during rain',
    observedDate: '2026-09-18',
    locationArea: 'Kuvempunagar',
    addressText: 'Near Ballal Circle, 5th Main',
    hasImage: false,
  };

  // Run AI Verification Engine
  console.log('  Running automated verification engine...');
  const verificationResult = verifyComplaint(
    {
      category: newSubmission.category,
      description: newSubmission.description,
      locationArea: newSubmission.locationArea,
      observedDate: newSubmission.observedDate,
      hasImage: false,
    },
    [] // No prior complaints in empty DB
  );

  console.log('  Verification Result:', {
    outcome: verificationResult.outcome,
    duplicateRisk: verificationResult.duplicateRisk,
    recommendedAction: verificationResult.recommendedAction,
    signalsCount: verificationResult.signals.length,
  });

  const department = 'MCC Engineering Division (Roads & Infrastructure)';

  // Persist into isolated DB
  isolatedDb.prepare(`
    INSERT INTO complaints (
      id, tracking_token, citizen_id, category, description,
      observed_date, location_area, address_text, has_image,
      status, verification_result, assigned_department, is_demo,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    complaintId,
    trackingToken,
    testUserId,
    newSubmission.category,
    newSubmission.description,
    newSubmission.observedDate,
    newSubmission.locationArea,
    newSubmission.addressText,
    0,
    'SUBMITTED',
    JSON.stringify(verificationResult),
    department,
    0,
    now,
    now
  );

  console.log(`  -> Complaint filed with Token: ${trackingToken}`);

  // Step 3: Complaint Tracking Flow Verification
  console.log('\n[STEP 3] Verifying tracking query by token...');
  const row = isolatedDb.prepare(`
    SELECT * FROM complaints WHERE tracking_token = ?
  `).get(trackingToken) as any;

  if (!row) {
    throw new Error(`Tracking lookup failed: Token ${trackingToken} not found in isolated DB!`);
  }

  const parsedVerification = JSON.parse(row.verification_result);
  console.log('  Tracked Complaint Retrieved Successfully:');
  console.log(`  - ID: ${row.id}`);
  console.log(`  - Token: ${row.tracking_token}`);
  console.log(`  - Status: ${row.status}`);
  console.log(`  - Category: ${row.category}`);
  console.log(`  - Locality: ${row.location_area}`);
  console.log(`  - Assigned Dept: ${row.assigned_department}`);
  console.log(`  - Verification Outcome: ${parsedVerification.outcome}`);
  console.log(`  - Duplicate Risk: ${parsedVerification.duplicateRisk}`);
  console.log(`  - Recommended Action: ${parsedVerification.recommendedAction}`);
  console.log(`  - Explainable Signals: ${parsedVerification.signals.map((s: any) => s.ruleName).join(', ')}`);

  // Step 4: Tear down isolated test DB
  console.log('\n[STEP 4] Tearing down isolated test database...');
  isolatedDb.exec('DROP TABLE complaints; DROP TABLE users;');
  console.log('  -> Isolated memory tables dropped.');

  // Step 5: Verify Production Database Integrity
  console.log('\n[STEP 5] Auditing production Supabase database to ensure zero test pollution...');
  const client = getSupabaseClient();
  if (client) {
    const { count: prodComplaints } = await client.from('complaints').select('*', { count: 'exact', head: true });
    const { count: prodAudits } = await client.from('complaint_resolution_audit').select('*', { count: 'exact', head: true });
    const { data: prodUsers } = await client.from('users').select('id, email, name');

    console.log(`  - Production complaints count : ${prodComplaints} (Expected: 0)`);
    console.log(`  - Production audits count     : ${prodAudits} (Expected: 0)`);
    console.log(`  - Production users count      : ${prodUsers?.length} (Expected: 1)`);
    console.log(`  - Preserved user              : ${prodUsers?.[0]?.email} (${prodUsers?.[0]?.name})`);

    if (prodComplaints === 0 && prodAudits === 0 && prodUsers?.length === 1 && prodUsers[0].email === 'gallikattip@gmail.com') {
      console.log('\n>>> SUCCESS: Isolated E2E test passed with ZERO impact on production database! <<<');
    } else {
      throw new Error('POLLUTION DETECTED: Production database was modified during test!');
    }
  }
}

runIsolatedE2ETest().catch(err => {
  console.error('Fatal error in isolated E2E test:', err);
  process.exit(1);
});
