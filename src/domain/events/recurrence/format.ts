import {type RecurrentEventItem, type Weekday, weekdayNames} from "./types.ts";
import {weekdayTypes} from "./defs.ts";

function ordinalWord(value: number | string) {
    const map: Record<string, string> = {
        "1": "first",
        "2": "second",
        "3": "third",
        "4": "fourth",
        "5": "fifth",
        "-1": "last",

        first: "first",
        second: "second",
        third: "third",
        fourth: "fourth",
        fifth: "fifth",
        last: "last",
    };
}

function ordinalDay(n: number) {
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


        let everyXDaysString = `Every `;
        const everyXDays_old = rrule.byDay.map((day) => {
            return weekdayNames[day];
        });

        const ordinality = interval === 2 ? `other` : ordinalDay(interval);
        everyXDaysString += `${ordinality} `;

        const everyXDays = weekdayTypes
            .filter((day) => rrule.byDay.includes(day))
            .map((day, index) => weekdayNames[day]);

        if (everyXDays.length === 1) {
            everyXDaysString = `${everyXDays[0]}`;
        } else if (everyXDays.length === 2) {
            everyXDaysString = `${everyXDays[0]} & ${everyXDays[1]}`;
        } else {
            for (let i = 0; i < everyXDays.length; i++) {
                console.log("everyXDays[" + i + "]", everyXDays[i]);
                if (i < everyXDays.length - 1) {
                    console.log("entered i < everyXDays.length - 1");
                    everyXDaysString += `${everyXDays[i]}, `;
                } else if (i === everyXDays.length - 1) {
                    console.log("entered i === everyXDays.length - 1");
                    everyXDaysString += `and ${everyXDays[i]}`;
                }

            }
        }

        return everyXDaysString;
    }

    if (rrule.type === "recurrenceRuleMonthlyByDate") {

    }
}