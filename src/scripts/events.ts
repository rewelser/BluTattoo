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

export function isEventPublished(ev: EventItem): boolean {
    return ev.published !== false;
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

export function splitUpcomingPast(events: EventItem[], now = new Date()) {
    const upcoming = events.filter((ev) => !hasEventEnded(ev, now));
    const past = events.filter((ev) => hasEventEnded(ev, now)).reverse();
    return { upcoming, past };
}

export async function loadPromoCandidateEvents(now = new Date()): Promise<EventItem[]> {
    const events = await loadEventsPublishedCached();

    return events.filter(
        (ev) =>
            !hasEventEnded(ev, now) &&
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

export const fmtDate = (d: Date) =>
    d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

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

// export function buildMonthlyEventsObject2(evItems: EventItem[]) {
//     const dates = [];
//     console.log("currentDate");
//     const monthlyEvItems = evItems.map((ev) => ({
//         ...ev, published: false
//     }));

//     // const resultObject = Object.fromEntries(
//     //     evItems.map(item => [item["startDate"], getMonthFromDate(item.startDate), item])
//     // );

//     // const resultObject = Object.fromEntries(
//     //     evItems.map(ev => [ev.startDate, ev.title])
//     // );


//     function groupBy<T>(arr: T[], key: (item: T) => string) {
//         return arr.reduce<Record<string, T[]>>((acc, item) => {
//             const k = key(item);
//             if (!acc[k]) acc[k] = [];
//             acc[k].push(item);
//             return acc;
//         }, {});
//     }

//     // const byMonth = groupBy(events, e => e.month);

//     // const byMonthAndDay = Object.fromEntries(
//     //     Object.entries(byMonth).map(([month, events]) => [
//     //         month,
//     //         groupBy(events, e => e.day)
//     //     ])
//     // );


//     ///-----------------------------------

//     function groupByMany<T>(
//         items: T[],
//         ...getKeys: Array<(item: T) => string>
//     ) {
//         const result: Record<string, any> = {};

//         for (const item of items) {
//             let currentLevel = result;

//             for (let i = 0; i < getKeys.length; i++) {
//                 const key = getKeys[i](item);
//                 const isLastKey = i === getKeys.length - 1;

//                 if (!currentLevel[key]) {
//                     currentLevel[key] = isLastKey ? [] : {};
//                 }

//                 if (isLastKey) {
//                     currentLevel[key].push(item);
//                 } else {
//                     currentLevel = currentLevel[key];
//                 }
//             }
//         }

//         return result;
//     }

//     ///---------------------

//     type EventsByYearMonthDay = Record<string, Record<string, Record<string, EventItem[]>>>;

//     function buildEventsByYearMonthDay(events: EventItem[]): EventsByYearMonthDay {
//         const result: EventsByYearMonthDay = {};

//         for (const ev of events) {
//             const year = ev.startDate.getFullYear().toString();
//             const month = ev.startDate.getMonth().toString();
//             const day = ev.startDate.getDate().toString();

//             result[year] ||= {};
//             result[year][month] ||= {};
//             result[year][month][day] ||= [];

//             result[year][month][day].push(ev);
//         }

//         return result;
//     }
//     ///---------------------

//     export const buildEventsByYearMonth = () => {

//     }
//     const eventsByYearMonth: Record<string, Record<string, EventItem[]>> = {};
//     // const rez2: Record<string, EventItem[]> = {};

//     for (const ev of evItems) {
//         const year = ev.startDate.getFullYear();
//         const month = ev.startDate.getMonth();
//         eventsByYearMonth[year] ||= {};
//         eventsByYearMonth[year][month] ||= [];

//         eventsByYearMonth[ev.startDate.getFullYear()][ev.startDate.getMonth()].push(ev);
//     }

//     console.log(rez);

//     // console.log(evItems[9].startDate.getFullYear());


//     // const array = [1, 2, 3, 4];
//     // const sumWithInitial = array.reduce(
//     //     (accumulator, currentValue) => accumulator + currentValue
//     // );

//     // console.log(sumWithInitial);

//     // console.log(resultObject);
//     // console.log(evItems);
//     // console.log(monthlyEvItems);
// }


export const buildEventsByYearMonthDay = (evItems: EventItem[]) => {

    const eventsByYearMonthDay: EventsByYearMonthDay = {};

    for (const ev of evItems) {
        const year = ev.startDate.getFullYear();
        const month = ev.startDate.getMonth();
        const date = ev.startDate.getDate();
        eventsByYearMonthDay[year] ||= {};
        eventsByYearMonthDay[year][month] ||= {};
        eventsByYearMonthDay[year][month][date] ||= [];

        eventsByYearMonthDay[year][month][date].push(ev);
    }

    return eventsByYearMonthDay;
}