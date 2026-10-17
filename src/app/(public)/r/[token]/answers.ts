// Answers a one-tap email link can carry (?s=...). Safe on client and server.

export const AVAILABILITY_ANSWERS = ["available", "maybe", "unavailable"] as const;
export const LINEUP_ANSWERS = ["confirmed", "declined"] as const;
export const RSVP_ANSWERS = [...AVAILABILITY_ANSWERS, ...LINEUP_ANSWERS] as const;

export type RsvpAnswer = (typeof RSVP_ANSWERS)[number];

export const ANSWER_LABELS: Record<RsvpAnswer, string> = {
  available: "Available",
  maybe: "Maybe",
  unavailable: "Can't play",
  confirmed: "Confirmed",
  declined: "Declined",
};

export const isLineupAnswer = (answer: RsvpAnswer) => (LINEUP_ANSWERS as readonly string[]).includes(answer);
