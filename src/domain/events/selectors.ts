import type {EventItem, GuestItem} from "./types.ts";
import {Temporal} from "temporal-polyfill";

/**
 * todo - recurrences: if recursive, start at first instance rather than startDate.
 *  View the details in @chat - rrule temporary chat about ensuring the startDate *is* first instance for recurrences.
 */

// todo - recurrences: this logic should be recurrence-agnostic - expansion should occur higher up
export function getEventStartKey(ev: EventItem): string {
    return `${ev.startDate}T${ev.startTime ?? "00:00"}`;
}

// todo - recurrences: this logic should be recurrence-agnostic - expansion should occur higher up
export function getEventEndKey(ev: EventItem): string {
    const endDate = ev.endDate ?? ev.startDate;
    return `${endDate}T${ev.endTime ?? "23:59"}`;
}

export function getDateKey(
    instant = Temporal.Now.instant(),
    timeZone = "America/New_York",
): string {
    return instant
        .toZonedDateTimeISO(timeZone)
        .toPlainDateTime()
        .toString({ smallestUnit: "minute" });
}

// todo - recurrences: this logic should be recurrence-agnostic - expansion should occur higher up
export function hasEventEnded(ev: EventItem, nowKey = getDateKey()): boolean {
    return getEventEndKey(ev) < nowKey;
}

// todo - recurrences: this logic should be recurrence-agnostic - expansion should occur higher up
export function hasEventStarted(ev: EventItem, nowKey = getDateKey()): boolean {
    return getEventStartKey(ev) <= nowKey;
}

/**
 * "ev is GuestItem" is important; otherwise if we just returned boolean, TypeScript will not narrow the type
 * after .filter(isGuestSpot).
 */
export const isGuestSpot = (ev: EventItem): ev is GuestItem => {
    return !!ev.guestSpot;
};

export function isEventArchived(ev: EventItem): boolean {
    return ev.archived === true;
}

