"use client";

import { useActionState } from "react";
import { idleState } from "@/lib/form-state";
import { setPlayerActive } from "../../actions";

/** Deactivate (or bring back) a player. Nobody is ever hard-deleted. */
export function ActiveToggle({ id, active, isMe }: { id: string; active: boolean; isMe: boolean }) {
  const [state, formAction, pending] = useActionState(setPlayerActive.bind(null, id, !active), idleState);

  if (isMe) {
    return (
      <p className="text-[13px] text-slate-600">
        You can&apos;t deactivate yourself. Another captain can.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-[14px] border border-line bg-white p-4">
      <h2 className="text-[15px] font-bold">{active ? "Deactivate player" : "Reactivate player"}</h2>
      <p className="text-[14px] text-slate-600">
        {active
          ? "They leave the directory and lose access to member pages. Their match history is kept."
          : "They return to the directory and can sign in again."}
      </p>
      {state.status === "error" ? (
        <p role="alert" className="text-[14px] font-semibold text-warn">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={`h-11 rounded-[10px] text-[15px] font-bold disabled:opacity-60 ${
          active
            ? "border-[1.5px] border-warn text-warn hover:bg-warn-bg"
            : "bg-navy text-white hover:bg-navy-2"
        }`}
      >
        {pending ? "Saving…" : active ? "Deactivate" : "Reactivate"}
      </button>
    </form>
  );
}
