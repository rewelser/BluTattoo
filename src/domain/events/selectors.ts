import type {EventItem, GuestItem} from "./types.ts";
import {getTransformedEventItemsCached} from "./server.ts";

export function getEventStartKey(ev: EventItem): string {
    return `${ev.startDate}T${ev.startTime ?? "00:00"}`;
}

export function getEventEndKey(ev: EventItem): string {
    const endDate = ev.endDate ?? ev.startDate;
    return `${endDate}T${ev.endTime ?? "23:59"}`;
}

/**
 * Timezone-agnostic version, which means js Date() decides timezone, which will be local to server: meaningless.
 * That's why we did everything else as string comparisons. Can't wait until js Temporal has support ;)
 */
// export function getNowKey(now = new Date()): string {
//     const year = now.getFullYear();
//     const month = String(now.getMonth() + 1).padStart(2, "0");
//     const date = String(now.getDate()).padStart(2, "0");
//     const hours = String(now.getHours()).padStart(2, "0");
//     const minutes = String(now.getMinutes()).padStart(2, "0");
//
//     return `${year}-${month}-${date}T${hours}:${minutes}`;
// }

export function getNowKey(
    now = new Date(),
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
    }).formatToParts(now);
    const map = Object.fromEntries(
        parts
            .filter((p) => p.type !== "literal")
            .map((p) => [p.type, p.value]),
    );

    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export function hasEventEnded(
    ev: EventItem,
    nowKey = getNowKey(),
): boolean {
    return getEventEndKey(ev) < nowKey;
}

export const hasEventStarted = (ev: EventItem, nowKey = getNowKey()): boolean => {
    return getEventStartKey(ev) <= nowKey;
}

export function compareEventsByStartDate(a: EventItem, b: EventItem): number {
    return getEventStartKey(a).localeCompare(getEventStartKey(b));
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

export async function loadUpcomingGuestSpotCandidates(now = new Date()): Promise<GuestItem[]> {
    const events = await loadUpcomingCandidates(now);
    return events.filter(
        (ev) => isGuestSpot(ev)
    );
}

export async function loadUpcomingCandidates(now = new Date()): Promise<EventItem[]> {
    const events = await getTransformedEventItemsCached();
    return getUpcomingCandidates(events, now);
}

export function getUpcomingCandidates(events: EventItem[], now = new Date()) {
    return events.filter(
        (ev) =>
            !hasEventEnded(ev, getNowKey(now)) &&
            !isEventArchived(ev)
    ).sort((a, b) => getEventStartKey(a).localeCompare(getEventStartKey(b)));
}

export function getPromoCandidates(events: EventItem[]) {
    return events.filter(
        (ev) =>
            ev.promoBar?.enabled &&
            !!ev.promoBar?.message
    );
}

export function pickFeaturedHero(upcoming: EventItem[]): EventItem | null {
    return (
        upcoming.find((ev) => ev.featured && ev.image) ??
        upcoming.find((ev) => ev.image) ??
        null
    );
}