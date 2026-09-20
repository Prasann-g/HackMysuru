import { getDb } from '../../db/sqlite.js';
import { getSupabaseClient } from '../../db/supabase.js';
import { CONFIG } from '../../config.js';
import { complaintStore } from '../../db/complaintStore.js';
import type { ComplaintRecord, ComplaintResolutionAuditRecord } from '../../types/complaint.js';
import type { ActivityLogRecord, ActivityEventType } from './followthrough.types.js';

function safeParseJson(data: any): Record<string, any> | undefined {
  if (!data) return undefined;
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

function mapRowToActivity(row: any): ActivityLogRecord {
  return {
    id: row.id,
    complaintId: row.complaint_id,
    eventType: row.event_type as ActivityEventType,
    sourceTable: row.source_table,
    sourceRecordId: row.source_record_id,
    actorId: row.actor_id || undefined,
    actorName: row.actor_name || undefined,
    actorRole: row.actor_role || undefined,
    oldStatus: row.old_status || undefined,
    newStatus: row.new_status || undefined,
    notes: row.notes || undefined,
    metadata: safeParseJson(row.metadata),
    createdAt: row.created_at,
  };
}

export class FollowthroughRepository {
  /**
   * Records a historical lifecycle activity event in complaint_activity_log.
   * Enforces idempotency to prevent duplicate ingestion of the exact same source event,
   * while legitimately allowing repeated event types (e.g. multiple STATUS_CHANGED).
   * 
   * When DATA_STORE=supabase, Supabase is the sole authority and errors are propagated.
   * Never silently falls back to SQLite when Supabase is configured.
   */
  public async logActivity(record: ActivityLogRecord): Promise<ActivityLogRecord> {
    if (CONFIG.DATA_STORE === 'supabase') {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('[FollowthroughRepository] DATA_STORE is configured to "supabase", but Supabase client is uninitialized.');
      }

      // Idempotency check: check if the exact source event was already recorded
      const { data: existing, error: selectErr } = await supabase
        .from('complaint_activity_log')
        .select('*')
        .eq('source_table', record.sourceTable)
        .eq('source_record_id', record.sourceRecordId)
        .eq('event_type', record.eventType)
        .eq('created_at', record.createdAt)
        .maybeSingle();

      if (selectErr) {
        // Safe fallback if activity-log table has not yet been migrated to Supabase
        const isTableMissing =
          selectErr.code === 'PGRST205' ||
          selectErr.code === '42P01' ||
          selectErr.message?.includes('schema cache') ||
          selectErr.message?.includes('does not exist');

        if (isTableMissing) {
          console.warn(
            `[FollowthroughRepository] Activity log table unavailable in Supabase (${selectErr.message}). Skipping activity logging safely without failing complaint operation.`
          );
          return record;
        }

        console.error('[FollowthroughRepository] Supabase idempotency check failed:', selectErr.message);
        throw new Error(`Failed to check activity log idempotency in Supabase: ${selectErr.message}`);
      }

      if (existing) {
        return mapRowToActivity(existing);
      }

      const row = {
        id: record.id,
        complaint_id: record.complaintId,
        event_type: record.eventType,
        source_table: record.sourceTable,
        source_record_id: record.sourceRecordId,
        actor_id: record.actorId || null,
        actor_name: record.actorName || null,
        actor_role: record.actorRole || null,
        old_status: record.oldStatus || null,
        new_status: record.newStatus || null,
        notes: record.notes || null,
        metadata: record.metadata || null,
        created_at: record.createdAt,
      };

      const { error: insertErr } = await supabase.from('complaint_activity_log').insert(row);
      if (insertErr) {
        const isTableMissing =
          insertErr.code === 'PGRST205' ||
          insertErr.code === '42P01' ||
          insertErr.message?.includes('schema cache') ||
          insertErr.message?.includes('does not exist');

        if (isTableMissing) {
          console.warn(
            `[FollowthroughRepository] Activity log table unavailable in Supabase on insert (${insertErr.message}). Skipping activity logging safely.`
          );
          return record;
        }

        console.error('[FollowthroughRepository] Supabase insert failed:', insertErr.message);
        throw new Error(`Failed to insert activity log into Supabase: ${insertErr.message}`);
      }
      return record;
    }

    // SQLite data store
    const db = getDb();
    // Idempotency check
    const checkStmt = db.prepare(`
      SELECT * FROM complaint_activity_log 
      WHERE source_table = ? AND source_record_id = ? AND event_type = ? AND created_at = ?
    `);
    const existing = checkStmt.get(
      record.sourceTable,
      record.sourceRecordId,
      record.eventType,
      record.createdAt
    ) as any;

    if (existing) {
      return mapRowToActivity(existing);
    }

    const insertStmt = db.prepare(`
      INSERT INTO complaint_activity_log (
        id, complaint_id, event_type, source_table, source_record_id,
        actor_id, actor_name, actor_role, old_status, new_status,
        notes, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      record.id,
      record.complaintId,
      record.eventType,
      record.sourceTable,
      record.sourceRecordId,
      record.actorId || null,
      record.actorName || null,
      record.actorRole || null,
      record.oldStatus || null,
      record.newStatus || null,
      record.notes || null,
      record.metadata ? JSON.stringify(record.metadata) : null,
      record.createdAt
    );

    return record;
  }

  /**
   * Retrieves all logged activities for a complaint, ordered chronologically.
   */
  public async getActivitiesForComplaint(complaintId: string): Promise<ActivityLogRecord[]> {
    if (CONFIG.DATA_STORE === 'supabase') {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('[FollowthroughRepository] DATA_STORE is configured to "supabase", but Supabase client is uninitialized.');
      }

      const { data, error } = await supabase
        .from('complaint_activity_log')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: true });

      if (error) {
        // Defensive check: distinguish missing table from unexpected Supabase network/auth errors
        const isTableMissing =
          error.code === 'PGRST205' ||
          error.code === '42P01' ||
          error.message?.includes('schema cache') ||
          error.message?.includes('does not exist');

        if (isTableMissing) {
          console.warn(
            `[FollowthroughRepository] Supabase table 'complaint_activity_log' unavailable (${error.message}). Falling back to empty activities array to preserve timeline rendering.`
          );
          return [];
        }

        console.error('[FollowthroughRepository] Supabase getActivities error:', error.message);
        throw new Error(`Failed to retrieve activities from Supabase: ${error.message}`);
      }

      return (data || []).map(mapRowToActivity);
    }

    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM complaint_activity_log 
      WHERE complaint_id = ? 
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(complaintId) as any[];
    return rows.map(mapRowToActivity);
  }

  /**
   * Retrieves duplicate cluster audit records related to a complaint.
   */
  public async getAuditLogsForComplaint(complaintId: string): Promise<ComplaintResolutionAuditRecord[]> {
    const allAudits = await complaintStore.listAuditRecords();
    return allAudits.filter(
      (a) =>
        a.primaryComplaintId === complaintId ||
        (Array.isArray(a.secondaryComplaintIds) && a.secondaryComplaintIds.includes(complaintId))
    );
  }

  /**
   * Retrieves complaint record by ID from authoritative store.
   */
  public async getComplaintById(complaintId: string): Promise<ComplaintRecord | undefined> {
    return complaintStore.findById(complaintId);
  }

  /**
   * Retrieves all active (open) complaints from authoritative store.
   */
  public async listActiveComplaints(): Promise<ComplaintRecord[]> {
    const all = await complaintStore.listForOfficer();
    return all.filter((c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED');
  }
}

export const followthroughRepository = new FollowthroughRepository();
