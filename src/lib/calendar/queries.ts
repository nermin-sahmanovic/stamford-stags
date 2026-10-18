import "server-only";
import type { CalendarItem } from "@/lib/calendar/items";
import { opponentLabel } from "@/lib/matches/display";
import { siteUrl } from "@/lib/email/config";
import { readClient } from "@/lib/supabase/read";

/** Everything a member may see between two instants: all matches and all events (RLS). */
export async function getMemberCalendar(from: string, to: string): Promise<CalendarItem[]> {
  const supabase = await readClient();
  const [matches, events] = await Promise.all([
    supabase
      .from("matches")
      .select("id, opponent, starts_at, home_away, location_name, status, team_points, opponent_points")
      .gte("starts_at", from)
      .lt("starts_at", to),
    supabase
      .from("events")
      .select("id, type, title, starts_at, ends_at, location, description, is_public")
      .gte("starts_at", from)
      .lt("starts_at", to),
  ]);
  if (matches.error) throw matches.error;
  if (events.error) throw events.error;

  const items: CalendarItem[] = [
    ...matches.data.map((m) => ({
      id: m.id,
      kind: "match" as const,
      title: opponentLabel(m.opponent, m.home_away),
      startsAt: m.starts_at,
      endsAt: null,
      location: m.location_name,
      homeAway: m.home_away,
      status: m.status,
      teamPoints: m.team_points,
      opponentPoints: m.opponent_points,
      description: null,
      isPublic: null,
      href: `/matches/${m.id}`,
    })),
    ...events.data.map((e) => ({
      id: e.id,
      kind: e.type,
      title: e.title,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      location: e.location,
      homeAway: null,
      status: null,
      teamPoints: null,
      opponentPoints: null,
      description: e.description,
      isPublic: e.is_public,
      href: null,
    })),
  ];
  return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export const PUBLIC_FEED_PATH = "/api/calendar/public.ics";

export const publicFeedUrl = () => `${siteUrl()}${PUBLIC_FEED_PATH}`;
export const personalFeedUrl = (token: string) => `${siteUrl()}/api/calendar/${token}.ics`;

/** The signed-in player's own feed URL (RLS returns only their token row). */
export async function getMyFeedUrl(): Promise<string | null> {
  const supabase = await readClient();
  const { data, error } = await supabase.from("calendar_tokens").select("token").maybeSingle();
  if (error) throw error;
  return data ? personalFeedUrl(data.token) : null;
}
