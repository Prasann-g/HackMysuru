import bcrypt from 'bcryptjs';
import type { DatabaseSync } from 'node:sqlite';
import { getDb } from './sqlite.js';

export const SYNTHETIC_DISCLAIMER =
  'Synthetic demonstration record for hackathon evaluation only. Does not represent actual Mysuru City Corporation municipal grievances or official statistics.';

export function seedDemoData(db: DatabaseSync = getDb()): void {
  // 1. Seed Demo Citizen User (satisfies FOREIGN KEY requirement)
  const insertUserStmt = db.prepare(`
    INSERT OR IGNORE INTO users (
      id, email, password_hash, name, role, ward, department, is_active, created_at, last_login_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const demoCitizenPasswordHash = bcrypt.hashSync('DemoCitizen123', 10);
  insertUserStmt.run(
    'USR-CITIZEN-DEMO',
    'demo.citizen@mysuru.example',
    demoCitizenPasswordHash,
    'Demonstration Citizen',
    'CITIZEN',
    'Kuvempunagar',
    null,
    '2026-09-01T00:00:00.000Z',
    '2026-09-01T00:00:00.000Z'
  );

  // 2. Seed Pre-seeded Officers
  const officer1Hash = bcrypt.hashSync('Officer@Mysuru48', 10);
  insertUserStmt.run(
    'USR-OFFICER-48',
    'officer.ward48@mcc.gov.in',
    officer1Hash,
    'Ward 48 Junior Engineer',
    'OFFICER',
    'Ward 48 - Kuvempunagar',
    'MCC Engineering Division',
    '2026-09-01T00:00:00.000Z',
    '2026-09-01T00:00:00.000Z'
  );

  const officer2Hash = bcrypt.hashSync('CleanMysuru2026', 10);
  insertUserStmt.run(
    'USR-OFFICER-SAN',
    'officer.sanitation@mcc.gov.in',
    officer2Hash,
    'Health & Sanitation Inspector',
    'OFFICER',
    'Ward 48 - Kuvempunagar',
    'MCC Health & Sanitation Department',
    '2026-09-01T00:00:00.000Z',
    '2026-09-01T00:00:00.000Z'
  );

  // 3. Seed Synthetic Demonstration Complaints (INSERT OR IGNORE preserves existing edits)
  const insertComplaintStmt = db.prepare(`
    INSERT OR IGNORE INTO complaints (
      id, tracking_token, citizen_id, category, custom_category,
      description, observed_date, location_area, address_text,
      latitude, longitude, has_image, evidence_metadata,
      status, verification_result, assigned_officer_id, assigned_department,
      review_notes, is_demo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const demoComplaints = [
    {
      id: 'DEMO-2026-0001',
      tracking_token: 'TRK-DEMO-0001',
      citizen_id: 'USR-CITIZEN-DEMO',
      category: 'pothole',
      custom_category: null,
      description:
        'Deep road crater on Saraswathipuram Main Road near Kuvempunagar fire station causing traffic slowdown and two-wheeler skidding hazard.',
      observed_date: '2026-09-15',
      location_area: 'Kuvempunagar',
      address_text: 'Saraswathipuram Main Road near fire station junction',
      latitude: 12.2855,
      longitude: 76.635,
      has_image: 1,
      evidence_metadata: JSON.stringify({
        filename: 'demo_pothole_evidence.jpg',
        sizeBytes: 1048576,
        mimetype: 'image/jpeg',
        submittedAt: '2026-09-15T10:30:00.000Z',
        note: 'Photo accepted as citizen-submitted evidence only. Authenticity unverified.',
      }),
      status: 'IN_PROGRESS',
      verification_result: JSON.stringify({
        outcome: 'RECOMMENDED_VERIFIED',
        duplicateRisk: 'LOW',
        matches: [],
        signals: ['Clear road crater description with landmark reference'],
        uncertainties: ['Physical depth and site authenticity require field measurement.'],
        limitations: ['Candidate evaluation against baseline demo pool.'],
        recommendedAction: 'Assigned to Ward 48 Junior Engineer for asphalt patching.',
        processedAt: '2026-09-15T10:31:00.000Z',
      }),
      assigned_officer_id: 'USR-OFFICER-48',
      assigned_department: 'MCC Engineering Division',
      review_notes: `Field repair order dispatched. ${SYNTHETIC_DISCLAIMER}`,
      created_at: '2026-09-15T10:30:00.000Z',
      updated_at: '2026-09-16T11:00:00.000Z',
    },
  ];

  for (const c of demoComplaints) {
    insertComplaintStmt.run(
      c.id,
      c.tracking_token,
      c.citizen_id,
      c.category,
      c.custom_category,
      c.description,
      c.observed_date,
      c.location_area,
      c.address_text,
      c.latitude,
      c.longitude,
      c.has_image,
      c.evidence_metadata,
      c.status,
      c.verification_result,
      c.assigned_officer_id,
      c.assigned_department,
      c.review_notes,
      c.created_at,
      c.updated_at
    );
  }
}

export function clearSyntheticDemoComplaints(db: DatabaseSync = getDb()): number {
  const result = db.prepare('DELETE FROM complaints WHERE is_demo = 1').run();
  return Number(result.changes);
}

// Standalone execution for explicit development seeding
if (process.argv[1] && (process.argv[1].endsWith('seedDemoData.ts') || process.argv[1].endsWith('seedDemoData.js'))) {
  const db = getDb();
  seedDemoData(db);
  console.log('[CivicTrust] Explicit development seeding complete: Synthetic demo records inserted.');
}
