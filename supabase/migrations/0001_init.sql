-- ============================================================================
-- World Cup Pool — initial schema
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor (or via the Supabase CLI) once.
--
-- Security model for the MVP (no login):
--   * Row Level Security (RLS) is ENABLED on every table with NO public
--     policies. This means the public `anon` key cannot read or write directly.
--   * All reads/writes go through Next.js server actions/components using the
--     `service_role` key, which bypasses RLS. The service key never reaches the
--     browser.
--   * When you add Supabase Auth later, add scoped policies and switch the app
--     to the anon key + user sessions.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- pools
-- ---------------------------------------------------------------------------
create table if not exists public.pools (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  buy_in           numeric(10, 2) not null default 0,
  num_players      integer not null default 0,
  draw_type        text not null default 'random'
                     check (draw_type in ('random', 'tiered', 'auction')),
  payout_structure text not null default 'winner_take_all'
                     check (payout_structure in ('winner_take_all', 'top_3')),
  room_code        text not null unique,
  admin_token      uuid not null default gen_random_uuid(),
  status           text not null default 'open'
                     check (status in ('open', 'drawn', 'active', 'complete')),
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  pool_id    uuid not null references public.pools (id) on delete cascade,
  name       text not null,
  nickname   text,
  paid       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists players_pool_id_idx on public.players (pool_id);

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id           uuid primary key default gen_random_uuid(),
  pool_id      uuid not null references public.pools (id) on delete cascade,
  name         text not null,
  country_code text,
  tier         integer not null default 1,
  flag         text,
  created_at   timestamptz not null default now(),
  unique (pool_id, name)
);
create index if not exists teams_pool_id_idx on public.teams (pool_id);

-- ---------------------------------------------------------------------------
-- team_assignments — which player owns which team (each team once per pool)
-- ---------------------------------------------------------------------------
create table if not exists public.team_assignments (
  id         uuid primary key default gen_random_uuid(),
  pool_id    uuid not null references public.pools (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (pool_id, team_id)
);
create index if not exists team_assignments_pool_id_idx on public.team_assignments (pool_id);
create index if not exists team_assignments_player_id_idx on public.team_assignments (player_id);

-- ---------------------------------------------------------------------------
-- scoring_rules — points per pool (seeded with defaults on pool creation)
-- ---------------------------------------------------------------------------
create table if not exists public.scoring_rules (
  id         uuid primary key default gen_random_uuid(),
  pool_id    uuid not null references public.pools (id) on delete cascade,
  rule_key   text not null,
  points     integer not null default 0,
  created_at timestamptz not null default now(),
  unique (pool_id, rule_key)
);
create index if not exists scoring_rules_pool_id_idx on public.scoring_rules (pool_id);

-- ---------------------------------------------------------------------------
-- team_results — manually updated by the host
-- ---------------------------------------------------------------------------
create table if not exists public.team_results (
  id              uuid primary key default gen_random_uuid(),
  pool_id         uuid not null references public.pools (id) on delete cascade,
  team_id         uuid not null references public.teams (id) on delete cascade,
  group_wins      integer not null default 0,
  group_draws     integer not null default 0,
  group_losses    integer not null default 0,
  knockout_stage  text not null default 'none'
                    check (knockout_stage in
                      ('none', 'r32', 'r16', 'qf', 'sf', 'runner_up', 'champion')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (pool_id, team_id)
);
create index if not exists team_results_pool_id_idx on public.team_results (pool_id);

-- ---------------------------------------------------------------------------
-- standings view — convenience read model using DEFAULT scoring values.
-- The app computes authoritative standings from `scoring_rules` in code so
-- per-pool overrides are respected, but this view is handy for quick queries.
-- ---------------------------------------------------------------------------
create or replace view public.standings as
with team_points as (
  select
    t.pool_id,
    t.id as team_id,
    coalesce(r.group_wins, 0) * 3
      + coalesce(r.group_draws, 0) * 1
      + case coalesce(r.knockout_stage, 'none')
          when 'r32'       then 5
          when 'r16'       then 10
          when 'qf'        then 20
          when 'sf'        then 30
          when 'runner_up' then 40
          when 'champion'  then 60
          else 0
        end as points
  from public.teams t
  left join public.team_results r on r.team_id = t.id
)
select
  p.pool_id,
  p.id           as player_id,
  p.name         as player_name,
  p.nickname,
  p.paid,
  count(a.team_id)                       as team_count,
  coalesce(sum(tp.points), 0)            as total_points
from public.players p
left join public.team_assignments a on a.player_id = p.id
left join team_points tp on tp.team_id = a.team_id
group by p.pool_id, p.id, p.name, p.nickname, p.paid;

-- ---------------------------------------------------------------------------
-- Enable RLS (no policies = locked to service_role only). See header note.
-- ---------------------------------------------------------------------------
alter table public.pools            enable row level security;
alter table public.players          enable row level security;
alter table public.teams            enable row level security;
alter table public.team_assignments enable row level security;
alter table public.scoring_rules    enable row level security;
alter table public.team_results     enable row level security;
