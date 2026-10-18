import "server-only";
import type { CalendarItem, EventType } from "@/lib/calendar/items";
import { readClient } from "@/lib/supabase/read";

const COLUMNS = "id, type, title, starts_at, ends_at, location, description, is_public";

type EventRow = {
  id: string;
  type: EventType;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  description: string | null;
  is_public: boolean;
};

const toItem = (e: EventRow): CalendarItem => ({
  id: e.id,
  kind: e.type,
  title: e.title,
  startsAt: e.starts_at,
  endsAt: e.ends_at,
  location: e.location,
  homeAway: null,
  status: null,
  teamPoints: null,
  opponentPoints: null,
  description: e.description,
  isPublic: e.is_public,
  href: `/captain/events/${e.id}`,
});

/** Captain list: upcoming soonest first, past most recent first. */
export async function getCaptainEvents() {
  const supabase = await readClient();
  const now = new Date().toISOString();
  const [upcoming, past] = await Promise.all([
    supabase.from("events").select(COLUMNS).gte("starts_at", now).order("starts_at"),
    supabase.from("events").select(COLUMNS).lt("starts_at", now).order("starts_at", { ascending: false }).limit(30),
  ]);
  if (upcoming.error) throw upcoming.error;
  if (past.error) throw past.error;
  return { upcoming: upcoming.data.map(toItem), past: past.data.map(toItem) };
}

export async function getEvent(id: string) {
  const supabase = await readClient();
  const { data, error } = await supabase.from("events").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    if (error.code === "22P02") return null; // not a uuid
    throw error;
  }
  return data;
}
