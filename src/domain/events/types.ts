import type {CollectionEntry} from "astro:content";

export type EventEntry = CollectionEntry<"events">;
export type EventItem = EventEntry["data"] & { id: string };
export type GuestItem = EventItem & { guestSpot: NonNullable<EventItem["guestSpot"]> };
export type EventsByYearMonthDate = Record<string, Record<string, Record<string, EventItem[]>>>;
export type DateParts = {
    year: number;
    month: number;
    date: number;
};