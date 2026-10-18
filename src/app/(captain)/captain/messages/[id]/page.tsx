import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MessageStatusPills } from "@/components/messages/message-row";
import { ArrowLeftIcon } from "@/components/shell/icons";
import { Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { formatTime, formatWeekdayDate } from "@/lib/format";
import { opponentLabel } from "@/lib/matches/display";
import { AUDIENCE_LABELS, getMessage, STATUS_LABELS } from "@/lib/messages/queries";

export const metadata: Metadata = { title: "Message" };

export default function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-2 pb-6">
      <Link href="/captain/messages" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold no-underline">
        <ArrowLeftIcon size={16} />
        Messages
      </Link>
      <Suspense fallback={<Skeleton className="h-[420px]" />}>
        <Message params={params} />
      </Suspense>
    </div>
  );
}

async function Message({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [, message] = await Promise.all([requireCaptain(), getMessage(id)]);
  if (!message) notFound();
  const failed = message.recipients.filter((r) => r.status === "failed").length;

  return (
    <div className="md:grid md:grid-cols-2 md:items-start md:gap-6">
      <div>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-[0.02em]">{message.subject}</h1>
        <p className="mt-1 text-[14px] text-slate-600">
          {formatWeekdayDate(message.sentAt)}, {formatTime(message.sentAt)} · {AUDIENCE_LABELS[message.audience]}
          {message.sender ? ` · ${message.sender}` : ""}
        </p>
        {message.match ? (
          <p className="text-[14px] text-slate-600">
            About {opponentLabel(message.match.opponent, message.match.home_away)} ·{" "}
            {formatWeekdayDate(message.match.starts_at)}
          </p>
        ) : null}
        <div className="mt-2">
          <MessageStatusPills message={message} />
        </div>
        {message.status === "logged" ? (
          <p className="mt-2 rounded-[10px] bg-warn-bg px-3 py-2 text-[13px] font-semibold text-orange-900">
            Not sent. Email isn&apos;t set up, so these emails were only written to the server log. Add RESEND_API_KEY
            and EMAIL_DEV_REDIRECT (see docs/EMAIL_SETUP.md), restart the server, and send again.
          </p>
        ) : message.redirected ? (
          <p className="mt-2 rounded-[10px] bg-blue-50 px-3 py-2 text-[13px] font-semibold text-blue-800">
            Sent in dev mode: every email went to the dev redirect address, not to these players.
          </p>
        ) : null}
        {message.error ? (
          <p className="mt-2 rounded-[10px] bg-warn-bg px-3 py-2 text-[13px] font-semibold text-orange-900">{message.error}</p>
        ) : null}
        <div className="mt-3 rounded-[14px] border border-line bg-white p-3.5 text-[15px] leading-[1.5] whitespace-pre-line">
          {message.body}
        </div>
      </div>

      <section aria-labelledby="recipients-heading" className="mt-5 md:mt-0">
        <h2 id="recipients-heading" className="font-display text-[24px] leading-tight font-bold tracking-[0.03em] uppercase">
          Recipients · {message.recipients.length}
        </h2>
        {failed > 0 ? <p className="text-[14px] font-semibold text-warn">{failed} failed</p> : null}
        <ul className="mt-2 divide-y divide-slate-100 rounded-[14px] border border-line bg-white">
          {message.recipients.map((r) => (
            <li key={r.email} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                <span className="block truncate text-[13px] text-slate-600">{r.email}</span>
                {r.error ? <span className="block text-[13px] font-semibold text-warn">{r.error}</span> : null}
              </span>
              <span
                className={`shrink-0 text-right text-[13px] font-bold ${
                  r.status === "sent" ? "text-blue-700" : r.status === "queued" ? "text-slate-600" : "text-warn"
                }`}
              >
                {r.status === "queued" ? STATUS_LABELS.queued : STATUS_LABELS[r.status]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
