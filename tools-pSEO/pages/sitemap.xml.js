import { generateAllLanes } from '../data/trade-lanes';

const BASE = 'https://tools.supplychaindisaster.com';

function SitemapXML() {
  return null;
}

export async function getServerSideProps({ res }) {
  const lanes = generateAllLanes();

  const today = new Date().toISOString().split('T')[0];

  const urls = [
    // Hub homepage
    `  <url>
    <loc>${BASE}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <lastmod>${today}</lastmod>
  </url>`,
    // Calculator pages
    `  <url>
    <loc>${BASE}/lead-time-calculator</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>`,
    `  <url>
    <loc>${BASE}/bullwhip-effect-calculator</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <lastmod>${today}</lastmod>
  </url>`,
    // All trade lane pages
    ...lanes.map(lane => `  <url>
    <loc>${BASE}/${lane.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <lastmod>${today}</lastmod>
  </url>`),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls.join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
  res.write(sitemap);
  res.end();

  return { props: {} };
}

export default SitemapXML;
