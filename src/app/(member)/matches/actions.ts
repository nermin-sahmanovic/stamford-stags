"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { rsvpInputSchema, type ActionResult } from "@/lib/matches/schemas";
import { createClient } from "@/lib/supabase/server";

/**
 * Confirm / Decline a lineup spot. set_my_rsvp() only touches the caller's own slot, and only
 * while the lineup is published and the match hasn't started.
 */
export async function setMyRsvp(matchId: string, rsvp: string): Promise<ActionResult> {
  await requireMember();
  const parsed = rsvpInputSchema.safeParse({ matchId, rsvp });
  if (!parsed.success) return { ok: false, message: "That answer isn't valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_rsvp", {
    p_match_id: parsed.data.matchId,
    p_rsvp: parsed.data.rsvp,
  });
  if (error) {
    if (error.code === "P0002" || error.code === "P0001") return { ok: false, message: `${error.message}.` };
    console.error("[rsvp] save failed:", error.message);
    return { ok: false, message: "Couldn't save. Try again." };
  }

  revalidatePath("/matches", "layout");
  revalidatePath("/captain/matches", "layout");
  return { ok: true };
}
