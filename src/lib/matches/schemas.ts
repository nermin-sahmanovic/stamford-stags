import { z } from "zod";
import { teamLocalInputToIso } from "@/lib/format";

// Match, results, checklist and availability input. Shared by server actions and client forms.

export const HOME_AWAY = ["home", "away"] as const;
export const MATCH_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export const AVAILABILITY = ["available", "maybe", "unavailable"] as const;
export const LINE_OUTCOMES = ["won", "lost", "none"] as const;

export const STATUS_LABELS = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled" } as const;

/** Starting checklist for a new match, from the approved prototype. Captains edit it per match. */
export const DEFAULT_CHECKLIST = [
  "Lineup posted and confirmed",
  "Courts reserved",
  "New balls for each court",
  "Scorecards printed",
  "Water and towels",
  "Report scores to USTA",
];

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? null : value));

export const matchFormSchema = z.object({
  opponent: z.string().trim().min(1, "Enter the opponent.").max(80, "Keep the opponent under 80 characters."),
  starts_at: z
    .string()
    .trim()
    .min(1, "Enter the date and start time.")
    .transform((value, ctx) => {
      const iso = teamLocalInputToIso(value);
      if (!iso) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date and start time." });
        return z.NEVER;
      }
      return iso;
    }),
  home_away: z.enum(HOME_AWAY, { message: "Choose home or away." }),
  location_name: optionalText(120, "Venue"),
  location_address: optionalText(200, "Address"),
  captain_notes: optionalText(1000, "Notes"),
  status: z.enum(MATCH_STATUSES, { message: "Choose a status." }),
});

export type MatchFormInput = z.output<typeof matchFormSchema>;

export const checklistLabelSchema = z
  .string()
  .trim()
  .min(1, "Enter a checklist item.")
  .max(120, "Keep checklist items under 120 characters.");

const points = z.coerce
  .number({ message: "Enter a number." })
  .int("Enter a whole number.")
  .min(0, "Points can't be negative.")
  .max(20, "That's more points than lines.");

export const resultsSchema = z.object({
  lines: z
    .array(
      z.object({
        line_type: z.enum(["singles", "doubles"]),
        line_number: z.number().int().min(1).max(5),
        outcome: z.enum(LINE_OUTCOMES),
        score: z.string().trim().max(40, "Keep scores under 40 characters."),
      }),
    )
    .max(10),
  team_points: points,
  opponent_points: points,
});

export const availabilityInputSchema = z.object({
  matchId: z.guid(),
  status: z.enum(AVAILABILITY).nullable(),
});

/** Result of a server action called from code rather than a form post. */
export type ActionResult = { ok: true } | { ok: false; message: string };
