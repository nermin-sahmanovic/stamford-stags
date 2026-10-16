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
