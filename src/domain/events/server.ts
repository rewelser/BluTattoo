// src/scripts/server.ts
import {getCollection} from "astro:content";
import type {
    EventEntry,
    EventItem,
    EventValidationIssue,
    EventValidationResult,
    InvalidEventResult,
    ValidEventResult
} from "./types.ts";
import {getEventEndKey, getEventStartKey} from "./selectors.ts";

// ----- Loading + sorting -----

function validateAndTransformEvent(e: EventEntry): EventValidationResult {
    const issues: EventValidationIssue[] = [];
    const eventItem = {id: e.id, ...e.data} as EventItem;
    const startKey = getEventStartKey(eventItem);
    const endKey = getEventEndKey(eventItem);

    const hasExplicitEnd = Boolean(e.data.endDate || e.data.endTime);
    if (hasExplicitEnd && endKey <= startKey) {
        issues.push({
            id: e.id,
            reason: "Event end date/time must be after event start date/time.",
        });
    }

    if (issues.length > 0) {
        return {
            ok: false,
            id: e.id,
            issues,
        };
    }

    return {
        ok: true,
        entry: {
            ...e,
        }
    }
}

export async function loadValidatedEvents(options?: { strict?: boolean; }): Promise<EventEntry[]> {
    const strict = options?.strict ?? import.meta.env.PROD;
    const entries = await getCollection("events", (e) => e.data.published);
    const results = entries.map(validateAndTransformEvent);

    const invalidResults = results.filter((r): r is InvalidEventResult => !r.ok);

    if (invalidResults.length > 0) {
        const message =
            `[events] Found ${invalidResults.length} invalid event(s):\n\n` +
            invalidResults
                .map((invalid) =>
                    `${invalid.id}\n` +
                    invalid.issues.map((issue) => `  - ${issue.reason}`).join("\n")
                )
                .join("\n\n");

        if (strict) {
            throw new Error(message);
        }

        console.warn(message);
    }

    return results
        .filter((r): r is ValidEventResult => r.ok)
        .map(r => r.entry)
        .sort((a, b) =>
            `${a.data.startDate}T${a.data.startTime ?? "00:00"}`
                .localeCompare(`${b.data.startDate}T${b.data.startTime ?? "00:00"}`)
        );
}

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
    const entries2 = await loadValidatedEvents();

    return entries
        .map((e) => ({id: e.id, body: e.body, ...e.data}));
}

let transformedEventItemsPromise: Promise<EventItem[]> | undefined;

export function getTransformedEventItemsCached(): Promise<EventItem[]> {
    if (!transformedEventItemsPromise) {
        transformedEventItemsPromise = getTransformedEventItems();
    }
    return transformedEventItemsPromise;
}

