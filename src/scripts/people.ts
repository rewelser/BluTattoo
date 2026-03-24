import { getCollection, type CollectionEntry } from "astro:content";

export type PersonEntry = CollectionEntry<"people">;
export type PersonItem = PersonEntry["data"] & { id: string };

/**
 * Contact/Socials/Booking types
 */
type ContactSocialsBooking = NonNullable<PersonItem["contact_socials_booking"]>;
type ContactItem = NonNullable<ContactSocialsBooking["contact"]>[number];
type SocialItem = NonNullable<ContactSocialsBooking["socials"]>[number];
type PlatformItem = NonNullable<ContactSocialsBooking["platforms"]>[number];
type SquareItem = Extract<PlatformItem, { type: "square" }>["link_or_module_info"][number];


export async function loadArtistsActiveNonguest(): Promise<PersonEntry[]> {
    const entries = (await getCollection(
        "people",
        (e) => e.data.active && !e.data.guest && e.data.primary_role === "tattoo_artist"
    )) as PersonEntry[];

    return entries
        .sort(
            (a, b) =>
                (a.data.order ?? 999) - (b.data.order ?? 999) || a.data.name.localeCompare(b.data.name),
        );
}

// ----------------------
//  Contact/Socials/Booking logic (booking.astro)
// ----------------------

const DEFAULT_BOOKING_PROFILE_IMAGE = "/uploads/defaults/default-booking-profile.jpg";
