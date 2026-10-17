"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { RSVP_ANSWERS, type RsvpAnswer } from "./answers";

export type ApplyState =
  | { status: "idle" }
  | { status: "saved"; answer: RsvpAnswer }
  | { status: "error"; message: string };

const input = z.object({ token: z.guid(), answer: z.enum(RSVP_ANSWERS) });

/**
 * One-tap answer from an email link, no sign-in. apply_rsvp_token() verifies the token (exists,
 * not expired, player active, match open) before it writes anything, so the service role here
 * only ever acts for the token's own player and match.
 */
export async function applyRsvp(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const parsed = input.safeParse({ token: formData.get("token"), answer: formData.get("s") });
  if (!parsed.success) return { status: "error", message: "That link isn't valid." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("apply_rsvp_token", { p_token: parsed.data.token, p_answer: parsed.data.answer });
  if (error) {
    if (error.code === "P0001" || error.code === "P0002") return { status: "error", message: `${error.message}.` };
    console.error("[rsvp-link] apply failed:", error.message);
    return { status: "error", message: "Couldn't save your answer. Please try again." };
  }

  revalidatePath("/availability");
  revalidatePath("/matches", "layout");
  revalidatePath("/captain/matches", "layout");
  return { status: "saved", answer: parsed.data.answer };
}
