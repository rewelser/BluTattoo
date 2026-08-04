/// <reference path="../.astro/types.d.ts" />

/**
 * If this file ever comes to import or export anything, then TypeScript will treat it as a module, and I am told that
 * will necessitate moving these declarations into `declare global {...}` blocks. At time of writing, that means the
 * current blocks will be instead written like this:
 *
 * declare global {
 *   namespace astroHTML.JSX {
 *     interface VideoHTMLAttributes {
 *       loading?: "lazy" | "eager" | null | undefined;
 *     }
 *   }
 *
 *   interface Window {
 *     gtag?: (...args: unknown[]) => void;
 *   }
 * }
 *
 * Note: to force a file to be treated as a module preemptively in order to prepare the rest of the file's code for that
 * inevitability--if it is one--you can write the following, which does nothing other than indicate the file to be made
 * modular:
 *
 * export {};
 *
 */

// todo: consider removing this once we upgrade astro
declare namespace astroHTML.JSX {
    interface VideoHTMLAttributes {
        loading?: "lazy" | "eager" | null | undefined;
    }
}


// Used primarily for
interface Window {
    gtag?: (...args: unknown[]) => void;
}