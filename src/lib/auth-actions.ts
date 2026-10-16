"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Drop the browser's cached session reads (auth.ts) so the nav updates at once.
  revalidatePath("/", "layout");
  redirect("/");
}
