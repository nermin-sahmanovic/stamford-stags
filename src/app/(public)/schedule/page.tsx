import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/page-hero";
import { ClockIcon, PinIcon } from "@/components/shell/icons";
import { Pill, Skeleton, type PillTone } from "@/components/ui";
import {
  formatDayOfMonth,
  formatMonthShort,
  formatMonthYear,
  formatTime,
  formatWeekday,
} from "@/lib/format";
import { getPublicSchedule, type ScheduleItem } from "@/lib/public-data";

export const metadata: Metadata = { title: "Schedule" };

export default function SchedulePage() {
  return (
    <>
      <PageHero eyebrow="Upcoming" title="Schedule">
        Matches and team events. Times are Eastern.
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-6">
        <Suspense fallback={<ScheduleSkeleton />}>
          <ScheduleList />
        </Suspense>
      </div>
    </>
  );
}

async function ScheduleList() {
  const items = await getPublicSchedule();
  if (items.length === 0) {
    return (
      <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
        Nothing scheduled yet. The captain posts matches once the league releases the schedule.
      </p>
    );
  }

  const months = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const key = formatMonthYear(item.starts_at);
    months.set(key, [...(months.get(key) ?? []), item]);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...months].map(([month, monthItems]) => (
        <section key={month} aria-label={month}>
          <h2 className="mb-2 text-[13px] font-bold tracking-[0.08em] text-slate-500 uppercase">
            {month}
          </h2>
          <ul className="grid gap-2.5 md:grid-cols-2">
            {monthItems.map((item) => (
              <li key={`${item.kind}-${item.starts_at}-${item.title}`}>
                <ScheduleCard item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const eventLabels: Record<string, { label: string; tone: PillTone }> = {
  practice: { label: "Practice", tone: "blue" },
  social: { label: "Social", tone: "warn" },
  usta_deadline: { label: "USTA deadline", tone: "warn" },
  registration: { label: "Registration", tone: "blue" },
  other: { label: "Event", tone: "slate" },
};

function ScheduleCard({ item }: { item: ScheduleItem }) {
  const isMatch = item.kind === "match";
  const home = item.home_away === "home";
  const event = eventLabels[item.kind] ?? eventLabels.other;

  return (
    <article className="flex h-full gap-3.5 rounded-[14px] border border-line bg-white p-3.5">
      <div
        className={`flex w-14 flex-none flex-col items-center justify-center rounded-[10px] py-2 ${
          isMatch ? "bg-navy text-white" : "bg-ground text-navy"
        }`}
      >
        <span className={`text-[12px] font-bold tracking-[0.08em] uppercase ${isMatch ? "text-ball" : "text-slate-500"}`}>
          {formatMonthShort(item.starts_at)}
        </span>
        <span className="font-display text-[28px] leading-none font-bold">
          {formatDayOfMonth(item.starts_at)}
        </span>
        <span className={`text-[12px] font-semibold ${isMatch ? "text-slate-300" : "text-slate-500"}`}>
          {formatWeekday(item.starts_at)}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          {isMatch ? (
            <>
              <Pill tone={home ? "ball" : "slate"}>{home ? "Home" : "Away"}</Pill>
              {item.status === "cancelled" ? <Pill tone="warn">Cancelled</Pill> : null}
              {item.status === "completed" ? <Pill tone="navy">Final</Pill> : null}
            </>
          ) : (
            <Pill tone={event.tone}>{event.label}</Pill>
          )}
        </div>
        <h3 className="text-[17px] leading-snug font-bold">{item.title}</h3>
        <div className="flex flex-col gap-1 text-[14px] text-slate-600">
          <span className="flex items-center gap-1.5">
            <ClockIcon size={15} />
            {formatTime(item.starts_at)}
          </span>
          {item.location_name ? (
            <span className="flex items-center gap-1.5">
              <PinIcon size={15} />
              <span className="truncate">{item.location_name}</span>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[104px]" />
      ))}
    </div>
  );
}
