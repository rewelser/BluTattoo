import {frameTypes} from "./defs.ts";
import {z} from "astro:content";

const cmsFrameTypes = ["none", ...frameTypes] as const;
export const frameSchema = z.enum(cmsFrameTypes)
    .transform((value) => (value === "none" ? undefined : value));