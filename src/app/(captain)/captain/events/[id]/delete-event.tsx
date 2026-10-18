"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorText, useAction } from "../../matches/[id]/match-tools";
import { deleteEvent } from "../actions";

const outlineButton =
  "h-11 rounded-[10px] border-[1.5px] px-4 text-[14px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-60";

export function DeleteEvent({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const { error, pending, run } = useAction();
  return (
    <section aria-labelledby="delete-heading" className="mt-5">
      <h2 id="delete-heading" className="mb-2 font-display text-[24px] leading-tight font-bold tracking-[0.03em] uppercase">
        Delete
      </h2>
      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="text-[15px] text-slate-700">
          It disappears from the schedule and from everyone&apos;s subscribed calendars. This can&apos;t be undone.
        </p>
        {confirming ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteEvent(eventId), () => router.push("/captain/events"))}
              className={`${outlineButton} border-warn bg-warn text-white hover:bg-orange-800`}
            >
              {pending ? "Deleting…" : `Yes, delete ${title}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`${outlineButton} border-slate-300 text-navy hover:bg-slate-50`}
            >
              Keep it
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`${outlineButton} mt-3 border-warn text-warn hover:bg-warn-bg`}
          >
            Delete event
          </button>
        )}
        <ErrorText error={error} />
      </div>
    </section>
  );
}
