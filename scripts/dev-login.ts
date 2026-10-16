// Dev only. Prints a one-time localhost sign-in URL for any email, without sending mail,
// so testing isn't blocked by Supabase's built-in mailer limits.
//
//   npm run dev-login -- sahmanovic+player@gmail.com
//   npm run dev-login -- someone@example.com http://localhost:3001
//
// The URL goes to our token_hash route (src/app/api/auth/callback). The auth user is
// created if it doesn't exist yet; the roster trigger links it to a players row with
// the same email. Never imported by the app and excluded from deploys (.vercelignore).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DEV_PROJECT_REF = "jljyylzalwiczrimaguz"; // Stags-Dev

function fail(message: string): never {
  console.error(`dev-login: ${message}`);
  process.exit(1);
}

function readEnvLocal(): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    fail(".env.local not found in the project root.");
  }
  const vars: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    // Same rule as test-anon-access.ps1: the value stops at whitespace or an inline "#".
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*([^#\s]*)/);
    if (match) vars[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return vars;
}

async function main() {
  if (process.env.NODE_ENV !== "development") {
    fail(`refusing to run: NODE_ENV is "${process.env.NODE_ENV ?? ""}", not "development". Use npm run dev-login.`);
  }
  if (process.env.VERCEL || process.env.CI) {
    fail("refusing to run in a deploy or CI environment.");
  }

  const [email, origin = "http://localhost:3000"] = process.argv.slice(2);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail("usage: npm run dev-login -- <email> [origin]");
  }
  const originUrl = new URL(origin);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(originUrl.hostname)) {
    fail(`refusing to build a link for ${originUrl.hostname}: localhost only.`);
  }

  const env = readEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    fail("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from .env.local.");
  }
  if (new URL(url).hostname !== `${DEV_PROJECT_REF}.supabase.co`) {
    fail(`refusing to run: .env.local doesn't point at Stags-Dev (${DEV_PROJECT_REF}).`);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let result = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (result.error?.code === "user_not_found" || result.error?.status === 404) {
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) fail(`couldn't create ${email}: ${created.error.message}`);
    result = await admin.auth.admin.generateLink({ type: "magiclink", email });
  }
  const tokenHash = result.data?.properties?.hashed_token;
  if (result.error || !tokenHash) {
    const hint = /invalid api key/i.test(result.error?.message ?? "")
      ? " Check SUPABASE_SERVICE_ROLE_KEY: use the secret key (sb_secret_...) from Project Settings > API Keys."
      : "";
    fail(`couldn't generate a link for ${email}: ${result.error?.message ?? "no token returned"}.${hint}`);
  }

  const link = new URL("/api/auth/callback", originUrl);
  link.searchParams.set("token_hash", tokenHash);
  link.searchParams.set("type", "email");
  console.log(link.toString());
}

await main();
