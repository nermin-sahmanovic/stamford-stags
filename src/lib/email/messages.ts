import "server-only";
import type { Database } from "@/lib/database.types";
import { siteUrl, teamInbox } from "@/lib/email/config";
import { sendEmails, type OutgoingEmail } from "@/lib/email/send";
import { teamMessage, type LinkButton, type Rendered } from "@/lib/email/templates";
import { formatTime, formatWeekdayDate } from "@/lib/format";
import { opponentLabel } from "@/lib/matches/display";
import { createAdminClient } from "@/lib/supabase/admin";

// Team email delivery. Uses the service role (messages are written server-side only), so every
// caller must already have passed requireCaptain() / a captain check, or be the cron route
// after its CRON_SECRET check.

export type Audience = Database["public"]["Enums"]["message_audience"];
export type MessageKind = "message" | "reminder" | "lineup";
export type Recipient = { playerId: string; name: string; email: string };
export type LinkKind = "availability" | "lineup";

type Admin = ReturnType<typeof createAdminClient>;

const toRecipients = (rows: { id: string; full_name: string; email: string }[]): Recipient[] =>
  rows.map((p) => ({ playerId: p.id, name: p.full_name, email: p.email }));

// --- Recipient lists ----------------------------------------------------------

export async function teamRecipients(admin: Admin = createAdminClient()) {
  const { data, error } = await admin.from("players").select("id, full_name, email").eq("is_active", true).order("full_name");
  if (error) throw error;
  return toRecipients(data);
}

/** The match lineup (published or not: the captain chose to email it). */
export async function lineupRecipients(matchId: string, admin: Admin = createAdminClient()) {
  const { data, error } = await admin
    .from("lineup_slots")
    .select("player:players!inner(id, full_name, email, is_active)")
    .eq("match_id", matchId);
  if (error) throw error;
  return toRecipients(data.map((s) => s.player).filter((p) => p.is_active));
}

export async function playerRecipients(ids: string[], admin: Admin = createAdminClient()) {
  if (ids.length === 0) return [];
  const { data, error } = await admin
    .from("players")
    .select("id, full_name, email")
    .eq("is_active", true)
    .in("id", ids)
    .order("full_name");
  if (error) throw error;
  return toRecipients(data);
}

/** Active players with no availability answer for the match. */
export async function nonResponders(matchId: string, admin: Admin = createAdminClient()) {
  const [players, answers] = await Promise.all([
    admin.from("players").select("id, full_name, email").eq("is_active", true).order("full_name"),
    admin.from("availability").select("player_id").eq("match_id", matchId),
  ]);
  if (players.error) throw players.error;
  if (answers.error) throw answers.error;
  const answered = new Set(answers.data.map((a) => a.player_id));
  return toRecipients(players.data.filter((p) => !answered.has(p.id)));
}

// --- Matches and links ---------------------------------------------------------

export type EmailMatch = {
  id: string;
  label: string;
  when: string;
  venue: string | null;
  url: string;
  open: boolean;
  lineupPublished: boolean;
};

export async function emailMatch(matchId: string, admin: Admin = createAdminClient()): Promise<EmailMatch | null> {
  const { data, error } = await admin
    .from("matches")
    .select("id, opponent, home_away, starts_at, status, location_name, lineup_published_at")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    label: opponentLabel(data.opponent, data.home_away),
    when: `${formatWeekdayDate(data.starts_at)}, ${formatTime(data.starts_at)}`,
    venue: data.location_name,
    url: `${siteUrl()}/matches/${data.id}`,
    open: data.status === "scheduled" && Date.parse(data.starts_at) > Date.now(),
    lineupPublished: data.lineup_published_at !== null,
  };
}

const rsvpUrl = (token: string, answer: string) => `${siteUrl()}/r/${token}?s=${answer}`;

export function rsvpButtons(kind: LinkKind, token: string): LinkButton[] {
  return kind === "lineup"
    ? [
        { label: "Confirm", href: rsvpUrl(token, "confirmed") },
        { label: "Decline", href: rsvpUrl(token, "declined"), tone: "plain" },
      ]
    : [
        { label: "Available", href: rsvpUrl(token, "available") },
        { label: "Maybe", href: rsvpUrl(token, "maybe"), tone: "plain" },
        { label: "Can't play", href: rsvpUrl(token, "unavailable"), tone: "plain" },
      ];
}

// --- Delivery -------------------------------------------------------------------

/** sent = handed to Resend; logged = only written to the server log (never sent); failed = Resend refused. */
export type DeliverResult = { messageId: string; sent: number; logged: number; failed: number };

/**
 * Log the message, issue RSVP tokens if the emails carry one-tap links, send one email per
 * recipient, and record each recipient's outcome. `render` builds that recipient's email.
 */
export async function deliverMessage(input: {
  senderId: string | null;
  replyTo?: string | null;
  audience: Audience;
  kind: MessageKind;
  automated?: boolean;
  matchId: string | null;
  subject: string;
  body: string;
  recipients: Recipient[];
  links: LinkKind | null;
  render: (recipient: Recipient, buttons: LinkButton[]) => Rendered;
}): Promise<DeliverResult> {
  const admin = createAdminClient();
  const seen = new Set<string>();
  const recipients = input.recipients.filter((r) => {
    const key = r.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const { data: message, error: insertError } = await admin
    .from("messages")
    .insert({
      sent_by: input.senderId,
      audience: input.audience,
      kind: input.kind,
      automated: input.automated ?? false,
      match_id: input.matchId,
      subject: input.subject,
      body: input.body,
      recipient_count: recipients.length,
      provider: "resend",
      status: "queued",
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const { error: recipientsError } = await admin.from("message_recipients").insert(
    recipients.map((r) => ({ message_id: message.id, player_id: r.playerId, email: r.email, status: "queued" })),
  );
  if (recipientsError) throw recipientsError;

  const tokens = new Map<string, string>();
  if (input.links && input.matchId && recipients.length > 0) {
    const { data, error } = await admin.rpc("issue_rsvp_tokens", {
      p_match_id: input.matchId,
      p_player_ids: recipients.map((r) => r.playerId),
    });
    if (error) throw error;
    for (const t of data) tokens.set(t.player_id, t.token);
  }

  const replyTo = input.replyTo ?? teamInbox() ?? undefined;
  const emails: OutgoingEmail[] = recipients.map((r) => {
    const token = tokens.get(r.playerId);
    const rendered = input.render(r, input.links && token ? rsvpButtons(input.links, token) : []);
    return { to: r.email, toName: r.name, replyTo, ...rendered };
  });

  const { delivery, results } = await sendEmails(emails, { idempotencyKey: message.id });
  // Log mode never reaches a provider, so those emails are "logged", not "sent".
  const logOnly = delivery === "log";
  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  const sent = logOnly ? 0 : ok;
  const logged = logOnly ? ok : 0;
  const firstError = results.find((r) => !r.ok);

  const { error: outcomeError } = await admin.from("message_recipients").upsert(
    recipients.map((r, i) => {
      const result = results[i];
      return {
        message_id: message.id,
        player_id: r.playerId,
        email: r.email,
        status: result.ok ? (logOnly ? "logged" : "sent") : "failed",
        error: result.ok ? null : result.error,
        provider_message_id: result.ok ? result.id : null,
      };
    }),
    { onConflict: "message_id,email" },
  );
  if (outcomeError) console.error("[email] recipient outcome save failed:", outcomeError.message);

  const { error: statusError } = await admin
    .from("messages")
    .update({
      status: recipients.length > 0 && ok === 0 ? "failed" : failed > 0 ? "partial" : logOnly ? "logged" : "sent",
      provider: logOnly ? null : "resend",
      error: firstError && !firstError.ok ? `${failed} of ${recipients.length} failed: ${firstError.error}` : null,
      delivery,
      sent_at: new Date().toISOString(),
    })
    .eq("id", message.id);
  if (statusError) console.error("[email] message status save failed:", statusError.message);

  return { messageId: message.id, sent, logged, failed };
}

// --- Reminders -------------------------------------------------------------------

/**
 * Nudge everyone who hasn't answered availability for a match. Null when there's nobody to
 * remind or the match is closed.
 */
export async function sendAvailabilityReminder(input: {
  matchId: string;
  senderId: string | null;
  senderName: string | null;
  replyTo?: string | null;
  automated: boolean;
}): Promise<DeliverResult | null> {
  const admin = createAdminClient();
  const match = await emailMatch(input.matchId, admin);
  if (!match || !match.open) return null;
  const recipients = await nonResponders(input.matchId, admin);
  if (recipients.length === 0) return null;

  const subject = `Are you available? ${match.label} · ${match.when}`;
  const body = `We still need your availability for ${match.label} on ${match.when}. One tap below and you're done.`;
  return deliverMessage({
    senderId: input.senderId,
    replyTo: input.replyTo,
    audience: "custom",
    kind: "reminder",
    automated: input.automated,
    matchId: input.matchId,
    subject,
    body,
    recipients,
    links: "availability",
    render: (_r, buttons) =>
      teamMessage({ subject, body, senderName: input.senderName, match, buttons, buttonsIntro: "Can you play?" }),
  });
}
