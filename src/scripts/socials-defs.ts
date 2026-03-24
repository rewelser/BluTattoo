export const socialTypes = [
    "instagram",
    "facebook",
    "tiktok",
    "x",
    "threads",
    "tumblr",
    "youtube",
    "pinterest",
    "phone",
    "email",
    "website",
] as const;

export type SocialType = (typeof socialTypes)[number];