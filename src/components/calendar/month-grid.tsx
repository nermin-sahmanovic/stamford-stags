"use client";

import { useState } from "react";
import { ScheduleCard } from "@/components/calendar/schedule-card";
import { monthKeyParts, type CalendarItem } from "@/lib/calendar/items";
import { formatMonthYear, formatWeekdayDate, teamDateKey } from "@/lib/format";

const WEEKDAYS = [
  ["S", "Sunday"],
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
] as const;

/** Month grid with a dot per match (navy) and event (blue). Tapping a day narrows the list below. */
export function MonthGrid({ monthKey, todayKey, items }: { monthKey: string; todayKey: string; items: CalendarItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { daysInMonth, firstWeekday } = monthKeyParts(monthKey);

  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = teamDateKey(item.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);
  const shown = selected ? (byDay.get(selected) ?? []) : items;
  const noonUtc = (dayKey: string) => `${dayKey}T16:00:00Z`;

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,380px)_1fr] md:items-start md:gap-6">
      <div className="rounded-[14px] border border-line bg-white p-2.5">
        <div className="grid grid-cols-7 text-center" aria-hidden="true">
          {WEEKDAYS.map(([letter, name]) => (
            <span key={name} className="py-1 text-[12px] font-bold tracking-[0.06em] text-slate-500">
              {letter}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstWeekday }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {days.map((day) => {
            const dayItems = byDay.get(day) ?? [];
            const hasMatch = dayItems.some((item) => item.kind === "match");
            const hasEvent = dayItems.some((item) => item.kind !== "match");
            const isSelected = selected === day;
            const isToday = day === todayKey;
            const label = `${formatWeekdayDate(noonUtc(day))}${dayItems.length ? `, ${dayItems.length} on the calendar` : ""}`;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={isSelected}
                aria-label={label}
                onClick={() => setSelected(isSelected ? null : day)}
                className={`flex h-12 flex-col items-center justify-center gap-1 rounded-[10px] text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-court ${
                  isSelected ? "bg-navy text-white" : "text-navy hover:bg-slate-100"
                } ${isToday && !isSelected ? "ring-2 ring-court ring-inset" : ""}`}
              >
                {Number(day.slice(8))}
                <span className="flex h-1.5 gap-1" aria-hidden="true">
                  {hasMatch ? <span className={`size-1.5 rounded-full ${isSelected ? "bg-ball" : "bg-navy"}`} /> : null}
                  {hasEvent ? <span className={`size-1.5 rounded-full ${isSelected ? "bg-white" : "bg-court"}`} /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-4 px-1 text-[13px] text-slate-600" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-navy" /> Match
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-court" /> Event
          </span>
        </div>
      </div>

      <section aria-live="polite" aria-label="Selected day">
        <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
          <h2 className="text-[13px] font-bold tracking-[0.08em] text-slate-500 uppercase">
            {selected ? formatWeekdayDate(noonUtc(selected)) : `All of ${formatMonthYear(noonUtc(`${monthKey}-15`))}`}
          </h2>
          {selected ? (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="min-h-11 text-[14px] font-semibold text-court"
            >
              Whole month
            </button>
          ) : null}
        </div>
        {shown.length === 0 ? (
          <p className="rounded-[14px] border border-line bg-white p-4 text-[15px] text-slate-600">
            {selected ? "Nothing on this day." : "Nothing scheduled this month."}
          </p>
        ) : (
          <ul className="grid gap-2.5">
            {shown.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <ScheduleCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
