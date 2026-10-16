import { initials } from "@/lib/roster/display";

/** Round initials badge from the Captain prototype's registration rows. */
export function PlayerAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.35) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-line font-bold text-edge"
    >
      {initials(name)}
    </span>
  );
}
