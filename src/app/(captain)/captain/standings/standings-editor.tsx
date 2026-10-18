"use client";

import { useState, useTransition } from "react";
import { CheckIcon, PlusIcon, TrashIcon } from "@/components/shell/icons";
import { fieldClass } from "@/components/ui";
import { saveStandings } from "./actions";

type Row = {
  key: number;
  rank: string;
  team_name: string;
  wins: string;
  losses: string;
  lines_won: string;
  lines_lost: string;
  is_stags: boolean;
};

type Saved = {
  rank: number;
  team_name: string;
  wins: number;
  losses: number;
  lines_won: number;
  lines_lost: number;
  is_stags: boolean;
};

const NUMBERS = [
  ["wins", "W"],
  ["losses", "L"],
  ["lines_won", "Lines won"],
  ["lines_lost", "Lines lost"],
] as const;

const numberInput = `${fieldClass} h-11 px-2 text-center tabular-nums`;

let nextKey = 0;
const toRow = (s: Saved): Row => ({
  key: nextKey++,
  rank: String(s.rank),
  team_name: s.team_name,
  wins: String(s.wins),
  losses: String(s.losses),
  lines_won: String(s.lines_won),
  lines_lost: String(s.lines_lost),
  is_stags: s.is_stags,
});

/** One card per team (fits a phone), saved together so ranks never half-update. */
export function StandingsEditor({ season, initial }: { season: string; initial: Saved[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length > 0
      ? initial.map(toRow)
      : [toRow({ rank: 1, team_name: "Stamford Stags", wins: 0, losses: 0, lines_won: 0, lines_lost: 0, is_stags: true })],
  );
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (key: number, patch: Partial<Row>) => {
    setStatus(null);
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, ...patch } : patch.is_stags ? { ...row, is_stags: false } : row,
      ),
    );
  };

  function addTeam() {
    setStatus(null);
    setRows((current) => [
      ...current,
      toRow({ rank: current.length + 1, team_name: "", wins: 0, losses: 0, lines_won: 0, lines_lost: 0, is_stags: false }),
    ]);
  }

  function save() {
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await saveStandings(
          rows.map((row) => ({
            rank: row.rank,
            team_name: row.team_name,
            wins: row.wins,
            losses: row.losses,
            lines_won: row.lines_won,
            lines_lost: row.lines_lost,
            is_stags: row.is_stags,
          })),
        );
        setStatus(result.ok ? { ok: true, message: "Standings saved." } : { ok: false, message: result.message });
      } catch {
        setStatus({ ok: false, message: "Couldn't save. Check your connection and try again." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[14px] font-semibold text-slate-600">{season}</p>
      <ol className="flex flex-col gap-2.5">
        {rows.map((row, i) => (
          <li key={row.key} className="rounded-[14px] border border-line bg-white p-3.5">
            <fieldset className="flex flex-col gap-2.5">
              <legend className="sr-only">Team {i + 1}</legend>
              <div className="flex items-end gap-2">
                <label className="flex w-16 flex-col gap-1 text-[13px] font-semibold">
                  Rank
                  <input
                    inputMode="numeric"
                    value={row.rank}
                    onChange={(e) => update(row.key, { rank: e.target.value })}
                    className={numberInput}
                  />
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] font-semibold">
                  Team
                  <input
                    value={row.team_name}
                    maxLength={60}
                    onChange={(e) => update(row.key, { team_name: e.target.value })}
                    className={`${fieldClass} h-11`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                  aria-label={`Remove ${row.team_name || `team ${i + 1}`}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line text-slate-600 hover:border-warn hover:text-warn"
                >
                  <TrashIcon size={18} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {NUMBERS.map(([name, label]) => (
                  <label key={name} className="flex flex-col gap-1 text-[13px] font-semibold">
                    {label}
                    <input
                      inputMode="numeric"
                      value={row[name]}
                      onChange={(e) => update(row.key, { [name]: e.target.value })}
                      className={numberInput}
                    />
                  </label>
                ))}
              </div>
              <label className="flex min-h-11 items-center gap-2.5 text-[14px] font-semibold">
                <input
                  type="radio"
                  name="stags"
                  checked={row.is_stags}
                  onChange={() => update(row.key, { is_stags: true })}
                  className="size-5 accent-navy"
                />
                This is us (highlighted on the Results page)
              </label>
            </fieldset>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={addTeam}
        className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-court text-[14px] font-bold text-court hover:bg-blue-50"
      >
        <PlusIcon size={18} /> Add team
      </button>

      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] flex flex-col gap-2 rounded-[14px] border border-line bg-white p-3 md:bottom-4">
        {status ? (
          <p
            role={status.ok ? "status" : "alert"}
            className={`flex items-center gap-1.5 text-[14px] font-semibold ${status.ok ? "text-blue-700" : "text-warn"}`}
          >
            {status.ok ? <CheckIcon size={16} /> : null}
            {status.message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-12 rounded-[12px] bg-navy text-[16px] font-bold text-white hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save standings"}
        </button>
      </div>
    </div>
  );
}
