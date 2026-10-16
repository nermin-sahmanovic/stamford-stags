import type { ReactNode } from "react";

// Small shared pieces from design-reference. Cards: 1px line border, 14-16px radius, no shadow.

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-[14px] border border-line bg-white p-3.5 ${className}`}>{children}</div>
  );
}

export function SectionHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="font-display text-[24px] leading-tight font-bold tracking-[0.03em] uppercase"
    >
      {children}
    </h2>
  );
}

const pillTones = {
  navy: "bg-navy text-ball",
  ball: "bg-ball text-navy",
  blue: "bg-blue-100 text-blue-800",
  warn: "bg-warn-bg text-orange-800",
  slate: "bg-slate-100 text-slate-700",
} as const;

export type PillTone = keyof typeof pillTones;

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex self-start rounded-md px-2 py-[3px] text-[11px] leading-[normal] font-bold tracking-[0.08em] uppercase ${pillTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  note,
  noteClassName = "text-slate-600",
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  noteClassName?: string;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-3.5">
      <div className="text-[12px] font-semibold tracking-[0.06em] text-slate-500 uppercase">
        {label}
      </div>
      <div className="mt-0.5 font-display text-[36px] leading-[1.05] font-bold">{value}</div>
      <div className={`text-[13px] ${noteClassName}`}>{note}</div>
    </div>
  );
}

/** Inputs, selects and textareas: 16px text so iOS doesn't zoom. */
export const fieldClass =
  "w-full min-w-0 rounded-[10px] border border-slate-300 bg-white px-3.5 text-base text-navy placeholder:text-slate-400 focus:border-court focus:outline-2 focus:outline-offset-0 focus:outline-court/30 aria-[invalid=true]:border-warn";

export const inputClass = `${fieldClass} h-12`;

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[13px] font-semibold text-warn">
      {message}
    </p>
  );
}

/** Visually hidden trap field. People never see or fill it; naive bots do. */
export function HoneypotField() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-[14px] bg-line motion-reduce:animate-none ${className}`} />
  );
}
