import type {EventItem, EventsByYearMonthDate} from "./types";

const getDatesBetweenInclusive = (startDate: string, endDate: string): string[] => {
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);

    const cur = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);

    const dates: string[] = [];

    while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");

        dates.push(`${y}-${m}-${d}`);

        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

export const buildEventsByYearMonthDate = (evItems: EventItem[]) => {
    const eventsByYearMonthDate: EventsByYearMonthDate = {};

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

export const buildRecurringEventsByYearMonthDate = (evItems: EventItem[]) => {
    const recurringEventsByYearMonthDate: EventsByYearMonthDate = {};

    for (const ev of evItems) {
        const [startYear, startMonth, startDate] = ev.startDate.split("-");

        recurringEventsByYearMonthDate[startYear] ||= {};
        recurringEventsByYearMonthDate[startYear][startMonth] ||= {};
        recurringEventsByYearMonthDate[startYear][startMonth][startDate] ||= [];

        if (!!ev.recurrenceRule) {
            recurringEventsByYearMonthDate[startYear][startMonth][startDate].push(ev);
        }
    }

    return recurringEventsByYearMonthDate;
};

// ----- Picks -----


// const extrapolateOccurrences

/**
 *
 */