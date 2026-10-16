import { getViewer } from "@/lib/auth";
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
  const { signedIn, isCaptain } = await getViewer();
  return <MenuDrawer showCaptain={isCaptain} signedIn={signedIn} />;
}
