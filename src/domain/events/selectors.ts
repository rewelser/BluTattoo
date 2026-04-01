import type {EventItem} from "./types.ts";
import {loadEventsPublishedCached} from "./server.ts";

export function getEventStartKey(ev: EventItem): string {
    return `${ev.startDate}T${ev.startTime ?? "00:00"}`;
}

export function getEventEndKey(ev: EventItem): string {
    const endDate = ev.endDate ?? ev.startDate;
    return `${endDate}T${ev.endTime ?? "23:59"}`;
}

export function getNowKey(now = new Date()): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const date = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${date}T${hours}:${minutes}`;
}

export function hasEventEnded(
    ev: EventItem,
    nowKey = getNowKey(),
): boolean {
    return getEventEndKey(ev) < nowKey;
}

export function isEventArchived(ev: EventItem): boolean {
    return ev.archived === true;
}


export async function loadUpcomingCandidates(now = new Date()): Promise<EventItem[]> {
    const events = await loadEventsPublishedCached();
    return getUpcomingCandidates(events, now);
}

export function getUpcomingCandidates(events: EventItem[], now = new Date()) {
    return events.filter(
        (ev) =>
            !hasEventEnded(ev, getNowKey(now)) &&
            !isEventArchived(ev)
    );
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