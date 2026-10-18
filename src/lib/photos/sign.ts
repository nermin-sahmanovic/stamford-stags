import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const PHOTO_BUCKET = "photos";
/** Member pages render per request; an hour is plenty for a visit. */
export const MEMBER_URL_SECONDS = 60 * 60;
/** Public pages are cached for up to an hour, so their URLs must last longer than that. */
export const PUBLIC_URL_SECONDS = 3 * 60 * 60;

export const PHOTO_COLUMNS = "id, path, thumb_path, width, height, caption, is_public, is_team_photo, created_at";

export type GalleryPhoto = {
  id: string;
  caption: string | null;
  isPublic: boolean;
  /** Shown in the Home hero. At most one, and always public. */
  isTeamPhoto: boolean;
  width: number;
  height: number;
  createdAt: string;
  matchLabel: string | null;
  thumbUrl: string;
  fullUrl: string;
};

type PhotoRow = {
  id: string;
  path: string;
  thumb_path: string;
  width: number;
  height: number;
  caption: string | null;
  is_public: boolean;
  is_team_photo: boolean;
  created_at: string;
  matchLabel?: string | null;
};

/**
 * Signs each photo's thumbnail and full-size file with the caller's client, so storage RLS
 * decides what can be signed. Photos whose files can't be signed are left out.
 */
export async function signPhotos(
  supabase: SupabaseClient<Database>,
  rows: PhotoRow[],
  seconds: number,
): Promise<GalleryPhoto[]> {
  if (rows.length === 0) return [];
  const paths = rows.flatMap((row) => [row.thumb_path, row.path]);
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, seconds);
  if (error) throw error;
  const urls = new Map(data.filter((d) => d.signedUrl && !d.error).map((d) => [d.path, d.signedUrl]));

  return rows.flatMap((row) => {
    const thumbUrl = urls.get(row.thumb_path);
    const fullUrl = urls.get(row.path);
    if (!thumbUrl || !fullUrl) return [];
    return [
      {
        id: row.id,
        caption: row.caption,
        isPublic: row.is_public,
        isTeamPhoto: row.is_team_photo,
        width: row.width,
        height: row.height,
        createdAt: row.created_at,
        matchLabel: row.matchLabel ?? null,
        thumbUrl,
        fullUrl,
      },
    ];
  });
}
