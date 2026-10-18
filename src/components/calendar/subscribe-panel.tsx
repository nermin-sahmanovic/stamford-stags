"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { CloseIcon, ScheduleIcon } from "@/components/shell/icons";

const CAL_NAME = "Stamford Stags";

const linkButton =
  "flex h-11 items-center justify-center rounded-[10px] px-3 text-[14px] font-bold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court";

/** "Subscribe" button plus a dialog with the feed link and steps for iPhone, Android and Outlook. */
export function SubscribeButton({
  feedUrl,
  personal,
  className = "",
}: {
  feedUrl: string;
  /** Personal feeds include members-only events and must not be shared. */
  personal: boolean;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`flex h-11 items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-court px-3 text-[14px] font-bold text-court hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court ${className}`}
      >
        <ScheduleIcon size={18} />
        Subscribe
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="subscribe-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto w-[calc(100%-32px)] max-w-lg rounded-2xl border border-line bg-white p-0 text-navy backdrop:bg-navy/60"
      >
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id="subscribe-title" className="font-display text-[24px] leading-tight font-bold tracking-[0.03em] uppercase">
              Add to your calendar
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="flex size-11 items-center justify-center rounded-[10px] hover:bg-slate-100"
            >
              <CloseIcon size={20} />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-3">
            <SubscribeSteps feedUrl={feedUrl} personal={personal} />
          </div>
        </div>
      </dialog>
    </>
  );
}

export function SubscribeSteps({ feedUrl, personal }: { feedUrl: string; personal: boolean }) {
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  const name = encodeURIComponent(CAL_NAME);
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  const outlookCom = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${name}`;
  const office365 = `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${name}`;

  return (
    <div className="flex flex-col gap-4 text-[15px]">
      <p className="text-slate-700">
        {personal
          ? "Your personal link includes members-only practices and deadlines. Keep it to yourself."
          : "Matches and public team events. Members get a personal link with practices and deadlines on their profile."}{" "}
        Calendar apps check for changes every few hours, so updates can take a while to appear.
      </p>

      <CopyLink url={feedUrl} />

      <Platform title="iPhone or iPad">
        <a href={webcal} className={`${linkButton} bg-navy text-white hover:bg-navy-2 hover:text-white`}>
          Subscribe in Calendar
        </a>
        <p>
          Or open Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar, and
          paste the link.
        </p>
      </Platform>

      <Platform title="Android (Google Calendar)">
        <a href={google} target="_blank" rel="noreferrer" className={`${linkButton} border-[1.5px] border-court text-court hover:bg-blue-50`}>
          Add to Google Calendar
        </a>
        <p>
          The Google Calendar app can&apos;t add a link itself. On calendar.google.com, choose Other calendars → + → From
          URL and paste the link. It then syncs to your phone (turn it on under Settings in the app if it doesn&apos;t
          show).
        </p>
      </Platform>

      <Platform title="Outlook">
        <div className="grid grid-cols-2 gap-2">
          <a href={outlookCom} target="_blank" rel="noreferrer" className={`${linkButton} border-[1.5px] border-court text-court hover:bg-blue-50`}>
            Outlook.com
          </a>
          <a href={office365} target="_blank" rel="noreferrer" className={`${linkButton} border-[1.5px] border-court text-court hover:bg-blue-50`}>
            Work or school
          </a>
        </div>
        <p>Or in Outlook: Add calendar → Subscribe from web, and paste the link.</p>
      </Platform>

      {personal ? (
        <p className="text-[14px] text-slate-600">
          Shared it by mistake? Reset the link on{" "}
          <Link href="/players/me" className="font-semibold">
            your profile
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

function Platform({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3 text-[14px] text-slate-700">
      <h3 className="text-[15px] font-bold text-navy">{title}</h3>
      {children}
    </section>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      input.current?.select();
    }
  }

  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor="feed-url">
        Calendar link
      </label>
      <input
        ref={input}
        id="feed-url"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 min-w-0 flex-1 rounded-[10px] border border-slate-300 bg-ground px-3 text-base text-navy"
      />
      <button
        type="button"
        onClick={copy}
        className="h-11 shrink-0 rounded-[10px] bg-navy px-4 text-[14px] font-bold text-white hover:bg-navy-2"
      >
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
