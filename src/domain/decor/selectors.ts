import type {ImageSourceOrMetadata} from "./types.ts";

export const getImageSrc = (image: ImageSourceOrMetadata): string => {
    return typeof image === "string"
        ? image
        : image.src;
}