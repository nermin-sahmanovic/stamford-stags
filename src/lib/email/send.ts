import "server-only";
import { delivery, devRedirect, emailFrom, resendApiKey, type Delivery } from "@/lib/email/config";

// Resend (REST, no SDK). One email per recipient: nobody is ever in To: with anyone else.

export type OutgoingEmail = {
  to: string;
  /** Shown in the dev redirect banner ("Intended recipient: J. Chen <...>"). */
  toName?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendOutcome = { ok: true; id: string | null } | { ok: false; error: string };
export type SendResult = { ok: true; stubbed: boolean } | { ok: false; error: string };

const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
const BATCH_SIZE = 100; // Resend's per-call limit
const TIMEOUT_MS = 15_000;

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Logs never carry full addresses. */
const domainOf = (address?: string) => address?.split("@")[1] ?? "none";

/** EMAIL_MODE isn't "live": send it to the dev address, and say who it was really for. */
function redirected(email: OutgoingEmail, to: string): OutgoingEmail {
  const intended = email.toName ? `${email.toName} <${email.to}>` : email.to;
  const note = `Intended recipient: ${intended}\n(EMAIL_MODE is not "live", so this email was redirected to you.)`;
  return {
    ...email,
    to,
    subject: `[DEV → ${email.toName ?? email.to}] ${email.subject}`,
    text: `${note}\n\n${email.text}`,
    html: email.html
      ? `<div style="background:#FFEDD5;color:#7C2D12;font:14px/1.4 sans-serif;padding:10px 12px;border-radius:8px;margin:0 0 12px">${escapeHtml(note).replace(/\n/g, "<br>")}</div>${email.html}`
      : undefined,
  };
}

async function postBatch(emails: OutgoingEmail[], key: string, idempotencyKey?: string): Promise<SendOutcome[]> {
  const body = emails.map((e) => ({
    from: emailFrom(),
    to: [e.to],
    subject: e.subject,
    text: e.text,
    ...(e.html ? { html: e.html } : {}),
    ...(e.replyTo ? { reply_to: e.replyTo } : {}),
  }));
  try {
    const response = await fetch(RESEND_BATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await response.json().catch(() => null)) as
      | { data?: { id: string }[]; message?: string; name?: string }
      | null;
    if (!response.ok || !json?.data) {
      const error = `Resend ${response.status}: ${json?.message ?? json?.name ?? "request failed"}`;
      console.error("[email]", error);
      return emails.map(() => ({ ok: false, error }));
    }
    return emails.map((_, i) => ({ ok: true, id: json.data?.[i]?.id ?? null }));
  } catch (err) {
    const error = err instanceof Error && err.name === "TimeoutError" ? "Resend timed out" : "Couldn't reach Resend";
    console.error("[email]", error);
    return emails.map(() => ({ ok: false, error }));
  }
}

/**
 * Send many personalized emails. Results line up with the input. `idempotencyKey` (e.g. the
 * message id) makes a retried request safe; each 100-email chunk gets its own suffix.
 */
export async function sendEmails(
  emails: OutgoingEmail[],
  options: { idempotencyKey?: string } = {},
): Promise<{ delivery: Delivery; results: SendOutcome[] }> {
  const mode = delivery();
  if (emails.length === 0) return { delivery: mode, results: [] };

  if (mode === "log") {
    for (const e of emails) {
      console.info(`[email:log] "${e.subject}" to @${domainOf(e.to)} (${e.text.length} chars, not sent)`);
    }
    return { delivery: mode, results: emails.map(() => ({ ok: true, id: null })) };
  }

  const key = resendApiKey();
  if (!key) {
    const error = "RESEND_API_KEY is not set";
    console.error("[email]", error);
    return { delivery: mode, results: emails.map(() => ({ ok: false, error })) };
  }

  const redirectTo = devRedirect();
  const outgoing = mode === "redirect" && redirectTo ? emails.map((e) => redirected(e, redirectTo)) : emails;

  const results: SendOutcome[] = [];
  for (let i = 0; i < outgoing.length; i += BATCH_SIZE) {
    const chunk = outgoing.slice(i, i + BATCH_SIZE);
    const idempotencyKey = options.idempotencyKey ? `${options.idempotencyKey}-${i / BATCH_SIZE}` : undefined;
    results.push(...(await postBatch(chunk, key, idempotencyKey)));
  }
  return { delivery: mode, results };
}

/** One email (e.g. the Contact form to the team inbox). */
export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const { delivery: mode, results } = await sendEmails([email]);
  const result = results[0];
  return result.ok ? { ok: true, stubbed: mode === "log" } : { ok: false, error: result.error };
}
