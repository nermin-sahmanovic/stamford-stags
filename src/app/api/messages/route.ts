import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentPlayer } from "@/lib/auth";
import {
  deliverMessage,
  emailMatch,
  lineupRecipients,
  playerRecipients,
  teamRecipients,
  type LinkKind,
} from "@/lib/email/messages";
import { teamMessage } from "@/lib/email/templates";
import { composeSchema } from "@/lib/messages/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Browsers send Origin on POST; it must be this host (works for localhost and a phone on the LAN). */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/**
 * Captain compose → one email per recipient. The captain check happens here, server-side
 * (/api isn't behind the page guards); messages are written with the service role.
 */
export async function POST(request: NextRequest) {
  const me = await getCurrentPlayer();
  if (!me) return json({ ok: false, message: "Sign in first." }, 401);
  if (!me.isCaptain) return json({ ok: false, message: "Only captains can send team email." }, 403);

  // JSON from our own pages only (a cross-site form can't send this content type or origin).
  if (!request.headers.get("content-type")?.includes("application/json") || !sameOrigin(request)) {
    return json({ ok: false, message: "Bad request." }, 400);
  }

  const parsed = composeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ ok: false, message: parsed.error.issues[0]?.message ?? "Check the message." }, 400);
  }
  const { audience, matchId, playerIds, subject, body } = parsed.data;

  try {
    const admin = createAdminClient();
    const match = matchId ? await emailMatch(matchId, admin) : null;
    if (matchId && !match) return json({ ok: false, message: "That match doesn't exist." }, 404);

    const recipients =
      audience === "team"
        ? await teamRecipients(admin)
        : audience === "match"
          ? await lineupRecipients(matchId!, admin)
          : await playerRecipients(playerIds, admin);
    if (recipients.length === 0) {
      return json(
        { ok: false, message: audience === "match" ? "That match has no lineup yet." : "Choose at least one player." },
        400,
      );
    }

    // One-tap answers only while the match is still open: lineup players confirm their spot,
    // everyone else answers availability.
    const links: LinkKind | null = !match?.open
      ? null
      : audience === "match"
        ? match.lineupPublished
          ? "lineup"
          : null
        : "availability";

    const result = await deliverMessage({
      senderId: me.id,
      replyTo: me.email,
      audience,
      kind: "message",
      matchId: match?.id ?? null,
      subject,
      body,
      recipients,
      links,
      render: (_r, buttons) =>
        teamMessage({
          subject,
          body,
          senderName: me.fullName,
          match,
          buttons,
          buttonsIntro: links === "lineup" ? "Confirm your spot:" : "Can you play?",
        }),
    });

    revalidatePath("/captain/messages", "layout");
    revalidatePath("/messages");
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("[messages] send failed:", err instanceof Error ? err.message : err);
    return json({ ok: false, message: "Something went wrong. Please try again." }, 500);
  }
}
