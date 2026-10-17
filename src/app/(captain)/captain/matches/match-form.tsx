"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError, fieldClass, inputClass } from "@/components/ui";
import { idleState, type FormState } from "@/lib/form-state";
import { HOME_AWAY, MATCH_STATUSES, STATUS_LABELS } from "@/lib/matches/schemas";

export type MatchFormValues = {
  opponent: string;
  starts_at: string;
  home_away: string;
  location_name: string;
  location_address: string;
  captain_notes: string;
  status: string;
};

const segmented =
  "flex h-11 cursor-pointer items-center justify-center rounded-[9px] text-[15px] font-semibold text-slate-700 peer-checked:bg-navy peer-checked:font-bold peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-court";

export function MatchForm({
  action,
  initial,
  submitLabel,
  showStatus,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: MatchFormValues;
  submitLabel: string;
  /** New matches are always scheduled; editing can cancel or complete one. */
  showStatus: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  const errors = state.status === "error" ? state.fieldErrors : {};
  const echoed = state.status === "error" ? state.values : {};
  const value = (name: keyof MatchFormValues) =>
    typeof echoed[name] === "string" ? (echoed[name] as string) : initial[name];
  const field = (name: keyof MatchFormValues) => ({
    id: name,
    name,
    defaultValue: value(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form
      action={formAction}
      noValidate
      key={state.status === "error" ? JSON.stringify(echoed) : "initial"}
      className="flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-4"
    >
      {state.status === "error" ? (
        <p role="alert" className="rounded-[10px] bg-warn-bg px-3 py-2 text-[14px] font-semibold text-warn">
          {state.message}
        </p>
      ) : state.status === "success" ? (
        <p role="status" className="rounded-[10px] bg-blue-50 px-3 py-2 text-[14px] font-semibold text-blue-800">
          Match saved.
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Opponent
        <input type="text" autoComplete="off" className={inputClass} {...field("opponent")} />
        <FieldError id="opponent-error" message={errors.opponent} />
      </label>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Date and start time (Eastern)
        <input type="datetime-local" className={`${inputClass} px-3`} {...field("starts_at")} />
        <FieldError id="starts_at-error" message={errors.starts_at} />
      </label>

      <fieldset className="flex flex-col">
        <legend className="mb-1.5 text-[14px] font-semibold">Home or away</legend>
        <div className="grid grid-cols-2 gap-1.5 rounded-[12px] bg-slate-100 p-1">
          {HOME_AWAY.map((side) => (
            <label key={side} className="relative">
              <input
                type="radio"
                name="home_away"
                value={side}
                defaultChecked={value("home_away") === side}
                className="peer sr-only"
              />
              <span className={segmented}>{side === "home" ? "Home" : "Away"}</span>
            </label>
          ))}
        </div>
        <FieldError id="home_away-error" message={errors.home_away} />
      </fieldset>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Venue
        <input type="text" placeholder="Stamford Tennis Center" className={inputClass} {...field("location_name")} />
        <FieldError id="location_name-error" message={errors.location_name} />
      </label>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Address
        <input
          type="text"
          placeholder="Street, Town, CT 06901"
          autoComplete="off"
          className={inputClass}
          {...field("location_address")}
        />
        <span className="text-[13px] font-normal text-slate-600">
          Include the town or ZIP so the forecast uses the right place.
        </span>
        <FieldError id="location_address-error" message={errors.location_address} />
      </label>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Captain notes
        <textarea rows={3} className={`${fieldClass} py-2.5`} {...field("captain_notes")} />
        <FieldError id="captain_notes-error" message={errors.captain_notes} />
      </label>

      {showStatus ? (
        <fieldset className="flex flex-col">
          <legend className="mb-1.5 text-[14px] font-semibold">Status</legend>
          <div className="grid grid-cols-3 gap-1.5 rounded-[12px] bg-slate-100 p-1">
            {MATCH_STATUSES.map((status) => (
              <label key={status} className="relative">
                <input
                  type="radio"
                  name="status"
                  value={status}
                  defaultChecked={value("status") === status}
                  className="peer sr-only"
                />
                <span className={segmented}>{STATUS_LABELS[status]}</span>
              </label>
            ))}
          </div>
          <FieldError id="status-error" message={errors.status} />
        </fieldset>
      ) : (
        <input type="hidden" name="status" value="scheduled" />
      )}

      <div className="flex gap-2.5">
        <Link
          href="/captain/matches"
          className="flex h-12 flex-1 items-center justify-center rounded-[12px] border-[1.5px] border-slate-300 text-[16px] font-semibold text-navy no-underline hover:bg-slate-50"
        >
          {showStatus ? "Back" : "Cancel"}
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="h-12 flex-[2] rounded-[12px] bg-navy text-[16px] font-bold text-white hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
