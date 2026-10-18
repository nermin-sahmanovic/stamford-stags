"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { StatusPage, statusPrimary, statusSecondary } from "@/components/status-page";

/**
 * Anything that throws while rendering a page lands here, inside the normal header and tab bar.
 * People never see the error text; the digest goes to the console for matching server logs.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    const digest = error instanceof Error && "digest" in error ? String(error.digest) : undefined;
    console.error("[page error]", digest ?? error);
  }, [error]);

  return (
    <StatusPage
      code="Let"
      title="Something went wrong"
      actions={
        <>
          <button type="button" onClick={() => retry()} className={statusPrimary}>
            Try again
          </button>
          <Link href="/" className={statusSecondary}>
            Back to home
          </Link>
        </>
      }
    >
      We couldn&apos;t load this page. It&apos;s usually a blip in the connection, so try again. If it keeps
      happening, let your captain know.
    </StatusPage>
  );
}
