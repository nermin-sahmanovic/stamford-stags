"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, primaryNav, visibleItems } from "./nav-items";

type Props = {
  showCaptain?: boolean;
  pathname?: string | null;
};

export function TopNav(props: Props) {
  const pathname = usePathname();
  return <TopNavLinks {...props} pathname={pathname} />;
}

/** Desktop (md and up) replacement for the bottom tab bar. */
export function TopNavLinks({ showCaptain = true, pathname = null }: Props) {
  const items = visibleItems(primaryNav, showCaptain);

  return (
    <nav aria-label="Primary" className="hidden h-full items-stretch gap-1 md:flex">
      {items.map(({ href, label }) => {
        const active = pathname !== null && isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center px-3 text-[15px] font-semibold tracking-[0.04em] no-underline transition-colors ${
              active ? "text-ball" : "text-muted hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
