"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/matches/schemas";
import { deleteMatch, unpublishLineup } from "../actions";

const outlineButton =
  "h-11 rounded-[10px] border-[1.5px] px-4 text-[14px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-60";

export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>, onSuccess?: () => void) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) onSuccess?.();
        else setError(result.message);
      } catch {
        setError("Couldn't save. Check your connection and try again.");
      }
    });
  };
  return { error, pending, run };
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="mt-2 text-[13px] font-semibold text-warn">
      {error}
    </p>
  ) : null;
}

/** Lineup status on the match page. Publishing happens in the builder (it resets RSVPs and notifies). */
export function LineupPublish({
  matchId,
  published,
  slotCount,
  declined,
  editable,
}: {
  matchId: string;
  published: boolean;
  slotCount: number;
  declined: number;
  editable: boolean;
}) {
  const { error, pending, run } = useAction();
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[15px]">
        {published ? (
          <>
            <span className="font-bold text-blue-700">Published.</span> Players can see the lineup.
          </>
        ) : (
          <>
            <span className="font-bold text-warn">Not published.</span> Only captains can see the lineup.
          </>
        )}
      </p>
      <p className="mt-1 text-[13px] text-slate-600">
        {slotCount === 0 ? "No players are in the lineup yet." : `${slotCount} players in the lineup.`}
        {declined > 0 ? <span className="font-semibold text-warn"> {declined} declined.</span> : null}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {editable ? (
          <Link
            href={`/captain/matches/${matchId}/lineup`}
            className={`${outlineButton} flex items-center border-navy bg-navy text-white no-underline hover:bg-navy-2 hover:text-white`}
          >
            {slotCount === 0 ? "Build lineup" : "Edit lineup"}
          </Link>
        ) : null}
        {published ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => unpublishLineup(matchId))}
            className={`${outlineButton} border-slate-300 text-navy hover:bg-slate-50`}
          >
            {pending ? "Saving…" : "Unpublish lineup"}
          </button>
        ) : null}
      </div>
      <ErrorText error={error} />
    </div>
  );
}

export function DeleteMatch({ matchId, opponent }: { matchId: string; opponent: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const { error, pending, run } = useAction();
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[15px] text-slate-700">
        Deleting removes the match with its availability, lineup, checklist and results. This can&apos;t be undone.
      </p>
      {confirming ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteMatch(matchId), () => router.push("/captain/matches"))}
            className={`${outlineButton} border-warn bg-warn text-white hover:bg-orange-800`}
          >
            {pending ? "Deleting…" : `Yes, delete the ${opponent} match`}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={`${outlineButton} border-slate-300 text-navy hover:bg-slate-50`}
          >
            Keep it
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`${outlineButton} mt-3 border-warn text-warn hover:bg-warn-bg`}
        >
          Delete match
        </button>
      )}
      <ErrorText error={error} />
    </div>
  );
}
