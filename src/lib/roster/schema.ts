import { z } from "zod";

// Roster validation shared by the CSV import preview (client), the captain's player form
// and the server actions. No server-only imports here. Mirrors the checks on public.players.

export const POSITIONS = ["singles", "doubles", "both"] as const;
export const ROLES = ["player", "co_captain", "captain"] as const;

export const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  player: "Player",
  co_captain: "Co-captain",
  captain: "Captain",
};

/** Ratings the player form and bulk edit offer. Imports accept any 1.0–7.0 value. */
export const RATING_OPTIONS = ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"] as const;

/**
 * Trims a CSV cell and undoes the export's formula escaping: papaparse's escapeFormulae
 * prefixes cells starting with = + - @ tab or CR with an apostrophe.
 */
export function cleanCell(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^'(?=[=+\-@\t\r])/, "");
}

const blankToNull = (value: unknown) => {
  const text = cleanCell(value);
  return text === "" ? null : text;
};

const fullName = z.preprocess(
  cleanCell,
  z.string().min(2, "Enter a first and last name.").max(120, "Name is too long."),
);

const email = z.preprocess(
  cleanCell,
  z.string().min(1, "Email is required.").toLowerCase().pipe(z.email("Enter a valid email address.")),
);

const phone = z.preprocess(blankToNull, z.string().max(40, "Phone number is too long.").nullable());

const ustaNumber = z.preprocess(
  blankToNull,
  z
    .string()
    .max(20, "USTA number is too long.")
    .regex(/^[0-9 -]+$/, "USTA number must be digits.")
    .nullable(),
);

export const ratingSchema = z.preprocess(
  blankToNull,
  z
    .string()
    .regex(/^\d(\.\d)?$/, "NTRP must be a number like 3.5.")
    .transform(Number)
    .refine((n) => n >= 1 && n <= 7, "NTRP must be between 1.0 and 7.0.")
    .nullable(),
);

const position = z.preprocess(
  (v) => blankToNull(v)?.toLowerCase() ?? null,
  z.enum(POSITIONS, { message: "Position must be singles, doubles or both." }).nullable(),
);

const TRUE_WORDS = ["yes", "y", "true", "1", "active"];
const FALSE_WORDS = ["no", "n", "false", "0", "inactive"];

const active = z.preprocess((v) => {
  const text = blankToNull(v)?.toLowerCase() ?? null;
  if (text === null) return null;
  if (TRUE_WORDS.includes(text)) return true;
  if (FALSE_WORDS.includes(text)) return false;
  return text;
}, z.boolean({ message: "Active must be yes or no." }).nullable());

/**
 * One CSV row after column mapping. Blank optional cells are null, which the import
 * treats as "keep the existing value" for players already on the roster.
 */
export const importRowSchema = z.object({
  full_name: fullName,
  email,
  phone,
  usta_number: ustaNumber,
  ntrp_rating: ratingSchema,
  position_pref: position,
  is_active: active,
});

export type ImportRow = z.infer<typeof importRowSchema>;

/** The captain's add/edit form. Active status changes through its own action. */
export const playerFormSchema = z.object({
  full_name: fullName,
  email,
  phone,
  usta_number: ustaNumber,
  ntrp_rating: ratingSchema,
  position_pref: z.enum(POSITIONS, { message: "Choose a position." }),
  role: z.enum(ROLES, { message: "Choose a role." }),
});

export type PlayerFormInput = z.infer<typeof playerFormSchema>;

/** What a player can change about themselves (update_my_profile). */
export const myProfileSchema = z.object({
  phone,
  position_pref: z.enum(POSITIONS, { message: "Choose a position." }),
});

export type RawImportRow = { rowNumber: number; values: Record<string, string> };

export type ImportIssue = { rowNumber: number; email: string; reasons: string[] };

export const MAX_IMPORT_ROWS = 500;

/**
 * Validates mapped rows. A repeated email is an error on the later row, so each
 * email is upserted at most once. Used by the preview and again by the server action.
 */
export function validateImportRows(rows: RawImportRow[]) {
  const valid: { rowNumber: number; data: ImportRow }[] = [];
  const invalid: ImportIssue[] = [];
  const seen = new Map<string, number>();

  for (const row of rows) {
    const parsed = importRowSchema.safeParse(row.values);
    const rawEmail = cleanCell(row.values.email).toLowerCase();
    if (!parsed.success) {
      invalid.push({
        rowNumber: row.rowNumber,
        email: rawEmail,
        reasons: [...new Set(parsed.error.issues.map((issue) => issue.message))],
      });
      continue;
    }
    const first = seen.get(parsed.data.email);
    if (first !== undefined) {
      invalid.push({
        rowNumber: row.rowNumber,
        email: parsed.data.email,
        reasons: [`Same email as row ${first}.`],
      });
      continue;
    }
    seen.set(parsed.data.email, row.rowNumber);
    valid.push({ rowNumber: row.rowNumber, data: parsed.data });
  }

  return { valid, invalid };
}

export type ImportResult =
  | {
      ok: true;
      created: number;
      updated: number;
      unchanged: number;
      skipped: ImportIssue[];
    }
  | { ok: false; message: string };
