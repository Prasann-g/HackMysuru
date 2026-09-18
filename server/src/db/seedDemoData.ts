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
    {
      id: 'DEMO-2026-0002',
      tracking_token: 'TRK-DEMO-0002',
      citizen_id: 'USR-CITIZEN-DEMO',
      category: 'garbage_dumping',
      custom_category: null,
      description:
        'Unattended domestic trash and mixed food waste dumped along Gokulam 3rd Stage park boundary creating foul odor and stray dogs.',
      observed_date: '2026-09-17',
      location_area: 'Gokulam',
      address_text: 'Gokulam 3rd Stage, 5th Cross near neighborhood park',
      latitude: 12.3248,
      longitude: 76.6285,
      has_image: 1,
      evidence_metadata: JSON.stringify({
        filename: 'demo_garbage_boundary.jpg',
        sizeBytes: 845210,
        mimetype: 'image/jpeg',
        submittedAt: '2026-09-17T08:15:00.000Z',
        note: 'Photo accepted as citizen-submitted evidence only. Authenticity unverified.',
      }),
      status: 'SUBMITTED',
      verification_result: JSON.stringify({
        outcome: 'RECOMMENDED_VERIFIED',
        duplicateRisk: 'LOW',
        matches: [],
        signals: ['Keyword match for garbage and public boundary dumping.'],
        uncertainties: ['Volume of waste unverified until sanitation inspection.'],
        limitations: ['Evaluated against current open complaints.'],
        recommendedAction: 'Review sanitation vehicle routing for clearance.',
        processedAt: '2026-09-17T08:16:00.000Z',
      }),
      assigned_officer_id: null,
      assigned_department: 'MCC Health & Sanitation Department',
      review_notes: `Awaiting officer intake. ${SYNTHETIC_DISCLAIMER}`,
      created_at: '2026-09-17T08:15:00.000Z',
      updated_at: '2026-09-17T08:15:00.000Z',
    },
    {
      id: 'DEMO-2026-0003',
      tracking_token: 'TRK-DEMO-0003',
      citizen_id: 'USR-CITIZEN-DEMO',
      category: 'broken_streetlight',
      custom_category: null,
      description:
        'Streetlight fixture completely unlit for past four nights on Vijayanagar 2nd Stage 8th Main creating dark hazard for pedestrians.',
      observed_date: '2026-09-16',
      location_area: 'Vijayanagar',
      address_text: 'Vijayanagar 2nd Stage, 8th Main Road opposite water tank',
      latitude: 12.3391,
      longitude: 76.6028,
      has_image: 0,
      evidence_metadata: null,
      status: 'FORWARDED',
      verification_result: JSON.stringify({
        outcome: 'RECOMMENDED_VERIFIED',
        duplicateRisk: 'LOW',
        matches: [],
        signals: ['Electrical fixture keyword alignment.'],
        uncertainties: ['Night-time illumination verified from citizen description only.'],
        limitations: ['No photo evidence submitted.'],
        recommendedAction: 'Forwarded to CHESCOM electrical maintenance team.',
        processedAt: '2026-09-16T19:05:00.000Z',
      }),
      assigned_officer_id: null,
      assigned_department: 'CHESCOM / MCC Electrical Division',
      review_notes: `Forwarded to electrical division for pole bulb replacement. ${SYNTHETIC_DISCLAIMER}`,
      created_at: '2026-09-16T19:00:00.000Z',
      updated_at: '2026-09-17T09:30:00.000Z',
    },
    {
      id: 'DEMO-2026-0004',
      tracking_token: 'TRK-DEMO-0004',
      citizen_id: 'USR-CITIZEN-DEMO',
      category: 'construction_debris',
      custom_category: null,
      description:
        'Large pile of bricks, cement bags and excavated gravel blocking pedestrian footpath near Kalidasa Road junction.',
      observed_date: '2026-09-14',
      location_area: 'Jayalakshmipuram',
      address_text: 'Kalidasa Road junction, near post office',
      latitude: 12.321,
      longitude: 76.634,
      has_image: 1,
      evidence_metadata: JSON.stringify({
        filename: 'demo_debris_footpath.jpg',
        sizeBytes: 1542000,
        mimetype: 'image/jpeg',
        submittedAt: '2026-09-14T11:00:00.000Z',
        note: 'Photo accepted as citizen-submitted evidence only. Authenticity unverified.',
      }),
      status: 'RESOLVED',
      verification_result: JSON.stringify({
        outcome: 'RECOMMENDED_VERIFIED',
        duplicateRisk: 'LOW',
        matches: [],
        signals: ['Pedestrian obstruction and debris keywords confirmed.'],
        uncertainties: ['Origin of construction debris unknown.'],
        limitations: ['Single evidence submission.'],
        recommendedAction: 'Notice issued to property builder; debris cleared.',
        processedAt: '2026-09-14T11:02:00.000Z',
      }),
      assigned_officer_id: 'USR-OFFICER-48',
      assigned_department: 'MCC Town Planning & Public Works',
      review_notes: `Footpath cleared by zonal enforcement truck. ${SYNTHETIC_DISCLAIMER}`,
      created_at: '2026-09-14T11:00:00.000Z',
      updated_at: '2026-09-16T16:45:00.000Z',
    },
    {
      id: 'DEMO-2026-0005',
      tracking_token: 'TRK-DEMO-0005',
      citizen_id: 'USR-CITIZEN-DEMO',
      category: 'overflowing_bin',
      custom_category: null,
      description:
        'Public dumper bin overflowing with mixed dry waste and plastics spilling onto roadside near Kuvempunagar complex.',
      observed_date: '2026-09-18',
      location_area: 'Kuvempunagar',
      address_text: 'Kuvempunagar Shopping Complex, bus stand stop',
      latitude: 12.289,
      longitude: 76.632,
      has_image: 1,
      evidence_metadata: JSON.stringify({
        filename: 'demo_overflowing_bin.webp',
        sizeBytes: 940000,
        mimetype: 'image/webp',
        submittedAt: '2026-09-18T07:45:00.000Z',
        note: 'Photo accepted as citizen-submitted evidence only. Authenticity unverified.',
      }),
      status: 'UNDER_REVIEW',
      verification_result: JSON.stringify({
        outcome: 'RECOMMENDED_VERIFIED',
        duplicateRisk: 'LOW',
        matches: [],
        signals: ['Commercial complex overflow waste detected.'],
        uncertainties: ['Collection schedule status requires sanitation check.'],
        limitations: ['Automated text match.'],
        recommendedAction: 'Dispatch morning compacting vehicle.',
        processedAt: '2026-09-18T07:46:00.000Z',
      }),
      assigned_officer_id: 'USR-OFFICER-SAN',
      assigned_department: 'MCC Health & Sanitation Department',
      review_notes: `Assigned to health inspector. ${SYNTHETIC_DISCLAIMER}`,
      created_at: '2026-09-18T07:45:00.000Z',
      updated_at: '2026-09-18T08:00:00.000Z',
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
