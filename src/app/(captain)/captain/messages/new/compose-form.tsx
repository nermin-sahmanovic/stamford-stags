"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { fieldClass, inputClass } from "@/components/ui";
import { formatShortDate } from "@/lib/format";
import { opponentLabel } from "@/lib/matches/display";
import type { ComposeData } from "@/lib/messages/queries";
import { AUDIENCE_LABELS, AUDIENCES, composeSchema } from "@/lib/messages/schemas";

type Audience = (typeof AUDIENCES)[number];

const NOTES: Record<Audience, string> = {
  team: "Every active player.",
  match: "Only the players in that match's lineup.",
  custom: "Pick the players below.",
};

/** Audience → (match) → recipient preview → subject and message → send (POST /api/messages). */
export function ComposeForm({
  data,
  initialAudience,
  initialMatchId,
  devBanner,
}: {
  data: ComposeData;
  initialAudience: Audience;
  initialMatchId: string | null;
  devBanner: string | null;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>(initialAudience);
  const [matchId, setMatchId] = useState<string | null>(initialMatchId);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startTransition] = useTransition();

  const match = data.matches.find((m) => m.id === matchId) ?? null;
  const recipients = useMemo(() => {
    if (audience === "team") return data.players;
    if (audience === "match") {
      const ids = new Set(match?.lineupPlayerIds ?? []);
      return data.players.filter((p) => ids.has(p.id));
    }
    return data.players.filter((p) => picked.has(p.id));
  }, [audience, match, picked, data.players]);

  const linkNote = !match
    ? null
    : audience === "match"
      ? match.lineupPublished
        ? "Each email includes one-tap Confirm / Decline for their lineup spot."
        : "The lineup isn't published, so the emails won't include Confirm / Decline links."
      : "Each email includes one-tap Available / Maybe / Can't play for this match.";

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function send() {
    const input = { audience, matchId, playerIds: [...picked], subject, body };
    const parsed = composeSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the message.");
    if (recipients.length === 0) {
      return setError(audience === "match" ? "That match has no lineup yet." : "Choose at least one player.");
    }
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const result = (await response.json()) as { ok: boolean; message?: string; messageId?: string };
        if (!result.ok || !result.messageId) {
          setError(result.message ?? "Couldn't send. Try again.");
          return;
        }
        router.push(`/captain/messages/${result.messageId}`);
      } catch {
        setError("Couldn't send. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="mt-3 md:grid md:grid-cols-2 md:items-start md:gap-6">
      <div className="flex flex-col gap-4">
        {devBanner ? (
          <p className="rounded-[10px] bg-blue-50 px-3 py-2 text-[14px] font-semibold text-blue-800">{devBanner}</p>
        ) : null}

        <fieldset>
          <legend className="text-[14px] font-bold">Send to</legend>
          <div role="radiogroup" className="mt-1.5 grid grid-cols-3 gap-1.5">
            {AUDIENCES.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={audience === a}
                onClick={() => setAudience(a)}
                className={`min-h-12 rounded-[10px] border-[1.5px] px-1.5 text-[14px] leading-tight font-bold ${
                  audience === a ? "border-navy bg-navy text-white" : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {a === "custom" ? "Choose players" : AUDIENCE_LABELS[a]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[13px] text-slate-600">{NOTES[audience]}</p>
        </fieldset>

        <label className="block text-[14px] font-bold">
          {audience === "match" ? "Match" : "About a match (optional)"}
          <select
            value={matchId ?? ""}
            onChange={(e) => setMatchId(e.target.value || null)}
            className={`${inputClass} mt-1.5`}
          >
            <option value="">{audience === "match" ? "Choose a match" : "No match"}</option>
            {data.matches.map((m) => (
              <option key={m.id} value={m.id}>
                {formatShortDate(m.startsAt)} · {opponentLabel(m.opponent, m.homeAway)}
                {m.lineupPlayerIds.length === 0 ? " (no lineup)" : ""}
              </option>
            ))}
          </select>
          {linkNote ? <span className="mt-1 block text-[13px] font-normal text-slate-600">{linkNote}</span> : null}
        </label>

        {audience === "custom" ? (
          <fieldset>
            <legend className="text-[14px] font-bold">Players</legend>
            <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
              {data.players.map((p) => (
                <li key={p.id}>
                  <label className="flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-white px-2.5 text-[15px]">
                    <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="size-5" />
                    <span className="truncate">{p.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}

        <section aria-labelledby="preview-heading" className="rounded-[14px] border border-line bg-white p-3.5">
          <h2 id="preview-heading" className="text-[14px] font-bold">
            {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
          </h2>
          {recipients.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {recipients.map((p) => (
                <li key={p.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[13px] text-slate-700">
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] text-slate-600">
              {audience === "match" ? "Choose a match with a lineup." : "Nobody yet."}
            </p>
          )}
          <p className="mt-2 text-[12px] text-slate-500">One email per player. Nobody sees anyone else&apos;s address.</p>
        </section>
      </div>

      <div className="mt-4 flex flex-col gap-4 md:mt-0">
        <label className="block text-[14px] font-bold">
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className={`${inputClass} mt-1.5`} />
        </label>
        <label className="block text-[14px] font-bold">
          Message
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={8}
            className={`${fieldClass} mt-1.5 py-2.5`}
          />
        </label>
        {error ? (
          <p role="alert" className="text-[14px] font-semibold text-warn">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="h-[52px] rounded-[12px] bg-ball text-[16px] font-bold text-navy hover:brightness-95 disabled:opacity-60"
        >
          {sending ? "Sending…" : `Send to ${recipients.length} player${recipients.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
