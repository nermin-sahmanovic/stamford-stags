// Helpers for scripts that run SQL through the linked Supabase CLI (`npx supabase db query --linked`).
// `npx supabase link` writes the project ref to supabase/.temp/project-ref; scripts check it first,
// so a test never runs on prod and the prod setup never runs on dev.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const DEV_PROJECT_REF = "jljyylzalwiczrimaguz"; // Stags-Dev

/** The linked project ref, or null when nothing is linked. */
export function linkedRef() {
  try {
    return readFileSync(new URL("../supabase/.temp/project-ref", import.meta.url), "utf8").trim() || null;
  } catch {
    return null;
  }
}

/** Exits unless the CLI is linked to Stags-Dev. */
export function requireDevLink(script) {
  const ref = linkedRef();
  if (ref === DEV_PROJECT_REF) return;
  console.error(
    `${script}: refusing to run. The Supabase CLI is linked to ${ref ?? "nothing"}, not Stags-Dev (${DEV_PROJECT_REF}).\n` +
      `Relink first: npx supabase link --project-ref ${DEV_PROJECT_REF}`,
  );
  process.exit(1);
}

/**
 * Runs a SQL file on the linked project. Returns the CLI's JSON ({ rows } or { error }) for the
 * last result set, or null with the raw output when none could be found.
 */
export function queryLinkedFile(file) {
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
  return { json: json ?? null, raw: outputs.join("\n") };
}
