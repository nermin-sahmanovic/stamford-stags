import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { requireMember } from "@/lib/auth";

/** "My profile" in the menu: the signed-in player's own profile page. */
export default function MyProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="mx-4 mt-4 h-32" />}>
      <ToMyProfile />
    </Suspense>
  );
}

async function ToMyProfile(): Promise<never> {
  const me = await requireMember();
  redirect(`/players/${me.id}`);
}
