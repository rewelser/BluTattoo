// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
// import tailwind from "@tailwindcss/vite"; // should have this instead? with `tailwind()`?

import vercel from '@astrojs/vercel';

import decapCmsOauth from "astro-decap-cms-oauth";

import react from '@astrojs/react';

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // site: "https://blu-tattoo.vercel.app/",
  site: "https://www.blutattoostudio.com",
  vite: {
    // @ts-ignore
    plugins: [tailwindcss()]
  },

  integrations: [decapCmsOauth({
    decapCMSSrcUrl: "https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js"
  }), react(), sitemap()],

  adapter: vercel(),
});