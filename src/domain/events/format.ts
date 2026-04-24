import type {EventItem, DateParts} from "./types.ts";

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

const dateFormatterNoYear = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
});

const dateFormatterMonthOnly = new Intl.DateTimeFormat("en-US", {
    month: "short",
});

const dateFormatterDayOnly = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
});

export const parseDateParts = (dateStr: string): DateParts => {
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

    return {year, month, date};
}

const toLocalDate = ({year, month, date}: DateParts): Date => {
    return new Date(year, month - 1, date);
};

export function fmtDate(dateStr: string, showYear: boolean = true): string {
    const localDate = toLocalDate(parseDateParts(dateStr));

    return showYear ? dateFormatter.format(localDate) : dateFormatterNoYear.format(localDate);
}

// todo - recurrences: expand this for recurrences
/**
 * Some usages of this are now replaced with the EventDateRange component to incorporate <time> semantic tags,
 * but in certain places where this is meaningless/impossible (such as inside of SVGs like the
 * GuestSpotCardInfoBannerSvg), this function still has a use.
 */
export function fmtDateRange(ev: Pick<EventItem, "startDate" | "endDate">): string {
    if (ev.endDate) {
        const start = parseDateParts(ev.startDate);
        const end = parseDateParts(ev.endDate);
        const eventSpansSingleMonth = start.month === end.month && start.year === end.year;
        if (eventSpansSingleMonth) {
            const localStartDate = toLocalDate(start);
            const localEndDate = toLocalDate(end);
            return `${dateFormatterMonthOnly.format(localStartDate)} ${dateFormatterDayOnly.format(localStartDate)} – ${dateFormatterDayOnly.format(localEndDate)}`;
        }
    }
    return ev.endDate ? `${fmtDate(ev.startDate, false)} – ${fmtDate(ev.endDate, false)}` : fmtDate(ev.startDate, false);
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