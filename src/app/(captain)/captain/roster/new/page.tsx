import type { Metadata } from "next";
import { createPlayer } from "../actions";
import { PlayerForm } from "../player-form";

export const metadata: Metadata = { title: "Add player" };

export default function NewPlayerPage() {
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-3 px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
        Add player
      </h1>
      <PlayerForm
        action={createPlayer}
        submitLabel="Add player"
        initial={{
          full_name: "",
          email: "",
          phone: "",
          usta_number: "",
          ntrp_rating: "",
          position_pref: "both",
          role: "player",
        }}
      />
    </section>
  );
}
