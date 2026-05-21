/*
 * src/lib/buildVersion.js — Build version constant for action card lifecycle
 *
 * Imported by server-side action writers (agent-loop-runner.js, ingest-email.js)
 * and by the Desk query filter (Desk.jsx). Safe to import from both environments —
 * no Node.js builtins, no dependencies.
 *
 * Bump this integer to obsolete action cards from prior builds:
 *   1. Increment BUILD_VERSION here.
 *   2. Deploy. New action rows are written with the new version.
 *   3. Desk.jsx's .eq('build_version', BUILD_VERSION) filter excludes old rows
 *      automatically — no immediate DB cleanup required.
 *   4. Run scripts/cleanup_ghost_actions.sql (adapted for the new version) at
 *      your convenience to remove the old rows from the DB.
 *
 * DO NOT bump without deploying — bumping locally without deploying means the
 * agent loop on Vercel still writes the old version and cards disappear from
 * the Desk immediately on refresh.
 */

export const BUILD_VERSION = 1
