// One-time production setup: creates the current season (1 singles + 3 doubles) and the captain's
// players row. Production never gets seed.sql; the rest of the roster comes in through the CSV importer.
//
//   npm run prod-setup -- --confirm-ref <prod-ref> --season-name "Spring 2027" --ntrp 3.5 \
//     --max-roster 16 --playoff-min 2 --captain-name "Your Name" [--dry-run]
//
// Optional: --league --division --age-group --min-ntrp --starts YYYY-MM-DD --ends YYYY-MM-DD
//           --captain-email (default sahmanovic@gmail.com) --captain-phone --captain-ntrp
//
// Refuses unless the CLI is linked to the project named by --confirm-ref, and never on Stags-Dev.
// Safe to re-run: an existing current season is left alone (and reported), and the captain row is
// upserted by email. The captain signs in with a magic link; a trigger links the auth user by email.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { DEV_PROJECT_REF, linkedRef, queryLinkedFile } from "./linked-ref.mjs";

function fail(message) {
  console.error(`prod-setup: ${message}`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    "confirm-ref": { type: "string" },
    "season-name": { type: "string" },
    league: { type: "string" },
    division: { type: "string" },
    "age-group": { type: "string" },
    ntrp: { type: "string" },
    "min-ntrp": { type: "string" },
    "max-roster": { type: "string" },
    "playoff-min": { type: "string" },
    starts: { type: "string" },
    ends: { type: "string" },
    "captain-name": { type: "string" },
    "captain-email": { type: "string", default: "sahmanovic@gmail.com" },
    "captain-phone": { type: "string" },
    "captain-ntrp": { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const text = (max) => z.string().trim().min(1).max(max);
const rating = (min, max) => z.coerce.number().multipleOf(0.5).min(min).max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

const schema = z
  .object({
    "confirm-ref": z.string().regex(/^[a-z0-9]{20}$/, "a 20-character project ref"),
    "season-name": text(80),
    league: text(80).optional(),
    division: text(80).optional(),
    "age-group": text(20).optional(),
    ntrp: rating(2, 6),
    "min-ntrp": rating(2, 6).optional(),
    "max-roster": z.coerce.number().int().min(1).max(100),
    "playoff-min": z.coerce.number().int().min(0).max(30),
    starts: date.optional(),
    ends: date.optional(),
    "captain-name": z.string().trim().min(2).max(120),
    "captain-email": z.email(),
    "captain-phone": text(30).optional(),
    "captain-ntrp": rating(1, 7).optional(),
  })
  .refine((v) => v["min-ntrp"] === undefined || v["min-ntrp"] <= v.ntrp, "--min-ntrp must be at most --ntrp")
  .refine((v) => !v.starts || !v.ends || v.ends >= v.starts, "--ends must be on or after --starts");

const parsed = schema.safeParse(values);
if (!parsed.success) {
  fail(`invalid arguments:\n${parsed.error.issues.map((i) => `  --${i.path.join(".") || "args"}: ${i.message}`).join("\n")}`);
}
const v = parsed.data;

// Values are validated above; quote them as SQL literals (standard_conforming_strings is on).
const lit = (value) =>
  value === undefined ? "null" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
const email = v["captain-email"].toLowerCase();

const sql = `
begin;

insert into public.seasons (name, league, division, age_group, ntrp_level, min_ntrp,
                            singles_lines, doubles_lines, max_roster, playoff_min_matches,
                            starts_on, ends_on, is_current)
select ${lit(v["season-name"])}, ${lit(v.league)}, ${lit(v.division)}, ${lit(v["age-group"])}, ${lit(v.ntrp)}, ${lit(v["min-ntrp"])},
       1, 3, ${lit(v["max-roster"])}, ${lit(v["playoff-min"])},
       ${lit(v.starts)}::date, ${lit(v.ends)}::date, true
where not exists (select 1 from public.seasons where is_current);

insert into public.players (full_name, email, phone, ntrp_rating, role, is_active)
values (${lit(v["captain-name"])}, ${lit(email)}, ${lit(v["captain-phone"])}, ${lit(v["captain-ntrp"])}, 'captain', true)
on conflict ((lower(email))) do update
  set full_name = excluded.full_name,
      phone = coalesce(excluded.phone, players.phone),
      ntrp_rating = coalesce(excluded.ntrp_rating, players.ntrp_rating),
      role = 'captain',
      is_active = true;

select
  (select json_build_object('name', name, 'ntrp_level', ntrp_level, 'min_ntrp', min_ntrp,
                            'lines', singles_lines || 'S + ' || doubles_lines || 'D', 'max_roster', max_roster,
                            'playoff_min_matches', playoff_min_matches, 'starts_on', starts_on, 'ends_on', ends_on)
     from public.seasons where is_current) as current_season,
  (select json_build_object('full_name', full_name, 'email', email, 'role', role, 'is_active', is_active,
                            'signed_in_before', user_id is not null)
     from public.players where lower(email) = ${lit(email)}) as captain,
  (select count(*) from public.players) as player_count;

commit;
`;

// --dry-run only prints the SQL, so it works whatever is linked.
if (values["dry-run"]) {
  console.log(sql);
  process.exit(0);
}

const ref = linkedRef();
if (ref === DEV_PROJECT_REF) fail("the CLI is linked to Stags-Dev. This script is for production only.");
if (ref !== v["confirm-ref"]) {
  fail(`the CLI is linked to ${ref ?? "nothing"}, not ${v["confirm-ref"]}. Run: npx supabase link --project-ref ${v["confirm-ref"]}`);
}

const file = join(mkdtempSync(join(tmpdir(), "stags-prod-setup-")), "setup.sql");
writeFileSync(file, sql);
const { json, raw } = queryLinkedFile(file);
if (!json) fail(`no result from the CLI:\n${raw}`);
if (json.error) fail(`the setup failed and was rolled back:\n${json.error.message}`);

const row = json.rows?.[0];
const season = typeof row?.current_season === "string" ? JSON.parse(row.current_season) : row?.current_season;
if (season && season.name !== v["season-name"]) {
  console.warn(`prod-setup: a current season already existed ("${season.name}"), so no season was added.`);
}
console.log(JSON.stringify(row, null, 2));
