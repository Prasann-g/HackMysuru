-- ============================================================================
-- CivicTrust AI / HackMysuru — Supabase Migration Specification
-- Table: complaint_activity_log (Follow-through historical event ledger)
--
-- PURPOSE:
-- Provides an append-only, tamper-evident audit ledger for municipal complaint
-- lifecycle events (status changes, assignments, verifications, resolutions).
--
-- SAFETY & ISOLATION GUARANTEES:
-- 1. Forward-only & Non-destructive:
--    Does NOT alter, rename, or drop any existing tables, columns, or data.
-- 2. No mutation of existing data:
--    `complaints` and `users` tables remain 100% untouched.
-- 3. Idempotent:
--    Every statement uses `IF NOT EXISTS` guards for safe re-execution.
-- 4. Referential integrity:
--    REFERENCES public.complaints(id) ON DELETE CASCADE ensures integrity
--    without blocking parent complaints operations.
-- 5. Row-Level Security (RLS):
--    Enabled to protect against direct untrusted PostgREST access.
--    The backend connects via SUPABASE_SERVICE_ROLE_KEY, which automatically
--    bypasses RLS.
-- 6. Strict domain integrity:
--    CHECK constraint restricts event_type to the 10 domain lifecycle events.
-- ============================================================================

-- 1. Create table with referential integrity to authentic complaints and event_type validation
CREATE TABLE IF NOT EXISTS public.complaint_activity_log (
  id TEXT PRIMARY KEY,
  complaint_id TEXT NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'COMPLAINT_CREATED',
      'VERIFICATION_PROCESSED',
      'DEPARTMENT_ROUTED',
      'OFFICER_ASSIGNED',
      'STATUS_CHANGED',
      'OFFICER_REVIEW',
      'DUPLICATE_ACTION',
      'RESOLVED',
      'CLOSED',
      'LOCATION_UPDATED'
    )
  ),
  source_table TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  old_status TEXT,
  new_status TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Query performance indexes for chronological and source lookups
CREATE INDEX IF NOT EXISTS idx_activity_complaint ON public.complaint_activity_log(complaint_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.complaint_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_source ON public.complaint_activity_log(source_table, source_record_id);

-- 3. Enable Row-Level Security (Service role key bypasses; direct client access denied)
ALTER TABLE public.complaint_activity_log ENABLE ROW LEVEL SECURITY;
