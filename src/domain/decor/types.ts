// import type {frameType} from "./defs.ts";

import {frameTypes} from "./defs.ts";
import type {ImageMetadata} from "astro";

// export type FrameType = typeof frameType[number];
export type FrameType = typeof frameTypes[number];

export type OgImage =
    | string
    | ImageMetadata;