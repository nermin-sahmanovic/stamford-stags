"use client";

import { useRef, useState, useTransition } from "react";
import { CameraIcon, CheckIcon } from "@/components/shell/icons";
import { fieldClass, inputClass } from "@/components/ui";
import { formatShortDate } from "@/lib/format";
import { MAX_UPLOAD_BYTES } from "@/lib/photos/schema";
import { uploadPhoto } from "./actions";

/** Long edge sent to the server. Phone photos are 4000px+ and 3–12 MB; this keeps uploads ~1 MB. */
const MAX_EDGE = 2560;

type MatchOption = { id: string; label: string; startsAt: string };
type Item = { name: string; state: "waiting" | "uploading" | "done" | "failed"; message?: string };

/**
 * Shrinks a photo in the browser (respecting its EXIF rotation) and re-encodes it as JPEG.
 * Canvas output carries no EXIF/GPS. The server re-encodes again, so this is for upload speed.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

/** Formats the server can read when the browser can't decode a file itself. */
const SERVER_READABLE = ["image/jpeg", "image/png", "image/webp"];

export function PhotoUploader({ matches }: { matches: MatchOption[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [pending, startTransition] = useTransition();

  const update = (index: number, patch: Partial<Item>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  function submit(formData: FormData) {
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) {
      setItems([{ name: "No photo chosen", state: "failed", message: "Choose one or more photos first." }]);
      return;
    }
    setItems(files.map((file) => ({ name: file.name, state: "waiting" })));

    startTransition(async () => {
      let allDone = true;
      // One at a time: phones on cell data do better with small sequential requests.
      for (const [index, file] of files.entries()) {
        update(index, { state: "uploading" });
        let blob: Blob;
        try {
          blob = await shrink(file);
        } catch {
          if (!SERVER_READABLE.includes(file.type) || file.size > MAX_UPLOAD_BYTES) {
            update(index, { state: "failed", message: "This photo format isn't supported. Try a JPEG or PNG." });
            allDone = false;
            continue;
          }
          blob = file;
        }

        const body = new FormData();
        body.set("file", blob, "photo.jpg");
        body.set("caption", String(formData.get("caption") ?? ""));
        body.set("match_id", String(formData.get("match_id") ?? ""));
        if (formData.get("is_public") === "on") body.set("is_public", "on");
        try {
          const result = await uploadPhoto(body);
          if (result.ok) update(index, { state: "done" });
          else {
            update(index, { state: "failed", message: result.message });
            allDone = false;
          }
        } catch {
          update(index, { state: "failed", message: "Upload failed. Check your connection and try again." });
          allDone = false;
        }
      }
      if (allDone) form.current?.reset();
    });
  }

  return (
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
      className="flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-4">
      <h2 className="font-display text-[22px] leading-tight font-bold tracking-[0.03em] uppercase">Add photos</h2>

      <label className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[12px] border-[1.5px] border-dashed border-slate-300 bg-ground px-3 py-4 text-center text-[15px] font-semibold text-navy focus-within:outline-2 focus-within:outline-court hover:border-court">
        <CameraIcon size={26} />
        Choose photos or take one
        <span className="text-[13px] font-normal text-slate-600">
          Resized before upload. Location and camera details are removed.
        </span>
        <input type="file" name="files" accept="image/*" multiple className="sr-only" />
      </label>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Caption (optional)
        <input type="text" name="caption" maxLength={200} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        Match (optional)
        <select name="match_id" defaultValue="" className={`${fieldClass} h-12`}>
          <option value="">No match</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {formatShortDate(m.startsAt)} · {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-h-11 items-start gap-3 text-[15px]">
        <input type="checkbox" name="is_public" className="mt-0.5 size-5 accent-navy" />
        <span>
          <span className="block font-semibold">Public</span>
          <span className="block text-[13px] text-slate-600">
            Off: only players see it. On: it can appear on the home page and public gallery.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-[12px] bg-navy text-[16px] font-bold text-white hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>

      {items.length > 0 ? (
        <ul aria-live="polite" className="flex flex-col gap-1.5 text-[14px]">
          {items.map((item, i) => (
            <li key={`${item.name}-${i}`} className="flex items-start gap-2">
              <span className="w-24 shrink-0 font-semibold">
                {item.state === "done" ? (
                  <span className="flex items-center gap-1 text-blue-700">
                    <CheckIcon size={16} /> Uploaded
                  </span>
                ) : item.state === "failed" ? (
                  <span className="text-warn">Failed</span>
                ) : item.state === "uploading" ? (
                  "Uploading…"
                ) : (
                  <span className="text-slate-500">Waiting</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.name}</span>
                {item.message ? <span className="block text-[13px] text-warn">{item.message}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
