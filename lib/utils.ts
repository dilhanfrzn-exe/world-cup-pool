import type { PayoutStructure } from "./types";

/** Generate a room code like "ABC123" (no ambiguous chars). */
export function generateRoomCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function formatMoney(amount: number | string): string {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export interface PayoutLine {
  place: string;
  amount: number;
}

/**
 * Compute the prize pot breakdown. Payments are tracked manually, but the
 * pot/payout math is derived from buy-in × number of players.
 */
export function computePayouts(
  buyIn: number,
  numPlayers: number,
  structure: PayoutStructure,
): { pot: number; lines: PayoutLine[] } {
  const pot = Math.round(Number(buyIn) * Number(numPlayers) * 100) / 100;
  if (structure === "top_3") {
    const first = Math.round(pot * 0.6 * 100) / 100;
    const second = Math.round(pot * 0.25 * 100) / 100;
    const third = Math.round((pot - first - second) * 100) / 100;
    return {
      pot,
      lines: [
        { place: "1st place", amount: first },
        { place: "2nd place", amount: second },
        { place: "3rd place", amount: third },
      ],
    };
  }
  return { pot, lines: [{ place: "1st place", amount: pot }] };
}

export function payoutStructureLabel(structure: PayoutStructure): string {
  return structure === "top_3" ? "Top 3 payout" : "Winner takes all";
}

/** Human-friendly absolute timestamp, e.g. "Jun 10, 2026, 10:25 PM". */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function drawTypeLabel(type: string): string {
  switch (type) {
    case "random":
      return "Random";
    case "tiered":
      return "Tiered (by pot)";
    case "auction":
      return "Auction";
    default:
      return type;
  }
}
