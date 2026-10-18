import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ComponentType, type ReactNode } from "react";
import { RemindNonResponders } from "@/components/captain/remind-non-responders";
import {
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
  LockIcon,
  MailIcon,
  MatchesIcon,
  MessagesIcon,
  PlayersIcon,
  ResultsIcon,
  ScheduleIcon,
  UploadIcon,
  UserPlusIcon,
  type IconProps,
} from "@/components/shell/icons";
import { EmptyState, SectionHeading, Skeleton } from "@/components/ui";
import { requireCaptain } from "@/lib/auth";
import { getDashboard, type Dashboard, type DashboardMatch } from "@/lib/captain/dashboard";
import { formatShortDate, TEAM_TIME_ZONE } from "@/lib/format";
import { opponentLabel } from "@/lib/matches/display";
import { AUDIENCE_LABELS } from "@/lib/messages/queries";
import { initials, ratingLabel } from "@/lib/roster/display";
import { RegistrationRow } from "./registration-row";

export const metadata: Metadata = { title: "Captain's Dashboard" };

export default function CaptainDashboardPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-4 pb-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <CaptainDashboard />
      </Suspense>
    </section>
  );
}

const today = new Intl.DateTimeFormat("en-US", { timeZone: TEAM_TIME_ZONE, weekday: "long", month: "short", day: "numeric" });

async function CaptainDashboard() {
  const me = await requireCaptain();
  const data = await getDashboard(me.id);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.04em] text-slate-600 uppercase">{today.format(new Date())}</p>
          <h1 className="mt-0.5 font-display text-[30px] leading-tight font-bold tracking-[0.02em] uppercase">
            Captain&apos;s Dashboard
          </h1>
        </div>
        <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full bg-navy px-2.5 py-1 text-[12px] font-bold tracking-[0.08em] text-ball uppercase">
          <LockIcon size={13} /> Admin only
        </span>
      </div>

      <Kpis data={data} />

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-6">
        <div>
          <NeedsAttention matches={data.needsAttention} />
          <Registrations data={data} />
        </div>
        <div>
          <QuickActions />
          <RecentMessages messages={data.messages} />
          <AllTools />
        </div>
      </div>
    </>
  );
}

function Section({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-5">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <SectionHeading id={id}>{title}</SectionHeading>
        {aside}
      </div>
      {children}
    </section>
  );
}

const listDates = (dates: string[]) =>
  dates.length <= 2 ? dates.join(" and ") : `${dates.slice(0, -1).join(", ")} and ${dates[dates.length - 1]}`;

function Kpis({ data }: { data: Dashboard }) {
  const { next, lineupSet, shortMatches, roster, pendingCount } = data;
  const lineupNote = !next
    ? "No match scheduled"
    : lineupSet >= next.needed && next.needed > 0
      ? "Lineup filled"
      : lineupSet > 0
        ? `${lineupSet} of ${next.needed} lineup spots set`
        : "Lineup not set";

  return (
    <section aria-label="Key numbers" className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
      <div className="rounded-[14px] bg-navy p-3.5 text-white">
        <div className="text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">
          {next ? `${formatShortDate(next.startsAt)} replies` : "Next match"}
        </div>
        <div className="mt-0.5 font-display text-[36px] leading-[1.05] font-bold text-ball">
          {next ? `${next.replied}/${next.roster}` : "—"}
        </div>
        <div className="text-[13px] text-slate-300">{lineupNote}</div>
      </div>
      <Kpi label="Registrations" value={pendingCount} note="awaiting review" />
      <Kpi
        label="Open spots"
        value={roster.open ?? "—"}
        note={roster.max === null ? "No current season" : `of ${roster.max} max roster`}
      />
      <Kpi
        label="Short matches"
        value={shortMatches.length}
        valueClassName={shortMatches.length > 0 ? "text-warn" : undefined}
        note={shortMatches.length > 0 ? listDates(shortMatches.map((m) => formatShortDate(m.startsAt))) : "Every match covered"}
      />
    </section>
  );
}

function Kpi({ label, value, note, valueClassName = "" }: { label: string; value: ReactNode; note: string; valueClassName?: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-3.5">
      <div className="text-[12px] font-semibold tracking-[0.06em] text-slate-600 uppercase">{label}</div>
      <div className={`mt-0.5 font-display text-[36px] leading-[1.05] font-bold ${valueClassName}`}>{value}</div>
      <div className="text-[13px] text-slate-600">{note}</div>
    </div>
  );
}

function NeedsAttention({ matches }: { matches: DashboardMatch[] }) {
  const [first, ...rest] = matches;
  return (
    <Section id="attention-heading" title="Needs attention">
      {first ? (
        <>
          <RemindNonResponders
            key={first.matchId}
            matchId={first.matchId}
            names={first.noResponse.map((p) => p.name)}
            detail={`For ${formatShortDate(first.startsAt)} ${opponentLabel(first.opponent, first.match.homeAway)}.${
              first.short > 0 ? ` You're ${first.short} short of a full lineup.` : ""
            }`}
          />
          {rest.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {rest.map((m) => (
                <li key={m.matchId}>
                  <Link
                    href={`/captain/matches/${m.matchId}`}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-[12px] border border-line bg-white px-3.5 text-[14px] text-navy no-underline hover:border-slate-300"
                  >
                    <span>
                      <span className="font-bold">{formatShortDate(m.startsAt)}</span>{" "}
                      {opponentLabel(m.opponent, m.match.homeAway)}: {m.noResponse.length} haven&apos;t replied
                      {m.short > 0 ? <span className="font-semibold text-warn"> · {m.short} short</span> : null}
                    </span>
                    <ArrowRightIcon size={16} className="shrink-0 text-slate-600" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <EmptyState icon={CheckIcon} title="Everyone has replied" tone="good">
          Every player has answered for every upcoming match.
        </EmptyState>
      )}
    </Section>
  );
}

const quickActions: { href: string; label: string; icon: ComponentType<IconProps> }[] = [
  { href: "/captain/matches/new", label: "Create match", icon: MatchesIcon },
  { href: "/captain/events/new", label: "Add event", icon: ScheduleIcon },
  { href: "/captain/messages/new", label: "Email team", icon: MailIcon },
  { href: "/captain/roster/new", label: "Add player", icon: UserPlusIcon },
  { href: "/captain/roster/import", label: "Import CSV", icon: UploadIcon },
  { href: "/photos#team-photo", label: "Change team photo", icon: CameraIcon },
];

function QuickActions() {
  return (
    <Section id="quick-heading" title="Quick actions">
      <ul className="grid grid-cols-2 gap-2.5">
        {quickActions.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-[72px] flex-col items-start justify-center gap-1.5 rounded-[14px] border border-line bg-white px-3.5 py-3 text-[15px] font-bold text-navy no-underline hover:border-slate-300"
            >
              <Icon size={20} className="text-court" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const POSITION_SHORT = { singles: "Singles", doubles: "Doubles", both: "Both" } as const;

function appliedAgo(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days < 1) return "applied today";
  if (days < 7) return `applied ${days}d ago`;
  return `applied ${Math.floor(days / 7)}w ago`;
}

function Registrations({ data }: { data: Dashboard }) {
  return (
    <Section
      id="registrations-heading"
      title="Registrations"
      aside={<span className="text-[13px] font-semibold text-slate-600">{data.pendingCount} pending</span>}
    >
      {data.registrations.length === 0 ? (
        <EmptyState icon={PlayersIcon} title="No registrations waiting">
          New sign-ups from the Join page show up here.
        </EmptyState>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-white">
          {data.registrations.map((r) => (
            <RegistrationRow
              key={r.id}
              id={r.id}
              name={r.fullName}
              initials={initials(r.fullName)}
              meta={`${ratingLabel(r.ntrp)} · ${POSITION_SHORT[r.position]} · ${appliedAgo(r.createdAt)}`}
              invitedAlready={r.invited}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function RecentMessages({ messages }: { messages: Dashboard["messages"] }) {
  return (
    <Section
      id="messages-heading"
      title="Recent messages"
      aside={
        <Link href="/captain/messages" className="inline-flex min-h-11 items-center text-[14px] font-semibold">
          All messages
        </Link>
      }
    >
      {messages.length === 0 ? (
        <EmptyState icon={MessagesIcon} title="Nothing sent yet" action={{ href: "/captain/messages/new", label: "Email the team" }}>
          Team emails, reminders and lineup notices will be listed here.
        </EmptyState>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-white">
          {messages.map((m) => (
            <li key={m.id} className="border-b border-[#EEF2F6] last:border-b-0">
              <Link
                href={`/captain/messages/${m.id}`}
                className="block px-3.5 py-3 text-navy no-underline hover:bg-slate-50"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[15px] font-bold">{m.subject}</span>
                  <span className="shrink-0 text-[13px] text-slate-600">{formatShortDate(m.sentAt)}</span>
                </span>
                <span className="block text-[13px] text-slate-600">
                  {AUDIENCE_LABELS[m.audience]} · {m.recipientCount} recipient{m.recipientCount === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const tools = [
  { href: "/captain/matches", label: "Matches", icon: MatchesIcon },
  { href: "/captain/events", label: "Events", icon: ScheduleIcon },
  { href: "/captain/roster", label: "Roster", icon: PlayersIcon },
  { href: "/captain/messages", label: "Messages", icon: MessagesIcon },
  { href: "/photos", label: "Photos", icon: CameraIcon },
  { href: "/captain/standings", label: "Standings", icon: ResultsIcon },
];

function AllTools() {
  return (
    <Section id="tools-heading" title="All tools">
      <ul className="grid grid-cols-2 gap-2">
        {tools.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-11 items-center gap-2 rounded-[12px] border border-line bg-white px-3 text-[14px] font-semibold text-navy no-underline hover:border-slate-300"
            >
              <Icon size={18} className="text-court" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading the dashboard…</span>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-2 h-8 w-64" />
      <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[106px]" />
        ))}
      </div>
      <Skeleton className="mt-5 h-7 w-48" />
      <Skeleton className="mt-2.5 h-[190px]" />
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[72px]" />
        ))}
      </div>
    </div>
  );
}
