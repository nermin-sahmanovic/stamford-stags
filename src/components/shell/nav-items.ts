import type { ComponentType } from "react";
import {
  AvailabilityIcon,
  CaptainIcon,
  HomeIcon,
  InfoIcon,
  JoinIcon,
  MailIcon,
  MatchesIcon,
  MessagesIcon,
  PlayersIcon,
  ResultsIcon,
  ScheduleIcon,
  UserIcon,
  type IconProps,
} from "./icons";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  captainOnly?: boolean;
};

/** Bottom tab bar on phones, top nav at md and up. */
export const primaryNav: NavItem[] = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/matches", label: "Matches", icon: MatchesIcon },
  { href: "/availability", label: "Availability", icon: AvailabilityIcon },
  { href: "/captain", label: "Captain", icon: CaptainIcon, captainOnly: true },
];

/** Everything else lives behind the header menu. */
export const menuNav: NavItem[] = [
  { href: "/about", label: "About", icon: InfoIcon },
  { href: "/join", label: "Join the Team", icon: JoinIcon },
  { href: "/schedule", label: "Schedule", icon: ScheduleIcon },
  { href: "/results", label: "Results", icon: ResultsIcon },
  { href: "/players", label: "Players", icon: PlayersIcon },
  { href: "/players/me", label: "My profile", icon: UserIcon },
  { href: "/messages", label: "Messages", icon: MessagesIcon },
  { href: "/contact", label: "Contact", icon: MailIcon },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function visibleItems(items: NavItem[], showCaptain: boolean) {
  return items.filter((item) => showCaptain || !item.captainOnly);
}
