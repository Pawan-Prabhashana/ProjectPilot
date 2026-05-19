/**
 * AES-256-GCM encryption for sensitive fields at rest.
 * Use for: private supervisor notes, optional contact fields.
 * Do not use for: fields that must be searched or filtered (e.g. email, names).
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be set and at least 32 characters (base64 recommended).');
  }
  const decoded = Buffer.from(secret, 'base64');
  if (decoded.length !== KEY_LENGTH) {
    return crypto.scryptSync(secret, 'projectpilot-salt', KEY_LENGTH);
  }
  return decoded;
}

/**
 * Encrypts a plaintext string. Returns base64-encoded: iv + authTag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypts a value produced by encrypt().
 */
export function decrypt(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

/**
 * Safe decrypt: returns null if input is null/undefined or decryption fails.
 */
export function decryptOptional(encoded: string | null | undefined): string | null {
  if (encoded == null || encoded === '') return null;
  try {
    return decrypt(encoded);
  } catch {
    return null;
  }
}
