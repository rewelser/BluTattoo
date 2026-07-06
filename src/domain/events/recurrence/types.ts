import type {EventItem} from "../types.ts";
import {weekdayTypes} from "./defs.ts";

export type RecurrentEventItem = EventItem & { recurrenceRule: NonNullable<EventItem["recurrenceRule"]> }

export type Weekday = typeof weekdayTypes[number];

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type RecurrenceRule =
    | {
    type: "recurrenceRuleWeekly";
    interval?: number;
    byDay: Weekday[];
    until?: string;
}
    | {
    type: "recurrenceRuleMonthlyByDate";
    interval?: number;
    byMonthDay: number;
    until?: string;
}
    | {
    type: "recurrenceRuleMonthlyByOrdinalWeekday";
    interval?: number;
    byDay: Weekday;
    bySetPos: 1 | 2 | 3 | 4 | -1;
    until?: string;
};

type EventRecurrence = {
    frequency: RecurrenceFrequency;
    interval?: number;
    byDay?: Weekday[];
    count?: number;
    until?: string;
}
export type ExpandRangeOptions =
    | {
    kind: "range";
    rangeStart: Date | string;
    rangeEnd: Date | string;
}
    | {
    kind: "days";
    rangeStart: Date | string;
    days: number;
}
    | {
    kind: "month";
    year: number;
    month: number;
};