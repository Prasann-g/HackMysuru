import type { ComplaintRecord, ComplaintStatus } from '../types/complaint.js';
import type { ExistingComplaint, IssueCategory } from '../types/verification.js';
import { getDb } from './sqlite.js';

function mapRowToComplaint(row: any): ComplaintRecord {
  return {
    id: row.id,
    trackingToken: row.tracking_token,
    citizenId: row.citizen_id,
    category: row.category as IssueCategory,
    customCategory: row.custom_category || undefined,
    description: row.description,
    observedDate: row.observed_date,
    locationArea: row.location_area,
    addressText: row.address_text || undefined,
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : undefined,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : undefined,
    hasImage: Boolean(row.has_image),
    evidenceMetadata: row.evidence_metadata ? JSON.parse(row.evidence_metadata) : undefined,
    status: row.status as ComplaintStatus,
    verificationResult: row.verification_result ? JSON.parse(row.verification_result) : undefined,
    assignedOfficerId: row.assigned_officer_id || undefined,
    assignedDepartment: row.assigned_department || undefined,
    reviewNotes: row.review_notes || undefined,
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ComplaintStore {
  public create(complaint: ComplaintRecord): ComplaintRecord {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO complaints (
        id, tracking_token, citizen_id, category, custom_category,
        description, observed_date, location_area, address_text,
        latitude, longitude, has_image, evidence_metadata,
        status, verification_result, assigned_officer_id, assigned_department,
        review_notes, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      complaint.id,
      complaint.trackingToken,
      complaint.citizenId,
      complaint.category,
      complaint.customCategory || null,
      complaint.description,
      complaint.observedDate,
      complaint.locationArea,
      complaint.addressText || null,
      complaint.latitude !== undefined ? complaint.latitude : null,
      complaint.longitude !== undefined ? complaint.longitude : null,
      complaint.hasImage ? 1 : 0,
      complaint.evidenceMetadata ? JSON.stringify(complaint.evidenceMetadata) : null,
      complaint.status,
      complaint.verificationResult ? JSON.stringify(complaint.verificationResult) : null,
      complaint.assignedOfficerId || null,
      complaint.assignedDepartment || null,
      complaint.reviewNotes || null,
      complaint.isDemo ? 1 : 0,
      complaint.createdAt,
      complaint.updatedAt
    );

    return complaint;
  }

  public findById(id: string): ComplaintRecord | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM complaints WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? mapRowToComplaint(row) : undefined;
  }

  public findByTrackingToken(token: string): ComplaintRecord | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM complaints WHERE tracking_token = ?');
    const row = stmt.get(token.trim().toUpperCase()) as any;
    return row ? mapRowToComplaint(row) : undefined;
  }

  public findByCitizenId(citizenId: string): ComplaintRecord[] {
    const db = getDb();
    const stmt = db.prepare(
      'SELECT * FROM complaints WHERE citizen_id = ? ORDER BY created_at DESC'
    );
    const rows = stmt.all(citizenId) as any[];
    return rows.map(mapRowToComplaint);
  }

  public listOpenCandidates(): ExistingComplaint[] {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT id, category, description, observed_date, location_area, status 
      FROM complaints 
      WHERE status NOT IN ('RESOLVED', 'CLOSED')
      ORDER BY created_at DESC
    `);
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      id: r.id,
      category: r.category as IssueCategory,
      description: r.description,
      observedDate: r.observed_date,
      locationArea: r.location_area,
      status: r.status,
    }));
  }

  public listForOfficer(filters?: {
    status?: string;
    locationArea?: string;
    category?: string;
    duplicateRisk?: string;
    q?: string;
  }): ComplaintRecord[] {
    const db = getDb();
    let query = 'SELECT * FROM complaints WHERE 1=1';
    const params: any[] = [];

    if (filters?.status && filters.status !== 'ALL') {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.locationArea && filters.locationArea !== 'ALL') {
      query += ' AND location_area = ?';
      params.push(filters.locationArea);
    }
    if (filters?.category && filters.category !== 'ALL') {
      query += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters?.duplicateRisk && filters.duplicateRisk !== 'ALL') {
      query += " AND json_extract(verification_result, '$.duplicateRisk') = ?";
      params.push(filters.duplicateRisk.toUpperCase());
    }
    if (filters?.q && filters.q.trim()) {
      query += ' AND (id LIKE ? OR tracking_token LIKE ? OR description LIKE ?)';
      const pattern = `%${filters.q.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(mapRowToComplaint);
  }

  public findMatchesForComplaint(id: string): ComplaintRecord[] {
    const target = this.findById(id);
    if (!target || !target.verificationResult?.matches || target.verificationResult.matches.length === 0) {
      return [];
    }
    const matchedIds = target.verificationResult.matches.map((m) => m.existingComplaintId);
    if (matchedIds.length === 0) return [];

    const db = getDb();
    const placeholders = matchedIds.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM complaints WHERE id IN (${placeholders})`);
    const rows = stmt.all(...matchedIds) as any[];
    return rows.map(mapRowToComplaint);
  }

  public update(
    id: string,
    updates: Partial<ComplaintRecord>
  ): ComplaintRecord | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const merged: ComplaintRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const db = getDb();
    const stmt = db.prepare(`
      UPDATE complaints SET
        category = ?,
        custom_category = ?,
        description = ?,
        observed_date = ?,
        location_area = ?,
        address_text = ?,
        latitude = ?,
        longitude = ?,
        has_image = ?,
        evidence_metadata = ?,
        status = ?,
        verification_result = ?,
        assigned_officer_id = ?,
        assigned_department = ?,
        review_notes = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.category,
      merged.customCategory || null,
      merged.description,
      merged.observedDate,
      merged.locationArea,
      merged.addressText || null,
      merged.latitude !== undefined ? merged.latitude : null,
      merged.longitude !== undefined ? merged.longitude : null,
      merged.hasImage ? 1 : 0,
      merged.evidenceMetadata ? JSON.stringify(merged.evidenceMetadata) : null,
      merged.status,
      merged.verificationResult ? JSON.stringify(merged.verificationResult) : null,
      merged.assignedOfficerId || null,
      merged.assignedDepartment || null,
      merged.reviewNotes || null,
      merged.updatedAt,
      id
    );

    return merged;
  }

  public listDemoComplaints(): ComplaintRecord[] {
    const db = getDb();
    const stmt = db.prepare(
      'SELECT * FROM complaints WHERE is_demo = 1 ORDER BY created_at ASC'
    );
    const rows = stmt.all() as any[];
    return rows.map(mapRowToComplaint);
  }

  public clearNonDemo(): void {
    const db = getDb();
    db.exec('DELETE FROM complaints WHERE is_demo = 0');
  }

  public resetAll(): void {
    const db = getDb();
    db.exec('DELETE FROM complaints');
  }
}

export const complaintStore = new ComplaintStore();
