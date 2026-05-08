export const timeIntervalOptions = [15, 30, 60] as const;
export const timeIntervalStorageKey = "tattoo-manager:time-interval";
export const defaultTimeInterval = 30;

export type TimeInterval = (typeof timeIntervalOptions)[number];

export function isTimeInterval(value: number): value is TimeInterval {
  return timeIntervalOptions.includes(value as TimeInterval);
}

export function readTimeInterval() {
  if (typeof window === "undefined") {
    return defaultTimeInterval;
  }

  const stored = Number(window.localStorage.getItem(timeIntervalStorageKey));

  return isTimeInterval(stored) ? stored : defaultTimeInterval;
}

export function saveTimeInterval(value: TimeInterval) {
  window.localStorage.setItem(timeIntervalStorageKey, String(value));
  window.dispatchEvent(new Event("time-interval-change"));
}
