import {z} from "zod";
import {socialTypes} from "./defs.ts";
import type {SocialItem} from "./types.ts";
import {siteInfoSocialsSchema} from "./schema.ts";

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