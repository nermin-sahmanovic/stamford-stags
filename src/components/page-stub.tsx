import type { ReactNode } from "react";

/** Placeholder body for routes that are built in a later phase. */
export function PageStub({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
        {title}
      </h1>
      <p className="mt-0.5 text-[15px] text-slate-600">{children ?? "Coming soon."}</p>
    </section>
  );
}
