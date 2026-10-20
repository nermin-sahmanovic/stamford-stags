"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError, fieldClass, inputClass } from "@/components/ui";
import { EVENT_TYPE_LABELS, EVENT_TYPES } from "@/lib/calendar/items";
import { idleState, type FormState } from "@/lib/form-state";

export type EventFormValues = {
  type: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string;
  description: string;
  is_public: boolean;
};

const chip =
  "flex h-11 cursor-pointer items-center justify-center rounded-[9px] px-2 text-center text-[14px] leading-tight font-semibold text-slate-700 peer-checked:bg-navy peer-checked:font-bold peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-court";

export function EventForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: EventFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);

  const errors = state.status === "error" ? state.fieldErrors : {};
  const echoed = state.status === "error" ? state.values : null;
  const value = (name: Exclude<keyof EventFormValues, "is_public">) =>
    echoed && typeof echoed[name] === "string" ? (echoed[name] as string) : initial[name];
  const isPublic = echoed ? echoed.is_public === "on" : initial.is_public;
  const field = (name: Exclude<keyof EventFormValues, "is_public">) => ({
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
      key={echoed ? JSON.stringify(echoed) : "initial"}
      className="flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-4"
    >
      {state.status === "error" ? (
        <p role="alert" className="rounded-[10px] bg-warn-bg px-3 py-2 text-[14px] font-semibold text-warn">
          {state.message}
        </p>
      ) : state.status === "success" ? (
        <p role="status" className="rounded-[10px] bg-blue-50 px-3 py-2 text-[14px] font-semibold text-blue-800">
          Event saved.
        </p>
      ) : null}

      <fieldset className="flex flex-col">
        <legend className="mb-1.5 text-[14px] font-semibold">Type</legend>
        <div className="grid grid-cols-3 gap-1.5 rounded-[12px] bg-slate-100 p-1">
          {EVENT_TYPES.map((type) => (
            <label key={type} className="relative">
              <input type="radio" name="type" value={type} defaultChecked={value("type") === type} className="peer sr-only" />
              <span className={chip}>{EVENT_TYPE_LABELS[type]}</span>
            </label>
          ))}
        </div>
        <FieldError id="type-error" message={errors.type} />
      </fieldset>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Title
        <input type="text" autoComplete="off" placeholder="Team practice" className={inputClass} {...field("title")} />
        <FieldError id="title-error" message={errors.title} />
      </label>

      <div className="grid gap-3.5 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
          Starts (Eastern)
          <input type="datetime-local" className={`${inputClass} px-3`} {...field("starts_at")} />
          <FieldError id="starts_at-error" message={errors.starts_at} />
        </label>
        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
          Ends (optional)
          <input type="datetime-local" className={`${inputClass} px-3`} {...field("ends_at")} />
          <FieldError id="ends_at-error" message={errors.ends_at} />
        </label>
      </div>
      <p className="-mt-2 text-[13px] text-slate-600">
        Deadlines and registration dates without an end show as all-day in calendar apps.
      </p>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Location
        <input type="text" placeholder="Solaris Racquet Club" className={inputClass} {...field("location")} />
        <FieldError id="location-error" message={errors.location} />
      </label>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Details
        <textarea rows={3} className={`${fieldClass} py-2.5`} {...field("description")} />
        <FieldError id="description-error" message={errors.description} />
      </label>

      <label className="flex min-h-11 items-start gap-3 text-[15px]">
        <input type="checkbox" name="is_public" defaultChecked={isPublic} className="mt-0.5 size-5 accent-navy" />
        <span>
          <span className="block font-semibold">Show on the public schedule</span>
          <span className="block text-[13px] text-slate-600">
            Off: only signed-in players see it (and their personal calendar feed).
          </span>
        </span>
      </label>

      <div className="flex gap-2.5">
        <Link
          href="/captain/events"
          className="flex h-12 flex-1 items-center justify-center rounded-[12px] border-[1.5px] border-slate-300 text-[16px] font-semibold text-navy no-underline hover:bg-slate-50"
        >
          Back
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
