export const BEIJING_TIME_ZONE = "Asia/Shanghai";

type DateTimeParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
};

function partsForBeijing(value: string | Date): DateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIJING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values as DateTimeParts;
}

export function formatBeijing(value: string | Date | null | undefined, options: Intl.DateTimeFormatOptions): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { ...options, timeZone: BEIJING_TIME_ZONE }).format(
    typeof value === "string" ? new Date(value) : value,
  );
}

export function beijingDateTimeLocal(value?: string | null): string {
  if (!value) return "";
  const { year, month, day, hour, minute } = partsForBeijing(value);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function beijingLocalToIso(value: string): string | null {
  if (!value) return null;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(`${withSeconds}+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
