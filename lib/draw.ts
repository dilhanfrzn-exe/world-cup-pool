/**
 * Fair draw logic for the World Cup Pool.
 *
 * Both draw types guarantee an equal distribution:
 *   - random: every player gets the same number of teams.
 *   - tiered: every player gets the same number of teams FROM EACH tier.
 *
 * All functions are pure and framework-agnostic so they are trivial to unit
 * test and reuse (e.g. for a future client-side spinning-wheel animation).
 */

export interface DrawableTeam {
  id: string;
  tier: number;
}

export interface DrawAssignment {
  teamId: string;
  playerId: string;
}

export class DrawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawError";
  }
}

/** Fisher–Yates shuffle returning a new array (does not mutate input). */
export function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Distribute a shuffled list of teams round-robin across players. Because the
 * counts are validated to divide evenly before calling this, every player ends
 * up with exactly `teams.length / players.length` teams.
 */
function roundRobin(
  teamIds: string[],
  playerIds: string[],
): DrawAssignment[] {
  return teamIds.map((teamId, i) => ({
    teamId,
    playerId: playerIds[i % playerIds.length],
  }));
}

export function randomDraw(
  teams: DrawableTeam[],
  playerIds: string[],
): DrawAssignment[] {
  if (playerIds.length === 0) {
    throw new DrawError("Add at least one player before running the draw.");
  }
  if (teams.length === 0) {
    throw new DrawError("Add some teams before running the draw.");
  }
  if (teams.length % playerIds.length !== 0) {
    throw new DrawError(
      `Teams (${teams.length}) don't divide evenly among players (${playerIds.length}). ` +
        `Adjust the number of teams or players so everyone gets the same amount.`,
    );
  }

  const shuffledTeams = shuffle(teams).map((t) => t.id);
  const shuffledPlayers = shuffle(playerIds);
  return roundRobin(shuffledTeams, shuffledPlayers);
}

export function tieredDraw(
  teams: DrawableTeam[],
  playerIds: string[],
): DrawAssignment[] {
  if (playerIds.length === 0) {
    throw new DrawError("Add at least one player before running the draw.");
  }
  if (teams.length === 0) {
    throw new DrawError("Add some teams before running the draw.");
  }

  // Group teams by tier.
  const byTier = new Map<number, DrawableTeam[]>();
  for (const team of teams) {
    const list = byTier.get(team.tier) ?? [];
    list.push(team);
    byTier.set(team.tier, list);
  }

  // Validate each tier divides evenly across players.
  for (const [tier, tierTeams] of byTier) {
    if (tierTeams.length % playerIds.length !== 0) {
      throw new DrawError(
        `Tier ${tier} has ${tierTeams.length} teams, which doesn't divide evenly ` +
          `among ${playerIds.length} players. Each tier must split equally.`,
      );
    }
  }

  const assignments: DrawAssignment[] = [];
  // Sort tiers ascending so the assignment order is deterministic & readable.
  const tiers = [...byTier.keys()].sort((a, b) => a - b);
  for (const tier of tiers) {
    const tierTeams = shuffle(byTier.get(tier)!).map((t) => t.id);
    const shuffledPlayers = shuffle(playerIds);
    assignments.push(...roundRobin(tierTeams, shuffledPlayers));
  }
  return assignments;
}

export function runDraw(
  drawType: "random" | "tiered" | "auction",
  teams: DrawableTeam[],
  playerIds: string[],
): DrawAssignment[] {
  switch (drawType) {
    case "random":
      return randomDraw(teams, playerIds);
    case "tiered":
      return tieredDraw(teams, playerIds);
    case "auction":
      throw new DrawError(
        "Auction draw isn't available yet — use Random or Tiered for now.",
      );
    default:
      throw new DrawError("Unknown draw type.");
  }
}
