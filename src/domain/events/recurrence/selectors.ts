import type {BySetPos, RecurrenceFrequency, RecurrenceRule, RecurrentEventItem} from "./types.ts";
import {Temporal} from "temporal-polyfill";

export function getEventRecurrenceUntilKey(rev: RecurrentEventItem): string {
    const untilDate = rev.recurrenceRule.until;
    return `${untilDate}T23:59`;
}

export function soonest(a: Temporal.PlainDate, b: Temporal.PlainDate): Temporal.PlainDate {
    return Temporal.PlainDate.compare(a, b) <= 0 ? a : b;
}

export function latest(a: Temporal.PlainDate, b: Temporal.PlainDate): Temporal.PlainDate {
    return Temporal.PlainDate.compare(a, b) >= 0 ? a : b;
}

export function inRange(date: Temporal.PlainDate, rangeStart: Temporal.PlainDate, rangeEnd: Temporal.PlainDate) {
    return Temporal.PlainDate.compare(date, rangeStart) >= 0 && Temporal.PlainDate.compare(date, rangeEnd) <= 0;
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