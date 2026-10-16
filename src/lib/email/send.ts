import "server-only";

export type OutgoingEmail = {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
};

export type SendResult = { ok: true; stubbed: boolean } | { ok: false; error: string };

/** Where public contact messages go: the team mailbox, never a player address. */
export function teamMailbox(): string {
  return process.env.GRAPH_SENDER_MAILBOX || "team-mailbox@not-configured.invalid";
}

/**
 * STUB until Phase 7, which sends through Microsoft Graph from the team mailbox.
 * Logs a one-line summary (no body, no full addresses) and reports success.
 */
export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const domain = (address?: string) => address?.split("@")[1] ?? "none";
  console.info(
    `[email:stub] would send "${email.subject}" to @${domain(email.to)} (reply-to @${domain(email.replyTo)}, ${email.text.length} chars)`,
  );
  return { ok: true, stubbed: true };
}
