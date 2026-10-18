"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from "@/components/shell/icons";
import { Pill, inputClass } from "@/components/ui";
import { formatShortDate } from "@/lib/format";
import type { ActionResult } from "@/lib/matches/schemas";
import type { GalleryPhoto } from "@/lib/photos/sign";

export type PhotoActions = {
  setPublic: (id: string, isPublic: boolean) => Promise<ActionResult>;
  setCaption: (id: string, caption: string) => Promise<ActionResult>;
  setTeamPhoto: (id: string) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
};

/** Square thumbnails; tap one for the full photo. Captains get visibility, caption and delete controls. */
export function GalleryGrid({ photos, actions }: { photos: GalleryPhoto[]; actions?: PhotoActions }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const index = photos.findIndex((p) => p.id === openId);
  const photo = index >= 0 ? photos[index] : null;

  // A deleted photo drops out of the list; close the viewer with it.
  useEffect(() => {
    if (openId && index < 0) dialog.current?.close();
  }, [openId, index]);

  const open = (id: string) => {
    setOpenId(id);
    dialog.current?.showModal();
  };
  const step = (delta: number) => setOpenId(photos[(index + delta + photos.length) % photos.length].id);

  return (
    <>
      <ul className="grid grid-cols-3 gap-1 md:grid-cols-5 md:gap-1.5">
        {photos.map((p) => (
          <li key={p.id} className="relative">
            <button
              type="button"
              onClick={() => open(p.id)}
              aria-label={p.caption ? `Open photo: ${p.caption}` : `Open photo from ${formatShortDate(p.createdAt)}`}
              className="block aspect-square w-full overflow-hidden rounded-[8px] bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court"
            >
              <Image
                src={p.thumbUrl}
                alt={p.caption ?? ""}
                width={p.width}
                height={p.height}
                unoptimized
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
            {actions && (p.isTeamPhoto || !p.isPublic) ? (
              <span className="pointer-events-none absolute top-1 left-1">
                {p.isTeamPhoto ? <Pill tone="ball">Home</Pill> : <Pill tone="slate">Players</Pill>}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label="Photo"
        onClose={() => setOpenId(null)}
        onKeyDown={(e) => {
          if (photos.length > 1 && e.key === "ArrowRight") step(1);
          if (photos.length > 1 && e.key === "ArrowLeft") step(-1);
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-navy p-0 text-white backdrop:bg-navy"
      >
        {photo ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 px-2 py-2">
              <span className="px-2 text-[14px] text-slate-300">
                {index + 1} of {photos.length}
              </span>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                aria-label="Close"
                className="flex size-11 items-center justify-center rounded-[10px] hover:bg-navy-2"
              >
                <CloseIcon size={22} />
              </button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              <Image
                key={photo.id}
                src={photo.fullUrl}
                alt={photo.caption ?? ""}
                width={photo.width}
                height={photo.height}
                unoptimized
                className="max-h-full w-auto max-w-full object-contain"
              />
              {photos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Previous photo"
                    className="absolute left-2 flex size-11 items-center justify-center rounded-full bg-navy/70 hover:bg-navy-2"
                  >
                    <ArrowLeftIcon size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Next photo"
                    className="absolute right-2 flex size-11 items-center justify-center rounded-full bg-navy/70 hover:bg-navy-2"
                  >
                    <ArrowRightIcon size={20} />
                  </button>
                </>
              ) : null}
            </div>
            <div className="px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
              {photo.caption ? <p className="text-[15px]">{photo.caption}</p> : null}
              <p className="text-[13px] text-slate-300">
                {[photo.matchLabel, formatShortDate(photo.createdAt)].filter(Boolean).join(" · ")}
              </p>
              {actions ? <PhotoControls key={photo.id} photo={photo} actions={actions} /> : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

const darkButton =
  "h-11 rounded-[10px] border-[1.5px] px-3 text-[14px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ball disabled:opacity-60";

function PhotoControls({ photo, actions }: { photo: GalleryPhoto; actions: PhotoActions }) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [confirming, setConfirming] = useState(false);
  const [confirmingHome, setConfirmingHome] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(result.message);
      } catch {
        setError("Couldn't save. Check your connection and try again.");
      }
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-2.5 border-t border-slate-700 pt-3">
      {photo.isTeamPhoto ? (
        <p className="text-[14px]">
          <span className="font-bold text-ball">Home team photo.</span> Shown at the top of the public home page.
        </p>
      ) : confirmingHome ? (
        <div className="flex flex-col gap-2 rounded-[10px] border border-ball/40 p-3">
          <p className="text-[14px]">
            The home page is public. This photo will {photo.isPublic ? "" : "be made public and "}replace the current
            team photo for everyone who visits.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => actions.setTeamPhoto(photo.id))}
              className={`${darkButton} border-ball bg-ball text-navy hover:bg-lime-300`}
            >
              {pending ? "Saving…" : photo.isPublic ? "Yes, use on Home" : "Yes, make public and use on Home"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingHome(false)}
              className={`${darkButton} border-slate-500 text-white hover:bg-navy-2`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingHome(true)}
          className={`${darkButton} self-start border-ball text-ball hover:bg-navy-2`}
        >
          Set as Home team photo
        </button>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px]">
          {photo.isPublic ? (
            <>
              <span className="font-bold text-ball">Public.</span> Shows on the home page and gallery.
            </>
          ) : (
            <>
              <span className="font-bold">Players only.</span> Not on public pages.
            </>
          )}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => actions.setPublic(photo.id, !photo.isPublic))}
          className={`${darkButton} shrink-0 border-ball text-ball hover:bg-navy-2`}
        >
          {photo.isTeamPhoto ? "Make private (leaves Home)" : photo.isPublic ? "Make private" : "Make public"}
        </button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => actions.setCaption(photo.id, caption));
        }}
      >
        <label className="sr-only" htmlFor="photo-caption">
          Caption
        </label>
        <input
          id="photo-caption"
          value={caption}
          maxLength={200}
          placeholder="Add a caption"
          onChange={(e) => setCaption(e.target.value)}
          className={`${inputClass} h-11`}
        />
        <button type="submit" disabled={pending} className={`${darkButton} shrink-0 border-slate-500 text-white hover:bg-navy-2`}>
          Save
        </button>
      </form>
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => actions.remove(photo.id))}
            className={`${darkButton} border-warn bg-warn text-white hover:bg-orange-800`}
          >
            {pending ? "Deleting…" : "Yes, delete this photo"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={`${darkButton} border-slate-500 text-white hover:bg-navy-2`}
          >
            Keep it
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`${darkButton} self-start border-orange-300 text-orange-200 hover:bg-navy-2`}
        >
          Delete photo
        </button>
      )}
      {error ? (
        <p role="alert" className="text-[13px] font-semibold text-orange-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
