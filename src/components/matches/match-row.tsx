import Link from "next/link";
import { Pill } from "@/components/ui";
import { formatDayOfMonth, formatMonthShort, formatTime } from "@/lib/format";
import { homeAwayLabel, opponentLabel, resultLabel } from "@/lib/matches/display";
import type { Match } from "@/lib/matches/queries";

/** A match in a list: date block, opponent, meta line and a badge (or a warn `alert`). Links to the detail page. */
export function MatchRow({ match, href, meta, alert }: { match: Match; href: string; meta?: string; alert?: string }) {
  const result = match.status === "completed" ? resultLabel(match.teamPoints, match.opponentPoints) : null;
  const defaultMeta = [
    homeAwayLabel(match.homeAway),
    formatTime(match.startsAt),
    match.status === "completed" ? null : match.lineupPublished ? "Lineup posted" : "Lineup not set",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={href}
      className="flex min-h-[72px] items-center gap-3.5 rounded-[14px] border border-line bg-white px-3.5 py-3 text-navy no-underline hover:border-slate-300"
    >
      <div className="w-12 shrink-0 text-center">
        <div className="text-[11px] font-bold tracking-[0.06em] text-slate-600 uppercase">
          {formatMonthShort(match.startsAt)}
        </div>
        <div className="font-display text-[28px] leading-none font-bold">{formatDayOfMonth(match.startsAt)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-bold">{opponentLabel(match.opponent, match.homeAway)}</div>
        <div className="truncate text-[13px] text-slate-600">{meta ?? defaultMeta}</div>
      </div>
      {match.status === "cancelled" ? (
        <Pill tone="warn">Cancelled</Pill>
      ) : alert ? (
        <Pill tone="warn">{alert}</Pill>
      ) : result ? (
        <span
          className={`shrink-0 rounded-md px-2 py-1 font-display text-[18px] leading-none font-bold ${
            result.outcome === "W" ? "bg-blue-100 text-blue-800" : result.outcome === "L" ? "bg-warn-bg text-orange-800" : "bg-slate-100 text-slate-700"
          }`}
        >
          {result.outcome} {result.score}
        </span>
      ) : (
        <Pill tone={match.homeAway === "home" ? "ball" : "slate"}>{match.homeAway}</Pill>
      )}
    </Link>
  );
}
