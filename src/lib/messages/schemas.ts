import { z } from "zod";

// Compose input, shared by the compose form and POST /api/messages.

export const AUDIENCES = ["team", "match", "custom"] as const;

export const AUDIENCE_LABELS: Record<(typeof AUDIENCES)[number], string> = {
  team: "Entire team",
  match: "Match participants",
  custom: "Selected players",
};

export const composeSchema = z
  .object({
    audience: z.enum(AUDIENCES, { message: "Choose who gets it." }),
    matchId: z.guid().nullable().default(null),
    playerIds: z.array(z.guid()).max(100).default([]),
    subject: z.string().trim().min(1, "Add a subject.").max(150, "Keep the subject under 150 characters."),
    body: z.string().trim().min(1, "Write a message.").max(5000, "Keep the message under 5,000 characters."),
  })
  .refine((v) => v.audience !== "match" || v.matchId !== null, {
    message: "Choose the match.",
    path: ["matchId"],
  })
  .refine((v) => v.audience !== "custom" || v.playerIds.length > 0, {
    message: "Choose at least one player.",
    path: ["playerIds"],
  });

export type ComposeInput = z.input<typeof composeSchema>;
