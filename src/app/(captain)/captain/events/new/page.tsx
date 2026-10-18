import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftIcon } from "@/components/shell/icons";
import { Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { createEvent } from "../actions";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-2 pb-6">
      <Link href="/captain/events" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold no-underline">
        <ArrowLeftIcon size={16} />
        Events
      </Link>
      <h1 className="mb-3 font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">New event</h1>
      <Suspense fallback={<Skeleton className="h-[560px]" />}>
        <NewEventForm />
      </Suspense>
    </div>
  );
}

/** Gated here too, so the form is never part of the prerendered shell a non-captain receives. */
async function NewEventForm() {
  await requireCaptain();
  return (
    <EventForm
      action={createEvent}
      submitLabel="Create event"
      initial={{ type: "practice", title: "", starts_at: "", ends_at: "", location: "", description: "", is_public: false }}
    />
  );
}
