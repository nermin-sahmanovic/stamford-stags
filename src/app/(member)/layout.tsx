import { Suspense } from "react";
import { GuardFallback } from "@/components/guard-fallback";
import { requireMember } from "@/lib/auth";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<GuardFallback />}>
      <MemberGate>{children}</MemberGate>
    </Suspense>
  );
}

/** Renders nothing from the page until the visitor is an active roster member. */
async function MemberGate({ children }: { children: React.ReactNode }) {
  await requireMember();
  return children;
}
