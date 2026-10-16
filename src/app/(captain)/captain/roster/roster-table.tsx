"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PlayerAvatar } from "@/components/player-avatar";
import { SearchIcon } from "@/components/shell/icons";
import { inputClass, Pill } from "@/components/ui";
import type { RosterPlayer } from "@/lib/roster/queries";
import { RATING_OPTIONS, ROLE_LABELS } from "@/lib/roster/schema";
import { bulkUpdatePlayers, type BulkResult } from "./actions";

type Show = "active" | "inactive" | "all";

const positionLabels = { singles: "Singles", doubles: "Doubles", both: "Both" } as const;

export function RosterTable({ players, myId }: { players: RosterPlayer[]; myId: string }) {
  const [show, setShow] = useState<Show>("active");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rating, setRating] = useState<string>("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const visible = players.filter(
    (p) =>
      (show === "all" || p.is_active === (show === "active")) &&
      (!q || p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
  );
  const allSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visible.map((p) => p.id)));

  const run = (change: Parameters<typeof bulkUpdatePlayers>[0]["change"]) =>
    startTransition(async () => {
      const outcome = await bulkUpdatePlayers({ ids: [...selected], change });
      setResult(outcome);
      if (outcome.ok) {
        setSelected(new Set());
        setRating("");
      }
    });

  const counts = {
    active: players.filter((p) => p.is_active).length,
    inactive: players.filter((p) => !p.is_active).length,
    all: players.length,
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Show" className="grid grid-cols-3 gap-1.5 rounded-[12px] bg-slate-100 p-1">
        {(["active", "inactive", "all"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={show === key}
            onClick={() => {
              setShow(key);
              setSelected(new Set());
            }}
            className="h-11 rounded-[9px] text-[15px] font-semibold text-slate-700 capitalize aria-pressed:bg-navy aria-pressed:font-bold aria-pressed:text-white"
          >
            {key} ({counts[key]})
          </button>
        ))}
      </div>

      <label className="relative block">
        <span className="sr-only">Search by name or email</span>
        <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email"
          autoComplete="off"
          className={`${inputClass} pl-10`}
        />
      </label>

      {result ? (
        <p
          role={result.ok ? "status" : "alert"}
          className={`rounded-[10px] px-3 py-2 text-[14px] font-semibold ${
            result.ok ? "bg-blue-50 text-blue-800" : "bg-warn-bg text-warn"
          }`}
        >
          {result.ok ? `Updated ${result.count} ${result.count === 1 ? "player" : "players"}.` : result.message}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
          No players to show.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-line bg-slate-50 px-3.5 text-[13px] font-semibold text-slate-600">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-5 accent-navy" />
            Select all {visible.length}
          </label>
          <ul>
            {visible.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-b border-[#EEF2F6] pr-2 last:border-b-0">
                <label className="flex min-h-[64px] min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    aria-label={`Select ${p.full_name}`}
                    className="size-5 shrink-0 accent-navy"
                  />
                  <PlayerAvatar name={p.full_name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-bold">{p.full_name}</span>
                      {p.role !== "player" ? <Pill tone="navy">{ROLE_LABELS[p.role]}</Pill> : null}
                      {!p.is_active ? <Pill tone="warn">Inactive</Pill> : null}
                    </span>
                    <span className="block truncate text-[13px] text-slate-600">
                      {p.ntrp_rating === null ? "NTRP —" : `NTRP ${p.ntrp_rating.toFixed(1)}`} ·{" "}
                      {positionLabels[p.position_pref]} · {p.email}
                    </span>
                  </span>
                </label>
                <Link
                  href={`/captain/roster/${p.id}/edit`}
                  aria-label={`Edit ${p.full_name}`}
                  className="flex h-10 shrink-0 items-center rounded-[10px] bg-navy px-3.5 text-[14px] font-bold text-white no-underline hover:bg-navy-2 hover:text-white"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Bulk edit"
          className="sticky bottom-[calc(67px+max(14px,env(safe-area-inset-bottom)))] z-20 flex flex-col gap-2 rounded-2xl bg-navy p-3 text-white md:bottom-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold">{selected.size} selected</span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="h-9 px-2 text-[14px] font-semibold text-slate-300 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">New NTRP rating</span>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="h-11 w-full rounded-[10px] border border-edge bg-navy-2 px-3 text-base text-white"
              >
                <option value="">Set rating…</option>
                {RATING_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    NTRP {r}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={pending || !rating}
              onClick={() => run({ type: "rating", rating: rating as (typeof RATING_OPTIONS)[number] })}
              className="h-11 rounded-[10px] bg-ball px-4 text-[15px] font-bold text-navy disabled:opacity-50"
            >
              Apply
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending || selected.has(myId)}
              onClick={() => run({ type: "active", active: false })}
              className="h-11 rounded-[10px] border-[1.5px] border-edge text-[15px] font-bold text-white hover:bg-navy-2 disabled:opacity-50"
            >
              Deactivate
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run({ type: "active", active: true })}
              className="h-11 rounded-[10px] border-[1.5px] border-edge text-[15px] font-bold text-white hover:bg-navy-2 disabled:opacity-50"
            >
              Reactivate
            </button>
          </div>
          {selected.has(myId) ? (
            <p className="text-[12px] text-slate-300">Your own row is selected, so Deactivate is off.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
