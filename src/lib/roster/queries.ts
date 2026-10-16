import "server-only";
import { connection } from "next/server";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

// Member and captain roster reads. All go through the signed-in user's client, so RLS
// decides what comes back (members read the roster; captains also read inactive rows).

/**
 * Per-visitor reads, so render at request time: supabase-js reads Date.now() when it checks
 * the session, which Cache Components rejects during a prerender.
 */
async function readClient() {
  await connection();
  return createClient();
}

type Enums = Database["public"]["Enums"];
export type AvailabilityStatus = Enums["availability_status"];

export type DirectoryPlayer = {
  id: string;
  fullName: string;
  rating: number | null;
  position: Enums["position_pref"];
  role: Enums["member_role"];
  wins: number;
  losses: number;
  /** Null when there is no upcoming match or the player hasn't answered. */
  nextMatchStatus: AvailabilityStatus | null;
};

export type NextMatch = { id: string; opponent: string; startsAt: string };

export async function getDirectory(): Promise<{ players: DirectoryPlayer[]; nextMatch: NextMatch | null }> {
  const supabase = await readClient();
  const [players, records, match] = await Promise.all([
    supabase
      .from("players")
      .select("id, full_name, ntrp_rating, position_pref, role")
      .eq("is_active", true)
      .order("full_name"),
    supabase.from("player_records").select("player_id, wins, losses"),
    supabase
      .from("matches")
      .select("id, opponent, starts_at")
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
  ]);
  if (players.error) throw players.error;
  if (records.error) throw records.error;
  if (match.error) throw match.error;

  const statuses = new Map<string, AvailabilityStatus>();
  if (match.data) {
    const { data, error } = await supabase
      .from("availability")
      .select("player_id, status")
      .eq("match_id", match.data.id);
    if (error) throw error;
    for (const row of data) statuses.set(row.player_id, row.status);
  }

  const recordFor = new Map(records.data.map((r) => [r.player_id, r]));
  return {
    players: players.data.map((p) => ({
      id: p.id,
      fullName: p.full_name,
      rating: p.ntrp_rating,
      position: p.position_pref,
      role: p.role,
      wins: recordFor.get(p.id)?.wins ?? 0,
      losses: recordFor.get(p.id)?.losses ?? 0,
      nextMatchStatus: statuses.get(p.id) ?? null,
    })),
    nextMatch: match.data
      ? { id: match.data.id, opponent: match.data.opponent, startsAt: match.data.starts_at }
      : null,
  };
}

export type MatchHistoryItem = {
  matchId: string;
  opponent: string;
  startsAt: string;
  homeAway: Enums["home_away"];
  status: Enums["match_status"];
  line: string;
  won: boolean | null;
  score: string | null;
};

export async function getPlayerProfile(id: string) {
  if (!z.guid().safeParse(id).success) return null;

  const supabase = await readClient();
  const [player, record, slots] = await Promise.all([
    supabase
      .from("players")
      .select("id, full_name, email, phone, ntrp_rating, position_pref, role, is_active")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("player_records").select("wins, losses").eq("player_id", id).maybeSingle(),
    supabase
      .from("lineup_slots")
      .select("line_type, line_number, match:matches!inner(id, opponent, starts_at, home_away, status)")
      .eq("player_id", id),
  ]);
  if (player.error) throw player.error;
  if (record.error) throw record.error;
  if (slots.error) throw slots.error;
  if (!player.data) return null;

  const matchIds = slots.data.map((slot) => slot.match.id);
  const results = new Map<string, { won: boolean; score: string | null }>();
  if (matchIds.length > 0) {
    const { data, error } = await supabase
      .from("line_results")
      .select("match_id, line_type, line_number, won, score")
      .in("match_id", matchIds);
    if (error) throw error;
    for (const r of data) results.set(`${r.match_id}:${r.line_type}:${r.line_number}`, r);
  }

  const history: MatchHistoryItem[] = slots.data
    .filter((slot) => slot.match.status !== "cancelled")
    .map((slot) => {
      const result = results.get(`${slot.match.id}:${slot.line_type}:${slot.line_number}`);
      return {
        matchId: slot.match.id,
        opponent: slot.match.opponent,
        startsAt: slot.match.starts_at,
        homeAway: slot.match.home_away,
        status: slot.match.status,
        line: `${slot.line_type === "singles" ? "S" : "D"}${slot.line_number}`,
        won: slot.match.status === "completed" ? (result?.won ?? null) : null,
        score: slot.match.status === "completed" ? (result?.score ?? null) : null,
      };
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  return {
    player: player.data,
    wins: record.data?.wins ?? 0,
    losses: record.data?.losses ?? 0,
    history,
  };
}

export type RosterPlayer = Database["public"]["Tables"]["players"]["Row"];

/** Captain view: every player, active or not, plus the current season's roster cap. */
export async function getRoster() {
  const supabase = await readClient();
  const [players, season] = await Promise.all([
    supabase.from("players").select("*").order("is_active", { ascending: false }).order("full_name"),
    supabase.from("seasons").select("name, max_roster").eq("is_current", true).maybeSingle(),
  ]);
  if (players.error) throw players.error;
  if (season.error) throw season.error;
  return { players: players.data, maxRoster: season.data?.max_roster ?? null };
}

export async function getRosterPlayer(id: string) {
  if (!z.guid().safeParse(id).success) return null;
  const supabase = await readClient();
  const { data, error } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
