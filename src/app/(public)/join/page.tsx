import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/page-hero";
import { getTeamSummary } from "@/lib/public-data";
import { getTurnstileSiteKey } from "@/lib/spam";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join the Team" };

const steps = [
  { label: "Verify your USTA membership", byCaptain: false },
  { label: "Submit your player information", byCaptain: false },
  { label: "Provide your NTRP rating", byCaptain: false },
  { label: "Tell us when you can play", byCaptain: false },
  { label: "Attend a practice session", byCaptain: true },
  { label: "Receive your team invitation", byCaptain: true },
];

export default function JoinPage() {
  return (
    <>
      <PageHero
        eyebrow={
          <Suspense fallback="Now recruiting">
            <OpenSpots />
          </Suspense>
        }
        title="How to join"
      >
        Six steps from application to team invite. Most players are on court within two weeks.
      </PageHero>

      <div className="mx-auto max-w-5xl md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
        <section aria-label="Steps" className="px-4 pt-[18px] pb-1">
          <ol className="rounded-2xl border border-line bg-white px-3.5 py-1.5">
            {steps.map((step, i) => (
              <li
                key={step.label}
                className="flex min-h-12 items-center gap-3 border-b border-slate-100 last:border-b-0"
              >
                <span
                  className={`flex size-7 flex-none items-center justify-center rounded-full text-[13px] font-bold ${
                    step.byCaptain ? "border-[1.5px] border-muted text-slate-600" : "bg-navy text-ball"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`text-[15px] font-semibold ${step.byCaptain ? "text-slate-600" : ""}`}>
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
          <p className="mx-1 mt-2 text-[13px] text-slate-600">
            Steps 1–4 happen in the form below. The captain handles 5 and 6.
          </p>
        </section>

        <JoinForm siteKey={getTurnstileSiteKey()} />
      </div>
    </>
  );
}

async function OpenSpots() {
  const { open_spots: open } = await getTeamSummary();
  if (open <= 0) return <>Roster is full</>;
  return <>{open === 1 ? "1 roster spot open" : `${open} roster spots open`}</>;
}
