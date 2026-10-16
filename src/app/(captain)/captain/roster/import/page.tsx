import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { getRoster } from "@/lib/roster/queries";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import roster" };

export default function ImportRosterPage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-3 px-4 pt-4 pb-6">
      <div>
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
          Import roster
        </h1>
        <p className="mt-0.5 text-[15px] text-slate-600">
          Upload a CSV. Players are matched by email: new emails are added, existing players are
          updated, and blank cells keep what&apos;s on file. Roles are never changed by an import.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[200px]" />}>
        <Wizard />
      </Suspense>
      <Link href="/captain/roster" className="self-start py-2.5 text-[15px] font-semibold text-court">
        ← Back to roster
      </Link>
    </section>
  );
}

async function Wizard() {
  const { players, maxRoster } = await getRoster();
  return (
    <ImportWizard
      existing={players.map((p) => ({ email: p.email.toLowerCase(), active: p.is_active }))}
      maxRoster={maxRoster}
    />
  );
}
