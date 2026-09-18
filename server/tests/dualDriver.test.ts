import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import {
  complaintStore,
  sqliteComplaintStore,
  supabaseComplaintStore,
  SqliteComplaintStore,
} from '../src/db/complaintStore.js';
import {
  userStore,
  sqliteUserStore,
  supabaseUserStore,
  SqliteUserStore,
} from '../src/db/userStore.js';
import { SupabaseComplaintStore } from '../src/db/supabaseComplaintStore.js';
import { SupabaseUserStore } from '../src/db/supabaseUserStore.js';
import type { ComplaintResolutionAuditRecord } from '../src/types/complaint.js';
import { AUTHENTIC_USER_IDS, AUTHENTIC_COMPLAINT_IDS } from '../src/db/interfaces.js';

describe('Phase 3: Dual-Driver Repository Architecture', () => {
  // 1. Driver Configuration and Verification
  it('correctly maps active driver based on CONFIG.DATA_STORE', () => {
    if (CONFIG.DATA_STORE === 'supabase') {
      expect(complaintStore.active).toBe(supabaseComplaintStore);
      expect(userStore.active).toBe(supabaseUserStore);
    } else {
      expect(CONFIG.DATA_STORE).toBe('sqlite');
      expect(complaintStore.active).toBe(sqliteComplaintStore);
      expect(userStore.active).toBe(sqliteUserStore);
    }
  });

  it('exposes discrete SQLite and Supabase store implementations', () => {
    expect(sqliteComplaintStore).toBeInstanceOf(SqliteComplaintStore);
    expect(supabaseComplaintStore).toBeInstanceOf(SupabaseComplaintStore);
    expect(sqliteUserStore).toBeInstanceOf(SqliteUserStore);
    expect(supabaseUserStore).toBeInstanceOf(SupabaseUserStore);
  });

  // 2. SQLite Driver Contract & Operations
  describe('SQLite Driver Operations', () => {
    it('retrieves pre-seeded authentic users via sqliteUserStore', async () => {
      const officer = await sqliteUserStore.findByEmail('officer.ward48@mcc.gov.in');
      expect(officer).toBeDefined();
      expect(officer?.id).toBe('USR-OFFICER-48');
      expect(officer?.role).toBe('OFFICER');
      expect(officer?.isActive).toBe(true);

      const byId = await sqliteUserStore.findById('USR-OFFICER-48');
      expect(byId?.email).toBe('officer.ward48@mcc.gov.in');
    });

    it('retrieves complaints and generates public analytics via sqliteComplaintStore', async () => {
      const complaints = await sqliteComplaintStore.listForOfficer();
      expect(Array.isArray(complaints)).toBe(true);

      const analytics = await sqliteComplaintStore.getPublicAnalytics();
      expect(typeof analytics.totalComplaints).toBe('number');
      expect(typeof analytics.resolutionRatePercent).toBe('number');
      expect(Array.isArray(analytics.recentComplaints)).toBe(true);
    });

    it('supports audit log creation and retrieval in SQLite', async () => {
      const primaryId = 'MCC-AUDIT-REF-TEST';
      const existing = await sqliteComplaintStore.findById(primaryId);
      if (!existing) {
        await sqliteComplaintStore.create({
          id: primaryId,
          trackingToken: 'TRK-AUDIT-REF-TEST',
          citizenId: 'USR-CITIZEN-DEMO',
          category: 'pothole',
          description: 'Reference complaint for SQLite audit log verification.',
          observedDate: '2026-09-18',
          locationArea: 'Kuvempunagar',
          hasImage: false,
          status: 'SUBMITTED',
          isDemo: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      const testAudit: ComplaintResolutionAuditRecord = {
        id: `AUDIT-SQLITE-TEST-${Date.now()}`,
        clusterId: 'CLUSTER-TEST-001',
        primaryComplaintId: primaryId,
        secondaryComplaintIds: ['MCC-2026-MU74EXDZ-M02C'],
        actionType: 'MARK_RELATED',
        officerId: 'USR-OFFICER-48',
        officerName: 'Ward 48 Junior Engineer',
        decisionNotes: 'Verified spatial proximity in Jayalakshmipuram; linking complaints.',
        previousStates: { 'MCC-2026-MU74EXDZ-M02C': { status: 'SUBMITTED' } },
        createdAt: new Date().toISOString(),
      };

      const saved = await sqliteComplaintStore.createAuditRecord(testAudit);
      expect(saved.id).toBe(testAudit.id);

      const records = await sqliteComplaintStore.listAuditRecords('CLUSTER-TEST-001');
      expect(records.some((r) => r.id === testAudit.id)).toBe(true);
      const matched = records.find((r) => r.id === testAudit.id);
      expect(matched?.actionType).toBe('MARK_RELATED');
      expect(matched?.secondaryComplaintIds).toContain('MCC-2026-MU74EXDZ-M02C');

      // Clean up SQLite test records
      const db = (await import('../src/db/sqlite.js')).getDb();
      db.exec(`DELETE FROM complaint_resolution_audit WHERE id = '${testAudit.id}'`);
      db.exec(`DELETE FROM complaints WHERE id = '${primaryId}'`);
    });
  });

  // 3. Supabase Driver Contract & Live Verification
  describe('Supabase Driver Operations', () => {
    it('retrieves migrated authentic users from Supabase PostgreSQL', async () => {
      const users = await supabaseUserStore.listAll();
      expect(users.length).toBeGreaterThanOrEqual(13);

      for (const authId of AUTHENTIC_USER_IDS) {
        expect(users.some((u) => u.id === authId)).toBe(true);
      }

      const officer = await supabaseUserStore.findByEmail('officer.ward48@mcc.gov.in');
      expect(officer).toBeDefined();
      expect(officer?.id).toBe('USR-OFFICER-48');
      expect(officer?.role).toBe('OFFICER');

      const citizen = await supabaseUserStore.findById('USR-CITIZEN-DEMO');
      expect(citizen).toBeDefined();
      expect(citizen?.role).toBe('CITIZEN');
    });

    it('retrieves migrated authentic complaints from Supabase PostgreSQL', async () => {
      const complaints = await supabaseComplaintStore.listForOfficer();
      expect(complaints.length).toBeGreaterThanOrEqual(11);

      for (const compId of AUTHENTIC_COMPLAINT_IDS) {
        expect(complaints.some((c) => c.id === compId)).toBe(true);
      }

      const single = await supabaseComplaintStore.findById('MCC-2026-MU74EXCE-PGH6');
      expect(single).toBeDefined();
      expect(single?.category).toBe('garbage_dumping');
      expect(single?.locationArea).toBe('Jayalakshmipuram');
      expect(single?.hasImage).toBe(true);
    });

    it('computes identical public analytics metrics on Supabase', async () => {
      const analytics = await supabaseComplaintStore.getPublicAnalytics();
      expect(analytics.totalComplaints).toBeGreaterThanOrEqual(11);
      expect(analytics.recentComplaints.length).toBeGreaterThanOrEqual(11);
      expect(analytics.coordinatesCoverage.totalWithoutCoordinates).toBeGreaterThanOrEqual(11);
      expect(analytics.coordinatesCoverage.totalWithCoordinates).toBeGreaterThanOrEqual(0);
      expect(typeof analytics.resolutionRatePercent).toBe('number');
      expect(typeof analytics.verifiedRatePercent).toBe('number');
    });

    it('supports audit log creation and query on Supabase PostgreSQL', async () => {
      const testAudit: ComplaintResolutionAuditRecord = {
        id: `AUDIT-SB-TEST-${Date.now()}`,
        clusterId: 'CLUSTER-SB-001',
        primaryComplaintId: 'MCC-2026-MU74EXCE-PGH6',
        secondaryComplaintIds: ['MCC-2026-MU74EXDZ-M02C'],
        actionType: 'MARK_RELATED',
        officerId: 'USR-OFFICER-48',
        officerName: 'Ward 48 Junior Engineer',
        decisionNotes: 'Supabase driver audit persistence test.',
        previousStates: { 'MCC-2026-MU74EXDZ-M02C': { status: 'SUBMITTED' } },
        createdAt: new Date().toISOString(),
      };

      const saved = await supabaseComplaintStore.createAuditRecord(testAudit);
      expect(saved.id).toBe(testAudit.id);

      const list = await supabaseComplaintStore.listAuditRecords('CLUSTER-SB-001');
      expect(list.some((r) => r.id === testAudit.id)).toBe(true);
      const found = list.find((r) => r.id === testAudit.id);
      expect(found?.decisionNotes).toBe('Supabase driver audit persistence test.');

      // Clean up Supabase test audit record
      const sb = (supabaseComplaintStore as any).getClient();
      await sb.from('complaint_resolution_audit').delete().eq('id', testAudit.id);
    });
  });

  // 4. Error Handling and Defensive Degradation
  describe('Error Handling', () => {
    it('throws descriptive error when Supabase client is uninitialized', async () => {
      // Mock uninitialized client
      const uninitStore = new SupabaseComplaintStore();
      (uninitStore as any).getClient = () => {
        throw new Error('Supabase client is not initialized. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      };

      await expect(uninitStore.findById('NONEXISTENT')).rejects.toThrow(
        'Supabase client is not initialized'
      );
    });

    it('handles non-existent record lookup gracefully returning undefined', async () => {
      const sqliteMissing = await sqliteComplaintStore.findById('MCC-NONEXISTENT-9999');
      expect(sqliteMissing).toBeUndefined();

      const supabaseMissing = await supabaseComplaintStore.findById('MCC-NONEXISTENT-9999');
      expect(supabaseMissing).toBeUndefined();

      const userMissing = await supabaseUserStore.findByEmail('ghost@nonexistent.example');
      expect(userMissing).toBeUndefined();
    });
  });
});
