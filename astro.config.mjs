import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://pucz.hu',
  integrations: [
    sitemap({
      // An error page should not appear among crawlable URLs.
      filter: (page) => !new URL(page).pathname.startsWith('/404'),
    }),
  ],
});
