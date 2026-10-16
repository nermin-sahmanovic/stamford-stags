// Roster CSV columns: what the import can map, and the export's header order.

export const IMPORT_FIELDS = [
  { key: "full_name", label: "Name", required: true, aliases: ["name", "full name", "player", "player name"] },
  { key: "email", label: "Email", required: true, aliases: ["email address", "e-mail"] },
  { key: "phone", label: "Phone", required: false, aliases: ["phone number", "mobile", "cell"] },
  { key: "usta_number", label: "USTA #", required: false, aliases: ["usta", "usta #", "usta number", "usta no"] },
  { key: "ntrp_rating", label: "NTRP rating", required: false, aliases: ["ntrp", "rating", "ntrp rating", "level"] },
  { key: "position_pref", label: "Position", required: false, aliases: ["position", "preferred position", "plays"] },
  { key: "is_active", label: "Active", required: false, aliases: ["active", "status"] },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];

/** Export columns. Role is included for reference; the import ignores it. */
export const EXPORT_COLUMNS = [
  "full_name",
  "email",
  "phone",
  "usta_number",
  "ntrp_rating",
  "position_pref",
  "role",
  "is_active",
] as const;

const normalize = (header: string) => header.trim().toLowerCase().replace(/[_\s]+/g, " ");

/** Best-guess mapping from CSV headers to import fields; unmatched fields map to "". */
export function autoMapColumns(headers: string[]): Record<ImportFieldKey, string> {
  const mapping = {} as Record<ImportFieldKey, string>;
  for (const field of IMPORT_FIELDS) {
    const names = [field.key, field.label, ...field.aliases].map(normalize);
    mapping[field.key] = headers.find((header) => names.includes(normalize(header))) ?? "";
  }
  return mapping;
}
