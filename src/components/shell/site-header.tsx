import Link from "next/link";
import { Suspense } from "react";
import { MenuButtonPlaceholder } from "./menu-drawer";
import { SessionAccount, SessionMenu, SessionTopNav } from "./nav-session";
import { TopNavLinks } from "./top-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 box-content h-14 border-b-2 border-ball bg-navy">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between pr-3 pl-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 no-underline"
        >
          <span
            aria-hidden="true"
            className="box-content flex size-[34px] items-center justify-center rounded-full border-[1.5px] border-dashed border-ball font-display text-[13px] leading-[normal] font-bold tracking-[0.04em] text-ball"
          >
            SS
          </span>
          <span className="font-display text-[20px] leading-[normal] font-bold tracking-[0.06em] text-white uppercase">
            Stamford Stags
          </span>
        </Link>

        <div className="flex h-full items-center gap-1 md:gap-2">
          <Suspense fallback={<TopNavLinks />}>
            <SessionTopNav />
          </Suspense>
          <Suspense fallback={null}>
            <SessionAccount />
          </Suspense>
          <Suspense fallback={<MenuButtonPlaceholder />}>
            <SessionMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
