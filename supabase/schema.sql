-- ============================================================================
-- CivicTrust AI — Supabase PostgreSQL Schema & Storage Setup
-- Project: HackMysuru 1.0
-- Database Engine: PostgreSQL 15+
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Users Table (Municipal Officers, Citizens, Administrators)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('CITIZEN', 'OFFICER', 'ADMIN')),
  ward TEXT,
  department TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ----------------------------------------------------------------------------
-- 2. Complaints Table (Grievances, Verification Signals, Evidence Metadata)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaints (
  id TEXT PRIMARY KEY,
  tracking_token TEXT UNIQUE NOT NULL,
  citizen_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'garbage_dumping', 'overflowing_bin', 'pothole',
    'broken_streetlight', 'unsegregated_waste',
    'construction_debris', 'other'
  )),
  custom_category TEXT,
  description TEXT NOT NULL,
  observed_date DATE NOT NULL,
  location_area TEXT NOT NULL,
  address_text TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  has_image BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_metadata JSONB,
  image_path TEXT,
  image_sha256 TEXT,
  image_phash TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
    'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION',
    'FORWARDED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
  )),
  verification_result JSONB,
  assigned_officer_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_department TEXT,
  review_notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  primary_complaint_id TEXT REFERENCES public.complaints(id) ON DELETE SET NULL,
  duplicate_cluster_id TEXT,
  resolution_action TEXT DEFAULT 'NONE',
  resolved_by_officer_id TEXT,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_complaints_citizen ON public.complaints(citizen_id);
CREATE INDEX IF NOT EXISTS idx_complaints_token ON public.complaints(tracking_token);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_area ON public.complaints(location_area);
CREATE INDEX IF NOT EXISTS idx_complaints_image_sha256 ON public.complaints(image_sha256);
CREATE INDEX IF NOT EXISTS idx_complaints_cluster ON public.complaints(duplicate_cluster_id);
CREATE INDEX IF NOT EXISTS idx_complaints_primary ON public.complaints(primary_complaint_id);

-- ----------------------------------------------------------------------------
-- 3. Duplicate Cluster Resolution Audit Log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_resolution_audit (
  id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL,
  primary_complaint_id TEXT NOT NULL REFERENCES public.complaints(id),
  secondary_complaint_ids JSONB NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('MARK_RELATED', 'MERGE_DUPLICATES', 'UNLINK', 'MARK_DISTINCT')),
  officer_id TEXT NOT NULL REFERENCES public.users(id),
  officer_name TEXT NOT NULL,
  decision_notes TEXT NOT NULL,
  previous_states JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_cluster ON public.complaint_resolution_audit(cluster_id);
CREATE INDEX IF NOT EXISTS idx_audit_primary ON public.complaint_resolution_audit(primary_complaint_id);

-- ----------------------------------------------------------------------------
-- 4. Supabase Storage Bucket Setup: complaint-evidence
-- ----------------------------------------------------------------------------
-- Creates private storage bucket for complaint photo evidence if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'complaint-evidence',
  'complaint-evidence',
  false,
  10485760, -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Enable Row Level Security (RLS) on public tables (Backend bypasses with service role key)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_resolution_audit ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. Row Level Security — Architecture Note
-- ----------------------------------------------------------------------------
-- The CivicTrust backend uses the SUPABASE_SERVICE_ROLE_KEY exclusively for
-- all database operations. The service role key bypasses RLS by design, so
-- no client-level POLICY statements are required for the current architecture.
--
-- No direct PostgREST or anon-key client calls are made from the frontend.
-- All data access goes through the Express API layer with JWT-based RBAC.
--
-- If a future version adds a direct Supabase JS client in the frontend,
-- granular RLS policies MUST be added before doing so.
--
-- Intentionally no CREATE POLICY statements — this is by design, not omission.
