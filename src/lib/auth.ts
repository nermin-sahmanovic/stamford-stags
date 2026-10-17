import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type MemberRole = Database["public"]["Enums"]["member_role"];

export type AuthUser = { id: string; email: string | null };

export type CurrentPlayer = {
  id: string;
  fullName: string;
  email: string;
  role: MemberRole;
  isCaptain: boolean;
};

export function isCaptainRole(role: MemberRole) {
  return role === "captain" || role === "co_captain";
}

type Session = { user: AuthUser | null; player: CurrentPlayer | null };

/**
 * Reads the session cookie, verifies the JWT and looks up the roster row.
 *
 * "use cache: private" because supabase-js compares the token expiry with
 * Date.now(), which Cache Components won't allow in a prerender or prefetch
 * (see node_modules/next/dist/docs/01-app/02-guides/optimizing-prefetching.md).
 * The result is cached only in this visitor's browser, for the default
 * 5-minute stale time; signOut() clears it.
 */
async function readSession(): Promise<Session> {
  "use cache: private";

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims.sub) return { user: null, player: null };
  const user = { id: claims.claims.sub, email: claims.claims.email ?? null };

  // RLS only returns the row to active members, so null means "not on the roster".
  const { data, error } = await supabase
    .from("players")
    .select("id, full_name, email, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { user, player: null };

  return {
    user,
    player: {
      id: data.id,
      fullName: data.full_name,
      email: data.email,
      role: data.role,
      isCaptain: isCaptainRole(data.role),
    },
  };
}

const getSession = cache(readSession);

/** The signed-in auth user, from a verified JWT. Null when signed out. */
export async function getAuthUser(): Promise<AuthUser | null> {
  return (await getSession()).user;
}

/** The signed-in user's active roster row. Null when signed out or not on the roster. */
export async function getCurrentPlayer(): Promise<CurrentPlayer | null> {
  return (await getSession()).player;
}

/** For pages in (member): signed in and on the active roster. */
export async function requireMember(): Promise<CurrentPlayer> {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");
  const player = await getCurrentPlayer();
  if (!player) redirect("/not-on-roster");
  return player;
}

/** For pages in (captain): an active captain or co-captain. */
export async function requireCaptain(): Promise<CurrentPlayer> {
  const player = await requireMember();
  if (!player.isCaptain) redirect("/matches");
  return player;
}

const ROLE_LABELS: Record<MemberRole, string> = { captain: "Captain", co_captain: "Co-captain", player: "Player" };

export type Viewer = {
  signedIn: boolean;
  isCaptain: boolean;
  /** Roster name; null when signed out or signed in but not on the roster. */
  name: string | null;
  email: string | null;
  roleLabel: string | null;
};

/** What the nav needs to know, including who is signed in. */
export async function getViewer(): Promise<Viewer> {
  const { user, player } = await getSession();
  return {
    signedIn: user !== null,
    isCaptain: player?.isCaptain ?? false,
    name: player?.fullName ?? null,
    email: player?.email ?? user?.email ?? null,
    roleLabel: player ? ROLE_LABELS[player.role] : null,
  };
}
