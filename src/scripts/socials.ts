import { z } from "zod";

export const socialTypes = [
    "instagram",
    "facebook",
    "tiktok",
    "x",
    "threads",
    "tumblr",
    "youtube",
    "pinterest",
] as const;

export type SocialType = (typeof socialTypes)[number];

// ----------------------
//  People socials schema & types
// ----------------------

export const socialItemSchema = z.object({
    type: z.enum(socialTypes),
    link: z.string().url(),
    enabled: z.boolean().default(true),
    bookable: z.boolean().default(false),
    preferred: z.boolean().optional(),
});

export const socialsSchema = z.array(socialItemSchema).optional();

export type SocialItem = z.infer<typeof socialItemSchema>;
export type SocialItems = z.infer<typeof socialsSchema>;


// ----------------------
//  Site Info socials schema and social row normalizer logic
// ----------------------

export const optUrl = z.string().url().optional();

export const siteInfoSocialsSchema = z
    .object(
        Object.fromEntries(socialTypes.map((k) => [k, optUrl])) as Record<
            SocialType,
            typeof optUrl
        >
    )
    .partial()
    .default({});

export function siteInfoSocialsToItems(
    socials: z.infer<typeof siteInfoSocialsSchema> | undefined
): SocialItem[] {
    if (!socials) return [];

    return socialTypes.flatMap((type) => {
        const link = socials[type];
        if (!link) return [];

        return [
            {
                type,
                link,
                enabled: true,
                bookable: false,
            },
        ];
    });
}