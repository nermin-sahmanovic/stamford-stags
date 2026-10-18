import { z } from "zod";
import { buildCalendar, ICS_HEADERS } from "@/lib/calendar/ics";
import { toKind, type CalendarItem } from "@/lib/calendar/items";
import { siteUrl } from "@/lib/email/config";
import { createAdminClient } from "@/lib/supabase/admin";

// Personal calendar subscription: /api/calendar/<token>.ics. Calendar apps fetch it without
// cookies, so the secret token in the URL is the only credential. calendar_feed() (service role
// only) verifies it and returns nothing for an unknown token or a player who left the roster.

const feedSchema = z.object({
  player: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      title: z.string(),
      starts_at: z.string(),
      ends_at: z.string().nullable(),
      location_name: z.string().nullable(),
      location_address: z.string().nullable(),
      home_away: z.enum(["home", "away"]).nullable(),
      status: z.enum(["scheduled", "completed", "cancelled"]).nullable(),
      team_points: z.number().nullable(),
      opponent_points: z.number().nullable(),
      description: z.string().nullable(),
    }),
  ),
});

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: segment } = await params;
  const token = z.guid().safeParse(segment.replace(/\.ics$/i, ""));
  if (!token.success) return notFound();

  const { data, error } = await createAdminClient().rpc("calendar_feed", { p_token: token.data });
  if (error) {
    console.error("[calendar] personal feed failed:", error.message);
    return new Response("Calendar unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (data === null) return notFound();

  const feed = feedSchema.parse(data);
  const items: CalendarItem[] = feed.items.map((row) => ({
    id: row.id,
    kind: toKind(row.kind),
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    // Members get the full address so the calendar app can route to it.
    location: [row.location_name, row.location_address].filter(Boolean).join(", ") || null,
    homeAway: row.home_away,
    status: row.status,
    teamPoints: row.team_points,
    opponentPoints: row.opponent_points,
    description: row.description,
    isPublic: null,
    href: null,
  }));

  const body = buildCalendar({ name: "Stamford Stags (team)", items, siteUrl: siteUrl(), personal: true });
  return new Response(body, { headers: { ...ICS_HEADERS, "Cache-Control": "private, no-store" } });
}
