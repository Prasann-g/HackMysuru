import type {
  ComplaintRecord,
  ComplaintResolutionAuditRecord,
  ComplaintStatus,
  PublicAnalyticsData,
  PublicComplaintSummary,
  ResolutionActionType,
} from '../types/complaint.js';
import type { ExistingComplaint, IssueCategory } from '../types/verification.js';
import type { ComplaintOfficerFilters, IComplaintStore } from './interfaces.js';
import { AUTHENTIC_COMPLAINT_IDS } from './interfaces.js';
import { getSupabaseClient } from './supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

function mapRowToComplaint(row: any): ComplaintRecord {
  const routingDecision = row.routing_decision
    ? (typeof row.routing_decision === 'string' ? JSON.parse(row.routing_decision) : row.routing_decision)
    : undefined;

  return {
    id: row.id,
    trackingToken: row.tracking_token,
    citizenId: row.citizen_id,
    category: row.category as IssueCategory,
    customCategory: row.custom_category || undefined,
    description: row.description,
    observedDate: typeof row.observed_date === 'string' ? row.observed_date.split('T')[0] : row.observed_date,
    locationArea: row.location_area,
    addressText: row.address_text || undefined,
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : undefined,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : undefined,
    locationAccuracy: row.location_accuracy !== null && row.location_accuracy !== undefined ? Number(row.location_accuracy) : undefined,
    locationSource: row.location_source || undefined,
    wardNumber: row.ward_number || routingDecision?.wardNumber || undefined,
    wardName: row.ward_name || routingDecision?.wardName || undefined,
    wardId: row.ward_id !== null && row.ward_id !== undefined
      ? Number(row.ward_id)
      : (routingDecision?.wardId !== undefined ? Number(routingDecision.wardId) : undefined),
    boundaryVersion: row.boundary_version || routingDecision?.boundaryVersion || undefined,
    hasImage: Boolean(row.has_image),
    evidenceMetadata: row.evidence_metadata
      ? (typeof row.evidence_metadata === 'string' ? JSON.parse(row.evidence_metadata) : row.evidence_metadata)
      : undefined,
    imagePath: row.image_path || undefined,
    imageSha256: row.image_sha256 || undefined,
    imagePhash: row.image_phash || undefined,
    status: row.status as ComplaintStatus,
    verificationResult: row.verification_result
      ? (typeof row.verification_result === 'string' ? JSON.parse(row.verification_result) : row.verification_result)
      : undefined,
    assignedOfficerId: row.assigned_officer_id || undefined,
    assignedDepartment: row.assigned_department || undefined,
    reviewNotes: row.review_notes || undefined,
    routingDecision,
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
    secondaryComplaintIds: typeof row.secondary_complaint_ids === 'string'
      ? JSON.parse(row.secondary_complaint_ids)
      : row.secondary_complaint_ids,
    actionType: row.action_type as ResolutionActionType,
    officerId: row.officer_id,
    officerName: row.officer_name,
    decisionNotes: row.decision_notes,
    previousStates: typeof row.previous_states === 'string'
      ? JSON.parse(row.previous_states)
      : row.previous_states,
    createdAt: row.created_at,
  };
}

export class SupabaseComplaintStore implements IComplaintStore {
  private getClient() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(
        'Supabase client is not initialized. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      );
    }
    return client;
  }

  public async create(complaint: ComplaintRecord): Promise<ComplaintRecord> {
    const client = this.getClient();
    const row = {
      id: complaint.id,
      tracking_token: complaint.trackingToken,
      citizen_id: complaint.citizenId,
      category: complaint.category,
      custom_category: complaint.customCategory || null,
      description: complaint.description,
      observed_date: complaint.observedDate,
      location_area: complaint.locationArea,
      address_text: complaint.addressText || null,
      latitude: complaint.latitude !== undefined ? complaint.latitude : null,
      longitude: complaint.longitude !== undefined ? complaint.longitude : null,
      has_image: complaint.hasImage,
      evidence_metadata: complaint.evidenceMetadata || null,
      image_path: complaint.imagePath || null,
      image_sha256: complaint.imageSha256 || null,
      image_phash: complaint.imagePhash || null,
      status: complaint.status,
      verification_result: complaint.verificationResult || null,
      assigned_officer_id: complaint.assignedOfficerId || null,
      assigned_department: complaint.assignedDepartment || null,
      review_notes: complaint.reviewNotes || null,
      is_demo: complaint.isDemo,
      created_at: complaint.createdAt,
      updated_at: complaint.updatedAt,
      primary_complaint_id: complaint.primaryComplaintId || null,
      duplicate_cluster_id: complaint.duplicateClusterId || null,
      resolution_action: complaint.resolutionAction || 'NONE',
      resolved_by_officer_id: complaint.resolvedByOfficerId || null,
      resolved_at: complaint.resolvedAt || null,
      routing_decision: complaint.routingDecision || null,
    };

    const { error } = await client.from('complaints').insert(row);
    if (error) {
      throw new Error(`Supabase create complaint failed: ${error.message}`);
    }
    return complaint;
  }

  public async findByImageSha256(sha256: string, excludeId?: string): Promise<ComplaintRecord[]> {
    const client = this.getClient();
    let query = client.from('complaints').select('*').eq('image_sha256', sha256);
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Supabase findByImageSha256 failed: ${error.message}`);
    }
    return (data || []).map(mapRowToComplaint);
  }

  public async findById(id: string): Promise<ComplaintRecord | undefined> {
    const client = this.getClient();
    const { data, error } = await client
      .from('complaints')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase findById failed: ${error.message}`);
    }
    return data ? mapRowToComplaint(data) : undefined;
  }

  public async findByTrackingToken(token: string): Promise<ComplaintRecord | undefined> {
    const client = this.getClient();
    const { data, error } = await client
      .from('complaints')
      .select('*')
      .eq('tracking_token', token.trim().toUpperCase())
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase findByTrackingToken failed: ${error.message}`);
    }
    return data ? mapRowToComplaint(data) : undefined;
  }

  public async findByCitizenId(citizenId: string): Promise<ComplaintRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('complaints')
      .select('*')
      .eq('citizen_id', citizenId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase findByCitizenId failed: ${error.message}`);
    }
    return (data || []).map(mapRowToComplaint);
  }

  public async listOpenCandidates(): Promise<ExistingComplaint[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('complaints')
      .select('id, category, description, observed_date, location_area, status, image_sha256, image_phash')
      .not('status', 'in', '("RESOLVED","CLOSED")')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase listOpenCandidates failed: ${error.message}`);
    }
    return (data || []).map((r) => ({
      id: r.id,
      category: r.category as IssueCategory,
      description: r.description,
      observedDate: typeof r.observed_date === 'string' ? r.observed_date.split('T')[0] : r.observed_date,
      locationArea: r.location_area,
      status: r.status,
      imageSha256: r.image_sha256 || undefined,
      imagePhash: r.image_phash || undefined,
    }));
  }

  public async listCandidatesForVerification(limit = 1000): Promise<ExistingComplaint[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('complaints')
      .select('id, category, description, observed_date, location_area, status, image_sha256, image_phash, latitude, longitude, created_at, evidence_metadata')
      .or('status.not.in.(RESOLVED,CLOSED),image_sha256.not.is.null,image_phash.not.is.null')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Supabase listCandidatesForVerification failed: ${error.message}`);
    }
    return (data || []).map((r) => {
      let imageEmbedding: number[] | undefined;
      if (r.evidence_metadata) {
        try {
          const meta = typeof r.evidence_metadata === 'string' ? JSON.parse(r.evidence_metadata) : r.evidence_metadata;
          if (Array.isArray(meta?.imageEmbedding)) {
            imageEmbedding = meta.imageEmbedding;
          }
        } catch {
          // ignore parsing error
        }
      }
      return {
        id: r.id,
        category: r.category as IssueCategory,
        description: r.description,
        observedDate: typeof r.observed_date === 'string' ? r.observed_date.split('T')[0] : r.observed_date,
        locationArea: r.location_area,
        status: r.status,
        imageSha256: r.image_sha256 || undefined,
        imagePhash: r.image_phash || undefined,
        imageEmbedding,
        latitude: r.latitude !== null && r.latitude !== undefined ? Number(r.latitude) : undefined,
        longitude: r.longitude !== null && r.longitude !== undefined ? Number(r.longitude) : undefined,
        createdAt: r.created_at || undefined,
      };
    });
  }

  public async listForOfficer(filters?: ComplaintOfficerFilters): Promise<ComplaintRecord[]> {
    const client = this.getClient();
    let query = client.from('complaints').select('*');

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status);
    }
    if (filters?.locationArea && filters.locationArea !== 'ALL') {
      query = query.eq('location_area', filters.locationArea);
    }
    if (filters?.category && filters.category !== 'ALL') {
      query = query.eq('category', filters.category);
    }
    if (filters?.duplicateRisk && filters.duplicateRisk !== 'ALL') {
      query = query.eq('verification_result->>duplicateRisk', filters.duplicateRisk.toUpperCase());
    }
    if (filters?.q && filters.q.trim()) {
      const pattern = `%${filters.q.trim()}%`;
      query = query.or(`id.ilike.${pattern},tracking_token.ilike.${pattern},description.ilike.${pattern}`);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      throw new Error(`Supabase listForOfficer failed: ${error.message}`);
    }
    return (data || []).map(mapRowToComplaint);
  }

  public async findMatchesForComplaint(id: string): Promise<ComplaintRecord[]> {
    const target = await this.findById(id);
    if (!target || !target.verificationResult?.matches || target.verificationResult.matches.length === 0) {
      return [];
    }
    const matchedIds = target.verificationResult.matches.map((m) => m.existingComplaintId);
    if (matchedIds.length === 0) return [];

    const client = this.getClient();
    const { data, error } = await client
      .from('complaints')
      .select('*')
      .in('id', matchedIds);

    if (error) {
      throw new Error(`Supabase findMatchesForComplaint failed: ${error.message}`);
    }
    return (data || []).map(mapRowToComplaint);
  }

  public async update(
    id: string,
    updates: Partial<ComplaintRecord>
  ): Promise<ComplaintRecord | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const merged: ComplaintRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const client = this.getClient();
    const row = {
      category: merged.category,
      custom_category: merged.customCategory || null,
      description: merged.description,
      observed_date: merged.observedDate,
      location_area: merged.locationArea,
      address_text: merged.addressText || null,
      latitude: merged.latitude !== undefined ? merged.latitude : null,
      longitude: merged.longitude !== undefined ? merged.longitude : null,
      has_image: merged.hasImage,
      evidence_metadata: merged.evidenceMetadata || null,
      status: merged.status,
      verification_result: merged.verificationResult || null,
      assigned_officer_id: merged.assignedOfficerId || null,
      assigned_department: merged.assignedDepartment || null,
      review_notes: merged.reviewNotes || null,
      primary_complaint_id: merged.primaryComplaintId || null,
      duplicate_cluster_id: merged.duplicateClusterId || null,
      resolution_action: merged.resolutionAction || 'NONE',
      resolved_by_officer_id: merged.resolvedByOfficerId || null,
      resolved_at: merged.resolvedAt || null,
      routing_decision: merged.routingDecision || null,
      updated_at: merged.updatedAt,
    };

    const { error } = await client.from('complaints').update(row).eq('id', id);
    if (error) {
      throw new Error(`Supabase update complaint failed: ${error.message}`);
    }
    return merged;
  }

  public async listDemoComplaints(): Promise<ComplaintRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('complaints')
      .select('*')
      .eq('is_demo', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Supabase listDemoComplaints failed: ${error.message}`);
    }
    return (data || []).map(mapRowToComplaint);
  }

  public async getPublicAnalytics(): Promise<PublicAnalyticsData> {
    const client = this.getClient();

    // Fetch all genuine complaints (is_demo = false) for authentic analytics calculation
    const { data: rows, error } = await client
      .from('complaints')
      .select('*')
      .eq('is_demo', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase getPublicAnalytics failed: ${error.message}`);
    }

    const complaints = (rows || []).map(mapRowToComplaint);
    const totalComplaints = complaints.length;

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byArea: Record<string, number> = {};
    const byVerificationOutcome: Record<string, number> = {};
    const byDuplicateRisk: Record<string, number> = {};
    let totalWithCoordinates = 0;

    for (const c of complaints) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
      byArea[c.locationArea] = (byArea[c.locationArea] || 0) + 1;

      if (c.verificationResult?.outcome) {
        byVerificationOutcome[c.verificationResult.outcome] =
          (byVerificationOutcome[c.verificationResult.outcome] || 0) + 1;
      }
      if (c.verificationResult?.duplicateRisk) {
        byDuplicateRisk[c.verificationResult.duplicateRisk] =
          (byDuplicateRisk[c.verificationResult.duplicateRisk] || 0) + 1;
      }

      if (c.latitude !== undefined && c.longitude !== undefined) {
        totalWithCoordinates++;
      }
    }

    const totalWithoutCoordinates = Math.max(0, totalComplaints - totalWithCoordinates);
    const resolvedCount = (byStatus['RESOLVED'] || 0) + (byStatus['CLOSED'] || 0);
    const resolutionRatePercent = totalComplaints > 0
      ? Math.round((resolvedCount / totalComplaints) * 1000) / 10
      : 0;

    const verifiedCount = byVerificationOutcome['RECOMMENDED_VERIFIED'] || 0;
    const verifiedRatePercent = totalComplaints > 0
      ? Math.round((verifiedCount / totalComplaints) * 1000) / 10
      : 0;

    // Sanitized PII-Free recent complaints (up to 15)
    const recentComplaints: PublicComplaintSummary[] = complaints.slice(0, 15).map((c) => ({
      id: c.id,
      category: c.category,
      customCategory: c.customCategory,
      locationArea: c.locationArea,
      status: c.status,
      observedDate: c.observedDate,
      createdAt: c.createdAt,
      verificationOutcome: c.verificationResult?.outcome,
      duplicateRisk: c.verificationResult?.duplicateRisk,
      hasCoordinates: c.latitude !== undefined && c.longitude !== undefined,
      latitude: c.latitude,
      longitude: c.longitude,
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

  public async createAuditRecord(record: ComplaintResolutionAuditRecord): Promise<ComplaintResolutionAuditRecord> {
    const client = this.getClient();
    const row = {
      id: record.id,
      cluster_id: record.clusterId,
      primary_complaint_id: record.primaryComplaintId,
      secondary_complaint_ids: record.secondaryComplaintIds,
      action_type: record.actionType,
      officer_id: record.officerId,
      officer_name: record.officerName,
      decision_notes: record.decisionNotes,
      previous_states: record.previousStates,
      created_at: record.createdAt,
    };

    const { error } = await client.from('complaint_resolution_audit').insert(row);
    if (error) {
      throw new Error(`Supabase createAuditRecord failed: ${error.message}`);
    }
    return record;
  }

  public async listAuditRecords(clusterId?: string): Promise<ComplaintResolutionAuditRecord[]> {
    const client = this.getClient();
    let query = client.from('complaint_resolution_audit').select('*');
    if (clusterId) {
      query = query.eq('cluster_id', clusterId);
    }
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      throw new Error(`Supabase listAuditRecords failed: ${error.message}`);
    }
    return (data || []).map(mapRowToAudit);
  }

  public async clearNonDemo(): Promise<void> {
    const client = this.getClient();
    const { error } = await client
      .from('complaints')
      .delete()
      .eq('is_demo', false)
      .not('id', 'in', `(${AUTHENTIC_COMPLAINT_IDS.map((id) => `"${id}"`).join(',')})`);
    if (error) {
      throw new Error(`Supabase clearNonDemo failed: ${error.message}`);
    }
  }

  public async resetAll(): Promise<void> {
    const client = this.getClient();
    await client.from('complaint_resolution_audit').delete().neq('id', '');
    const { error } = await client.from('complaints').delete().neq('id', '');
    if (error) {
      throw new Error(`Supabase resetAll failed: ${error.message}`);
    }
  }
}
