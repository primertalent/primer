-- Add high end of expected comp range to pipeline entries.
-- expected_comp remains the low/single value; expected_comp_high is nullable.
-- Pipeline value calculations use midpoint when both are set.

ALTER TABLE pipeline ADD COLUMN IF NOT EXISTS expected_comp_high numeric;
