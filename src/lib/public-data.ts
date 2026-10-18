import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { toKind, type CalendarItem } from "@/lib/calendar/items";
import { PHOTO_COLUMNS, PUBLIC_URL_SECONDS, signPhotos, type GalleryPhoto } from "@/lib/photos/sign";
import { createPublicClient } from "@/lib/supabase/public";

// Public, visitor-independent reads. Cached for everyone; when captains change matches,
// events, photos, standings, roster or news, they call updateTag(PUBLIC_TAG).
export const PUBLIC_TAG = "public";

const teamSummarySchema = z.object({
  season: z.string().nullable(),
  player_count: z.number(),
  open_spots: z.number(),
  wins: z.number(),
  losses: z.number(),
  next_match: z
    .object({
      opponent: z.string(),
      starts_at: z.string(),
      home_away: z.enum(["home", "away"]),
      location_name: z.string().nullable(),
    })
    .nullable(),
});

export type TeamSummary = z.infer<typeof teamSummarySchema>;

export async function getTeamSummary(): Promise<TeamSummary> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PUBLIC_TAG);

  const { data, error } = await createPublicClient().rpc("public_team_summary");
  if (error) throw error;
  return teamSummarySchema.parse(data);
}

/** Matches and public events between two instants. Callers round the range so cache keys repeat. */
export async function getPublicCalendar(from: string, to: string): Promise<CalendarItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PUBLIC_TAG);

  const { data, error } = await createPublicClient().rpc("public_calendar", { p_from: from, p_to: to });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    kind: toKind(row.kind),
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location_name,
    homeAway: row.home_away,
    status: row.status,
    teamPoints: row.team_points,
    opponentPoints: row.opponent_points,
    description: null,
    isPublic: row.kind === "match" ? null : true,
    href: null,
  }));
}

const resultsSchema = z.object({
  season: z.string().nullable(),
  wins: z.number(),
  losses: z.number(),
  singles_won: z.number(),
  singles_lost: z.number(),
  doubles_won: z.number(),
  doubles_lost: z.number(),
  matches: z.array(
    z.object({
      id: z.string(),
      opponent: z.string(),
      starts_at: z.string(),
      home_away: z.enum(["home", "away"]),
      team_points: z.number().nullable(),
      opponent_points: z.number().nullable(),
    }),
  ),
  standings_updated_at: z.string().nullable(),
  standings: z.array(
    z.object({
      rank: z.number(),
      team_name: z.string(),
      wins: z.number(),
      losses: z.number(),
      lines_won: z.number(),
      lines_lost: z.number(),
      is_stags: z.boolean(),
    }),
  ),
});

export type PublicResults = z.infer<typeof resultsSchema>;

/** Current season record, completed matches, line totals and standings. No player names. */
export async function getPublicResults(): Promise<PublicResults> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PUBLIC_TAG);

  const { data, error } = await createPublicClient().rpc("public_results");
  if (error) throw error;
  return resultsSchema.parse(data);
}

/** The Home hero photo the captain chose (always public), or null for the placeholder. */
export async function getTeamPhoto(): Promise<GalleryPhoto | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PUBLIC_TAG);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("photos")
    .select(PHOTO_COLUMNS)
    .eq("is_team_photo", true)
    .eq("is_public", true)
    .limit(1);
  if (error) throw error;
  const [photo] = await signPhotos(supabase, data, PUBLIC_URL_SECONDS);
  return photo ?? null;
}

/**
 * Photos the captain marked public, newest first, with signed URLs. The anon client can only
 * sign files of public photos (storage RLS). The URLs outlive the "minutes" cache entry.
 */
export async function getPublicPhotos(limit: number): Promise<GalleryPhoto[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PUBLIC_TAG);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("photos")
    .select(PHOTO_COLUMNS)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return signPhotos(supabase, data, PUBLIC_URL_SECONDS);
}

export async function getPublicNews(limit = 3) {
  "use cache";
  cacheLife("minutes");
  cacheTag(PUBLIC_TAG);

  // RLS returns only is_public posts to the anon role; the filter keeps intent explicit.
  const { data, error } = await createPublicClient()
    .from("news_posts")
    .select("id, type, title, body, published_at")
    .eq("is_public", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export type NewsPost = Awaited<ReturnType<typeof getPublicNews>>[number];
