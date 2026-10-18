import "server-only";
import { opponentLabel } from "@/lib/matches/display";
import { MEMBER_URL_SECONDS, PHOTO_COLUMNS, signPhotos, type GalleryPhoto } from "@/lib/photos/sign";
import { readClient } from "@/lib/supabase/read";

/** Every photo (RLS: members see all), newest first, with signed URLs. */
export async function getMemberPhotos(): Promise<GalleryPhoto[]> {
  const supabase = await readClient();
  const { data, error } = await supabase
    .from("photos")
    .select(`${PHOTO_COLUMNS}, match:matches(opponent, home_away)`)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return signPhotos(
    supabase,
    data.map(({ match, ...row }) => ({
      ...row,
      matchLabel: match ? opponentLabel(match.opponent, match.home_away) : null,
    })),
    MEMBER_URL_SECONDS,
  );
}

/** Recent matches for the uploader's "which match?" picker. */
export async function getPhotoMatchOptions() {
  const supabase = await readClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id, opponent, home_away, starts_at")
    .lte("starts_at", new Date(Date.now() + 86_400_000).toISOString())
    .order("starts_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data.map((m) => ({ id: m.id, label: opponentLabel(m.opponent, m.home_away), startsAt: m.starts_at }));
}
