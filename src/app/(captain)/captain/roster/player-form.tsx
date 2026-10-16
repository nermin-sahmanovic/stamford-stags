"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError, inputClass } from "@/components/ui";
import { idleState, type FormState } from "@/lib/form-state";
import { POSITIONS, RATING_OPTIONS, ROLE_LABELS, ROLES } from "@/lib/roster/schema";

export type PlayerFormValues = {
  full_name: string;
  email: string;
  phone: string;
  usta_number: string;
  ntrp_rating: string;
  position_pref: string;
  role: string;
};

const positionLabels = { singles: "Singles", doubles: "Doubles", both: "Both" } as const;

export function PlayerForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: PlayerFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  const errors = state.status === "error" ? state.fieldErrors : {};
  const echoed = state.status === "error" ? state.values : {};
  const value = (name: keyof PlayerFormValues) =>
    typeof echoed[name] === "string" ? (echoed[name] as string) : initial[name];
  const field = (name: keyof PlayerFormValues) => ({
    name,
    defaultValue: value(name),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  // Ratings already on file (e.g. 3.7 from an import) stay selectable.
  const ratings = RATING_OPTIONS.includes(initial.ntrp_rating as (typeof RATING_OPTIONS)[number]) || !initial.ntrp_rating
    ? RATING_OPTIONS
    : [initial.ntrp_rating, ...RATING_OPTIONS];

  return (
    <form
      action={formAction}
      noValidate
      // Remount after an error so the echoed values show in the uncontrolled inputs.
      key={state.status === "error" ? JSON.stringify(echoed) : "initial"}
      className="flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-4"
    >
      {state.status === "error" ? (
        <p role="alert" className="rounded-[10px] bg-warn-bg px-3 py-2 text-[14px] font-semibold text-warn">
          {state.message}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Full name
        <input type="text" autoComplete="off" className={inputClass} {...field("full_name")} />
        <FieldError id="full_name-error" message={errors.full_name} />
      </label>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Email
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="off"
          className={inputClass}
          {...field("email")}
        />
        <FieldError id="email-error" message={errors.email} />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex min-w-0 flex-col gap-1.5 text-[14px] font-semibold">
          Phone
          <input type="tel" autoComplete="off" className={`${inputClass} px-3`} {...field("phone")} />
          <FieldError id="phone-error" message={errors.phone} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-[14px] font-semibold">
          USTA number
          <input type="text" inputMode="numeric" className={`${inputClass} px-3`} {...field("usta_number")} />
          <FieldError id="usta_number-error" message={errors.usta_number} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex min-w-0 flex-col gap-1.5 text-[14px] font-semibold">
          NTRP rating
          <select className={`${inputClass} px-3`} {...field("ntrp_rating")}>
            <option value="">Not set</option>
            {ratings.map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
          <FieldError id="ntrp_rating-error" message={errors.ntrp_rating} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-[14px] font-semibold">
          Role
          <select className={`${inputClass} px-3`} {...field("role")}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <FieldError id="role-error" message={errors.role} />
        </label>
      </div>

      <fieldset className="flex flex-col">
        <legend className="mb-1.5 text-[14px] font-semibold">Preferred position</legend>
        <div className="grid grid-cols-3 gap-1.5 rounded-[12px] bg-slate-100 p-1">
          {POSITIONS.map((position) => (
            <label key={position} className="relative">
              <input
                type="radio"
                name="position_pref"
                value={position}
                defaultChecked={value("position_pref") === position}
                className="peer sr-only"
              />
              <span className="flex h-11 cursor-pointer items-center justify-center rounded-[9px] text-[15px] font-semibold text-slate-700 peer-checked:bg-navy peer-checked:font-bold peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-court">
                {positionLabels[position]}
              </span>
            </label>
          ))}
        </div>
        <FieldError id="position_pref-error" message={errors.position_pref} />
      </fieldset>

      <div className="flex gap-2.5">
        <Link
          href="/captain/roster"
          className="flex h-12 flex-1 items-center justify-center rounded-[12px] border-[1.5px] border-slate-300 text-[16px] font-semibold text-navy no-underline hover:bg-slate-50"
        >
          Cancel
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
