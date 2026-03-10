// src/scripts/events.ts
import { getCollection, type CollectionEntry } from "astro:content";

export type EventEntry = CollectionEntry<"events">;
export type EventItem = EventEntry["data"] & { id: string };
export type MonthOccurrence = { date: Date; event: EventItem };
export type EventsByYearMonthDay = Record<string, Record<string, Record<string, EventItem[]>>>;

// ----- Date helpers (inclusive endDate, day-level comparisons) -----

export function getEventEndMoment(ev: EventItem): Date {
    const base = ev.endDate ?? ev.startDate;
    const d = new Date(base);

    if (ev.endTime) {
        const [h, m] = ev.endTime.split(":").map(Number);
        d.setUTCHours(h, m, 0, 0);
        return d;
    }

    // Inclusive all-day end
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

export function getEventStartMoment(ev: EventItem): Date {
    const d = new Date(ev.startDate);

    if (ev.startTime) {
        const [h, m] = ev.startTime.split(":").map(Number);
        d.setUTCHours(h, m, 0, 0);
        return d;
    }

    d.setUTCHours(0, 0, 0, 0);
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

const fmtDate = (d: Date) => utcDateFormatter.format(d);

export function fmtDateRange(ev: Pick<EventItem, "startDate" | "endDate">): string {
    return ev.endDate ? `${fmtDate(ev.startDate)} – ${fmtDate(ev.endDate)}` : fmtDate(ev.startDate);
}

export function fmtTimeWindow(ev: Pick<EventItem, "startTime" | "endTime">): string {
    const { startTime, endTime } = ev;
    if (startTime && endTime) return `${startTime}–${endTime}`;
    if (startTime && !endTime) return `Starts ${startTime}`;
    if (!startTime && endTime) return `Until ${endTime}`;
    return "All day";
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

        eventsByYearMonthDay[year][month][date].push(ev);
    }

    return eventsByYearMonthDay;
};