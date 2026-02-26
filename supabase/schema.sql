-- ═══════════════════════════════════════════════════════════════════════
--  ExpressScheme — Full Database Schema
--  Blockchain-based Government Scholarship Tokenisation Platform
-- ═══════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────
-- 1. USERS  (students + government officers)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role            TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','gov_officer','admin')),

  -- Personal details
  full_name       TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT,
  date_of_birth   DATE,
  gender          TEXT CHECK (gender IN ('male','female','other')),
  address         TEXT,
  state           TEXT,
  district        TEXT,
  pincode         TEXT,

  -- Identity documents (stored as hashes for privacy)
  aadhaar_hash    TEXT UNIQUE,          -- SHA-256 of Aadhaar number
  aadhaar_last4   TEXT,                 -- last 4 digits only (display)
  pan_hash        TEXT UNIQUE,          -- SHA-256 of PAN number
  pan_display     TEXT,                 -- masked PAN e.g. ABCDE1234F

  -- Academic (students only)
  institution_name TEXT,
  institution_code TEXT,
  course           TEXT,
  academic_year    TEXT,
  gpa              NUMERIC(4,2),

  -- Bank details (encrypted)
  bank_account_hash TEXT,               -- SHA-256 of account number
  bank_account_last4 TEXT,
  bank_ifsc         TEXT,
  bank_name         TEXT,

  -- Blockchain
  wallet_address  TEXT UNIQUE,

  -- Officer details
  officer_id      TEXT UNIQUE,          -- e.g. OFF-2026-001
  department      TEXT,

  -- Auth
  auth_user_id    UUID UNIQUE,          -- references Supabase auth.users
  is_ai_verified  BOOLEAN DEFAULT FALSE,
  ai_trust_score  NUMERIC(5,2) DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_role       ON users(role);
CREATE INDEX idx_users_email      ON users(email);
CREATE INDEX idx_users_aadhaar    ON users(aadhaar_hash);
CREATE INDEX idx_users_wallet     ON users(wallet_address);


-- ─────────────────────────────────────────────────────────────────────
-- 2. SCHEMES  (government scholarship schemes)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schemes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  description           TEXT,
  category              TEXT,           -- e.g. 'merit','need-based','sc-st','minority'
  ministry              TEXT,
  state                 TEXT,           -- 'central' or state name

  -- Eligibility
  min_gpa               NUMERIC(4,2),
  max_annual_income     NUMERIC(15,2),  -- INR
  eligible_courses      TEXT[],         -- array of course names
  eligible_genders      TEXT[],
  eligible_categories   TEXT[],         -- SC/ST/OBC/General etc.
  min_age               INT,
  max_age               INT,

  -- Financial
  budget_total          NUMERIC(15,2) NOT NULL,   -- INR
  budget_remaining      NUMERIC(15,2),
  amount_per_student    NUMERIC(12,2) NOT NULL,   -- INR
  max_beneficiaries     INT,

  -- Timeline
  start_date            DATE,
  end_date              DATE,
  application_deadline  DATE,

  -- Blockchain
  token_contract_address TEXT UNIQUE,
  tokens_minted          INT DEFAULT 0,
  tokens_distributed     INT DEFAULT 0,

  -- Status
  status                TEXT DEFAULT 'draft' CHECK (status IN (
    'draft','active','paused','closed','exhausted'
  )),
  created_by            UUID REFERENCES users(id),
  approved_by           UUID REFERENCES users(id),

  -- On-chain metadata hash
  ipfs_hash             TEXT,           -- IPFS CID of scheme document

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schemes_status     ON schemes(status);
CREATE INDEX idx_schemes_created_by ON schemes(created_by);
CREATE INDEX idx_schemes_state      ON schemes(state);


-- ─────────────────────────────────────────────────────────────────────
-- 3. APPLICATIONS  (student applications to schemes)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id           UUID NOT NULL REFERENCES schemes(id) ON DELETE RESTRICT,
  student_id          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Status flow: submitted → ai_review → ai_passed | ai_failed →
  --              officer_review → approved | rejected →
  --              token_queued → token_minted → distributed → redeemed
  status              TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted','ai_review','ai_passed','ai_failed',
    'officer_review','approved','rejected',
    'token_queued','token_minted','distributed','redeemed','expired'
  )),

  -- Application data snapshot (at time of submission)
  declared_income     NUMERIC(15,2),
  declared_gpa        NUMERIC(4,2),
  declared_course     TEXT,
  declared_institution TEXT,

  -- Review
  ai_trust_score      NUMERIC(5,2),
  ai_reviewed_at      TIMESTAMPTZ,
  officer_id          UUID REFERENCES users(id),
  officer_remarks     TEXT,
  reviewed_at         TIMESTAMPTZ,

  -- Rejection reason
  rejection_reason    TEXT,
  rejection_category  TEXT CHECK (rejection_category IN (
    'income_exceeded','fraud_detected','duplicate','ineligible_course',
    'document_invalid','manual_reject',NULL
  )),

  -- Token info (populated after minting)
  token_id            UUID,             -- references tokens(id)
  token_tx_hash       TEXT,

  -- Metadata
  application_number  TEXT UNIQUE,      -- e.g. APP-2026-000042
  ip_address          TEXT,
  user_agent          TEXT,
  submission_note     TEXT,

  submitted_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate applications
  UNIQUE(scheme_id, student_id)
);

CREATE INDEX idx_applications_student    ON applications(student_id);
CREATE INDEX idx_applications_scheme     ON applications(scheme_id);
CREATE INDEX idx_applications_status     ON applications(status);
CREATE INDEX idx_applications_officer    ON applications(officer_id);
CREATE INDEX idx_applications_submitted  ON applications(submitted_at DESC);


-- ─────────────────────────────────────────────────────────────────────
-- 4. DOCUMENTS  (uploaded supporting documents)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id    UUID REFERENCES applications(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id),

  doc_type          TEXT NOT NULL CHECK (doc_type IN (
    'aadhaar','pan','income_certificate','marks_sheet',
    'bank_passbook','caste_certificate','residence_proof',
    'disability_certificate','photo','signature','other'
  )),

  -- Storage
  file_name         TEXT NOT NULL,
  file_path         TEXT NOT NULL,       -- Supabase Storage path
  file_size_bytes   INT,
  mime_type         TEXT,

  -- Integrity
  file_hash         TEXT NOT NULL,       -- SHA-256 of file content
  ipfs_cid          TEXT,                -- IPFS content ID (on-chain anchor)

  -- AI OCR results
  ocr_extracted     JSONB,               -- extracted text fields
  ocr_confidence    NUMERIC(5,2),
  forgery_score     NUMERIC(5,2),        -- 0=authentic, 100=forged
  is_verified       BOOLEAN DEFAULT FALSE,
  verification_note TEXT,

  -- Blockchain anchor
  on_chain_hash     TEXT,                -- tx hash of hash-anchor transaction

  uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
  verified_at       TIMESTAMPTZ
);

CREATE INDEX idx_documents_application ON documents(application_id);
CREATE INDEX idx_documents_user        ON documents(user_id);
CREATE INDEX idx_documents_doc_type    ON documents(doc_type);
CREATE INDEX idx_documents_verified    ON documents(is_verified);


-- ─────────────────────────────────────────────────────────────────────
-- 5. AI_VERIFICATIONS  (7-layer AI pipeline results)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_verifications (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id          UUID UNIQUE NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  student_id              UUID NOT NULL REFERENCES users(id),

  -- Layer 1: Identity
  l1_aadhaar_verified     BOOLEAN,
  l1_aadhaar_match_score  NUMERIC(5,2),
  l1_liveness_passed      BOOLEAN,
  l1_notes                TEXT,

  -- Layer 2: Document forgery
  l2_docs_verified        BOOLEAN,
  l2_forgery_detected     BOOLEAN DEFAULT FALSE,
  l2_forgery_doc_ids      UUID[],        -- which docs flagged
  l2_ocr_confidence       NUMERIC(5,2),
  l2_notes                TEXT,

  -- Layer 3: Duplicate check
  l3_duplicate_found      BOOLEAN DEFAULT FALSE,
  l3_duplicate_app_ids    UUID[],        -- matching application IDs
  l3_similarity_score     NUMERIC(5,2),
  l3_notes                TEXT,

  -- Layer 4: Income validation
  l4_income_verified      BOOLEAN,
  l4_declared_income      NUMERIC(15,2),
  l4_verified_income      NUMERIC(15,2),
  l4_income_mismatch_pct  NUMERIC(5,2),
  l4_notes                TEXT,

  -- Layer 5: Academic/eligibility
  l5_marks_verified       BOOLEAN,
  l5_gpa_verified         NUMERIC(4,2),
  l5_institution_accredited BOOLEAN,
  l5_notes                TEXT,

  -- Layer 6: Bank account
  l6_bank_verified        BOOLEAN,
  l6_account_holder_match BOOLEAN,
  l6_ifsc_valid           BOOLEAN,
  l6_notes                TEXT,

  -- Layer 7: On-chain proof
  l7_proof_anchored       BOOLEAN DEFAULT FALSE,
  l7_proof_tx_hash        TEXT,
  l7_proof_ipfs_cid       TEXT,

  -- Overall result
  overall_trust_score     NUMERIC(5,2) NOT NULL DEFAULT 0,
  overall_status          TEXT NOT NULL DEFAULT 'pending' CHECK (overall_status IN (
    'pending','passed','failed','manual_review'
  )),
  failure_reasons         TEXT[],
  processing_time_ms      INT,

  -- Metadata
  model_version           TEXT DEFAULT 'v1.0',
  verified_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_verif_application ON ai_verifications(application_id);
CREATE INDEX idx_ai_verif_student     ON ai_verifications(student_id);
CREATE INDEX idx_ai_verif_status      ON ai_verifications(overall_status);
CREATE INDEX idx_ai_verif_score       ON ai_verifications(overall_trust_score);


-- ─────────────────────────────────────────────────────────────────────
-- 6. TOKENS  (individual scholarship tokens)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tokens (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Blockchain identity
  token_contract_address TEXT NOT NULL,
  on_chain_token_id      TEXT NOT NULL,   -- token ID on chain
  token_standard         TEXT DEFAULT 'ERC-20',
  chain_id               INT DEFAULT 1,   -- 1=mainnet, 137=polygon, etc.

  -- Linkage
  scheme_id             UUID NOT NULL REFERENCES schemes(id),
  application_id        UUID UNIQUE REFERENCES applications(id),
  student_id            UUID NOT NULL REFERENCES users(id),

  -- Value
  amount_inr            NUMERIC(12,2) NOT NULL,
  amount_tokens         NUMERIC(18,8) NOT NULL,  -- on-chain token units

  -- Status flow: queued → minting → minted → distributed → redeemed | expired | revoked
  status                TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued','minting','minted','distributed','redeemed','expired','revoked'
  )),

  -- Lifecycle timestamps + tx hashes
  minted_tx_hash        TEXT,
  minted_at             TIMESTAMPTZ,
  minted_block          BIGINT,

  distributed_tx_hash   TEXT,
  distributed_at        TIMESTAMPTZ,
  distributed_block     BIGINT,
  bridge_batch_id       UUID,

  redeemed_tx_hash      TEXT,
  redeemed_at           TIMESTAMPTZ,
  redeemed_block        BIGINT,
  redeemed_to_account   TEXT,           -- masked bank account

  expiry_at             TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  revoke_reason         TEXT,

  -- IPFS metadata
  metadata_uri          TEXT,           -- token metadata URI (IPFS)
  metadata_hash         TEXT,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(token_contract_address, on_chain_token_id)
);

CREATE INDEX idx_tokens_scheme      ON tokens(scheme_id);
CREATE INDEX idx_tokens_student     ON tokens(student_id);
CREATE INDEX idx_tokens_status      ON tokens(status);
CREATE INDEX idx_tokens_contract    ON tokens(token_contract_address);
CREATE INDEX idx_tokens_minted_at   ON tokens(minted_at DESC);


-- ─────────────────────────────────────────────────────────────────────
-- 7. TRANSACTIONS  (all on-chain token transactions)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Blockchain identity
  tx_hash           TEXT UNIQUE NOT NULL DEFAULT 'pending_' || gen_random_uuid()::text,
  block_number      BIGINT,
  block_timestamp   TIMESTAMPTZ,
  chain_id          INT DEFAULT 1,
  gas_used          BIGINT,
  gas_price_gwei    NUMERIC(20,8),
  tx_fee_eth        NUMERIC(20,8),
  tx_status         TEXT NOT NULL DEFAULT 'pending' CHECK (tx_status IN (
    'pending','confirmed','failed','dropped'
  )),

  -- Transaction type
  tx_type           TEXT NOT NULL CHECK (tx_type IN (
    'scheme_fund_lock',     -- Gov locks funds in smart contract
    'token_mint',           -- Token minted for student
    'bridge_collect',       -- Bridge student collects batch
    'bridge_distribute',    -- Bridge distributes to individual
    'token_redeem',         -- Student redeems to bank
    'token_revoke',         -- Token revoked (fraud)
    'doc_hash_anchor',      -- Document hash anchored on-chain
    'ai_proof_anchor',      -- AI verification proof anchored
    'scheme_close'          -- Scheme closed
  )),

  -- Parties
  from_wallet       TEXT,
  to_wallet         TEXT,
  from_user_id      UUID REFERENCES users(id),
  to_user_id        UUID REFERENCES users(id),

  -- Token / token batch
  token_id          UUID REFERENCES tokens(id),
  token_ids_batch   UUID[],             -- for batch transactions
  amount_inr        NUMERIC(15,2),
  amount_tokens     NUMERIC(18,8),

  -- Context
  scheme_id         UUID REFERENCES schemes(id),
  application_id    UUID REFERENCES applications(id),
  bridge_batch_id   UUID,

  -- For document/AI hash anchors
  document_hash     TEXT,
  ipfs_cid          TEXT,

  -- Raw calldata (for audit)
  calldata_hex      TEXT,
  event_signature   TEXT,

  -- Internal metadata
  initiated_by      UUID REFERENCES users(id),
  notes             TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_hash         ON transactions(tx_hash);
CREATE INDEX idx_transactions_type         ON transactions(tx_type);
CREATE INDEX idx_transactions_from_user    ON transactions(from_user_id);
CREATE INDEX idx_transactions_to_user      ON transactions(to_user_id);
CREATE INDEX idx_transactions_token        ON transactions(token_id);
CREATE INDEX idx_transactions_scheme       ON transactions(scheme_id);
CREATE INDEX idx_transactions_block        ON transactions(block_number DESC);
CREATE INDEX idx_transactions_timestamp    ON transactions(block_timestamp DESC);


-- ─────────────────────────────────────────────────────────────────────
-- 8. BRIDGE_BATCHES  (batch distribution via bridge student)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bridge_batches (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id           UUID NOT NULL REFERENCES schemes(id),
  batch_number        INT NOT NULL,

  -- Bridge student who executes the batch
  bridge_student_id   UUID NOT NULL REFERENCES users(id),

  -- Authorisation (multi-sig requirement)
  authorised_by_officer   UUID REFERENCES users(id),
  authorised_by_validator UUID REFERENCES users(id),
  officer_sig         TEXT,
  validator_sig       TEXT,
  authorised_at       TIMESTAMPTZ,

  -- Batch contents
  token_ids           UUID[] NOT NULL,  -- all token IDs in this batch
  total_tokens        INT NOT NULL,
  total_amount_inr    NUMERIC(15,2) NOT NULL,
  beneficiary_wallets TEXT[],           -- wallet addresses

  -- Execution
  status              TEXT DEFAULT 'pending' CHECK (status IN (
    'pending','authorised','executing','completed','failed','cancelled'
  )),
  collect_tx_hash     TEXT,             -- bridge collects from contract
  distribute_tx_hash  TEXT,             -- bridge distributes to students
  collect_block       BIGINT,
  distribute_block    BIGINT,
  gas_used_total      BIGINT,
  gas_savings_pct     NUMERIC(5,2),

  failure_reason      TEXT,
  executed_at         TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,

  created_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scheme_id, batch_number)
);

CREATE INDEX idx_bridge_batches_scheme ON bridge_batches(scheme_id);
CREATE INDEX idx_bridge_batches_status ON bridge_batches(status);


-- ─────────────────────────────────────────────────────────────────────
-- 9. FRAUD_FLAGS  (AI-detected anomalies)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fraud_flags (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id      UUID REFERENCES applications(id),
  student_id          UUID NOT NULL REFERENCES users(id),
  flagged_by          TEXT NOT NULL DEFAULT 'ai' CHECK (flagged_by IN ('ai','officer','system')),

  flag_type           TEXT NOT NULL CHECK (flag_type IN (
    'identity_mismatch',
    'document_forgery',
    'duplicate_application',
    'income_discrepancy',
    'marks_discrepancy',
    'bank_account_proxy',
    'suspicious_timing',
    'cross_scheme_abuse',
    'biometric_spoof',
    'address_mismatch',
    'manual_flag'
  )),

  severity            TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN (
    'low','medium','high','critical'
  )),

  -- Evidence
  description         TEXT NOT NULL,
  evidence_json       JSONB,            -- structured evidence (doc IDs, scores, etc.)
  confidence_score    NUMERIC(5,2),     -- AI confidence in this flag
  similarity_ref_ids  UUID[],           -- matching application IDs for duplicates

  -- Resolution
  is_resolved         BOOLEAN DEFAULT FALSE,
  resolution          TEXT CHECK (resolution IN (
    'confirmed_fraud','false_positive','needs_review',NULL
  )),
  resolved_by         UUID REFERENCES users(id),
  resolved_at         TIMESTAMPTZ,
  resolution_notes    TEXT,

  -- Blockchain anchor
  anchored_tx_hash    TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fraud_flags_application ON fraud_flags(application_id);
CREATE INDEX idx_fraud_flags_student     ON fraud_flags(student_id);
CREATE INDEX idx_fraud_flags_type        ON fraud_flags(flag_type);
CREATE INDEX idx_fraud_flags_severity    ON fraud_flags(severity);
CREATE INDEX idx_fraud_flags_resolved    ON fraud_flags(is_resolved);


-- ─────────────────────────────────────────────────────────────────────
-- 10. AUDIT_LOGS  (immutable event log — never updated, only inserted)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  event_id        UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,

  -- What happened
  event_type      TEXT NOT NULL,          -- e.g. 'application.approved'
  entity_type     TEXT NOT NULL,          -- 'application','token','scheme','user',...
  entity_id       UUID NOT NULL,

  -- Who did it
  actor_id        UUID REFERENCES users(id),
  actor_role      TEXT,
  actor_ip        TEXT,
  actor_user_agent TEXT,

  -- Data snapshot
  action          TEXT NOT NULL,          -- human-readable description
  old_data        JSONB,
  new_data        JSONB,
  delta           JSONB,                  -- only the changed fields

  -- Blockchain cross-reference
  tx_hash         TEXT,
  block_number    BIGINT,

  -- Integrity chain (each log entry references previous hash)
  prev_log_hash   TEXT,
  log_hash        TEXT,                   -- SHA-256(event_id||prev_log_hash||data)

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs must NEVER be updated or deleted
CREATE INDEX idx_audit_entity     ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_actor      ON audit_logs(actor_id);
CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_created    ON audit_logs(created_at DESC);


-- ─────────────────────────────────────────────────────────────────────
-- 11. SCHEME_STATS  (materialised stats per scheme — kept in sync by triggers)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheme_stats (
  scheme_id               UUID PRIMARY KEY REFERENCES schemes(id) ON DELETE CASCADE,
  total_applications      INT DEFAULT 0,
  applications_pending    INT DEFAULT 0,
  applications_approved   INT DEFAULT 0,
  applications_rejected   INT DEFAULT 0,
  applications_ai_failed  INT DEFAULT 0,
  tokens_minted           INT DEFAULT 0,
  tokens_distributed      INT DEFAULT 0,
  tokens_redeemed         INT DEFAULT 0,
  tokens_revoked          INT DEFAULT 0,
  total_amount_minted_inr NUMERIC(15,2) DEFAULT 0,
  total_amount_paid_inr   NUMERIC(15,2) DEFAULT 0,
  fraud_flags_open        INT DEFAULT 0,
  fraud_flags_resolved    INT DEFAULT 0,
  avg_trust_score         NUMERIC(5,2) DEFAULT 0,
  last_activity_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────
-- 12. NOTIFICATIONS  (in-app notifications for students + officers)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN (
    'application_submitted','application_approved','application_rejected',
    'ai_verification_passed','ai_verification_failed',
    'token_minted','token_distributed','token_redeemed',
    'fraud_flag_raised','fraud_flag_resolved',
    'scheme_deadline_reminder','new_scheme_available',
    'officer_action_required','system_alert'
  )),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  link            TEXT,                   -- deep link in app
  is_read         BOOLEAN DEFAULT FALSE,
  data            JSONB,                  -- extra contextual data
  entity_type     TEXT,
  entity_id       UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user    ON notifications(user_id, is_read, created_at DESC);


-- ─────────────────────────────────────────────────────────────────────
-- TRIGGERS — updated_at auto-maintenance
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_schemes_updated_at       BEFORE UPDATE ON schemes       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_applications_updated_at  BEFORE UPDATE ON applications  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tokens_updated_at        BEFORE UPDATE ON tokens        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ai_verif_updated_at      BEFORE UPDATE ON ai_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_scheme_stats_updated_at  BEFORE UPDATE ON scheme_stats  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- AUTO-GENERATE application_number
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_application_number()
RETURNS TRIGGER AS $$
DECLARE
  seq INT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq FROM applications;
  NEW.application_number = 'APP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_application_number
  BEFORE INSERT ON applications
  FOR EACH ROW
  WHEN (NEW.application_number IS NULL)
  EXECUTE FUNCTION generate_application_number();


-- ─────────────────────────────────────────────────────────────────────
-- SCHEME_STATS auto-upsert on application insert
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_scheme_stats_on_application()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO scheme_stats (scheme_id, total_applications, applications_pending)
    VALUES (NEW.scheme_id, 1, 1)
  ON CONFLICT (scheme_id) DO UPDATE
    SET total_applications = scheme_stats.total_applications + 1,
        applications_pending = scheme_stats.applications_pending + 1,
        last_activity_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scheme_stats_on_app
  AFTER INSERT ON applications
  FOR EACH ROW
  EXECUTE FUNCTION upsert_scheme_stats_on_application();


-- ─────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Phase 1 (dev): open-access policies for anon + authenticated roles.
-- Previous recursive policies (EXISTS SELECT FROM users within users
-- policy) caused infinite recursion. Replaced with flat USING (true).
-- Tighten with auth.uid() checks once Supabase Auth login is wired in.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE schemes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_flags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheme_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_users"         ON users            FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_schemes"       ON schemes          FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_applications"  ON applications     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_documents"     ON documents        FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_ai_verif"      ON ai_verifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_tokens"        ON tokens           FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_transactions"  ON transactions     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_bridge"        ON bridge_batches   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_fraud"         ON fraud_flags      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_audit"         ON audit_logs       FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_stats"         ON scheme_stats     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_notifications" ON notifications    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────
-- SEED: Initial data (demo officer + test scheme)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO users (id, role, full_name, email, officer_id, department, wallet_address, is_active)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'gov_officer',
  'Govt. Officer (Demo)',
  'officer@expressscheme.gov',
  'OFF-2026-001',
  'Ministry of Education',
  '0x1234567890abcdef1234567890abcdef12345678',
  true
) ON CONFLICT DO NOTHING;

INSERT INTO users (id, role, full_name, email, aadhaar_last4, pan_display,
  bank_account_last4, bank_ifsc, bank_name, institution_name, course, gpa,
  wallet_address, is_ai_verified, ai_trust_score, is_active)
VALUES (
  'bbbbbbbb-0000-0000-0000-000000000002',
  'student',
  'Priya Kumari',
  'priya@student.in',
  '7890',
  'ABCPK1234F',
  '5678',
  'SBIN0001234',
  'State Bank of India',
  'IIT Delhi',
  'B.Tech Computer Science',
  8.7,
  '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  true,
  87.0,
  true
) ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
--  END OF SCHEMA
-- ═══════════════════════════════════════════════════════════════════════
