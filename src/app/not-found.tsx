import type { Metadata } from "next";
import Link from "next/link";
import { StatusPage, statusPrimary, statusSecondary } from "@/components/status-page";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Out of bounds"
      actions={
        <>
          <Link href="/" className={statusPrimary}>
            Back to home
          </Link>
          <Link href="/schedule" className={statusSecondary}>
            Schedule
          </Link>
          <Link href="/matches" className={statusSecondary}>
            Match Center
          </Link>
        </>
      }
    >
      That page doesn&apos;t exist, or it moved. Check the link, or pick up from one of these.
    </StatusPage>
  );
}
