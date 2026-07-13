import {type RecurrentEventItem, type Weekday} from "./types.ts";
import {bySetPosNames, bySetPosTypes, weekdayNames, weekdayTypes} from "./defs.ts";

function numberToWords(num: number): string {
    if (num === 0) return 'zero';

    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const scales = ['', 'thousand', 'million', 'billion', 'trillion'];

    // Handle negative numbers
    if (num < 0) return 'minus ' + numberToWords(Math.abs(num));

    // Process numbers under 1000
    function convertLessThanThousand(n: number): string {
        if (n === 0) return '';
        if (n < 20) return ones[n] + ' ';
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + ones[n % 10] : '') + ' ';
        return ones[Math.floor(n / 100)] + ' hundred ' + convertLessThanThousand(n % 100);
    }

    let result = '';
    let scaleIndex = 0;

    // Split into chunks of three digits (thousands, millions, etc.)
    while (num > 0) {
        let chunk = num % 1000;
        if (chunk !== 0) {
            let chunkStr = convertLessThanThousand(chunk);
            result = chunkStr + scales[scaleIndex] + ' ' + result;
        }
        num = Math.floor(num / 1000);
        scaleIndex++;
    }

    return result.trim().replace(/\s+/g, ' ');
}

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

        let monthlyByOrdinalWeekday =`The ` + new Intl.ListFormat("en", {
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