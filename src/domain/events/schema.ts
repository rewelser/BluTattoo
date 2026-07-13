import {z} from "astro:content";

import {weekdayTypes} from "./recurrence/defs.ts";

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

export const weekdayEnum = z.enum(weekdayTypes);

/**
 * todo: replace circa zod 4, as it apparently has z.iso.date()
 */
export const isoDate = z.preprocess((val) => {
    if (val instanceof Date) {
        return val.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    return val;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"));

const bySetPosEnum = z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(-1),
]);

const bySetPosEnumArray = z.array(bySetPosEnum);

export const recurrenceRuleSchema = z
    .union([
        z.object({
            type: z.literal("recurrenceRuleWeekly"),
            interval: z.number().int().min(1).default(1),
            byDay: z.array(weekdayEnum).min(1).max(7),
            until: isoDate.optional(),
        }),

        z.object({
            type: z.literal("recurrenceRuleMonthlyByDate"),
            interval: z.number().int().min(1).default(1),
            byMonthDay: z.number().int().min(1).max(31),
            until: isoDate.optional(),
        }),

        z.object({
            type: z.literal("recurrenceRuleMonthlyByOrdinalWeekday"),
            interval: z.number().int().min(1).default(1),
            byDay: weekdayEnum,
            bySetPos: bySetPosEnumArray,
            until: isoDate.optional(),
        }),
    ])
    .optional();