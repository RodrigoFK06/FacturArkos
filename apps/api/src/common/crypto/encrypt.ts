import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Cifrado de secrets de terceros at-rest (Playbook P1, §1).
 * AES-256-GCM: cifra + autentica. Si alguien manipula el ciphertext, `.final()`
 * lanza error al desencriptar. Clave maestra en env (`openssl rand -hex 32`).
 *
 * Formato de salida: `iv:authTag:ciphertext`, los tres en base64.
 */

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit IV recomendado para GCM
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function loadKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    // Fail-fast (P7): nunca arrancar con cifrado silenciosamente roto.
    throw new Error('SECRETS_ENCRYPTION_KEY requerida (openssl rand -hex 32)');
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== KEY_BYTES) {
    throw new Error('SECRETS_ENCRYPTION_KEY debe decodificar a 32 bytes (hex de 64 chars)');
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decrypt(ciphertext: string): string {
  const key = loadKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Formato de ciphertext inválido');
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag); // throwea en .final() si el tag no matchea
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/**
 * Detecta idempotentemente si un string ya está cifrado (Playbook §1).
 * Vital para no doble-encriptar y para migraciones legacy.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  try {
    return (
      Buffer.from(parts[0], 'base64').length === IV_BYTES &&
      Buffer.from(parts[1], 'base64').length === TAG_BYTES
    );
  } catch {
    return false;
  }
}

/** Cifra solo si aún no está cifrado (evita doble-cifrado en upsert/PATCH). */
export function toStored(value: string): string {
  return isEncrypted(value) ? value : encrypt(value);
}

/** Enmascara para el admin UI: nunca se devuelve el plaintext. */
export function maskTail(plaintext: string, visible = 4): string {
  if (!plaintext) return '';
  return `••••••${plaintext.slice(-visible)}`;
}
