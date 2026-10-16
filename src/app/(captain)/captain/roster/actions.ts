"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isCaptainRole, requireCaptain } from "@/lib/auth";
import { echoValues, firstFieldErrors, type FormState } from "@/lib/form-state";
import { PUBLIC_TAG } from "@/lib/public-data";
import {
  MAX_IMPORT_ROWS,
  playerFormSchema,
  RATING_OPTIONS,
  validateImportRows,
  type ImportResult,
} from "@/lib/roster/schema";
import { createClient } from "@/lib/supabase/server";

// Captain roster writes. RLS ("captains manage players") is the real gate; requireCaptain()
// gives a clean redirect, and the self-checks stop a captain from locking themselves out.

const DUPLICATE_EMAIL = "A player with that email is already on the roster.";

/** Roster changes move the public player count and open spots, and the member pages. */
function rosterChanged() {
  updateTag(PUBLIC_TAG);
  revalidatePath("/captain/roster");
  revalidatePath("/players", "layout");
}

function readPlayerForm(formData: FormData) {
  return playerFormSchema.safeParse({
    full_name: formData.get("full_name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    usta_number: formData.get("usta_number") ?? "",
    ntrp_rating: formData.get("ntrp_rating") ?? "",
    position_pref: formData.get("position_pref") ?? "",
    role: formData.get("role") ?? "",
  });
}

const formError = (message: string, formData: FormData, fieldErrors: Record<string, string> = {}): FormState => ({
  status: "error",
  message,
  fieldErrors,
  values: echoValues(formData),
});

export async function createPlayer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireCaptain();
  const parsed = readPlayerForm(formData);
  if (!parsed.success) {
    return formError("Check the highlighted fields.", formData, firstFieldErrors(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("players").insert(parsed.data);
  if (error) {
    if (error.code === "23505") return formError("Check the highlighted fields.", formData, { email: DUPLICATE_EMAIL });
    console.error("[roster] create failed:", error.message);
    return formError("Something went wrong adding the player. Please try again.", formData);
  }

  rosterChanged();
  redirect("/captain/roster");
}

export async function updatePlayer(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireCaptain();
  if (!z.guid().safeParse(id).success) return formError("That player doesn't exist.", formData);
  const parsed = readPlayerForm(formData);
  if (!parsed.success) {
    return formError("Check the highlighted fields.", formData, firstFieldErrors(parsed.error));
  }

  if (id === me.id) {
    if (!isCaptainRole(parsed.data.role)) {
      return formError("You can't remove your own captain role. Ask another captain.", formData, {
        role: "Keep yourself as captain or co-captain.",
      });
    }
    if (parsed.data.email !== me.email.toLowerCase()) {
      return formError("Changing your own email would sign you out. Ask another captain.", formData, {
        email: "You can't change your own email here.",
      });
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("players").update(parsed.data).eq("id", id).select("id");
  if (error) {
    if (error.code === "23505") return formError("Check the highlighted fields.", formData, { email: DUPLICATE_EMAIL });
    console.error("[roster] update failed:", error.message);
    return formError("Something went wrong saving the player. Please try again.", formData);
  }
  if (data.length === 0) return formError("That player doesn't exist.", formData);

  rosterChanged();
  redirect("/captain/roster");
}

/** Deactivate or reactivate one player. There is no hard delete. */
export async function setPlayerActive(
  id: string,
  active: boolean,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireCaptain();
  if (!z.guid().safeParse(id).success) return formError("That player doesn't exist.", formData);
  if (!active && id === me.id) return formError("You can't deactivate yourself.", formData);

  const supabase = await createClient();
  const { error } = await supabase.from("players").update({ is_active: active }).eq("id", id);
  if (error) {
    console.error("[roster] set active failed:", error.message);
    return formError("Something went wrong. Please try again.", formData);
  }

  rosterChanged();
  return { status: "success" };
}

const bulkSchema = z.object({
  ids: z.array(z.guid()).min(1, "Select at least one player.").max(MAX_IMPORT_ROWS),
  change: z.discriminatedUnion("type", [
    z.object({ type: z.literal("rating"), rating: z.enum(RATING_OPTIONS) }),
    z.object({ type: z.literal("active"), active: z.boolean() }),
  ]),
});

export type BulkResult = { ok: true; count: number } | { ok: false; message: string };

export async function bulkUpdatePlayers(input: z.input<typeof bulkSchema>): Promise<BulkResult> {
  const me = await requireCaptain();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };

  const { ids, change } = parsed.data;
  if (change.type === "active" && !change.active && ids.includes(me.id)) {
    return { ok: false, message: "You can't deactivate yourself. Unselect your own row and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .update(change.type === "rating" ? { ntrp_rating: Number(change.rating) } : { is_active: change.active })
    .in("id", ids)
    .select("id");
  if (error) {
    console.error("[roster] bulk update failed:", error.message);
    return { ok: false, message: "Something went wrong. No players were changed." };
  }

  rosterChanged();
  return { ok: true, count: data.length };
}

const importSchema = z
  .array(z.object({ rowNumber: z.number().int().min(1), values: z.record(z.string(), z.string()) }))
  .min(1, "The file has no rows to import.")
  .max(MAX_IMPORT_ROWS, `Import at most ${MAX_IMPORT_ROWS} rows at a time.`);

/** CSV import: re-validates every mapped row, then upserts the valid ones by email. */
export async function importPlayers(rows: z.input<typeof importSchema>): Promise<ImportResult> {
  await requireCaptain();
  const parsed = importSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid file." };

  const { valid, invalid } = validateImportRows(parsed.data);
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  if (valid.length > 0) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("import_players", {
      p_rows: valid.map((row) => row.data),
    });
    if (error) {
      console.error("[roster] import failed:", error.message);
      return { ok: false, message: "The import failed and nothing was saved. Please try again." };
    }
    for (const row of data) {
      if (row.outcome === "created") created++;
      else if (row.outcome === "updated") updated++;
      else unchanged++;
    }
    rosterChanged();
  }

  return { ok: true, created, updated, unchanged, skipped: invalid };
}
