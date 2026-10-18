import { connection } from "next/server";
import { buildCalendar, feedRange, ICS_HEADERS } from "@/lib/calendar/ics";
import { siteUrl } from "@/lib/email/config";
import { getPublicCalendar } from "@/lib/public-data";

// Public calendar subscription: every match plus events marked public. No sign-in.
export async function GET() {
  await connection();
  const { from, to } = feedRange();
  try {
    const items = await getPublicCalendar(from, to);
    const body = buildCalendar({ name: "Stamford Stags", items, siteUrl: siteUrl(), personal: false });
    return new Response(body, { headers: { ...ICS_HEADERS, "Cache-Control": "public, max-age=900" } });
  } catch (err) {
    console.error("[calendar] public feed failed:", err instanceof Error ? err.message : err);
    return new Response("Calendar unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
