import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MatchRow } from "@/components/matches/match-row";
import { PlusIcon } from "@/components/shell/icons";
import { SectionHeading, Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { homeAwayLabel } from "@/lib/matches/display";
import { getCaptainMatches, type CaptainMatchRow } from "@/lib/matches/queries";
import { STATUS_LABELS } from "@/lib/matches/schemas";

export const metadata: Metadata = { title: "Matches" };

export default function MatchAdminPage() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">Matches</h1>
        <Link
          href="/captain/matches/new"
          className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-navy px-3 text-[14px] font-bold text-white no-underline hover:bg-navy-2 hover:text-white"
        >
          <PlusIcon size={18} /> New match
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <MatchList />
      </Suspense>
    </section>
  );
}

function meta(match: CaptainMatchRow) {
  const parts = [homeAwayLabel(match.homeAway), formatTime(match.startsAt)];
  if (match.status === "scheduled" && match.replied !== null && match.roster !== null) {
    parts.push(`${match.available ?? 0} avail · ${match.replied}/${match.roster} replied`);
  } else if (match.status !== "scheduled") {
    parts.push(STATUS_LABELS[match.status]);
  }
  return parts.join(" · ");
}

async function MatchList() {
  await requireCaptain();
  const { upcoming, past } = await getCaptainMatches();
  const groups = [
    { title: "Upcoming", id: "upcoming", matches: upcoming, empty: "No upcoming matches. Add one to get started." },
    { title: "Past", id: "past", matches: past, empty: "No past matches yet." },
  ];
  return (
    <>
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`${group.id}-heading`} className="mt-1">
          <SectionHeading id={`${group.id}-heading`}>{group.title}</SectionHeading>
          {group.matches.length === 0 ? (
            <p className="mt-2 rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
              {group.empty}
            </p>
          ) : (
            <ul className="mt-2 grid gap-2.5 md:grid-cols-2">
              {group.matches.map((match) => (
                <li key={match.id}>
                  <MatchRow match={match} href={`/captain/matches/${match.id}`} meta={meta(match)} />
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
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[72px]" />
      ))}
    </div>
  );
}
