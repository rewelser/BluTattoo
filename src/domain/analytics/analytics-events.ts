/**
 * Data attributes used (so far):
 * - data-analytics-event
 * - data-analytics-location
 * - data-analytics-method (optional - such as "instagram" if clicking on a social media link)
 *
 * Applicable events (so far):
 * - booking_cta_click
 * - contact_click
 * - share
 * - faq_expand
 * - booking_submit (for the future; not used yet: in case we host our own booking form)
 * - consent_update
 */
document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;

    const element =
        event.target.closest<HTMLElement>("[data-analytics-event]");

    if (!element) return;

    const eventName = element.dataset.analyticsEvent;

    if (!eventName || typeof window.gtag !== "function") return;

    const parameters: Record<string, string> = {};

    if (element.dataset.analyticsLocation) {
        parameters.location = element.dataset.analyticsLocation;
    }

    if (element.dataset.analyticsMethod) {
        parameters.method = element.dataset.analyticsMethod;
    }

    window.gtag("event", eventName, parameters);
});