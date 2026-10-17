import "server-only";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { shortName } from "@/lib/roster/display";
import { readClient } from "@/lib/supabase/read";

// Match Center, Availability and captain match reads. All use the signed-in user's client,
// so RLS decides what comes back (members see lineups only once published).

type Enums = Database["public"]["Enums"];
export type AvailabilityStatus = Enums["availability_status"];
export type LineType = Enums["line_type"];
export type RsvpStatus = Enums["rsvp_status"];

/** A match stays "upcoming" until 12 hours after its start, so it's still listed on match day. */
const UPCOMING_GRACE_MS = 12 * 60 * 60 * 1000;

const MATCH_COLUMNS =
  "id, opponent, starts_at, home_away, location_name, location_address, captain_notes, status, team_points, opponent_points, latitude, longitude, lineup_published_at";

type MatchRow = Pick<
  Database["public"]["Tables"]["matches"]["Row"],
  | "id"
  | "opponent"
  | "starts_at"
  | "home_away"
  | "location_name"
  | "location_address"
  | "captain_notes"
  | "status"
  | "team_points"
  | "opponent_points"
  | "latitude"
  | "longitude"
  | "lineup_published_at"
>;

export type Match = {
  id: string;
  opponent: string;
  startsAt: string;
  homeAway: Enums["home_away"];
  locationName: string | null;
  locationAddress: string | null;
  captainNotes: string | null;
  status: Enums["match_status"];
  teamPoints: number | null;
  opponentPoints: number | null;
  latitude: number | null;
  longitude: number | null;
  lineupPublished: boolean;
};

function toMatch(row: MatchRow): Match {
  return {
    id: row.id,
    opponent: row.opponent,
    startsAt: row.starts_at,
    homeAway: row.home_away,
    locationName: row.location_name,
    locationAddress: row.location_address,
    captainNotes: row.captain_notes,
    status: row.status,
    teamPoints: row.team_points,
    opponentPoints: row.opponent_points,
    latitude: row.latitude,
    longitude: row.longitude,
    lineupPublished: row.lineup_published_at !== null,
  };
}

const isUpcoming = (m: Match, now: number) =>
  m.status !== "completed" && Date.parse(m.startsAt) >= now - UPCOMING_GRACE_MS;

/** Current season's matches, split into upcoming (soonest first) and results (latest first). */
export async function getMatchCenter() {
  const supabase = await readClient();
  const { data, error } = await supabase
    .from("matches")
    .select(`${MATCH_COLUMNS}, season:seasons!inner(is_current)`)
    .eq("season.is_current", true)
    .order("starts_at");
  if (error) throw error;

  const now = Date.now();
  const matches = data.map(toMatch);
  return {
    upcoming: matches.filter((m) => isUpcoming(m, now)),
    results: matches.filter((m) => m.status === "completed").reverse(),
  };
}

export type LineupLine = {
  key: string;
  label: string;
  lineType: LineType;
  lineNumber: number;
  court: string | null;
  players: { id: string; name: string; rsvp: RsvpStatus }[];
};

export type LineResult = { lineType: LineType; lineNumber: number; won: boolean; score: string | null };
export type ChecklistItem = { id: string; label: string; done: boolean; sort: number };

export const lineLabel = (lineType: LineType, lineNumber: number) =>
  `${lineType === "singles" ? "S" : "D"}${lineNumber}`;

const lineOrder = (lineType: LineType, lineNumber: number) => (lineType === "singles" ? 0 : 10) + lineNumber;

/** Everything on the match detail page. Null if the match doesn't exist (or RLS hides it). */
export async function getMatchDetail(id: string) {
  if (!z.guid().safeParse(id).success) return null;
  const supabase = await readClient();
  const [match, slots, checklist, results] = await Promise.all([
    supabase
      .from("matches")
      .select(`${MATCH_COLUMNS}, season:seasons!inner(singles_lines, doubles_lines)`)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("lineup_slots")
      .select("line_type, line_number, seat, court_label, rsvp, player:players!inner(id, full_name)")
      .eq("match_id", id),
    supabase.from("checklist_items").select("id, label, done, sort").eq("match_id", id).order("sort").order("created_at"),
    supabase.from("line_results").select("line_type, line_number, won, score").eq("match_id", id),
  ]);
  if (match.error) throw match.error;
  if (slots.error) throw slots.error;
  if (checklist.error) throw checklist.error;
  if (results.error) throw results.error;
  if (!match.data) return null;

  const lines = new Map<string, LineupLine>();
  for (const slot of [...slots.data].sort((a, b) => a.seat - b.seat)) {
    const key = lineLabel(slot.line_type, slot.line_number);
    const line = lines.get(key) ?? {
      key,
      label: key,
      lineType: slot.line_type,
      lineNumber: slot.line_number,
      court: slot.court_label,
      players: [],
    };
    line.court ??= slot.court_label;
    line.players.push({ id: slot.player.id, name: shortName(slot.player.full_name), rsvp: slot.rsvp });
    lines.set(key, line);
  }

  return {
    match: toMatch(match.data),
    hasStarted: Date.parse(match.data.starts_at) <= Date.now(),
    season: { singlesLines: match.data.season.singles_lines, doublesLines: match.data.season.doubles_lines },
    lineup: [...lines.values()].sort(
      (a, b) => lineOrder(a.lineType, a.lineNumber) - lineOrder(b.lineType, b.lineNumber),
    ),
    checklist: checklist.data satisfies ChecklistItem[],
    results: results.data
      .map((r) => ({ lineType: r.line_type, lineNumber: r.line_number, won: r.won, score: r.score }))
      .sort((a, b) => lineOrder(a.lineType, a.lineNumber) - lineOrder(b.lineType, b.lineNumber)),
  };
}

export type MatchDetailData = NonNullable<Awaited<ReturnType<typeof getMatchDetail>>>;

export type TeamRow = {
  matchId: string;
  opponent: string;
  startsAt: string;
  needed: number;
  available: number;
  maybe: number;
  unavailable: number;
  replied: number;
  roster: number;
  noResponse: { id: string; name: string }[];
};

/** Availability page: my answer per upcoming match, plus the team view. */
export async function getAvailabilityBoard(meId: string) {
  const supabase = await readClient();
  const { data: matchRows, error } = await supabase
    .from("matches")
    .select(`${MATCH_COLUMNS}, season:seasons!inner(is_current)`)
    .eq("season.is_current", true)
    .eq("status", "scheduled")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw error;

  const matches = matchRows.map(toMatch);
  const ids = matches.map((m) => m.id);
  if (ids.length === 0) return { matches, mine: {}, team: [] as TeamRow[] };

  const [summary, answers, players] = await Promise.all([
    supabase.from("match_availability_summary").select("*").in("match_id", ids),
    supabase.from("availability").select("match_id, player_id, status").in("match_id", ids),
    supabase.from("players").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  if (summary.error) throw summary.error;
  if (answers.error) throw answers.error;
  if (players.error) throw players.error;

  const mine: Record<string, AvailabilityStatus> = {};
  const answered = new Map<string, Set<string>>();
  for (const a of answers.data) {
    if (a.player_id === meId) mine[a.match_id] = a.status;
    const set = answered.get(a.match_id) ?? new Set<string>();
    set.add(a.player_id);
    answered.set(a.match_id, set);
  }

  const summaryFor = new Map(summary.data.map((s) => [s.match_id, s]));
  const team: TeamRow[] = matches.map((m) => {
    const s = summaryFor.get(m.id);
    const replied = answered.get(m.id) ?? new Set<string>();
    const noResponse = players.data
      .filter((p) => !replied.has(p.id))
      .map((p) => ({ id: p.id, name: shortName(p.full_name) }));
    const roster = s?.roster_size ?? players.data.length;
    return {
      matchId: m.id,
      opponent: m.opponent,
      startsAt: m.startsAt,
      needed: s?.players_needed ?? 0,
      available: s?.available ?? 0,
      maybe: s?.maybe ?? 0,
      unavailable: s?.unavailable ?? 0,
      replied: roster - noResponse.length,
      roster,
      noResponse,
    };
  });

  return { matches, mine, team };
}

export type CaptainMatchRow = Match & {
  replied: number | null;
  roster: number | null;
  available: number | null;
  declined: number;
};

/** Captain list: every match this season with reply counts and lineup declines. */
export async function getCaptainMatches() {
  const supabase = await readClient();
  const [matches, summary, declined] = await Promise.all([
    supabase
      .from("matches")
      .select(`${MATCH_COLUMNS}, season:seasons!inner(is_current)`)
      .eq("season.is_current", true)
      .order("starts_at"),
    supabase.from("match_availability_summary").select("match_id, available, no_response, roster_size"),
    supabase.from("lineup_slots").select("match_id").eq("rsvp", "declined"),
  ]);
  if (matches.error) throw matches.error;
  if (summary.error) throw summary.error;
  if (declined.error) throw declined.error;

  const declinedFor = new Map<string, number>();
  for (const d of declined.data) declinedFor.set(d.match_id, (declinedFor.get(d.match_id) ?? 0) + 1);

  const summaryFor = new Map(summary.data.map((s) => [s.match_id, s]));
  const now = Date.now();
  const rows: CaptainMatchRow[] = matches.data.map((row) => {
    const s = summaryFor.get(row.id);
    return {
      ...toMatch(row),
      available: s?.available ?? null,
      roster: s?.roster_size ?? null,
      replied: s?.roster_size != null && s.no_response != null ? s.roster_size - s.no_response : null,
      declined: declinedFor.get(row.id) ?? 0,
    };
  });
  return {
    upcoming: rows.filter((m) => isUpcoming(m, now)),
    past: rows.filter((m) => !isUpcoming(m, now)).reverse(),
  };
}

export type PositionPref = Enums["position_pref"];

export type LineupCandidate = {
  id: string;
  name: string;
  rating: number | null;
  pref: PositionPref | null;
  availability: AvailabilityStatus | null;
  /** Why the player isn't eligible under the season's rating rules, or null if they are. */
  ineligible: string | null;
};

export type BuilderSeat = { lineType: LineType; lineNumber: number; seat: 1 | 2 };
export type BuilderLine = {
  key: string;
  lineType: LineType;
  lineNumber: number;
  court: string | null;
  seats: (BuilderSeat & { playerId: string | null; rsvp: RsvpStatus | null })[];
};

/** Captain lineup builder: the season's lines with current seats, and everyone who could play. */
export async function getLineupBuilder(id: string) {
  if (!z.guid().safeParse(id).success) return null;
  const supabase = await readClient();
  const [match, slots, eligible, players] = await Promise.all([
    supabase
      .from("matches")
      .select(`${MATCH_COLUMNS}, season:seasons!inner(singles_lines, doubles_lines, ntrp_level, min_ntrp)`)
      .eq("id", id)
      .maybeSingle(),
    supabase.from("lineup_slots").select("line_type, line_number, seat, player_id, court_label, rsvp").eq("match_id", id),
    supabase.rpc("eligible_players", { p_match_id: id }),
    supabase.from("players").select("id, position_pref").eq("is_active", true),
  ]);
  if (match.error) throw match.error;
  if (slots.error) throw slots.error;
  if (eligible.error) throw eligible.error;
  if (players.error) throw players.error;
  if (!match.data) return null;

  const { singles_lines, doubles_lines, ntrp_level, min_ntrp } = match.data.season;
  const slotAt = new Map(slots.data.map((s) => [`${lineLabel(s.line_type, s.line_number)}-${s.seat}`, s]));

  const lines: BuilderLine[] = [];
  const addLine = (lineType: LineType, lineNumber: number) => {
    const key = lineLabel(lineType, lineNumber);
    const seats = (lineType === "singles" ? [1] : [1, 2]).map((seat) => {
      const slot = slotAt.get(`${key}-${seat}`);
      return { lineType, lineNumber, seat: seat as 1 | 2, playerId: slot?.player_id ?? null, rsvp: slot?.rsvp ?? null };
    });
    const court = seats.map((s) => slotAt.get(`${key}-${s.seat}`)?.court_label).find((c) => c) ?? null;
    lines.push({ key, lineType, lineNumber, court, seats });
  };
  for (let n = 1; n <= singles_lines; n++) addLine("singles", n);
  for (let n = 1; n <= doubles_lines; n++) addLine("doubles", n);

  const prefFor = new Map(players.data.map((p) => [p.id, p.position_pref]));
  // The generated types say non-null, but SQL returns null for no answer / no rating.
  const candidates: LineupCandidate[] = eligible.data.map((p) => {
    const rating = (p.ntrp_rating as number | null) ?? null;
    const availability = (p.availability as AvailabilityStatus | null) ?? null;
    let ineligible: string | null = null;
    if (rating === null) ineligible = "No NTRP rating on file";
    else if (!p.rating_ok && rating > ntrp_level) {
      ineligible = `Rated ${rating.toFixed(1)}, above the ${ntrp_level.toFixed(1)} level`;
    } else if (!p.rating_ok && min_ntrp !== null) {
      ineligible = `Rated ${rating.toFixed(1)}, below the ${min_ntrp.toFixed(1)} minimum`;
    }
    return {
      id: p.player_id,
      name: shortName(p.full_name),
      rating,
      pref: prefFor.get(p.player_id) ?? null,
      availability,
      ineligible,
    };
  });

  return {
    match: toMatch(match.data),
    hasStarted: Date.parse(match.data.starts_at) <= Date.now(),
    lines,
    candidates,
  };
}

export type LineupBuilderData = NonNullable<Awaited<ReturnType<typeof getLineupBuilder>>>;
