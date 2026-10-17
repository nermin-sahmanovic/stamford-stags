"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { availabilityInputSchema, type ActionResult } from "@/lib/matches/schemas";
import { createClient } from "@/lib/supabase/server";

/**
 * One tap on Available / Maybe / Out. A status goes through set_my_availability(); null
 * ("tap the selected button again") deletes the player's own row, which RLS allows.
 */
export async function setAvailability(matchId: string, status: string | null): Promise<ActionResult> {
  const me = await requireMember();
  const parsed = availabilityInputSchema.safeParse({ matchId, status });
  if (!parsed.success) return { ok: false, message: "That answer isn't valid." };

  const supabase = await createClient();
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("status, starts_at")
    .eq("id", parsed.data.matchId)
    .maybeSingle();
  if (matchError) {
    console.error("[availability] match read failed:", matchError.message);
    return { ok: false, message: "Couldn't save. Try again." };
  }
  if (!match) return { ok: false, message: "That match doesn't exist." };
  if (match.status !== "scheduled" || Date.parse(match.starts_at) < Date.now()) {
    return { ok: false, message: "This match is closed for answers." };
  }

  const { error } =
    parsed.data.status === null
      ? await supabase
          .from("availability")
          .delete()
          .eq("match_id", parsed.data.matchId)
          .eq("player_id", me.id)
      : await supabase.rpc("set_my_availability", {
          p_match_id: parsed.data.matchId,
          p_status: parsed.data.status,
        });
  if (error) {
    console.error("[availability] save failed:", error.message);
    return { ok: false, message: "Couldn't save. Try again." };
  }

  revalidatePath("/availability");
  revalidatePath("/matches", "layout");
  revalidatePath("/players", "layout");
  return { ok: true };
}
