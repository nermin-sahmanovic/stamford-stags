"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "@/components/shell/icons";
import { inviteRegistration, type InviteResult } from "./actions";

const EMAIL_NOTES = {
  sent: "Welcome email sent.",
  logged: "Added. Email isn't set up, so the welcome email only went to the server log.",
  failed: "Added to the roster, but the welcome email failed. Check Messages.",
} as const;

/** One pending registration: initials, name, details and Invite (adds the player and emails them). */
export function RegistrationRow({
  id,
  name,
  initials,
  meta,
  invitedAlready,
}: {
  id: string;
  name: string;
  initials: string;
  meta: string;
  /** Server says it was invited recently (e.g. after the dashboard refreshed). */
  invitedAlready: boolean;
}) {
  const [result, setResult] = useState<InviteResult | null>(null);
  const [pending, startTransition] = useTransition();

  function invite() {
    startTransition(async () => {
      try {
        setResult(await inviteRegistration(id));
      } catch {
        setResult({ ok: false, message: "Couldn't invite. Check your connection and try again." });
      }
    });
  }

  const invited = invitedAlready || result?.ok === true;
  return (
    <li className="border-b border-[#EEF2F6] px-3.5 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-line text-[14px] font-bold text-slate-700"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{name}</p>
          <p className="text-[13px] text-slate-600">{meta}</p>
        </div>
        {invited ? (
          <span role="status" className="flex shrink-0 items-center gap-1 text-[13px] font-bold text-blue-700">
            <CheckIcon size={14} /> Invited
          </span>
        ) : (
          <button
            type="button"
            onClick={invite}
            disabled={pending}
            aria-label={`Invite ${name}`}
            className="h-11 shrink-0 rounded-[10px] bg-navy px-3.5 text-[14px] font-bold text-white hover:bg-navy-2 disabled:opacity-60"
          >
            {pending ? "Inviting…" : "Invite"}
          </button>
        )}
      </div>
      {result ? (
        <p
          role={result.ok && result.email !== "failed" ? "status" : "alert"}
          className={`mt-1.5 pl-[52px] text-[13px] font-semibold ${
            result.ok && result.email === "sent" ? "text-blue-700" : "text-warn"
          }`}
        >
          {result.ok ? EMAIL_NOTES[result.email] : result.message}
        </p>
      ) : null}
    </li>
  );
}
