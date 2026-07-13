import type {EventItem} from "./types.ts";
import {Temporal} from "temporal-polyfill";

const DATE_WITH_YEAR: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
};

const DATE_WITHOUT_YEAR: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
};

const MONTH_ONLY: Intl.DateTimeFormatOptions = {
    month: "short",
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
};

const parseDate = (value: string): Temporal.PlainDate =>
    Temporal.PlainDate.from(value);

const parseTime = (value: string): Temporal.PlainTime =>
    Temporal.PlainTime.from(value);

export function fmtDate(
    dateStr: string,
    showYear = true,
): string {
    return parseDate(dateStr).toLocaleString(
        "en-US",
        showYear ? DATE_WITH_YEAR : DATE_WITHOUT_YEAR,
    );
}

/**
 * Some usages of this are now replaced with the EventDateRange component to incorporate <time> semantic tags,
 * but in certain places where this is meaningless/impossible (such as inside of SVGs like the
 * GuestSpotCardInfoBannerSvg), this function still has a use.
 *
 * Note: Recurring events control their own date range display logic inside of recurrence/format.ts
 */
export function fmtDateRange(
    ev: Pick<EventItem, "startDate" | "endDate">,
): string {
    const start = parseDate(ev.startDate);

    if (!ev.endDate) {
        return start.toLocaleString("en-US", DATE_WITHOUT_YEAR);
    }

    const end = parseDate(ev.endDate);

    const sameMonth =
        start.year === end.year &&
        start.month === end.month;

    if (sameMonth) {
        const month = start.toLocaleString("en-US", MONTH_ONLY);
        return `${month} ${start.day} – ${end.day}`;
    }

    return [
        start.toLocaleString("en-US", DATE_WITHOUT_YEAR),
        end.toLocaleString("en-US", DATE_WITHOUT_YEAR),
    ].join(" – ");
}

export function fmtTime(time: string): string {
    return parseTime(time).toLocaleString("en-US", TIME_FORMAT);
}

// Replaced with concise, almost-readable inline react tsx nested ternary (in order to include <time> semantics)
export function fmtTimeWindow(
    ev: Pick<EventItem, "startTime" | "endTime">,
): string {
    const { startTime, endTime } = ev;

    if (startTime && endTime) {
        return `${fmtTime(startTime)}–${fmtTime(endTime)}`;
    }

    if (startTime) return `Starts ${fmtTime(startTime)}`;
    if (endTime) return `Until ${fmtTime(endTime)}`;

    return "All day";
}