import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/page-hero";
import { GalleryGrid } from "@/components/photos/gallery-grid";
import { Skeleton } from "@/components/ui";
import { getPublicPhotos } from "@/lib/public-data";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryPage() {
  return (
    <>
      <PageHero eyebrow="On court" title="Gallery">
        Match days, practices and socials.
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-6">
        <Suspense
          fallback={
            <div className="grid grid-cols-3 gap-1 md:grid-cols-5">
              {Array.from({ length: 9 }, (_, i) => (
                <Skeleton key={i} className="aspect-square rounded-[8px]" />
              ))}
            </div>
          }
        >
          <PublicGallery />
        </Suspense>
      </div>
    </>
  );
}

/** Only photos the captain marked public (RLS and storage policies enforce it for anon). */
async function PublicGallery() {
  const photos = await getPublicPhotos(120);
  if (photos.length === 0) {
    return (
      <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
        No photos yet. Check back after the next match.
      </p>
    );
  }
  return <GalleryGrid photos={photos} />;
}
