import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { MonthGrid } from "@/components/calendar/month-grid";
import { ScheduleCard } from "@/components/calendar/schedule-card";
import { SubscribeButton } from "@/components/calendar/subscribe-panel";
import { PageHero } from "@/components/page-hero";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from "@/components/shell/icons";
import { Skeleton } from "@/components/ui";
import { getCurrentPlayer } from "@/lib/auth";
import { isMonthKey, monthKeyParts, type CalendarItem } from "@/lib/calendar/items";
import { getMemberCalendar, getMyFeedUrl, publicFeedUrl } from "@/lib/calendar/queries";
import { formatMonthYear, teamDateKey, teamLocalInputToIso } from "@/lib/format";
import { getPublicCalendar } from "@/lib/public-data";

export const metadata: Metadata = { title: "Schedule" };

type SearchParams = Promise<{ view?: string; m?: string }>;

export default function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHero eyebrow="Upcoming" title="Schedule">
        Matches and team events. Times are Eastern.
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-6">
        <Suspense fallback={<ScheduleSkeleton />}>
          <Schedule searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

/** Start of a team-time day as an ISO instant ("2026-10-01" → 04:00Z in EDT). */
const dayStart = (dayKey: string) => teamLocalInputToIso(`${dayKey}T00:00`)!;

async function Schedule({ searchParams }: { searchParams: SearchParams }) {
  const [{ view: viewParam, m }, me] = await Promise.all([searchParams, getCurrentPlayer()]);
  await connection(); // "today" is per request
  const view = viewParam === "month" ? "month" : "agenda";
  const todayKey = teamDateKey(new Date().toISOString());
  const monthKey = isMonthKey(m) ? m : todayKey.slice(0, 7);

  // Members see every match and event (and can open matches); everyone else sees public ones.
  let from: string;
  let to: string;
  if (view === "month") {
    from = dayStart(`${monthKey}-01`);
    to = dayStart(`${monthKeyParts(monthKey).next}-01`);
  } else {
    from = dayStart(todayKey);
    to = new Date(Date.parse(from) + 400 * 86_400_000).toISOString();
  }
  const [calendar, feedUrl] = await Promise.all([
    me ? getMemberCalendar(from, to) : getPublicCalendar(from, to),
    me ? getMyFeedUrl() : null,
  ]);
  // Captains manage events from here: tapping an event card opens its edit page.
  const isCaptain = me?.isCaptain ?? false;
  const items = isCaptain
    ? calendar.map((item) => (item.kind === "match" ? item : { ...item, href: `/captain/events/${item.id}` }))
    : calendar;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <nav aria-label="Calendar view" className="grid flex-1 grid-cols-2 gap-1 rounded-[12px] bg-line p-1 md:max-w-xs">
          {(
            [
              ["agenda", "Agenda", "/schedule"],
              ["month", "Month", `/schedule?view=month${isMonthKey(m) ? `&m=${m}` : ""}`],
            ] as const
          ).map(([value, label, href]) => (
            <Link
              key={value}
              href={href}
              aria-current={view === value ? "page" : undefined}
              className={`flex h-10 items-center justify-center rounded-[9px] text-[15px] no-underline ${
                view === value ? "bg-white font-bold text-navy" : "font-semibold text-slate-600 hover:text-navy"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 gap-2">
          {isCaptain ? (
            <Link
              href="/captain/events/new"
              className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-navy px-3 text-[14px] font-bold text-white no-underline hover:bg-navy-2 hover:text-white"
            >
              <PlusIcon size={18} />
              <span>
                Add<span className="max-md:sr-only"> event</span>
              </span>
            </Link>
          ) : null}
          <SubscribeButton feedUrl={feedUrl ?? publicFeedUrl()} personal={feedUrl !== null} />
        </div>
      </div>
      {isCaptain ? (
        <p className="-mt-2 text-[13px] text-slate-600">
          Tap an event to edit or delete it.{" "}
          <Link href="/captain/events" className="font-semibold">
            All events
          </Link>
        </p>
      ) : null}

      {view === "month" ? (
        <>
          <MonthNav monthKey={monthKey} />
          <MonthGrid key={monthKey} monthKey={monthKey} todayKey={todayKey} items={items} />
        </>
      ) : (
        <Agenda items={items} member={me !== null} />
      )}
    </div>
  );
}

function MonthNav({ monthKey }: { monthKey: string }) {
  const { prev, next } = monthKeyParts(monthKey);
  const label = (key: string) => formatMonthYear(`${key}-15T16:00:00Z`);
  const arrow =
    "flex size-11 items-center justify-center rounded-[10px] border border-line bg-white text-navy hover:border-slate-300";
  return (
    <div className="flex items-center justify-between gap-3">
      <Link href={`/schedule?view=month&m=${prev}`} aria-label={`Previous month, ${label(prev)}`} className={arrow}>
        <ArrowLeftIcon size={18} />
      </Link>
      <h2 className="font-display text-[26px] leading-tight font-bold tracking-[0.03em] uppercase">{label(monthKey)}</h2>
      <Link href={`/schedule?view=month&m=${next}`} aria-label={`Next month, ${label(next)}`} className={arrow}>
        <ArrowRightIcon size={18} />
      </Link>
    </div>
  );
}

function Agenda({ items, member }: { items: CalendarItem[]; member: boolean }) {
  if (items.length === 0) {
    return (
      <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
        Nothing scheduled yet. The captain posts matches once the league releases the schedule.
      </p>
    );
  }

  const months = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = formatMonthYear(item.startsAt);
    months.set(key, [...(months.get(key) ?? []), item]);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...months].map(([month, monthItems]) => (
        <section key={month} aria-label={month}>
          <h2 className="mb-2 text-[13px] font-bold tracking-[0.08em] text-slate-500 uppercase">{month}</h2>
          <ul className="grid gap-2.5 md:grid-cols-2">
            {monthItems.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <ScheduleCard item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-[14px] text-slate-600">
        Past matches are on the{" "}
        <Link href={member ? "/matches?tab=results" : "/results"} className="font-semibold">
          results page
        </Link>
        .
      </p>
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-12" />
      <div className="grid gap-2.5 md:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
    </div>
  );
}
