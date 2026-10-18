import "server-only";
import { ALL_DAY_TYPES, type CalendarItem } from "@/lib/calendar/items";
import { teamDateKey } from "@/lib/format";
import { resultLabel } from "@/lib/matches/display";

// iCalendar (RFC 5545) feeds for calendar subscriptions. Times are sent in UTC, so no VTIMEZONE
// is needed; calendar apps show them in the phone's own zone.

/** Matches have no end time; block out a typical league match. */
const MATCH_HOURS = 3;
/** Events without an end time (other than all-day ones). */
const EVENT_HOURS = 1;

const HOUR_MS = 3_600_000;

/** 2026-10-24T14:00:00Z → 20261024T140000Z */
const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** "2026-10-24" → "20261024", plus the next day for an all-day DTEND (exclusive). */
function dateValues(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { start: dayKey.replace(/-/g, ""), end: next.replace(/-/g, "") };
}

/** TEXT values: backslash, semicolon, comma and newlines are escaped. */
const escapeText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const encoder = new TextEncoder();

/** Lines longer than 75 octets continue on the next line after a CRLF and a space. */
function fold(line: string) {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function eventLines(item: CalendarItem, options: { now: Date; siteUrl: string; personal: boolean }) {
  const isMatch = item.kind === "match";
  const lines = [`UID:${item.kind === "match" ? "match" : "event"}-${item.id}@stamford-stags`, `DTSTAMP:${utcStamp(options.now)}`];

  const start = new Date(item.startsAt);
  if (!isMatch && !item.endsAt && ALL_DAY_TYPES.includes(item.kind)) {
    const day = dateValues(teamDateKey(item.startsAt));
    lines.push(`DTSTART;VALUE=DATE:${day.start}`, `DTEND;VALUE=DATE:${day.end}`, "TRANSP:TRANSPARENT");
  } else {
    const end = item.endsAt ? new Date(item.endsAt) : new Date(start.getTime() + (isMatch ? MATCH_HOURS : EVENT_HOURS) * HOUR_MS);
    lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
  }

  lines.push(`SUMMARY:${escapeText(isMatch ? `Stags ${item.title}` : item.title)}`);
  if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`);

  const description: string[] = [];
  const result = resultLabel(item.teamPoints, item.opponentPoints);
  if (isMatch && item.status === "completed" && result) description.push(`Final: ${result.outcome} ${result.score}`);
  if (item.description) description.push(item.description);
  if (options.personal && isMatch) description.push(`Match Center: ${options.siteUrl}/matches/${item.id}`);
  if (description.length > 0) lines.push(`DESCRIPTION:${escapeText(description.join("\n"))}`);
  if (options.personal && isMatch) lines.push(`URL:${options.siteUrl}/matches/${item.id}`);

  lines.push(`STATUS:${isMatch && item.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`);
  return ["BEGIN:VEVENT", ...lines, "END:VEVENT"];
}

/** A whole VCALENDAR document, CRLF line endings, ready to serve as text/calendar. */
export function buildCalendar(options: {
  name: string;
  items: CalendarItem[];
  siteUrl: string;
  personal: boolean;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stamford Stags//Team calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
    "X-WR-TIMEZONE:America/New_York",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...options.items.flatMap((item) => eventLines(item, { now, siteUrl: options.siteUrl, personal: options.personal })),
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export const ICS_HEADERS = {
  "Content-Type": "text/calendar; charset=utf-8",
  "Content-Disposition": 'inline; filename="stamford-stags.ics"',
};

/** Feeds cover recent history (so past results stay in the calendar) and the season ahead. */
export function feedRange(now = new Date()) {
  // Rounded to the day so the public feed's cache key repeats.
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return {
    from: new Date(day - 120 * 24 * HOUR_MS).toISOString(),
    to: new Date(day + 400 * 24 * HOUR_MS).toISOString(),
  };
}
