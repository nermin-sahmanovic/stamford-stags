import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ScheduleCard } from "@/components/calendar/schedule-card";
import { PlusIcon } from "@/components/shell/icons";
import { SectionHeading, Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { getCaptainEvents } from "@/lib/events/queries";

export const metadata: Metadata = { title: "Events" };

export default function EventAdminPage() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">Events</h1>
        <Link
          href="/captain/events/new"
          className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-navy px-3 text-[14px] font-bold text-white no-underline hover:bg-navy-2 hover:text-white"
        >
          <PlusIcon size={18} /> New event
        </Link>
      </div>
      <p className="-mt-1 text-[15px] text-slate-600">
        Practices, socials, USTA deadlines and registration windows. Matches are added under Matches.
      </p>
      <Suspense fallback={<ListSkeleton />}>
        <EventList />
      </Suspense>
    </section>
  );
}

async function EventList() {
  await requireCaptain();
  const { upcoming, past } = await getCaptainEvents();
  const groups = [
    { title: "Upcoming", id: "upcoming", events: upcoming, empty: "No upcoming events." },
    { title: "Past", id: "past", events: past, empty: "No past events yet." },
  ];
  return (
    <>
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`${group.id}-heading`} className="mt-1">
          <SectionHeading id={`${group.id}-heading`}>{group.title}</SectionHeading>
          {group.events.length === 0 ? (
            <p className="mt-2 rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">{group.empty}</p>
          ) : (
            <ul className="mt-2 grid gap-2.5 md:grid-cols-2">
              {group.events.map((event) => (
                <li key={event.id}>
                  <ScheduleCard item={event} showVisibility />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[104px]" />
      ))}
    </div>
  );
}
