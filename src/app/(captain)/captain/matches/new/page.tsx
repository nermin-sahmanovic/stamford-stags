import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/shell/icons";
import { createMatch } from "../actions";
import { MatchForm } from "../match-form";

export const metadata: Metadata = { title: "New match" };

export default function NewMatchPage() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-2 pb-6">
      <Link
        href="/captain/matches"
        className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold no-underline"
      >
        <ArrowLeftIcon size={16} />
        Matches
      </Link>
      <h1 className="mb-1 font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">New match</h1>
      <p className="mb-3 text-[15px] text-slate-600">
        It starts with the standard match-day checklist. You can edit the list after saving.
      </p>
      <MatchForm
        action={createMatch}
        submitLabel="Create match"
        showStatus={false}
        initial={{
          opponent: "",
          starts_at: "",
          home_away: "home",
          location_name: "",
          location_address: "",
          captain_notes: "",
          status: "scheduled",
        }}
      />
    </div>
  );
}
