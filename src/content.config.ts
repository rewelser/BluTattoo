import { defineCollection, z } from "astro:content";
import { glob } from 'astro/loaders';

// const imageOrString = (image: any) => z.union([image(), z.string()]);


const emptyStrToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const emptyArrToUndef = (v: unknown) =>
  Array.isArray(v) && v.length === 0 ? undefined : v;

const urlOpt = z.preprocess(emptyStrToUndef, z
  .string()
  .trim()
  .url()
  .optional());

const socialKeys = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "x",
  "threads",
  "tumblr",
  "pinterest",
] as const;

const socialsSchema = z
  .object(
    Object.fromEntries(socialKeys.map((k) => [k, urlOpt])) as Record<
      (typeof socialKeys)[number],
      typeof urlOpt
    >
  )
  .partial()
  .default({});

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

    // date-only values will parse fine; you'll treat endDate as inclusive in your logic
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    funDate: z.coerce.date().optional(),
    funDate2: z.coerce.date().optional(),

    // optional time-only window
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

const artists = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/artists" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    order: z.number().default(999),    // ← add this
    photo: z.preprocess(emptyStrToUndef, z.string().optional()),
    socials: socialsSchema,
    images: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string().optional()
        })
      )
      .optional(),
    // NEW: Square Appointments embed
    square: z.object({
      enabled: z.boolean().optional(),
      merchantSlug: z.string().optional(),
      locationSlug: z.string().optional(),
      label: z.string().optional()
    }).optional(),
    booking_link: z.preprocess(emptyStrToUndef, z.string().url().optional())
  })
});

const aftercare = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/aftercare" }),
  schema: z.object({
    title: z.string().default("Aftercare")
    // Body is the markdown content; no schema needed for it.
  }),
});

// Data collection for 1-file-per-FAQ item
const faqs = defineCollection({
  loader: glob({ pattern: "**/*.{json,yaml,yml,toml}", base: "./src/content/faqs" }),
  schema: z.object({
    q: z.string(),
    a: z.string(),
    sort: z.number().optional(),
  }),
});

// src/content.config.ts
const siteInfo = defineCollection({
  loader: glob({ pattern: "**/*.{json,yaml,yml,toml}", base: "./src/content/siteInfo" }),
  schema: z.object({
    siteName: z.string(),
    address: z.string(),
    phone: z.preprocess(emptyStrToUndef, z.string().optional()),
    email: z.preprocess(emptyStrToUndef, z.string().optional()),
    hours: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    socials: socialsSchema,
  }),
});


export const collections = { artists, faqs, siteInfo, aftercare, events }; // & home