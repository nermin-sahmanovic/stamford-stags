"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRightIcon, CheckIcon } from "@/components/shell/icons";
import { Turnstile } from "@/components/turnstile";
import { FieldError, fieldClass, HoneypotField, inputClass } from "@/components/ui";
import { idleState } from "@/lib/form-state";
import { submitRegistration } from "./actions";
import { AVAILABILITY_SLOTS, NTRP_OPTIONS, POSITION_OPTIONS } from "./options";

export function JoinForm({ siteKey }: { siteKey: string }) {
  const [state, formAction, pending] = useActionState(submitRegistration, idleState);

  if (state.status === "success") return <ApplicationSent />;

  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : {};
  const text = (name: string) => (typeof values[name] === "string" ? (values[name] as string) : "");
  const slots = Array.isArray(values.availability_slots) ? values.availability_slots : [];
  const position = text("position_pref") || "both";
  const invalid = (name: string) => (errors[name] ? true : undefined);
  const describedBy = (name: string) => (errors[name] ? `${name}-error` : undefined);

  return (
    <section aria-labelledby="registration-heading" className="px-4 pt-4 pb-7">
      <form
        action={formAction}
        noValidate
        className="relative flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-4"
      >
        <h2
          id="registration-heading"
          className="font-display text-[24px] font-bold tracking-[0.03em] uppercase"
        >
          Player registration
        </h2>

        {state.status === "error" ? (
          <p role="alert" className="rounded-[10px] bg-warn-bg px-3 py-2 text-[14px] font-semibold text-warn">
            {state.message}
          </p>
        ) : null}

        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
          Full name
          <input
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder="First and last name"
            defaultValue={text("full_name")}
            aria-invalid={invalid("full_name")}
            aria-describedby={describedBy("full_name")}
            className={inputClass}
          />
          <FieldError id="full_name-error" message={errors.full_name} />
        </label>

        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
          Email
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            defaultValue={text("email")}
            aria-invalid={invalid("email")}
            aria-describedby={describedBy("email")}
            className={inputClass}
          />
          <FieldError id="email-error" message={errors.email} />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex min-w-0 flex-col gap-1.5 text-[14px] font-semibold">
            Phone
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(203) 555-0100"
              defaultValue={text("phone")}
              aria-invalid={invalid("phone")}
              aria-describedby={describedBy("phone")}
              className={`${inputClass} px-3`}
            />
            <FieldError id="phone-error" message={errors.phone} />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-[14px] font-semibold">
            USTA number
            <input
              name="usta_number"
              type="text"
              inputMode="numeric"
              placeholder="10-digit #"
              defaultValue={text("usta_number")}
              aria-invalid={invalid("usta_number")}
              aria-describedby={describedBy("usta_number")}
              className={`${inputClass} px-3`}
            />
            <FieldError id="usta_number-error" message={errors.usta_number} />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
          NTRP rating
          <select
            name="ntrp_rating"
            defaultValue={text("ntrp_rating")}
            aria-invalid={invalid("ntrp_rating")}
            aria-describedby={describedBy("ntrp_rating")}
            className={`${inputClass} px-3`}
          >
            <option value="">Select your rating</option>
            {NTRP_OPTIONS.map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
          <FieldError id="ntrp_rating-error" message={errors.ntrp_rating} />
        </label>

        <fieldset className="flex flex-col">
          <legend className="mb-1.5 text-[14px] font-semibold">Preferred position</legend>
          <div className="grid grid-cols-3 gap-1.5 rounded-[12px] bg-slate-100 p-1">
            {POSITION_OPTIONS.map((option) => (
              <label key={option.value} className="relative">
                <input
                  type="radio"
                  name="position_pref"
                  value={option.value}
                  defaultChecked={position === option.value}
                  className="peer sr-only"
                />
                <span className="flex h-11 cursor-pointer items-center justify-center rounded-[9px] text-[15px] font-semibold text-slate-700 peer-checked:bg-navy peer-checked:font-bold peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-court">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[14px] font-semibold">When can you play?</legend>
          <div className="flex flex-wrap gap-2">
            {AVAILABILITY_SLOTS.map((slot) => (
              <label key={slot} className="relative">
                <input
                  type="checkbox"
                  name="availability_slots"
                  value={slot}
                  defaultChecked={slots.includes(slot)}
                  className="peer sr-only"
                />
                <span className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-slate-300 bg-white px-3.5 text-[14px] font-semibold text-slate-700 peer-checked:border-navy peer-checked:bg-ball peer-checked:font-bold peer-checked:text-navy peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-court peer-checked:[&>svg]:block">
                  <CheckIcon size={14} className="hidden" />
                  {slot}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
          <span>
            Notes{" "}
            <span className="text-[13px] font-normal text-slate-600">Anything the captain should know</span>
          </span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Playing history, travel limits, injuries…"
            defaultValue={text("notes")}
            aria-invalid={invalid("notes")}
            aria-describedby={describedBy("notes")}
            className={`${fieldClass} resize-y py-3`}
          />
          <FieldError id="notes-error" message={errors.notes} />
        </label>

        <HoneypotField />
        <Turnstile siteKey={siteKey} resetKey={state} />

        <button
          type="submit"
          disabled={pending || !siteKey}
          className="flex h-[54px] items-center justify-center gap-2 rounded-[12px] bg-ball text-[17px] font-bold text-navy shadow-[inset_0_0_0_1.5px_#0F172A] hover:bg-lime-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-60"
        >
          {pending ? "Sending…" : "Apply to Join"}
          <ArrowRightIcon size={18} />
        </button>
        <p className="text-center text-[12px] text-slate-600">
          Your details are only visible to the team captain.
        </p>
      </form>
    </section>
  );
}

function ApplicationSent() {
  return (
    <section className="px-4 pt-4 pb-7">
      <div role="status" className="flex flex-col items-start gap-2.5 rounded-2xl bg-navy px-5 py-6 text-white">
        <div className="flex size-12 items-center justify-center rounded-full bg-ball text-navy">
          <CheckIcon size={24} />
        </div>
        <h2 className="font-display text-[28px] font-bold uppercase">Application sent</h2>
        <p className="text-[15px] leading-normal text-slate-300">
          The captain will verify your USTA membership and invite you to the next practice session.
        </p>
        <Link
          href="/"
          className="mt-1.5 flex h-11 items-center rounded-[10px] border-[1.5px] border-edge px-4 text-[14px] font-semibold text-white no-underline hover:bg-navy-2 hover:text-white"
        >
          Back to home
        </Link>
        <p className="text-[13px] text-slate-300">
          Made a mistake?{" "}
          <Link href="/contact" className="font-semibold text-ball underline underline-offset-2">
            Message the captain
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
