import type { NextRequest } from "next/server";
import { cronAuthorized, cronJson } from "@/lib/cron";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Daily: one cheap read so the free Supabase project never counts as inactive (it pauses after
 * a week without activity), even in the off-season when the reminders cron finds no matches.
 * Uses the public RPC, so no service role is involved.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return cronJson({ ok: false }, 401);

  const { error } = await createPublicClient().rpc("public_team_summary");
  if (error) {
    console.error("[cron] keep-alive failed:", error.message);
    return cronJson({ ok: false }, 500);
  }
  return cronJson({ ok: true });
}
