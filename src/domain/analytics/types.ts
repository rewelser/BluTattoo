export type Verdict_old = { valid: false, response: Response } | { valid: true; response: undefined }

export type ConsentPreferences = {
    performance: boolean,
    marketing: boolean,
}

type GAConsentString = "granted" | "denied";

export type GAConsent = {
    analytics_storage: GAConsentString,
    ad_storage: GAConsentString,
    ad_user_data: GAConsentString,
    ad_personalization: GAConsentString
}