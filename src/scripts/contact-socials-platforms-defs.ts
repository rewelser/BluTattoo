export const contactTypes = ['phone', 'email', 'website'] as const;
export type ContactType = (typeof contactTypes)[number];

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

export const platformTypes = [
    "square"
] as const;

export type PlatformType = (typeof platformTypes)[number];

export const iconTypes = [...contactTypes, ...socialTypes, ...platformTypes] as const;
export type IconType = (typeof iconTypes)[number];