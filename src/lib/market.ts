const ET = "America/New_York";

type EtParts = {
  y: number;
  m: number;
  d: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
};

export function etNow(date: Date = new Date()): EtParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    hour: Number(parts.hour === "24" ? 0 : parts.hour),
    minute: Number(parts.minute),
    weekday: weekdays.indexOf(parts.weekday),
  };
}

/** YYYY-MM-DD in Eastern time. */
export function etDateStr(date: Date = new Date()): string {
  const { y, m, d } = etNow(date);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * NYSE full-day holidays (fixed list; observed dates).
 * Covering 2025-2028 is plenty for this app; weekends handle the rest.
 */
const HOLIDAYS = new Set([
  "2025-01-01","2025-01-20","2025-02-17","2025-04-18","2025-05-26","2025-06-19","2025-07-04","2025-09-01","2025-11-27","2025-12-25",
  "2026-01-01","2026-01-19","2026-02-16","2026-04-03","2026-05-25","2026-06-19","2026-07-03","2026-09-07","2026-11-26","2026-12-25",
  "2027-01-01","2027-01-18","2027-02-15","2027-03-26","2027-05-31","2027-06-18","2027-07-05","2027-09-06","2027-11-25","2027-12-24",
  "2028-01-01","2028-01-17","2028-02-21","2028-04-14","2028-05-29","2028-06-19","2028-07-04","2028-09-04","2028-11-23","2028-12-25",
]);

export function isMarketDay(dateStr: string): boolean {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !HOLIDAYS.has(dateStr);
}

export function isMarketOpen(date: Date = new Date()): boolean {
  const p = etNow(date);
  if (p.weekday === 0 || p.weekday === 6) return false;
  if (!isMarketDay(etDateStr(date))) return false;
  const mins = p.hour * 60 + p.minute;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

/** YYYY-MM-DD of the Monday of the current week, in ET. */
export function startOfWeekEt(date: Date = new Date()): string {
  const p = etNow(date);
  const cursor = new Date(Date.UTC(p.y, p.m - 1, p.d, 12));
  const daysSinceMonday = (p.weekday + 6) % 7;
  cursor.setUTCDate(cursor.getUTCDate() - daysSinceMonday);
  return cursor.toISOString().slice(0, 10);
}

/** Most recent completed market day (yesterday-or-earlier trading day, ET). */
export function lastCompletedMarketDay(date: Date = new Date()): string {
  const p = etNow(date);
  const cursor = new Date(
    Date.UTC(p.y, p.m - 1, p.d, 12)
  );
  // If market hasn't closed yet today, today doesn't count.
  const mins = p.hour * 60 + p.minute;
  const todayDone = mins >= 16 * 60 && isMarketDay(etDateStr(date));
  if (!todayDone) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (let i = 0; i < 10; i++) {
    const ds = cursor.toISOString().slice(0, 10);
    if (isMarketDay(ds)) return ds;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return cursor.toISOString().slice(0, 10);
}

/** Human-friendly next-open description for the market chip. */
export function marketStatus(date: Date = new Date()): {
  open: boolean;
  label: string;
} {
  if (isMarketOpen(date)) {
    return { open: true, label: "Market is open" };
  }
  const p = etNow(date);
  const mins = p.hour * 60 + p.minute;
  if (isMarketDay(etDateStr(date)) && mins < 9 * 60 + 30) {
    const until = 9 * 60 + 30 - mins;
    const h = Math.floor(until / 60);
    const m = until % 60;
    return {
      open: false,
      label: `Market opens in ${h > 0 ? `${h}h ` : ""}${m}m`,
    };
  }
  // Find next market day
  const cursor = new Date(Date.UTC(p.y, p.m - 1, p.d, 12));
  for (let i = 0; i < 10; i++) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const ds = cursor.toISOString().slice(0, 10);
    if (isMarketDay(ds)) {
      const dayName = new Date(`${ds}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "long",
      });
      return { open: false, label: `Market opens ${dayName} 9:30 AM ET` };
    }
  }
  return { open: false, label: "Market closed" };
}
