"use client";

import { useEffect, useRef, useState } from "react";

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : new Date();
}

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sameDay(left: Date, right: Date) {
  return dateValue(left) === dateValue(right);
}

export function DatePicker({ disabled, value, onChange }: { disabled?: boolean; value: string; onChange: (value: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selected = parseDate(value);
    return new Date(selected.getFullYear(), selected.getMonth(), 1);
  });
  const selected = parseDate(value);
  const today = new Date();

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(1 - firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + index);
    return day;
  });

  function moveMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        className="mt-1.5 flex h-10 w-full items-center justify-between rounded-md border border-[#cfc7b8] bg-white px-3 text-left text-sm"
        disabled={disabled}
        onClick={() => {
          const current = parseDate(value);
          setVisibleMonth(new Date(current.getFullYear(), current.getMonth(), 1));
          setOpen((currentOpen) => !currentOpen);
        }}
        type="button"
      >
        <span>{value}</span>
        <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24"><path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" /></svg>
      </button>
      {open ? (
        <div className="absolute left-0 top-[3.25rem] z-40 w-[19rem] rounded-md border border-[#cfc7b8] bg-white p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <button aria-label="Previous month" className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d9d3c7] text-2xl leading-none hover:bg-[#f7f2e9]" onClick={() => moveMonth(-1)} type="button">‹</button>
            <p className="text-sm font-black">
              {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(visibleMonth)}
            </p>
            <button aria-label="Next month" className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d9d3c7] text-2xl leading-none hover:bg-[#f7f2e9]" onClick={() => moveMonth(1)} type="button">›</button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase text-[#697178]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span className="py-1" key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const isSelected = sameDay(day, selected);
              const isToday = sameDay(day, today);
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              return (
                <button
                  aria-label={dateValue(day)}
                  className={`h-9 rounded-md text-sm transition ${isSelected ? "bg-[#191b1f] font-black text-white" : isToday ? "border border-[#236c8f] font-bold text-[#236c8f]" : isCurrentMonth ? "hover:bg-[#f1eadc]" : "text-[#a2a5a7] hover:bg-[#f7f2e9]"}`}
                  key={dateValue(day)}
                  onClick={() => {
                    onChange(dateValue(day));
                    setOpen(false);
                  }}
                  type="button"
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end border-t border-[#e5dfd4] pt-2">
            <button className="text-xs font-bold text-[#236c8f]" onClick={() => { onChange(dateValue(today)); setOpen(false); }} type="button">Today</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
