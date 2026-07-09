/// <reference path="../.astro/types.d.ts" />
// todo: consider removing this once we upgrade astro
declare namespace astroHTML.JSX {
    interface VideoHTMLAttributes {
        loading?: "lazy" | "eager" | null | undefined;
    }
}