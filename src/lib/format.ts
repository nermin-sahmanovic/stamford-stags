// All dates display in the team's time zone, whatever the server or phone uses.
export const TEAM_TIME_ZONE = "America/New_York";

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TEAM_TIME_ZONE, ...options });

const shortDate = fmt({ month: "short", day: "numeric" });
const weekdayDate = fmt({ weekday: "short", month: "short", day: "numeric" });
const weekday = fmt({ weekday: "short" });
const time = fmt({ hour: "numeric", minute: "2-digit" });
const monthYear = fmt({ month: "long", year: "numeric" });
const dayOfMonth = fmt({ day: "numeric" });
const monthShort = fmt({ month: "short" });

/** "Oct 24" */
export const formatShortDate = (iso: string) => shortDate.format(new Date(iso));
/** "Sat, Oct 24" */
export const formatWeekdayDate = (iso: string) => weekdayDate.format(new Date(iso));
/** "Sat" */
export const formatWeekday = (iso: string) => weekday.format(new Date(iso));
/** "10:00 AM" */
export const formatTime = (iso: string) => time.format(new Date(iso));
/** "October 2026" */
export const formatMonthYear = (iso: string) => monthYear.format(new Date(iso));
/** "24" */
export const formatDayOfMonth = (iso: string) => dayOfMonth.format(new Date(iso));
/** "Oct" */
export const formatMonthShort = (iso: string) => monthShort.format(new Date(iso));

const isoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: TEAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
/** "2026-10-24", for file names */
export const formatIsoDate = (date: Date) => isoDate.format(date);

/** "2026-10-24": the calendar day in the team's time zone, for comparing match days. */
export const teamDateKey = (iso: string) => isoDate.format(new Date(iso));

const wallClock = new Intl.DateTimeFormat("en-US", {
  timeZone: TEAM_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function wallClockParts(date: Date) {
  const parts = Object.fromEntries(wallClock.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Team time zone offset from UTC at that instant, in ms (EDT = -4h, EST = -5h). */
function teamOffsetMs(date: Date) {
  const p = wallClockParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * "2026-10-24T10:00" from a datetime-local input, read as team time → ISO UTC string.
 * Returns null for anything that isn't a real date and time.
 */
export function teamLocalInputToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Apply the offset, then re-check it at the result in case the guess crossed a DST change.
  let utc = guess - teamOffsetMs(new Date(guess));
  utc = guess - teamOffsetMs(new Date(utc));
  const check = wallClockParts(new Date(utc));
  if (check.year !== year || check.month !== month || check.day !== day) return null;
  return new Date(utc).toISOString();
}

/** ISO string → "2026-10-24T10:00" in team time, to prefill a datetime-local input. */
export function isoToTeamLocalInput(iso: string) {
  const p = wallClockParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
