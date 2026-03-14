// src/scripts/events.ts
import { getCollection, type CollectionEntry } from "astro:content";

export type EventEntry = CollectionEntry<"events">;
export type EventItem = EventEntry["data"] & { id: string };
export type EventsByYearMonthDay = Record<string, Record<string, Record<string, EventItem[]>>>;

// ----- Date helpers (inclusive endDate, day-level comparisons) -----

export function getEventEndMoment(ev: EventItem): Date {
    const base = ev.endDate ?? ev.startDate;
    const d = new Date(base);

    if (ev.endTime) {
        const [h, m] = ev.endTime.split(":").map(Number);
        d.setHours(h, m, 0, 0);
        return d;
    }

    // Inclusive all-day end
    d.setHours(23, 59, 59, 999);
    return d;
}

export function getEventStartMoment(ev: EventItem): Date {
    const d = new Date(ev.startDate);

    if (ev.startTime) {
        const [h, m] = ev.startTime.split(":").map(Number);
        d.setHours(h, m, 0, 0);
        return d;
    }

    d.setHours(0, 0, 0, 0);
    return d;
}

export function isEventArchived(ev: EventItem): boolean {
    return ev.archived === true;
}

export function hasEventEnded(ev: EventItem, now = new Date()): boolean {
    return getEventEndMoment(ev) < now;
}

// ----- Loading + sorting -----

export async function loadEventsPublished(): Promise<EventItem[]> {
    const entries = (await getCollection(
        "events",
        (e) => e.data.published !== false,
    )) as EventEntry[];

    return entries
        .map((e) => ({ id: e.id, ...e.data }))
        .sort((a, b) => getEventStartMoment(a).getTime() - getEventStartMoment(b).getTime());
}

let publishedEventsPromise: Promise<EventItem[]> | undefined;

export function loadEventsPublishedCached(): Promise<EventItem[]> {
    if (!publishedEventsPromise) {
        publishedEventsPromise = loadEventsPublished();
    }
    return publishedEventsPromise;
}

export function splitUpcoming(events: EventItem[], now = new Date()) {
    const upcoming = events.filter((ev) => !hasEventEnded(ev, now));
    return upcoming;
}

export async function loadUpcomingCandidates(now = new Date()): Promise<EventItem[]> {
    const events = await loadEventsPublishedCached();
    return getUpcomingCandidates(events, now);
}

export function getUpcomingCandidates(events: EventItem[], now = new Date()) {
    return events.filter(
        (ev) =>
            !hasEventEnded(ev, now) &&
            !isEventArchived(ev)
    );
}

export function getPromoCandidates(events: EventItem[], now = new Date()) {
    return events.filter(
        (ev) =>
            ev.promoBar?.enabled &&
            !!ev.promoBar?.message
    );
}

// ----- Picks -----

export function pickFeaturedHero(upcoming: EventItem[]): EventItem | null {
    return (
        upcoming.find((ev) => ev.featured && ev.image) ??
        upcoming.find((ev) => ev.image) ??
        null
    );
}

// ----- Formatting (display-only) -----

const utcDateFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
});

// const fmtDate = (d: Date) => utcDateFormatter.format(d);

const fmtDate = (d: Date | string | number) => {
    const date = d instanceof Date ? d : new Date(d);

    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${String(d)}`);
    }

    return utcDateFormatter.format(date);
};

export function fmtDateRange(ev: Pick<EventItem, "startDate" | "endDate">): string {
    return ev.endDate ? `${fmtDate(ev.startDate)} – ${fmtDate(ev.endDate)}` : fmtDate(ev.startDate);
}

// used in events/[id].astro
export function fmtTimeWindow(ev: Pick<EventItem, "startTime" | "endTime">): string {
    const { startTime, endTime } = ev;
    if (startTime && endTime) return `${fmtTime(startTime)}–${fmtTime(endTime)}`;
    if (startTime && !endTime) return `Starts ${fmtTime(startTime)}`;
    if (!startTime && endTime) return `Until ${fmtTime(endTime)}`;
    return "All day";
}

function fmtTime(time: string): string {
    if (!time) return "";
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

const getDatesBetween = (startDate: Date, endDate: Date) => {
    const dates = [];

    let currentDate = new Date(startDate);

    // let testCount = 0;
    while (currentDate <= endDate) {
        // if (testCount < 1) {
        //     console.log("startDate", startDate);
        //     console.log("currentDate", currentDate);
        //     console.log("endDate", endDate);
        // }
        // testCount++;
        dates.push(new Date(currentDate));
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return dates;
}

export const buildEventsByYearMonthDay = (evItems: EventItem[]) => {
    const eventsByYearMonthDay: EventsByYearMonthDay = {};

    for (const ev of evItems) {
        const year = ev.startDate.getUTCFullYear();
        const month = ev.startDate.getUTCMonth();
        const date = ev.startDate.getUTCDate();

        eventsByYearMonthDay[year] ||= {};
        eventsByYearMonthDay[year][month] ||= {};
        eventsByYearMonthDay[year][month][date] ||= [];

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
                const dateRange = getDatesBetween(ev.startDate, ev.endDate);
                // console.log("dateRange.length", dateRange.length);

                dateRange.forEach((date: Date) => {
                    const curYear = date.getUTCFullYear();
                    const curMonth = date.getUTCMonth();
                    const curDate = date.getUTCDate();
                    // console.log("ev", ev);

                    eventsByYearMonthDay[curYear] ||= {};
                    eventsByYearMonthDay[curYear][curMonth] ||= {};
                    eventsByYearMonthDay[curYear][curMonth][curDate] ||= [];

                    // eventsByYearMonthDay[curYear][curMonth][curDate].push(ev);

                    // try {
                    //     eventsByYearMonthDay[curYear][curMonth][date.getUTCDate()].push(ev);
                    // } catch {
                    //     failCount++;
                    // }
                    failCount++;
                });
            }

        } else {
            try {
                // eventsByYearMonthDay[year][month][date].push(ev);
            } catch {
                // console.log("failed inside else");
            }
        }
        eventsByYearMonthDay[year][month][date].push(ev);
        if (ev.funDate) {
            console.log("ev.title", ev.title);
            console.log("ev.funDate", ev.funDate);
            console.log("ev.funDate2", ev.funDate2);
            console.log("ev.funDate3", ev.funDate3);
            console.log("ev.funDate4", ev.funDate4);
        }

        failCount && console.log("failCount", failCount);
    }
    // console.log(eventsByYearMonthDay["2026"]["2"]["13"]);
    // console.log("-------------------");
    // console.log(eventsByYearMonthDay["2026"]["2"]["14"]);

    return eventsByYearMonthDay;
};