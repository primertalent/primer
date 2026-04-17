-- Placement fee on roles (percentage or flat)
alter table roles
  add column placement_fee_pct  decimal,
  add column placement_fee_flat integer;

-- Expected comp per pipeline entry (annual base, dollars)
alter table pipeline
  add column expected_comp integer;

-- Recruiter default fee, auto-fills new roles
alter table recruiters
  add column default_placement_fee_pct decimal;
