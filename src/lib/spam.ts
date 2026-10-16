import "server-only";
import { headers } from "next/headers";

// Cloudflare's published always-pass test keys. Used only outside production
// when no real keys are set, so development needs no Cloudflare account.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TEST_SITE_KEY = "1x00000000000000000000AA";
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

const isProduction = process.env.NODE_ENV === "production";

/** Site key for the widget. Empty in production without real keys, which disables the forms. */
export function getTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || (isProduction ? "" : TEST_SITE_KEY);
}

function getTurnstileSecret(): string {
  return process.env.TURNSTILE_SECRET_KEY || (isProduction ? "" : TEST_SECRET_KEY);
}

/** True when the hidden "website" field was filled in, i.e. a bot. */
export function isHoneypotFilled(formData: FormData): boolean {
  const value = formData.get("website");
  return typeof value === "string" && value.trim() !== "";
}

/** Verifies the Turnstile token server-side. Fails closed on any problem. */
export async function verifyTurnstile(formData: FormData): Promise<boolean> {
  const secret = getTurnstileSecret();
  if (!secret) {
    console.error("[spam] TURNSTILE_SECRET_KEY is not set; refusing form submissions.");
    return false;
  }

  const token = formData.get("cf-turnstile-response");
  if (typeof token !== "string" || token === "") return false;

  const body = new URLSearchParams({ secret, response: token });
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const result = (await res.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error("[spam] Turnstile verification failed:", error);
    return false;
  }
}
