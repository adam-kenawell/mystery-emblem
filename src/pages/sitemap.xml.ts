import type { APIRoute } from 'astro';
import { INFO_PAGES, SITE_URL } from '../siteMeta';

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const paths = ['/', ...INFO_PAGES.map((p) => p.path)];
  const urls = paths
    .map(
      (path) =>
        `  <url><loc>${SITE_URL}${path}</loc><lastmod>${lastmod}</lastmod><priority>${path === '/' ? '1.0' : '0.8'}</priority></url>`
    )
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
