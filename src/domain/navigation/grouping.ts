import type {MenuItem} from "./types.ts";
import type {GuestItem} from "../events/types.ts";

export const renderGuestLinks = (guests: GuestItem[]): MenuItem[] => {
    return guests.map((guest) => ({
        type: "link" as const,
        label: guest.guestSpot.guestName,
        event: guest,
        start: guest.startDate,
        end: guest.endDate,
        href: `/events/${guest.id}`,
        prefetch: true,
    }));
}