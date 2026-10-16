import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { PinIcon } from "@/components/shell/icons";
import { SectionHeading } from "@/components/ui";
import { culture, expectations, league, locations, mission } from "./content";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About the team" title="Who we are">
        {mission}
      </PageHero>
      <div className="mx-auto grid max-w-5xl gap-2.5 px-4 pt-5 pb-6 md:grid-cols-2">
        <PointsCard title={league.title} points={league.points} />
        <section className="rounded-2xl border border-line bg-white p-4">
          <SectionHeading>Where we play</SectionHeading>
          <ul className="mt-3 flex flex-col gap-3">
            {locations.map((place) => (
              <li key={place.name} className="flex gap-3">
                <span className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-full bg-navy text-ball">
                  <PinIcon size={16} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{place.name}</span>
                  <span className="block text-[14px] text-slate-600">{place.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <PointsCard title={culture.title} points={culture.points} />
        <PointsCard title={expectations.title} points={expectations.points} />
        <div className="flex flex-col gap-2.5 rounded-2xl bg-navy p-4 md:col-span-2 md:flex-row md:items-center md:justify-between">
          <p className="text-[15px] text-slate-300">
            Sound like your kind of team? Applications go straight to the captain.
          </p>
          <Link
            href="/join"
            className="flex h-12 items-center justify-center rounded-[12px] bg-ball px-5 text-[15px] font-bold text-navy no-underline hover:bg-lime-300"
          >
            Join the Team
          </Link>
        </div>
      </div>
    </>
  );
}

function PointsCard({ title, points }: { title: string; points: string[] }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <SectionHeading>{title}</SectionHeading>
      <ul className="mt-3 flex flex-col gap-2">
        {points.map((point) => (
          <li key={point} className="flex gap-2.5 text-[15px] leading-normal text-slate-700">
            <span aria-hidden="true" className="mt-2 size-1.5 flex-none rounded-full bg-court" />
            {point}
          </li>
        ))}
      </ul>
    </section>
  );
}
