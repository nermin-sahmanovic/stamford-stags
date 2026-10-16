import { Suspense, type ReactNode } from "react";
import { TabBar } from "./bottom-tab-bar";
import { SessionTabBar } from "./nav-session";
import { SiteHeader } from "./site-header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* Bottom padding clears the fixed tab bar: 1px border + 6px top pad + 52px tab + bottom pad. */}
      <main className="pb-[calc(59px+max(14px,env(safe-area-inset-bottom)))] md:pb-0">
        {children}
      </main>
      <Suspense fallback={<TabBar />}>
        <SessionTabBar />
      </Suspense>
    </>
  );
}
