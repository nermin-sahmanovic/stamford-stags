"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth";
import { echoValues, firstFieldErrors, type FormState } from "@/lib/form-state";
import { geocodeAddress } from "@/lib/matches/geocode";
import {
  checklistLabelSchema,
  DEFAULT_CHECKLIST,
  matchFormSchema,
  resultsSchema,
  type ActionResult,
} from "@/lib/matches/schemas";
import { PUBLIC_TAG } from "@/lib/public-data";
import { createClient } from "@/lib/supabase/server";

// Captain match writes. RLS ("captains manage matches / lineups / results / checklist") is the
// real gate; requireCaptain() gives a clean redirect for everyone else.

const SOMETHING_WRONG = "Something went wrong. Please try again.";
const NOT_FOUND = "That match doesn't exist.";

/** Matches feed the public schedule and results, the member pages and player records. */
function matchesChanged() {
  updateTag(PUBLIC_TAG);
  revalidatePath("/matches", "layout");
  revalidatePath("/availability");
  revalidatePath("/captain/matches", "layout");
  revalidatePath("/players", "layout");
}

const formError = (message: string, formData: FormData, fieldErrors: Record<string, string> = {}): FormState => ({
  status: "error",
  message,
  fieldErrors,
  values: echoValues(formData),
});

const fail = (message: string, error?: { message: string }): ActionResult => {
  if (error) console.error("[matches]", message, error.message);
  return { ok: false, message: error ? SOMETHING_WRONG : message };
};

const isId = (id: string) => z.guid().safeParse(id).success;

function readMatchForm(formData: FormData) {
  return matchFormSchema.safeParse({
    opponent: formData.get("opponent") ?? "",
    starts_at: formData.get("starts_at") ?? "",
    home_away: formData.get("home_away") ?? "",
    location_name: formData.get("location_name") ?? "",
    location_address: formData.get("location_address") ?? "",
    captain_notes: formData.get("captain_notes") ?? "",
    status: formData.get("status") ?? "scheduled",
  });
}

async function coordinates(address: string | null) {
  const hit = await geocodeAddress(address);
  return { latitude: hit?.lat ?? null, longitude: hit?.lon ?? null };
}

export async function createMatch(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireCaptain();
  const parsed = readMatchForm(formData);
  if (!parsed.success) return formError("Check the highlighted fields.", formData, firstFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();
  if (seasonError) {
    console.error("[matches] season lookup failed:", seasonError.message);
    return formError(SOMETHING_WRONG, formData);
  }
  if (!season) return formError("There's no current season. Set one up before adding matches.", formData);

  const { data: match, error } = await supabase
    .from("matches")
    .insert({ ...parsed.data, season_id: season.id, ...(await coordinates(parsed.data.location_address)) })
    .select("id")
    .single();
  if (error) {
    console.error("[matches] create failed:", error.message);
    return formError("Something went wrong adding the match. Please try again.", formData);
  }

  const { error: checklistError } = await supabase
    .from("checklist_items")
    .insert(DEFAULT_CHECKLIST.map((label, i) => ({ match_id: match.id, label, sort: i + 1 })));
  if (checklistError) console.error("[matches] default checklist failed:", checklistError.message);

  matchesChanged();
  redirect(`/captain/matches/${match.id}`);
}

export async function updateMatch(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireCaptain();
  if (!isId(id)) return formError(NOT_FOUND, formData);
  const parsed = readMatchForm(formData);
  if (!parsed.success) return formError("Check the highlighted fields.", formData, firstFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("matches")
    .select("location_address, latitude")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    console.error("[matches] read failed:", readError.message);
    return formError(SOMETHING_WRONG, formData);
  }
  if (!current) return formError(NOT_FOUND, formData);

  // Geocode only when the address changed (or never resolved), so saving notes stays fast.
  const addressChanged = current.location_address !== parsed.data.location_address;
  const location =
    addressChanged || (parsed.data.location_address && current.latitude === null)
      ? await coordinates(parsed.data.location_address)
      : {};

  const { error } = await supabase
    .from("matches")
    .update({ ...parsed.data, ...location })
    .eq("id", id);
  if (error) {
    console.error("[matches] update failed:", error.message);
    return formError("Something went wrong saving the match. Please try again.", formData);
  }

  matchesChanged();
  return { status: "success" };
}

export async function deleteMatch(id: string): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(id)) return fail(NOT_FOUND);
  const supabase = await createClient();
  const { data, error } = await supabase.from("matches").delete().eq("id", id).select("id");
  if (error) return fail("delete failed", error);
  if (data.length === 0) return fail(NOT_FOUND);
  matchesChanged();
  return { ok: true };
}

export async function setLineupPublished(id: string, published: boolean): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(id)) return fail(NOT_FOUND);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .update({ lineup_published_at: published ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return fail("publish failed", error);
  if (data.length === 0) return fail(NOT_FOUND);
  matchesChanged();
  return { ok: true };
}

// --- Checklist -------------------------------------------------------------

export async function addChecklistItem(matchId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireCaptain();
  if (!isId(matchId)) return formError(NOT_FOUND, formData);
  const label = checklistLabelSchema.safeParse(formData.get("label") ?? "");
  if (!label.success) {
    return formError(label.error.issues[0].message, formData, { label: label.error.issues[0].message });
  }

  const supabase = await createClient();
  const { data: last, error: readError } = await supabase
    .from("checklist_items")
    .select("sort")
    .eq("match_id", matchId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) {
    console.error("[matches] checklist read failed:", readError.message);
    return formError(SOMETHING_WRONG, formData);
  }
  const { error } = await supabase
    .from("checklist_items")
    .insert({ match_id: matchId, label: label.data, sort: (last?.sort ?? 0) + 1 });
  if (error) {
    console.error("[matches] checklist add failed:", error.message);
    return formError(SOMETHING_WRONG, formData);
  }
  matchesChanged();
  return { status: "success" };
}

export async function toggleChecklistItem(itemId: string, done: boolean): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(itemId) || typeof done !== "boolean") return fail("That item doesn't exist.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("checklist_items").update({ done }).eq("id", itemId).select("id");
  if (error) return fail("checklist toggle failed", error);
  if (data.length === 0) return fail("That item doesn't exist.");
  matchesChanged();
  return { ok: true };
}

export async function renameChecklistItem(itemId: string, label: string): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(itemId)) return fail("That item doesn't exist.");
  const parsed = checklistLabelSchema.safeParse(label);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checklist_items")
    .update({ label: parsed.data })
    .eq("id", itemId)
    .select("id");
  if (error) return fail("checklist rename failed", error);
  if (data.length === 0) return fail("That item doesn't exist.");
  matchesChanged();
  return { ok: true };
}

export async function deleteChecklistItem(itemId: string): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(itemId)) return fail("That item doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").delete().eq("id", itemId);
  if (error) return fail("checklist delete failed", error);
  matchesChanged();
  return { ok: true };
}

/** Swap an item with its neighbour, then renumber the match's list 1..n. */
export async function moveChecklistItem(itemId: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(itemId) || (direction !== "up" && direction !== "down")) return fail("That item doesn't exist.");
  const supabase = await createClient();
  const { data: item, error: itemError } = await supabase
    .from("checklist_items")
    .select("match_id")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError) return fail("checklist read failed", itemError);
  if (!item) return fail("That item doesn't exist.");

  const { data: items, error } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("match_id", item.match_id)
    .order("sort")
    .order("created_at");
  if (error) return fail("checklist read failed", error);

  const ids = items.map((i) => i.id);
  const from = ids.indexOf(itemId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return { ok: true };
  [ids[from], ids[to]] = [ids[to], ids[from]];

  const results = await Promise.all(
    ids.map((id, i) => supabase.from("checklist_items").update({ sort: i + 1 }).eq("id", id)),
  );
  const failed = results.find((r) => r.error)?.error;
  if (failed) return fail("checklist reorder failed", failed);
  matchesChanged();
  return { ok: true };
}

// --- Results -----------------------------------------------------------------

export async function saveResults(matchId: string, input: z.input<typeof resultsSchema>): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(matchId)) return fail(NOT_FOUND);
  const parsed = resultsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the results.");

  const supabase = await createClient();
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, season:seasons!inner(singles_lines, doubles_lines)")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) return fail("results read failed", matchError);
  if (!match) return fail(NOT_FOUND);

  const { lines, team_points, opponent_points } = parsed.data;
  const maxLine = { singles: match.season.singles_lines, doubles: match.season.doubles_lines };
  if (lines.some((l) => l.line_number > maxLine[l.line_type])) return fail("That line isn't part of this season's format.");

  const played = lines.filter((l) => l.outcome !== "none");
  const skipped = lines.filter((l) => l.outcome === "none");

  if (played.length > 0) {
    const { error } = await supabase.from("line_results").upsert(
      played.map((l) => ({
        match_id: matchId,
        line_type: l.line_type,
        line_number: l.line_number,
        won: l.outcome === "won",
        score: l.score || null,
      })),
      { onConflict: "match_id,line_type,line_number" },
    );
    if (error) return fail("results save failed", error);
  }
  for (const l of skipped) {
    const { error } = await supabase
      .from("line_results")
      .delete()
      .eq("match_id", matchId)
      .eq("line_type", l.line_type)
      .eq("line_number", l.line_number);
    if (error) return fail("results clear failed", error);
  }

  const { error } = await supabase
    .from("matches")
    .update({ team_points, opponent_points, status: "completed" })
    .eq("id", matchId);
  if (error) return fail("match result save failed", error);

  matchesChanged();
  return { ok: true };
}
