"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth";
import { eventFormSchema } from "@/lib/events/schemas";
import { echoValues, firstFieldErrors, type FormState } from "@/lib/form-state";
import type { ActionResult } from "@/lib/matches/schemas";
import { PUBLIC_TAG } from "@/lib/public-data";
import { createClient } from "@/lib/supabase/server";

// Captain event writes. RLS ("captains manage events") is the real gate.

const SOMETHING_WRONG = "Something went wrong. Please try again.";
const NOT_FOUND = "That event doesn't exist.";

/** Events feed the public schedule and ICS feed, and the member calendar. */
function eventsChanged() {
  updateTag(PUBLIC_TAG);
  revalidatePath("/schedule");
  revalidatePath("/captain/events", "layout");
}

const formError = (message: string, formData: FormData, fieldErrors: Record<string, string> = {}): FormState => ({
  status: "error",
  message,
  fieldErrors,
  values: echoValues(formData),
});

const isId = (id: string) => z.guid().safeParse(id).success;

function readEventForm(formData: FormData) {
  return eventFormSchema.safeParse({
    type: formData.get("type") ?? "",
    title: formData.get("title") ?? "",
    starts_at: formData.get("starts_at") ?? "",
    ends_at: formData.get("ends_at") ?? "",
    location: formData.get("location") ?? "",
    description: formData.get("description") ?? "",
    is_public: formData.get("is_public") === "on",
  });
}

export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireCaptain();
  const parsed = readEventForm(formData);
  if (!parsed.success) return formError("Check the highlighted fields.", formData, firstFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();
  if (seasonError) {
    console.error("[events] season lookup failed:", seasonError.message);
    return formError(SOMETHING_WRONG, formData);
  }

  const { error } = await supabase.from("events").insert({ ...parsed.data, season_id: season?.id ?? null });
  if (error) {
    console.error("[events] create failed:", error.message);
    return formError("Something went wrong adding the event. Please try again.", formData);
  }

  eventsChanged();
  redirect("/captain/events");
}

export async function updateEvent(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireCaptain();
  if (!isId(id)) return formError(NOT_FOUND, formData);
  const parsed = readEventForm(formData);
  if (!parsed.success) return formError("Check the highlighted fields.", formData, firstFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").update(parsed.data).eq("id", id).select("id");
  if (error) {
    console.error("[events] update failed:", error.message);
    return formError("Something went wrong saving the event. Please try again.", formData);
  }
  if (data.length === 0) return formError(NOT_FOUND, formData);

  eventsChanged();
  return { status: "success" };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  await requireCaptain();
  if (!isId(id)) return { ok: false, message: NOT_FOUND };
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").delete().eq("id", id).select("id");
  if (error) {
    console.error("[events] delete failed:", error.message);
    return { ok: false, message: SOMETHING_WRONG };
  }
  if (data.length === 0) return { ok: false, message: NOT_FOUND };
  eventsChanged();
  return { ok: true };
}
