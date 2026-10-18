import type { Database } from "@/lib/database.types";

// One shape for everything on the calendar, from the public RPC or the member's own reads.
// Safe on client and server.

export type EventType = Database["public"]["Enums"]["event_type"];
export type CalendarKind = "match" | EventType;

export type CalendarItem = {
  id: string;
  kind: CalendarKind;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  homeAway: "home" | "away" | null;
  status: Database["public"]["Enums"]["match_status"] | null;
  teamPoints: number | null;
  opponentPoints: number | null;
  description: string | null;
  /** Events only: false means members only. Null for matches. */
  isPublic: boolean | null;
  /** Where the card links to, when the viewer can open it. */
  href: string | null;
};

export const EVENT_TYPES = ["practice", "social", "usta_deadline", "registration", "other"] as const satisfies readonly EventType[];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  practice: "Practice",
  social: "Social",
  usta_deadline: "USTA deadline",
  registration: "Registration",
  other: "Event",
};

/** Deadlines and registration windows are dates, not meetings: all-day in calendar apps. */
export const ALL_DAY_TYPES: readonly CalendarKind[] = ["usta_deadline", "registration"];

const KINDS: readonly string[] = ["match", ...EVENT_TYPES];
export const toKind = (kind: string): CalendarKind => (KINDS.includes(kind) ? (kind as CalendarKind) : "other");

/** "2026-10" → first and last day keys and the UTC range for the query, all in team time. */
export function monthKeyParts(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  return { year, month, daysInMonth, firstWeekday, next, prev };
}

export const isMonthKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
