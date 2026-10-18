import type { ReactNode } from "react";
import { CourtLinesBand } from "./court-lines";

/** Navy hero with court lines for the 404 and error pages: a big code, a title and next steps. */
export function StatusPage({
  code,
  title,
  children,
  actions,
}: {
  code: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-navy px-5 pt-8 pb-10">
      <CourtLinesBand />
      <div className="relative mx-auto max-w-5xl">
        <p className="font-display text-[72px] leading-none font-bold text-ball" aria-hidden="true">
          {code}
        </p>
        <h1 className="mt-2 font-display text-[38px] leading-none font-bold text-white uppercase">{title}</h1>
        <p className="mt-3 max-w-md text-[16px] leading-normal text-slate-300">{children}</p>
        <div className="mt-6 flex flex-wrap gap-2.5">{actions}</div>
      </div>
    </section>
  );
}

export const statusPrimary =
  "flex h-12 items-center justify-center rounded-[12px] bg-ball px-5 text-[16px] font-bold text-navy no-underline hover:bg-lime-300";
export const statusSecondary =
  "flex h-12 items-center justify-center rounded-[12px] border-[1.5px] border-edge px-5 text-[15px] font-semibold text-white no-underline hover:bg-navy-2 hover:text-white";
