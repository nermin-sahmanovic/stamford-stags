import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftIcon } from "@/components/shell/icons";
import { Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { getEvent } from "@/lib/events/queries";
import { isoToTeamLocalInput } from "@/lib/format";
import { updateEvent } from "../actions";
import { EventForm } from "../event-form";
import { DeleteEvent } from "./delete-event";

export const metadata: Metadata = { title: "Edit event" };

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-2 pb-6">
      <Link href="/captain/events" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold no-underline">
        <ArrowLeftIcon size={16} />
        Events
      </Link>
      <Suspense fallback={<Skeleton className="h-[560px]" />}>
        <EditEvent params={params} />
      </Suspense>
    </div>
  );
}

async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [, event] = await Promise.all([requireCaptain(), getEvent(id)]);
  if (!event) notFound();

  return (
    <>
      <h1 className="mb-3 font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">{event.title}</h1>
      <EventForm
        action={updateEvent.bind(null, event.id)}
        submitLabel="Save event"
        initial={{
          type: event.type,
          title: event.title,
          starts_at: isoToTeamLocalInput(event.starts_at),
          ends_at: event.ends_at ? isoToTeamLocalInput(event.ends_at) : "",
          location: event.location ?? "",
          description: event.description ?? "",
          is_public: event.is_public,
        }}
      />
      <DeleteEvent eventId={event.id} title={event.title} />
    </>
  );
}
