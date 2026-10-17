import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MessageRow } from "@/components/messages/message-row";
import { PlusIcon } from "@/components/shell/icons";
import { Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { getMessageHistory } from "@/lib/messages/queries";

export const metadata: Metadata = { title: "Team Messages" };

export default function CommsPage() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">Messages</h1>
        <Link
          href="/captain/messages/new"
          className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-navy px-3 text-[14px] font-bold text-white no-underline hover:bg-navy-2 hover:text-white"
        >
          <PlusIcon size={18} /> New message
        </Link>
      </div>
      <Suspense fallback={<HistorySkeleton />}>
        <History />
      </Suspense>
    </section>
  );
}

async function History() {
  await requireCaptain();
  const messages = await getMessageHistory();
  if (messages.length === 0) {
    return (
      <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
        No messages yet. Team emails, reminders and lineup notices show up here.
      </p>
    );
  }
  return (
    <ul className="grid gap-2.5 md:grid-cols-2">
      {messages.map((message) => (
        <li key={message.id}>
          <MessageRow message={message} href={`/captain/messages/${message.id}`} />
        </li>
      ))}
    </ul>
  );
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[72px]" />
      ))}
    </div>
  );
}
