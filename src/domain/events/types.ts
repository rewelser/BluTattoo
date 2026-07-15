import type {CollectionEntry} from "astro:content";
import {Temporal} from "temporal-polyfill";
import {bySetPosTypes, weekdayTypes} from "./defs.ts";

export type EventEntry = CollectionEntry<"events">;
export type EventItem = EventEntry["data"] & { id: string; body?: string; occurrenceKey?: string; imageSrc?: string };
export type GuestItem = EventItem & { guestSpot: NonNullable<EventItem["guestSpot"]> & { shopClosed: false } };
export type EventsByYearMonthDate = Record<string, Record<string, Record<string, EventItem[]>>>;

/**
 * Event validation types
 */
export type EventValidationIssue = {
    id: string;
    reason: string;
}

export type ValidEventResult = {
    ok: true;
    entry: EventEntry;
}

export type InvalidEventResult = {
    ok: false;
    id: string;
    issues: EventValidationIssue[];
}

export type EventValidationResult = ValidEventResult | InvalidEventResult;
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

export type DateRange = Readonly<{
    start: Temporal.PlainDate;
    endExclusive: Temporal.PlainDate;
}>;