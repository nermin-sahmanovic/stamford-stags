import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, PlayersIcon, UploadIcon } from "@/components/shell/icons";

export const metadata: Metadata = { title: "Captain's Dashboard" };

// The full dashboard comes in Phase 9; until then this links to the captain tools that exist.
const tools = [
  { href: "/captain/roster", label: "Roster", note: "Add, edit, deactivate and bulk edit players", icon: PlayersIcon },
  { href: "/captain/roster/import", label: "Import CSV", note: "Add or update players from a spreadsheet", icon: UploadIcon },
];

export default function CaptainDashboardPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
        Captain&apos;s Dashboard
      </h1>
      <p className="mt-0.5 mb-4 text-[15px] text-slate-600">More tools arrive in later phases.</p>
      <ul className="grid gap-2.5 md:grid-cols-2">
        {tools.map(({ href, label, note, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-[64px] items-center gap-3 rounded-[14px] border border-line bg-white px-3.5 py-3 text-navy no-underline hover:border-slate-300"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-ball">
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{label}</span>
                <span className="block text-[13px] text-slate-600">{note}</span>
              </span>
              <ArrowRightIcon size={18} className="text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
