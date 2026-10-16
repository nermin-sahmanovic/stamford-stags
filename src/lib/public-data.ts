import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";

// Public, visitor-independent reads. Cached for everyone; when captains change
// matches, roster or news later, they call updateTag(PUBLIC_TAG).
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

export async function getPublicSchedule() {
  "use cache";
  cacheLife("minutes");
  cacheTag(PUBLIC_TAG);

  const { data, error } = await createPublicClient().rpc("public_schedule");
  if (error) throw error;
  return data;
}

export type ScheduleItem = Awaited<ReturnType<typeof getPublicSchedule>>[number];

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
