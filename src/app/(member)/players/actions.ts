"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { personalFeedUrl } from "@/lib/calendar/queries";
import { echoValues, firstFieldErrors, type FormState } from "@/lib/form-state";
import { myProfileSchema } from "@/lib/roster/schema";
import { createClient } from "@/lib/supabase/server";

/** A player updates their own phone and preferred position through update_my_profile(). */
export async function updateMyProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMember();
  const values = echoValues(formData);
  const parsed = myProfileSchema.safeParse({
    phone: formData.get("phone") ?? "",
    position_pref: formData.get("position_pref") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_phone: parsed.data.phone ?? "",
    p_position_pref: parsed.data.position_pref,
  });
  if (error) {
    console.error("[players] update_my_profile failed:", error.message);
    return {
      status: "error",
      message: "Something went wrong saving your profile. Please try again.",
      fieldErrors: {},
      values,
    };
  }

  revalidatePath("/players");
  revalidatePath(`/players/${me.id}`);
  return { status: "success" };
}

export type CalendarTokenResult = { ok: true; feedUrl: string } | { ok: false; message: string };

/** "Reset link": a new personal calendar token. The old feed URL stops working at once. */
export async function regenerateCalendarToken(): Promise<CalendarTokenResult> {
  const me = await requireMember();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_my_calendar_token");
  if (error) {
    console.error("[players] regenerate_my_calendar_token failed:", error.message);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  revalidatePath(`/players/${me.id}`);
  revalidatePath("/schedule");
  return { ok: true, feedUrl: personalFeedUrl(data) };
}
