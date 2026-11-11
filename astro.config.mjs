// @ts-check
import { defineConfig } from 'astro/config';
import { devProjectWriterPlugin } from './scripts/devProjectWriterPlugin.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://mysteryemblem.com',
  base: '/',
  vite: {
    plugins: [devProjectWriterPlugin()],
  },
});
