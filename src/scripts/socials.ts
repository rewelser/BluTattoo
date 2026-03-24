import { z } from "zod";
import { socialTypes } from "./socials-defs";
import { socialsSchema, socialItemSchema, siteInfoSocialsSchema } from "../content.config";

// export const socialTypes = [
//     "instagram",
//     "facebook",
//     "tiktok",
//     "x",
//     "threads",
//     "tumblr",
//     "youtube",
//     "pinterest",
// ] as const;

// export type SocialType = (typeof socialTypes)[number];

// ----------------------
//  People socials schema types
// ----------------------

export type SocialItem = z.infer<typeof socialItemSchema>;
export type SocialItems = z.infer<typeof socialsSchema>;


// ----------------------
//  Site Info socials schema and social row normalizer logic
// ----------------------

export function siteInfoSocialsToItems(
    socials: z.infer<typeof siteInfoSocialsSchema> | undefined
): SocialItem[] {
    if (!socials) return [];

    return socialTypes.flatMap((type) => {
        const href = socials[type];
        if (!href) return [];

        return [
            {
                type,
                href,
                enabled: true,
                bookable: false,
            },
        ];
    });
}