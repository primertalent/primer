ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS agreement_external_label text,
  ADD COLUMN IF NOT EXISTS agreement_external_url   text,
  ADD COLUMN IF NOT EXISTS agreement_status         text DEFAULT 'missing';
