import {defineCollection, z} from "astro:content";
import {glob} from 'astro/loaders';
import {socialTypes} from "./domain/contact/defs.ts";

import type {SocialType} from "./domain/contact/types.ts";
import {frameTypes} from "./domain/decor/defs.ts";

// const imageOrString = (image: any) => z.union([image(), z.string()]);

/*** region *** Formatters ****/

const emptyStrToUndef = (v: unknown) =>
    typeof v === "string" && v.trim() === "" ? undefined : v;

const emptyArrToUndef = (v: unknown) =>
    Array.isArray(v) && v.length === 0 ? undefined : v;


const optionalString = z.preprocess(emptyStrToUndef, z.string().optional());
const optionalText = z.preprocess(emptyStrToUndef, z.string().optional());
const optUrl = z.string().url().optional();

const timeHM = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm");

const toHm = (v: unknown): unknown => {
    if (v instanceof Date) return v.toISOString().slice(11, 16); // HH:mm
    if (typeof v === "string") {
        const s = v.trim();
        if (/^\d{2}:\d{2}$/.test(s)) return s;
        const m = s.match(/T(\d{2}:\d{2})/);
        if (m?.[1]) return m[1];
    }
    return v;
};

const weekdayEnum = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);

const isoDate = z.preprocess((val) => {
    if (val instanceof Date) {
        return val.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    return val;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"));

/*** endregion ***/

/*** region *** Schemas ****/

const cmsFrameTypes = ["none", ...frameTypes] as const;

const frameSchema = z.enum(cmsFrameTypes)
    .transform((value) => (value === "none" ? undefined : value));

const primaryRoleSchema = z.enum(['Tattoo Artist', 'Piercer']);

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
export const socialItemSchema = z.object({
    type: z.enum(socialTypes),
    href: z.string().url(),
    enabled: z.boolean().default(true),
    bookable: z.boolean().default(false),
    preferred: z.boolean().optional(),
    handle: optionalString
});

export const socialsSchema = z.array(socialItemSchema).optional();

const squareLinkSchema = z.object({
    mode: z.literal('platformUrl'),
    enabled: z.boolean().default(true),
    href: z.string().url()
});

const squareModuleSchema = z.object({
    mode: z.literal('moduleInfo'),
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
                z.discriminatedUnion('mode', [
                    squareLinkSchema,
                    squareModuleSchema
                ])
            ).min(1)
        })
    ])
).optional();

export const siteInfoSocialsSchema = z
    .object(
        Object.fromEntries(socialTypes.map((k) => [k, optUrl])) as Record<
            SocialType,
            typeof optUrl
        >
    )
    .partial()
    .default({});

/*** endregion ***/

/*** region *** Events Collection ****/

const events = defineCollection({
    loader: glob({pattern: "**/*.{md,mdx}", base: "./src/content/events"}),
    schema: ({image}) => z.object({
        guestSpot: z.array(z.object({
                    type: z.literal("guestInfo"),
                    guestName: z.string(),
                    runwayPhoto: image().optional(),
                    runwayPhotoFrame: frameSchema,
                    primaryRole: primaryRoleSchema,
                    contactSocialsBooking: z.object({
                        bookingProfilePicture: image().optional(),
                        booksOpen: z.boolean().default(true),
                        booksClosedNote: z.string(),
                        contact: contactSchema,
                        socials: socialsSchema,
                        platforms: platformsSchema,
                        bookingNote: optionalText
                    }).optional(),
                }
            )
        )
            .max(1)
            .optional(),
        title: z.string(),
        detailsShort: z.preprocess(emptyStrToUndef, z.string().optional()),
        image: image().optional(),
        alt: z.preprocess(emptyStrToUndef, z.string().optional()),
        published: z.boolean().default(true),
        featured: z.boolean().default(false),
        archived: z.boolean().default(false),
        date: isoDate,
        endDate: z.preprocess(emptyStrToUndef, isoDate.optional()),
        startTime: z.preprocess(toHm, timeHM.optional()).optional(),
        endTime: z.preprocess(toHm, timeHM.optional()).optional(),
        location: z.preprocess(emptyStrToUndef, z.string().optional()),

        recurrenceRule: z
            .array(
                z.union([
                    z.object({
                        type: z.literal("recurrenceRuleWeekly"),
                        interval: z.number().int().min(1).default(1).optional(),
                        byWeekday: z.array(weekdayEnum).min(1),
                    }),
                    z.object({
                        type: z.literal("recurrenceRuleMonthly"),
                        interval: z.number().int().min(1).default(1).optional(),
                        monthlyMode: z.enum(["monthday", "ordinalWeekday"]),
                        byMonthDay: z.number().int().min(1).max(31).optional(),
                        byWeekday: weekdayEnum.optional(),
                        bySetPos: z.union([
                            z.literal(1),
                            z.literal(2),
                            z.literal(3),
                            z.literal(4),
                            z.literal(-1),
                        ]).optional(),
                    }),
                ])
            )
            .max(1)
            .optional(),

        promoBar: z
            .object({
                enabled: z.boolean().default(false),
                message: z.preprocess(emptyStrToUndef, z.string().optional()),
                href: z.preprocess(emptyStrToUndef, z.string().optional()),
                color1: z.preprocess(emptyStrToUndef, z.string().optional()),
                color2: z.preprocess(emptyStrToUndef, z.string().optional()),
            })
            .optional(),
    }).transform(({date, ...rest}) => ({
        ...rest,
        startDate: date,
    })),
});

/*** endregion ***/

/*** region *** People Collection ****/

const people = defineCollection({
    loader: glob({pattern: '**/[^_]*.{md,mdx}', base: './src/content/people'}),
    schema: ({image}) =>
        z.object({
            name: z.string(),
            active: z.boolean().default(true),
            order: z.number().default(999),

            pagePhoto: image().optional(),
            runwayPhoto: image().optional(),
            runwayPhotoFrame: frameSchema,

            primaryRole: primaryRoleSchema,

            contactSocialsBooking: z.object({
                bookingProfilePicture: image().optional(),
                booksOpen: z.boolean().default(true),
                booksClosedNote: z.string(),
                contact: contactSchema,
                socials: socialsSchema,
                platforms: platformsSchema,
                bookingNote: optionalText
            }).optional(),

            images: z.array(image()).optional(),

            body: optionalText
        })
});


/*** endregion ***/

/*** region *** Aftercare Collection ****/

const aftercare = defineCollection({
    loader: glob({pattern: "**/*.{md,mdx}", base: "./src/content/aftercare"}),
    schema: z.object({
        title: z.string().default("Aftercare")
        // Body is the markdown content; no schema needed for it.
    }),
});

/*** endregion ***/

/*** region *** FAQs Collection ****/

// 1-file-per-FAQ item
const faqs = defineCollection({
    loader: glob({pattern: "**/*.{json,yaml,yml,toml}", base: "./src/content/faqs"}),
    schema: z.object({
        q: z.string(),
        a: z.string(),
        sort: z.number().optional(),
    }),
});

/*** endregion ***/

/*** region *** Site Info Collection ****/

const siteInfo = defineCollection({
    loader: glob({pattern: "**/*.{json,yaml,yml,toml}", base: "./src/content/siteInfo"}),
    schema: z.object({
        siteName: z.string(),
        address: z.object({
            streetAddress: z.string(),
            addressLocality: z.string(),
            addressRegion: z.string().length(2),
            postalCode: z.string(),
            addressCountry: z.string().length(2).default("US")
        }),
        phone: z.preprocess(emptyStrToUndef, z.string().optional()),
        email: z.preprocess(emptyStrToUndef, z.string().optional()),
        hours: z.array(z.object({label: z.string(), value: z.string()})).optional(),
        socials: siteInfoSocialsSchema,
    }),
});

/*** endregion ***/

const imagetest = defineCollection({
    loader: glob({pattern: "**/*", base: "./src/content/imagetest"}),
    schema: ({image}) =>
        z.object({
            title: z.string(),
            src: image(),
            alt: z.string()
        }),
});

export const collections = {people, faqs, siteInfo, aftercare, events, imagetest}; // & home