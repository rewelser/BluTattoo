import type {EventItem, EventsByYearMonthDate} from "./types";
import {getDateKey, getEventStartKey, hasEventEnded, isEventArchived} from "./selectors.ts";
import {expandRecurrentEventOccurrencesFromRange} from "./recurrence/grouping.ts";
import type {RecurrentEventItem} from "./recurrence/types.ts";
import {upcomingEventRecurrenceExpansionRange} from "./recurrence/defs.ts";
import {Temporal} from "temporal-polyfill";

const getDatesBetweenInclusive = (
    startDate: string,
    endDate: string,
): string[] => {
    let cur = Temporal.PlainDate.from(startDate);
    const end = Temporal.PlainDate.from(endDate);

    const dates: string[] = [];

    while (Temporal.PlainDate.compare(cur, end) <= 0) {
        dates.push(cur.toString());
        cur = cur.add({ days: 1 });
    }

    return dates;
};

export const buildEventsByYearMonthDate = (evItems: EventItem[]) => {
    const eventsByYearMonthDate: EventsByYearMonthDate = {};

    for (const ev of evItems) {
        const [startYear, startMonth, startDate] = ev.startDate.split("-");

        eventsByYearMonthDate[startYear] ||= {};
        eventsByYearMonthDate[startYear][startMonth] ||= {};
        eventsByYearMonthDate[startYear][startMonth][startDate] ||= [];

        if (!!ev.endDate && !ev.recurrenceRule) {

            const dateRange = getDatesBetweenInclusive(ev.startDate, ev.endDate);

            dateRange.forEach((date: string) => {
                const [curYear, curMonth, curDate] = date.split("-");

                eventsByYearMonthDate[curYear] ||= {};
                eventsByYearMonthDate[curYear][curMonth] ||= {};
                eventsByYearMonthDate[curYear][curMonth][curDate] ||= [];

                eventsByYearMonthDate[curYear][curMonth][curDate].push(ev);
            });

        } else if (!ev.recurrenceRule) {
            eventsByYearMonthDate[startYear][startMonth][startDate].push(ev);
        }
    }
    return eventsByYearMonthDate;
};



/**
 * todo - recurreces: How will we deal with this? getEventStartKey won't work, because for a recurrence, that will merely be
 *  the beginning of the first instance, not necessarily the next-most-upcoming instance.
 *  This is actually the most pertinent place to start for where all compoarisons are made that rely on an upcoming candidate list
 *  of events. MenuGuestSpotItems.astro is one such place, but any area using an upcoming candidate list of events will need
 *  that list to include the expanded event occurrences of recurring events (either as EventItems themselves, or some other object),
 *  expanded via an expansion range -- meaning that 'upcoming' has to entail a discrete range specifically for recurring events.
 *  one month is a decent idea, or 30 days, or 2 months.
 */
export function getUpcomingCandidates(events: EventItem[], now = Temporal.Now.instant(), timeZone = "America/New_York") {
    // todo - recurrences
    // for (const event of events) {
    //     if (event.recurrenceRule) {
    //         expandRecurrentEventOccurrencesFromRange(event as RecurrentEventItem, {
    //             kind: "days",
    //             rangeStart: now,
    //             days: upcomingEventRecurrenceExpansionRange
    //         })
    //     }
    // }
    // todo - recurrences - end


    return events.filter(
        (ev) =>
            !hasEventEnded(ev, getDateKey(now, timeZone)) &&
            !isEventArchived(ev)
    ).sort((a, b) => getEventStartKey(a).localeCompare(getEventStartKey(b)));
}

export function getPromoCandidates(events: EventItem[]) {
    return events.filter(
        (ev) =>
            ev.promoBar?.enabled &&
            !!ev.promoBar?.message
    );
}

export function pickFeaturedHero(upcoming: EventItem[]): EventItem | null {
    return (
        upcoming.find((ev) => ev.featured && ev.image) ??
        upcoming.find((ev) => ev.image) ??
        null
    );
}