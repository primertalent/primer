-- Migration B: agreements table, candidate_imports table, FK links

CREATE TABLE IF NOT EXISTS agreements (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id          uuid        NOT NULL REFERENCES recruiters(id),
  client_id             uuid        REFERENCES clients(id),
  role_id               uuid        REFERENCES roles(id),
  storage_path          text,
  parsed_terms          jsonb,
  fee_pct               numeric,
  fee_flat              numeric,
  refund_clause         text,
  exclusivity           boolean,
  replacement_guarantee boolean,
  payment_terms         text,
  effective_date        date,
  expiration_date       date,
  reviewed              boolean     NOT NULL DEFAULT false,
  source                text        NOT NULL DEFAULT 'wren',
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recruiter owns agreements"
  ON agreements FOR ALL
  USING  (recruiter_id = current_recruiter_id())
  WITH CHECK (recruiter_id = current_recruiter_id());

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS agreement_id uuid REFERENCES agreements(id);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS default_agreement_id uuid REFERENCES agreements(id);

CREATE TABLE IF NOT EXISTS candidate_imports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id    uuid        NOT NULL REFERENCES recruiters(id),
  import_type     text,
  status          text        NOT NULL DEFAULT 'pending',
  row_count       integer,
  processed_count integer     NOT NULL DEFAULT 0,
  error_count     integer     NOT NULL DEFAULT 0,
  report          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE candidate_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recruiter owns imports"
  ON candidate_imports FOR ALL
  USING  (recruiter_id = current_recruiter_id())
  WITH CHECK (recruiter_id = current_recruiter_id());
