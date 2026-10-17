import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { ArrowLeftIcon } from "@/components/shell/icons";
import { Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { delivery, devRedirect } from "@/lib/email/config";
import { getComposeData } from "@/lib/messages/queries";
import { AUDIENCES } from "@/lib/messages/schemas";
import { ComposeForm } from "./compose-form";

export const metadata: Metadata = { title: "New message" };

type Search = Promise<{ audience?: string; match?: string }>;

export default function NewMessagePage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-2 pb-6">
      <Link href="/captain/messages" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold no-underline">
        <ArrowLeftIcon size={16} />
        Messages
      </Link>
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">New message</h1>
      <Suspense fallback={<Skeleton className="mt-3 h-[520px]" />}>
        <Compose searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Compose({ searchParams }: { searchParams: Search }) {
  const [, data, search] = await Promise.all([requireCaptain(), getComposeData(), searchParams]);
  const audience = z.enum(AUDIENCES).catch("team").parse(search.audience);
  const matchId = data.matches.some((m) => m.id === search.match) ? search.match! : null;

  const mode = delivery();
  const banner =
    mode === "live"
      ? null
      : mode === "redirect"
        ? `Dev mode: every email goes to ${devRedirect()}, labeled with who it was for.`
        : "Dev mode: emails are only logged. Set RESEND_API_KEY and EMAIL_DEV_REDIRECT to receive them.";

  return <ComposeForm data={data} initialAudience={audience} initialMatchId={matchId} devBanner={banner} />;
}
