"use client";

import { useEffect, useMemo, useState } from "react";
import { readTimeInterval } from "@/lib/time-settings";

function normalizeHour(hour: number) {
  return hour === 24 ? 0 : hour;
}

function formatTimeLabel(value: string) {
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const period = hour >= 12 ? "PM" : "AM";

  return `${displayHour}:${minute} ${period}`;
}

function timeOptions(interval: number, startHour: number, endHour: number) {
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  const options: string[] = [];

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += interval) {
    const hour = normalizeHour(Math.floor(minutes / 60));
    const minute = minutes % 60;

    options.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  return options;
}

export function useTimeInterval() {
  const [interval, setIntervalValue] = useState(readTimeInterval);

  useEffect(() => {
    function syncInterval() {
      setIntervalValue(readTimeInterval());
    }

    window.addEventListener("storage", syncInterval);
    window.addEventListener("time-interval-change", syncInterval);

    return () => {
      window.removeEventListener("storage", syncInterval);
      window.removeEventListener("time-interval-change", syncInterval);
    };
  }, []);

  return interval;
}

export function TimeSelect({
  className = "mt-2 h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm",
  disabled,
  endHour = 24,
  interval: intervalOverride,
  onChange,
  startHour = 0,
  value,
}: {
  className?: string;
  disabled?: boolean;
  endHour?: number;
  interval?: number;
  onChange: (value: string) => void;
  startHour?: number;
  value: string;
}) {
  const savedInterval = useTimeInterval();
  const interval = intervalOverride ?? savedInterval;
  const options = useMemo(
    () => timeOptions(interval, startHour, endHour),
    [endHour, interval, startHour],
  );
  const normalizedValue = value.slice(0, 5);
  const displayOptions = options.includes(normalizedValue)
    ? options
    : [normalizedValue, ...options].filter(Boolean);

  return (
    <select
      className={className}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      value={normalizedValue}
    >
      {displayOptions.map((option) => (
        <option key={option} value={option}>
          {formatTimeLabel(option)}
        </option>
      ))}
    </select>
  );
}

export function DateTimeSelect({
  disabled,
  endHour = 24,
  onChange,
  startHour = 0,
  value,
}: {
  disabled?: boolean;
  endHour?: number;
  onChange: (value: string) => void;
  startHour?: number;
  value: string;
}) {
  const [datePart = "", timePart = ""] = value.split("T");
  const normalizedTime = timePart.slice(0, 5);

  function updateDate(nextDate: string) {
    onChange(`${nextDate}T${normalizedTime || "12:00"}`);
  }

  function updateTime(nextTime: string) {
    onChange(`${datePart}T${nextTime}`);
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[1.1fr_0.9fr]">
      <input
        className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
        disabled={disabled}
        onChange={(event) => updateDate(event.target.value)}
        type="date"
        value={datePart}
      />
      <TimeSelect
        className="h-10 w-full rounded-md border border-[#cfc7b8] bg-white px-3 text-sm"
        disabled={disabled}
        endHour={endHour}
        onChange={updateTime}
        startHour={startHour}
        value={normalizedTime || "12:00"}
      />
    </div>
  );
}
