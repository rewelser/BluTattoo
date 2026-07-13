import type {CollectionEntry} from "astro:content";

export type EventEntry = CollectionEntry<"events">;
export type EventItem = EventEntry["data"] & { id: string; body?: string; occurrenceKey?: string };
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