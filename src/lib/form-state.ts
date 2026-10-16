import type { z } from "zod";

/** Result of a public form's server action, for useActionState. */
export type FormState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      message: string;
      fieldErrors: Record<string, string>;
      /** What was typed, so the form can show it again. */
      values: Record<string, string | string[]>;
    };

export const idleState: FormState = { status: "idle" };

/** First message per field, keyed by field name. */
export function firstFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Plain values from FormData, minus spam-control fields. */
export function echoValues(formData: FormData, multi: string[] = []) {
  const values: Record<string, string | string[]> = {};
  for (const [key, value] of formData) {
    if (key === "website" || key === "cf-turnstile-response" || key.startsWith("$")) continue;
    if (typeof value !== "string") continue;
    if (multi.includes(key)) values[key] = formData.getAll(key).map(String);
    else values[key] = value;
  }
  return values;
}
