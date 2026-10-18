import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CourtLinesFull } from "@/components/court-lines";
import {
  ArrowRightIcon,
  CameraIcon,
  InfoIcon,
  ClockIcon,
  MailIcon,
  PinIcon,
} from "@/components/shell/icons";
import { EmptyState, Pill, SectionHeading, Skeleton, StatCard, type PillTone } from "@/components/ui";
import { formatShortDate, formatTime, formatWeekday, formatWeekdayDate } from "@/lib/format";
import { getPublicNews, getPublicPhotos, getTeamPhoto, getTeamSummary, type NewsPost } from "@/lib/public-data";

export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="mx-auto max-w-5xl">
        {/* Above the fold and cached ("use cache"), so no Suspense: they're part of the prerendered
            shell and paint with the first HTML instead of being streamed in and swapped by script. */}
        <Stats />
        <div className="md:grid md:grid-cols-2 md:gap-2">
          <Suspense fallback={<div className="px-4 py-2"><Skeleton className="h-[172px]" /></div>}>
            <NextMatch />
          </Suspense>
          <Suspense fallback={<div className="px-4 py-2"><Skeleton className="h-[172px]" /></div>}>
            <Latest />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <PhotoStrip />
        </Suspense>
        <ContactCard />
      </div>
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy px-5 pt-6 pb-7">
      <CourtLinesFull />
      <div className="relative mx-auto flex max-w-5xl flex-col gap-4 md:grid md:grid-cols-2 md:items-center md:gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 self-start rounded-full bg-ball/15 px-3 py-1.5 text-[12px] font-semibold tracking-[0.08em] text-ball uppercase">
            <span className="size-1.5 rounded-full bg-ball" />
            USTA Adult League
            <SeasonName />
          </div>
          <h1 className="font-display text-[60px] leading-[0.9] font-bold tracking-[0.01em] text-white uppercase">
            Stamford
            <br />
            <span className="text-ball">Stags</span>
          </h1>
          <p className="text-base leading-normal text-slate-300">
            Competitive USTA tennis, run like a club. Lineups, availability and match day in one
            place.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <HeroPhoto />
          <div className="flex flex-col gap-2.5">
            <Link
              href="/join"
              className="flex h-[52px] items-center justify-center gap-2 rounded-[12px] bg-ball text-base font-bold text-navy no-underline hover:bg-lime-300"
            >
              Join the Team
              <ArrowRightIcon size={18} />
            </Link>
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/schedule" className={heroSecondary}>
                Upcoming Matches
              </Link>
              <Link href="/contact" className={heroSecondary}>
                Contact Captain
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhotoPlaceholder() {
  return (
    <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-slate-600 bg-navy-2 text-[13px] font-medium text-muted md:aspect-[4/3]">
      <CameraIcon size={26} />
      Team photo
    </div>
  );
}

/**
 * The team photo the captain chose in the gallery; the placeholder until one is set.
 * Cropped to fill: 16:10 on phones, 4:3 in the desktop hero column. Group shots usually have
 * faces in the upper third, so the crop keeps the top (focal point 50% 35%).
 */
async function HeroPhoto() {
  const photo = await getTeamPhoto();
  if (!photo) return <PhotoPlaceholder />;
  return (
    <Link
      href="/gallery"
      className="block aspect-[16/10] overflow-hidden rounded-[14px] bg-navy-2 md:aspect-[4/3]"
    >
      {/* Optimized by next/image: sized to the hero slot instead of the 2048px original (it's the LCP). */}
      <Image
        src={photo.fullUrl}
        alt={photo.caption ?? "Stamford Stags team photo"}
        width={photo.width}
        height={photo.height}
        sizes="(min-width: 768px) 496px, calc(100vw - 40px)"
        priority
        className="size-full object-cover object-[50%_35%]"
      />
    </Link>
  );
}

/** The latest public photos under the fold; hidden until there are some. */
async function PhotoStrip() {
  const photos = await getPublicPhotos(6);
  if (photos.length === 0) return null;
  return (
    <section aria-labelledby="photos-heading" className="px-4 pt-4 pb-2">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <SectionHeading id="photos-heading">From the courts</SectionHeading>
        <Link href="/gallery" className="inline-flex min-h-11 items-center text-[14px] font-semibold">
          Gallery
        </Link>
      </div>
      <ul className="grid grid-cols-3 gap-1 md:grid-cols-6">
        {photos.map((photo) => (
          <li key={photo.id}>
            <Link href="/gallery" className="block aspect-square overflow-hidden rounded-[8px] bg-line">
              <Image
                src={photo.thumbUrl}
                alt={photo.caption ?? "Team photo"}
                width={photo.width}
                height={photo.height}
                unoptimized
                loading="lazy"
                className="size-full object-cover"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const heroSecondary =
  "flex h-12 items-center justify-center rounded-[12px] border-[1.5px] border-edge text-[15px] font-semibold text-white no-underline hover:bg-navy-2 hover:text-white";

async function SeasonName() {
  const { season } = await getTeamSummary();
  return season ? <> · {season}</> : null;
}

async function Stats() {
  const summary = await getTeamSummary();
  const next = summary.next_match;
  return (
    <section
      aria-label="Season at a glance"
      className="grid grid-cols-2 gap-2.5 px-4 pt-5 pb-2 md:grid-cols-4"
    >
      <StatCard label="Players" value={summary.player_count} note="on the roster" />
      <StatCard
        label="Record"
        value={`${summary.wins}–${summary.losses}`}
        note={summary.season ? `${summary.season} season` : "this season"}
      />
      <StatCard
        label="Next match"
        value={next ? formatShortDate(next.starts_at) : "TBA"}
        note={next ? `${formatWeekday(next.starts_at)} · ${formatTime(next.starts_at)}` : "Schedule coming soon"}
      />
      <StatCard
        label="Open spots"
        value={summary.open_spots}
        note={summary.open_spots > 0 ? "Recruiting now" : "Roster is full"}
        noteClassName={summary.open_spots > 0 ? "font-semibold text-blue-700" : "text-slate-600"}
      />
    </section>
  );
}

async function NextMatch() {
  const { next_match: next } = await getTeamSummary();
  if (!next) return null;
  const home = next.home_away === "home";
  return (
    <section aria-label="Next match" className="px-4 py-2">
      <Link
        href="/schedule"
        className="relative block overflow-hidden rounded-2xl bg-navy p-4 text-white no-underline hover:bg-navy-2 hover:text-white"
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold tracking-[0.1em] text-ball uppercase">Next match</span>
          <span
            className={`rounded-md px-2 py-1 text-[11px] font-bold tracking-[0.08em] ${
              home ? "bg-ball text-navy" : "border border-edge text-white"
            }`}
          >
            {home ? "HOME" : "AWAY"}
          </span>
        </div>
        <div className="mt-1.5 font-display text-[30px] leading-[1.1] font-bold">
          {home ? "vs." : "@"} {next.opponent}
        </div>
        <div className="mt-2.5 flex flex-col gap-1.5 text-[14px] text-slate-300">
          <div className="flex items-center gap-2">
            <ClockIcon size={16} />
            {formatWeekdayDate(next.starts_at)} · {formatTime(next.starts_at)}
          </div>
          {next.location_name ? (
            <div className="flex items-center gap-2">
              <PinIcon size={16} />
              {next.location_name}
            </div>
          ) : null}
        </div>
      </Link>
    </section>
  );
}

const newsTone: Record<NewsPost["type"], PillTone> = {
  result: "navy",
  announcement: "blue",
  event: "warn",
};

async function Latest() {
  const posts = await getPublicNews(3);
  return (
    <section aria-labelledby="latest-heading" className="px-4 pt-4 pb-2 md:pt-2">
      <div className="mb-2.5">
        <SectionHeading id="latest-heading">Latest</SectionHeading>
      </div>
      {posts.length === 0 ? (
        <EmptyState icon={InfoIcon} title="No news yet">
          Results and announcements appear here after each match.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2.5">
          {posts.map((post) => (
            <article
              key={post.id}
              className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-white p-3.5"
            >
              <Pill tone={newsTone[post.type]}>{post.type}</Pill>
              <h3 className="text-[17px] font-bold">{post.title}</h3>
              <p className="text-[14px] text-slate-600">
                {formatShortDate(post.published_at)}
                {post.body ? ` · ${post.body}` : null}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ContactCard() {
  return (
    <section id="contact" aria-label="Contact" className="px-4 pt-4 pb-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-12 flex-none items-center justify-center rounded-full bg-court text-base font-bold text-white"
          >
            CP
          </div>
          <div>
            <div className="text-[17px] font-bold">Team Captain</div>
            <div className="text-[14px] text-slate-600">Questions about joining or match day?</div>
          </div>
        </div>
        <Link
          href="/contact"
          className="flex h-12 items-center justify-center gap-2 rounded-[12px] bg-court px-5 text-[15px] font-semibold text-white no-underline hover:bg-blue-700 hover:text-white"
        >
          <MailIcon size={18} />
          Message the captain
        </Link>
      </div>
      <p className="mt-4 text-center text-[12px] text-slate-600">USTA League team · Stamford, CT</p>
    </section>
  );
}
