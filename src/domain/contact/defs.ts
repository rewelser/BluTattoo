export const contactTypes = ['phone', 'email', 'website'] as const;

export const socialTypes = [
    "instagram",
    "facebook",
    "facebookMessenger",
    "whatsapp",
    "snapchat",
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

export const iconVariants = ["default", "thin", "round", "roundColor", "thick"] as const;

