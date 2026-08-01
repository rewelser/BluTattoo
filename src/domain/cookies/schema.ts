import {z} from "zod";

export const checkBoxSchema = z
    .literal("on")
    .optional()
    .transform((value) => value === "on");

export const cookiePreferencesSchema = z.object({
    performance: checkBoxSchema,
    marketing: checkBoxSchema,
});