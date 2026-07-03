import {z} from "astro:content";
import {isoDate, weekdayEnum} from "../base/schema.ts";

const bySetPosEnum = z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(-1),
]);

export const recurrenceRuleSchema = z
    .union([
        z.object({
            type: z.literal("recurrenceRuleWeekly"),
            interval: z.number().int().min(1).default(1),
            byWeekday: z.array(weekdayEnum).min(1).max(7),
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
            byWeekday: weekdayEnum,
            bySetPos: bySetPosEnum,
            until: isoDate.optional(),
        }),
    ])
    .optional();