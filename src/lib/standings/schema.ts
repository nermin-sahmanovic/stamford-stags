import { z } from "zod";

// Manually maintained league table. The captain copies it from the USTA site; nothing is computed.

const count = (label: string) =>
  z.coerce
    .number({ message: `Enter ${label}.` })
    .int(`${label} must be a whole number.`)
    .min(0, `${label} can't be negative.`)
    .max(999, `${label} looks too high.`);

export const standingRowSchema = z.object({
  rank: z.coerce.number({ message: "Enter a rank." }).int("Rank must be a whole number.").min(1, "Rank starts at 1.").max(99),
  team_name: z.string().trim().min(1, "Enter the team name.").max(60, "Keep team names under 60 characters."),
  wins: count("Wins"),
  losses: count("Losses"),
  lines_won: count("Lines won"),
  lines_lost: count("Lines lost"),
  is_stags: z.boolean(),
});

export const standingsSchema = z
  .array(standingRowSchema)
  .max(30, "That's more teams than a flight has.")
  .refine((rows) => rows.filter((r) => r.is_stags).length <= 1, { message: "Only one row can be the Stags." })
  .refine((rows) => new Set(rows.map((r) => r.team_name.trim().toLowerCase())).size === rows.length, {
    message: "Each team can only be listed once.",
  });

export type StandingRowInput = z.input<typeof standingRowSchema>;
