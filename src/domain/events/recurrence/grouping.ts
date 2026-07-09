import type {DateParts, EventItem} from "../types.ts";
import {getDateKey, getEventStartKey} from "../selectors.ts";
import {getEventRecurrenceUntilKey} from "./selectors.ts";
import {parseDateParts} from "../format.ts";
import type {ExpandRangeOptions, RecurrentEventItem} from "./types.ts";
import {Temporal} from "temporal-polyfill";

/**
 * todo - recurrences: perhaps this is used by a buildRecurringEventsByYearMonthDate, and by a getUpcomingCandidates,
 *  returning a shape they both can enjoy :-3
 */
export function expandRecurrentEventOccurrencesFromRange(rev: RecurrentEventItem, options: ExpandRangeOptions): EventItem[] {
    let events: EventItem[] = [];
    const rrule = rev.recurrenceRule;
    const revStart: Temporal.PlainDate = Temporal.PlainDate.from(rev.startDate);
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

    const recurrenceStart: Temporal.PlainDate = Temporal.PlainDate.from(rev.startDate);
    console.log("recurrenceStart",recurrenceStart.toString());
    console.log("rangeStart",rangeStart.toString());
    console.log(rangeStart.since(recurrenceStart));
    const revVirtualUntil: Temporal.PlainDate = Temporal.PlainDate.from(rrule.until ?? rangeEnd);

//     const overlaps = revStartKey < rangeEndKey && revUntilKey > rangeStartKey;

    const revStartsBeforeRangeEnd = Temporal.PlainDate.compare(revStart, rangeEnd) === -1;
    const revEndsAfterRangeStart = Temporal.PlainDate.compare(rangeStart, revVirtualUntil) === -1;
    const overlaps = revStartsBeforeRangeEnd && revEndsAfterRangeStart;
    // console.table({
    //     rangeStart: rangeStart.toString(),
    //     rangeEnd: rangeEnd.toString(),
    //     revStart: revStart.toString(),
    //     revVirtualUntil: revVirtualUntil.toString(),
    //     overlaps: overlaps.toString(),
    // });


    if (overlaps) {
        let dateCursor = rangeStart;
        let stillInRange = Temporal.PlainDate.compare(dateCursor, rangeEnd) < 0;
        // console.table({
        //     stillInRange: stillInRange.toString(),
        //     dateCursor: dateCursor.toString(),
        //     "dateCursor.weekOfYear": dateCursor.weekOfYear,
        //
        //
        // });

        const killcount = 60;
        let count = 0;

        while (Temporal.PlainDate.compare(dateCursor, rangeEnd) < 0) {
            // console.table({
            //     stillInRangeComparison: Temporal.PlainDate.compare(dateCursor, rangeEnd),
            //     dateCursor: dateCursor.toString(),
            //     "dateCursor.weekOfYear": dateCursor.weekOfYear,
            // });

            if (rrule.type === "recurrenceRuleWeekly") {
                console.log("recurrenceRuleWeekly");
                if (dateCursor.weekOfYear && dateCursor.weekOfYear % rrule.interval === 0) {
                    console.log("recurrenceRuleWeekly - event ")

                }
                dateCursor = dateCursor.add({weeks: 1});
            } else if (rrule.type === "recurrenceRuleMonthlyByDate" || rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
                console.log("recurrenceRuleMonthly");
                // interval means repeat every N months. So, if dateCursor.month % interval === 0 then that is one of the months to expand from.
                if (dateCursor.month % rrule.interval === 0) {
                    if (rrule.type === "recurrenceRuleMonthlyByDate") {

                    } else if (rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
                        // complex without temporal... hmmmm....

                    }
                }
                dateCursor = dateCursor.add({months: 1});
            }
            stillInRange = Temporal.PlainDate.compare(dateCursor, rangeEnd) ! > 0;
            console.log("--------------------");
        }

    }
    return [];
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

    const expandedRecurrentEventOccurrences: EventItem[] = evItems
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

    return expandedRecurrentEventOccurrences;
};