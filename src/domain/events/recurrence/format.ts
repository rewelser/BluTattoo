import {type RecurrentEventItem} from "./types.ts";
import {bySetPosNames, bySetPosTypes, weekdayNames, weekdayTypes} from "./defs.ts";

function ordinalNumerical(n: number) {
    const suffix =
        n % 10 === 1 && n % 100 !== 11
            ? "st"
            : n % 10 === 2 && n % 100 !== 12
                ? "nd"
                : n % 10 === 3 && n % 100 !== 13
                    ? "rd"
                    : "th";

    return `${n}${suffix}`;
}

export function recurrenceText(rev: RecurrentEventItem) {
    const rrule = rev.recurrenceRule;
    const interval = rrule.interval;

    if (rrule.type === "recurrenceRuleWeekly") {
        let weekyString = `Every `;

        if (interval > 1) {
            const ordinality = interval === 2 ? `other` : ordinalNumerical(interval);
            weekyString += `${ordinality} `;
        }

        const byDay = weekdayTypes
            .filter((day) => rrule.byDay.includes(day))
            .map((day, index) => weekdayNames[day]);

        weekyString += new Intl.ListFormat("en", {
            style: "long",
            type: "conjunction",
        }).format(byDay);

        return weekyString;
    }

    if (rrule.type === "recurrenceRuleMonthlyByDate") {
        const byMonthDay = rrule.byMonthDay;
        const byMonthDayOrdinal = ordinalNumerical(byMonthDay);

        let monthlyByDateString = `The ${byMonthDayOrdinal} of`;

        if (interval > 1) {
            const ordinality = interval === 2 ? `other` : ordinalNumerical(interval);
            monthlyByDateString += ` every ${ordinality} month (if applicable)`;
        } else {
            monthlyByDateString += ` every month (if applicable)`;
        }
        return monthlyByDateString;
    }

    if (rrule.type === "recurrenceRuleMonthlyByOrdinalWeekday") {
        const dayName = weekdayNames[rrule.byDay];
        const bySetPos = bySetPosTypes
            .filter((setPos) => rrule.bySetPos.includes(setPos))
            .map((setPos, index) => bySetPosNames[setPos]);

        let monthlyByOrdinalWeekday = `The ` + new Intl.ListFormat("en", {
            style: "long",
            type: "conjunction",
        }).format(bySetPos) + ` ${dayName} of`;

        if (interval > 1) {
            const ordinality = interval === 2 ? `other` : ordinalNumerical(interval);
            monthlyByOrdinalWeekday += ` every ${ordinality} month`;
        } else {
            monthlyByOrdinalWeekday += ` every month`;
        }
        return monthlyByOrdinalWeekday;

    }
}