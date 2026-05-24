import type {ContactSocialsBooking} from "./types.ts";

export const getBookables = (csb: ContactSocialsBooking): any[] => {
    const contacts = csb?.contact?.filter(
        (item) => item.enabled,
    );
    const socials = csb?.socials?.filter(
        (item) => item.enabled && item.bookable,
    );
    const platforms = csb?.platforms?.filter(
        (item) => item.enabled,
    );

    return [
        ...(contacts ?? []).map((item) => ({
            ...item,
            category: "contact" as const,
        })),
        ...(socials ?? []).map((item) => ({
            ...item,
            category: "social" as const,
        })),
        ...(platforms ?? []).flatMap((platform) =>
            (platform.linkOrModuleInfo ?? []).map(
                (entry) => ({
                    ...entry,
                    category: "platform" as const,
                    preferred: platform.preferred,
                    type: platform.type,
                    platformEnabled: platform.enabled,
                }),
            ),
        ),
    ].sort(
        (a, b) =>
            Number(b.preferred ?? false) -
            Number(a.preferred ?? false),
    );
}