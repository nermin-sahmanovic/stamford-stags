import "server-only";
import { getAvailabilityBoard, type Match, type TeamRow } from "@/lib/matches/queries";
import { getMessageHistory } from "@/lib/messages/queries";
import { readClient } from "@/lib/supabase/read";

// Everything on the captain dashboard, read under the captain's RLS. No number is computed
// from anything but these rows.

export type PendingRegistration = {
  id: string;
  fullName: string;
  ntrp: number | null;
  position: "singles" | "doubles" | "both";
  createdAt: string;
  /** Invited in the last day (shown as done); everything else is pending. */
  invited: boolean;
};

export type DashboardMatch = TeamRow & { match: Match; short: number };

export async function getDashboard(meId: string) {
  const supabase = await readClient();
  const [board, registrations, season, active, messages] = await Promise.all([
    getAvailabilityBoard(meId),
    // Pending ones, plus any invited in the last day so a fresh "Invited ✓" stays in place.
    supabase
      .from("registrations")
      .select("id, full_name, ntrp_rating, position_pref, status, created_at")
      .or(`status.eq.pending,and(status.eq.invited,reviewed_at.gte.${new Date(Date.now() - 86_400_000).toISOString()})`)
      .order("created_at"),
    supabase.from("seasons").select("max_roster").eq("is_current", true).maybeSingle(),
    supabase.from("players").select("id", { count: "exact", head: true }).eq("is_active", true),
    getMessageHistory(5),
  ]);
  if (registrations.error) throw registrations.error;
  if (season.error) throw season.error;
  if (active.error) throw active.error;

  const byId = new Map(board.matches.map((m) => [m.id, m]));
  const matches: DashboardMatch[] = board.team.map((row) => ({
    ...row,
    match: byId.get(row.matchId)!,
    short: Math.max(0, row.needed - row.available),
  }));
  const next = matches[0] ?? null;

  // Lineup progress for the next match's KPI note.
  let lineupSet = 0;
  if (next) {
    const { count, error } = await supabase
      .from("lineup_slots")
      .select("match_id", { count: "exact", head: true })
      .eq("match_id", next.matchId);
    if (error) throw error;
    lineupSet = count ?? 0;
  }

  const maxRoster = season.data?.max_roster ?? null;
  const activeCount = active.count ?? 0;

  return {
    next,
    lineupSet,
    shortMatches: matches.filter((m) => m.short > 0),
    needsAttention: matches.filter((m) => m.noResponse.length > 0),
    registrations: registrations.data.map(
      (r): PendingRegistration => ({
        id: r.id,
        fullName: r.full_name,
        ntrp: r.ntrp_rating,
        position: r.position_pref,
        createdAt: r.created_at,
        invited: r.status === "invited",
      }),
    ),
    pendingCount: registrations.data.filter((r) => r.status === "pending").length,
    roster: { active: activeCount, max: maxRoster, open: maxRoster === null ? null : Math.max(0, maxRoster - activeCount) },
    messages,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
