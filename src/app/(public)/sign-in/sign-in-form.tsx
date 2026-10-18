"use client";

import { useActionState } from "react";
import { MailIcon } from "@/components/shell/icons";
import { sendMagicLink, type SignInState } from "./actions";

const initialState: SignInState = { status: "idle" };

export function SignInForm({ next, email }: { next?: string; email?: string }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-[14px] border border-line bg-white p-5">
        <div className="flex size-11 items-center justify-center rounded-full bg-navy text-ball">
          <MailIcon size={22} />
        </div>
        <h2 className="mt-3 font-display text-[22px] leading-tight font-bold tracking-[0.02em] uppercase">
          Check your email
        </h2>
        <p className="mt-1 text-[15px] text-slate-600">
          We sent a sign-in link to <strong className="text-navy">{state.email}</strong>.
          Open it on this device to sign in. The link works once and expires after an hour.
        </p>
      </div>
    );
  }

  const errorId = "sign-in-error";
  const hasError = state.status === "error";

  return (
    <form action={formAction} className="rounded-[14px] border border-line bg-white p-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label htmlFor="email" className="block text-[15px] font-semibold text-navy">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        placeholder="you@example.com"
        defaultValue={hasError ? state.email : email}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className="mt-1.5 h-12 w-full rounded-[10px] border border-slate-300 bg-white px-3.5 text-base text-navy placeholder:text-slate-500 focus:border-court focus:outline-2 focus:outline-offset-0 focus:outline-court/30"
      />
      {hasError ? (
        <p id={errorId} role="alert" className="mt-2 text-[14px] font-semibold text-warn">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 h-[52px] w-full rounded-[12px] bg-navy text-base font-bold text-ball hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-70"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p className="mt-3 text-[14px] text-slate-600">
        No password needed. Use the email your captain has on the roster.
      </p>
    </form>
  );
}
