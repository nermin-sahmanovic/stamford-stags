import { Suspense, type ReactNode } from "react";
import { TabBar } from "./bottom-tab-bar";
import { SessionTabBar } from "./nav-session";
import { SiteHeader } from "./site-header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      {/* First stop for keyboard users: jump past the header and menu. */}
      <a
        href="#main"
        className="fixed top-2 left-2 z-[60] -translate-y-20 rounded-[10px] bg-ball px-4 py-3 text-[15px] font-bold text-navy no-underline focus:translate-y-0"
      >
        Skip to content
      </a>
      <SiteHeader />
      {/* Bottom padding clears the fixed tab bar: 1px border + 6px top pad + 52px tab + bottom pad. */}
      <main id="main" tabIndex={-1} className="pb-[calc(59px+max(14px,env(safe-area-inset-bottom)))] md:pb-0">
        {children}
      </main>
      <Suspense fallback={<TabBar />}>
        <SessionTabBar />
      </Suspense>
    </>
  );
}
