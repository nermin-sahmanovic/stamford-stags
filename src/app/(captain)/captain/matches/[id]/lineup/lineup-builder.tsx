"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CloseIcon } from "@/components/shell/icons";
import type { BuilderLine, LineupCandidate, RsvpStatus } from "@/lib/matches/queries";
import { courtInput, type LineupInput } from "@/lib/matches/schemas";
import { saveLineup } from "../../actions";
import { PlayerPicker } from "./player-picker";

type SeatKey = string;
const seatKey = (lineKey: string, seat: number): SeatKey => `${lineKey}-${seat}`;

const RSVP_PILL: Record<RsvpStatus, { text: string; className: string }> = {
  confirmed: { text: "Confirmed", className: "bg-blue-100 text-blue-800" },
  pending: { text: "Pending", className: "bg-warn-bg text-orange-800" },
  declined: { text: "Declined", className: "bg-warn text-white" },
};

const button =
  "h-[52px] rounded-[12px] px-4 text-[16px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-50";

/**
 * Captain lineup builder. Edits stay local until one save, which replaces the lineup in a
 * single transaction (save_lineup) and notifies only the players who need to (re)confirm.
 */
export function LineupBuilder({
  matchId,
  published,
  lines,
  candidates,
}: {
  matchId: string;
  published: boolean;
  lines: BuilderLine[];
  candidates: LineupCandidate[];
}) {
  const [seats, setSeats] = useState<Record<SeatKey, string | null>>(() =>
    Object.fromEntries(lines.flatMap((l) => l.seats.map((s) => [seatKey(l.key, s.seat), s.playerId]))),
  );
  const [courts, setCourts] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.key, courtInput(l.court)])),
  );
  const [firstCourt, setFirstCourt] = useState(() => {
    const first = courtInput(lines[0]?.court ?? null);
    return /^\d+$/.test(first) ? first : "1";
  });
  const [picking, setPicking] = useState<{ line: BuilderLine; seat: number } | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, startTransition] = useTransition();

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  // What the server has now: RSVP per player per line (a player who stays on a line keeps it).
  const savedRsvp = useMemo(() => {
    const map = new Map<string, RsvpStatus>();
    for (const l of lines) for (const s of l.seats) if (s.playerId && s.rsvp) map.set(`${s.playerId}@${l.key}`, s.rsvp);
    return map;
  }, [lines]);

  const seatedIn = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lines) for (const s of l.seats) {
      const id = seats[seatKey(l.key, s.seat)];
      if (id) map.set(id, l.key);
    }
    return map;
  }, [lines, seats]);

  const dirty = lines.some(
    (l) =>
      (courts[l.key] ?? "").trim() !== courtInput(l.court) ||
      l.seats.some((s) => (seats[seatKey(l.key, s.seat)] ?? null) !== s.playerId),
  );
  const totalSeats = lines.reduce((n, l) => n + l.seats.length, 0);
  const filled = seatedIn.size;
  const empty = totalSeats - filled;
  const ineligible = [...seatedIn.keys()].map((id) => byId.get(id)).filter((c) => c?.ineligible);

  // Warn before leaving with unsaved changes (the captain may be on flaky courtside signal).
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function edit(fn: () => void) {
    setMessage(null);
    setConfirmEmpty(false);
    fn();
  }

  function fillCourts() {
    const start = Number.parseInt(firstCourt, 10);
    if (!Number.isFinite(start) || start < 0) return;
    edit(() => setCourts(Object.fromEntries(lines.map((l, i) => [l.key, String(start + i)]))));
  }

  function save(publish: boolean) {
    if (publish && empty > 0 && !confirmEmpty) {
      setConfirmEmpty(true);
      return;
    }
    const slots: LineupInput["slots"] = lines.flatMap((l) =>
      l.seats.flatMap((s) => {
        const playerId = seats[seatKey(l.key, s.seat)];
        return playerId
          ? [{ line_type: l.lineType, line_number: l.lineNumber, seat: s.seat, player_id: playerId, court: courts[l.key] ?? "" }]
          : [];
      }),
    );
    setMessage(null);
    setConfirmEmpty(false);
    startTransition(async () => {
      try {
        const result = await saveLineup(matchId, { slots, publish });
        if (!result.ok) {
          setMessage({ tone: "error", text: result.message });
          return;
        }
        const people = (n: number) => `${n} player${n === 1 ? "" : "s"}`;
        const saved = !publish
          ? "Draft saved. Only captains can see it."
          : !published
            ? "Published."
            : result.asked > 0
              ? `Saved. ${people(result.asked)} asked to confirm.`
              : "Saved. No one needs to re-confirm.";
        const emails = (n: number) => `${n} email${n === 1 ? "" : "s"}`;
        setMessage(
          result.emailFailed > 0
            ? { tone: "error", text: `${saved} ${emails(result.emailFailed)} failed. Check Messages.` }
            : result.emailLogged > 0
              ? { tone: "error", text: `${saved} ${emails(result.emailLogged)} logged only, not sent: email isn't set up.` }
              : { tone: "ok", text: result.emailed > 0 ? `${saved} ${people(result.emailed)} emailed.` : saved },
        );
      } catch {
        setMessage({ tone: "error", text: "Couldn't save. Check your connection and try again." });
      }
    });
  }

  return (
    <>
      <div className="mt-3 flex items-end gap-2 rounded-[14px] border border-line bg-white p-3">
        <label className="flex-1 text-[13px] font-semibold text-slate-600">
          Courts start at
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={firstCourt}
            onChange={(e) => setFirstCourt(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="mt-1 block h-11 w-full rounded-[10px] border border-slate-300 px-3 text-[16px] text-navy"
          />
        </label>
        <button
          type="button"
          onClick={fillCourts}
          className="h-11 shrink-0 rounded-[10px] border-[1.5px] border-court px-3 text-[14px] font-bold text-court hover:bg-blue-50"
        >
          {firstCourt ? `Number courts ${firstCourt}–${Number.parseInt(firstCourt, 10) + lines.length - 1}` : "Number courts"}
        </button>
      </div>

      {ineligible.length > 0 ? (
        <p role="status" className="mt-3 rounded-[12px] bg-warn-bg px-3 py-2.5 text-[14px] font-semibold text-orange-900">
          Check eligibility:{" "}
          {ineligible.map((c) => `${c!.name} (${c!.ineligible})`).join(", ")}.
        </p>
      ) : null}

      <ul className="mt-3 grid gap-2.5 md:grid-cols-2">
        {lines.map((line) => (
          <li key={line.key} className="rounded-2xl border border-line bg-white p-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-lg font-display text-[16px] font-bold ${
                  line.lineType === "singles" ? "bg-navy text-ball" : "bg-court text-white"
                }`}
              >
                {line.key}
              </span>
              <span className="flex-1 text-[13px] font-semibold tracking-[0.06em] text-slate-600 uppercase">
                {line.lineType === "singles" ? "Singles" : "Doubles"}
              </span>
              <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600">
                Ct
                <input
                  type="text"
                  inputMode="numeric"
                  value={courts[line.key] ?? ""}
                  maxLength={20}
                  onChange={(e) => {
                    const value = e.target.value;
                    edit(() => setCourts((c) => ({ ...c, [line.key]: value })));
                  }}
                  aria-label={`Court for ${line.key}`}
                  className="h-11 w-16 rounded-[10px] border border-slate-300 px-2 text-center text-[16px] text-navy"
                />
              </label>
            </div>

            <div className="mt-2 grid gap-2">
              {line.seats.map((s) => {
                const key = seatKey(line.key, s.seat);
                const playerId = seats[key] ?? null;
                const player = playerId ? byId.get(playerId) : undefined;
                const rsvp = playerId ? savedRsvp.get(`${playerId}@${line.key}`) : undefined;
                const pill = published && playerId ? (rsvp ? RSVP_PILL[rsvp] : null) : null;
                const label = `${line.key}${line.seats.length > 1 ? ` seat ${s.seat}` : ""}`;
                return (
                  <div key={key} className="flex items-stretch gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPicking({ line, seat: s.seat })}
                      aria-label={player ? `${label}: ${player.name}. Change player` : `${label}: choose player`}
                      className={`flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-[10px] border-[1.5px] px-3 py-1.5 text-left ${
                        !player
                          ? "border-dashed border-slate-300 text-court"
                          : rsvp === "declined" && published
                            ? "border-warn bg-warn-bg"
                            : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {player ? (
                        <>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[16px] font-semibold">{player.name}</span>
                            {rsvp === "declined" && published ? (
                              <span className="block text-[13px] font-semibold text-warn">Declined. Tap to replace</span>
                            ) : player.ineligible ? (
                              <span className="block truncate text-[13px] font-semibold text-warn">Not eligible</span>
                            ) : player.availability !== "available" ? (
                              <span className="block truncate text-[13px] font-semibold text-warn">
                                {player.availability === "maybe"
                                  ? "Said maybe"
                                  : player.availability === "unavailable"
                                    ? "Said unavailable"
                                    : "No reply"}
                              </span>
                            ) : null}
                          </span>
                          {pill ? (
                            <span className={`shrink-0 rounded-md px-2 py-[3px] text-[11px] font-bold tracking-[0.06em] uppercase ${pill.className}`}>
                              {pill.text}
                            </span>
                          ) : published ? (
                            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-[3px] text-[11px] font-bold tracking-[0.06em] text-slate-700 uppercase">
                              New
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[15px] font-semibold">+ Choose player</span>
                      )}
                    </button>
                    {player ? (
                      <button
                        type="button"
                        onClick={() => edit(() => setSeats((prev) => ({ ...prev, [key]: null })))}
                        className="flex w-11 shrink-0 items-center justify-center rounded-[10px] text-slate-500 hover:bg-slate-100"
                      >
                        <CloseIcon size={18} />
                        <span className="sr-only">Clear {label}</span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-[calc(59px+max(14px,env(safe-area-inset-bottom)))] z-20 -mx-4 mt-4 border-t border-line bg-white px-4 py-3 md:bottom-0 md:mx-0 md:rounded-2xl md:border">
        <p className="mb-2 text-[13px] text-slate-600">
          <span className="font-bold text-navy">
            {filled}/{totalSeats} seats filled
          </span>
          {published ? " · Players new to a line will be asked to confirm." : " · Publishing sets every RSVP to pending."}
        </p>
        {confirmEmpty ? (
          <div role="alert" className="mb-2 rounded-[10px] bg-warn-bg px-3 py-2 text-[14px] font-semibold text-orange-900">
            {empty} seat{empty === 1 ? "" : "s"} empty. {published ? "Save" : "Publish"} anyway?
          </div>
        ) : null}
        <div className="flex gap-2">
          {confirmEmpty ? (
            <button
              type="button"
              onClick={() => setConfirmEmpty(false)}
              className={`${button} flex-1 border-[1.5px] border-slate-300 bg-white text-navy`}
            >
              Keep editing
            </button>
          ) : !published ? (
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => save(false)}
              className={`${button} flex-1 border-[1.5px] border-court bg-white text-court`}
            >
              Save draft
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving || filled === 0 || (published && !dirty)}
            onClick={() => save(true)}
            className={`${button} flex-1 bg-ball text-navy hover:brightness-95`}
          >
            {saving
              ? "Saving…"
              : confirmEmpty
                ? `${published ? "Save" : "Publish"} anyway`
                : published
                  ? "Save changes"
                  : "Publish lineup"}
          </button>
        </div>
        {message ? (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={`mt-2 text-[14px] font-semibold ${message.tone === "error" ? "text-warn" : "text-blue-700"}`}
          >
            {message.text}
          </p>
        ) : null}
      </div>

      {picking ? (
        <PlayerPicker
          title={`${picking.line.key}${picking.line.seats.length > 1 ? ` · seat ${picking.seat}` : ""}`}
          candidates={candidates}
          currentId={seats[seatKey(picking.line.key, picking.seat)] ?? null}
          seatedIn={seatedIn}
          onPick={(playerId) => {
            const key = seatKey(picking.line.key, picking.seat);
            edit(() => setSeats((prev) => ({ ...prev, [key]: playerId })));
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </>
  );
}
