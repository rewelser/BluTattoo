import { defineCollection, z } from "astro:content";
import { glob } from 'astro/loaders';

// const imageOrString = (image: any) => z.union([image(), z.string()]);


const emptyStrToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const emptyArrToUndef = (v: unknown) =>
  Array.isArray(v) && v.length === 0 ? undefined : v;

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

const events = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/events" }),
  schema: z.object({
    title: z.string(),
    published: z.boolean().default(true),
    featured: z.boolean().default(false),

    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    location: z.preprocess(emptyStrToUndef, z.string().optional()),

    hero: z
      .object({
        image: z.preprocess(emptyStrToUndef, z.string().optional()),
        alt: z.preprocess(emptyStrToUndef, z.string().optional()),
      })
      .optional(),

    promoBar: z
      .object({
        enabled: z.boolean().default(false),
        message: z.preprocess(emptyStrToUndef, z.string().optional()),
        href: z.preprocess(emptyStrToUndef, z.string().optional()),
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
    styles: z.preprocess(
      (v) => emptyArrToUndef(v),
      z.array(z.string()).optional()
    ),
    instagram: z.preprocess(emptyStrToUndef, z.string().url().optional()),
    instagramUser: z.preprocess(emptyStrToUndef, z.string().optional()),
    images: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string().optional()
        })
      )
      .optional(),
    bio: z.preprocess(emptyStrToUndef, z.string().optional()),
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
    address: z.string(),
    phone: z.preprocess(emptyStrToUndef, z.string().optional()),
    email: z.preprocess(emptyStrToUndef, z.string().optional()),
    hours: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  }),
});


export const collections = { artists, faqs, siteInfo, aftercare, events }; // & home