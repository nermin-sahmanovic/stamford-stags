import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { initials, shortName } from "@/lib/roster/display";
import { BottomTabBar } from "./bottom-tab-bar";
import { MenuDrawer } from "./menu-drawer";
import { TopNav } from "./top-nav";

// Session-aware nav. Each one sits behind its own Suspense boundary in the
// shell; getViewer() is cached, so the session is read once per request.

export async function SessionTabBar() {
  const { isCaptain } = await getViewer();
  return <BottomTabBar showCaptain={isCaptain} />;
}

export async function SessionTopNav() {
  const { isCaptain } = await getViewer();
  return <TopNav showCaptain={isCaptain} />;
}

export async function SessionMenu() {
  const viewer = await getViewer();
  return (
    <MenuDrawer
      showCaptain={viewer.isCaptain}
      signedIn={viewer.signedIn}
      account={viewer.signedIn ? { name: viewer.name, email: viewer.email, roleLabel: viewer.roleLabel } : null}
    />
  );
}

/** Who is signed in: initials badge (plus short name from md up) linking to their profile. */
export async function SessionAccount() {
  const { name, roleLabel } = await getViewer();
  if (!name) return null;
  return (
    <Link
      href="/players/me"
      aria-label={`Signed in as ${name}${roleLabel ? `, ${roleLabel}` : ""}. Your profile`}
      className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[10px] px-1 no-underline hover:bg-navy-2 md:px-2"
    >
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full border-[1.5px] border-ball bg-navy-2 text-[12px] font-bold text-ball"
      >
        {initials(name)}
      </span>
      <span aria-hidden="true" className="hidden max-w-36 truncate text-[14px] font-semibold text-white md:block">
        {shortName(name)}
      </span>
    </Link>
  );
}
