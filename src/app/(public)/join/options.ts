// Choices on the Join form, shared by the form and its server action.

export const NTRP_OPTIONS = ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"] as const;

export const POSITION_OPTIONS = [
  { value: "singles", label: "Singles" },
  { value: "doubles", label: "Doubles" },
  { value: "both", label: "Both" },
] as const;

export const AVAILABILITY_SLOTS = ["Weeknights", "Sat AM", "Sat PM", "Sun AM", "Sun PM"] as const;
