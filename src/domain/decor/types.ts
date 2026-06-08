// import type {frameType} from "./defs.ts";

import {frameTypes, questionMarkImages} from "./defs.ts";
import type {ImageMetadata} from "astro";

// export type FrameType = typeof frameType[number];
export type FrameType = typeof frameTypes[number];

export type ImageSourceOrMetadata =
    | string
    | ImageMetadata;

export type QuestionMarkId = keyof typeof questionMarkImages;