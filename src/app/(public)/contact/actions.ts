"use server";

import { z } from "zod";
import { sendEmail, teamMailbox } from "@/lib/email/send";
import { echoValues, firstFieldErrors, type FormState } from "@/lib/form-state";
import { isHoneypotFilled, verifyTurnstile } from "@/lib/spam";
import { CONTACT_TOPICS } from "./topics";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120, "Name is too long."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  topic: z.enum(CONTACT_TOPICS.map((t) => t.value) as [string, ...string[]], {
    message: "Choose a topic.",
  }),
  message: z
    .string()
    .trim()
    .min(10, "Add a little more detail.")
    .max(4000, "Message must be 4,000 characters or fewer."),
});

export async function sendContactMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isHoneypotFilled(formData)) return { status: "success" };

  const values = echoValues(formData);
  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    topic: formData.get("topic") ?? "",
    message: formData.get("message") ?? "",
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

  const { name, email, topic, message } = parsed.data;
  const topicLabel = CONTACT_TOPICS.find((t) => t.value === topic)?.label ?? topic;
  // Goes to the team mailbox, so the public site never reads player emails.
  const result = await sendEmail({
    to: teamMailbox(),
    replyTo: email,
    subject: `[Website] ${topicLabel} — ${name}`,
    text: `From: ${name} <${email}>\nTopic: ${topicLabel}\n\n${message}`,
  });
  if (!result.ok) {
    return {
      status: "error",
      message: "Your message couldn't be sent. Please try again later.",
      fieldErrors: {},
      values,
    };
  }

  return { status: "success" };
}
