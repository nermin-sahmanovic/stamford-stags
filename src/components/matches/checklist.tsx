"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleChecklistItem } from "@/app/(captain)/captain/matches/actions";
import { CheckIcon } from "@/components/shell/icons";
import type { ChecklistItem } from "@/lib/matches/queries";

function Box({ done }: { done: boolean }) {
  return done ? (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-navy text-ball">
      <CheckIcon size={14} strokeWidth={3.2} />
    </span>
  ) : (
    <span className="size-6 shrink-0 rounded-[7px] border-2 border-muted" />
  );
}

const labelClass = (done: boolean) =>
  done ? "text-[15px] text-slate-500 line-through" : "text-[15px] font-medium text-navy";

/** Match-day checklist. Captains tick items (optimistic); everyone else sees progress read-only. */
export function Checklist({ items, canEdit }: { items: ChecklistItem[]; canEdit: boolean }) {
  const [optimistic, setDone] = useOptimistic(items, (state, change: { id: string; done: boolean }) =>
    state.map((item) => (item.id === change.id ? { ...item, done: change.done } : item)),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(item: ChecklistItem) {
    setError(null);
    startTransition(async () => {
      setDone({ id: item.id, done: !item.done });
      try {
        const result = await toggleChecklistItem(item.id, !item.done);
        if (!result.ok) setError(result.message);
      } catch {
        setError("Couldn't save. Check your connection and try again.");
      }
    });
  }

  const done = optimistic.filter((i) => i.done).length;

  return (
    <section aria-labelledby="checklist-heading" className="mt-5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2
          id="checklist-heading"
          className="font-display text-[24px] leading-tight font-bold tracking-[0.03em] uppercase"
        >
          Match-day checklist
        </h2>
        <span className="shrink-0 text-[14px] font-semibold text-slate-600">
          {done} of {optimistic.length} done
        </span>
      </div>
      {error ? (
        <p role="alert" className="mb-2 text-[13px] font-semibold text-warn">
          {error}
        </p>
      ) : null}
      <ul className="rounded-2xl border border-line bg-white px-1.5 py-1">
        {optimistic.map((item) => (
          <li key={item.id}>
            {canEdit ? (
              <button
                type="button"
                aria-pressed={item.done}
                onClick={() => toggle(item)}
                className="flex min-h-12 w-full items-center gap-3 rounded-[10px] px-2 py-1.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-court"
              >
                <Box done={item.done} />
                <span className={labelClass(item.done)}>{item.label}</span>
              </button>
            ) : (
              <div className="flex min-h-12 items-center gap-3 px-2 py-1.5">
                <Box done={item.done} />
                <span className={labelClass(item.done)}>
                  {item.label}
                  <span className="sr-only">{item.done ? " (done)" : " (not done)"}</span>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
