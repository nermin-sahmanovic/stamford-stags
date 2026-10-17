// Small display helpers for player rows and profiles (safe on client and server).

/** "M. Alvarez" → "MA", "Team Captain" → "TC" */
export function initials(name: string) {
  const parts = name.replace(/\./g, " ").split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** "Maria Alvarez" → "M. Alvarez"; "M. Alvarez" and single names stay as they are. */
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2 || parts[0].endsWith(".")) return name.trim();
  return `${parts[0][0].toUpperCase()}. ${parts.slice(1).join(" ")}`;
}

const positionLabels = { singles: "Singles", doubles: "Doubles", both: "Singles & doubles" } as const;

export const positionLabel = (position: keyof typeof positionLabels) => positionLabels[position];

export const ratingLabel = (rating: number | null) =>
  rating === null ? "NTRP —" : `NTRP ${rating.toFixed(1)}`;
