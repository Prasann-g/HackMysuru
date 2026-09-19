import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateCoordinates,
  resolveDepartmentRecommendation,
  evaluateRouting,
  applyOfficerOverride,
  createFallbackRoutingDecision,
  getJurisdictionDataSourceStatus,
} from '../src/services/routingEngine.js';
import { complaintStore } from '../src/db/complaintStore.js';
import { userStore } from '../src/db/userStore.js';
import type { ComplaintRecord } from '../src/types/complaint.js';
import type { RoutingDecision } from '../src/types/routing.js';

describe('CivicBridge Routing Engine & Jurisdiction Architecture', () => {
  describe('1. Coordinate Validation (Location Validation Layer)', () => {
    it('passes for syntactically valid coordinates within standard ranges', () => {
      const res = validateCoordinates(12.3051, 76.6551);
      expect(res.valid).toBe(true);
      expect(res.hasCoordinates).toBe(true);
      expect(res.latitude).toBeCloseTo(12.3051);
      expect(res.longitude).toBeCloseTo(76.6551);
    });

    it('parses valid numeric string coordinates cleanly', () => {
      const res = validateCoordinates(' 12.3051 ', ' 76.6551 ');
      expect(res.valid).toBe(true);
      expect(res.hasCoordinates).toBe(true);
      expect(res.latitude).toBeCloseTo(12.3051);
      expect(res.longitude).toBeCloseTo(76.6551);
    });

    it('handles missing coordinates gracefully without failing', () => {
      const res = validateCoordinates(undefined, undefined);
      expect(res.valid).toBe(true);
      expect(res.hasCoordinates).toBe(false);
      expect(res.latitude).toBeUndefined();
      expect(res.longitude).toBeUndefined();
    });

    it('rejects when only one coordinate is supplied', () => {
      const res1 = validateCoordinates(12.3051, undefined);
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('Both latitude and longitude must be provided together');

      const res2 = validateCoordinates(undefined, 76.6551);
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('Both latitude and longitude must be provided together');
    });

    it('rejects latitude outside [-90, +90] range', () => {
      const res1 = validateCoordinates(91.0, 76.6551);
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('out of bounds');

      const res2 = validateCoordinates(-90.1, 76.6551);
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('out of bounds');
    });

    it('rejects longitude outside [-180, +180] range', () => {
      const res1 = validateCoordinates(12.3051, 181.0);
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('out of bounds');

      const res2 = validateCoordinates(12.3051, -180.5);
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('out of bounds');
    });

    it('rejects NaN, Infinity, -Infinity, and invalid non-numeric strings', () => {
      expect(validateCoordinates(NaN, 76.6551).valid).toBe(false);
      expect(validateCoordinates(12.3051, Infinity).valid).toBe(false);
      expect(validateCoordinates(-Infinity, 76.6551).valid).toBe(false);
      expect(validateCoordinates('abc', 'def').valid).toBe(false);
    });
  });

  describe('2. Jurisdiction Policy & Zero-Hallucination Boundaries', () => {
    it('confirms jurisdiction data source is AVAILABLE in repository', () => {
      expect(getJurisdictionDataSourceStatus()).toBe('AVAILABLE');
    });

    it('identifies MCC jurisdiction from coordinates inside authentic 65-ward boundary', () => {
      const decision = evaluateRouting({
        latitude: 12.3051,
        longitude: 76.6551,
        locationArea: 'Kuvempunagar',
        category: 'pothole',
      });

      expect(decision.authorityType).toBe('MCC');
      expect(decision.authorityName).toBe('Mysuru City Corporation');
      expect(decision.status).toBe('ROUTED');
      expect(decision.reviewRequired).toBe(false);
      expect(decision.jurisdictionProvenance).toBe('RULE_BASED');
      expect(decision.jurisdictionId).toBe('MCC-WARD-51');
      expect(decision.jurisdictionVersion).toBe('mysuru-mcc-wards-65');
    });

    it('does not infer authority for peri-urban areas (Bogadi, Kadakola, Hootagalli)', () => {
      const localities = ['Bogadi', 'Kadakola', 'Hootagalli'];
      for (const loc of localities) {
        const decision = evaluateRouting({
          locationArea: loc,
          category: 'pothole',
        });
        expect(decision.authorityType).toBe('UNKNOWN');
        expect(decision.authorityName).toBe('Jurisdiction Unverified');
        expect(decision.status).toBe('REVIEW_REQUIRED');
      }
    });

    it('never infers MCC jurisdiction from coordinates outside Mysuru boundary envelope', () => {
      const decision = evaluateRouting({
        latitude: 12.9716,
        longitude: 77.5946,
        category: 'pothole',
      });

      expect(decision.authorityType).toBe('UNKNOWN');
      expect(decision.authorityName).toBe('Jurisdiction Unverified');
      expect(decision.status).toBe('REVIEW_REQUIRED');
      expect(decision.jurisdictionId).toBeUndefined();
      expect(decision.jurisdictionVersion).toBeUndefined();
      expect(decision.effectiveDateUsed).toBeUndefined();
      expect((decision as any).confidence).toBeUndefined();
    });
  });

  describe('3. Department Recommendation Separation', () => {
    it('provides a provisional rule-based department recommendation while keeping jurisdiction UNKNOWN', () => {
      const decision = evaluateRouting({
        category: 'pothole',
        locationArea: 'Jayalakshmipuram',
      });

      expect(decision.department).toBe('MCC Engineering Division');
      expect(decision.departmentProvenance).toBe('RULE_BASED');
      expect(decision.authorityType).toBe('UNKNOWN');
      expect(decision.status).toBe('REVIEW_REQUIRED');
    });

    it('correctly maps sanitation categories to Health & Sanitation Department', () => {
      for (const cat of ['garbage_dumping', 'overflowing_bin', 'unsegregated_waste']) {
        const res = resolveDepartmentRecommendation(cat);
        expect(res.department).toBe('MCC Health & Sanitation Department');
        expect(res.provenance).toBe('RULE_BASED');
        expect(res.validCategory).toBe(true);
      }
    });

    it('correctly maps streetlights to CHESCOM / Electrical Division', () => {
      const res = resolveDepartmentRecommendation('broken_streetlight');
      expect(res.department).toBe('CHESCOM / MCC Electrical Division');
      expect(res.validCategory).toBe(true);
    });

    it('handles invalid category by setting INVALID_CATEGORY and routing to General Grievance Cell', () => {
      const decision = evaluateRouting({
        category: 'illegal_ufo_landing',
        locationArea: 'Hebbal',
      });

      expect(decision.status).toBe('INVALID_CATEGORY');
      expect(decision.department).toBe('MCC General Grievance Cell');
      expect(decision.reviewRequired).toBe(true);
      expect(decision.explanation.some((e) => e.includes('unclassified or unrecognized'))).toBe(true);
    });
  });

  describe('4. Verification Context Integration', () => {
    it('flags reviewRequired when verification outcome is POSSIBLE_DUPLICATE without aborting routing', () => {
      const decision = evaluateRouting({
        category: 'pothole',
        locationArea: 'Gokulam',
        duplicateRisk: 'HIGH',
        verificationOutcome: 'POSSIBLE_DUPLICATE',
      });

      expect(decision.reviewRequired).toBe(true);
      expect(decision.department).toBe('MCC Engineering Division');
      expect(decision.explanation.some((e) => e.includes('high duplicate risk'))).toBe(true);
    });

    it('flags reviewRequired when verification signals inconsistent evidence', () => {
      const decision = evaluateRouting({
        category: 'garbage_dumping',
        locationArea: 'Nazarbad',
        verificationOutcome: 'INCONSISTENT_EVIDENCE',
      });

      expect(decision.reviewRequired).toBe(true);
      expect(decision.explanation.some((e) => e.includes('inconsistent evidence'))).toBe(true);
    });
  });

  describe('5. Error Resiliency & Fallback', () => {
    it('creates safe fallback routing decision on unexpected exceptions', () => {
      const fallback = createFallbackRoutingDecision(new Error('Simulated spatial crash'));
      expect(fallback.status).toBe('REVIEW_REQUIRED');
      expect(fallback.authorityType).toBe('UNKNOWN');
      expect(fallback.authorityName).toBe('Jurisdiction Unverified');
      expect(fallback.department).toBe('MCC General Grievance Cell');
      expect(fallback.reviewRequired).toBe(true);
      expect(fallback.explanation.some((e) => e.includes('Simulated spatial crash'))).toBe(true);
    });
  });

  describe('6. Officer Override & Audit Trail', () => {
    const baseDecision: RoutingDecision = {
      status: 'REVIEW_REQUIRED',
      authorityType: 'UNKNOWN',
      authorityName: 'Jurisdiction Unverified',
      department: 'MCC Engineering Division',
      departmentProvenance: 'RULE_BASED',
      jurisdictionProvenance: 'UNKNOWN',
      provenance: 'UNKNOWN',
      reviewRequired: true,
      explanation: ['Initial automated evaluation.'],
      timestamp: new Date().toISOString(),
    };

    const officer = {
      id: 'USR-OFFICER-48',
      name: 'R. Ananthaswamy',
      role: 'OFFICER',
    };

    it('rejects officer override if override reason is missing or whitespace', () => {
      expect(() => {
        applyOfficerOverride(baseDecision, officer, {
          authorityType: 'MCC',
          department: 'MCC Engineering Division',
          overrideReason: '   ',
        });
      }).toThrow(/Override reason is mandatory/);
    });

    it('applies override, preserves original decision in audit history, and marks HUMAN_CONFIRMED', () => {
      const updated = applyOfficerOverride(baseDecision, officer, {
        authorityType: 'MCC',
        department: 'MCC Town Planning & Public Works',
        overrideReason: 'Verified on municipal boundary map Ward 48.',
      });

      expect(updated.authorityType).toBe('MCC');
      expect(updated.authorityName).toBe('Mysuru City Corporation');
      expect(updated.department).toBe('MCC Town Planning & Public Works');
      expect(updated.status).toBe('ROUTED');
      expect(updated.provenance).toBe('HUMAN_CONFIRMED');
      expect(updated.reviewRequired).toBe(false);

      expect(updated.overrideHistory).toBeDefined();
      expect(updated.overrideHistory?.length).toBe(1);

      const audit = updated.overrideHistory![0];
      expect(audit.officerId).toBe('USR-OFFICER-48');
      expect(audit.officerName).toBe('R. Ananthaswamy');
      expect(audit.overrideReason).toBe('Verified on municipal boundary map Ward 48.');
      expect(audit.previousDecision.authorityType).toBe('UNKNOWN');
      expect(audit.previousDecision.department).toBe('MCC Engineering Division');
    });

    it('supports multiple sequential overrides, appending to audit history', () => {
      const firstOverride = applyOfficerOverride(baseDecision, officer, {
        authorityType: 'MCC',
        department: 'MCC Engineering Division',
        overrideReason: 'First triage pass.',
      });

      const secondOfficer = {
        id: 'USR-ADMIN-01',
        name: 'Chief Commissioner',
        role: 'ADMIN',
      };

      const secondOverride = applyOfficerOverride(firstOverride, secondOfficer, {
        authorityType: 'MCC',
        department: 'MCC Town Planning & Public Works',
        overrideReason: 'Reassigned after field inspection.',
      });

      expect(secondOverride.overrideHistory?.length).toBe(2);
      expect(secondOverride.overrideHistory![0].officerId).toBe('USR-OFFICER-48');
      expect(secondOverride.overrideHistory![1].officerId).toBe('USR-ADMIN-01');
      expect(secondOverride.department).toBe('MCC Town Planning & Public Works');
    });
  });

  describe('7. End-to-End SQLite Store Integration & Persistence', () => {
    it('persists complaint with routingDecision and retrieves identical data', async () => {
      const testCitizenId = `USR-CITIZEN-ROUTING-${Date.now()}`;
      await userStore.save({
        id: testCitizenId,
        email: `citizen.routing.${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        name: 'Test Citizen Routing',
        role: 'CITIZEN',
        ward: 'Kuvempunagar',
        isActive: true,
        createdAt: new Date().toISOString(),
      });

      const testId = `TEST-ROUTING-${Date.now()}`;
      const decision = evaluateRouting({
        locationArea: 'Bogadi',
        category: 'pothole',
      });

      const newRecord: ComplaintRecord = {
        id: testId,
        trackingToken: `TRK-TEST-${Date.now()}`,
        citizenId: testCitizenId,
        category: 'pothole',
        description: 'Deep road damage on 5th cross main road.',
        observedDate: '2026-09-19',
        locationArea: 'Bogadi',
        hasImage: false,
        status: 'SUBMITTED',
        assignedDepartment: decision.department,
        routingDecision: decision,
        isDemo: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await complaintStore.create(newRecord);

      const retrieved = await complaintStore.findById(testId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(testId);
      expect(retrieved?.assignedDepartment).toBe('MCC Engineering Division');
      expect(retrieved?.routingDecision).toBeDefined();
      expect(retrieved?.routingDecision?.authorityType).toBe('UNKNOWN');
      expect(retrieved?.routingDecision?.status).toBe('REVIEW_REQUIRED');
      expect(retrieved?.routingDecision?.department).toBe('MCC Engineering Division');
      expect(retrieved?.routingDecision?.reviewRequired).toBe(true);

      // Now perform officer override on the persisted record
      const officer = {
        id: 'USR-OFFICER-48',
        name: 'R. Ananthaswamy',
        role: 'OFFICER',
      };

      const overriddenDecision = applyOfficerOverride(retrieved!.routingDecision!, officer, {
        authorityType: 'MCC',
        department: 'MCC Engineering Division',
        overrideReason: 'Confirmed inside Ward 48 boundary.',
      });

      const updated = await complaintStore.update(testId, {
        routingDecision: overriddenDecision,
        assignedDepartment: overriddenDecision.department,
      });

      expect(updated?.routingDecision?.provenance).toBe('HUMAN_CONFIRMED');
      expect(updated?.routingDecision?.overrideHistory?.length).toBe(1);
      expect(updated?.routingDecision?.overrideHistory![0].overrideReason).toBe(
        'Confirmed inside Ward 48 boundary.'
      );

      // Retrieve again from store to verify clean deserialization
      const retrievedAfterOverride = await complaintStore.findById(testId);
      expect(retrievedAfterOverride?.routingDecision?.authorityType).toBe('MCC');
      expect(retrievedAfterOverride?.routingDecision?.provenance).toBe('HUMAN_CONFIRMED');
      expect(retrievedAfterOverride?.routingDecision?.overrideHistory?.length).toBe(1);
    });
  });

  describe('8. HTTP End-to-End API Integration & Role Authorization', () => {
    let server: any;
    let baseUrl: string;
    let citizenToken: string;
    let officerToken: string;
    let createdComplaintId: string;
    let trackingToken: string;

    beforeEach(async () => {
      // setup will run via beforeAll-like pattern
    });

    it('boots test server and authenticates roles', async () => {
      const { app } = await import('../src/index.js');
      await new Promise<void>((resolve) => {
        server = app.listen(0, () => {
          const addr = server.address();
          if (addr && typeof addr === 'object') {
            baseUrl = `http://localhost:${addr.port}`;
          }
          resolve();
        });
      });

      // Register citizen
      const citRes = await fetch(`${baseUrl}/api/auth/register/citizen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Routing E2E Citizen',
          email: `routing.e2e.${Date.now()}@example.com`,
          password: 'password123',
          ward: 'Gokulam',
        }),
      });
      const citData = await citRes.json();
      citizenToken = citData.token;

      // Seed default users if not already seeded
      const { sqliteUserStore } = await import('../src/db/userStore.js');
      sqliteUserStore.seedDefaultUsers();

      // Login officer
      const offRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'officer.ward48@mcc.gov.in',
          password: 'Officer@Mysuru48',
        }),
      });
      const offData = await offRes.json();
      officerToken = offData.token;

      expect(citizenToken).toBeDefined();
      expect(officerToken).toBeDefined();
    });

    it('attaches explainable routing decision upon citizen complaint creation', async () => {
      const res = await fetch(`${baseUrl}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`,
        },
        body: JSON.stringify({
          category: 'pothole',
          description: `Severely broken asphalt near Vijayanagar 2nd stage water tank ${Date.now()}.`,
          observedDate: '2026-09-19',
          locationArea: 'Vijayanagar 2nd Stage',
          latitude: 12.332,
          longitude: 76.621,
          hasImage: true,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.complaint).toBeDefined();
      expect(data.complaint.routingDecision).toBeDefined();
      expect(data.complaint.routingDecision.authorityType).toBe('MCC');
      expect(['ROUTED', 'REVIEW_REQUIRED']).toContain(data.complaint.routingDecision.status);
      expect(data.complaint.routingDecision.department).toBe('MCC Engineering Division');
      expect(data.complaint.routingDecision.departmentProvenance).toBe('RULE_BASED');
      expect(data.complaint.routingDecision.provenance).toBe('RULE_BASED');

      createdComplaintId = data.complaint.id;
      trackingToken = data.complaint.trackingToken;
    });

    it('exposes only sanitized routing fields to public tracking endpoint with zero citizen PII', async () => {
      const res = await fetch(`${baseUrl}/api/complaints/track/${trackingToken}`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.assignedAuthority).toBe('Mysuru City Corporation');
      expect(data.assignedDepartment).toBe('MCC Engineering Division');
      expect(['ROUTED', 'REVIEW_REQUIRED']).toContain(data.routingStatus);

      // Security check: zero private fields exposed
      expect(data.citizenId).toBeUndefined();
      expect(data.overrideHistory).toBeUndefined();
      expect(data.evidenceMetadata).toBeUndefined();
    });

    it('rejects unauthenticated caller from accessing officer reroute endpoint', async () => {
      const res = await fetch(`${baseUrl}/api/officer/complaints/${createdComplaintId}/reroute`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorityType: 'MCC',
          department: 'MCC Engineering Division',
          overrideReason: 'Unauthorized attempt',
        }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects citizen from accessing officer reroute endpoint (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/officer/complaints/${createdComplaintId}/reroute`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`,
        },
        body: JSON.stringify({
          authorityType: 'MCC',
          department: 'MCC Engineering Division',
          overrideReason: 'Citizen trying to re-route',
        }),
      });
      expect(res.status).toBe(403);
    });

    it('rejects officer reroute if override reason is empty', async () => {
      const res = await fetch(`${baseUrl}/api/officer/complaints/${createdComplaintId}/reroute`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officerToken}`,
        },
        body: JSON.stringify({
          authorityType: 'MCC',
          department: 'MCC Engineering Division',
          overrideReason: '   ',
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Override reason is mandatory');
    });

    it('allows authenticated officer to override routing, auditing server-side identity', async () => {
      const res = await fetch(`${baseUrl}/api/officer/complaints/${createdComplaintId}/reroute`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officerToken}`,
        },
        body: JSON.stringify({
          authorityType: 'MCC',
          department: 'MCC Engineering Division',
          overrideReason: 'Verified by Ward 48 officer on duty.',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.complaint.routingDecision.authorityType).toBe('MCC');
      expect(data.complaint.routingDecision.provenance).toBe('HUMAN_CONFIRMED');
      expect(data.complaint.routingDecision.status).toBe('ROUTED');
      expect(data.complaint.routingDecision.overrideHistory.length).toBe(1);
      expect(data.complaint.routingDecision.overrideHistory[0].officerId).toBe('USR-OFFICER-48');

      // Teardown server
      if (server) {
        server.close();
      }
    });
  });
});
