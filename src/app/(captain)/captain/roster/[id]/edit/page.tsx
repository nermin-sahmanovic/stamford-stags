import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Pill, Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { getRosterPlayer } from "@/lib/roster/queries";
import { updatePlayer } from "../../actions";
import { PlayerForm } from "../../player-form";
import { ActiveToggle } from "./active-toggle";

export const metadata: Metadata = { title: "Edit player" };

export default function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 pt-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-[480px]" />
        </div>
      }
    >
      <EditPlayer params={params} />
    </Suspense>
  );
}

async function EditPlayer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, player] = await Promise.all([requireCaptain(), getRosterPlayer(id)]);
  if (!player) notFound();

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-3 px-4 pt-4 pb-6">
      <div>
        {!player.is_active ? <Pill tone="warn">Inactive</Pill> : null}
        <h1 className="mt-1 font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
          {player.full_name}
        </h1>
        <p className="text-[14px] text-slate-600">
          {player.user_id ? "Has signed in." : "Hasn't signed in yet."}
        </p>
      </div>
      <PlayerForm
        action={updatePlayer.bind(null, player.id)}
        submitLabel="Save changes"
        initial={{
          full_name: player.full_name,
          email: player.email,
          phone: player.phone ?? "",
          usta_number: player.usta_number ?? "",
          ntrp_rating: player.ntrp_rating?.toFixed(1) ?? "",
          position_pref: player.position_pref,
          role: player.role,
        }}
      />
      <ActiveToggle id={player.id} active={player.is_active} isMe={player.id === me.id} />
    </section>
  );
}
