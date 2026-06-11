-- ============================================================================
-- World Cup Pool — Matchups feature
-- ----------------------------------------------------------------------------
-- Run this AFTER 0003_api_football.sql in the Supabase SQL Editor.
--
-- The "Matchups" tab shows every World Cup fixture (today / previous / upcoming)
-- with the pool player who owns each team. Almost everything it needs already
-- lives in the `fixtures` table from 0003; this migration just adds the few
-- columns the richer matchup cards rely on, plus an optional convenience view.
--
--   * fixtures.venue_name / venue_city      -> show where a match is played.
--   * fixtures.loser_team_api_id            -> the losing side once finished.
--   * fixtures.is_draw                      -> finished + tied + no PK winner.
--   * fixtures.included_in_standings        -> finished fixtures feed standings.
--   * fixtures.updated_at                   -> last write (sync or manual edit).
--   * pool_matchups_view                    -> fixtures pre-joined to the local
--                                              teams, assignments and owners so
--                                              ad-hoc queries / future API routes
--                                              don't have to repeat the joins.
--
-- "Previous matchups" need no separate table: they're just stored fixtures with
-- a kickoff before today and is_finished = true.
--
-- Security note: RLS stays enabled on `fixtures` with no public policies; all
-- access is via the server-side service-role client. The view inherits the base
-- table's access (it's only ever read server-side).
-- ============================================================================

-- --- fixtures: matchup-specific columns ------------------------------------
alter table public.fixtures
  add column if not exists venue_name            text,
  add column if not exists venue_city            text,
  add column if not exists loser_team_api_id     bigint,
  add column if not exists is_draw               boolean not null default false,
  add column if not exists included_in_standings boolean not null default false,
  add column if not exists updated_at            timestamptz not null default now();

-- Fast "matches in a date window for this pool" lookups (today/previous/upcoming).
create index if not exists fixtures_pool_kickoff_idx
  on public.fixtures (pool_id, kickoff_at);

-- --- pool_matchups_view: fixtures + teams + owners --------------------------
-- One row per stored fixture, enriched with each side's local team and the
-- player who owns it (NULL until the draw runs / the team links to API-Football).
create or replace view public.pool_matchups_view as
select
  f.id                       as fixture_id,
  f.pool_id,
  f.api_football_fixture_id,
  f.league_id,
  f.season,
  f.round,
  f.status_short,
  f.status_long,
  f.kickoff_at,
  f.venue_name,
  f.venue_city,
  f.home_team_api_id,
  f.away_team_api_id,
  f.home_team_name,
  f.away_team_name,
  f.home_goals,
  f.away_goals,
  f.winner_team_api_id,
  f.loser_team_api_id,
  f.is_draw,
  f.is_finished,
  f.included_in_standings,
  f.last_synced_at,
  f.updated_at,
  -- home side
  ht.id     as home_local_team_id,
  ht.flag   as home_team_flag,
  ht.logo_url as home_team_logo,
  hp.id     as home_owner_id,
  hp.name   as home_owner_name,
  hp.nickname as home_owner_nickname,
  -- away side
  at.id     as away_local_team_id,
  at.flag   as away_team_flag,
  at.logo_url as away_team_logo,
  ap.id     as away_owner_id,
  ap.name   as away_owner_name,
  ap.nickname as away_owner_nickname
from public.fixtures f
left join public.teams ht
  on ht.pool_id = f.pool_id and ht.api_football_team_id = f.home_team_api_id
left join public.team_assignments hta
  on hta.pool_id = f.pool_id and hta.team_id = ht.id
left join public.players hp
  on hp.id = hta.player_id
left join public.teams at
  on at.pool_id = f.pool_id and at.api_football_team_id = f.away_team_api_id
left join public.team_assignments ata
  on ata.pool_id = f.pool_id and ata.team_id = at.id
left join public.players ap
  on ap.id = ata.player_id;
