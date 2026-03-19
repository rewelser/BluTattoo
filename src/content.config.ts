import { defineCollection, z } from "astro:content";
import { glob } from 'astro/loaders';

// const imageOrString = (image: any) => z.union([image(), z.string()]);

// ----------------------
//  Formatters
// ----------------------

const emptyStrToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const emptyArrToUndef = (v: unknown) =>
  Array.isArray(v) && v.length === 0 ? undefined : v;


const optionalString = z.preprocess(emptyStrToUndef, z.string().optional());
const optionalText = z.preprocess(emptyStrToUndef, z.string().optional());
const optUrl = z.preprocess(emptyStrToUndef, z.string().trim().url().optional());





// Commented out for now; home will ultimately be used for modifying splash content and that's it 
// const home = defineCollection({
//   loader: glob({ pattern: "**/*.{json,yaml,yml,toml}", base: "./src/content/home" }),
//   schema: z.object({
//     promoMain: z.object({
//       promoEnabled: z.boolean().default(true),
//       promoImage: z.preprocess(emptyStrToUndef, z.string().optional()),
//       promoAlt: z.preprocess(emptyStrToUndef, z.string().optional()),
//     }).optional(),
//   }),
// });

// ----------------------
//  Events
// ----------------------

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

const events = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/events" }),
  schema: z.object({
    title: z.string(),
    detailsShort: z.preprocess(emptyStrToUndef, z.string().optional()),

    image: z.preprocess(emptyStrToUndef, z.string().optional()),
    alt: z.preprocess(emptyStrToUndef, z.string().optional()),

    published: z.boolean().default(true),
    featured: z.boolean().default(false),
    archived: z.boolean().default(false),

    startDate: isoDate,
    endDate: z.preprocess(emptyStrToUndef, isoDate.optional()),

    startTime: z.preprocess(toHm, timeHM.optional()).optional(),
    endTime: z.preprocess(toHm, timeHM.optional()).optional(),

    location: z.preprocess(emptyStrToUndef, z.string().optional()),

    recurrenceRule: z
      .array(
        z.union([
          z.object({
            recurrenceRuleWeekly: z.object({
              interval: z.number().int().min(1).default(1).optional(),
              byWeekday: z.array(weekdayEnum).min(1),
            }),
          }),
          z.object({
            recurrenceRuleMonthly: z.object({
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
  }),
});

// ----------------------
//  People
// ----------------------

const primaryRoleSchema = z.enum(['tattoo_artist', 'piercer']);

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

const withCommonFlags = (shape: z.ZodRawShape) =>
  z.object({
    ...shape,
    enabled: z.boolean().default(true),
    preferred: z.boolean().optional()
  });

// todo: look up how .extend works
const contactBuilder = (type: string, shape: z.ZodRawShape) =>
  withCommonFlags(shape).extend({
    type: z.literal(type),
    notes: optionalText
  });

const contactSchema = z.array(
  z.discriminatedUnion('type', [
    contactBuilder('phone', { number: usPhoneSchema }),
    contactBuilder('email', { email_address: z.string().email() }),
    contactBuilder('website', { link: z.string().url() })
  ])
).optional();

const socialTypes = [
  'instagram',
  'facebook',
  'tiktok',
  'x',
  'threads',
  'tumblr',
  'youtube',
  'pinterest'
] as const;

const socialsSchema = z.array(
  z.object({
    type: z.enum(socialTypes),
    link: z.string().url(),
    enabled: z.boolean().default(true),
    bookable: z.boolean().default(false),
    preferred: z.boolean().optional()
  })
).optional();

const squareLinkSchema = z.object({
  type: z.literal('square_link'),
  enabled: z.boolean().default(true),
  url: z.string().url()
});

const squareModuleSchema = z.object({
  type: z.literal('module_info'),
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
      link_or_module_info: z.array(
        z.discriminatedUnion('type', [
          squareLinkSchema,
          squareModuleSchema
        ])
      ).min(1)
    })
  ])
).optional();

const people = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/people' }),
  schema: () =>
    z.object({
      name: z.string(),
      active: z.boolean().default(true),
      guest: z.boolean().default(false),
      order: z.number().default(999),

      page_photo: optionalString,
      runway_photo: optionalString,

      primary_role: primaryRoleSchema,

      contact_socials_booking: z.object({
        booking_profile_picture: optionalString,
        contact: contactSchema,
        socials: socialsSchema,
        platforms: platformsSchema,
        booking_note: optionalText
      }).optional(),

      images: z.array(
        z.object({
          src: z.string(),
          alt: optionalString
        })
      ).optional(),

      body: optionalText
    })
});


// const artists = defineCollection({
//   loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/artists" }),
//   schema: ({ image }) => z.object({
//     title: z.string(),
//     order: z.number().default(999),    // ← add this
//     artistPagePhoto: z.preprocess(emptyStrToUndef, z.string().optional()),
//     runwayPhoto: z.preprocess(emptyStrToUndef, z.string().optional()),
//     socials: socialsSchema,
//     images: z
//       .array(
//         z.object({
//           src: z.string(),
//           alt: z.string().optional()
//         })
//       )
//       .optional(),
//     // NEW: Square Appointments embed
//     square: z.object({
//       enabled: z.boolean().optional(),
//       merchantSlug: z.string().optional(),
//       locationSlug: z.string().optional(),
//       label: z.string().optional()
//     }).optional(),
//     booking_link: z.preprocess(emptyStrToUndef, z.string().url().optional())
//   })
// });

// ----------------------
//  Aftercare
// ----------------------

const aftercare = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/aftercare" }),
  schema: z.object({
    title: z.string().default("Aftercare")
    // Body is the markdown content; no schema needed for it.
  }),
});

// ----------------------
//  FAQ
// ----------------------

// Data collection for 1-file-per-FAQ item
const faqs = defineCollection({
  loader: glob({ pattern: "**/*.{json,yaml,yml,toml}", base: "./src/content/faqs" }),
  schema: z.object({
    q: z.string(),
    a: z.string(),
    sort: z.number().optional(),
  }),
});

// ----------------------
//  Site Info
// ----------------------

const siteInfoSocialsSchema = z
  .object(
    Object.fromEntries(socialTypes.map((k) => [k, optUrl])) as Record<
      (typeof socialTypes)[number],
      typeof optUrl
    >
  )
  .partial()
  .default({});

// src/content.config.ts
const siteInfo = defineCollection({
  loader: glob({ pattern: "**/*.{json,yaml,yml,toml}", base: "./src/content/siteInfo" }),
  schema: z.object({
    siteName: z.string(),
    address: z.string(),
    phone: z.preprocess(emptyStrToUndef, z.string().optional()),
    email: z.preprocess(emptyStrToUndef, z.string().optional()),
    hours: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    socials: siteInfoSocialsSchema,
  }),
});

const imagetest = defineCollection({
  loader: glob({ pattern: "**/*", base: "./src/content/imagetest" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      src: image(),
      alt: z.string()
    }),
});

export const collections = { people, faqs, siteInfo, aftercare, events, imagetest }; // & home