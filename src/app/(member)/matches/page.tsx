import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MatchDetail } from "@/components/matches/match-detail";
import { MatchRow } from "@/components/matches/match-row";
import { MatchesIcon, PlusIcon, ResultsIcon } from "@/components/shell/icons";
import { EmptyState, SectionHeading, Skeleton } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { getMatchCenter, getMatchDetail } from "@/lib/matches/queries";

export const metadata: Metadata = { title: "Match Center" };

type Tab = "upcoming" | "results";

export default function MatchCenterPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 pb-6">
      <Suspense fallback={<CenterSkeleton />}>
        <MatchCenter searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function MatchCenter({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab: tabParam }, me, { upcoming, results }] = await Promise.all([
    searchParams,
    requireMember(),
    getMatchCenter(),
  ]);
  const tab: Tab = tabParam === "results" ? "results" : "upcoming";

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
          Match Center
        </h1>
        {me.isCaptain ? (
          <Link
            href="/captain/matches/new"
            className="flex h-11 items-center gap-1.5 rounded-[10px] bg-navy px-3 text-[14px] font-semibold text-ball no-underline hover:bg-navy-2"
          >
            <PlusIcon size={16} />
            New match
          </Link>
        ) : null}
      </div>

      <nav aria-label="Matches" className="mt-3 grid grid-cols-2 gap-1 rounded-[12px] bg-line p-1">
        {(
          [
            ["upcoming", `Upcoming · ${upcoming.length}`],
            ["results", `Results · ${results.length}`],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={value === "upcoming" ? "/matches" : "/matches?tab=results"}
            aria-current={tab === value ? "page" : undefined}
            scroll={false}
            className={`flex h-11 items-center justify-center rounded-[9px] text-[14px] no-underline ${
              tab === value ? "bg-white font-bold text-navy" : "font-semibold text-slate-600 hover:text-navy"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "upcoming" ? <Upcoming upcoming={upcoming} meId={me.id} isCaptain={me.isCaptain} /> : <Results results={results} />}
    </>
  );
}

async function Upcoming({
  upcoming,
  meId,
  isCaptain,
}: {
  upcoming: Awaited<ReturnType<typeof getMatchCenter>>["upcoming"];
  meId: string;
  isCaptain: boolean;
}) {
  if (upcoming.length === 0) {
    return (
      <div className="mt-3.5">
        <EmptyState
          icon={MatchesIcon}
          title="No matches yet"
          action={isCaptain ? { href: "/captain/matches/new", label: "Create a match" } : undefined}
        >
          The captain adds matches once the league releases the schedule. Check back soon.
        </EmptyState>
      </div>
    );
  }
  const [next, ...later] = upcoming;
  const detail = await getMatchDetail(next.id);

  return (
    <>
      <div className="mt-3.5">
        {detail ? <MatchDetail data={detail} meId={meId} isCaptain={isCaptain} eyebrow="Next match" /> : null}
      </div>
      {later.length > 0 ? (
        <section aria-labelledby="coming-up" className="mt-4">
          <SectionHeading id="coming-up">Coming up</SectionHeading>
          <ul className="mt-2 grid gap-2.5 md:grid-cols-2">
            {later.map((match) => (
              <li key={match.id}>
                <MatchRow match={match} href={`/matches/${match.id}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function Results({ results }: { results: Awaited<ReturnType<typeof getMatchCenter>>["results"] }) {
  if (results.length === 0) {
    return (
      <div className="mt-3.5">
        <EmptyState icon={ResultsIcon} title="No results yet">
          Scores show up here after each match is played.
        </EmptyState>
      </div>
    );
  }
  return (
    <ul className="mt-3.5 grid gap-2.5 md:grid-cols-2">
      {results.map((match) => (
        <li key={match.id}>
          <MatchRow match={match} href={`/matches/${match.id}`} />
        </li>
      ))}
    </ul>
  );
}


function CenterSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-12" />
      <Skeleton className="h-[300px] bg-slate-300" />
      <Skeleton className="h-24" />
      <Skeleton className="h-[72px]" />
    </div>
  );
}
