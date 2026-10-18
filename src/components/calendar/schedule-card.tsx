import Link from "next/link";
import { ClockIcon, PinIcon } from "@/components/shell/icons";
import { Pill, type PillTone } from "@/components/ui";
import { EVENT_TYPE_LABELS, type CalendarItem, type CalendarKind } from "@/lib/calendar/items";
import { formatDayOfMonth, formatMonthShort, formatTime, formatWeekday } from "@/lib/format";
import { resultLabel } from "@/lib/matches/display";

const eventTones: Record<Exclude<CalendarKind, "match">, PillTone> = {
  practice: "blue",
  social: "warn",
  usta_deadline: "warn",
  registration: "blue",
  other: "slate",
};

/** A match or event as a phone card: date block, pills, title, time and place. */
export function ScheduleCard({
  item,
  href = item.href,
  showVisibility = false,
}: {
  item: CalendarItem;
  href?: string | null;
  /** Captain lists: mark members-only events. */
  showVisibility?: boolean;
}) {
  const eventKind = item.kind === "match" ? null : item.kind;
  const isMatch = eventKind === null;
  const home = item.homeAway === "home";
  const result = isMatch && item.status === "completed" ? resultLabel(item.teamPoints, item.opponentPoints) : null;

  const body = (
    <>
      <div
        className={`flex w-14 flex-none flex-col items-center justify-center rounded-[10px] py-2 ${
          isMatch ? "bg-navy text-white" : "bg-ground text-navy"
        }`}
      >
        <span className={`text-[12px] font-bold tracking-[0.08em] uppercase ${isMatch ? "text-ball" : "text-slate-500"}`}>
          {formatMonthShort(item.startsAt)}
        </span>
        <span className="font-display text-[28px] leading-none font-bold">{formatDayOfMonth(item.startsAt)}</span>
        <span className={`text-[12px] font-semibold ${isMatch ? "text-slate-300" : "text-slate-500"}`}>
          {formatWeekday(item.startsAt)}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          {isMatch ? (
            <>
              <Pill tone={home ? "ball" : "slate"}>{home ? "Home" : "Away"}</Pill>
              {item.status === "cancelled" ? <Pill tone="warn">Cancelled</Pill> : null}
              {item.status === "completed" ? (
                <Pill tone="navy">{result ? `Final · ${result.outcome} ${result.score}` : "Final"}</Pill>
              ) : null}
            </>
          ) : (
            <>
              <Pill tone={eventTones[eventKind]}>{EVENT_TYPE_LABELS[eventKind]}</Pill>
              {showVisibility && item.isPublic === false ? <Pill tone="slate">Members only</Pill> : null}
            </>
          )}
        </div>
        <h3 className="text-[17px] leading-snug font-bold">{item.title}</h3>
        <div className="flex flex-col gap-1 text-[14px] text-slate-600">
          <span className="flex items-center gap-1.5">
            <ClockIcon size={15} />
            {formatTime(item.startsAt)}
            {item.endsAt ? ` – ${formatTime(item.endsAt)}` : null}
          </span>
          {item.location ? (
            <span className="flex items-center gap-1.5">
              <PinIcon size={15} />
              <span className="truncate">{item.location}</span>
            </span>
          ) : null}
          {item.description ? <span className="line-clamp-2 text-[14px] text-slate-700">{item.description}</span> : null}
        </div>
      </div>
    </>
  );

  const className = "flex h-full gap-3.5 rounded-[14px] border border-line bg-white p-3.5";
  return href ? (
    <Link href={href} className={`${className} text-navy no-underline hover:border-slate-300`}>
      {body}
    </Link>
  ) : (
    <article className={className}>{body}</article>
  );
}
