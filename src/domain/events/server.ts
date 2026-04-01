// src/scripts/server.ts
import {getCollection} from "astro:content";
import type {EventEntry, EventItem} from "./types.ts";

// ----- Loading + sorting -----

export async function loadEventsPublished(): Promise<EventItem[]> {
    const entries = (await getCollection(
        "events",
        (e) => e.data.published !== false,
    )) as EventEntry[];

    return entries
        .map((e) => ({id: e.id, ...e.data}))
        .sort((a, b) =>
            `${a.startDate}T${a.startTime ?? "00:00"}`
                .localeCompare(`${b.startDate}T${b.startTime ?? "00:00"}`)
        );
}

let publishedEventsPromise: Promise<EventItem[]> | undefined;

export function loadEventsPublishedCached(): Promise<EventItem[]> {
    if (!publishedEventsPromise) {
        publishedEventsPromise = loadEventsPublished();
    }
    return publishedEventsPromise;
}

