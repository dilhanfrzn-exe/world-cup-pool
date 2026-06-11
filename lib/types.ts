export interface ActionState {
  error?: string;
  success?: string;
}

export type DrawType = "random" | "tiered" | "auction";
export type PayoutStructure = "winner_take_all" | "top_3";
export type PoolStatus = "open" | "drawn" | "active" | "complete";
export type KnockoutStage =
  | "none"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "runner_up"
  | "champion";

export interface Pool {
  id: string;
  name: string;
  buy_in: number;
  num_players: number;
  draw_type: DrawType;
  payout_structure: PayoutStructure;
  room_code: string;
  admin_token: string;
  created_by: string | null;
  status: PoolStatus;
  created_at: string;
}

export interface Player {
  id: string;
  pool_id: string;
  user_id: string | null;
  name: string;
  nickname: string | null;
  paid: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  pool_id: string;
  name: string;
  country_code: string | null;
  tier: number;
  flag: string | null;
  /** API-Football team id, set once the team is matched during sync. */
  api_football_team_id: number | null;
  /** API-Football crest/logo URL. */
  logo_url: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface TeamAssignment {
  id: string;
  pool_id: string;
  team_id: string;
  player_id: string;
  created_at: string;
}

export interface ScoringRule {
  id: string;
  pool_id: string;
  rule_key: string;
  points: number;
  created_at: string;
}

/** Where a team's result came from: an API sync or a manual host edit. */
export type ResultSource = "manual" | "api";

export interface TeamResult {
  id: string;
  pool_id: string;
  team_id: string;
  group_wins: number;
  group_draws: number;
  group_losses: number;
  knockout_stage: KnockoutStage;
  /** Whether the latest values came from the API sync or a manual edit. */
  source: ResultSource;
  last_synced_at: string | null;
  /** When enabled, the API sync leaves this team's record untouched. */
  manual_override_enabled: boolean;
  /** Optional fixed point total that bypasses scoring rules when set. */
  manual_points_override: number | null;
  /** Optional free-text note for a manual round override. */
  manual_round_override: string | null;
  created_at: string;
  updated_at: string;
}

export interface Fixture {
  id: string;
  pool_id: string;
  api_football_fixture_id: number;
  league_id: number;
  season: number;
  round: string | null;
  status_short: string | null;
  status_long: string | null;
  kickoff_at: string | null;
  venue_name: string | null;
  venue_city: string | null;
  home_team_api_id: number | null;
  away_team_api_id: number | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_goals: number | null;
  away_goals: number | null;
  winner_team_api_id: number | null;
  loser_team_api_id: number | null;
  is_draw: boolean;
  is_finished: boolean;
  /** Finished fixtures are folded into team_results / standings. */
  included_in_standings: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SyncStatus = "running" | "success" | "partial" | "error";

export interface ApiSyncLog {
  id: string;
  pool_id: string | null;
  sync_type: string;
  status: SyncStatus;
  message: string | null;
  started_at: string;
  completed_at: string | null;
}

export type TradeStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "voided";

export interface Trade {
  id: string;
  pool_id: string;
  proposer_player_id: string;
  receiver_player_id: string;
  status: TradeStatus;
  message: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface TradeItem {
  id: string;
  trade_id: string;
  team_id: string;
  from_player_id: string;
  created_at: string;
}
