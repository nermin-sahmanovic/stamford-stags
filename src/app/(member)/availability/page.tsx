import type { Metadata } from "next";
import { Suspense } from "react";
import { SectionHeading, Skeleton } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { formatDayOfMonth, formatMonthShort, formatShortDate, formatTime, formatWeekday } from "@/lib/format";
import { homeAwayLabel, opponentLabel } from "@/lib/matches/display";
import { getAvailabilityBoard, type TeamRow } from "@/lib/matches/queries";
import { AvailabilityPicker } from "./availability-picker";

export const metadata: Metadata = { title: "Availability" };

export default function AvailabilityPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
        Can you play?
      </h1>
      <p className="mt-0.5 text-[15px] text-slate-600">One tap per match. The captain sees it instantly.</p>
      <Suspense fallback={<BoardSkeleton />}>
        <Board />
      </Suspense>
    </div>
  );
}

async function Board() {
  const me = await requireMember();
  const { matches, mine, team } = await getAvailabilityBoard(me.id);

  if (matches.length === 0) {
    return (
      <p className="mt-4 rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
        No upcoming matches yet. Check back once the captain posts the schedule.
      </p>
    );
  }

  return (
    <div className="md:grid md:grid-cols-2 md:items-start md:gap-6">
      <section aria-label="Your availability" className="mt-3 flex flex-col gap-2.5">
        {matches.map((match) => {
          const label = opponentLabel(match.opponent, match.homeAway);
          return (
            <article key={match.id} className="rounded-2xl border border-line bg-white p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-[52px] shrink-0 flex-col items-center justify-center rounded-[12px] bg-navy">
                  <span className="text-[11px] font-bold tracking-[0.06em] text-ball uppercase">
                    {formatMonthShort(match.startsAt)}
                  </span>
                  <span className="font-display text-[26px] leading-none font-bold text-white">
                    {formatDayOfMonth(match.startsAt)}
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-[17px] font-bold">{label}</h2>
                  <p className="text-[13px] text-slate-600">
                    {formatWeekday(match.startsAt)} · {formatTime(match.startsAt)} · {homeAwayLabel(match.homeAway)}
                  </p>
                </div>
              </div>
              <AvailabilityPicker matchId={match.id} status={mine[match.id] ?? null} matchLabel={label} />
            </article>
          );
        })}
      </section>

      <TeamView team={team} />
    </div>
  );
}

function TeamView({ team }: { team: TeamRow[] }) {
  const needed = team[0]?.needed ?? 0;
  return (
    <section aria-labelledby="team-view" className="mt-6 md:mt-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <SectionHeading id="team-view">Team view</SectionHeading>
        <span className="text-[13px] font-semibold text-slate-600">{needed} players needed</span>
      </div>
      <ul className="rounded-2xl border border-line bg-white px-3.5">
        {team.map((row, i) => {
          const pct = row.roster > 0 ? Math.round((row.available / row.roster) * 100) : 0;
          const short = row.needed - row.available;
          const when = formatShortDate(row.startsAt);
          return (
            <li key={row.matchId} className="border-b border-slate-100 py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[15px] font-semibold">
                  {when} · {row.opponent}
                </span>
                <span className="font-display text-[20px] font-bold">{pct}%</span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded bg-line"
                role="img"
                aria-label={`${row.available} of ${row.roster} available`}
              >
                <div className="h-full rounded bg-court" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[13px] text-slate-600">
                <span>
                  {row.available} available · {row.replied}/{row.roster} replied
                  {row.maybe > 0 ? ` · ${row.maybe} maybe` : ""}
                </span>
                {short > 0 ? (
                  <span className="shrink-0 font-bold text-warn">Short {short}</span>
                ) : (
                  <span className="shrink-0 font-bold text-blue-700">Full lineup</span>
                )}
              </div>
              {row.noResponse.length > 0 ? (
                <details open={i === 0} className="group mt-2">
                  <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-slate-700">
                    No response yet for {when} ({row.noResponse.length})
                  </summary>
                  <ul className="flex flex-wrap gap-1.5 pb-1">
                    {row.noResponse.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-full bg-slate-100 px-2.5 py-[5px] text-[13px] font-medium text-slate-700"
                      >
                        {p.name}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <p className="mt-2 text-[13px] text-slate-600">Everyone has replied.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BoardSkeleton() {
  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[136px]" />
      ))}
      <Skeleton className="mt-4 h-48" />
    </div>
  );
}
