-- Fix broken RLS on screener_results.
-- The original policy (20260414000001) referenced auth_user_id but the
-- recruiters table column is user_id. This caused every insert and select
-- on screener_results to fail RLS silently.

drop policy if exists "screener_results: own data" on screener_results;

create policy "screener_results: own data"
  on screener_results for all
  using (recruiter_id = current_recruiter_id());
