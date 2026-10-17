import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ArrowLeftIcon } from "@/components/shell/icons";
import { Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { isoToTeamLocalInput } from "@/lib/format";
import { opponentLabel } from "@/lib/matches/display";
import { getMatchDetail } from "@/lib/matches/queries";
import { updateMatch } from "../actions";
import { MatchForm } from "../match-form";
import { ChecklistEditor } from "./checklist-editor";
import { DeleteMatch, LineupPublish } from "./match-tools";
import { ResultsForm } from "./results-form";

export const metadata: Metadata = { title: "Edit match" };

export default function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-2 pb-6">
      <Link
        href="/captain/matches"
        className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold no-underline"
      >
        <ArrowLeftIcon size={16} />
        Matches
      </Link>
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <EditMatch params={params} />
      </Suspense>
    </div>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-5">
      <h2 id={id} className="font-display text-[24px] leading-tight font-bold tracking-[0.03em] uppercase">
        {title}
      </h2>
      {note ? <p className="mb-2 text-[14px] text-slate-600">{note}</p> : <div className="mb-2" />}
      {children}
    </section>
  );
}

async function EditMatch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [, data] = await Promise.all([requireCaptain(), getMatchDetail(id)]);
  if (!data) notFound();
  const { match, season, lineup, checklist, results, hasStarted } = data;
  const geocodeMissed = match.locationAddress !== null && match.latitude === null;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
          {opponentLabel(match.opponent, match.homeAway)}
        </h1>
        <Link href={`/matches/${match.id}`} className="inline-flex min-h-11 items-center text-[14px] font-semibold">
          View as players see it
        </Link>
      </div>

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-6">
        <div>
          <Section id="details" title="Details">
            {geocodeMissed ? (
              <p className="mb-2 rounded-[10px] bg-warn-bg px-3 py-2 text-[14px] font-semibold text-orange-900">
                Couldn&apos;t find the town in the address, so the forecast uses Stamford, CT. Add the town or ZIP to
                fix it.
              </p>
            ) : null}
            <MatchForm
              action={updateMatch.bind(null, match.id)}
              submitLabel="Save match"
              showStatus
              initial={{
                opponent: match.opponent,
                starts_at: isoToTeamLocalInput(match.startsAt),
                home_away: match.homeAway,
                location_name: match.locationName ?? "",
                location_address: match.locationAddress ?? "",
                captain_notes: match.captainNotes ?? "",
                status: match.status,
              }}
            />
          </Section>

          <Section id="lineup" title="Lineup">
            <LineupPublish
              matchId={match.id}
              published={match.lineupPublished}
              slotCount={lineup.reduce((n, line) => n + line.players.length, 0)}
            />
          </Section>
        </div>

        <div>
          <Section id="checklist" title="Match-day checklist" note="Players see this list on the match page.">
            <ChecklistEditor matchId={match.id} items={checklist} />
          </Section>

          <Section
            id="results"
            title="Results"
            note={
              match.status === "completed"
                ? "Saved results show on the Match Center Results tab."
                : hasStarted
                  ? "Enter each line, then save. The match is marked completed."
                  : "You can enter results once the match is played."
            }
          >
            <ResultsForm
              matchId={match.id}
              singlesLines={season.singlesLines}
              doublesLines={season.doublesLines}
              results={results}
              teamPoints={match.teamPoints}
              opponentPoints={match.opponentPoints}
            />
          </Section>

          <Section id="delete" title="Delete">
            <DeleteMatch matchId={match.id} opponent={match.opponent} />
          </Section>
        </div>
      </div>
    </>
  );
}
