-- Google OAuth read-scope expansion (Session A)
-- Records the space-delimited scope set Google actually granted at the last token
-- exchange, so read features can tell which capabilities a recruiter's stored token
-- covers without a network probe.
--
-- Nullable, no backfill: NULL means a pre-expansion (send-only) token that predates
-- this column. Consumers treat NULL as "no read scopes granted." Written by
-- api/google-auth.js on every code exchange (tokens.scope).

alter table recruiters add column google_scopes text;
