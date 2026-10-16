"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/lib/auth-actions";
import { CloseIcon, MenuIcon, SignInIcon, SignOutIcon } from "./icons";
import {
  isActive,
  menuNav,
  primaryNav,
  visibleItems,
  type NavItem,
} from "./nav-items";

type Props = {
  showCaptain?: boolean;
  signedIn?: boolean;
};

const buttonClass =
  "flex size-11 items-center justify-center rounded-[10px] text-white hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ball";

const itemClass =
  "flex min-h-12 items-center gap-3 rounded-[10px] px-3 text-base font-semibold no-underline hover:bg-navy-2";

/** Shown while the pathname is unknown during prerender. */
export function MenuButtonPlaceholder() {
  return (
    <button type="button" aria-label="Open menu" className={buttonClass} disabled>
      <MenuIcon size={22} />
    </button>
  );
}

export function MenuDrawer({ showCaptain = false, signedIn = false }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    openButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const renderLinks = (items: NavItem[]) =>
    items.map(({ href, label, icon: Icon }) => {
      const active = isActive(pathname, href);
      return (
        <li key={href}>
          <Link
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`${itemClass} ${active ? "text-ball" : "text-white"}`}
          >
            <Icon size={20} className={active ? "text-ball" : "text-muted"} />
            {label}
          </Link>
        </li>
      );
    });

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className={buttonClass}
      >
        <MenuIcon size={22} />
      </button>

      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-50 bg-navy/60 transition-opacity duration-200 motion-reduce:transition-none ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(300px,85vw)] flex-col border-t-2 border-ball bg-navy pt-[env(safe-area-inset-top)] pb-[max(16px,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-14 flex-none items-center justify-between pr-3 pl-4">
          <span className="font-display text-[20px] font-bold tracking-[0.06em] text-white uppercase">
            Menu
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close menu"
            onClick={close}
            className={buttonClass}
          >
            <CloseIcon size={22} />
          </button>
        </div>
        <nav aria-label="Site" className="min-h-0 flex-1 overflow-y-auto px-2">
          <ul className="flex flex-col gap-0.5">
            {renderLinks(visibleItems(primaryNav, showCaptain))}
          </ul>
          <hr className="mx-3 my-2 border-navy-2" />
          <ul className="flex flex-col gap-0.5">{renderLinks(menuNav)}</ul>
          <hr className="mx-3 my-2 border-navy-2" />
          {signedIn ? (
            <form action={signOut}>
              <button type="submit" className={`${itemClass} w-full text-white`}>
                <SignOutIcon size={20} className="text-muted" />
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              aria-current={isActive(pathname, "/sign-in") ? "page" : undefined}
              className={`${itemClass} ${isActive(pathname, "/sign-in") ? "text-ball" : "text-white"}`}
            >
              <SignInIcon size={20} className="text-muted" />
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}
