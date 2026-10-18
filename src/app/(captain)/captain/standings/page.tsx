import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { readClient } from "@/lib/supabase/read";
import { StandingsEditor } from "./standings-editor";

export const metadata: Metadata = { title: "Standings" };

export default function StandingsAdminPage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-3 px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">Standings</h1>
      <p className="-mt-1 text-[15px] text-slate-600">
        Copy the flight table from the USTA site. W and L are team matches; lines are individual courts. Shown on the{" "}
        <Link href="/results" className="font-semibold">
          Results page
        </Link>
        .
      </p>
      <Suspense fallback={<Skeleton className="h-[420px]" />}>
        <Editor />
      </Suspense>
    </section>
  );
}

async function Editor() {
  await requireCaptain();
  const supabase = await readClient();
  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("is_current", true)
    .maybeSingle();
  if (seasonError) throw seasonError;
  if (!season) {
    return (
      <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
        There&apos;s no current season yet.
      </p>
    );
  }

  const { data, error } = await supabase
    .from("standings")
    .select("rank, team_name, wins, losses, lines_won, lines_lost, is_stags")
    .eq("season_id", season.id)
    .order("rank")
    .order("team_name");
  if (error) throw error;

  return <StandingsEditor season={season.name} initial={data} />;
}
