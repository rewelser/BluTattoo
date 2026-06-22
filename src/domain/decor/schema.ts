import {frameTypes} from "./defs.ts";
import {type SchemaContext, z} from "astro:content";

const cmsFrameTypes = ["none", ...frameTypes] as const;
export const frameSchema = z.enum(cmsFrameTypes)
    .transform((value) => (value === "none" ? undefined : value));

export const videoSchema = ({image}: SchemaContext) => z.object({
    videoMobile: z.string(),
    videoDesktop: z.string(),
    posterMobile: image(),
    posterDesktop: image(),
});