// src/scripts/events.ts
import { getCollection, type CollectionEntry } from "astro:content";
import { getUpcomingCandidates } from "./eventsClient";

export type EventEntry = CollectionEntry<"events">;
export type EventItem = EventEntry["data"] & { id: string };

// ----- Loading + sorting -----

export async function loadEventsPublished(): Promise<EventItem[]> {
    const entries = (await getCollection(
        "events",
        (e) => e.data.published !== false,
    )) as EventEntry[];

    return entries
        .map((e) => ({ id: e.id, ...e.data }))
        .sort((a, b) =>
            `${a.startDate}T${a.startTime ?? "00:00"}`
                .localeCompare(`${b.startDate}T${b.startTime ?? "00:00"}`)
        );
}

export async function loadUpcomingCandidates(now = new Date()): Promise<EventItem[]> {
    const events = await loadEventsPublishedCached();
    return getUpcomingCandidates(events, now);
}

let publishedEventsPromise: Promise<EventItem[]> | undefined;

export function loadEventsPublishedCached(): Promise<EventItem[]> {
    if (!publishedEventsPromise) {
        publishedEventsPromise = loadEventsPublished();
    }
    return publishedEventsPromise;
}