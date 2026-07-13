import type {EventItem} from "../types.ts";
import type {BySetPos, ExpandRangeOptions, RecurrentEventItem} from "./types.ts";
import {Temporal} from "temporal-polyfill";
import {weekdayTypes} from "./defs.ts";
import Duration = Temporal.Duration;
import {getBySetPos, inRange, latest, soonest, startOfWeek} from "./selectors.ts";

/**
 * todo - recurrences: perhaps this is used by a buildRecurringEventsByYearMonthDate, and by a getUpcomingCandidates,
 *  returning a shape they both can enjoy :-3
 */
export function expandRecurrentEventOccurrencesFromRange(rev: RecurrentEventItem, options: ExpandRangeOptions): EventItem[] {
    let events: EventItem[] = [];
    const rrule = rev.recurrenceRule;
    const revStart: Temporal.PlainDate = Temporal.PlainDate.from(rev.startDate);
    const revEnd: Temporal.PlainDate | undefined = rev.endDate ? Temporal.PlainDate.from(rev.endDate) : undefined;
    const eventOccurrenceDuration: Duration | undefined = revEnd ? revStart.until(revEnd) : undefined;
    let rangeStart: Temporal.PlainDate;
    let rangeEnd: Temporal.PlainDate;

    if (options.kind === "range") {
        rangeStart = Temporal.PlainDate.from(options.rangeStart);
        rangeEnd = Temporal.PlainDate.from(options.rangeEnd);
    } else if (options.kind === "days") {
        rangeStart = Temporal.PlainDate.from(options.rangeStart);
        rangeEnd = rangeStart.add({days: options.days});
    } else {
        rangeStart = Temporal.PlainDate.from({year: options.year, month: options.month, day: 1});
        rangeEnd = rangeStart.with({day: Number.MAX_VALUE});
    }

    const revVirtualUntil: Temporal.PlainDate = Temporal.PlainDate.from(rrule.until ?? rangeEnd);

//     const overlaps = revStartKey < rangeEndKey && revUntilKey > rangeStartKey;

    const revStartsBeforeRangeEnd = Temporal.PlainDate.compare(revStart, rangeEnd) <= 0;
    const revEndsAfterRangeStart = Temporal.PlainDate.compare(rangeStart, revVirtualUntil) <= 0;
    const overlaps = revStartsBeforeRangeEnd && revEndsAfterRangeStart;
    console.table({
        rangeStart: rangeStart.toString(),
        rangeEnd: rangeEnd.toString(),
        revStart: revStart.toString(),
        revVirtualUntil: revVirtualUntil.toString(),
        overlaps: overlaps.toString(),
    });

    if (overlaps) {
        const latestStart = latest(revStart, rangeStart);
        const soonestEnd = soonest(revVirtualUntil, rangeEnd);
        let dateCursor = latestStart;
        let occurrenceKeyCount = 0;

        if (rrule.type === "recurrenceRuleWeekly") {
            while (inRange(dateCursor, latestStart, soonestEnd)) {
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
            while (inRange(dateCursor, latestStart, soonestEnd)) {
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
            while (inRange(dateCursor, latestStart, soonestEnd)) {
                const monthsSinceStart = dateCursor.with({day: 1}).since(revStart.with({day: 1}), {largestUnit: "months"}).months;
                const matchesInterval = monthsSinceStart % rrule.interval === 0;
                const cursorInBySetPos = rrule.bySetPos.includes(getBySetPos(dateCursor));
                // const byDayNum = weekdayTypes.indexOf(rrule.byDay) + 1;
                // const cursorDayInByMonthDay = byDayNum === dateCursor.day;
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

        // while (cursorStillInRange(dateCursor, latestStart, soonestEnd)) {
        //     // console.table({
        //     //     stillInRangeComparison: Temporal.PlainDate.compare(dateCursor, rangeEnd),
        //     //     dateCursor: dateCursor.toString(),
        //     //     "dateCursor.weekOfYear": dateCursor.weekOfYear,
        //     // });
        //
        //     if (rrule.type === "recurrenceRuleWeekly") {
        //         const weeksSinceStart = dateCursor.with({day: 1}).since(revStart.with({day: 1}), {largestUnit: "weeks"}).weeks;
        //         const matchesInterval = weeksSinceStart % rrule.interval === 0;
        //         if (matchesInterval) {
        //             // expand into event(s)
        //
        //             rrule.byDay.map((byDay) => {
        //                 const targetDayOfWeek = weekdayTypes.indexOf(byDay) + 1;
        //                 const newStartDate = Temporal.PlainDate.from(dateCursor.add({days: targetDayOfWeek - dateCursor.dayOfWeek}));
        //                 const expandedEvent = {
        //                     ...rev,
        //                     startDate: newStartDate.toString(),
        //                     ...(eventOccurrenceDuration && {
        //                         endDate: newStartDate.add(eventOccurrenceDuration).toString(),
        //                     })
        //                 }
        //                 events.push(expandedEvent);
        //             })
        //         }
        //         dateCursor = dateCursor.add({weeks: 1});
        //     } else if (rrule.type === "recurrenceRuleMonthlyByDate" || rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
        //         const monthsSinceStart = dateCursor.with({day: 1}).since(revStart.with({day: 1}), {largestUnit: "months"}).months;
        //         const matchesInterval = monthsSinceStart % rrule.interval === 0;
        //
        //         // interval means repeat every N months. So, if dateCursor.month % interval === 0 then that is one of the months to expand from.
        //         if (matchesInterval) {
        //             if (rrule.type === "recurrenceRuleMonthlyByDate") {
        //                 console.log("recurrenceRuleMonthlyByDate");
        //                 console.log("rev", rev);
        //                 const newStartDate = Temporal.PlainDate.from(dateCursor.with({day: rrule.byMonthDay}));
        //                 console.log("rev newStartDate", newStartDate);
        //                 const {recurrenceRule, ...revWithoutRrule} = rev;
        //                 const expandedEvent = {
        //                     ...revWithoutRrule,
        //                     startDate: newStartDate.toString(),
        //                     ...(eventOccurrenceDuration && {
        //                         endDate: newStartDate.add(eventOccurrenceDuration).toString(),
        //                     })
        //                 }
        //                 console.log("expandedEvent", expandedEvent);
        //
        //                 events.push(expandedEvent);
        //
        //             } else if (rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
        //                 const weekdayOrdinal = weekdayTypes.indexOf(rrule.byDay) + 1;
        //                 console.log("weekdayOrdinal", weekdayOrdinal);
        //                 // switch (rrule.bySetPos) {
        //                 //     case 1:
        //                 //         break;
        //                 //         case 2:
        //                 //             break;
        //                 //             case 3:
        //                 //                 break;
        //                 //                 case 4:
        //                 //                     break;
        //                 //                 default:
        //                 // }
        //                 console.log("recurrenceRuleMonthlyByOrdinalWeekday");
        //                 console.log("rev.id", rev.id);
        //
        //                 // complex without temporal... hmmmm....
        //
        //             }
        //         }
        //         dateCursor = dateCursor.add({months: 1});
        //     }
        //     console.log("--------------------");
        // }

    }
    return events;
}

// export function expandRecurrentEventOccurrencesFromRange(rev: RecurrentEventItem, options: ExpandRangeOptions): EventItem[] {
//     let events: EventItem[] = [];
//     const revStartKey = getEventStartKey(rev);
//     const revUntilKey = getEventRecurrenceUntilKey(rev);
//     const rrule = rev.recurrenceRule;
//     let rangeStartKey: string;
//     let rangeEndKey: string;
//     if (options.kind === "range") {
//         rangeStartKey = options.rangeStart instanceof Date ? getDateKey(options.rangeStart) : options.rangeStart;
//         rangeEndKey = options.rangeEnd instanceof Date ? getDateKey(options.rangeEnd) : options.rangeEnd;
//     } else if (options.kind === "days") {
//         let rangeStart = options.rangeStart;
//         rangeStartKey = "";
//         if (rangeStart instanceof Date) {
//             rangeStartKey = rangeStart instanceof Date ? getDateKey(rangeStart) : rangeStart;
//         } else {
//             const rangeStartDateParts: DateParts = parseDateParts(rangeStart);
//             rangeStart = new Date(rangeStartDateParts.year, rangeStartDateParts.month - 1, rangeStartDateParts.date)
//             rangeStartKey = getDateKey(rangeStart);
//         }
//         const rangeEnd = new Date(rangeStart);
//         rangeEnd.setDate(rangeEnd.getDate() + options.days);
//         rangeEndKey = getDateKey(rangeEnd);
//
//     } else {
//         const rangeStart = new Date(options.year, options.month, 1);
//         const rangeEnd = new Date(options.year, options.month + 1, 0);
//
//         rangeStartKey = getDateKey(rangeStart);
//         rangeEndKey = getDateKey(rangeEnd);
//     }
//
//     const overlaps = revStartKey < rangeEndKey && revUntilKey > rangeStartKey;
//     const rangeStartKeyDateParts = parseDateParts(rangeStartKey);
//     const rangeStartDate = new Date(rangeStartKeyDateParts.year, rangeStartKeyDateParts.month - 1, rangeStartKeyDateParts.date);
//     const rangeEndKeyDateParts = parseDateParts(rangeEndKey);
//     const rangeEndDate = new Date(rangeEndKeyDateParts.year, rangeEndKeyDateParts.month - 1, rangeEndKeyDateParts.date);
//
//
//     console.log("rrule", rrule);
//     console.log("overlaps", overlaps);
//     console.log("///////////");
//
//     if (overlaps) {
//         let dateCursor = new Date(rangeStartDate);
//         let dateCursorKey = rangeStartKey;
//
//         while (dateCursorKey <= rangeEndKey) {
//             if (rrule.type === "recurrenceRuleWeekly") {
//                 if (dateCursor.getDate)
//                     // this will not work; I'd need to keep track of the starting day and then using modulo (I think) determine whether a week has passed, and then use that to increment maybe another cursor compared against interval(?)
//                     dateCursor.setDate(dateCursor.getDate() + 7);
//                 dateCursorKey = getDateKey(dateCursor);
//             } else if (rrule.type === "recurrenceRuleMonthlyByDate" || rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
//                 // interval means repeat every N months. So, if date.getMonth % interval === 0 then that is one of the months to expand from.
//                 if (dateCursor.getMonth() % rrule.interval === 0) {
//                     if (rrule.type === "recurrenceRuleMonthlyByDate") {
//
//                     } else if (rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
//                         // complex without temporal... hmmmm....
//
//                     }
//
//                 }
//                 dateCursor.setMonth(dateCursor.getMonth() + 1);
//                 dateCursorKey = getDateKey(dateCursor);
//             }
//
//
//         }
//     }
//
//
//     return []; // for now, since this function isn't finished
//
// }


/**
 * todo - recurrences: or, 'buildMonthBoundedRecurrentEvents'? Also: is this a sister method to buildEventsByYearMonthDate,
 *  or is it called by maybe EventsCalendar.tsx before passing in events to buildEventsByYearMonthDate?
 *  fyi, that doesn't really make sense, unless the bounded month range is passed into this, which is passed into expandRecurrentEventsFromRange,
 *  returning ultimately one month's-worth of recurrent events, which are then tacked onto events inside EventsCalendar.tsx,
 *  which is THEN passed into buildEventsByYearMonthDate. In which case, it makes total sense. But in that case, the return
 *  for this can't be type EventsByYearMonthDate, but must simply be EventItem[].
 */
export const buildMonthBoundedRecurrentEvents = (evItems: EventItem[], year: number, month: number): EventItem[] => {
    return evItems
        .filter((ev) => ev.recurrenceRule)
        .flatMap(ev => {
                return expandRecurrentEventOccurrencesFromRange(
                    ev as RecurrentEventItem, {
                        kind: "month",
                        year: year,
                        month: month,
                    }
                )
            }
        );
};