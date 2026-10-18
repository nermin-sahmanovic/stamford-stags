import { z } from "zod";
import { EVENT_TYPES } from "@/lib/calendar/items";
import { optionalTeamDateTime, optionalText, teamDateTime } from "@/lib/form-schemas";

// Captain event form (practice, social, USTA deadline, registration, other).

export const eventFormSchema = z
  .object({
    type: z.enum(EVENT_TYPES, { message: "Choose a type." }),
    title: z.string().trim().min(1, "Enter a title.").max(100, "Keep the title under 100 characters."),
    starts_at: teamDateTime("Enter the date and start time."),
    ends_at: optionalTeamDateTime(),
    location: optionalText(120, "Location"),
    description: optionalText(1000, "Details"),
    is_public: z.boolean(),
  })
  .refine((e) => e.ends_at === null || e.ends_at >= e.starts_at, {
    message: "The end has to be after the start.",
    path: ["ends_at"],
  });

export type EventFormInput = z.output<typeof eventFormSchema>;
