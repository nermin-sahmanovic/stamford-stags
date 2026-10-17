"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { AvailabilityStatus } from "@/lib/matches/queries";
import { setAvailability } from "./actions";

const OPTIONS: { value: AvailabilityStatus; label: string; selected: string }[] = [
  { value: "available", label: "Available", selected: "border-navy bg-ball text-navy font-bold" },
  { value: "maybe", label: "Maybe", selected: "border-warn bg-warn-bg text-orange-900 font-bold" },
  { value: "unavailable", label: "Out", selected: "border-navy bg-navy text-white font-bold" },
];

/**
 * One tap per match. The button flips immediately (useOptimistic); the server action saves and
 * refreshes the page data in the same round trip. On failure the button falls back to the saved
 * answer and an error shows. Tapping the selected answer again clears it.
 */
export function AvailabilityPicker({
  matchId,
  status,
  matchLabel,
}: {
  matchId: string;
  status: AvailabilityStatus | null;
  matchLabel: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function choose(value: AvailabilityStatus) {
    const next = optimistic === value ? null : value;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      try {
        const result = await setAvailability(matchId, next);
        if (!result.ok) setError(result.message);
      } catch {
        setError("Couldn't save. Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <div role="group" aria-label={`Your response for ${matchLabel}`} className="mt-3 grid grid-cols-3 gap-1.5">
        {OPTIONS.map((option) => {
          const pressed = optimistic === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => choose(option.value)}
              className={`h-11 rounded-[10px] border-[1.5px] text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court ${
                pressed ? option.selected : "border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-warn">
          {error}
        </p>
      ) : optimistic === null ? (
        <p className="mt-2 text-[13px] font-semibold text-warn">You haven&apos;t responded yet</p>
      ) : null}
    </>
  );
}
