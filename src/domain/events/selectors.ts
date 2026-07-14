import type {BySetPos, DateRange, EventItem, GuestItem, RecurrenceRule, RecurrentEventItem} from "./types.ts";
import {Temporal} from "temporal-polyfill";
import {weekdayTypes} from "./defs.ts";

export function getEventStartKey(ev: EventItem): string {
    return `${ev.startDate}T${ev.startTime ?? "00:00"}`;
}

export function getEventEndKey(ev: EventItem): string {
    const endDate = ev.endDate ?? ev.startDate;
    return `${endDate}T${ev.endTime ?? "23:59"}`;
}

export function getDateKey(date: Temporal.PlainDateTime): string {
    return date.toString({smallestUnit: "minute"});
}

export function getEventRecurrenceUntilKey(rev: RecurrentEventItem): string | undefined {
    const untilDate = rev.recurrenceRule.until;
    return untilDate ? `${untilDate}T23:59` : undefined;
}

export function soonest(a: Temporal.PlainDate, b: Temporal.PlainDate): Temporal.PlainDate {
    return Temporal.PlainDate.compare(a, b) <= 0 ? a : b;
}

export function latest(a: Temporal.PlainDate, b: Temporal.PlainDate): Temporal.PlainDate {
    return Temporal.PlainDate.compare(a, b) >= 0 ? a : b;
}

export function startOfWeek(date: Temporal.PlainDate): Temporal.PlainDate {
    return date.subtract({days: date.dayOfWeek % 7});
}

export function getBySetPos(date: Temporal.PlainDate): BySetPos {
    const isLastOccurrence = date.add({days: 7}).month !== date.month;

    if (isLastOccurrence) {
        return -1;
    } else {
        const weekNum = Math.ceil(date.day / 7);
        switch (weekNum) {
            case 1:
                return 1;
            case 2:
                return 2;
            case 3:
                return 3;
            case 4:
                return 4;
            default:
                throw new Error(`Unexpected weekday position: ${weekNum}`);
        }
    }
}

export function getMonthRange(year: number, month: number): DateRange {
    const start = Temporal.PlainDate.from(
        {year, month, day: 1},
        {overflow: "reject"},
    );

    return {
        start,
        endExclusive: start.add({months: 1}),
    };
}

// future consideration: full RRULE syntax converter
function toRRule(rule: RecurrenceRule): string {
    const parts: string[] = [];

    switch (rule.type) {
        case "recurrenceRuleWeekly": {
            parts.push("FREQ=WEEKLY");

            if (rule.interval && rule.interval !== 1) {
                parts.push(`INTERVAL=${rule.interval}`);
            }

            parts.push(`BYDAY=${rule.byDay.join(",")}`);

            break;
        }

        case "recurrenceRuleMonthlyByDate": {
            parts.push("FREQ=MONTHLY");

            if (rule.interval && rule.interval !== 1) {
                parts.push(`INTERVAL=${rule.interval}`);
            }

            parts.push(`BYMONTHDAY=${rule.byMonthDay}`);

            break;
        }

        case "recurrenceRuleMonthlyByOrdinalWeekday": {
            parts.push("FREQ=MONTHLY");

            if (rule.interval && rule.interval !== 1) {
                parts.push(`INTERVAL=${rule.interval}`);
            }

            parts.push(`BYDAY=${rule.byDay}`);
            parts.push(`BYSETPOS=${rule.bySetPos}`);

            break;
        }
    }

    if (rule.until) {
        parts.push(`UNTIL=${rule.until}`);
    }

    return `RRULE:${parts.join(";")}`;
}

/**
 * The extent to which hasEventEnded or hasEventStarted consider recurrent situations where recurrent events aren't
 * expanded. In those situations, we might only display one occurrence of the recurrent event for its duration or
 * the duration of the range--whichever ends first. But we also keep the recurrent event unexpanded so as to keep the
 * rrule on it, as we may use it for variable textual display of the recurrence info.
 */

export function hasEventEnded(ev: EventItem, nowKey: string): boolean {
    if (ev.recurrenceRule) {
        const untilKey = getEventRecurrenceUntilKey(ev as RecurrentEventItem);
        // if untilKey is undefined, then the recurrence (and thus the event) never ends
        return untilKey !== undefined && untilKey < nowKey;
    }
    return getEventEndKey(ev) < nowKey;
}

/**
 * todo - recurrence: probably wanna make this consider recurrences similarly to hasEventEnded... But also,
 *  might have to pair with validation rules in server.ts that try to ensure that the startDate indicates the first
 *  actual occurrence.
 */
export function hasEventStarted(ev: EventItem, nowKey: string): boolean {
    return getEventStartKey(ev) <= nowKey;
}

/**
 * "ev is GuestItem" is important; otherwise if we just returned boolean, TypeScript will not narrow the type
 * after .filter(isGuestSpot).
 */
export const isGuestSpot = (ev: EventItem): ev is GuestItem => {
    return !!ev.guestSpot;
};

export function isEventArchived(ev: EventItem): boolean {
    return ev.archived === true;
}

/**
 * New rrules need a new case in all 3 of the following methods:
 * getRecurrenceFirstOccurrence, expandRecurrentEventOccurrencesFromRange, recurrenceText
 */
export function recurrenceFirstOccurrenceMatchesStartDate(rev: RecurrentEventItem) {
    const rrule = rev.recurrenceRule;
    const revStart: Temporal.PlainDate = Temporal.PlainDate.from(rev.startDate);

    if (rrule.type === "recurrenceRuleWeekly") {
        const sortedByDay = rrule.byDay
            .sort((a, b) => weekdayTypes.indexOf(a) - weekdayTypes.indexOf(b));
        return sortedByDay[0].includes(weekdayTypes[revStart.dayOfWeek - 1]);
    }

    if (rrule.type === "recurrenceRuleMonthlyByDate") {
        return rrule.byMonthDay === revStart.day;
    }

    if (rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
        const revStartDayInByDay = rrule.byDay.includes(weekdayTypes[revStart.dayOfWeek - 1]);
        const revStartInBySetPos = rrule.bySetPos.includes(getBySetPos(revStart));
        return revStartDayInByDay && revStartInBySetPos;
    }
}

