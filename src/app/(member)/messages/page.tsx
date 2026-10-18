import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesIcon } from "@/components/shell/icons";
import { EmptyState, Skeleton } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { formatShortDate, formatTime } from "@/lib/format";
import { getMyMessages, KIND_LABELS } from "@/lib/messages/queries";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">Messages</h1>
      <Suspense fallback={<Skeleton className="h-[240px]" />}>
        <Inbox />
      </Suspense>
    </section>
  );
}

/** Team emails this player received, newest first. */
async function Inbox() {
  const me = await requireMember();
  const messages = await getMyMessages(me.id);
  if (messages.length === 0) {
    return (
      <EmptyState icon={MessagesIcon} title="No messages yet">
        Emails from your captain show up here too, so you can find them later.
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-2.5 md:grid-cols-2">
      {messages.map((m) => (
        <li key={m.id}>
          <details className="group rounded-[14px] border border-line bg-white">
            <summary className="flex min-h-[64px] cursor-pointer list-none flex-col justify-center px-3.5 py-3">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] font-bold">{m.subject}</span>
                <span className="shrink-0 text-[13px] text-slate-600">{formatShortDate(m.sentAt)}</span>
              </span>
              <span className="text-[13px] text-slate-600">
                {m.sender ?? "Stamford Stags"} · {formatTime(m.sentAt)}
              </span>
              {m.kind !== "message" ? (
                <span className="mt-1 text-[12px] font-bold tracking-[0.06em] text-slate-600 uppercase">
                  {KIND_LABELS[m.kind]}
                </span>
              ) : null}
            </summary>
            <div className="border-t border-slate-100 px-3.5 py-3 text-[15px] leading-[1.5] whitespace-pre-line">{m.body}</div>
          </details>
        </li>
      ))}
    </ul>
  );
}
