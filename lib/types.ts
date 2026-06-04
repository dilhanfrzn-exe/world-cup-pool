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

export interface TeamResult {
  id: string;
  pool_id: string;
  team_id: string;
  group_wins: number;
  group_draws: number;
  group_losses: number;
  knockout_stage: KnockoutStage;
  created_at: string;
  updated_at: string;
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
