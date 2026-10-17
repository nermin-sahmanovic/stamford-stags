// Match display helpers (safe on client and server).

type HomeAway = "home" | "away";

/** "vs. Norwalk Aces" at home, "@ Darien Drop Shots" away. */
export const opponentLabel = (opponent: string, homeAway: HomeAway) =>
  `${homeAway === "home" ? "vs." : "@"} ${opponent}`;

export const homeAwayLabel = (homeAway: HomeAway) => (homeAway === "home" ? "Home" : "Away");

/** Google Maps directions; opens the Maps app on phones. Null when there's nothing to search for. */
export function directionsUrl(name: string | null, address: string | null) {
  const destination = [name, address].filter(Boolean).join(", ");
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** "W 4–1", "L 2–3", or null when the score isn't in. */
export function resultLabel(teamPoints: number | null, opponentPoints: number | null) {
  if (teamPoints === null || opponentPoints === null) return null;
  const outcome = teamPoints > opponentPoints ? "W" : teamPoints < opponentPoints ? "L" : "T";
  return { outcome, score: `${teamPoints}–${opponentPoints}` } as const;
}
