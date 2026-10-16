import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DownloadIcon, PlusIcon, UploadIcon } from "@/components/shell/icons";
import { Pill, Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { getRoster } from "@/lib/roster/queries";
import { RosterTable } from "./roster-table";

export const metadata: Metadata = { title: "Roster" };

const actionClass =
  "flex h-11 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[14px] font-bold no-underline";

export default function RosterAdminPage() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
        Roster
      </h1>

      <div className="grid grid-cols-3 gap-2">
        <Link href="/captain/roster/new" className={`${actionClass} bg-navy text-white hover:bg-navy-2 hover:text-white`}>
          <PlusIcon size={18} /> Add
        </Link>
        <Link
          href="/captain/roster/import"
          className={`${actionClass} border-[1.5px] border-court text-court hover:bg-blue-50`}
        >
          <UploadIcon size={18} /> Import
        </Link>
        {/* A plain link: the route handler returns a CSV attachment. */}
        <a
          href="/api/roster/export"
          download
          className={`${actionClass} border-[1.5px] border-court text-court hover:bg-blue-50`}
        >
          <DownloadIcon size={18} /> Export
        </a>
      </div>

      <Suspense fallback={<RosterSkeleton />}>
        <Roster />
      </Suspense>
    </section>
  );
}

async function Roster() {
  const [me, { players, maxRoster }] = await Promise.all([requireCaptain(), getRoster()]);
  const activeCount = players.filter((p) => p.is_active).length;
  const over = maxRoster !== null && activeCount > maxRoster;

  return (
    <>
      <p className="flex items-center gap-2 text-[15px] text-slate-600">
        {activeCount} active
        {maxRoster !== null ? (
          <Pill tone={over ? "warn" : "slate"}>
            {over ? `${activeCount - maxRoster} over max ${maxRoster}` : `of ${maxRoster} max`}
          </Pill>
        ) : null}
      </p>
      <RosterTable players={players} myId={me.id} />
    </>
  );
}

function RosterSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <Skeleton className="h-12" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}
