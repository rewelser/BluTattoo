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

export type BookingListItem =
    | {
        kind: "link";
        icon: "phone" | "email" | "website" | "square" | SocialItem["type"];
        label: string;
        href: string;
        notes?: string;
        preferred?: boolean;
        bookable?: boolean;
    }
    | {
        kind: "panel";
        icon: "square";
        label: string;
        merchantId: string;
        locationId: string;
    };

export type NormalizedPersonBooking = {
    name: string;
    primaryRole: PersonItem["primary_role"];
    profileImage: string;
    bookingNote?: string;
    items: BookingListItem[];
};

const DEFAULT_BOOKING_PROFILE_IMAGE = "/uploads/defaults/default-booking-profile.jpg";

function isEnabled<T extends { enabled?: boolean }>(item: T): boolean {
    return item.enabled !== false;
}

function socialLabel(type: SocialItem["type"]): string {
    return type
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function getContactHref(item: ContactItem): string {
    switch (item.type) {
        case "phone":
            return `tel:${item.number.replace(/\D/g, "")}`;
        case "email":
            return `mailto:${item.email_address}`;
        case "website":
            return item.link;
        default:
            return "";
    }
}

function getContactLabel(item: ContactItem): string {
    switch (item.type) {
        case "phone":
            return item.number;
        case "email":
            return item.email_address;
        case "website":
            return item.link;
    }
}

function getContactIcon(item: ContactItem): "phone" | "email" | "website" {
    switch (item.type) {
        case "phone":
            return "phone";
        case "email":
            return "email";
        case "website":
            return "website";
    }
}

function normalizeContactItems(
    contact: ContactSocialsBooking["contact"],
): BookingListItem[] {
    return (contact ?? [])
        .filter(isEnabled)
        .map((item) => ({
            kind: "link" as const,
            icon: getContactIcon(item),
            label: getContactLabel(item),
            href: getContactHref(item),
            notes: item.notes ?? undefined,
            preferred: item.preferred,
        }));
}

function normalizeSocialItems(
    socials: ContactSocialsBooking["socials"],
): BookingListItem[] {
    return (socials ?? [])
        .filter(isEnabled)
        .map((item) => ({
            kind: "link" as const,
            icon: item.type,
            label: socialLabel(item.type),
            href: item.link,
            preferred: item.preferred,
            bookable: item.bookable,
        }));
}

function normalizeSquareItems(squareItems: SquareItem[]): BookingListItem[] {
    return squareItems.filter(isEnabled).map((item) => {
        if (item.type === "square_link") {
            return {
                kind: "link" as const,
                icon: "square" as const,
                label: "Book on Square",
                href: item.url,
            };
        }

        return {
            kind: "panel" as const,
            icon: "square" as const,
            label: item.label || "Square booking module",
            merchantId: item.merchantId,
            locationId: item.locationId,
        };
    });
}

function normalizePlatformItems(
    platforms: ContactSocialsBooking["platforms"],
): BookingListItem[] {
    return (platforms ?? []).filter(isEnabled).flatMap((platform) => {
        switch (platform.type) {
            case "square":
                return normalizeSquareItems(platform.link_or_module_info);
        }
    });
}

export function normalizePersonBooking(
    person: PersonEntry,
    defaultProfileImage = DEFAULT_BOOKING_PROFILE_IMAGE,
): NormalizedPersonBooking | null {
    const csb = person.data.contact_socials_booking;
    if (!csb) return null;

    return {
        name: person.data.name,
        primaryRole: person.data.primary_role,
        profileImage: csb.booking_profile_picture || defaultProfileImage,
        bookingNote: csb.booking_note ?? undefined,
        items: [
            ...normalizeContactItems(csb.contact),
            ...normalizeSocialItems(csb.socials),
            ...normalizePlatformItems(csb.platforms),
        ],
    };
}

export async function loadArtistsActiveNonguestNormalized() {
    const people = await loadArtistsActiveNonguest();

    return people
        .map((person) => ({
            entry: person,
            booking: normalizePersonBooking(person),
        }))
        .filter(
            (
                item,
            ): item is { entry: PersonEntry; booking: NormalizedPersonBooking } =>
                item.booking !== null,
        );
}