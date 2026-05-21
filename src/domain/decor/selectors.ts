import type {OgImage} from "./types.ts";

export const getOgImageSrc = (ogImage: OgImage): string => {
    return typeof ogImage === "string"
        ? ogImage
        : ogImage.src;
}