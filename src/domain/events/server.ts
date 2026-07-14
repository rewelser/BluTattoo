// src/scripts/server.ts
import {getCollection} from "astro:content";
import type {
    EventEntry,
    EventItem,
    EventValidationIssue,
    EventValidationResult,
    GuestItem,
    InvalidEventResult, RecurrentEventItem,
    ValidEventResult
} from "./types.ts";
import {
    getEventEndKey, getEventRecurrenceUntilKey,
    getEventStartKey,
    isGuestSpot, recurrenceFirstOccurrenceMatchesStartDate
} from "./selectors.ts";
import {expandRecurrentEventOccurrencesFromRange, getUpcomingCandidates} from "./grouping.ts";

// Wtf is this? vv
// import {Temporal} from "temporal-spec";
import {Temporal} from "temporal-polyfill";

// ----- Loading + sorting -----

function validateEvent(e: EventEntry): EventValidationResult {
    console.log("e.id", e.id);
    const issues: EventValidationIssue[] = [];
    const eventItem = {id: e.id, ...e.data} as EventItem;
    const startKey = getEventStartKey(eventItem);
    const endKey = getEventEndKey(eventItem);

    const hasExplicitEnd = Boolean(eventItem.endDate || eventItem.endTime);
    if (hasExplicitEnd && endKey <= startKey) {
        issues.push({
            id: eventItem.id,
            reason: "Event end date/time must be after event start date/time.",
        })
    }

    const hasRecurrence = !!eventItem.recurrenceRule;
    const hasExplicitUntil = !!eventItem.recurrenceRule?.until;
    if (hasRecurrence && hasExplicitUntil) {
        const untilKey = getEventRecurrenceUntilKey(eventItem as RecurrentEventItem);
        if (untilKey && untilKey <= startKey) {
            issues.push({
                id: eventItem.id,
                reason: "Event recurrence until date/time must be after event start date/time.",
            })
        }
    }

    if (hasRecurrence && !recurrenceFirstOccurrenceMatchesStartDate(eventItem as RecurrentEventItem)) {
        issues.push({
            id: eventItem.id,
            reason: "Event recurrence start date must match with first occurrence.",
        })
    }

    if (hasRecurrence && hasExplicitUntil) {
        const rangeStart = Temporal.PlainDate.from(eventItem.startDate);
        const rangeEnd = Temporal.PlainDate.from(eventItem.recurrenceRule!.until!);
        const occurrenceArray = expandRecurrentEventOccurrencesFromRange(eventItem as RecurrentEventItem, {
            start: rangeStart,
            endExclusive: rangeEnd
        });
        if (occurrenceArray.length === 0) {
            issues.push({
                id: eventItem.id,
                reason: "Recurrent event slated range must not contain zero occurrences.",
            })
        }
    }

    if (!!eventItem.guestSpot && eventItem.shopClosed) {
        issues.push({
            id: e.id,
            reason: "A closed-day event cannot indicate open-day shop services, such as a guest spot event.",
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

export async function loadUpcomingGuestSpotCandidates(now: Temporal.PlainDateTime): Promise<GuestItem[]> {
    const events = await loadUpcomingCandidates(now);
    return events.filter(
        (ev) => isGuestSpot(ev)
    );
}

export async function loadUpcomingCandidates(now: Temporal.PlainDateTime): Promise<EventItem[]> {
    const events = await getValidatedEventItemsCached();
    return getUpcomingCandidates(events, now);
}