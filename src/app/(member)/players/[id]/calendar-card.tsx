"use client";

import { useState, useTransition } from "react";
import { SubscribeButton } from "@/components/calendar/subscribe-panel";
import { regenerateCalendarToken } from "../actions";

const outlineButton =
  "h-11 rounded-[10px] border-[1.5px] px-4 text-[14px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-60";

/** The player's personal calendar feed: subscribe, or reset the link if it was shared. */
export function CalendarCard({ feedUrl: initialUrl }: { feedUrl: string | null }) {
  const [feedUrl, setFeedUrl] = useState(initialUrl);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await regenerateCalendarToken();
        if (!result.ok) return setMessage({ ok: false, text: result.message });
        setFeedUrl(result.feedUrl);
        setConfirming(false);
        setMessage({ ok: true, text: "New link ready. Your old link has stopped working, so subscribe again with this one." });
      } catch {
        setMessage({ ok: false, text: "Couldn't reset. Check your connection and try again." });
      }
    });
  }

  return (
    <section aria-labelledby="calendar-heading" className="rounded-[14px] border border-line bg-white p-4">
      <h2 id="calendar-heading" className="font-display text-[22px] font-bold tracking-[0.03em] uppercase">
        Calendar
      </h2>
      <p className="mt-1 text-[15px] text-slate-700">
        Matches, practices, socials and USTA deadlines in your phone&apos;s calendar, kept up to date. This link is
        yours alone; anyone with it can see the team schedule.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {feedUrl ? <SubscribeButton key={feedUrl} feedUrl={feedUrl} personal /> : null}
        {confirming ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={reset}
              className={`${outlineButton} border-warn bg-warn text-white hover:bg-orange-800`}
            >
              {pending ? "Resetting…" : "Yes, reset my link"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`${outlineButton} border-slate-300 text-navy hover:bg-slate-50`}
            >
              Keep it
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => (feedUrl ? setConfirming(true) : reset())}
            className={`${outlineButton} border-slate-300 text-navy hover:bg-slate-50`}
          >
            {feedUrl ? "Reset link" : pending ? "Creating…" : "Create my link"}
          </button>
        )}
      </div>
      {confirming && feedUrl ? (
        <p className="mt-2 text-[13px] text-slate-600">
          Calendars subscribed with the current link stop updating.
        </p>
      ) : null}
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={`mt-2 text-[14px] font-semibold ${message.ok ? "text-blue-700" : "text-warn"}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
