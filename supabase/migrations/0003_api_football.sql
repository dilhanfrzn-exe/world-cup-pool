-- ============================================================================
-- World Cup Pool — API-Football integration
-- ----------------------------------------------------------------------------
-- Run this AFTER 0002_auth_and_trades.sql in the Supabase SQL Editor.
--
-- Adds the pieces needed to auto-sync World Cup results from API-Football:
--   * teams.api_football_team_id / logo_url -> link a local team to its
--     API-Football team and show its crest.
--   * team_results.source / last_synced_at  -> track whether a team's record
--     came from the API or a manual edit, and when it last synced.
--   * team_results manual-override fields    -> let the host pin a team's record
--     so the API sync leaves it alone (delayed/incorrect data, custom scoring).
--   * fixtures      -> per-pool snapshot of World Cup matches from API-Football.
--   * api_sync_logs -> an audit trail of every sync run (success or failure).
--
-- Group records and knockout progress still live in team_results, which the app
-- already reads to compute standings. The sync RECALCULATES those rows from
-- finished fixtures, so the existing manual flow and scoring code keep working.
--
-- Security note: RLS stays enabled with no public policies. All access is via
-- the server-side service-role client.
-- ============================================================================

-- --- teams: link to API-Football -------------------------------------------
alter table public.teams
  add column if not exists api_football_team_id bigint,
  add column if not exists logo_url             text,
  add column if not exists last_synced_at       timestamptz;

create index if not exists teams_api_football_team_id_idx
  on public.teams (api_football_team_id);

-- --- team_results: sync metadata + manual override --------------------------
alter table public.team_results
  add column if not exists source                  text not null default 'manual'
                             check (source in ('manual', 'api')),
  add column if not exists last_synced_at          timestamptz,
  add column if not exists manual_override_enabled boolean not null default false,
  add column if not exists manual_points_override  integer,
  add column if not exists manual_round_override   text;

-- --- fixtures: per-pool snapshot of World Cup matches -----------------------
create table if not exists public.fixtures (
  id                      uuid primary key default gen_random_uuid(),
  pool_id                 uuid not null references public.pools (id) on delete cascade,
  api_football_fixture_id bigint not null,
  league_id               integer not null,
  season                  integer not null,
  round                   text,
  status_short            text,
  status_long             text,
  kickoff_at              timestamptz,
  home_team_api_id        bigint,
  away_team_api_id        bigint,
  home_team_name          text,
  away_team_name          text,
  home_goals              integer,
  away_goals              integer,
  winner_team_api_id      bigint,
  is_finished             boolean not null default false,
  last_synced_at          timestamptz,
  created_at              timestamptz not null default now(),
  unique (pool_id, api_football_fixture_id)
);
create index if not exists fixtures_pool_id_idx on public.fixtures (pool_id);

-- --- api_sync_logs: audit trail of sync runs --------------------------------
create table if not exists public.api_sync_logs (
  id           uuid primary key default gen_random_uuid(),
  pool_id      uuid references public.pools (id) on delete cascade,
  sync_type    text not null,
  status       text not null default 'running'
                 check (status in ('running', 'success', 'partial', 'error')),
  message      text,
  started_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists api_sync_logs_pool_id_idx on public.api_sync_logs (pool_id);

-- --- RLS (no public policies = service-role only). See header note. ---------
alter table public.fixtures      enable row level security;
alter table public.api_sync_logs enable row level security;
