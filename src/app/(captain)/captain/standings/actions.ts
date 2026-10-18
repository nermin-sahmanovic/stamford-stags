"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireCaptain } from "@/lib/auth";
import type { ActionResult } from "@/lib/matches/schemas";
import { PUBLIC_TAG } from "@/lib/public-data";
import { standingsSchema, type StandingRowInput } from "@/lib/standings/schema";
import { createClient } from "@/lib/supabase/server";

/** Replaces the current season's table in one transaction (save_standings; RLS still applies). */
export async function saveStandings(rows: StandingRowInput[]): Promise<ActionResult> {
  await requireCaptain();
  const parsed = standingsSchema.safeParse(rows);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const row = typeof issue?.path[0] === "number" ? `Row ${issue.path[0] + 1}: ` : "";
    return { ok: false, message: `${row}${issue?.message ?? "Check the standings."}` };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_standings", { p_rows: parsed.data });
  if (error) {
    if (error.code === "P0002") return { ok: false, message: "There's no current season. Set one up first." };
    console.error("[standings] save failed:", error.message);
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  updateTag(PUBLIC_TAG);
  revalidatePath("/results");
  revalidatePath("/captain/standings");
  return { ok: true };
}
