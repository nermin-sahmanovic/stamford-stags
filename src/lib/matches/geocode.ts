import "server-only";
import { z } from "zod";

// Venue coordinates for the match-day forecast. Runs when a captain saves a match: pull a ZIP or
// town out of the free-text address and look it up with Open-Meteo's geocoder (free, no key).
// Town-level accuracy is plenty for weather. Never throws; null means "use Stamford".

export const STAMFORD = { lat: 41.0534, lon: -73.5387 } as const;

const GEOCODER = "https://geocoding-api.open-meteo.com/v1/search";
/** League opponents are local; anything farther than this is a wrong match for the name. */
const MAX_KM_FROM_STAMFORD = 200;

const STATE_NAMES: Record<string, string> = {
  CT: "Connecticut",
  NY: "New York",
  NJ: "New Jersey",
  MA: "Massachusetts",
  RI: "Rhode Island",
};

const responseSchema = z.object({
  results: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        admin1: z.string().optional(),
      }),
    )
    .optional(),
});

/** Search terms from an address like "12 Post Rd, Darien, CT 06820": ZIP first, then the town. */
export function addressCandidates(address: string) {
  const zip = /\b(\d{5})(?:-\d{4})?\s*$/.exec(address.trim())?.[1];
  const state = /\b([A-Z]{2})\s*(?:\d{5}(?:-\d{4})?)?\s*$/.exec(address.trim())?.[1];
  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // The town is the segment before "CT 06820", or the last segment without a street number.
  const stateIndex = segments.findIndex((s) => /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(s));
  const town =
    stateIndex > 0
      ? segments[stateIndex - 1]
      : segments.length > 1
        ? segments.findLast((s) => !/\d/.test(s))
        : undefined;
  const terms = [zip, town?.replace(/\s+[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/, "")].filter(
    (t): t is string => Boolean(t),
  );
  return { terms, stateName: state ? STATE_NAMES[state] : undefined };
}

function kmFromStamford(lat: number, lon: number) {
  const rad = Math.PI / 180;
  const dLat = (lat - STAMFORD.lat) * rad;
  const dLon = (lon - STAMFORD.lon) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(STAMFORD.lat * rad) * Math.cos(lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

async function lookup(term: string, stateName: string | undefined) {
  const url = `${GEOCODER}?${new URLSearchParams({ name: term, count: "10", countryCode: "US", format: "json" })}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
  if (!response.ok) return null;
  const { results = [] } = responseSchema.parse(await response.json());
  const best = results
    .filter((r) => !stateName || r.admin1 === stateName)
    .map((r) => ({ lat: r.latitude, lon: r.longitude, km: kmFromStamford(r.latitude, r.longitude) }))
    .filter((r) => r.km <= MAX_KM_FROM_STAMFORD)
    .sort((a, b) => a.km - b.km)[0];
  return best ? { lat: best.lat, lon: best.lon } : null;
}

export async function geocodeAddress(address: string | null): Promise<{ lat: number; lon: number } | null> {
  if (!address) return null;
  const { terms, stateName } = addressCandidates(address);
  for (const term of terms) {
    try {
      const hit = await lookup(term, stateName);
      if (hit) return hit;
    } catch (error) {
      console.warn("[geocode] lookup failed:", error instanceof Error ? error.message : error);
    }
  }
  return null;
}
