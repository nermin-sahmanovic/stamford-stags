"use server";

import { z } from "zod";
import { echoValues, firstFieldErrors, type FormState } from "@/lib/form-state";
import { isHoneypotFilled, verifyTurnstile } from "@/lib/spam";
import { createPublicClient } from "@/lib/supabase/public";
import { AVAILABILITY_SLOTS, NTRP_OPTIONS } from "./options";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

// Mirrors the checks on public.registrations.
const schema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Enter your first and last name.")
    .max(120, "Name is too long."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  phone: optionalText(40, "Phone number is too long."),
  usta_number: optionalText(20, "USTA number is too long.").refine(
    (v) => v === null || /^[0-9 -]+$/.test(v),
    "Use digits only.",
  ),
  ntrp_rating: z.enum(NTRP_OPTIONS, { message: "Select your NTRP rating." }),
  position_pref: z.enum(["singles", "doubles", "both"], { message: "Choose a position." }),
  availability_slots: z.array(z.enum(AVAILABILITY_SLOTS)).max(AVAILABILITY_SLOTS.length),
  notes: optionalText(2000, "Notes must be 2,000 characters or fewer."),
});

export async function submitRegistration(_prev: FormState, formData: FormData): Promise<FormState> {
  // Bots that fill the hidden field get the normal success screen and nothing is saved.
  if (isHoneypotFilled(formData)) return { status: "success" };

  const values = echoValues(formData, ["availability_slots"]);
  const parsed = schema.safeParse({
    full_name: formData.get("full_name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    usta_number: formData.get("usta_number") ?? "",
    ntrp_rating: formData.get("ntrp_rating") ?? "",
    position_pref: formData.get("position_pref") ?? "both",
    availability_slots: formData.getAll("availability_slots"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values,
    };
  }

  if (!(await verifyTurnstile(formData))) {
    return {
      status: "error",
      message: "We couldn't confirm you're not a robot. Wait for the check to finish and try again.",
      fieldErrors: {},
      values,
    };
  }

  // Anonymous insert: RLS allows only a pending, unreviewed row and no read-back,
  // so there is deliberately no .select() here.
  const { error } = await createPublicClient()
    .from("registrations")
    .insert({ ...parsed.data, ntrp_rating: Number(parsed.data.ntrp_rating) });
  if (error) {
    console.error("[join] registration insert failed:", error.message);
    return {
      status: "error",
      message: "Something went wrong saving your application. Please try again.",
      fieldErrors: {},
      values,
    };
  }

  return { status: "success" };
}
