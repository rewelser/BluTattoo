// src/scripts/server.ts
import {getCollection} from "astro:content";
import type {
    EventEntry,
    EventItem,
    EventValidationIssue,
    EventValidationResult,
    GuestItem,
    InvalidEventResult,
    ValidEventResult
} from "./types.ts";
import {
    getEventEndKey,
    getEventStartKey,
    isGuestSpot
} from "./selectors.ts";
import {getUpcomingCandidates} from "./grouping.ts";
import {getEventRecurrenceUntilKey} from "./recurrence/selectors.ts";
import type {RecurrentEventItem} from "./recurrence/types.ts";

// ----- Loading + sorting -----

function validateEvent(e: EventEntry): EventValidationResult {
    const issues: EventValidationIssue[] = [];
    const eventItem = {id: e.id, ...e.data} as EventItem;
    const startKey = getEventStartKey(eventItem);
    const endKey = getEventEndKey(eventItem);

    const hasExplicitEnd = Boolean(e.data.endDate || e.data.endTime);
    if (hasExplicitEnd && endKey <= startKey) {
        issues.push({
            id: e.id,
            reason: "Event end date/time must be after event start date/time.",
        })
    }

    const hasRecurrence = !!e.data.recurrenceRule;
    const hasExplicitUntil = !!e.data.recurrenceRule?.until;
    if (hasRecurrence && hasExplicitUntil) {
        const untilKey = getEventRecurrenceUntilKey(eventItem as RecurrentEventItem);
        if (untilKey <= startKey) {
            issues.push({
                id: e.id,
                reason: "Event recurrence until date/time must be after event start date/time.",
            })
        }
    }

    // console.log("startKey", startKey);
    // console.log("new Date(startKey).getDay()", new Date(startKey).getDay());
    // console.log("weekdayTypes[new Date(startKey).getDay()]", weekdayTypes[new Date(startKey).getDay()]);
    //
    // console.log("new Date(startKey).getUTCDay()", new Date(startKey).getUTCDay());
    // console.log("weekdayTypes[new Date(startKey).getUTCDay()]", weekdayTypes[new Date(startKey).getUTCDay()]);
    //
    // console.log("new Date(e.data.startDate).getDay()", new Date(e.data.startDate).getDay());
    // console.log("weekdayTypes[new Date(e.data.startDate).getDay()]", weekdayTypes[new Date(e.data.startDate).getDay()]);
    //
    // console.log("new Date(e.data.startDate).getUTCDay()", new Date(e.data.startDate).getUTCDay());
    // console.log("weekdayTypes[new Date(e.data.startDate).getUTCDay()]", weekdayTypes[new Date(e.data.startDate).getUTCDay()]);

    if (!!eventItem.guestSpot && eventItem.shopClosed) {
        issues.push({
            id: e.id,
            reason: "A closed-day event cannot indicate open-day activity, such as a guest spot event.",
        })
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
    const results = entries.map(validateEvent);

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

export const getValidatedEventBySlug = async (slug: string) => {
    const entries = await loadValidatedEvents();

    return entries.find((e) => e.id === slug);
}

export async function getValidatedEventItems(): Promise<EventItem[]> {
    const entries = await loadValidatedEvents();

    return entries
        .map((e) => ({id: e.id, body: e.body, ...e.data}));
}

let transformedEventItemsPromise: Promise<EventItem[]> | undefined;

export function getValidatedEventItemsCached(): Promise<EventItem[]> {
    if (!transformedEventItemsPromise) {
        transformedEventItemsPromise = getValidatedEventItems();
    }
    return transformedEventItemsPromise;
}

export async function loadUpcomingGuestSpotCandidates(now = new Date()): Promise<GuestItem[]> {
    const events = await loadUpcomingCandidates(now);
    return events.filter(
        (ev) => isGuestSpot(ev)
    );
}

export async function loadUpcomingCandidates(now = new Date()): Promise<EventItem[]> {
    const events = await getValidatedEventItemsCached();
    return getUpcomingCandidates(events, now);
}