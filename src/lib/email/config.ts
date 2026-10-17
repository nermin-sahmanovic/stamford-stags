import "server-only";

// Email settings, all from the environment. See docs/EMAIL_SETUP.md.

/** "live" only when explicitly set. Anything else (including unset) redirects every email. */
export type EmailMode = "live" | "redirect";
/** What actually happens to a send: real delivery, redirected to the dev address, or log only. */
export type Delivery = "live" | "redirect" | "log";

export const emailMode = (): EmailMode => (process.env.EMAIL_MODE?.trim() === "live" ? "live" : "redirect");

/** Where every email goes unless EMAIL_MODE=live (your own address in development). */
export const devRedirect = () => process.env.EMAIL_DEV_REDIRECT?.trim() || null;

/** Sender. Resend's shared test sender works before the domain is verified (it only delivers to you). */
export const emailFrom = () => process.env.EMAIL_FROM?.trim() || "Stamford Stags <onboarding@resend.dev>";

/** Where the public Contact form goes. Public pages never read player addresses. */
export const teamInbox = () => process.env.TEAM_INBOX?.trim() || null;

export const resendApiKey = () => process.env.RESEND_API_KEY?.trim() || null;

/**
 * Live mode always tries to deliver (and fails loudly without a key). Redirect mode falls back
 * to logging when there's no key or no redirect address, so development never needs either.
 */
export function delivery(): Delivery {
  if (emailMode() === "live") return "live";
  return resendApiKey() && devRedirect() ? "redirect" : "log";
}

/** Absolute links in emails. Cron runs have no request origin, so this comes from the environment. */
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}
