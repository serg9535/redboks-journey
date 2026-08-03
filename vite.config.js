import { defineConfig } from 'vite';

// base = '/' for local dev and Vercel/Netlify, '/<repo>/' when built for GitHub Pages
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/redboks-journey/' : '/',
});
