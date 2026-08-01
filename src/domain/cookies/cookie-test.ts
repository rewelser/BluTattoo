import {Temporal} from "temporal-polyfill";

export function setCookie(name: string, value: string, lifetimeSeconds = 3600) {
    const expiresAt = Temporal.Now.instant().add({
        seconds: lifetimeSeconds,
    });

    // Cookies require an HTTP-compatible UTC date string.
    const expires = new Date(expiresAt.epochMilliseconds).toUTCString();

    document.cookie = [
        `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
        `Expires=${expires}`,
        "Path=/",
        "SameSite=Lax",
        location.protocol === "https:" ? "Secure" : "",
    ]
        .filter(Boolean)
        .join("; ");
}

// Creates a cookie that expires in one hour.
setCookie("theme", "dark", 60 * 60);