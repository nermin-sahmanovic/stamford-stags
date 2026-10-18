import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { GalleryGrid } from "@/components/photos/gallery-grid";
import { Skeleton } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { getMemberPhotos, getPhotoMatchOptions } from "@/lib/photos/queries";
import type { GalleryPhoto } from "@/lib/photos/sign";
import { deletePhoto, setPhotoPublic, setTeamPhoto, updatePhotoCaption } from "./actions";
import { PhotoUploader } from "./photo-uploader";

export const metadata: Metadata = { title: "Photos" };

export default function PhotosPage() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">Photos</h1>
      <Suspense fallback={<GallerySkeleton />}>
        <Photos />
      </Suspense>
    </section>
  );
}

async function Photos() {
  const me = await requireMember();
  const [photos, matches] = await Promise.all([getMemberPhotos(), me.isCaptain ? getPhotoMatchOptions() : []]);

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[1fr_340px] md:items-start md:gap-6">
      <div className="flex flex-col gap-3 md:order-1">
        <p className="text-[15px] text-slate-600">
          {me.isCaptain
            ? "Tap a photo to make it public, edit its caption or delete it. Only public photos appear on public pages."
            : "Team photos from matches and events. Only photos the captain makes public appear on the public site."}
        </p>
        {photos.length === 0 ? (
          <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
            No photos yet.{me.isCaptain ? " Add the first ones from match day." : ""}
          </p>
        ) : (
          <GalleryGrid
            photos={photos}
            actions={
              me.isCaptain
                ? { setPublic: setPhotoPublic, setCaption: updatePhotoCaption, setTeamPhoto, remove: deletePhoto }
                : undefined
            }
          />
        )}
      </div>
      {me.isCaptain ? (
        <div className="flex flex-col gap-4 md:order-2">
          <TeamPhotoCard photo={photos.find((p) => p.isTeamPhoto) ?? null} />
          <PhotoUploader matches={matches} />
        </div>
      ) : null}
    </div>
  );
}

/** Where the Captain area's "Change team photo" shortcut lands. */
function TeamPhotoCard({ photo }: { photo: GalleryPhoto | null }) {
  return (
    <section
      id="team-photo"
      aria-labelledby="team-photo-heading"
      className="scroll-mt-20 rounded-2xl border border-line bg-white p-4"
    >
      <h2 id="team-photo-heading" className="font-display text-[22px] leading-tight font-bold tracking-[0.03em] uppercase">
        Home team photo
      </h2>
      <div className="mt-2 flex items-center gap-3">
        {photo ? (
          <Image
            src={photo.thumbUrl}
            alt={photo.caption ?? "Current team photo"}
            width={photo.width}
            height={photo.height}
            unoptimized
            className="aspect-[16/10] w-28 shrink-0 rounded-[8px] object-cover object-[50%_35%]"
          />
        ) : null}
        <p className="text-[14px] text-slate-600">
          {photo
            ? "Shown at the top of the public home page. To change it, tap another photo and choose Set as Home team photo."
            : "None yet, so Home shows a placeholder. Tap a photo and choose Set as Home team photo."}
        </p>
      </div>
    </section>
  );
}

function GallerySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-1 md:grid-cols-5">
      {Array.from({ length: 9 }, (_, i) => (
        <Skeleton key={i} className="aspect-square rounded-[8px]" />
      ))}
    </div>
  );
}
