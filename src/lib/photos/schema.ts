import { z } from "zod";

/** The browser shrinks photos to ~2560px JPEG first; this leaves room for when it can't. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const photoCaptionSchema = z
  .string()
  .trim()
  .max(200, "Keep captions under 200 characters.")
  .transform((value) => (value === "" ? null : value));

export const photoUploadSchema = z.object({
  file: z
    .instanceof(File, { message: "Choose a photo." })
    .refine((file) => file.size > 0, "Choose a photo.")
    .refine((file) => file.type.startsWith("image/"), "That file isn't a photo."),
  caption: photoCaptionSchema,
  match_id: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.guid({ message: "Choose a match from the list." }).nullable()),
  is_public: z.boolean(),
});
