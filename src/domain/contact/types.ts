import {contactTypes, iconTypes, platformTypes, socialTypes, iconVariants} from "./defs.ts";
import {z} from "astro:content";
import {contactSocialsBookingSchema} from "./schema.ts";
export type ContactType = (typeof contactTypes)[number];
export type SocialType = (typeof socialTypes)[number];
export type PlatformType = (typeof platformTypes)[number];
export type IconType = (typeof iconTypes)[number];
export type IconVariant = (typeof iconVariants)[number];
// todo: this is where we left off: we probably should just define and maintain this separately from socialItemSchema/socialsSchema. *sigh*
/**
 * todo:
 * nix the above comment--we moved all schemae into domains/[domain]/schema.ts files, then imported into
 * content.config.ts. Was tired of the 'source of truth' quandary (see below)
 *
 */

/**
 * - These are so SocialRow.astro can understand socialsSchema [SocialItems], and so siteInfoSocialsToItems()
 * can take siteInfoSocialsSchema and spit out a SocialItem array [SocialItem].
 *
 * - Originally, I had these infer shape from schemas, but decided to maintain it separately, since this should be source
 * of truth, however TypeScript types can't enforce schema shape, because TypeScript types are erased at compile time and
 * are gone by runtime when content.config.ts works.
 */

// export type SocialItem = z.infer<typeof socialItemSchema>;
// export type SocialItems = z.infer<typeof socialsSchema>;

export type SocialItem = {
    type: SocialType;
    href: string;
    enabled: boolean;
    bookable: boolean;
    preferred?: boolean;
    handle?: string;
};
export type SocialItems = SocialItem[];

export type ContactSocialsBooking = z.infer<
    ReturnType<typeof contactSocialsBookingSchema>
>;