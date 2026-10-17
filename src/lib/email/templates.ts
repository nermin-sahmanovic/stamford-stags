import "server-only";

// Plain text + small inline-styled HTML (email clients ignore stylesheets). Every piece of
// user-entered text is escaped. Colors follow the design system: navy, ball green on navy only.

export type Rendered = { subject: string; text: string; html: string };
export type LinkButton = { label: string; href: string; tone?: "primary" | "plain" };

const NAVY = "#0F172A";
const BALL = "#C7EA46";
const COURT = "#2563EB";

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Paragraphs from plain text: blank lines split paragraphs, single newlines become <br>. */
const paragraphs = (text: string) =>
  text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

function buttonsHtml(buttons: LinkButton[]) {
  if (buttons.length === 0) return "";
  const cells = buttons
    .map((b) => {
      const primary = b.tone !== "plain";
      const style = primary
        ? `background:${NAVY};color:${BALL};border:2px solid ${NAVY}`
        : `background:#FFFFFF;color:${NAVY};border:2px solid #CBD5E1`;
      return `<a href="${escapeHtml(b.href)}" style="display:inline-block;${style};border-radius:10px;padding:12px 18px;margin:0 8px 8px 0;font:700 15px/20px Arial,sans-serif;text-decoration:none">${escapeHtml(b.label)}</a>`;
    })
    .join("");
  return `<div style="margin:16px 0 4px">${cells}</div>`;
}

function layout(inner: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#F4F6F9;padding:16px">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden">
<div style="background:${NAVY};border-bottom:2px solid ${BALL};padding:12px 16px;font:700 18px/24px Arial,sans-serif;letter-spacing:1px;color:#FFFFFF">STAMFORD <span style="color:${BALL}">STAGS</span></div>
<div style="padding:16px;font:16px/1.5 Arial,sans-serif;color:${NAVY}">${inner}</div>
<div style="padding:12px 16px;border-top:1px solid #E2E8F0;font:13px/1.4 Arial,sans-serif;color:#475569">${footer}</div>
</div></body></html>`;
}

const buttonsText = (buttons: LinkButton[]) => buttons.map((b) => `${b.label}: ${b.href}`).join("\n");

const footerText = "Stamford Stags · USTA adult league tennis. Reply to this email to reach your captain.";

/** A captain's message, optionally about a match, optionally with one-tap answer buttons. */
export function teamMessage(input: {
  subject: string;
  body: string;
  senderName: string | null;
  match?: { label: string; when: string; url: string } | null;
  buttons?: LinkButton[];
  buttonsIntro?: string;
}): Rendered {
  const buttons = input.buttons ?? [];
  const matchLine = input.match ? `${input.match.label} · ${input.match.when}` : null;
  const sign = input.senderName ? `— ${input.senderName}` : null;

  const text = [
    input.body.trim(),
    sign,
    matchLine ? `Match: ${matchLine}\n${input.match!.url}` : null,
    buttons.length ? `${input.buttonsIntro ?? "Tap to answer:"}\n${buttonsText(buttons)}` : null,
    footerText,
  ]
    .filter(Boolean)
    .join("\n\n");

  const html = layout(
    [
      paragraphs(input.body),
      sign ? `<p style="margin:0 0 12px;color:#475569">${escapeHtml(sign)}</p>` : "",
      matchLine
        ? `<p style="margin:12px 0 0"><a href="${escapeHtml(input.match!.url)}" style="color:${COURT};font-weight:700">${escapeHtml(matchLine)}</a></p>`
        : "",
      buttons.length
        ? `<p style="margin:16px 0 0;font-weight:700">${escapeHtml(input.buttonsIntro ?? "Tap to answer:")}</p>${buttonsHtml(buttons)}`
        : "",
    ].join(""),
    escapeHtml(footerText),
  );
  return { subject: input.subject, text, html };
}

/** "You're on D2 with S. Novak · Ct 6" plus Confirm / Decline. */
export function lineupNotice(input: {
  kind: "published" | "updated";
  firstName: string;
  matchLabel: string;
  when: string;
  venue: string | null;
  line: string;
  partner: string | null;
  court: string | null;
  matchUrl: string;
  buttons: LinkButton[];
}): Rendered {
  const spot = `${input.line}${input.partner ? ` with ${input.partner}` : ""}${input.court ? ` · ${input.court}` : ""}`;
  const lead =
    input.kind === "published"
      ? `The lineup for ${input.matchLabel} is posted.`
      : `The lineup for ${input.matchLabel} changed, and you're in it.`;
  const subject = `${input.kind === "published" ? "Lineup posted" : "Lineup update"}: ${input.matchLabel} · ${input.when}`;
  const details = [input.when, input.venue].filter(Boolean).join(" · ");

  const text = [
    `Hi ${input.firstName},`,
    lead,
    `You're on ${spot}.\n${details}`,
    `Please confirm or decline:\n${buttonsText(input.buttons)}`,
    `Full lineup: ${input.matchUrl}`,
    footerText,
  ].join("\n\n");

  const html = layout(
    `<p style="margin:0 0 12px">Hi ${escapeHtml(input.firstName)},</p>
<p style="margin:0 0 12px">${escapeHtml(lead)}</p>
<div style="background:${NAVY};color:#FFFFFF;border-radius:12px;padding:12px 14px;margin:0 0 4px">
<div style="font:700 12px/16px Arial,sans-serif;letter-spacing:1px;color:${BALL}">YOUR SPOT</div>
<div style="font:700 18px/24px Arial,sans-serif">${escapeHtml(spot)}</div>
<div style="font:14px/20px Arial,sans-serif;color:#CBD5E1">${escapeHtml(details)}</div></div>
${buttonsHtml(input.buttons)}
<p style="margin:8px 0 0"><a href="${escapeHtml(input.matchUrl)}" style="color:${COURT};font-weight:700">See the full lineup</a></p>`,
    escapeHtml(footerText),
  );
  return { subject, text, html };
}

/** Contact form → team inbox. Plain text; Reply-To is the visitor. */
export function contactMessage(input: { name: string; email: string; topic: string; message: string }) {
  return {
    subject: `[Website] ${input.topic} — ${input.name}`,
    text: `From: ${input.name} <${input.email}>\nTopic: ${input.topic}\n\n${input.message}`,
  };
}
