// src/scripts/events.ts
import { getCollection, type CollectionEntry } from "astro:content";

export type EventEntry = CollectionEntry<"events">;
export type EventItem = EventEntry["data"] & { id: string };
export type MonthOccurrence = { date: Date; event: EventItem };

// ----- Date helpers (inclusive endDate, day-level comparisons) -----

const startOfDayLocal = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const eventEndDate = (ev: EventItem): Date => ev.endDate ?? ev.startDate;

export const isEventUpcomingOrOngoing = (ev: EventItem, now = new Date()): boolean => {
    if (ev.archived) return false;
    if (ev.published === false) return false;
    const end = ev.endDate ?? ev.startDate;
    return end >= now;
};

export const isEventPast = (ev: EventItem, now = new Date()): boolean => {
    const today = startOfDayLocal(now);
    const end = startOfDayLocal(eventEndDate(ev));
    return end < today;
};

// ----- Loading + sorting -----

export async function loadEventsPublished(): Promise<EventItem[]> {
    const entries = (await getCollection(
        "events",
        (e) => e.data.published !== false,
    )) as EventEntry[];

    return entries
        .map((e) => ({ id: e.id, ...e.data }))
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

export function splitUpcomingPast(events: EventItem[], now = new Date()) {
    const upcoming = events.filter((ev) => !isEventPast(ev, now) && !ev.archived);
    const past = events.filter((ev) => isEventPast(ev, now)).reverse();
    return { upcoming, past };
}

// ----- Picks -----

export function pickFeaturedHero(upcoming: EventItem[]): EventItem | null {
    return (
        upcoming.find((ev) => ev.featured && ev.image) ??
        upcoming.find((ev) => ev.image) ??
        null
    );
}

export function pickPromoEvent(
    events: EventItem[],
    now = new Date(),
): EventItem | null {
    const eligible = events.filter(
        (ev) => isEventUpcomingOrOngoing(ev, now) && ev.promoBar?.enabled && !!ev.promoBar?.message,
    );
    return eligible.find((ev) => ev.featured) ?? eligible[0] ?? null;
}

export async function loadPromoCandidateEvents(now = new Date()): Promise<EventItem[]> {
  const events = await loadEventsPublished();

  return events.filter((ev) =>
    !ev.archived &&
    (ev.endDate ?? ev.startDate) >= now &&
    ev.promoBar?.enabled &&
    !!ev.promoBar?.message
  );
}

// ----- Formatting (display-only) -----

export const fmtDate = (d: Date) =>
    d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export function fmtDateRange(ev: Pick<EventItem, "startDate" | "endDate">): string {
    return ev.endDate ? `${fmtDate(ev.startDate)} – ${fmtDate(ev.endDate)}` : fmtDate(ev.startDate);
}

export function fmtTimeWindow(ev: Pick<EventItem, "startTime" | "endTime">): string {
    const { startTime, endTime } = ev;
    if (startTime && endTime) return `${startTime}–${endTime}`;
    if (startTime && !endTime) return `Starts ${startTime}`;
    if (!startTime && endTime) return `Until ${endTime}`;
    return "All day";
}