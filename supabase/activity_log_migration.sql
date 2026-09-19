-- ============================================================================
-- CivicTrust AI / HackMysuru — Supabase Migration Proposal
-- Table: complaint_activity_log (Follow-through historical event ledger)
--
-- NOTE: Per strict project guidelines, this migration proposal is presented for
-- user review and approval before execution on the live Supabase instance.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.complaint_activity_log (
  id TEXT PRIMARY KEY,
  complaint_id TEXT NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
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

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_activity_complaint ON public.complaint_activity_log(complaint_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.complaint_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_source ON public.complaint_activity_log(source_table, source_record_id);

-- Enable Row Level Security (Service role key bypasses by design)
ALTER TABLE public.complaint_activity_log ENABLE ROW LEVEL SECURITY;
