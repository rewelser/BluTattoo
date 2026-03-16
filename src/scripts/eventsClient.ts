import type { EventItem } from "../scripts/events";

export type EventsByYearMonthDate = Record<string, Record<string, Record<string, EventItem[]>>>;

// ----- Date helpers (inclusive endDate, day-level comparisons) -----

export function getEventStartKey(ev: EventItem): string {
    return `${ev.startDate}T${ev.startTime ?? "00:00"}`;
}

export function getEventEndKey(ev: EventItem): string {
    const endDate = ev.endDate ?? ev.startDate;
    return `${endDate}T${ev.endTime ?? "23:59"}`;
}

export function getNowKey(now = new Date()): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const date = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${date}T${hours}:${minutes}`;
}

export function hasEventEnded(
    ev: EventItem,
    nowKey = getNowKey(),
): boolean {
    return getEventEndKey(ev) < nowKey;
}

export function isEventArchived(ev: EventItem): boolean {
    return ev.archived === true;
}

// ----- Formatting (display-only) -----

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

export function fmtTimeWindow(ev: Pick<EventItem, "startTime" | "endTime">): string {
    const { startTime, endTime } = ev;
    if (startTime && endTime) return `${fmtTime(startTime)}–${fmtTime(endTime)}`;
    if (startTime && !endTime) return `Starts ${fmtTime(startTime)}`;
    if (!startTime && endTime) return `Until ${fmtTime(endTime)}`;
    return "All day";
}

// ----- Getters -----

export function getUpcomingCandidates(events: EventItem[], now = new Date()) {
    return events.filter(
        (ev) =>
            !hasEventEnded(ev, getNowKey(now)) &&
            !isEventArchived(ev)
    );
}

export function getPromoCandidates(events: EventItem[]) {
    return events.filter(
        (ev) =>
            ev.promoBar?.enabled &&
            !!ev.promoBar?.message
    );
}

const getDatesBetweenInclusive = (startDate: string, endDate: string): string[] => {
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);

    const cur = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);

    const dates: string[] = [];

    while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");

        dates.push(`${y}-${m}-${d}`);

        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

export const buildEventsByYearMonthDate = (evItems: EventItem[]) => {
    const eventsByYearMonthDate: EventsByYearMonthDate = {};

    for (const ev of evItems) {
        const [startYear, startMonth, startDate] = ev.startDate.split("-");

        eventsByYearMonthDate[startYear] ||= {};
        eventsByYearMonthDate[startYear][startMonth] ||= {};
        eventsByYearMonthDate[startYear][startMonth][startDate] ||= [];

        // console.log("ev.endDate", ev.endDate);

        let failCount = 0;

        if (!!ev.endDate) {
            // console.log("!!ev.endDate", !!ev.endDate);
            // console.log("ev.title", ev.title);
            // console.log("ev.endDate", ev.endDate);
            // console.log("----------");
            // console.log("ev.startDate", ev.startDate);
            // console.log("----------");

            if (!ev.recurrenceRule) {
                const dateRange = getDatesBetweenInclusive(ev.startDate, ev.endDate);
                // console.log("dateRange.length", dateRange.length);

                dateRange.forEach((date: string) => {
                    const [curYear, curMonth, curDate] = date.split("-");

                    eventsByYearMonthDate[curYear] ||= {};
                    eventsByYearMonthDate[curYear][curMonth] ||= {};
                    eventsByYearMonthDate[curYear][curMonth][curDate] ||= [];

                    eventsByYearMonthDate[curYear][curMonth][curDate].push(ev);
                });
            }

        } else {
            eventsByYearMonthDate[startYear][startMonth][startDate].push(ev);
        }

        // failCount && console.log("failCount", failCount);
    }
    // console.log(eventsByYearMonthDay["2026"]["2"]["13"]);
    // console.log("-------------------");
    // console.log(eventsByYearMonthDay["2026"]["2"]["14"]);

    return eventsByYearMonthDate;
};

// ----- Picks -----

export function pickFeaturedHero(upcoming: EventItem[]): EventItem | null {
    return (
        upcoming.find((ev) => ev.featured && ev.image) ??
        upcoming.find((ev) => ev.image) ??
        null
    );
}


// const extrapolateOccurrences

/**
 * 
 */