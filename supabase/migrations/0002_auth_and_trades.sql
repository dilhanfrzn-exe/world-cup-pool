-- ============================================================================
-- World Cup Pool — auth identity + peer-to-peer trading
-- ----------------------------------------------------------------------------
-- Run this AFTER 0001_init.sql in the Supabase SQL Editor.
--
-- Adds:
--   * players.user_id  -> links a player to a Supabase Auth account
--   * pools.created_by -> the auth user who created the pool (the host)
--   * trades + trade_items -> peer-to-peer multi-team trades
--
-- Security note: RLS stays enabled with no public policies. All access is via
-- the server-side service-role client; identity comes from Supabase Auth.
-- ============================================================================

-- --- Identity links ---------------------------------------------------------
alter table public.players
  add column if not exists user_id uuid references auth.users (id) on delete set null;

-- A given auth user can hold at most one player per pool.
create unique index if not exists players_pool_user_unique
  on public.players (pool_id, user_id)
  where user_id is not null;

alter table public.pools
  add column if not exists created_by uuid references auth.users (id) on delete set null;

-- --- Trades -----------------------------------------------------------------
create table if not exists public.trades (
  id                  uuid primary key default gen_random_uuid(),
  pool_id             uuid not null references public.pools (id) on delete cascade,
  proposer_player_id  uuid not null references public.players (id) on delete cascade,
  receiver_player_id  uuid not null references public.players (id) on delete cascade,
  status              text not null default 'pending'
                        check (status in
                          ('pending', 'accepted', 'rejected', 'cancelled', 'voided')),
  message             text,
  created_at          timestamptz not null default now(),
  responded_at        timestamptz
);
create index if not exists trades_pool_id_idx on public.trades (pool_id);
create index if not exists trades_receiver_idx on public.trades (receiver_player_id);
create index if not exists trades_proposer_idx on public.trades (proposer_player_id);

-- Each team offered in a trade, tagged with its current owner (from_player_id).
create table if not exists public.trade_items (
  id             uuid primary key default gen_random_uuid(),
  trade_id       uuid not null references public.trades (id) on delete cascade,
  team_id        uuid not null references public.teams (id) on delete cascade,
  from_player_id uuid not null references public.players (id) on delete cascade,
  created_at     timestamptz not null default now()
);
create index if not exists trade_items_trade_id_idx on public.trade_items (trade_id);

alter table public.trades       enable row level security;
alter table public.trade_items  enable row level security;
