import type { ReactNode } from "react";
import { CourtLinesBand } from "./court-lines";

/** Navy band at the top of public pages, after the Join prototype's hero. */
export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-navy px-5 pt-5 pb-6">
      <CourtLinesBand />
      <div className="relative mx-auto max-w-5xl">
        {eyebrow ? (
          <div className="text-[12px] font-bold tracking-[0.1em] text-ball uppercase">{eyebrow}</div>
        ) : null}
        <h1 className="mt-1.5 mb-2 font-display text-[38px] leading-none font-bold text-white uppercase">
          {title}
        </h1>
        {children ? <p className="text-[15px] leading-normal text-slate-300">{children}</p> : null}
      </div>
    </section>
  );
}
