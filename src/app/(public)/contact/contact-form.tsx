"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckIcon, MailIcon } from "@/components/shell/icons";
import { Turnstile } from "@/components/turnstile";
import { FieldError, fieldClass, HoneypotField, inputClass } from "@/components/ui";
import { idleState } from "@/lib/form-state";
import { sendContactMessage } from "./actions";
import { CONTACT_TOPICS } from "./topics";

export function ContactForm({ siteKey }: { siteKey: string }) {
  const [state, formAction, pending] = useActionState(sendContactMessage, idleState);

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col items-start gap-2.5 rounded-2xl bg-navy px-5 py-6 text-white">
        <div className="flex size-12 items-center justify-center rounded-full bg-ball text-navy">
          <CheckIcon size={24} />
        </div>
        <h2 className="font-display text-[28px] font-bold uppercase">Message sent</h2>
        <p className="text-[15px] leading-normal text-slate-300">
          Thanks. The captain will reply to the email address you gave.
        </p>
        <Link
          href="/"
          className="mt-1.5 flex h-11 items-center rounded-[10px] border-[1.5px] border-edge px-4 text-[14px] font-semibold text-white no-underline hover:bg-navy-2 hover:text-white"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : {};
  const text = (name: string) => (typeof values[name] === "string" ? (values[name] as string) : "");
  const invalid = (name: string) => (errors[name] ? true : undefined);
  const describedBy = (name: string) => (errors[name] ? `${name}-error` : undefined);

  return (
    <form
      action={formAction}
      noValidate
      className="relative flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-4"
    >
      {state.status === "error" ? (
        <p role="alert" className="rounded-[10px] bg-warn-bg px-3 py-2 text-[14px] font-semibold text-warn">
          {state.message}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Your name
        <input
          name="name"
          type="text"
          autoComplete="name"
          defaultValue={text("name")}
          aria-invalid={invalid("name")}
          aria-describedby={describedBy("name")}
          className={inputClass}
        />
        <FieldError id="name-error" message={errors.name} />
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

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Topic
        <select
          name="topic"
          defaultValue={text("topic")}
          aria-invalid={invalid("topic")}
          aria-describedby={describedBy("topic")}
          className={`${inputClass} px-3`}
        >
          <option value="">Choose a topic</option>
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic.value} value={topic.value}>
              {topic.label}
            </option>
          ))}
        </select>
        <FieldError id="topic-error" message={errors.topic} />
      </label>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Message
        <textarea
          name="message"
          rows={5}
          defaultValue={text("message")}
          aria-invalid={invalid("message")}
          aria-describedby={describedBy("message")}
          className={`${fieldClass} resize-y py-3`}
        />
        <FieldError id="message-error" message={errors.message} />
      </label>

      <HoneypotField />
      <Turnstile siteKey={siteKey} resetKey={state} />

      <button
        type="submit"
        disabled={pending || !siteKey}
        className="flex h-[52px] items-center justify-center gap-2 rounded-[12px] bg-court text-base font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-60"
      >
        <MailIcon size={18} />
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
