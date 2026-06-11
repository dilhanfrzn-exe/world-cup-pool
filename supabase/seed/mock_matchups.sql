-- ============================================================================
-- World Cup Pool — MOCK data for testing the Matchups feature ONLY
-- ----------------------------------------------------------------------------
-- Paste this into the Supabase SQL Editor (it runs as the service role, which
-- bypasses RLS). Requires migrations 0001–0004 to be applied first.
--
-- What it does (all isolated — touches nothing else):
--   * Creates a throwaway sandbox pool with room code  MOCK01
--   * Adds 4 players, 8 teams (already linked to synthetic API-Football ids),
--     a finished draw, and default scoring rules
--   * Inserts 9 fixtures with kickoff times RELATIVE TO now() so they land in
--     the Today (live / upcoming / completed), Previous, and Upcoming tabs
--   * Seeds team_results so the Standings tab matches the finished fixtures
--
-- It is safe to re-run: it deletes any existing MOCK01 pool first (the cascade
-- removes its players/teams/assignments/fixtures/results), then rebuilds it.
--
-- After running, open:   /room/MOCK01/matchups   and   /room/MOCK01/standings
--
-- To remove it when you're done:
--   delete from public.pools where room_code = 'MOCK01';
--
-- NOTE: "Today" is bucketed using the app server's local day; these fixtures are
-- only a few hours from now() so they fall on the right day in any timezone
-- except right at midnight. The synthetic team ids (900001+) and fixture ids
-- (8000001+) are high on purpose so they never collide with real API-Football
-- data if you later sync this pool.
-- ============================================================================

do $$
declare
  v_pool  uuid;
  p_dil   uuid; p_chris uuid; p_laura uuid; p_alex uuid;
  t_arg   uuid; t_jpn   uuid; t_fra   uuid; t_mex  uuid;
  t_bra   uuid; t_esp   uuid; t_eng   uuid; t_ger  uuid;
begin
  -- Clean slate -------------------------------------------------------------
  delete from public.pools where room_code = 'MOCK01';

  -- Pool (created_by NULL = guest-viewable; set it to your auth uid if you want
  -- the host-only "Refresh matchups" button to appear) ----------------------
  insert into public.pools
    (name, buy_in, num_players, draw_type, payout_structure, room_code, status)
  values
    ('MOCK — Matchups Test', 20, 4, 'random', 'top_3', 'MOCK01', 'active')
  returning id into v_pool;

  -- Players -----------------------------------------------------------------
  insert into public.players (pool_id, name, nickname, paid)
    values (v_pool, 'Dilhan', 'Dil', true) returning id into p_dil;
  insert into public.players (pool_id, name, nickname, paid)
    values (v_pool, 'Chris', null, true) returning id into p_chris;
  insert into public.players (pool_id, name, nickname, paid)
    values (v_pool, 'Laura', null, false) returning id into p_laura;
  insert into public.players (pool_id, name, nickname, paid)
    values (v_pool, 'Alex', null, false) returning id into p_alex;

  -- Teams (pre-linked to synthetic API-Football ids so owners resolve) -------
  insert into public.teams (pool_id, name, country_code, tier, flag, api_football_team_id, last_synced_at)
    values (v_pool, 'Argentina', 'AR', 1, '🇦🇷', 900001, now()) returning id into t_arg;
  insert into public.teams (pool_id, name, country_code, tier, flag, api_football_team_id, last_synced_at)
    values (v_pool, 'Japan', 'JP', 3, '🇯🇵', 900002, now()) returning id into t_jpn;
  insert into public.teams (pool_id, name, country_code, tier, flag, api_football_team_id, last_synced_at)
    values (v_pool, 'France', 'FR', 1, '🇫🇷', 900003, now()) returning id into t_fra;
  insert into public.teams (pool_id, name, country_code, tier, flag, api_football_team_id, last_synced_at)
    values (v_pool, 'Mexico', 'MX', 3, '🇲🇽', 900004, now()) returning id into t_mex;
  insert into public.teams (pool_id, name, country_code, tier, flag, api_football_team_id, last_synced_at)
    values (v_pool, 'Brazil', 'BR', 1, '🇧🇷', 900005, now()) returning id into t_bra;
  insert into public.teams (pool_id, name, country_code, tier, flag, api_football_team_id, last_synced_at)
    values (v_pool, 'Spain', 'ES', 1, '🇪🇸', 900006, now()) returning id into t_esp;
  insert into public.teams (pool_id, name, country_code, tier, flag, api_football_team_id, last_synced_at)
    values (v_pool, 'England', 'GB', 2, '🏴', 900007, now()) returning id into t_eng;
  insert into public.teams (pool_id, name, country_code, tier, flag, api_football_team_id, last_synced_at)
    values (v_pool, 'Germany', 'DE', 2, '🇩🇪', 900008, now()) returning id into t_ger;

  -- Draw: 2 teams per player ------------------------------------------------
  insert into public.team_assignments (pool_id, team_id, player_id) values
    (v_pool, t_arg, p_dil),   (v_pool, t_mex, p_dil),
    (v_pool, t_jpn, p_chris), (v_pool, t_bra, p_chris),
    (v_pool, t_fra, p_laura), (v_pool, t_esp, p_laura),
    (v_pool, t_eng, p_alex),  (v_pool, t_ger, p_alex);

  -- Default scoring rules ---------------------------------------------------
  insert into public.scoring_rules (pool_id, rule_key, points) values
    (v_pool, 'group_win', 3), (v_pool, 'group_draw', 1),
    (v_pool, 'r32', 5),       (v_pool, 'r16', 10),
    (v_pool, 'qf', 20),       (v_pool, 'sf', 30),
    (v_pool, 'runner_up', 40),(v_pool, 'champion', 60);

  -- Fixtures ----------------------------------------------------------------
  insert into public.fixtures (
    pool_id, api_football_fixture_id, league_id, season, round,
    status_short, status_long, kickoff_at, venue_name, venue_city,
    home_team_api_id, away_team_api_id, home_team_name, away_team_name,
    home_goals, away_goals, winner_team_api_id, loser_team_api_id,
    is_draw, is_finished, included_in_standings, last_synced_at, updated_at
  ) values
    -- TODAY · completed  (Argentina 2–1 Japan, group win)
    (v_pool, 8000001, 1, 2026, 'Group Stage - 1', 'FT', 'Match Finished',
     now() - interval '3 hours', 'Lusail Stadium', 'Lusail',
     900001, 900002, 'Argentina', 'Japan', 2, 1, 900001, 900002,
     false, true, true, now(), now()),

    -- TODAY · live  (France 1–1 Mexico, 2nd half)
    (v_pool, 8000002, 1, 2026, 'Group Stage - 1', '2H', 'Second Half',
     now() - interval '40 minutes', 'Estadio Azteca', 'Mexico City',
     900003, 900004, 'France', 'Mexico', 1, 1, null, null,
     false, false, false, now(), now()),

    -- TODAY · upcoming  (Brazil vs Spain, with venue)
    (v_pool, 8000003, 1, 2026, 'Group Stage - 2', 'NS', 'Not Started',
     now() + interval '3 hours', 'Maracanã', 'Rio de Janeiro',
     900005, 900006, 'Brazil', 'Spain', null, null, null, null,
     false, false, false, now(), now()),

    -- TODAY · upcoming  (England vs Germany, NO venue -> tests optional venue)
    (v_pool, 8000004, 1, 2026, 'Group Stage - 2', 'NS', 'Not Started',
     now() + interval '5 hours', null, null,
     900007, 900008, 'England', 'Germany', null, null, null, null,
     false, false, false, now(), now()),

    -- TODAY · postponed  (Argentina vs England -> tests postponed badge)
    (v_pool, 8000005, 1, 2026, 'Group Stage - 2', 'PST', 'Match Postponed',
     now() + interval '1 hour', 'Stadium 974', 'Doha',
     900001, 900007, 'Argentina', 'England', null, null, null, null,
     false, false, false, now(), now()),

    -- PREVIOUS · group draw  (Spain 0–0 England, yesterday)
    (v_pool, 8000006, 1, 2026, 'Group Stage - 1', 'FT', 'Match Finished',
     now() - interval '1 day', 'Wembley Stadium', 'London',
     900006, 900007, 'Spain', 'England', 0, 0, null, null,
     true, true, true, now(), now()),

    -- PREVIOUS · knockout  (Brazil 2–0 Germany, 2 days ago, Round of 16)
    (v_pool, 8000007, 1, 2026, 'Round of 16', 'FT', 'Match Finished',
     now() - interval '2 days', 'Allianz Arena', 'Munich',
     900005, 900008, 'Brazil', 'Germany', 2, 0, 900005, 900008,
     false, true, true, now(), now()),

    -- UPCOMING · knockout  (Argentina vs France, tomorrow, Quarter-finals)
    (v_pool, 8000008, 1, 2026, 'Quarter-finals', 'NS', 'Not Started',
     now() + interval '1 day', 'Lusail Stadium', 'Lusail',
     900001, 900003, 'Argentina', 'France', null, null, null, null,
     false, false, false, now(), now()),

    -- UPCOMING · group  (Japan vs Mexico, in 3 days)
    (v_pool, 8000009, 1, 2026, 'Round of 16', 'NS', 'Not Started',
     now() + interval '3 days', null, null,
     900002, 900004, 'Japan', 'Mexico', null, null, null, null,
     false, false, false, now(), now());

  -- Team results -> Standings -----------------------------------------------
  -- These mirror exactly what the API sync's recalc would derive from the
  -- FINISHED fixtures above, so the Standings tab matches the Matchups tab
  -- without calling API-Football (which would overwrite this mock data):
  --   Argentina 2-1 Japan (group) -> ARG win, JPN loss
  --   Spain 0-0 England   (group) -> a draw for each
  --   Brazil 2-0 Germany  (R16)   -> both reached Round of 16
  -- France & Mexico have no finished games yet, so they earn 0 (no row).
  -- With default scoring (win 3 / draw 1 / r16 10) the leaderboard is:
  --   Alex 11 · Chris 10 · Dilhan 3 · Laura 1
  insert into public.team_results
    (pool_id, team_id, group_wins, group_draws, group_losses, knockout_stage,
     source, last_synced_at, updated_at)
  values
    (v_pool, t_arg, 1, 0, 0, 'none', 'api', now(), now()),
    (v_pool, t_jpn, 0, 0, 1, 'none', 'api', now(), now()),
    (v_pool, t_esp, 0, 1, 0, 'none', 'api', now(), now()),
    (v_pool, t_eng, 0, 1, 0, 'none', 'api', now(), now()),
    (v_pool, t_bra, 0, 0, 0, 'r16',  'api', now(), now()),
    (v_pool, t_ger, 0, 0, 0, 'r16',  'api', now(), now());

  raise notice 'Mock pool created. Open /room/MOCK01/matchups and /room/MOCK01/standings';
end $$;
