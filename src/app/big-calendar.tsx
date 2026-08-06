"use client";

import { useState } from "react";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function BigCalendar({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const year = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  const initialMonth = (() => {
    if (!value) return todayMonth;
    const d = new Date(`${value}T00:00:00`);
    return d.getFullYear() === year ? d.getMonth() : todayMonth;
  })();

  const [viewMonth, setViewMonth] = useState(initialMonth);

  const firstWeekday = new Date(year, viewMonth, 1).getDay();
  const daysInMonth = new Date(year, viewMonth + 1, 0).getDate();
  const canGoPrev = viewMonth > todayMonth;
  const canGoNext = viewMonth < 11;

  function isPast(day: number): boolean {
    if (viewMonth > todayMonth) return false;
    if (viewMonth < todayMonth) return true;
    return day < todayDate;
  }
  function isToday(day: number): boolean {
    return viewMonth === todayMonth && day === todayDate;
  }
  function isSelected(day: number): boolean {
    return value === `${year}-${pad(viewMonth + 1)}-${pad(day)}`;
  }
  function pick(day: number) {
    if (isPast(day)) return;
    onSelect(`${year}-${pad(viewMonth + 1)}-${pad(day)}`);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        className="flex h-full max-h-[720px] w-full max-w-2xl flex-col gap-4 rounded-[28px] border-[5px] border-frame bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => canGoPrev && setViewMonth((m) => m - 1)}
            disabled={!canGoPrev}
            className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-frame text-2xl font-extrabold disabled:opacity-30"
            type="button"
          >
            ‹
          </button>
          <span className="text-[clamp(1.4rem,3.4vw,2rem)] font-extrabold">
            {year}년 {viewMonth + 1}월
          </span>
          <button
            onClick={() => canGoNext && setViewMonth((m) => m + 1)}
            disabled={!canGoNext}
            className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-frame text-2xl font-extrabold disabled:opacity-30"
            type="button"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[clamp(.95rem,2vw,1.1rem)] font-extrabold text-text-soft">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {cells.map((day, i) =>
            day === null ? (
              <span key={`blank-${i}`} />
            ) : (
              <button
                key={day}
                disabled={isPast(day)}
                onClick={() => pick(day)}
                type="button"
                className={`rounded-2xl text-[clamp(1.1rem,2.8vw,1.6rem)] font-extrabold outline-none focus-visible:outline-4 focus-visible:outline-foreground focus-visible:outline-offset-2 ${
                  isSelected(day)
                    ? "bg-accent-success text-white"
                    : isPast(day)
                      ? "cursor-not-allowed text-frame"
                      : isToday(day)
                        ? "border-[3px] border-accent-success bg-background text-foreground"
                        : "bg-background text-foreground"
                }`}
              >
                {day}
              </button>
            )
          )}
        </div>
        <button
          onClick={onClose}
          type="button"
          className="self-center rounded-2xl border-[3px] border-frame px-6 py-2.5 text-[clamp(1rem,2.1vw,1.15rem)] font-bold"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
