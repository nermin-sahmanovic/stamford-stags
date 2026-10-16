import Papa from "papaparse";
import { requireCaptain } from "@/lib/auth";
import { formatIsoDate } from "@/lib/format";
import { EXPORT_COLUMNS } from "@/lib/roster/fields";
import { createClient } from "@/lib/supabase/server";

/** Captain-only roster download. Columns match what the import maps automatically. */
export async function GET() {
  await requireCaptain();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select(EXPORT_COLUMNS.join(", "))
    .order("is_active", { ascending: false })
    .order("full_name")
    .overrideTypes<Record<(typeof EXPORT_COLUMNS)[number], string | number | boolean | null>[], { merge: false }>();
  if (error) {
    console.error("[roster] export failed:", error.message);
    return new Response("Export failed", { status: 500 });
  }

  const rows = data.map((player) => ({
    ...player,
    ntrp_rating: typeof player.ntrp_rating === "number" ? player.ntrp_rating.toFixed(1) : "",
    is_active: player.is_active ? "yes" : "no",
  }));
  // escapeFormulae stops spreadsheet apps running cell text as formulas; the import undoes it.
  const csv = Papa.unparse({ fields: [...EXPORT_COLUMNS], data: rows }, { escapeFormulae: true });

  return new Response(`﻿${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stags-roster-${formatIsoDate(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
