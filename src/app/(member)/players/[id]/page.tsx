import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CourtLinesBand } from "@/components/court-lines";
import { PlayerAvatar } from "@/components/player-avatar";
import { MailIcon, PhoneIcon } from "@/components/shell/icons";
import { Pill, SectionHeading, Skeleton, StatCard } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { formatShortDate } from "@/lib/format";
import { positionLabel, ratingLabel } from "@/lib/roster/display";
import { getPlayerProfile, type MatchHistoryItem } from "@/lib/roster/queries";
import { ROLE_LABELS } from "@/lib/roster/schema";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Player" };

export default function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <PlayerProfile params={params} />
    </Suspense>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <div className="h-[120px] bg-navy" />
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-28" />
      </div>
    </>
  );
}

async function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, profile] = await Promise.all([requireMember(), getPlayerProfile(id)]);
  if (!profile) notFound();

  const { player, wins, losses, history } = profile;
  const isMe = player.id === me.id;
  const played = wins + losses;

  return (
    <>
      <section className="relative overflow-hidden bg-navy px-5 pt-5 pb-6">
        <CourtLinesBand />
        <div className="relative mx-auto flex max-w-5xl items-center gap-4">
          <span className="rounded-full ring-2 ring-ball">
            <PlayerAvatar name={player.full_name} size={64} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              {player.role !== "player" ? <Pill tone="ball">{ROLE_LABELS[player.role]}</Pill> : null}
              {!player.is_active ? <Pill tone="warn">Inactive</Pill> : null}
            </div>
            <h1 className="mt-1 font-display text-[34px] leading-none font-bold text-white uppercase">
              {player.full_name}
            </h1>
            <p className="mt-1 text-[15px] text-slate-300">
              {ratingLabel(player.ntrp_rating)} · {positionLabel(player.position_pref)}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pt-4 pb-6">
        <div className="grid gap-5 md:grid-cols-2">
          <section aria-labelledby="contact-heading" className="flex flex-col gap-2.5">
            <SectionHeading id="contact-heading">Contact</SectionHeading>
            <div className="overflow-hidden rounded-[14px] border border-line bg-white">
              <ContactRow
                href={player.phone ? `tel:${player.phone.replace(/[^\d+]/g, "")}` : null}
                icon={<PhoneIcon size={18} />}
                label="Phone"
                value={player.phone ?? "Not on file"}
              />
              <ContactRow
                href={`mailto:${player.email}`}
                icon={<MailIcon size={18} />}
                label="Email"
                value={player.email}
              />
            </div>
          </section>

          <section aria-labelledby="record-heading" className="flex flex-col gap-2.5">
            <SectionHeading id="record-heading">Record</SectionHeading>
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard label="Wins" value={wins} note={played ? `of ${played} ${played === 1 ? "line" : "lines"}` : "No results yet"} />
              <StatCard label="Losses" value={losses} note={positionLabel(player.position_pref)} />
            </div>
          </section>
        </div>

        {isMe ? (
          <ProfileForm phone={player.phone ?? ""} position={player.position_pref} />
        ) : null}

        <section aria-labelledby="history-heading" className="flex flex-col gap-2.5">
          <SectionHeading id="history-heading">Match history</SectionHeading>
          {history.length === 0 ? (
            <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
              No matches in a lineup yet.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-[14px] border border-line bg-white">
              {history.map((item) => (
                <HistoryRow key={item.matchId} item={item} />
              ))}
            </ul>
          )}
        </section>

        <Link href="/players" className="self-start py-2.5 text-[15px] font-semibold text-court">
          ← All players
        </Link>
      </div>
    </>
  );
}

function ContactRow({
  href,
  icon,
  label,
  value,
}: {
  href: string | null;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-court">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold tracking-[0.06em] text-slate-500 uppercase">
          {label}
        </span>
        <span className="block truncate text-[15px] font-semibold">{value}</span>
      </span>
    </>
  );
  const className =
    "flex min-h-[56px] items-center gap-3 border-b border-[#EEF2F6] px-3.5 py-2.5 text-navy no-underline last:border-b-0";
  return href ? (
    <a href={href} className={`${className} hover:bg-slate-50`}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

function HistoryRow({ item }: { item: MatchHistoryItem }) {
  const result =
    item.status !== "completed"
      ? { label: "Upcoming", tone: "blue" as const }
      : item.won === null
        ? { label: "No result", tone: "slate" as const }
        : item.won
          ? { label: "Won", tone: "ball" as const }
          : { label: "Lost", tone: "slate" as const };

  return (
    <li className="flex items-center gap-3 border-b border-[#EEF2F6] px-3.5 py-3 last:border-b-0">
      <span className="w-12 shrink-0 text-[13px] font-semibold text-slate-600">
        {formatShortDate(item.startsAt)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">
          {item.homeAway === "home" ? "vs" : "@"} {item.opponent}
        </span>
        <span className="block text-[13px] text-slate-600">
          {item.line}
          {item.score ? ` · ${item.score}` : ""}
        </span>
      </span>
      <Pill tone={result.tone}>{result.label}</Pill>
    </li>
  );
}
