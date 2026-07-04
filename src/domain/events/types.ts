import type {CollectionEntry} from "astro:content";

export type EventEntry = CollectionEntry<"events">;
export type EventItem = EventEntry["data"] & { id: string; body?: string; };
export type GuestItem = EventItem & { guestSpot: NonNullable<EventItem["guestSpot"]> & { shopClosed: false } };
export type EventsByYearMonthDate = Record<string, Record<string, Record<string, EventItem[]>>>;
export type DateParts = {
    year: number;
    month: number;
    date: number;
};

// type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

type EventRecurrence = {
    frequency: RecurrenceFrequency;
    interval?: number;
    byDay?: Weekday[];
    count?: number;
    until?: string;
}

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