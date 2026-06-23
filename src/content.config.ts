import {defineCollection, z} from "astro:content";
import {glob} from 'astro/loaders';
import {
    emptyStrToUndef,
    isoDate,
    optionalString,
    optionalText,
    timeHM,
    toHm,
    weekdayEnum
} from "./domain/base/schema.ts";
import {contactSocialsBookingSchema, siteInfoSocialsSchema} from "./domain/contact/schema.ts";
import {frameSchema, videoSchema} from "./domain/decor/schema.ts";
import {primaryRoleSchema} from "./domain/people/schema.ts";

/*** region *** Events Collection ****/

const events = defineCollection({
    loader: glob({pattern: "**/*.{md,mdx}", base: "./src/content/events"}),
    schema: ({image}) => z.object({
        guestSpot: z.object({
            guestName: z.string(),
            runwayPhoto: image().optional(),
            runwayPhotoFrame: frameSchema,
            primaryRole: primaryRoleSchema,
            contactSocialsBooking: contactSocialsBookingSchema({image}),
        }).optional(),
        title: z.string(),
        detailsShort: z.preprocess(emptyStrToUndef, z.string().optional()),
        image: image().optional(),
        ogPhotoTextless: optionalString,
        ogPhotoTexted: optionalString,
        alt: z.preprocess(emptyStrToUndef, z.string().optional()),
        published: z.boolean().default(true),
        featured: z.boolean().default(false),
        archived: z.boolean().default(false),
        date: isoDate,
        endDate: z.preprocess(emptyStrToUndef, isoDate.optional()),
        startTime: z.preprocess(toHm, timeHM.optional()).optional(),
        endTime: z.preprocess(toHm, timeHM.optional()).optional(),
        location: z.preprocess(emptyStrToUndef, z.string().optional()),
        images: z.array(image()).optional(),

        recurrenceRule: z.union([
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
        ]).optional(),

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
            ogPhotoTextless: optionalString,
            ogPhotoTexted: optionalString,
            runwayPhoto: image().optional(),
            runwayPhotoFrame: frameSchema,

            primaryRole: primaryRoleSchema,

            contactSocialsBooking: contactSocialsBookingSchema({image}),

            images: z.array(image()).optional(),

            shortBio: optionalText,
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

const faqSections = defineCollection({
    loader: glob({
        pattern: "**/*.{md,mdx}",
        base: "./src/content/faq-sections",
    }),
    schema: z.object({
        name: z.string(),
        sort: z.number().optional().default(0),
    }),
});

// 1-file-per-FAQ item
const faqs = defineCollection({
    loader: glob({pattern: "**/*.{md,mdx}", base: "./src/content/faqs"}),
    schema: z.object({
        name: z.string(),
        section: z.string().default("General"),
        sort: z.number().optional(),
    }),
});

/*** endregion ***/

/*** region *** Site Info Collection ****/

const siteInfo = defineCollection({
    loader: glob({pattern: "**/*.{json,yaml,yml,toml}", base: "./src/content/siteInfo"}),
    schema: z.object({
        siteName: z.string(),
        siteUrl: z.string().url(),
        address: z.object({
            streetAddress: z.string(),
            addressLocality: z.string(),
            addressRegion: z.string().length(2),
            postalCode: z.string(),
            addressCountry: z.string().length(2).default("US"),
            placeId: z.string(),
        }),
        phone: z.preprocess(emptyStrToUndef, z.string().optional()),
        email: z.preprocess(emptyStrToUndef, z.string().optional()),
        hours: z.array(z.object({label: z.string(), value: z.string()})).optional(),
        hoursShortline: z.string(),
        socials: siteInfoSocialsSchema,
    }),
});

/*** endregion ***/

/*** region *** Branding Collection ****/

const branding = defineCollection({
    loader: glob({pattern: "**/*.{json,yaml,yml,toml}", base: "./src/content/branding"}),
    schema: ({image}) =>
        z.object({
            logoDark: image(),
            logoDarkBold: image().optional(),
            logoLight: image(),
            logoLightBold: image().optional(),
            bookingFlashLight: image().optional(),
            bookingFlashDark: image().optional(),
            sitewideOGPhoto: z.string(),
            bookingShareOGPhoto: z.string(),

            ourLocation: z.object({
                shopImage: image(),
            }).optional(),

            ourArtists: z.object({
                video: videoSchema({image}).optional(),
            }).optional(),

            ourProcess: z.object({
                video: videoSchema({image}).optional(),
                processText: z.string(),
                scrollPeelStackImage1: image(),
                scrollPeelStackImage2: image(),
                scrollPeelStackImage3: image(),
                scrollPeelStackSideImage1: image(),
                scrollPeelStackSideImage2: image(),
                scrollPeelStackSideImage3: image(),
                scrollPeelStackSideImage4: image(),
            }).optional(),

            ourStory: z.object({
                video: videoSchema({image}).optional(),
                frameImage: image(),
                frameWindowSvg: image(),
                image: image(),
                imgAltText: optionalText,
                storyText: z.string(),
            }).optional(),

            hero: z.object({
                video: videoSchema({image}).optional(),
                bookingHeroPhoto: image(),
            }).optional(),
        }),
});

/*** endregion ***/

export const collections = {people, faqSections, faqs, siteInfo, aftercare, events, branding}; // & home?