import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DEFAULT_AFTER_SIGN_IN, NEXT_COOKIE, safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const otpTypes = ["email", "magiclink", "signup", "invite"] as const;

const query = z.union([
  // Email template link: {{ .SiteURL }}/api/auth/callback?token_hash=...&type=email
  // Works even when the email opens in a different browser.
  z.object({ token_hash: z.string().min(1), type: z.enum(otpTypes) }),
  // Default Supabase template (PKCE): only works in the browser that asked for the link.
  z.object({ code: z.string().min(1) }),
]);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const parsed = query.safeParse(Object.fromEntries(searchParams));
  const failed = NextResponse.redirect(new URL("/sign-in?error=link", origin));
  if (!parsed.success) return failed;

  const supabase = await createClient();
  const { error } =
    "token_hash" in parsed.data
      ? await supabase.auth.verifyOtp({
          token_hash: parsed.data.token_hash,
          type: parsed.data.type as EmailOtpType,
        })
      : await supabase.auth.exchangeCodeForSession(parsed.data.code);
  if (error) return failed;

  const cookieStore = await cookies();
  const next = safeNextPath(cookieStore.get(NEXT_COOKIE)?.value) ?? DEFAULT_AFTER_SIGN_IN;
  cookieStore.delete(NEXT_COOKIE);

  return NextResponse.redirect(new URL(next, origin));
}
