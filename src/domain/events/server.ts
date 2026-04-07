// src/scripts/server.ts
import {getCollection} from "astro:content";
import type {EventEntry, EventItem} from "./types.ts";
import {getEventEndKey, getEventStartKey} from "./selectors.ts";

// ----- Loading + sorting -----

export async function loadTransformedEvents(): Promise<EventEntry[]> {
    const entries = await getCollection("events", (e) => e.data.published);
    return entries
        .map((e) => {
            const startKey = getEventStartKey({id: e.id, ...e.data} as EventItem);
            const endKey = getEventEndKey({id: e.id, ...e.data} as EventItem);
            const isEndBeforeStart = endKey <= startKey;
            return {
                ...e,
                data: {
                    ...e.data,
                    endDate: isEndBeforeStart ? undefined : e.data.endDate,
                    endTime: isEndBeforeStart ? undefined : e.data.endTime,
                }
            };
        })
        .sort((a, b) =>
            `${a.data.startDate}T${a.data.startTime ?? "00:00"}`
                .localeCompare(`${b.data.startDate}T${b.data.startTime ?? "00:00"}`)
        );
}

export const getTransformedEventBySlug = async (slug: string) => {
    const entries = await loadTransformedEvents();

    return entries.find((e) => e.id === slug);
}

export async function getTransformedEventItems(): Promise<EventItem[]> {
    const entries = await loadTransformedEvents();

    return entries
        .map((e) => ({id: e.id, ...e.data}));
}

let transformedEventItemsPromise: Promise<EventItem[]> | undefined;

export function getTransformedEventItemsCached(): Promise<EventItem[]> {
    if (!transformedEventItemsPromise) {
        transformedEventItemsPromise = getTransformedEventItems();
    }
    return transformedEventItemsPromise;
}

