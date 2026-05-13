-- Phase 4 sliced — Gmail send only
-- Adds Gmail OAuth token columns to recruiters for approval-gated send flow.
-- Access token + expiry stored for request-time refresh.
-- Refresh token stored for long-lived access (never expires unless revoked).

alter table recruiters
  add column gmail_access_token  text,
  add column gmail_refresh_token text,
  add column gmail_token_expiry  timestamptz;
