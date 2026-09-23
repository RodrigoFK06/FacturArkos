import type { MetadataRoute } from 'next';
import { PRIVATE, SITE_URL } from '@/lib/seo.mjs';

/**
 * AEO Kit — allowlist explícita de crawlers de búsqueda e IA.
 * Solo se indexa la parte pública (landing, precios, tienda);
 * el POS y el panel quedan fuera (lista en lib/seo.mjs).
 */
const AI_AND_SEARCH_BOTS = [
  'Googlebot',
  'Bingbot',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Meta-ExternalAgent',
  'CCBot',
  'Amazonbot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      ...AI_AND_SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: '/', disallow: PRIVATE })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
