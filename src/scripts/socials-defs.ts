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