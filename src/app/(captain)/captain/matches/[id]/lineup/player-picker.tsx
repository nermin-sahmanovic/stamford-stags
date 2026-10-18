"use client";

import { useEffect, useRef } from "react";
import { CheckIcon, CloseIcon } from "@/components/shell/icons";
import type { AvailabilityStatus, LineupCandidate } from "@/lib/matches/queries";

const GROUPS: { key: AvailabilityStatus | "none"; title: string }[] = [
  { key: "available", title: "Available" },
  { key: "maybe", title: "Maybe" },
  { key: "none", title: "No reply" },
  { key: "unavailable", title: "Unavailable" },
];

const PREF = { singles: "Singles", doubles: "Doubles", both: "Singles or doubles" } as const;

/**
 * Bottom sheet for one seat. Available players come first; flags say why someone is a risk.
 * Players already on another line are disabled (no double-booking; save_lineup enforces it too).
 */
export function PlayerPicker({
  title,
  candidates,
  currentId,
  seatedIn,
  onPick,
  onClose,
}: {
  title: string;
  candidates: LineupCandidate[];
  currentId: string | null;
  /** playerId → line label, for everyone seated elsewhere in the draft. */
  seatedIn: Map<string, string>;
  onPick: (playerId: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // Unmounting removes the dialog from the top layer, so there's no close() in a cleanup
  // (that would fire onClose and, under StrictMode, shut the sheet as soon as it opens).
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="picker-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      className="mx-0 mt-auto mb-0 flex max-h-[85dvh] w-full max-w-full flex-col rounded-t-2xl bg-ground p-0 text-navy backdrop:bg-navy/60 md:m-auto md:max-w-md md:rounded-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2">
        <h2 id="picker-title" className="font-display text-[22px] font-bold tracking-[0.03em] uppercase">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-slate-100"
        >
          <CloseIcon size={20} />
          <span className="sr-only">Close</span>
        </button>
      </div>

      <div className="overflow-y-auto px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
        {GROUPS.map((group) => {
          const rows = candidates.filter((c) => (c.availability ?? "none") === group.key);
          if (rows.length === 0) return null;
          return (
            <section key={group.key} aria-label={group.title} className="mt-2">
              <h3 className="mb-1.5 text-[12px] font-bold tracking-[0.08em] text-slate-600 uppercase">
                {group.title} · {rows.length}
              </h3>
              <ul className="divide-y divide-slate-100 rounded-[14px] border border-line bg-white">
                {rows.map((c) => {
                  const elsewhere = c.id !== currentId ? seatedIn.get(c.id) : undefined;
                  const selected = c.id === currentId;
                  const note =
                    c.availability === "unavailable" ? "Said unavailable" : c.availability === "maybe" ? "Said maybe" : null;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={elsewhere !== undefined}
                        aria-pressed={selected}
                        onClick={() => onPick(c.id)}
                        className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left first:rounded-t-[14px] hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-[16px] font-semibold ${elsewhere ? "text-slate-600" : ""}`}
                          >
                            {c.name}
                          </span>
                          <span className="block truncate text-[13px] text-slate-600">
                            {c.rating !== null ? c.rating.toFixed(1) : "No rating"}
                            {c.pref ? ` · ${PREF[c.pref]}` : ""}
                          </span>
                          {c.ineligible || note ? (
                            <span className="block text-[13px] font-semibold text-warn">
                              {[c.ineligible ? `Not eligible: ${c.ineligible}` : null, note].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                        </span>
                        {elsewhere ? (
                          <span className="shrink-0 rounded-md bg-slate-200 px-2 py-1 text-[12px] font-bold text-slate-700">
                            In {elsewhere}
                          </span>
                        ) : selected ? (
                          <CheckIcon size={20} className="shrink-0 text-court" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {currentId ? (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="mt-3 h-11 w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white text-[15px] font-bold text-navy hover:bg-slate-50"
          >
            Leave this seat empty
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
