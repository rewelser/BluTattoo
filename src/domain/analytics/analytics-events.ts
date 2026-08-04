// src/scripts/analytics-events.ts

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