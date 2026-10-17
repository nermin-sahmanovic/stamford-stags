import Link from "next/link";
import { Suspense } from "react";
import { CourtLinesBand } from "@/components/court-lines";
import { PencilIcon, PinIcon } from "@/components/shell/icons";
import { Pill } from "@/components/ui";
import { formatTime, formatWeekdayDate } from "@/lib/format";
import { directionsUrl, opponentLabel, resultLabel } from "@/lib/matches/display";
import { lineLabel, type LineupLine, type MatchDetailData } from "@/lib/matches/queries";
import { Checklist } from "./checklist";
import { MatchForecast, MatchForecastFallback } from "./match-forecast";
import { MyRsvp } from "./my-rsvp";

const sectionHeading = "font-display text-[24px] leading-tight font-bold tracking-[0.03em] uppercase";

/** Full match view: hero, notes, result, lineup and checklist (design-reference/MatchCenter). */
export function MatchDetail({
  data,
  meId,
  isCaptain,
  eyebrow,
}: {
  data: MatchDetailData;
  /** The signed-in player, to show their spot and Confirm / Decline. */
  meId: string;
  isCaptain: boolean;
  eyebrow?: string;
}) {
  const { match, lineup, checklist, results } = data;
  const directions = directionsUrl(match.locationName, match.locationAddress);
  const showLineup = match.lineupPublished || isCaptain;
  const myLine = match.lineupPublished ? lineup.find((l) => l.players.some((p) => p.id === meId)) : undefined;
  const me = myLine?.players.find((p) => p.id === meId);
  const canRsvp = myLine && me && match.status === "scheduled" && !data.hasStarted;
  const canEditLineup = isCaptain && match.status === "scheduled";

  return (
    <div className="md:grid md:grid-cols-2 md:items-start md:gap-6">
      <div>
        <section className="relative overflow-hidden rounded-2xl bg-navy p-4 text-white">
          <CourtLinesBand />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={match.homeAway === "home" ? "ball" : "slate"}>{match.homeAway}</Pill>
              {match.status === "cancelled" ? <Pill tone="warn">Cancelled</Pill> : null}
              {eyebrow ? (
                <span className="text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">{eyebrow}</span>
              ) : null}
            </div>
            <h2 className="mt-2 font-display text-[34px] leading-[1.05] font-bold">
              {opponentLabel(match.opponent, match.homeAway)}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-[10px] bg-navy-2 px-3 py-2.5">
                <div className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">When</div>
                <div className="text-[15px] font-semibold">{formatWeekdayDate(match.startsAt)}</div>
                <div className="text-[13px] text-slate-300">{formatTime(match.startsAt)} start</div>
              </div>
              <div className="min-w-0 rounded-[10px] bg-navy-2 px-3 py-2.5">
                <div className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">Where</div>
                <div className="truncate text-[15px] font-semibold">{match.locationName ?? "To be confirmed"}</div>
                {match.locationAddress ? (
                  <div className="truncate text-[13px] text-slate-300">{match.locationAddress}</div>
                ) : null}
              </div>
            </div>
            {match.status === "scheduled" ? (
              <Suspense fallback={<MatchForecastFallback />}>
                <MatchForecast lat={match.latitude} lon={match.longitude} startsAt={match.startsAt} />
              </Suspense>
            ) : null}
            {directions ? (
              <a
                href={directions}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex h-11 items-center justify-center gap-2 rounded-[10px] bg-white text-[14px] font-semibold text-navy no-underline hover:bg-slate-100"
              >
                <PinIcon size={16} />
                Directions
                <span className="sr-only">(opens Google Maps)</span>
              </a>
            ) : null}
          </div>
        </section>

        {isCaptain ? (
          <Link
            href={`/captain/matches/${match.id}`}
            className="mt-2.5 flex h-11 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-court text-[14px] font-semibold text-court no-underline hover:bg-blue-50"
          >
            <PencilIcon size={16} />
            Edit match, checklist and results
          </Link>
        ) : null}

        {match.captainNotes ? (
          <section className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 px-3.5 py-3">
            <h2 className="text-[12px] font-bold tracking-[0.08em] text-amber-800 uppercase">Captain notes</h2>
            <p className="mt-1 text-[15px] leading-[1.45] whitespace-pre-line text-slate-800">{match.captainNotes}</p>
          </section>
        ) : null}

        {match.status === "completed" ? <Result data={data} /> : null}
      </div>

      <div>
        <section aria-labelledby="lineup-heading" className="mt-5 md:mt-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="lineup-heading" className={sectionHeading}>
              Lineup
            </h2>
            {isCaptain && !match.lineupPublished && lineup.length > 0 ? (
              <Pill tone="warn">Draft · not published</Pill>
            ) : null}
            {canEditLineup ? (
              <Link
                href={`/captain/matches/${match.id}/lineup`}
                className="ml-auto flex min-h-11 items-center text-[14px] font-semibold text-court"
              >
                {lineup.length > 0 ? "Edit lineup" : "Build lineup"}
              </Link>
            ) : null}
          </div>
          {canRsvp ? (
            <MyRsvp
              matchId={match.id}
              line={myLine.label}
              partner={myLine.players.find((p) => p.id !== meId)?.name ?? null}
              court={myLine.court}
              rsvp={me.rsvp}
            />
          ) : null}
          {showLineup && lineup.length > 0 ? (
            <Lineup lineup={lineup} meId={meId} results={match.status === "completed" ? results : []} />
          ) : (
            <p className="rounded-2xl border border-line bg-white p-4 text-[15px] text-slate-600">
              Lineup not posted yet.
            </p>
          )}
        </section>

        {checklist.length > 0 && match.status !== "completed" ? (
          <Checklist items={checklist} canEdit={isCaptain} />
        ) : null}
      </div>
    </div>
  );
}

function Result({ data }: { data: MatchDetailData }) {
  const { match, results } = data;
  const result = resultLabel(match.teamPoints, match.opponentPoints);
  return (
    <section aria-labelledby="result-heading" className="mt-5">
      <h2 id="result-heading" className={sectionHeading}>
        Result
      </h2>
      <div className="mt-2 rounded-2xl border border-line bg-white p-3.5">
        {result ? (
          <p className="font-display text-[32px] leading-none font-bold">
            <span className={result.outcome === "W" ? "text-blue-700" : result.outcome === "L" ? "text-warn" : ""}>
              {result.outcome === "W" ? "Won" : result.outcome === "L" ? "Lost" : "Tied"}
            </span>{" "}
            {result.score}
          </p>
        ) : (
          <p className="text-[15px] text-slate-600">Score not entered yet.</p>
        )}
        {results.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {results.map((r) => (
              <li key={lineLabel(r.lineType, r.lineNumber)} className="flex items-center gap-3 py-2">
                <LineChip lineType={r.lineType} label={lineLabel(r.lineType, r.lineNumber)} />
                <span className="flex-1 text-[14px] text-slate-700">{r.score ?? "No score"}</span>
                <span className={`text-[14px] font-bold ${r.won ? "text-blue-700" : "text-warn"}`}>
                  {r.won ? "W" : "L"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function LineChip({ lineType, label }: { lineType: "singles" | "doubles"; label: string }) {
  return (
    <span
      className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-lg font-display text-[16px] font-bold ${
        lineType === "singles" ? "bg-navy text-ball" : "bg-court text-white"
      }`}
    >
      {label}
    </span>
  );
}

const rsvpText = { confirmed: "Confirmed", pending: "Pending", declined: "Declined" } as const;

function lineStatus(line: LineupLine) {
  if (line.players.every((p) => p.rsvp === "confirmed")) {
    return { text: line.players.length > 1 ? "Both confirmed" : "Confirmed", tone: "text-blue-700" };
  }
  // Declines first: they're what the captain has to act on.
  const open = line.players
    .filter((p) => p.rsvp !== "confirmed")
    .sort((a, b) => Number(b.rsvp === "declined") - Number(a.rsvp === "declined"));
  return {
    text: open.map((p) => (line.players.length > 1 ? `${p.name} ${p.rsvp}` : rsvpText[p.rsvp])).join(" · "),
    tone: "text-warn",
  };
}

function Lineup({
  lineup,
  meId,
  results,
}: {
  lineup: LineupLine[];
  meId: string;
  results: MatchDetailData["results"];
}) {
  const all = lineup.flatMap((l) => l.players);
  const counts = {
    confirmed: all.filter((p) => p.rsvp === "confirmed").length,
    pending: all.filter((p) => p.rsvp === "pending").length,
    declined: all.filter((p) => p.rsvp === "declined").length,
  };
  const resultFor = new Map(results.map((r) => [lineLabel(r.lineType, r.lineNumber), r]));

  return (
    <>
      <div className="mb-2.5 grid grid-cols-3 gap-2">
        {(
          [
            ["Confirmed", counts.confirmed, "text-blue-700"],
            ["Pending", counts.pending, "text-warn"],
            ["Declined", counts.declined, counts.declined > 0 ? "text-warn" : "text-navy"],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label} className="rounded-[12px] border border-line bg-white px-2.5 py-2">
            <div className={`font-display text-[24px] leading-none font-bold ${tone}`}>{value}</div>
            <div className="text-[12px] font-semibold text-slate-600">{label}</div>
          </div>
        ))}
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-line bg-white">
        {lineup.map((line) => {
          const status = lineStatus(line);
          const result = resultFor.get(line.key);
          const mine = line.players.some((p) => p.id === meId);
          return (
            <li
              key={line.key}
              className={`flex items-center gap-3 px-3.5 py-3 first:rounded-t-2xl last:rounded-b-2xl ${mine ? "bg-blue-50" : ""}`}
            >
              <LineChip lineType={line.lineType} label={line.label} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">
                  {line.players.map((p) => p.name).join(" & ")}
                  {mine ? <span className="sr-only"> (your line)</span> : null}
                </div>
                {result ? (
                  <div className={`text-[12px] font-semibold ${result.won ? "text-blue-700" : "text-warn"}`}>
                    {result.won ? "Won" : "Lost"}
                    {result.score ? ` · ${result.score}` : ""}
                  </div>
                ) : (
                  <div className={`text-[12px] font-semibold ${status.tone}`}>{status.text}</div>
                )}
              </div>
              {line.court ? <span className="shrink-0 text-[13px] font-semibold text-slate-600">{line.court}</span> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
