"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { NEXT_COOKIE, safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  next: z.string().optional(),
});

export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email: string };

export async function sendMagicLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });
  const rawEmail = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
      email: rawEmail,
    };
  }
  const { email } = parsed.data;

  // Remember where to go after the link is clicked. The callback falls back to
  // the Match Center when the link opens in another browser without this cookie.
  const next = safeNextPath(parsed.data.next);
  const cookieStore = await cookies();
  if (next) {
    cookieStore.set(NEXT_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60,
    });
  } else {
    cookieStore.delete(NEXT_COOKIE);
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Anyone can get an account; only the roster grants access.
      shouldCreateUser: true,
      emailRedirectTo: origin ? `${origin}/api/auth/callback` : undefined,
    },
  });

  if (error) {
    const rateLimited = error.status === 429 || /rate limit/i.test(error.message);
    return {
      status: "error",
      message: rateLimited
        ? "Too many sign-in emails were sent recently. Wait a few minutes and try again."
        : "We couldn't send the sign-in link. Check the address and try again.",
      email,
    };
  }

  return { status: "sent", email };
}
