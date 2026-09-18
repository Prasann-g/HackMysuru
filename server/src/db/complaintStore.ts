import type {
  ComplaintRecord,
  ComplaintResolutionAuditRecord,
  ComplaintStatus,
  PublicAnalyticsData,
  PublicComplaintSummary,
  ResolutionActionType,
} from '../types/complaint.js';
import type { ExistingComplaint, IssueCategory } from '../types/verification.js';
import { getDb } from './sqlite.js';
import { CONFIG } from '../config.js';
import { AUTHENTIC_COMPLAINT_IDS, type ComplaintOfficerFilters, type IComplaintStore } from './interfaces.js';
import { SupabaseComplaintStore } from './supabaseComplaintStore.js';

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
    imagePath: row.image_path || undefined,
    imageSha256: row.image_sha256 || undefined,
    imagePhash: row.image_phash || undefined,
    status: row.status as ComplaintStatus,
    verificationResult: row.verification_result ? JSON.parse(row.verification_result) : undefined,
    assignedOfficerId: row.assigned_officer_id || undefined,
    assignedDepartment: row.assigned_department || undefined,
    reviewNotes: row.review_notes || undefined,
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    primaryComplaintId: row.primary_complaint_id || undefined,
    duplicateClusterId: row.duplicate_cluster_id || undefined,
    resolutionAction: row.resolution_action || 'NONE',
    resolvedByOfficerId: row.resolved_by_officer_id || undefined,
    resolvedAt: row.resolved_at || undefined,
  };
}

function mapRowToAudit(row: any): ComplaintResolutionAuditRecord {
  return {
    id: row.id,
    clusterId: row.cluster_id,
    primaryComplaintId: row.primary_complaint_id,
    secondaryComplaintIds: JSON.parse(row.secondary_complaint_ids),
    actionType: row.action_type as ResolutionActionType,
    officerId: row.officer_id,
    officerName: row.officer_name,
    decisionNotes: row.decision_notes,
    previousStates: JSON.parse(row.previous_states),
    createdAt: row.created_at,
  };
}

export class SqliteComplaintStore implements IComplaintStore {
  public createSync(complaint: ComplaintRecord): ComplaintRecord {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO complaints (
        id, tracking_token, citizen_id, category, custom_category,
        description, observed_date, location_area, address_text,
        latitude, longitude, has_image, evidence_metadata,
        image_path, image_sha256, image_phash,
        status, verification_result, assigned_officer_id, assigned_department,
        review_notes, is_demo, created_at, updated_at,
        primary_complaint_id, duplicate_cluster_id, resolution_action,
        resolved_by_officer_id, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      complaint.imagePath || null,
      complaint.imageSha256 || null,
      complaint.imagePhash || null,
      complaint.status,
      complaint.verificationResult ? JSON.stringify(complaint.verificationResult) : null,
      complaint.assignedOfficerId || null,
      complaint.assignedDepartment || null,
      complaint.reviewNotes || null,
      complaint.isDemo ? 1 : 0,
      complaint.createdAt,
      complaint.updatedAt,
      complaint.primaryComplaintId || null,
      complaint.duplicateClusterId || null,
      complaint.resolutionAction || 'NONE',
      complaint.resolvedByOfficerId || null,
      complaint.resolvedAt || null
    );

    return complaint;
  }

  public async create(complaint: ComplaintRecord): Promise<ComplaintRecord> {
    return this.createSync(complaint);
  }

  public findByImageSha256Sync(sha256: string, excludeId?: string): ComplaintRecord[] {
    const db = getDb();
    if (excludeId) {
      const stmt = db.prepare('SELECT * FROM complaints WHERE image_sha256 = ? AND id != ?');
      const rows = stmt.all(sha256, excludeId) as any[];
      return rows.map(mapRowToComplaint);
    }
    const stmt = db.prepare('SELECT * FROM complaints WHERE image_sha256 = ?');
    const rows = stmt.all(sha256) as any[];
    return rows.map(mapRowToComplaint);
  }

  public async findByImageSha256(sha256: string, excludeId?: string): Promise<ComplaintRecord[]> {
    return this.findByImageSha256Sync(sha256, excludeId);
  }

  public findByIdSync(id: string): ComplaintRecord | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM complaints WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? mapRowToComplaint(row) : undefined;
  }

  public async findById(id: string): Promise<ComplaintRecord | undefined> {
    return this.findByIdSync(id);
  }

  public findByTrackingTokenSync(token: string): ComplaintRecord | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM complaints WHERE tracking_token = ?');
    const row = stmt.get(token.trim().toUpperCase()) as any;
    return row ? mapRowToComplaint(row) : undefined;
  }

  public async findByTrackingToken(token: string): Promise<ComplaintRecord | undefined> {
    return this.findByTrackingTokenSync(token);
  }

  public findByCitizenIdSync(citizenId: string): ComplaintRecord[] {
    const db = getDb();
    const stmt = db.prepare(
      'SELECT * FROM complaints WHERE citizen_id = ? ORDER BY created_at DESC'
    );
    const rows = stmt.all(citizenId) as any[];
    return rows.map(mapRowToComplaint);
  }

  public async findByCitizenId(citizenId: string): Promise<ComplaintRecord[]> {
    return this.findByCitizenIdSync(citizenId);
  }

  public listOpenCandidatesSync(): ExistingComplaint[] {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT id, category, description, observed_date, location_area, status, image_sha256, image_phash 
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
      imageSha256: r.image_sha256 || undefined,
      imagePhash: r.image_phash || undefined,
    }));
  }

  public async listOpenCandidates(): Promise<ExistingComplaint[]> {
    return this.listOpenCandidatesSync();
  }

  public listCandidatesForVerificationSync(limit = 1000): ExistingComplaint[] {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT id, category, description, observed_date, location_area, status, image_sha256, image_phash 
      FROM complaints 
      WHERE status NOT IN ('RESOLVED', 'CLOSED')
         OR image_sha256 IS NOT NULL
         OR image_phash IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      category: r.category as IssueCategory,
      description: r.description,
      observedDate: r.observed_date,
      locationArea: r.location_area,
      status: r.status,
      imageSha256: r.image_sha256 || undefined,
      imagePhash: r.image_phash || undefined,
    }));
  }

  public async listCandidatesForVerification(limit = 1000): Promise<ExistingComplaint[]> {
    return this.listCandidatesForVerificationSync(limit);
  }

  public listForOfficerSync(filters?: ComplaintOfficerFilters): ComplaintRecord[] {
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

  public async listForOfficer(filters?: ComplaintOfficerFilters): Promise<ComplaintRecord[]> {
    return this.listForOfficerSync(filters);
  }

  public findMatchesForComplaintSync(id: string): ComplaintRecord[] {
    const target = this.findByIdSync(id);
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

  public async findMatchesForComplaint(id: string): Promise<ComplaintRecord[]> {
    return this.findMatchesForComplaintSync(id);
  }

  public updateSync(
    id: string,
    updates: Partial<ComplaintRecord>
  ): ComplaintRecord | undefined {
    const existing = this.findByIdSync(id);
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
        primary_complaint_id = ?,
        duplicate_cluster_id = ?,
        resolution_action = ?,
        resolved_by_officer_id = ?,
        resolved_at = ?,
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
      merged.primaryComplaintId || null,
      merged.duplicateClusterId || null,
      merged.resolutionAction || 'NONE',
      merged.resolvedByOfficerId || null,
      merged.resolvedAt || null,
      merged.updatedAt,
      id
    );

    return merged;
  }

  public async update(
    id: string,
    updates: Partial<ComplaintRecord>
  ): Promise<ComplaintRecord | undefined> {
    return this.updateSync(id, updates);
  }

  public listDemoComplaintsSync(): ComplaintRecord[] {
    const db = getDb();
    const stmt = db.prepare(
      'SELECT * FROM complaints WHERE is_demo = 1 ORDER BY created_at ASC'
    );
    const rows = stmt.all() as any[];
    return rows.map(mapRowToComplaint);
  }

  public async listDemoComplaints(): Promise<ComplaintRecord[]> {
    return this.listDemoComplaintsSync();
  }

  public getPublicAnalyticsSync(): PublicAnalyticsData {
    const db = getDb();

    // 1. Total Genuine Complaints
    const totalRow = db.prepare('SELECT COUNT(*) as c FROM complaints WHERE is_demo = 0').get() as { c: number };
    const totalComplaints = totalRow ? Number(totalRow.c) : 0;

    // 2. Breakdown by Status
    const statusRows = db.prepare(`
      SELECT status, COUNT(*) as c 
      FROM complaints 
      WHERE is_demo = 0 
      GROUP BY status
    `).all() as Array<{ status: string; c: number }>;
    const byStatus: Record<string, number> = {};
    for (const row of statusRows) {
      byStatus[row.status] = Number(row.c);
    }

    // 3. Breakdown by Issue Category
    const categoryRows = db.prepare(`
      SELECT category, COUNT(*) as c 
      FROM complaints 
      WHERE is_demo = 0 
      GROUP BY category 
      ORDER BY c DESC
    `).all() as Array<{ category: string; c: number }>;
    const byCategory: Record<string, number> = {};
    for (const row of categoryRows) {
      byCategory[row.category] = Number(row.c);
    }

    // 4. Breakdown by Location Area
    const areaRows = db.prepare(`
      SELECT location_area, COUNT(*) as c 
      FROM complaints 
      WHERE is_demo = 0 
      GROUP BY location_area 
      ORDER BY c DESC
    `).all() as Array<{ location_area: string; c: number }>;
    const byArea: Record<string, number> = {};
    for (const row of areaRows) {
      byArea[row.location_area] = Number(row.c);
    }

    // 5. Verification Outcome & Risk Breakdown
    const outcomeRows = db.prepare(`
      SELECT json_extract(verification_result, '$.outcome') as outcome, COUNT(*) as c 
      FROM complaints 
      WHERE is_demo = 0 AND verification_result IS NOT NULL 
      GROUP BY outcome
    `).all() as Array<{ outcome: string | null; c: number }>;
    const byVerificationOutcome: Record<string, number> = {};
    for (const row of outcomeRows) {
      if (row.outcome) {
        byVerificationOutcome[row.outcome] = Number(row.c);
      }
    }

    const riskRows = db.prepare(`
      SELECT json_extract(verification_result, '$.duplicateRisk') as duplicateRisk, COUNT(*) as c 
      FROM complaints 
      WHERE is_demo = 0 AND verification_result IS NOT NULL 
      GROUP BY duplicateRisk
    `).all() as Array<{ duplicateRisk: string | null; c: number }>;
    const byDuplicateRisk: Record<string, number> = {};
    for (const row of riskRows) {
      if (row.duplicateRisk) {
        byDuplicateRisk[row.duplicateRisk] = Number(row.c);
      }
    }

    // 6. Coordinates Availability
    const coordsRow = db.prepare(`
      SELECT COUNT(*) as c 
      FROM complaints 
      WHERE is_demo = 0 AND latitude IS NOT NULL AND longitude IS NOT NULL
    `).get() as { c: number };
    const totalWithCoordinates = coordsRow ? Number(coordsRow.c) : 0;
    const totalWithoutCoordinates = Math.max(0, totalComplaints - totalWithCoordinates);

    // 7. Rates
    const resolvedCount = (byStatus['RESOLVED'] || 0) + (byStatus['CLOSED'] || 0);
    const resolutionRatePercent = totalComplaints > 0 
      ? Math.round((resolvedCount / totalComplaints) * 1000) / 10 
      : 0;

    const verifiedCount = byVerificationOutcome['RECOMMENDED_VERIFIED'] || 0;
    const verifiedRatePercent = totalComplaints > 0 
      ? Math.round((verifiedCount / totalComplaints) * 1000) / 10 
      : 0;

    // 8. Sanitized Public Recent Log (STRICTLY PII-FREE)
    const recentRows = db.prepare(`
      SELECT 
        id, category, custom_category, location_area, status, observed_date, created_at,
        latitude, longitude,
        json_extract(verification_result, '$.outcome') as outcome,
        json_extract(verification_result, '$.duplicateRisk') as duplicate_risk
      FROM complaints 
      WHERE is_demo = 0 
      ORDER BY created_at DESC 
      LIMIT 15
    `).all() as any[];

    const recentComplaints: PublicComplaintSummary[] = recentRows.map((r) => ({
      id: r.id,
      category: r.category as IssueCategory,
      customCategory: r.custom_category || undefined,
      locationArea: r.location_area,
      status: r.status as ComplaintStatus,
      observedDate: r.observed_date,
      createdAt: r.created_at,
      verificationOutcome: r.outcome || undefined,
      duplicateRisk: r.duplicate_risk || undefined,
      hasCoordinates: r.latitude !== null && r.longitude !== null,
      latitude: r.latitude !== null ? Number(r.latitude) : undefined,
      longitude: r.longitude !== null ? Number(r.longitude) : undefined,
    }));

    return {
      totalComplaints,
      byStatus,
      byCategory,
      byArea,
      byVerificationOutcome,
      byDuplicateRisk,
      coordinatesCoverage: {
        totalWithCoordinates,
        totalWithoutCoordinates,
      },
      resolutionRatePercent,
      verifiedRatePercent,
      recentComplaints,
      generatedAt: new Date().toISOString(),
    };
  }

  public async getPublicAnalytics(): Promise<PublicAnalyticsData> {
    return this.getPublicAnalyticsSync();
  }

  public createAuditRecordSync(record: ComplaintResolutionAuditRecord): ComplaintResolutionAuditRecord {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO complaint_resolution_audit (
        id, cluster_id, primary_complaint_id, secondary_complaint_ids,
        action_type, officer_id, officer_name, decision_notes,
        previous_states, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.clusterId,
      record.primaryComplaintId,
      JSON.stringify(record.secondaryComplaintIds),
      record.actionType,
      record.officerId,
      record.officerName,
      record.decisionNotes,
      JSON.stringify(record.previousStates),
      record.createdAt
    );

    return record;
  }

  public async createAuditRecord(record: ComplaintResolutionAuditRecord): Promise<ComplaintResolutionAuditRecord> {
    return this.createAuditRecordSync(record);
  }

  public listAuditRecordsSync(clusterId?: string): ComplaintResolutionAuditRecord[] {
    const db = getDb();
    let query = 'SELECT * FROM complaint_resolution_audit';
    const params: any[] = [];
    if (clusterId) {
      query += ' WHERE cluster_id = ?';
      params.push(clusterId);
    }
    query += ' ORDER BY created_at DESC';
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(mapRowToAudit);
  }

  public async listAuditRecords(clusterId?: string): Promise<ComplaintResolutionAuditRecord[]> {
    return this.listAuditRecordsSync(clusterId);
  }

  public clearNonDemoSync(): void {
    const db = getDb();
    const placeholders = AUTHENTIC_COMPLAINT_IDS.map(() => '?').join(',');
    db.prepare(`
      DELETE FROM complaint_resolution_audit 
      WHERE primary_complaint_id NOT IN (${placeholders});
    `).run(...AUTHENTIC_COMPLAINT_IDS);
    db.prepare(`
      DELETE FROM complaints 
      WHERE is_demo = 0 AND id NOT IN (${placeholders});
    `).run(...AUTHENTIC_COMPLAINT_IDS);
  }

  public async clearNonDemo(): Promise<void> {
    this.clearNonDemoSync();
  }

  public resetAllSync(): void {
    const db = getDb();
    db.exec('DELETE FROM complaint_resolution_audit');
    db.exec('DELETE FROM complaints');
  }

  public async resetAll(): Promise<void> {
    this.resetAllSync();
  }
}

export class DualComplaintStore implements IComplaintStore {
  public readonly sqlite: SqliteComplaintStore;
  public readonly supabase: SupabaseComplaintStore;

  constructor(sqlite?: SqliteComplaintStore, supabase?: SupabaseComplaintStore) {
    this.sqlite = sqlite || new SqliteComplaintStore();
    this.supabase = supabase || new SupabaseComplaintStore();
  }

  public get active(): IComplaintStore {
    return CONFIG.DATA_STORE === 'supabase' ? this.supabase : this.sqlite;
  }

  public async create(complaint: ComplaintRecord): Promise<ComplaintRecord> {
    return this.active.create(complaint);
  }

  public async findByImageSha256(sha256: string, excludeId?: string): Promise<ComplaintRecord[]> {
    return this.active.findByImageSha256(sha256, excludeId);
  }

  public async findById(id: string): Promise<ComplaintRecord | undefined> {
    return this.active.findById(id);
  }

  public async findByTrackingToken(token: string): Promise<ComplaintRecord | undefined> {
    return this.active.findByTrackingToken(token);
  }

  public async findByCitizenId(citizenId: string): Promise<ComplaintRecord[]> {
    return this.active.findByCitizenId(citizenId);
  }

  public async listOpenCandidates(): Promise<ExistingComplaint[]> {
    return this.active.listOpenCandidates();
  }

  public async listCandidatesForVerification(limit = 1000): Promise<ExistingComplaint[]> {
    return this.active.listCandidatesForVerification(limit);
  }

  public async listForOfficer(filters?: ComplaintOfficerFilters): Promise<ComplaintRecord[]> {
    return this.active.listForOfficer(filters);
  }

  public async findMatchesForComplaint(id: string): Promise<ComplaintRecord[]> {
    return this.active.findMatchesForComplaint(id);
  }

  public async update(
    id: string,
    updates: Partial<ComplaintRecord>
  ): Promise<ComplaintRecord | undefined> {
    return this.active.update(id, updates);
  }

  public async listDemoComplaints(): Promise<ComplaintRecord[]> {
    return this.active.listDemoComplaints();
  }

  public async getPublicAnalytics(): Promise<PublicAnalyticsData> {
    return this.active.getPublicAnalytics();
  }

  public async createAuditRecord(record: ComplaintResolutionAuditRecord): Promise<ComplaintResolutionAuditRecord> {
    return this.active.createAuditRecord(record);
  }

  public async listAuditRecords(clusterId?: string): Promise<ComplaintResolutionAuditRecord[]> {
    return this.active.listAuditRecords(clusterId);
  }

  public async clearNonDemo(): Promise<void> {
    return this.active.clearNonDemo();
  }

  public async resetAll(): Promise<void> {
    return this.active.resetAll();
  }
}

export type { PublicComplaintSummary, PublicAnalyticsData };

export const sqliteComplaintStore = new SqliteComplaintStore();
export const supabaseComplaintStore = new SupabaseComplaintStore();
export const complaintStore = new DualComplaintStore(sqliteComplaintStore, supabaseComplaintStore);
export { SqliteComplaintStore as ComplaintStore };
