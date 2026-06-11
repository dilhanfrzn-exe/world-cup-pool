# ⚽️ World Cup Pool

A website (no app download) for running a World Cup team draw with friends.
Create a pool, invite people with a room link, run a **fair** draw, **trade
teams** with each other, track tournament points, and manage the prize pot — all
mobile-first.

Built with **Next.js (App Router)**, **Supabase** (Postgres + Auth), **Tailwind
CSS**, deployable on **Vercel**.

## Core flow

```
Log in → Create Pool → Invite Friends → Friends Join → Set Teams → Run Fair Draw → Trade Teams → Track Tournament → Show Prize Pot
```

## Features

- **Accounts** — email + password login via Supabase Auth. Everyone (hosts and players) signs in.
- **Create Pool** — name, buy-in, player count, draw type, payout structure. Generates a unique room code + shareable link.
- **Invite / Join** — share the room link; friends log in and join with their name (and optional nickname).
- **Set Teams** — load 48 pre-seeded World Cup nations across 6 tiers, or add your own.
- **Fair Draw** — two working modes:
  - **Random** — every player gets the same number of teams.
  - **Tiered** — every player gets the same number of teams *from each tier/pot*.
  - Clear errors if there are no players/teams or counts don't divide evenly.
- **Draw Results** — shareable player cards with their assigned teams.
- **Trades** — peer-to-peer, multi-team (uneven allowed). Player A proposes teams to give/get, Player B accepts, and squads swap automatically. Conflicting pending trades are voided.
- **Track Tournament** — auto-sync results from **API-Football** with one click, or enter each team's group W/D/L and furthest knockout stage by hand. Lock individual teams so the sync leaves your manual values alone.
- **Standings** — live leaderboard with rank, teams, points, paid status, and last-synced time.
- **Prize Pot** — buy-in × players, payout breakdown, paid/unpaid tracking (manual; no Stripe/Venmo/Zelle/PayPal yet).
- **Super-admin dashboard** — accounts in an allowlist oversee every pool and have host powers everywhere.

## 3-minute setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Open **Project Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPERADMIN_EMAILS=you@example.com

# Optional — enables auto-syncing World Cup results (see below). Server-only.
API_FOOTBALL_KEY=your-api-football-key
CRON_SECRET=generate-a-long-random-string
```

`SUPERADMIN_EMAILS` is a comma-separated allowlist; those accounts get the
`/dashboard` overview and host powers in every pool.

`API_FOOTBALL_KEY` is **server-only** (no `NEXT_PUBLIC_` prefix) so it never
reaches the browser — all API calls happen in server actions / the cron route.
Leave it unset to keep using the manual results flow.

### 4. Create the database schema

Open the **Supabase SQL Editor** and run, in order:

1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — core tables, `standings` view, default scoring rules.
2. [`supabase/migrations/0002_auth_and_trades.sql`](supabase/migrations/0002_auth_and_trades.sql) — auth identity links (`players.user_id`, `pools.created_by`) and the `trades` / `trade_items` tables.
3. [`supabase/migrations/0003_api_football.sql`](supabase/migrations/0003_api_football.sql) — API-Football fields on `teams`/`team_results`, plus the `fixtures` and `api_sync_logs` tables.

### 5. Configure Auth

In the Supabase dashboard → **Authentication → Providers → Email**, make sure
email/password is enabled. For instant local testing, **turn off "Confirm
email"** (Authentication → Sign In / Providers) so new accounts can log in
immediately. Leave it on in production if you want verified emails.

### 6. Run it

```bash
npm run dev
```

Open <http://localhost:3000>, sign up, create a pool, and share the link.

## How hosting / admin works

- Login is **email + password** (Supabase Auth). Everyone signs in.
- The person who **creates** a pool is its **host** (`pools.created_by`) and sees
  admin controls (add teams/players, run the draw, update results, mark paid).
- Accounts in `SUPERADMIN_EMAILS` are **super-admins**: they get the `/dashboard`
  overview of all pools and host powers in every room.
- The **room link** (`/room/ABC123`) is what you share. Friends log in and join
  with their name; each account can hold one player per pool.

## Trading

Once the draw has run, players use the **Trade** tab:

1. A player picks teams to **give** (their own) and **get** (the other player's), with an optional message.
2. The other player **accepts** or **rejects**. On accept, `team_assignments` are reassigned and standings update automatically.
3. Multi-team and **uneven** trades (e.g. 2-for-1) are allowed — the form warns that team counts will change.
4. If the underlying teams changed since a trade was proposed, accepting safely **voids** it; accepting one trade also voids other pending trades touching the same teams.

## Database schema

| Table | Purpose |
| --- | --- |
| `pools` | Pool config, room code, `created_by` host, status |
| `players` | Pool members, `user_id` link to an auth account, paid status |
| `teams` | Teams per pool with tier + flag |
| `team_assignments` | Which player owns which team (each team once per pool) |
| `scoring_rules` | Per-pool points (seeded with defaults) |
| `team_results` | Group record + knockout stage (from sync or manual edit), sync metadata, manual-override flags |
| `fixtures` | Per-pool snapshot of World Cup matches from API-Football |
| `api_sync_logs` | Audit trail of every sync run (success / partial / error) |
| `trades` | Peer-to-peer trade proposals + status |
| `trade_items` | Teams in each trade, tagged with the offering player |
| `standings` (view) | Convenience read model of points per player |

All tables use UUID primary keys, foreign keys with `on delete cascade`, and
`created_at` timestamps. RLS is enabled with no public policies — the app
reaches the DB only via the server-side `service_role` key, so the anon key
never has direct write access. **Auth** uses the anon key + cookies (via
`@supabase/ssr`) purely to establish identity; authorization (host /
super-admin / player) is enforced in server actions.

## Default scoring

| Event | Points |
| --- | --- |
| Group stage win | 3 |
| Group stage draw | 1 |
| Round of 32 | 5 |
| Round of 16 | 10 |
| Quarterfinal | 20 |
| Semifinal | 30 |
| Runner-up | 40 |
| Champion | 60 |

Stored per-pool in `scoring_rules`, so they're editable later without code
changes.

## Auto-syncing results (API-Football)

With `API_FOOTBALL_KEY` set, the host sees a **Sync World Cup results** button on
the admin page. A sync:

1. Links each local team to its API-Football team id (alias-aware name match) and stores its crest.
2. Pulls every World Cup fixture (`league=1`, `season=2026`) and upserts it per pool.
3. **Recalculates** each team's group W/D/L and furthest knockout stage *from the finished fixtures* — so re-running never double-counts.
4. Recomputes team points (using the pool's `scoring_rules`) and the player leaderboard.
5. Logs the run to `api_sync_logs`; the admin and standings pages show the last-synced time and status.

The configurable bits live behind env vars: `API_FOOTBALL_LEAGUE_ID` (default
`1`), `API_FOOTBALL_SEASON` (default `2026`), and `API_FOOTBALL_BASE_URL`.

**Manual override / fallback** — the host can still edit any team's record by
hand. Tick **"Lock this team"** to pin it; the sync then skips that team
(useful for delayed/incorrect API data or custom scoring). Untick to let the
sync manage it again.

**Scheduled sync (optional)** — `app/api/cron/sync/route.ts` is ready for
[Vercel Cron](https://vercel.com/docs/cron-jobs). It's not enabled by default;
to turn it on, add a `vercel.json` and set `CRON_SECRET`:

```json
{ "crons": [{ "path": "/api/cron/sync", "schedule": "0 * * * *" }] }
```

Vercel calls it with `Authorization: Bearer <CRON_SECRET>`. The route syncs
every pool that has started.

**Pure, tested core** — round-name mapping, team matching, and result
recalculation are pure functions in `lib/api-football/` with unit tests:

```bash
npm test
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com).
3. Add the same env vars (set `NEXT_PUBLIC_APP_URL` to your Vercel domain).
4. Deploy. Share links as `https://your-domain/room/CODE`.

## Built to grow

The code is structured so these can be added later without a rewrite:

- Full **RLS** migration to drop the service-role key for writes.
- **Realtime** trade/standings updates (`lib/supabase/browser.ts` is ready).
- A **spinning-wheel** draw animation (draw logic in `lib/draw.ts` is pure).
- **Payments** integration (payout math lives in `lib/utils.ts`).
- **Auction** draw mode (already a first-class `draw_type`).
- Host-approval step on trades, OAuth providers, multiple tournaments.

## Project structure

```
app/
  page.tsx                 # Home
  login/page.tsx           # Email + password auth
  dashboard/page.tsx       # Super-admin: all pools
  create/page.tsx          # Create pool (login required)
  room/[code]/page.tsx     # Room hub (players, teams, draw)
  room/[code]/results/     # Draw results
  room/[code]/trade/       # Propose / accept / reject trades
  room/[code]/standings/   # Leaderboard + prize pot
  room/[code]/admin/       # Sync + update results + payments
  api/cron/sync/route.ts   # Optional scheduled sync (Vercel Cron)
middleware.ts              # Refreshes the Supabase auth session
components/                # UI + forms + trade widgets (client where needed)
lib/
  actions.ts               # Server actions (mutations, incl. sync + trades)
  auth.ts                  # Roles: host / super-admin / player
  auth-actions.ts          # Sign in / up / out
  data.ts                  # Server reads
  draw.ts                  # Fair draw logic (pure)
  trades.ts                # Trade view-model helpers (pure)
  scoring.ts               # Scoring rules + points math
  standings.ts             # Leaderboard computation
  teams.ts                 # 48-team seed + flag helper
  utils.ts                 # Room codes, money, payouts, dates
  api-football/
    client.ts              # Authenticated API-Football client (server only)
    types.ts               # API response + internal round types
    rounds.ts              # Round-name normalization (pure)
    team-match.ts          # Alias-aware team name matching (pure)
    recalc.ts              # Recompute records/knockout/points (pure)
    sync.ts                # Sync orchestration (server only)
    __tests__/             # Unit tests for the pure helpers
  supabase/server.ts       # Service-role client (server only)
  supabase/auth-server.ts  # Cookie-based auth client (server only)
  supabase/browser.ts      # Browser client (future realtime)
supabase/migrations/       # SQL schema (0001 core, 0002 auth+trades, 0003 API-Football)
```
