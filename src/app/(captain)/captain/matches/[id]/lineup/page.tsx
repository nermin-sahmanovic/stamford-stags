import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftIcon } from "@/components/shell/icons";
import { Pill, Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { formatTime, formatWeekdayDate } from "@/lib/format";
import { opponentLabel } from "@/lib/matches/display";
import { getLineupBuilder } from "@/lib/matches/queries";
import { STATUS_LABELS } from "@/lib/matches/schemas";
import { LineupBuilder } from "./lineup-builder";

export const metadata: Metadata = { title: "Lineup" };

export default function LineupPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-2 pb-6">
      <Suspense fallback={<Skeleton className="mt-11 h-[520px]" />}>
        <Builder params={params} />
      </Suspense>
    </div>
  );
}

async function Builder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [, data] = await Promise.all([requireCaptain(), getLineupBuilder(id)]);
  if (!data) notFound();
  const { match, lines, candidates } = data;

  const count = (status: string | null) => candidates.filter((c) => c.availability === status).length;
  const summary = [
    `${count("available")} available`,
    `${count("maybe")} maybe`,
    `${count(null)} no reply`,
    `${count("unavailable")} out`,
  ].join(" · ");

  return (
    <>
      <Link
        href={`/captain/matches/${match.id}`}
        className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold no-underline"
      >
        <ArrowLeftIcon size={16} />
        Match
      </Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">Lineup</h1>
        {match.status === "scheduled" ? (
          <Pill tone={match.lineupPublished ? "blue" : "warn"}>{match.lineupPublished ? "Published" : "Draft"}</Pill>
        ) : null}
      </div>
      <p className="text-[15px] font-semibold">
        {opponentLabel(match.opponent, match.homeAway)} · {formatWeekdayDate(match.startsAt)} ·{" "}
        {formatTime(match.startsAt)}
      </p>
      <p className="text-[13px] text-slate-600">{summary}</p>

      {match.status === "scheduled" ? (
        <LineupBuilder
          matchId={match.id}
          published={match.lineupPublished}
          lines={lines}
          candidates={candidates}
        />
      ) : (
        <p className="mt-3 rounded-2xl border border-line bg-white p-4 text-[15px] text-slate-600">
          This match is {STATUS_LABELS[match.status].toLowerCase()}, so its lineup can&apos;t be changed here.
        </p>
      )}
    </>
  );
}
