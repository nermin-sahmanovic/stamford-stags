import "server-only";
import { deliverMessage, emailMatch, playerRecipients, type DeliverResult } from "@/lib/email/messages";
import { lineupNotice } from "@/lib/email/templates";
import { lineLabel } from "@/lib/matches/queries";
import { shortName } from "@/lib/roster/display";
import { createAdminClient } from "@/lib/supabase/admin";

export type LineupNotice = {
  matchId: string;
  playerIds: string[];
  /** "published": the whole lineup went out. "updated": these players are new to a line. */
  kind: "published" | "updated";
  senderId: string;
  replyTo: string | null;
};

/**
 * Email each player their line, partner and court with one-tap Confirm / Decline links.
 * Called by saveLineup() after requireCaptain(); uses the service role.
 */
export async function notifyLineupPublished(notice: LineupNotice): Promise<DeliverResult | null> {
  if (notice.playerIds.length === 0) return null;
  const admin = createAdminClient();
  const [match, slots, recipients] = await Promise.all([
    emailMatch(notice.matchId, admin),
    admin
      .from("lineup_slots")
      .select("line_type, line_number, seat, court_label, player:players!inner(id, full_name)")
      .eq("match_id", notice.matchId)
      .order("seat"),
    playerRecipients(notice.playerIds, admin),
  ]);
  if (slots.error) throw slots.error;
  if (!match) return null;

  const spotFor = new Map<string, { line: string; partner: string | null; court: string | null }>();
  for (const slot of slots.data) {
    const line = lineLabel(slot.line_type, slot.line_number);
    const partner = slots.data.find(
      (s) => s.line_type === slot.line_type && s.line_number === slot.line_number && s.player.id !== slot.player.id,
    );
    spotFor.set(slot.player.id, {
      line,
      partner: partner ? shortName(partner.player.full_name) : null,
      court: slot.court_label,
    });
  }

  // Stored as the message body for the history page: "S1: J. Chen · Ct 3", "D1: R. Patel & D. Kim · Ct 4", ...
  const byLine = new Map<string, { order: number; names: string[]; court: string | null }>();
  for (const s of slots.data) {
    const label = lineLabel(s.line_type, s.line_number);
    const entry = byLine.get(label) ?? {
      order: (s.line_type === "singles" ? 0 : 10) + s.line_number,
      names: [],
      court: s.court_label,
    };
    entry.names.push(shortName(s.player.full_name));
    byLine.set(label, entry);
  }
  const summary = [...byLine.entries()]
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([label, l]) => `${label}: ${l.names.join(" & ")}${l.court ? ` · ${l.court}` : ""}`);

  const subjectLine = `${notice.kind === "published" ? "Lineup posted" : "Lineup update"}: ${match.label} · ${match.when}`;
  return deliverMessage({
    senderId: notice.senderId,
    replyTo: notice.replyTo,
    audience: "match",
    kind: "lineup",
    matchId: notice.matchId,
    subject: subjectLine,
    body: summary.join("\n"),
    recipients: recipients.filter((r) => spotFor.has(r.playerId)),
    links: "lineup",
    render: (r, buttons) => {
      const spot = spotFor.get(r.playerId)!;
      return lineupNotice({
        kind: notice.kind,
        firstName: r.name,
        matchLabel: match.label,
        when: match.when,
        venue: match.venue,
        line: spot.line,
        partner: spot.partner,
        court: spot.court,
        matchUrl: match.url,
        buttons,
      });
    },
  });
}
