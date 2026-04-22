// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
// import tailwind from "@tailwindcss/vite"; // should have this instead? with `tailwind()`?

import vercel from '@astrojs/vercel';

import decapCmsOauth from "astro-decap-cms-oauth";

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [decapCmsOauth({
    decapCMSSrcUrl: "https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js"
  }), react()],

  adapter: vercel(),
});