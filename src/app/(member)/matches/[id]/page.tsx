import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MatchDetail } from "@/components/matches/match-detail";
import { ArrowLeftIcon } from "@/components/shell/icons";
import { Skeleton } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { getMatchDetail } from "@/lib/matches/queries";

export const metadata: Metadata = { title: "Match" };

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-2 pb-6">
      <Link
        href="/matches"
        className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold no-underline"
      >
        <ArrowLeftIcon size={16} />
        Match Center
      </Link>
      <Suspense fallback={<Skeleton className="h-[300px] bg-slate-300" />}>
        <Match params={params} />
      </Suspense>
    </div>
  );
}

async function Match({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, data] = await Promise.all([requireMember(), getMatchDetail(id)]);
  if (!data) notFound();
  return <MatchDetail data={data} meId={me.id} isCaptain={me.isCaptain} />;
}
