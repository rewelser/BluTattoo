import type {EventItem} from "../types.ts";
import {bySetPosTypes, weekdayTypes} from "./defs.ts";
import {Temporal} from "temporal-polyfill";

export type RecurrentEventItem = EventItem & { recurrenceRule: NonNullable<EventItem["recurrenceRule"]> }

export type Weekday = typeof weekdayTypes[number];

export type BySetPos = typeof bySetPosTypes[number];


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

export type ExpandRangeOptions =
    | {
    kind: "range";
    rangeStart: string;
    rangeEnd: string;
}
    | {
    kind: "days";
    rangeStart: string;
    days: number;
}
    | {
    kind: "month";
    year: number;
    month: number;
};

export type DateRange = Readonly<{
    start: Temporal.PlainDate;
    endExclusive: Temporal.PlainDate;
}>;
