import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/page-hero";
import { SectionHeading, Skeleton, StatCard } from "@/components/ui";
import { formatShortDate, formatWeekday } from "@/lib/format";
import { opponentLabel, resultLabel } from "@/lib/matches/display";
import { getPublicResults, type PublicResults } from "@/lib/public-data";

export const metadata: Metadata = { title: "Results" };

export default function ResultsPage() {
  return (
    <>
      <PageHero eyebrow="This season" title="Results">
        Scores, line records and the league table. Standings are updated by hand from the USTA site.
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-6">
        <Suspense fallback={<ResultsSkeleton />}>
          <Results />
        </Suspense>
      </div>
    </>
  );
}

const pct = (won: number, lost: number) => (won + lost === 0 ? "No lines yet" : `${Math.round((100 * won) / (won + lost))}% won`);

async function Results() {
  const results = await getPublicResults();
  const linesWon = results.singles_won + results.doubles_won;
  const linesLost = results.singles_lost + results.doubles_lost;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="stats-heading" className="flex flex-col gap-2.5">
        <SectionHeading id="stats-heading">Season stats</SectionHeading>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <StatCard
            label="Record"
            value={`${results.wins}–${results.losses}`}
            note={results.season ? `${results.season} matches` : "Team matches"}
          />
          <StatCard label="Lines" value={`${linesWon}–${linesLost}`} note={pct(linesWon, linesLost)} />
          <StatCard label="Singles" value={`${results.singles_won}–${results.singles_lost}`} note={pct(results.singles_won, results.singles_lost)} />
          <StatCard label="Doubles" value={`${results.doubles_won}–${results.doubles_lost}`} note={pct(results.doubles_won, results.doubles_lost)} />
        </div>
      </section>

      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start">
        <Standings results={results} />
        <RecentResults matches={results.matches} />
      </div>
    </div>
  );
}

function Standings({ results }: { results: PublicResults }) {
  return (
    <section aria-labelledby="standings-heading" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <SectionHeading id="standings-heading">Standings</SectionHeading>
        {results.standings_updated_at ? (
          <span className="text-[13px] text-slate-600">Updated {formatShortDate(results.standings_updated_at)}</span>
        ) : null}
      </div>
      {results.standings.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
          Standings will appear once the league posts them.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-line bg-white">
          <table className="w-full text-[15px]">
            <caption className="sr-only">League standings: team match wins and losses, then individual lines won and lost</caption>
            <thead>
              <tr className="border-b border-line text-left text-[12px] font-semibold tracking-[0.06em] text-slate-500 uppercase">
                <th scope="col" className="w-10 py-2 pl-3.5">#</th>
                <th scope="col" className="py-2">Team</th>
                <th scope="col" className="w-9 py-2 text-right">W</th>
                <th scope="col" className="w-9 py-2 text-right">L</th>
                <th scope="col" className="w-[68px] py-2 pr-3.5 text-right">
                  <abbr title="Individual lines won and lost" className="no-underline">Lines</abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {results.standings.map((row) => (
                <tr
                  key={row.team_name}
                  className={`border-b border-[#EEF2F6] last:border-b-0 ${row.is_stags ? "bg-navy text-white" : ""}`}
                >
                  <td className={`py-3 pl-3.5 font-display text-[20px] font-bold ${row.is_stags ? "text-ball" : ""}`}>{row.rank}</td>
                  <th scope="row" className="py-3 pr-2 text-left font-bold">
                    {row.team_name}
                  </th>
                  <td className="py-3 text-right font-semibold tabular-nums">{row.wins}</td>
                  <td className="py-3 text-right font-semibold tabular-nums">{row.losses}</td>
                  <td className={`py-3 pr-3.5 text-right tabular-nums ${row.is_stags ? "text-slate-300" : "text-slate-600"}`}>
                    {row.lines_won}–{row.lines_lost}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentResults({ matches }: { matches: PublicResults["matches"] }) {
  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-2.5">
      <SectionHeading id="recent-heading">Recent results</SectionHeading>
      {matches.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
          No results yet this season.
        </p>
      ) : (
        <ul className="grid gap-2.5">
          {matches.map((match) => {
            const result = resultLabel(match.team_points, match.opponent_points);
            return (
              <li key={match.id} className="flex items-center gap-3 rounded-[14px] border border-line bg-white p-3.5">
                <div className="w-12 shrink-0 text-center">
                  <span className="block text-[12px] font-bold tracking-[0.08em] text-slate-500 uppercase">
                    {formatWeekday(match.starts_at)}
                  </span>
                  <span className="block text-[14px] font-semibold">{formatShortDate(match.starts_at)}</span>
                </div>
                <span className="min-w-0 flex-1 truncate text-[16px] font-bold">
                  {opponentLabel(match.opponent, match.home_away)}
                </span>
                {result ? (
                  <span
                    className={`shrink-0 rounded-[8px] px-2.5 py-1 font-display text-[20px] font-bold ${
                      result.outcome === "W" ? "bg-blue-100 text-blue-800" : "bg-warn-bg text-orange-800"
                    }`}
                  >
                    <span className="sr-only">{result.outcome === "W" ? "Won" : result.outcome === "L" ? "Lost" : "Tied"} </span>
                    <span aria-hidden="true">{result.outcome} </span>
                    {result.score}
                  </span>
                ) : (
                  <span className="shrink-0 text-[13px] text-slate-500">No score</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[106px]" />
        ))}
      </div>
      <Skeleton className="h-[260px]" />
    </div>
  );
}
