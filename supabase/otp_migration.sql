-- Supabase Migration: Forward-only creation of OTP Challenges table
-- Enables passwordless login/registration for CivicTrust citizens

CREATE TABLE IF NOT EXISTS otp_challenges (
    id VARCHAR(50) PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL, -- Normalized email or phone
    hashed_code VARCHAR(255) NOT NULL,
    delivery_method VARCHAR(10) NOT NULL CHECK (delivery_method IN ('EMAIL', 'SMS')),
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('REGISTER', 'LOGIN')),
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safely enforce ONE active challenge per normalized identifier
-- This unique constraint is required for atomic UPSERT concurrency control
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'unique_active_otp_identifier'
    ) THEN
        ALTER TABLE otp_challenges ADD CONSTRAINT unique_active_otp_identifier UNIQUE (identifier);
    END IF;
END $$;

-- Index for fast lookup by identifier safely
CREATE INDEX IF NOT EXISTS idx_otp_challenges_identifier ON otp_challenges(identifier);
