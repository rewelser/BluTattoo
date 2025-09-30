import { defineCollection, z } from "astro:content";
import { glob } from 'astro/loaders';
import Image from "astro/components/Image.astro";
import { getImage } from "astro:assets";

const artists = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/artists" }),
  schema:  ({ image }) => z.object({
    title: z.string(),
    order: z.number().default(999),    // ← add this
    // photo: z.object({
    //   url: z.string(),
    //   alt: z.string(),
    // }).optional(),
    photo: image().optional(),
    styles: z.array(z.string()).optional(),
    instagram: z.string().url().optional(),
    // photo: z.string().url().optional(),          // ← add this line
    // photo: image(),            // ← local image, type-safe
    images: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string().optional()
        })
      )
      .optional(),
    bio: z.string().optional(),             // ← add this
    booking_link: z.string().url().optional() // ← optional: add if you want a button
  })
});

export const collections = { artists };
