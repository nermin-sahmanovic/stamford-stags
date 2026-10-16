// Runs supabase/tests/rls.sql against the linked Supabase project without Docker.
//
// `supabase test db` needs Docker (it runs pg_prove in a container). `supabase db query --linked`
// does not, but it only returns the last result set. So we capture each assertion's TAP line
// into a temp table and swap the closing finish() for a report; the transaction still ends in ROLLBACK.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = readFileSync("supabase/tests/rls.sql", "utf8");
const plan = /^select plan\(\d+\);$/m;
const finish = "select * from finish();";
if (!plan.test(source) || !source.includes(finish)) {
  throw new Error(`rls.sql must contain "select plan(N);" and "${finish}"`);
}

// Assertions run as anon/authenticated, so the capture table is open to everyone (it's temporary).
const capture = `$&
create temp table stags_tap (n serial, line text);
grant all on stags_tap to public;
grant all on sequence stags_tap_n_seq to public;`;
const report = `select line, _get('plan') as planned, num_failed() as failed from stags_tap order by n;`;
const script = source
  .replace(plan, capture)
  .replace(/^select (is|ok|lives_ok|throws_ok)\(/gm, "insert into stags_tap (line) select $1(")
  .replace(finish, report);

const file = join(mkdtempSync(join(tmpdir(), "stags-rls-")), "rls.sql");
writeFileSync(file, script);

let outputs;
try {
  const stdout = execFileSync("npx", ["supabase", "db", "query", "--linked", "-f", file], {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  outputs = [stdout];
} catch (err) {
  outputs = [err.stdout ?? "", err.stderr ?? ""];
}

// The CLI prints one JSON object (rows or error) amid status lines like "Initialising login role...".
const json = outputs
  .flatMap((text) => text.split(/\r?\n(?=\{)/))
  .map((chunk) => chunk.slice(chunk.indexOf("{")).replace(/\}[^}]*$/, "}"))
  .map((chunk) => { try { return JSON.parse(chunk); } catch { return null; } })
  .find(Boolean);
if (!json) {
  console.error(outputs.join("\n"));
  process.exit(1);
}
if (json.error) {
  console.error(`Test run failed before reporting:\n${json.error.message}`);
  process.exit(1);
}

const rows = json.rows ?? [];
const planned = Number(rows[0]?.planned ?? 0);
const failed = Number(rows[0]?.failed ?? 0);
console.log(`1..${planned}`);
for (const r of rows) console.log(r.line);

if (rows.length !== planned) console.log(`# Planned ${planned} tests but ran ${rows.length}`);
console.log(failed ? `# Failed ${failed} of ${rows.length}` : `# All ${rows.length} passed (rolled back)`);
process.exit(failed || rows.length !== planned ? 1 : 0);
