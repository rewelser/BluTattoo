/// <reference path="../.astro/types.d.ts" />

declare namespace astroHTML.JSX {
    interface VideoHTMLAttributes {
        loading?: "lazy" | "eager" | null | undefined;
    }
}