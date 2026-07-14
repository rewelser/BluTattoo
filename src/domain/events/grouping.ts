import type {DateRange, EventItem, EventsByYearMonthDate, RecurrentEventItem} from "./types";
import {
    getBySetPos,
    getDateKey,
    getEventStartKey,
    getMonthRange,
    hasEventEnded,
    isEventArchived, latest, soonest,
    startOfWeek
} from "./selectors.ts";
import {Temporal} from "temporal-polyfill";
import {UPCOMING_EVENT_RANGE, weekdayTypes} from "./defs.ts";
import Duration = Temporal.Duration;

const getDatesBetweenInclusive = (
    startDate: string,
    endDate: string,
): string[] => {
    let cur = Temporal.PlainDate.from(startDate);
    const end = Temporal.PlainDate.from(endDate);

    const dates: string[] = [];

    while (Temporal.PlainDate.compare(cur, end) <= 0) {
        dates.push(cur.toString());
        cur = cur.add({days: 1});
    }

    return dates;
};

export const buildMonthBoundedRecurrentEvents = (evItems: EventItem[], year: number, month: number): EventItem[] => {
    return evItems
        .filter((ev) => ev.recurrenceRule)
        .flatMap(ev => expandRecurrentEventOccurrencesFromRange(ev as RecurrentEventItem, getMonthRange(year, month)));
};

export const buildEventsByYearMonthDate = (evItems: EventItem[], traversedMonthStartDate: Temporal.PlainDate) => {
    const eventsByYearMonthDate: EventsByYearMonthDate = {};

    const recurrentEventsByMonth = buildMonthBoundedRecurrentEvents(evItems, traversedMonthStartDate.year, traversedMonthStartDate.month);
    evItems = evItems.concat(recurrentEventsByMonth);

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
export function getUpcomingCandidates(events: EventItem[], now: Temporal.PlainDateTime) {
    const today = now.toPlainDate();
    const upcomingDateRange: DateRange = {
        start: today,
        endExclusive: today.add({days: UPCOMING_EVENT_RANGE}),
    };

    return events
        /**
         * This flatmap will be unused, because expanding out the recurring events creates too much clutter in
         * areas relying on upcoming candidate data.
         */
        // .flatMap(ev => {
        //     if (ev.recurrenceRule) {
        //         return expandRecurrentEventOccurrencesFromRange(ev as RecurrentEventItem, upcomingDateRange)
        //     }
        //     return [ev];
        // })
        .filter((ev) =>
            !hasEventEnded(ev, getDateKey(now)) &&
            !isEventArchived(ev) &&
            Temporal.PlainDate.compare(Temporal.PlainDate.from(ev.startDate), upcomingDateRange.endExclusive) < 0)
        .sort((a, b) => getEventStartKey(a).localeCompare(getEventStartKey(b)));
}

export function getPromoCandidates(events: EventItem[]) {
    return events.filter(
        (ev) =>
            ev.promoBar?.enabled &&
            !!ev.promoBar?.message
    );
}

// todo: fix that it thinks upcoming can now be undefined? (where this is called in UpcomingEvents.astro)
export function pickFeaturedHero(upcoming: EventItem[]): EventItem | null {
    return (
        upcoming.find((ev) => ev.featured && ev.image) ??
        upcoming.find((ev) => ev.image) ??
        null
    );
}

/**
 * New rrules need a new case in all 3 of the following methods:
 * getRecurrenceFirstOccurrence, expandRecurrentEventOccurrencesFromRange, recurrenceText
 */
export function expandRecurrentEventOccurrencesFromRange(rev: RecurrentEventItem, range: DateRange): EventItem[] {
    let events: EventItem[] = [];
    const rrule = rev.recurrenceRule;
    const revStart: Temporal.PlainDate = Temporal.PlainDate.from(rev.startDate);
    const revEnd: Temporal.PlainDate | undefined = rev.endDate ? Temporal.PlainDate.from(rev.endDate) : undefined;
    const eventOccurrenceDuration: Duration | undefined = revEnd ? revStart.until(revEnd) : undefined;

    const revVirtualUntil: Temporal.PlainDate = rrule.until
        ? Temporal.PlainDate.from(rrule.until).add({days: 1})
        : range.endExclusive;

    const revStartsBeforeRangeEndExclusive = Temporal.PlainDate.compare(revStart, range.endExclusive) < 0;
    const revEndsAfterRangeStart = Temporal.PlainDate.compare(range.start, revVirtualUntil) < 0;
    const overlaps = revStartsBeforeRangeEndExclusive && revEndsAfterRangeStart;

    if (overlaps) {
        const latestStart = latest(revStart, range.start);
        const soonestEndExclusive = soonest(revVirtualUntil, range.endExclusive);
        let dateCursor = latestStart;
        let occurrenceKeyCount = 0;

        if (rrule.type === "recurrenceRuleWeekly") {
            while (Temporal.PlainDate.compare(dateCursor, soonestEndExclusive) < 0) {
                const weeksSinceStart = startOfWeek(dateCursor).since(startOfWeek(revStart), {largestUnit: "weeks"}).weeks;
                const matchesInterval = weeksSinceStart % rrule.interval === 0;
                const cursorDayInByDay = rrule.byDay.includes(weekdayTypes[dateCursor.dayOfWeek - 1]);

                if (matchesInterval && cursorDayInByDay) {
                    const {recurrenceRule, ...revWithoutRrules} = rev;
                    const expandedEvent = {
                        ...revWithoutRrules,
                        // ...rev,
                        startDate: dateCursor.toString(),
                        ...(eventOccurrenceDuration && {
                            endDate: dateCursor.add(eventOccurrenceDuration).toString(),
                        }),
                        occurrenceKey: `${rev.id}-${dateCursor.toString()}-${occurrenceKeyCount++}`,
                    }
                    events.push(expandedEvent);
                }
                dateCursor = dateCursor.add({days: 1});
            }
        }

        if (rrule.type === "recurrenceRuleMonthlyByDate") {
            while (Temporal.PlainDate.compare(dateCursor, soonestEndExclusive) < 0) {
                const monthsSinceStart = dateCursor.with({day: 1}).since(revStart.with({day: 1}), {largestUnit: "months"}).months;
                const matchesInterval = monthsSinceStart % rrule.interval === 0;
                const cursorDayInByMonthDay = rrule.byMonthDay === dateCursor.day;

                if (matchesInterval && cursorDayInByMonthDay) {
                    const newStartDate = Temporal.PlainDate.from(dateCursor.with({day: rrule.byMonthDay}));
                    const {recurrenceRule, ...revWithoutRrule} = rev;
                    const expandedEvent = {
                        ...revWithoutRrule,
                        startDate: newStartDate.toString(),
                        ...(eventOccurrenceDuration && {
                            endDate: newStartDate.add(eventOccurrenceDuration).toString(),
                        }),
                        occurrenceKey: `${rev.id}-${newStartDate.toString()}-${occurrenceKeyCount++}`,
                    }
                    events.push(expandedEvent);
                }
                dateCursor = dateCursor.add({days: 1});
            }
        }

        if (rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
            while (Temporal.PlainDate.compare(dateCursor, soonestEndExclusive) < 0) {
                const monthsSinceStart = dateCursor.with({day: 1}).since(revStart.with({day: 1}), {largestUnit: "months"}).months;
                const matchesInterval = monthsSinceStart % rrule.interval === 0;
                const cursorInBySetPos = rrule.bySetPos.includes(getBySetPos(dateCursor));
                const cursorDayInByDay = rrule.byDay.includes(weekdayTypes[dateCursor.dayOfWeek - 1]);

                if (matchesInterval && cursorDayInByDay && cursorInBySetPos) {
                    const {recurrenceRule, ...revWithoutRrules} = rev;
                    const expandedEvent = {
                        ...revWithoutRrules,
                        // ...rev,
                        startDate: dateCursor.toString(),
                        ...(eventOccurrenceDuration && {
                            endDate: dateCursor.add(eventOccurrenceDuration).toString(),
                        }),
                        occurrenceKey: `${rev.id}-${dateCursor.toString()}-${occurrenceKeyCount++}`,
                    }
                    events.push(expandedEvent);
                }
                dateCursor = dateCursor.add({days: 1});
            }
        }
    }
    return events;
}