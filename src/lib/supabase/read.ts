import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Client for per-visitor reads, rendered at request time: supabase-js reads Date.now() when it
 * checks the session, which Cache Components rejects during a prerender.
 */
export async function readClient() {
  await connection();
  return createClient();
}
