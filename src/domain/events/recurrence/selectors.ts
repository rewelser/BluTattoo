import type {RecurrenceFrequency, RecurrenceRule, RecurrentEventItem} from "./types.ts";

export function getEventRecurrenceUntilKey(rev: RecurrentEventItem): string {
    const untilDate = rev.recurrenceRule.until;
    return `${untilDate}T23:59`;
}

// future consideration: full RRULE syntax converter -- consider this over the function above this, which is probably useless
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