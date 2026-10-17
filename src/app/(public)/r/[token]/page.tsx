import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { Skeleton } from "@/components/ui";
import { formatTime, formatWeekdayDate } from "@/lib/format";
import { opponentLabel } from "@/lib/matches/display";
import { createAdminClient } from "@/lib/supabase/admin";
import { RSVP_ANSWERS } from "./answers";
import { RsvpPanel } from "./rsvp-panel";

// The token is a bearer credential: keep it out of search engines and Referer headers.
export const metadata: Metadata = {
  title: "Your answer",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Peek = {
  valid: boolean;
  player_name: string;
  match_id: string;
  opponent: string;
  home_away: "home" | "away";
  starts_at: string;
  availability: "available" | "maybe" | "unavailable" | null;
  in_lineup: boolean;
  rsvp: "pending" | "confirmed" | "declined" | null;
};

/**
 * One-tap link from an email: /r/<token>?s=available. The GET only reads (email link scanners
 * prefetch links); the answer is saved by a server action the page runs once it loads.
 */
export default function RsvpLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ s?: string | string[] }>;
}) {
  return (
    <section className="mx-auto max-w-md px-4 pt-4 pb-6">
      <Suspense fallback={<Skeleton className="h-[320px]" />}>
        <Landing params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Landing({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ s?: string | string[] }>;
}) {
  // Request time only: the token lookup must never run in a prerender.
  await connection();
  const [{ token }, { s }] = await Promise.all([params, searchParams]);
  if (!z.guid().safeParse(token).success) return <Expired />;
  const answer = z.enum(RSVP_ANSWERS).safeParse(s);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("peek_rsvp_token", { p_token: token });
  if (error) console.error("[rsvp-link] peek failed:", error.message);
  const peek = data as Peek | null;
  if (!peek || !peek.valid) return <Expired />;

  return (
    <RsvpPanel
      token={token}
      autoAnswer={answer.success ? answer.data : null}
      playerName={peek.player_name}
      matchId={peek.match_id}
      matchLabel={opponentLabel(peek.opponent, peek.home_away)}
      when={`${formatWeekdayDate(peek.starts_at)}, ${formatTime(peek.starts_at)}`}
      availability={peek.availability}
      inLineup={peek.in_lineup}
      rsvp={peek.rsvp}
    />
  );
}

function Expired() {
  return (
    <>
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
        This link has expired
      </h1>
      <div className="mt-3 rounded-[14px] border border-line bg-white p-5">
        <p className="text-[15px] text-slate-700">
          Answer links stop working once the match starts, or if the link was changed. Sign in to answer from
          Match Center instead.
        </p>
        <Link
          href="/availability"
          className="mt-4 flex h-12 items-center justify-center rounded-[12px] bg-navy text-[16px] font-bold text-white no-underline hover:bg-navy-2 hover:text-white"
        >
          Sign in to answer
        </Link>
      </div>
    </>
  );
}
