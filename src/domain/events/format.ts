import type {EventItem, RecurrentEventItem} from "./types.ts";
import {Temporal} from "temporal-polyfill";
import {bySetPosNames, bySetPosTypes, weekdayNames, weekdayTypes} from "./defs.ts";

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

const UPCOMING_RECURRENCE: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
}

const parseDate = (value: string): Temporal.PlainDate =>
    Temporal.PlainDate.from(value);

const parseTime = (value: string): Temporal.PlainTime =>
    Temporal.PlainTime.from(value);

export function fmtDate(dateStr: string, showYear = true): string {
    return parseDate(dateStr).toLocaleString(
        "en-US",
        showYear ? DATE_WITH_YEAR : DATE_WITHOUT_YEAR,
    );
}

export function fmtDateUpcomingRecurrence(dateStr: string): string {
    return parseDate(dateStr).toLocaleString(
        "en-US",
        UPCOMING_RECURRENCE
    );
}

function ordinalNumerical(n: number) {
    const suffix =
        n % 10 === 1 && n % 100 !== 11
            ? "st"
            : n % 10 === 2 && n % 100 !== 12
                ? "nd"
                : n % 10 === 3 && n % 100 !== 13
                    ? "rd"
                    : "th";

    return `${n}${suffix}`;
}

/**
 * New rrules need a new case in all 3 of the following methods:
 * getRecurrenceFirstOccurrence, expandRecurrentEventOccurrencesFromRange, recurrenceText
 */
export function recurrenceText(rev: RecurrentEventItem) {
    const rrule = rev.recurrenceRule;
    const interval = rrule.interval;

    if (rrule.type === "recurrenceRuleWeekly") {
        let weekyString = `Every `;

        if (interval > 1) {
            const ordinality = interval === 2 ? `other` : ordinalNumerical(interval);
            weekyString += `${ordinality} `;
        }

        const byDay = weekdayTypes
            .filter((day) => rrule.byDay.includes(day))
            .map((day) => weekdayNames[day]);

        weekyString += new Intl.ListFormat("en", {
            style: "long",
            type: "conjunction",
        }).format(byDay);

        return weekyString;
    }

    if (rrule.type === "recurrenceRuleMonthlyByDate") {
        const byMonthDay = rrule.byMonthDay;
        const byMonthDayOrdinal = ordinalNumerical(byMonthDay);

        let monthlyByDateString = `The ${byMonthDayOrdinal} of`;

        if (interval > 1) {
            const ordinality = interval === 2 ? `other` : ordinalNumerical(interval);
            monthlyByDateString += ` every ${ordinality} month (if applicable)`;
        } else {
            monthlyByDateString += ` every month (if applicable)`;
        }
        return monthlyByDateString;
    }

    if (rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
        const dayName = weekdayNames[rrule.byDay];
        const bySetPos = bySetPosTypes
            .filter((setPos) => rrule.bySetPos.includes(setPos))
            .map((setPos) => bySetPosNames[setPos]);

        let monthlyByOrdinalWeekday = `The ` + new Intl.ListFormat("en", {
            style: "long",
            type: "conjunction",
        }).format(bySetPos) + ` ${dayName} of`;

        if (interval > 1) {
            const ordinality = interval === 2 ? `other` : ordinalNumerical(interval);
            monthlyByOrdinalWeekday += ` every ${ordinality} month`;
        } else {
            monthlyByOrdinalWeekday += ` every month`;
        }
        return monthlyByOrdinalWeekday;

    }
}

/**
 * Some usages of this are now replaced with the EventDateRange component to incorporate <time> semantic tags,
 * but in certain places where this is meaningless/impossible (such as inside of SVGs like the
 * GuestSpotCardInfoBannerSvg), this function still has a use.
 */
export function fmtDateRange(
    ev: EventItem,
): string {
    if (ev.recurrenceRule) {
        return recurrenceText(ev as RecurrentEventItem)!;
    }

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