/** Path prefixes that need a signed-in roster member. Captain pages are under /captain. */
export const protectedPrefixes = [
  "/matches",
  "/availability",
  "/players",
  "/messages",
  "/captain",
] as const;

export function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Where people land after signing in when no other page was requested. */
export const DEFAULT_AFTER_SIGN_IN = "/matches";

/** Only same-site paths: one leading slash, no protocol-relative "//" or "/\". */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  return value;
}

/** Short-lived cookie holding the page to open after the magic link is clicked. */
export const NEXT_COOKIE = "stags_next";
