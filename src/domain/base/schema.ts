
import {z} from "astro:content";

/*** region *** Formatters ****/
export const emptyStrToUndef = (v: unknown) =>
    typeof v === "string" && v.trim() === "" ? undefined : v;
const emptyArrToUndef = (v: unknown) =>
    Array.isArray(v) && v.length === 0 ? undefined : v;
export const optionalString = z.preprocess(emptyStrToUndef, z.string().optional());
export const optionalText = z.preprocess(emptyStrToUndef, z.string().optional());
export const optUrl = z.string().url().optional();
export const timeHM = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm");
export const toHm = (v: unknown): unknown => {
    if (v instanceof Date) return v.toISOString().slice(11, 16); // HH:mm
    if (typeof v === "string") {
        const s = v.trim();
        if (/^\d{2}:\d{2}$/.test(s)) return s;
        const m = s.match(/T(\d{2}:\d{2})/);
        if (m?.[1]) return m[1];
    }
    return v;
};
export const weekdayEnum = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
export const isoDate = z.preprocess((val) => {
    if (val instanceof Date) {
        return val.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    return val;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"));
/*** endregion ***/