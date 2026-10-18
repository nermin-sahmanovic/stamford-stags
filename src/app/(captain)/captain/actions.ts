"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/email/messages";
import { PUBLIC_TAG } from "@/lib/public-data";
import { createClient } from "@/lib/supabase/server";

export type InviteResult =
  | { ok: true; email: "sent" | "logged" | "failed" }
  | { ok: false; message: string };

/**
 * Dashboard "Invite": invite_registration() adds the player (or links the existing one with that
 * email) and marks the registration invited in one transaction; then the welcome email goes out.
 * The player is on the roster even if the email fails, so the result says which happened.
 */
export async function inviteRegistration(registrationId: string): Promise<InviteResult> {
  const me = await requireCaptain();
  if (!z.guid().safeParse(registrationId).success) return { ok: false, message: "That registration doesn't exist." };

  const supabase = await createClient();
  const { data: playerId, error } = await supabase.rpc("invite_registration", { p_registration_id: registrationId });
  if (error) {
    if (error.code === "P0002") return { ok: false, message: "That registration was already handled. Refresh to update." };
    console.error("[captain] invite_registration failed:", error.message);
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, full_name, email")
    .eq("id", playerId)
    .single();

  revalidatePath("/captain");
  revalidatePath("/captain/roster");
  revalidatePath("/players", "layout");
  updateTag(PUBLIC_TAG); // open spots on Home

  if (playerError) {
    console.error("[captain] invited player read failed:", playerError.message);
    return { ok: true, email: "failed" };
  }

  try {
    const result = await sendInviteEmail({
      player: { playerId: player.id, name: player.full_name, email: player.email },
      senderId: me.id,
      senderName: me.fullName,
      replyTo: me.email,
    });
    revalidatePath("/captain/messages", "layout");
    return { ok: true, email: result.failed > 0 ? "failed" : result.logged > 0 ? "logged" : "sent" };
  } catch (err) {
    console.error("[captain] invite email failed:", err instanceof Error ? err.message : err);
    return { ok: true, email: "failed" };
  }
}
