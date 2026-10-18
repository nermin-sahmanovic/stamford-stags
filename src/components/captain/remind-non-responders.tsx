"use client";

import { useState, useTransition } from "react";
import { remindNonResponders } from "@/app/(captain)/captain/matches/actions";
import { AlertIcon, BellIcon, CheckIcon } from "@/components/shell/icons";

/**
 * "5 players haven't replied" + name chips + one button that emails each of them one-tap
 * answers. Used on the captain dashboard (with the match line) and on the match page.
 */
export function RemindNonResponders({
  matchId,
  names,
  detail,
}: {
  matchId: string;
  names: string[];
  /** Dashboard: "For Nov 1 @ Darien. You're 2 short of a full lineup." */
  detail?: string;
}) {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remind() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await remindNonResponders(matchId);
        if (!result.ok) return setError(result.message);
        const players = (n: number) => `${n} player${n === 1 ? "" : "s"}`;
        setSent(
          result.failed > 0
            ? `Sent to ${result.sent}. ${result.failed} failed. Check Messages.`
            : result.logged > 0
              ? `Logged only, not sent: email isn't set up, so the reminder for ${players(result.logged)} went to the server log.`
              : `Reminder sent to ${players(result.sent)}.`,
        );
      } catch {
        setError("Couldn't send. Check your connection and try again.");
      }
    });
  }

  if (names.length === 0 && !sent) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-line bg-white p-4 text-[15px] text-slate-700">
        <CheckIcon size={18} className="text-court" /> Everyone has replied.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-warn-bg text-warn">
          <AlertIcon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[16px] font-bold">
            {names.length} player{names.length === 1 ? " hasn't" : "s haven't"} replied
          </p>
          {detail ? <p className="text-[14px] text-slate-600">{detail}</p> : null}
        </div>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Players who haven't replied">
        {names.map((name, i) => (
          <li key={`${name}-${i}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[13px] font-medium text-slate-700">
            {name}
          </li>
        ))}
      </ul>
      {sent ? (
        <p
          role="status"
          className="flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-blue-50 px-3 py-2.5 text-center text-[15px] font-bold text-blue-800"
        >
          <CheckIcon size={17} className="shrink-0" />
          {sent}
        </p>
      ) : (
        <button
          type="button"
          disabled={pending || names.length === 0}
          onClick={remind}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-court text-[15px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <BellIcon size={17} />
          {pending ? "Sending…" : `Send reminder to all ${names.length}`}
        </button>
      )}
      {error ? (
        <p role="alert" className="text-[13px] font-semibold text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
