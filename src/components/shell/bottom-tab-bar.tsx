"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, primaryNav, visibleItems } from "./nav-items";

type Props = {
  /** Captain and co-captain only. */
  showCaptain?: boolean;
  /** Set when rendered as a Suspense fallback, before the pathname is known. */
  pathname?: string | null;
};

export function BottomTabBar(props: Props) {
  const pathname = usePathname();
  return <TabBar {...props} pathname={pathname} />;
}

export function TabBar({ showCaptain = false, pathname = null }: Props) {
  const items = visibleItems(primaryNav, showCaptain);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-flow-col auto-cols-fr border-t border-navy-2 bg-navy px-1.5 pt-1.5 pb-[max(14px,env(safe-area-inset-bottom))] md:hidden"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 text-[11px] leading-[normal] font-semibold tracking-[0.04em] no-underline ${
              active ? "text-ball" : "text-muted"
            }`}
          >
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
