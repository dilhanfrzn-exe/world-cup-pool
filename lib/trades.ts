import type { Player, Team, Trade, TradeItem } from "./types";

/** Count pending trades awaiting a response from the given user. */
export function countIncomingTrades(
  trades: Trade[],
  players: Player[],
  userId: string | undefined,
): number {
  if (!userId) return 0;
  const me = players.find((p) => p.user_id === userId);
  if (!me) return 0;
  return trades.filter(
    (t) => t.status === "pending" && t.receiver_player_id === me.id,
  ).length;
}

export interface EnrichedTrade {
  trade: Trade;
  proposer: Player | null;
  receiver: Player | null;
  /** Teams the proposer is giving up (currently owned by the proposer). */
  offered: Team[];
  /** Teams the proposer wants (currently owned by the receiver). */
  requested: Team[];
}

/**
 * Join raw trades + items with players/teams for display. Pure function so it
 * is easy to test and reuse.
 */
export function buildEnrichedTrades(
  trades: Trade[],
  tradeItems: TradeItem[],
  players: Player[],
  teams: Team[],
): EnrichedTrade[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const itemsByTrade = new Map<string, TradeItem[]>();
  for (const item of tradeItems) {
    const list = itemsByTrade.get(item.trade_id) ?? [];
    list.push(item);
    itemsByTrade.set(item.trade_id, list);
  }

  return trades.map((trade) => {
    const items = itemsByTrade.get(trade.id) ?? [];
    const offered: Team[] = [];
    const requested: Team[] = [];
    for (const item of items) {
      const team = teamById.get(item.team_id);
      if (!team) continue;
      if (item.from_player_id === trade.proposer_player_id) offered.push(team);
      else requested.push(team);
    }
    return {
      trade,
      proposer: playerById.get(trade.proposer_player_id) ?? null,
      receiver: playerById.get(trade.receiver_player_id) ?? null,
      offered,
      requested,
    };
  });
}

export function tradeStatusLabel(status: Trade["status"]): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "voided":
      return "Voided";
    default:
      return status;
  }
}
