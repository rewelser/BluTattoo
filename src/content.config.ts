import { defineCollection, z } from "astro:content";
import { glob } from 'astro/loaders';

// const imageOrString = (image: any) => z.union([image(), z.string()]);

const artists = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/artists" }),
  schema:  ({ image }) => z.object({
    title: z.string(),
    order: z.number().default(999),    // ← add this
    // photo: imageOrString(image).optional(),
    // photo: image().optional(),
    photo: z.string().optional(),
    styles: z.array(z.string()).optional(),
    instagram: z.string().url().optional(),
    images: z
      .array(
        z.object({
          // src: imageOrString(image),
          // src: image(),
          src: z.string(),
          alt: z.string().optional()
        })
      )
      .optional(),
    bio: z.string().optional(),
    // NEW: Square Appointments embed
    square: z.object({
      enabled: z.boolean().optional(),
      merchantSlug: z.string().optional(),
      locationSlug: z.string().optional(),
      label: z.string().optional()
    }).optional(),
    booking_link: z.string().url().optional()
  })
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

// Site-wide editable info (address, hours, promo banner)
const siteInfo = defineCollection({
  loader: glob({ pattern: "**/*.{json,yaml,yml,toml}", base: "./src/content/siteInfo" }),
  schema: z.object({
    address: z.string(),
    phone: z.string().optional(),
    hours: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    promoBanner: z
      .object({
        enabled: z.boolean(),
        text: z.string(),
        url: z.string().optional(),
      })
      .optional(),

    branding: z.object({
      background: z.string().optional(), // e.g. "/uploads/misc_images/backgrounds/background.jpg"
      logo: z.string().optional(),       // e.g. "/uploads/misc_images/logos/blutattoo.svg"
    }).optional(),
  }),
});

export const collections = { artists, faqs, siteInfo };