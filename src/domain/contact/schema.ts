import type {SchemaContext} from "astro:content";
import {z} from "astro:content";
import {socialTypes} from "./defs.ts";
import {optionalString, optionalText, optUrl} from "../base/schema.ts";
import type {SocialType} from "./types.ts";

const usPhoneSchema = z
    .string()
    .transform((val) => val.replace(/\D/g, ""))
    .refine(
        (digits) => digits.length === 10 || (digits.length === 11 && digits.startsWith("1")),
        "Must be a valid US phone number"
    )
    .transform((digits) => {
        if (digits.length === 11) {
            return digits.replace(/1(\d{3})(\d{3})(\d{4})/, "+1 ($1) $2-$3");
        }
        return digits.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
    });

const websiteSchema = z.preprocess((val) => {
    if (typeof val !== "string") return val;
    const s = val.trim();
    if (!s) return s;
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
}, z.string().url());

const withCommonFlags = <S extends z.ZodRawShape>(shape: S) =>
    z.object({
        ...shape,
        enabled: z.boolean().default(true),
        preferred: z.boolean().optional()
    });


const contactBuilder = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) =>
    withCommonFlags(shape).extend({
        type: z.literal(type),
        notes: optionalText
    });

const contactSchema = z.array(
    z.discriminatedUnion('type', [
        contactBuilder('phone', {href: usPhoneSchema}),
        contactBuilder('email', {href: z.string().email()}),
        contactBuilder('website', {href: websiteSchema})
    ])
).optional();

// can simply use socialTypes, because we don't need string literals for different shapes a la discriminated union (as in contacts)
const socialItemSchema = z.object({
    type: z.enum(socialTypes),
    href: z.string().url(),
    enabled: z.boolean().default(true),
    bookable: z.boolean().default(false),
    preferred: z.boolean().optional(),
    handle: optionalString
});

const socialsSchema = z.array(socialItemSchema).optional();

const squareLinkSchema = z.object({
    type: z.literal('platformUrl'),
    enabled: z.boolean().default(true),
    href: z.string().url()
});

const squareModuleSchema = z.object({
    type: z.literal('moduleInfo'),
    enabled: z.boolean().default(true),
    merchantId: z.string().regex(/^[A-Za-z0-9-]+$/),
    locationId: z.string().regex(/^[A-Za-z0-9-]+$/),
    label: optionalString
});

const platformsSchema = z.array(
    z.discriminatedUnion('type', [
        z.object({
            type: z.literal('square'),
            enabled: z.boolean().default(true),
            preferred: z.boolean().optional(),
            linkOrModuleInfo: z.array(
                z.discriminatedUnion('type', [
                    squareLinkSchema,
                    squareModuleSchema
                ])
            ).min(1)
        })
    ])
).optional();

export const contactSocialsBookingSchema = ({image}: SchemaContext) => z.object({
    bookingProfilePicture: image().optional(),
    booksOpen: z.boolean().default(true),
    booksClosedNote: z.string(),
    contact: contactSchema,
    socials: socialsSchema,
    platforms: platformsSchema,
    bookingNote: optionalText,
}).optional();

export const siteInfoSocialsSchema = z
    .object(
        Object.fromEntries(socialTypes.map((k) => [k, optUrl])) as Record<
            SocialType,
            typeof optUrl
        >
    )
    .partial()
    .default({});