import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { sendAvailabilityReminder } from "@/lib/email/messages";
import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_DAYS = 5;

const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Vercel cron sends `Authorization: Bearer $CRON_SECRET`. No secret configured → always 401. */
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Daily: for scheduled matches starting within 5 days, remind players who haven't answered
 * availability. Each match gets one automatic reminder (the captain's button can send more).
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return json({ ok: false }, 401);

  const admin = createAdminClient();
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [matches, done] = await Promise.all([
    admin
      .from("matches")
      .select("id")
      .eq("status", "scheduled")
      .gt("starts_at", now.toISOString())
      .lte("starts_at", until.toISOString()),
    // A reminder that was only logged (email not set up) doesn't count: send a real one later.
    admin
      .from("messages")
      .select("match_id")
      .eq("kind", "reminder")
      .eq("automated", true)
      .neq("status", "logged")
      .not("match_id", "is", null),
  ]);
  if (matches.error || done.error) {
    console.error("[cron] reminder lookup failed:", (matches.error ?? done.error)?.message);
    return json({ ok: false }, 500);
  }

  const alreadyReminded = new Set(done.data.map((m) => m.match_id));
  const report: { matchId: string; sent: number; logged: number; failed: number }[] = [];
  for (const match of matches.data) {
    if (alreadyReminded.has(match.id)) continue;
    try {
      const result = await sendAvailabilityReminder({
        matchId: match.id,
        senderId: null,
        senderName: "Stamford Stags",
        automated: true,
      });
      if (result) report.push({ matchId: match.id, sent: result.sent, logged: result.logged, failed: result.failed });
    } catch (err) {
      console.error("[cron] reminder failed:", err instanceof Error ? err.message : err);
    }
  }

  if (report.length > 0) revalidatePath("/captain/messages", "layout");
  return json({ ok: true, reminded: report });
}
