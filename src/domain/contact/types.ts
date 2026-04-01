import {contactTypes, iconTypes, platformTypes, socialTypes} from "./defs.ts";
import {z} from "astro:content";
import {socialItemSchema, socialsSchema} from "../../content.config.ts";

export type ContactType = (typeof contactTypes)[number];
export type SocialType = (typeof socialTypes)[number];
export type PlatformType = (typeof platformTypes)[number];
export type IconType = (typeof iconTypes)[number];
// todo: this is where we left off: we probably should just define and maintain this separately from socialItemSchema/socialsSchema. *sigh*

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