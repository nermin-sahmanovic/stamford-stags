import Link from "next/link";
import { Pill } from "@/components/ui";
import { formatShortDate, formatTime } from "@/lib/format";
import { AUDIENCE_LABELS, KIND_LABELS, STATUS_LABELS, type MessageListItem } from "@/lib/messages/queries";

/** Delivery status as a pill (every message shows one), plus kind and dev redirect. */
export function MessageStatusPills({ message }: { message: Pick<MessageListItem, "status" | "redirected" | "kind"> }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Pill tone={message.status === "sent" ? "blue" : "warn"}>{STATUS_LABELS[message.status]}</Pill>
      {message.kind !== "message" ? <Pill tone="slate">{KIND_LABELS[message.kind]}</Pill> : null}
      {message.redirected ? <Pill tone="slate">Dev redirect</Pill> : null}
    </span>
  );
}

/** History row: subject + date, then "Entire team · 14 recipients" (design-reference/Captain). */
export function MessageRow({ message, href }: { message: MessageListItem; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-[14px] border border-line bg-white px-3.5 py-3 text-navy no-underline hover:border-slate-300"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] font-bold">{message.subject}</span>
        <span className="shrink-0 text-[13px] text-slate-600">{formatShortDate(message.sentAt)}</span>
      </span>
      <span className="mt-0.5 block text-[13px] text-slate-600">
        {AUDIENCE_LABELS[message.audience]} · {message.recipientCount} recipient{message.recipientCount === 1 ? "" : "s"}
        {message.sender ? ` · ${message.sender}` : ""} · {formatTime(message.sentAt)}
      </span>
      <span className="mt-1.5 block">
        <MessageStatusPills message={message} />
      </span>
    </Link>
  );
}
