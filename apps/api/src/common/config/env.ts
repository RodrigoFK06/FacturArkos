/**
 * Validación de entorno fail-fast (Playbook P7).
 * Si falta una credencial crítica, se lanza error al arrancar — nunca fallbacks
 * dummy que dejan pasar llamadas con credenciales falsas.
 */

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'SECRETS_ENCRYPTION_KEY'] as const;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((k) => {
    const v = config[k];
    return v === undefined || v === null || String(v).trim() === '';
  });
  if (missing.length > 0) {
    throw new Error(`Variables de entorno requeridas faltantes: ${missing.join(', ')}`);
  }

  // La clave de cifrado debe decodificar a 32 bytes.
  const key = String(config['SECRETS_ENCRYPTION_KEY']);
  if (Buffer.from(key, 'hex').length !== 32) {
    throw new Error('SECRETS_ENCRYPTION_KEY debe decodificar a 32 bytes (openssl rand -hex 32)');
  }

  return config;
}

export const env = {
  nodeEnv: () => process.env.NODE_ENV ?? 'development',
  port: () => parseInt(process.env.PORT ?? '3001', 10),
  corsOrigins: () => (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()),
  jwtSecret: () => process.env.JWT_SECRET as string,
  jwtExpiresIn: () => process.env.JWT_EXPIRES_IN ?? '12h',
  apisunat: () => ({
    baseUrl: process.env.APISUNAT_BASE_URL ?? 'https://back.apisunat.com',
    personaId: process.env.APISUNAT_PERSONA_ID ?? '',
    token: process.env.APISUNAT_TOKEN ?? '',
    testMode: (process.env.APISUNAT_TEST_MODE ?? 'true') === 'true',
  }),
  peruApi: () => ({
    baseUrl: process.env.PERU_API_BASE_URL ?? 'https://api.apis.net.pe',
    token: process.env.PERU_API_TOKEN ?? '',
  }),
  /**
   * IA opcional, agnóstica de proveedor (API compatible con OpenAI):
   * DeepSeek (por defecto, el más barato), MiniMax, OpenRouter, Gemini, etc.
   * Sin key, las features degradan con un aviso claro.
   * Visión (OCR) se configura aparte porque DeepSeek no tiene modelos con visión;
   * si no se define AI_VISION_MODEL, el OCR queda deshabilitado.
   */
  ai: () => ({
    baseUrl: process.env.AI_BASE_URL ?? 'https://api.deepseek.com',
    apiKey: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? 'deepseek-chat',
    vision: {
      baseUrl: process.env.AI_VISION_BASE_URL ?? process.env.AI_BASE_URL ?? 'https://api.deepseek.com',
      apiKey: process.env.AI_VISION_API_KEY ?? process.env.AI_API_KEY ?? '',
      model: process.env.AI_VISION_MODEL ?? '', // vacío = OCR deshabilitado
    },
  }),
};
