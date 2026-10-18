import { z } from "zod";
import { teamLocalInputToIso } from "@/lib/format";

// Field schemas shared by the captain forms (matches, events).

/** Trimmed text with a length cap; blank becomes null. */
export const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? null : value));

/** A datetime-local value read as team time → ISO UTC string. */
export const teamDateTime = (required: string) =>
  z
    .string()
    .trim()
    .min(1, required)
    .transform((value, ctx) => {
      const iso = teamLocalInputToIso(value);
      if (!iso) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date and time." });
        return z.NEVER;
      }
      return iso;
    });

/** Same as teamDateTime, but blank becomes null. */
export const optionalTeamDateTime = () =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const iso = teamLocalInputToIso(value);
      if (!iso) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date and time." });
        return z.NEVER;
      }
      return iso;
    });
