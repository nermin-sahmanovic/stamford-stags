import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { getDirectory } from "@/lib/roster/queries";
import { PlayersDirectory } from "./players-directory";

export const metadata: Metadata = { title: "Players" };

export default function PlayersPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
        Players
      </h1>
      <Suspense fallback={<DirectorySkeleton />}>
        <Directory />
      </Suspense>
    </section>
  );
}

async function Directory() {
  const { players, nextMatch } = await getDirectory();
  return (
    <>
      <p className="mt-0.5 mb-4 text-[15px] text-slate-600">
        {players.length} on the active roster. Tap a player for contact details.
      </p>
      <PlayersDirectory players={players} nextMatch={nextMatch} />
    </>
  );
}

function DirectorySkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      <Skeleton className="h-12" />
      <Skeleton className="h-24" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}
