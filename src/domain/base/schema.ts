import {z} from "astro:content";

/*** region *** Formatters ****/
export const emptyStrToUndef = (v: unknown) =>
    typeof v === "string" && v.trim() === "" ? undefined : v;
const emptyArrToUndef = (v: unknown) =>
    Array.isArray(v) && v.length === 0 ? undefined : v;
export const optionalString = z.preprocess(emptyStrToUndef, z.string().optional());
export const optionalText = z.preprocess(emptyStrToUndef, z.string().optional());
export const optUrl = z.string().url().optional();
/*** endregion ***/