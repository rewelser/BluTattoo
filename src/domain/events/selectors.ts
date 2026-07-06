import type {EventItem, GuestItem} from "./types.ts";

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
    date = new Date(),
    timeZone = "America/New_York",
): string {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const map = Object.fromEntries(
        parts
            .filter((p) => p.type !== "literal")
            .map((p) => [p.type, p.value]),
    );

    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

// todo - recurrences: this logic should be recurrence-agnostic - expansion should occur higher up
export function hasEventEnded(ev: EventItem, nowKey = getDateKey(),): boolean {
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

