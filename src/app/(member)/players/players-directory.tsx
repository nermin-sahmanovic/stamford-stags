"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { PlayerAvatar } from "@/components/player-avatar";
import { SearchIcon } from "@/components/shell/icons";
import { inputClass, Pill, type PillTone } from "@/components/ui";
import { formatShortDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roster/schema";
import type { AvailabilityStatus, DirectoryPlayer, NextMatch } from "@/lib/roster/queries";

type Reply = AvailabilityStatus | "none";

const replyLabels: Record<Reply, { label: string; tone: PillTone }> = {
  available: { label: "Available", tone: "ball" },
  maybe: { label: "Maybe", tone: "blue" },
  unavailable: { label: "Out", tone: "slate" },
  none: { label: "No reply", tone: "warn" },
};

const positionLabels = { singles: "Singles", doubles: "Doubles", both: "Both" } as const;

export function PlayersDirectory({
  players,
  nextMatch,
}: {
  players: DirectoryPlayer[];
  nextMatch: NextMatch | null;
}) {
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState<string>("all");
  const [position, setPosition] = useState<"all" | "singles" | "doubles">("all");
  const [reply, setReply] = useState<Reply | "all">("all");

  const ratings = useMemo(
    () =>
      [...new Set(players.map((p) => p.rating).filter((r): r is number => r !== null))]
        .sort((a, b) => a - b)
        .map((r) => r.toFixed(1)),
    [players],
  );

  const visible = players.filter((p) => {
    if (query && !p.fullName.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (rating !== "all" && p.rating?.toFixed(1) !== rating) return false;
    if (position !== "all" && p.position !== position && p.position !== "both") return false;
    if (reply !== "all" && (p.nextMatchStatus ?? "none") !== reply) return false;
    return true;
  });

  const filtered = query !== "" || rating !== "all" || position !== "all" || reply !== "all";

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">Search players by name</span>
        <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-600" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          autoComplete="off"
          className={`${inputClass} pl-10`}
        />
      </label>

      <FilterGroup label="Rating">
        <Chip pressed={rating === "all"} onClick={() => setRating("all")}>All</Chip>
        {ratings.map((r) => (
          <Chip key={r} pressed={rating === r} onClick={() => setRating(r)}>{r}</Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Plays">
        <Chip pressed={position === "all"} onClick={() => setPosition("all")}>All</Chip>
        <Chip pressed={position === "singles"} onClick={() => setPosition("singles")}>Singles</Chip>
        <Chip pressed={position === "doubles"} onClick={() => setPosition("doubles")}>Doubles</Chip>
      </FilterGroup>

      {nextMatch ? (
        <FilterGroup label={`vs ${nextMatch.opponent} · ${formatShortDate(nextMatch.startsAt)}`}>
          <Chip pressed={reply === "all"} onClick={() => setReply("all")}>All</Chip>
          {(Object.keys(replyLabels) as Reply[]).map((key) => (
            <Chip key={key} pressed={reply === key} onClick={() => setReply(key)}>
              {replyLabels[key].label}
            </Chip>
          ))}
        </FilterGroup>
      ) : null}

      <div className="flex items-center justify-between pt-1">
        <p aria-live="polite" className="text-[13px] font-semibold text-slate-600">
          {visible.length === players.length
            ? `${players.length} players`
            : `${visible.length} of ${players.length} players`}
        </p>
        {filtered ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRating("all");
              setPosition("all");
              setReply("all");
            }}
            className="h-11 px-1 text-[14px] font-semibold text-court"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
          No players match those filters.
        </p>
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2">
          {visible.map((player) => (
            <li key={player.id}>
              <PlayerCard player={player} showReply={nextMatch !== null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayerCard({ player, showReply }: { player: DirectoryPlayer; showReply: boolean }) {
  const reply = replyLabels[player.nextMatchStatus ?? "none"];
  const meta = [
    player.rating === null ? null : `NTRP ${player.rating.toFixed(1)}`,
    positionLabels[player.position],
    `${player.wins}–${player.losses}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/players/${player.id}`}
      className="flex min-h-[64px] items-center gap-3 rounded-[14px] border border-line bg-white px-3.5 py-3 text-navy no-underline hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court"
    >
      <PlayerAvatar name={player.fullName} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-bold">{player.fullName}</span>
          {player.role !== "player" ? <Pill tone="navy">{ROLE_LABELS[player.role]}</Pill> : null}
        </span>
        <span className="block text-[13px] text-slate-600">{meta}</span>
      </span>
      {showReply ? <Pill tone={reply.tone}>{reply.label}</Pill> : null}
    </Link>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-1.5 text-[12px] font-bold tracking-[0.08em] text-slate-600 uppercase">{label}</div>
      {/* One scrolling row per group on phones, so the list starts higher up. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
        {children}
      </div>
    </div>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="h-11 shrink-0 rounded-full border-[1.5px] border-slate-300 bg-white px-3.5 text-[14px] font-semibold text-slate-700 aria-pressed:border-navy aria-pressed:bg-navy aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-court"
    >
      {children}
    </button>
  );
}
