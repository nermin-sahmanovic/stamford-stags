import "server-only";
import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { z } from "zod";
import { TEAM_TIME_ZONE, isoToTeamLocalInput, teamDateKey } from "@/lib/format";
import { STAMFORD } from "@/lib/matches/geocode";

// Match-day forecast from Open-Meteo (free, no key). It only forecasts 16 days ahead
// (today + 15), so later matches get "too-far". Any failure becomes "unavailable".

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const FORECAST_DAYS_AHEAD = 15;

export type WeatherKind = "sun" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm";

export type MatchForecast =
  | { kind: "past" }
  | { kind: "too-far" }
  | { kind: "unavailable" }
  | {
      kind: "ok";
      label: string;
      icon: WeatherKind;
      tempF: number;
      precipPct: number | null;
      windMph: number | null;
      hiF: number | null;
      loF: number | null;
    };

/** WMO weather codes → label and icon. https://open-meteo.com/en/docs */
function describe(code: number): { label: string; icon: WeatherKind } {
  if (code === 0) return { label: "Clear", icon: "sun" };
  if (code === 1) return { label: "Mostly clear", icon: "sun" };
  if (code === 2) return { label: "Partly cloudy", icon: "partly" };
  if (code === 3) return { label: "Overcast", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "rain" };
  if (code >= 61 && code <= 67) return { label: "Rain", icon: "rain" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "snow" };
  if (code >= 80 && code <= 82) return { label: "Showers", icon: "rain" };
  if (code === 85 || code === 86) return { label: "Snow showers", icon: "snow" };
  if (code >= 95) return { label: "Thunderstorms", icon: "storm" };
  return { label: "Forecast", icon: "cloud" };
}

const series = z.array(z.number().nullable());
const responseSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: series,
    precipitation_probability: series,
    weather_code: series,
    wind_speed_10m: series,
  }),
  daily: z.object({
    temperature_2m_max: series,
    temperature_2m_min: series,
  }),
});

type Hourly = Omit<Extract<MatchForecast, { kind: "ok" }>, "kind">;

/**
 * Cached per venue, day and hour. A failed fetch is cached only briefly, so an outage
 * doesn't stick for hours, and the forecast refreshes a few times a day.
 */
async function fetchForecast(lat: number, lon: number, date: string, hour: string): Promise<Hourly | null> {
  "use cache";
  try {
    const params = new URLSearchParams({
      latitude: lat.toFixed(3),
      longitude: lon.toFixed(3),
      hourly: "temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
      daily: "temperature_2m_max,temperature_2m_min",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: TEAM_TIME_ZONE,
      start_date: date,
      end_date: date,
    });
    const response = await fetch(`${FORECAST_URL}?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { hourly, daily } = responseSchema.parse(await response.json());

    const i = hourly.time.indexOf(hour);
    const temp = hourly.temperature_2m[i];
    const code = hourly.weather_code[i];
    if (i < 0 || temp == null || code == null) throw new Error(`no data for ${hour}`);

    cacheLife("hours");
    const round = (n: number | null | undefined) => (n == null ? null : Math.round(n));
    return {
      ...describe(code),
      tempF: Math.round(temp),
      precipPct: round(hourly.precipitation_probability[i]),
      windMph: round(hourly.wind_speed_10m[i]),
      hiF: round(daily.temperature_2m_max[0]),
      loF: round(daily.temperature_2m_min[0]),
    };
  } catch (error) {
    console.warn("[weather] forecast unavailable:", error instanceof Error ? error.message : error);
    cacheLife("minutes");
    return null;
  }
}

/** Whole days from today to the match day, both in team time. */
function daysUntil(startsAt: string, now: Date) {
  const day = (key: string) => Date.parse(`${key}T00:00:00Z`);
  return Math.round((day(teamDateKey(startsAt)) - day(teamDateKey(now.toISOString()))) / 86_400_000);
}

export async function getMatchForecast({
  lat,
  lon,
  startsAt,
}: {
  lat: number | null;
  lon: number | null;
  startsAt: string;
}): Promise<MatchForecast> {
  await connection();
  const days = daysUntil(startsAt, new Date());
  if (days < 0) return { kind: "past" };
  if (days > FORECAST_DAYS_AHEAD) return { kind: "too-far" };

  const local = isoToTeamLocalInput(startsAt); // "2026-10-24T10:00"
  const hour = `${local.slice(0, 13)}:00`;
  const forecast = await fetchForecast(lat ?? STAMFORD.lat, lon ?? STAMFORD.lon, local.slice(0, 10), hour);
  return forecast ? { kind: "ok", ...forecast } : { kind: "unavailable" };
}
