"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setMyRsvp } from "@/app/(member)/matches/actions";
import type { RsvpStatus } from "@/lib/matches/queries";

const OPTIONS = [
  { value: "confirmed", label: "Confirm", selected: "border-navy bg-ball text-navy" },
  { value: "declined", label: "Decline", selected: "border-warn bg-warn-bg text-orange-900" },
] as const;

/** The signed-in player's lineup spot, with one-tap Confirm / Decline (set_my_rsvp). */
export function MyRsvp({
  matchId,
  line,
  partner,
  court,
  rsvp,
}: {
  matchId: string;
  line: string;
  partner: string | null;
  court: string | null;
  rsvp: RsvpStatus;
}) {
  const [optimistic, setOptimistic] = useOptimistic(rsvp);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function choose(value: "confirmed" | "declined") {
    if (optimistic === value) return;
    setError(null);
    startTransition(async () => {
      setOptimistic(value);
      try {
        const result = await setMyRsvp(matchId, value);
        if (!result.ok) setError(result.message);
      } catch {
        setError("Couldn't save. Check your connection and try again.");
      }
    });
  }

  const status =
    optimistic === "confirmed" ? "You're confirmed." : optimistic === "declined" ? "You've declined. Your captain will find a sub." : "Please confirm or decline.";

  return (
    <section aria-labelledby="my-spot-heading" className="mb-3 rounded-2xl bg-navy p-3.5 text-white">
      <h3 id="my-spot-heading" className="text-[12px] font-bold tracking-[0.08em] text-ball uppercase">
        Your spot
      </h3>
      <p className="mt-1 text-[17px] leading-snug font-semibold">
        {line}
        {partner ? ` with ${partner}` : ""}
        {court ? ` · ${court}` : ""}
      </p>
      <p className="mt-0.5 text-[13px] text-slate-300" aria-live="polite">
        {status}
      </p>
      <div role="group" aria-label="Your RSVP" className="mt-2.5 grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => {
          const selected = optimistic === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(option.value)}
              className={`h-11 rounded-[10px] border-[1.5px] text-[15px] font-bold ${
                selected ? option.selected : "border-slate-500 bg-navy-2 text-white hover:border-slate-300"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-warn-bg px-2.5 py-1.5 text-[13px] font-semibold text-warn">
          {error}
        </p>
      ) : null}
    </section>
  );
}
