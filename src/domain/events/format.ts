import type {EventItem} from "./types.ts";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
});
const fmtMonthYearLabel = (monthYearStr: string): string => {
    const [rawMonth, rawYear] = monthYearStr.split("-");
    const month = Number(rawMonth);
    const year = Number(rawYear);

    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
    ) {
        throw new Error(`Invalid date: ${monthYearStr}`);
    }

    return monthFormatter.format(new Date(year, month - 1, 1));
}
const dateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
});

export function fmtDate(dateStr: string): string {
    const [rawYear, rawMonth, rawDate] = dateStr.split("-");
    const year = Number(rawYear);
    const month = Number(rawMonth);
    const date = Number(rawDate);

    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(date) ||
        month < 1 ||
        month > 12 ||
        date < 1 ||
        date > 31
    ) {
        throw new Error(`Invalid date: ${dateStr}`);
    }

    return dateFormatter.format(new Date(year, month - 1, date));
}

// todo: expand this for recurrences
// replacing usages of this with EventDateRange; better for incorporating <time> semantic tags
export function fmtDateRange(ev: Pick<EventItem, "startDate" | "endDate">): string {
    return ev.endDate ? `${fmtDate(ev.startDate)} – ${fmtDate(ev.endDate)}` : fmtDate(ev.startDate);
}

export function fmtTime(time: string): string {
    const [rawHour, rawMinute] = time.split(":");
    const hour = Number(rawHour);
    const minute = Number(rawMinute);

    if (
        !Number.isInteger(hour) ||
        !Number.isInteger(minute) ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {
        throw new Error(`Invalid time: ${time}`);
    }

    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;

    return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

// Replaced with concise, almost-readable inline react tsx nested ternary (in order to include <time> semantics)
export function fmtTimeWindow(ev: Pick<EventItem, "startTime" | "endTime">): string {
    const {startTime, endTime} = ev;
    if (startTime && endTime) return `${fmtTime(startTime)}–${fmtTime(endTime)}`;
    if (startTime && !endTime) return `Starts ${fmtTime(startTime)}`;
    if (!startTime && endTime) return `Until ${fmtTime(endTime)}`;
    return "All day";
}