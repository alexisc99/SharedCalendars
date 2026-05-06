import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const KEY_B64 = process.env.EXTERNAL_CALENDAR_SECRET;

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // recommandé pour GCM

function getKey(): Buffer {
  if (!KEY_B64) {
    throw new Error('EXTERNAL_CALENDAR_SECRET is required');
  }
  const key = Buffer.from(KEY_B64, 'base64');
  if (key.length !== 32) {
    throw new Error('EXTERNAL_CALENDAR_SECRET must decode to 32 bytes');
  }
  return key;
}

/**
 * Format stocké: enc:v1:<b64(iv)>.<b64(tag)>.<b64(ciphertext)>
 * Le préfixe "enc:v1:" permet de distinguer clair vs chiffré (migration soft).
 */
export function encryptString(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith('enc:v1:');
}

export function decryptString(payload: string): string {
  if (!isEncrypted(payload)) {
    // migration soft: déjà en clair
    return payload;
  }

  const key = getKey();
  const data = payload.slice('enc:v1:'.length);
  const [ivB64, tagB64, ctB64] = data.split('.');
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('Invalid encrypted payload format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}
