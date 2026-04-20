-- Migration A: source optionality + role deal cockpit columns

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source      text NOT NULL DEFAULT 'wren';

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS external_id     text,
  ADD COLUMN IF NOT EXISTS source          text NOT NULL DEFAULT 'wren',
  ADD COLUMN IF NOT EXISTS target_comp_min integer,
  ADD COLUMN IF NOT EXISTS target_comp_max integer,
  ADD COLUMN IF NOT EXISTS openings        integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS formatted_jd    text;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source      text NOT NULL DEFAULT 'wren';
