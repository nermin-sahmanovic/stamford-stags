import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GuardFallback } from "@/components/guard-fallback";
import { getAuthUser, getCurrentPlayer } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "Not on the roster" };

export default function NotOnRosterPage() {
  return (
    <Suspense fallback={<GuardFallback />}>
      <NotOnRoster />
    </Suspense>
  );
}

async function NotOnRoster() {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");
  if (await getCurrentPlayer()) redirect("/matches");

  return (
    <section className="mx-auto max-w-md px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
        You&apos;re not on the roster yet
      </h1>
      <div className="mt-3 rounded-[14px] border border-line bg-white p-5">
        <p className="text-[15px] text-slate-700">
          You&apos;re signed in as{" "}
          <strong className="break-all text-navy">{user.email ?? "an unknown address"}</strong>, but
          that email isn&apos;t on the Stamford Stags roster.
        </p>
        <p className="mt-2 text-[15px] text-slate-700">
          Ask your captain to add you with this exact address. If you&apos;re new to the team, send
          a request to join.
        </p>
        <Link
          href="/join"
          className="mt-4 flex h-[52px] items-center justify-center rounded-[12px] bg-navy text-base font-bold text-ball no-underline hover:bg-navy-2"
        >
          Join the team
        </Link>
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="h-11 w-full rounded-[10px] border border-line text-[15px] font-semibold text-court hover:bg-ground"
          >
            Sign out and use another email
          </button>
        </form>
      </div>
    </section>
  );
}
