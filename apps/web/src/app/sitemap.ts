import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo.mjs';

/** Solo lo público. /tienda y /portal son por organización y no se listan. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/precios`, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
