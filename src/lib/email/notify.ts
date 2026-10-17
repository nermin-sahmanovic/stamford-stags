import "server-only";
import type { SendResult } from "@/lib/email/send";

export type LineupNotice = {
  matchId: string;
  playerIds: string[];
  /** "published": the whole lineup went out. "updated": these players are new to a line. */
  kind: "published" | "updated";
};

/**
 * STUB until Phase 7, which emails each player their line and court with one-tap
 * Confirm / Decline RSVP links. Logs counts only (no names or addresses).
 */
export async function notifyLineupPublished(notice: LineupNotice): Promise<SendResult> {
  console.info(
    `[notify:stub] lineup ${notice.kind} for match ${notice.matchId}: would notify ${notice.playerIds.length} player(s)`,
  );
  return { ok: true, stubbed: true };
}
