import type {DateParts, EventItem} from "../types.ts";
import {getDateKey, getEventStartKey} from "../selectors.ts";
import {getEventRecurrenceUntilKey} from "./selectors.ts";
import {parseDateParts} from "../format.ts";
import type {ExpandRangeOptions, RecurrentEventItem} from "./types.ts";

/**
 * todo - recurrences: perhaps this is used by a buildRecurringEventsByYearMonthDate, and by a getUpcomingCandidates,
 *  returning a shape they both can enjoy :-3
 */
export function expandRecurrentEventOccurrencesFromRange(rev: RecurrentEventItem, options: ExpandRangeOptions): EventItem[] {
    let events: EventItem[] = [];
    const revStartKey = getEventStartKey(rev);
    const revUntilKey = getEventRecurrenceUntilKey(rev);
    const rrule = rev.recurrenceRule;
    let rangeStartKey: string;
    let rangeEndKey: string;
    if (options.kind === "range") {
        rangeStartKey = options.rangeStart instanceof Date ? getDateKey(options.rangeStart) : options.rangeStart;
        rangeEndKey = options.rangeEnd instanceof Date ? getDateKey(options.rangeEnd) : options.rangeEnd;
    } else if (options.kind === "days") {
        let rangeStart = options.rangeStart;
        rangeStartKey = "";
        if (rangeStart instanceof Date) {
            rangeStartKey = rangeStart instanceof Date ? getDateKey(rangeStart) : rangeStart;
        } else {
            const rangeStartDateParts: DateParts = parseDateParts(rangeStart);
            rangeStart = new Date(rangeStartDateParts.year, rangeStartDateParts.month - 1, rangeStartDateParts.date)
            rangeStartKey = getDateKey(rangeStart);
        }
        const rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + options.days);
        rangeEndKey = getDateKey(rangeEnd);

    } else {
        const rangeStart = new Date(options.year, options.month, 1);
        const rangeEnd = new Date(options.year, options.month + 1, 0);

        rangeStartKey = getDateKey(rangeStart);
        rangeEndKey = getDateKey(rangeEnd);
    }

    const overlaps = revStartKey < rangeEndKey && revUntilKey > rangeStartKey;
    const rangeStartKeyDateParts = parseDateParts(rangeStartKey);
    const rangeStartDate = new Date(rangeStartKeyDateParts.year, rangeStartKeyDateParts.month - 1, rangeStartKeyDateParts.date);
    const rangeEndKeyDateParts = parseDateParts(rangeEndKey);
    const rangeEndDate = new Date(rangeEndKeyDateParts.year, rangeEndKeyDateParts.month - 1, rangeEndKeyDateParts.date);


    console.log("rrule", rrule);
    console.log("overlaps", overlaps);
    console.log("///////////");

    if (overlaps) {
        let dateCursor = new Date(rangeStartDate);
        let dateCursorKey = rangeStartKey;

        while (dateCursorKey <= rangeEndKey) {
            if (rrule.type === "recurrenceRuleWeekly") {
                if (dateCursor.getDate)
                dateCursor.setDate(dateCursor.getDate() + 7);
                dateCursorKey = getDateKey(dateCursor);
            } else if (rrule.type === "recurrenceRuleMonthlyByDate" || rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
                // interval means repeat every N months. So, if date.getMonth % interval === 0 then that is one of the months to expand from.
                if (dateCursor.getMonth() % rrule.interval === 0) {
                    if (rrule.type === "recurrenceRuleMonthlyByDate") {

                    } else if (rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
                        // complex without temporal

                    }

                }
                dateCursor.setMonth(dateCursor.getMonth() + 1);
                dateCursorKey = getDateKey(dateCursor);
                // date.setMonth(date.getMonth() + 1);
            }


        }


        // if monthly recurrence

    }


    return [];

}

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
    // return [];
};