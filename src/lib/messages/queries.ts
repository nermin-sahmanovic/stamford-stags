import "server-only";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { shortName } from "@/lib/roster/display";
import { readClient } from "@/lib/supabase/read";
import { AUDIENCE_LABELS } from "./schemas";

// Message reads use the signed-in user's client: RLS lets captains read every message and
// players only the ones they received.

export type Audience = Database["public"]["Enums"]["message_audience"];
/** "logged": only written to the server log (email not set up), never sent. */
export type MessageStatus = "queued" | "sent" | "logged" | "partial" | "failed";
export type RecipientStatus = "queued" | "sent" | "logged" | "failed";

export const STATUS_LABELS: Record<MessageStatus, string> = {
  queued: "Sending",
  sent: "Sent",
  logged: "Logged (not sent)",
  partial: "Some failed",
  failed: "Failed",
};
export type MessageKind = "message" | "reminder" | "lineup" | "invite";

export { AUDIENCE_LABELS };

export const KIND_LABELS: Record<MessageKind, string> = {
  message: "Message",
  reminder: "Reminder",
  lineup: "Lineup",
  invite: "Invite",
};

const LIST_COLUMNS =
  "id, subject, audience, kind, automated, recipient_count, status, delivery, sent_at, match:matches(id, opponent, home_away, starts_at), sender:players!messages_sent_by_fkey(full_name)";

type ListRow = {
  id: string;
  subject: string;
  audience: Audience;
  kind: string;
  automated: boolean;
  recipient_count: number;
  status: string;
  delivery: string | null;
  sent_at: string;
  match: { id: string; opponent: string; home_away: "home" | "away"; starts_at: string } | null;
  sender: { full_name: string } | null;
};

function toListItem(row: ListRow) {
  return {
    id: row.id,
    subject: row.subject,
    audience: row.audience,
    kind: row.kind as MessageKind,
    automated: row.automated,
    recipientCount: row.recipient_count,
    status: row.status as MessageStatus,
    /** Dev mode: really sent, but to EMAIL_DEV_REDIRECT instead of the players. */
    redirected: row.delivery === "redirect",
    sentAt: row.sent_at,
    match: row.match,
    sender: row.automated ? "Automatic" : row.sender ? shortName(row.sender.full_name) : null,
  };
}

export type MessageListItem = ReturnType<typeof toListItem>;

/** Captain history, newest first. */
export async function getMessageHistory(limit = 100) {
  const supabase = await readClient();
  const { data, error } = await supabase
    .from("messages")
    .select(LIST_COLUMNS)
    .order("sent_at", { ascending: false })
    .limit(limit)
    .overrideTypes<ListRow[], { merge: false }>();
  if (error) throw error;
  return data.map(toListItem);
}

/** One message with every recipient's delivery outcome (captains). */
export async function getMessage(id: string) {
  if (!z.guid().safeParse(id).success) return null;
  const supabase = await readClient();
  const [message, recipients] = await Promise.all([
    supabase
      .from("messages")
      .select(`${LIST_COLUMNS}, body, error`)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<(ListRow & { body: string; error: string | null }) | null, { merge: false }>(),
    supabase
      .from("message_recipients")
      .select("email, status, error, player:players(full_name)")
      .eq("message_id", id)
      .order("email"),
  ]);
  if (message.error) throw message.error;
  if (recipients.error) throw recipients.error;
  if (!message.data) return null;
  return {
    ...toListItem(message.data),
    body: message.data.body,
    error: message.data.error,
    recipients: recipients.data
      .map((r) => ({
        name: r.player ? shortName(r.player.full_name) : r.email,
        email: r.email,
        status: r.status as RecipientStatus,
        error: r.error,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Messages this player received (captains also only see their own here). */
export async function getMyMessages(playerId: string, limit = 50) {
  const supabase = await readClient();
  const { data, error } = await supabase
    .from("messages")
    .select(`${LIST_COLUMNS}, body, mine:message_recipients!inner(player_id)`)
    .eq("mine.player_id", playerId)
    .order("sent_at", { ascending: false })
    .limit(limit)
    .overrideTypes<(ListRow & { body: string })[], { merge: false }>();
  if (error) throw error;
  return data.map((row) => ({ ...toListItem(row), body: row.body }));
}

/** Compose form: active roster plus upcoming matches with their lineup players. */
export async function getComposeData() {
  const supabase = await readClient();
  const [players, matches] = await Promise.all([
    supabase.from("players").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase
      .from("matches")
      .select("id, opponent, home_away, starts_at, lineup_published_at, lineup:lineup_slots(player_id)")
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at"),
  ]);
  if (players.error) throw players.error;
  if (matches.error) throw matches.error;
  return {
    players: players.data.map((p) => ({ id: p.id, name: shortName(p.full_name) })),
    matches: matches.data.map((m) => ({
      id: m.id,
      opponent: m.opponent,
      homeAway: m.home_away,
      startsAt: m.starts_at,
      lineupPublished: m.lineup_published_at !== null,
      lineupPlayerIds: m.lineup.map((s) => s.player_id),
    })),
  };
}

export type ComposeData = Awaited<ReturnType<typeof getComposeData>>;
