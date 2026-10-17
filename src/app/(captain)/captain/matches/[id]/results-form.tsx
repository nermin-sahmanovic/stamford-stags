"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";
import type { LineResult, LineType } from "@/lib/matches/queries";
import { LINE_OUTCOMES } from "@/lib/matches/schemas";
import { saveResults } from "../actions";
import { ErrorText, useAction } from "./match-tools";

type Outcome = (typeof LINE_OUTCOMES)[number];
type Line = { lineType: LineType; lineNumber: number; label: string; outcome: Outcome; score: string };

const OUTCOME_LABELS: Record<Outcome, string> = { won: "Won", lost: "Lost", none: "Not played" };
const OUTCOME_SELECTED: Record<Outcome, string> = {
  won: "peer-checked:bg-court peer-checked:text-white",
  lost: "peer-checked:bg-warn peer-checked:text-white",
  none: "peer-checked:bg-navy peer-checked:text-white",
};

function buildLines(singles: number, doubles: number, results: LineResult[]): Line[] {
  const saved = new Map(results.map((r) => [`${r.lineType}:${r.lineNumber}`, r]));
  const make = (lineType: LineType, lineNumber: number): Line => {
    const r = saved.get(`${lineType}:${lineNumber}`);
    return {
      lineType,
      lineNumber,
      label: `${lineType === "singles" ? "S" : "D"}${lineNumber}`,
      outcome: r ? (r.won ? "won" : "lost") : "none",
      score: r?.score ?? "",
    };
  };
  return [
    ...Array.from({ length: singles }, (_, i) => make("singles", i + 1)),
    ...Array.from({ length: doubles }, (_, i) => make("doubles", i + 1)),
  ];
}

/**
 * Line-by-line results plus team points. Points follow the line wins until the captain types
 * their own (e.g. for a default or a retirement). Saving marks the match completed.
 */
export function ResultsForm({
  matchId,
  singlesLines,
  doublesLines,
  results,
  teamPoints,
  opponentPoints,
}: {
  matchId: string;
  singlesLines: number;
  doublesLines: number;
  results: LineResult[];
  teamPoints: number | null;
  opponentPoints: number | null;
}) {
  const [lines, setLines] = useState(() => buildLines(singlesLines, doublesLines, results));
  const [points, setPoints] = useState<{ team: string; opponent: string } | null>(
    teamPoints === null || opponentPoints === null ? null : { team: String(teamPoints), opponent: String(opponentPoints) },
  );
  const [saved, setSaved] = useState(false);
  const { error, pending, run } = useAction();

  const wins = lines.filter((l) => l.outcome === "won").length;
  const losses = lines.filter((l) => l.outcome === "lost").length;
  const shown = points ?? { team: String(wins), opponent: String(losses) };

  const update = (i: number, change: Partial<Line>) => {
    setSaved(false);
    setLines((current) => current.map((line, j) => (j === i ? { ...line, ...change } : line)));
  };

  function submit() {
    run(
      () =>
        saveResults(matchId, {
          lines: lines.map((l) => ({
            line_type: l.lineType,
            line_number: l.lineNumber,
            outcome: l.outcome,
            score: l.score,
          })),
          team_points: shown.team,
          opponent_points: shown.opponent,
        }),
      () => setSaved(true),
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4"
    >
      <ul className="flex flex-col divide-y divide-slate-100">
        {lines.map((line, i) => (
          <li key={line.label} className="flex flex-col gap-2 py-2.5 first:pt-0">
            <fieldset className="flex items-center gap-2.5">
              <legend className="sr-only">{line.label} result</legend>
              <span
                aria-hidden="true"
                className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-lg font-display text-[16px] font-bold ${
                  line.lineType === "singles" ? "bg-navy text-ball" : "bg-court text-white"
                }`}
              >
                {line.label}
              </span>
              <div className="grid flex-1 grid-cols-3 gap-1 rounded-[12px] bg-slate-100 p-1">
                {LINE_OUTCOMES.map((outcome) => (
                  <label key={outcome} className="relative">
                    <input
                      type="radio"
                      name={`outcome-${line.label}`}
                      value={outcome}
                      checked={line.outcome === outcome}
                      onChange={() => update(i, { outcome })}
                      className="peer sr-only"
                    />
                    <span
                      className={`flex h-11 cursor-pointer items-center justify-center rounded-[9px] text-[14px] font-semibold text-slate-700 peer-checked:font-bold peer-focus-visible:outline-2 peer-focus-visible:outline-court ${OUTCOME_SELECTED[outcome]}`}
                    >
                      {OUTCOME_LABELS[outcome]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {line.outcome !== "none" ? (
              <label className="flex items-center gap-2.5 text-[14px] font-semibold">
                <span className="w-10 shrink-0 text-center text-slate-600">Score</span>
                <input
                  type="text"
                  value={line.score}
                  onChange={(e) => update(i, { score: e.target.value })}
                  placeholder="6-3 4-6 10-7"
                  maxLength={40}
                  className={`${inputClass} h-11`}
                />
              </label>
            ) : null}
          </li>
        ))}
      </ul>

      <fieldset className="grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3">
        <legend className="mb-1.5 text-[14px] font-semibold">Team points</legend>
        {(
          [
            ["team", "Stags"],
            ["opponent", "Opponent"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex flex-col gap-1.5 text-[14px] font-semibold">
            {label}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              value={shown[key]}
              onChange={(e) => {
                setSaved(false);
                setPoints({ ...shown, [key]: e.target.value });
              }}
              className={`${inputClass} px-3`}
            />
          </label>
        ))}
      </fieldset>
      {points ? (
        <button
          type="button"
          onClick={() => setPoints(null)}
          className="self-start text-[13px] font-semibold text-court underline"
        >
          Use line wins ({wins}–{losses})
        </button>
      ) : (
        <p className="text-[13px] text-slate-600">Points follow the line wins. Change them for defaults or retirements.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-[12px] bg-navy text-[16px] font-bold text-white hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save results"}
      </button>
      <ErrorText error={error} />
      {saved && !error ? (
        <p role="status" className="text-[14px] font-semibold text-blue-700">
          Results saved. The match is marked completed.
        </p>
      ) : null}
    </form>
  );
}
