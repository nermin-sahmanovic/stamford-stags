"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
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
