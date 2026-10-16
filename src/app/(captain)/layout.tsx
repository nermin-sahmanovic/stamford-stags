import { Suspense } from "react";
import { GuardFallback } from "@/components/guard-fallback";
import { requireCaptain } from "@/lib/auth";

export default function CaptainLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<GuardFallback />}>
      <CaptainGate>{children}</CaptainGate>
    </Suspense>
  );
}

/** Renders nothing from the page until the visitor is an active captain or co-captain. */
async function CaptainGate({ children }: { children: React.ReactNode }) {
  await requireCaptain();
  return children;
}
