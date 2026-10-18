"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth";
import type { ActionResult } from "@/lib/matches/schemas";
import { PHOTO_BUCKET } from "@/lib/photos/sign";
import { MAX_UPLOAD_BYTES, photoCaptionSchema, photoUploadSchema } from "@/lib/photos/schema";
import { PUBLIC_TAG } from "@/lib/public-data";
import { createClient } from "@/lib/supabase/server";

// Captain photo writes. Uploads use the captain's own client, so storage RLS ("captains upload
// photo files") and table RLS ("captains manage photos") are the real gate.

const SOMETHING_WRONG = "Something went wrong. Please try again.";
const NOT_FOUND = "That photo doesn't exist.";

function photosChanged() {
  updateTag(PUBLIC_TAG);
  revalidatePath("/photos");
  revalidatePath("/gallery");
  revalidatePath("/");
}

const fail = (message: string, error?: { message: string }): { ok: false; message: string } => {
  if (error) console.error("[photos]", message, error.message);
  return { ok: false, message: error ? SOMETHING_WRONG : message };
};

const isId = (id: string) => z.guid().safeParse(id).success;

/**
 * Re-encodes on the server whatever the phone sent: auto-rotated from EXIF, at most 2048px,
 * JPEG, plus a 640px thumbnail. sharp writes no metadata unless asked (no keepMetadata/withMetadata),
 * so EXIF, GPS and XMP are gone even if the browser-side shrink was skipped.
 */
async function processImage(input: Buffer) {
  const source = sharp(input, { failOn: "error", limitInputPixels: 60_000_000 });
  const [full, thumb] = await Promise.all([
    source
      .clone()
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer({ resolveWithObject: true }),
    source
      .clone()
      .rotate()
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer(),
  ]);
  return { full: full.data, width: full.info.width, height: full.info.height, thumb };
}

export async function uploadPhoto(formData: FormData): Promise<ActionResult> {
  const me = await requireCaptain();
  const parsed = photoUploadSchema.safeParse({
    file: formData.get("file"),
    caption: formData.get("caption") ?? "",
    match_id: formData.get("match_id") ?? "",
    is_public: formData.get("is_public") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the photo.");
  const { file, caption, match_id, is_public } = parsed.data;
  if (file.size > MAX_UPLOAD_BYTES) return fail("That photo is too large. Try a smaller one.");

  let image: Awaited<ReturnType<typeof processImage>>;
  try {
    image = await processImage(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    console.error("[photos] image processing failed:", err instanceof Error ? err.message : err);
    return fail("That file couldn't be read as a photo. Try a JPEG or PNG.");
  }

  const supabase = await createClient();
  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();
  if (seasonError) return fail("season lookup failed", seasonError);

  const id = randomUUID();
  const folder = new Date().getUTCFullYear();
  const path = `${folder}/${id}.jpg`;
  const thumbPath = `${folder}/${id}-thumb.jpg`;
  const bucket = supabase.storage.from(PHOTO_BUCKET);
  const options = { contentType: "image/jpeg", cacheControl: "31536000", upsert: false };

  const uploads = await Promise.all([bucket.upload(path, image.full, options), bucket.upload(thumbPath, image.thumb, options)]);
  const uploadError = uploads.find((u) => u.error)?.error;
  if (uploadError) {
    await bucket.remove([path, thumbPath]);
    return fail("upload failed", uploadError);
  }

  const { error } = await supabase.from("photos").insert({
    id,
    path,
    thumb_path: thumbPath,
    width: image.width,
    height: image.height,
    caption,
    is_public,
    match_id,
    season_id: season?.id ?? null,
    uploaded_by: me.id,
  });
  if (error) {
    await bucket.remove([path, thumbPath]);
    return fail("photo row insert failed", error);
  }

  photosChanged();
  return { ok: true };
}

export async function setPhotoPublic(id: string, isPublic: boolean): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(id) || typeof isPublic !== "boolean") return fail(NOT_FOUND);
  const supabase = await createClient();
  // Home is public, so a photo made private also stops being the team photo.
  const { data, error } = await supabase
    .from("photos")
    .update(isPublic ? { is_public: true } : { is_public: false, is_team_photo: false })
    .eq("id", id)
    .select("id");
  if (error) return fail("visibility update failed", error);
  if (data.length === 0) return fail(NOT_FOUND);
  photosChanged();
  return { ok: true };
}

/** Home hero photo: set_team_photo() clears the old one and makes this one public, in one transaction. */
export async function setTeamPhoto(id: string): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(id)) return fail(NOT_FOUND);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_team_photo", { p_photo_id: id });
  if (error) {
    if (error.code === "P0002") return fail(NOT_FOUND);
    return fail("team photo update failed", error);
  }
  photosChanged();
  return { ok: true };
}

export async function updatePhotoCaption(id: string, caption: string): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(id)) return fail(NOT_FOUND);
  const parsed = photoCaptionSchema.safeParse(caption);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createClient();
  const { data, error } = await supabase.from("photos").update({ caption: parsed.data }).eq("id", id).select("id");
  if (error) return fail("caption update failed", error);
  if (data.length === 0) return fail(NOT_FOUND);
  photosChanged();
  return { ok: true };
}

export async function deletePhoto(id: string): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(id)) return fail(NOT_FOUND);
  const supabase = await createClient();
  const { data, error } = await supabase.from("photos").delete().eq("id", id).select("path, thumb_path");
  if (error) return fail("photo delete failed", error);
  if (data.length === 0) return fail(NOT_FOUND);
  const { error: removeError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .remove([data[0].path, data[0].thumb_path]);
  // The row is gone, so nobody can see the files; log and move on.
  if (removeError) console.error("[photos] file remove failed:", removeError.message);
  photosChanged();
  return { ok: true };
}
