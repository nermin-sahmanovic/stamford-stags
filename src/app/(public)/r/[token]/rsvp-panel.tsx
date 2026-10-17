"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { applyRsvp, type ApplyState } from "./actions";
import { ANSWER_LABELS, AVAILABILITY_ANSWERS, isLineupAnswer, LINEUP_ANSWERS, type RsvpAnswer } from "./answers";

const SAVED_TEXT: Record<RsvpAnswer, string> = {
  available: "You're marked available.",
  maybe: "You're marked maybe.",
  unavailable: "You're marked as can't play.",
  confirmed: "Your lineup spot is confirmed.",
  declined: "You've declined your spot. Your captain will find a sub.",
};

const SELECTED: Record<RsvpAnswer, string> = {
  available: "border-navy bg-ball text-navy",
  maybe: "border-warn bg-warn-bg text-orange-900",
  unavailable: "border-navy bg-navy text-white",
  confirmed: "border-navy bg-ball text-navy",
  declined: "border-warn bg-warn-bg text-orange-900",
};

const idle: ApplyState = { status: "idle" };

/**
 * Saves the link's answer once on load, then lets the player change it. The buttons are a
 * plain form posting to the server action, so they also work without JavaScript.
 */
export function RsvpPanel({
  token,
  autoAnswer,
  playerName,
  matchId,
  matchLabel,
  when,
  availability,
  inLineup,
  rsvp,
}: {
  token: string;
  autoAnswer: RsvpAnswer | null;
  playerName: string;
  matchId: string;
  matchLabel: string;
  when: string;
  availability: RsvpAnswer | null;
  inLineup: boolean;
  rsvp: "pending" | "confirmed" | "declined" | null;
}) {
  const [state, formAction, pending] = useActionState(applyRsvp, idle);
  const applied = useRef(false);

  useEffect(() => {
    if (!autoAnswer || applied.current) return;
    if (isLineupAnswer(autoAnswer) && !inLineup) return;
    applied.current = true;
    const data = new FormData();
    data.set("token", token);
    data.set("s", autoAnswer);
    startTransition(() => formAction(data));
  }, [autoAnswer, inLineup, token, formAction]);

  const saved = state.status === "saved" ? state.answer : null;
  const currentAvailability = saved && !isLineupAnswer(saved) ? saved : availability;
  const currentRsvp = saved && isLineupAnswer(saved) ? saved : rsvp === "pending" ? null : rsvp;

  return (
    <>
      <p className="text-[14px] font-semibold text-slate-600">Hi {playerName}</p>
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">{matchLabel}</h1>
      <p className="text-[15px] text-slate-700">{when}</p>

      <div aria-live="polite">
        {saved ? (
          <p className="mt-3 rounded-[14px] bg-navy px-4 py-3 text-[16px] font-semibold text-white">
            <span className="text-ball">Saved.</span> {SAVED_TEXT[saved]}
          </p>
        ) : pending ? (
          <p className="mt-3 rounded-[14px] border border-line bg-white px-4 py-3 text-[15px] text-slate-700">
            Saving your answer…
          </p>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="mt-3 rounded-[14px] bg-warn-bg px-4 py-3 text-[15px] font-semibold text-orange-900">
            {state.message}
          </p>
        ) : null}
      </div>

      {inLineup ? (
        <AnswerGroup
          title="Your lineup spot"
          answers={LINEUP_ANSWERS}
          current={currentRsvp}
          token={token}
          formAction={formAction}
          pending={pending}
        />
      ) : null}
      <AnswerGroup
        title="Availability"
        answers={AVAILABILITY_ANSWERS}
        current={currentAvailability}
        token={token}
        formAction={formAction}
        pending={pending}
      />

      <Link
        href={`/matches/${matchId}`}
        className="mt-5 flex min-h-11 items-center justify-center text-[15px] font-semibold text-court"
      >
        Open Match Center (sign in)
      </Link>
    </>
  );
}

function AnswerGroup({
  title,
  answers,
  current,
  token,
  formAction,
  pending,
}: {
  title: string;
  answers: readonly RsvpAnswer[];
  current: RsvpAnswer | null;
  token: string;
  formAction: (data: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={formAction} className="mt-4 rounded-[14px] border border-line bg-white p-3.5">
      <h2 className="text-[12px] font-bold tracking-[0.08em] text-slate-600 uppercase">{title}</h2>
      <input type="hidden" name="token" value={token} />
      <div role="group" aria-label={title} className={`mt-2 grid gap-1.5 ${answers.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {answers.map((answer) => {
          const selected = current === answer;
          return (
            <button
              key={answer}
              type="submit"
              name="s"
              value={answer}
              disabled={pending}
              aria-pressed={selected}
              className={`h-12 rounded-[10px] border-[1.5px] text-[15px] font-bold disabled:opacity-60 ${
                selected ? SELECTED[answer] : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {ANSWER_LABELS[answer]}
            </button>
          );
        })}
      </div>
    </form>
  );
}
