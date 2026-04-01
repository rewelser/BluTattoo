export const contactTypes = ['phone', 'email', 'website'] as const;

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

export const platformTypes = [
    "square"
] as const;

export const iconTypes = [...contactTypes, ...socialTypes, ...platformTypes] as const;
