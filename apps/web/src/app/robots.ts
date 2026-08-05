import type { MetadataRoute } from 'next';

/**
 * AEO Kit — allowlist explícita de crawlers de búsqueda e IA.
 * Solo se indexa la parte pública (landing, precios, tienda);
 * el POS y el panel quedan fuera.
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

const PRIVATE = ['/api/', '/pos', '/portal', '/imprimir', '/login', '/registro'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      ...AI_AND_SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: '/', disallow: PRIVATE })),
    ],
  };
}
