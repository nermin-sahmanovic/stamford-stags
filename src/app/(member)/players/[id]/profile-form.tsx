"use client";

import { useActionState } from "react";
import { CheckIcon } from "@/components/shell/icons";
import { FieldError, inputClass } from "@/components/ui";
import { idleState } from "@/lib/form-state";
import { POSITION_OPTIONS } from "@/app/(public)/join/options";
import { updateMyProfile } from "../actions";

export function ProfileForm({ phone, position }: { phone: string; position: string }) {
  const [state, formAction, pending] = useActionState(updateMyProfile, idleState);

  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : {};
  const phoneValue = typeof values.phone === "string" ? values.phone : phone;
  const positionValue = typeof values.position_pref === "string" ? values.position_pref : position;

  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-white p-4"
    >
      <h2 className="font-display text-[22px] font-bold tracking-[0.03em] uppercase">Edit my details</h2>

      {state.status === "error" ? (
        <p role="alert" className="rounded-[10px] bg-warn-bg px-3 py-2 text-[14px] font-semibold text-warn">
          {state.message}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Phone
        <input
          key={phoneValue}
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="(203) 555-0100"
          defaultValue={phoneValue}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? "phone-error" : undefined}
          className={inputClass}
        />
        <FieldError id="phone-error" message={errors.phone} />
      </label>

      <fieldset className="flex flex-col">
        <legend className="mb-1.5 text-[14px] font-semibold">Preferred position</legend>
        <div className="grid grid-cols-3 gap-1.5 rounded-[12px] bg-slate-100 p-1">
          {POSITION_OPTIONS.map((option) => (
            <label key={option.value} className="relative">
              <input
                key={positionValue}
                type="radio"
                name="position_pref"
                value={option.value}
                defaultChecked={positionValue === option.value}
                className="peer sr-only"
              />
              <span className="flex h-11 cursor-pointer items-center justify-center rounded-[9px] text-[15px] font-semibold text-slate-700 peer-checked:bg-navy peer-checked:font-bold peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-court">
                {option.label}
              </span>
            </label>
          ))}
        </div>
        <FieldError id="position_pref-error" message={errors.position_pref} />
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-12 flex-1 rounded-[12px] bg-navy text-[16px] font-bold text-white hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.status === "success" && !pending ? (
          <span role="status" className="flex items-center gap-1 text-[14px] font-bold text-blue-700">
            <CheckIcon size={16} /> Saved
          </span>
        ) : null}
      </div>
      <p className="text-[13px] text-slate-600">
        Your name, email and rating are managed by the captain.
      </p>
    </form>
  );
}
