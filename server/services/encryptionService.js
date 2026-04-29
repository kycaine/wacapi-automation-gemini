import { createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext) {
    const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
        iv.toString('base64'),
        authTag.toString('base64'),
        encrypted.toString('base64'),
    ].join(':');
}

/**
 * Decrypt a string encrypted by the encrypt() function.
 */
export function decrypt(encryptedData) {
    const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
    const [ivB64, authTagB64, encryptedB64] = encryptedData.split(':');

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]);

    return decrypted.toString('utf8');
}

/**
 * Hash an API key using HMAC-SHA256 for safe storage.
 */
export function hashApiKey(apiKey) {
    return createHmac('sha256', env.ENCRYPTION_KEY)
        .update(apiKey)
        .digest('hex');
}

/**
 * Generate a cryptographically secure random API key.
 */
export function generateApiKey() {
    return `wac_${randomBytes(32).toString('hex')}`;
}

/**
 * Timing-safe comparison of two strings.
 */
export function safeCompare(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Meta webhook HMAC-SHA256 signature.
 * @param {string} rawBody - Raw request body string
 * @param {string} signature - Value of X-Hub-Signature-256 header
 */
export function verifyWebhookSignature(rawBody, signature) {
    const expected = `sha256=${createHmac('sha256', env.META_APP_SECRET)
        .update(rawBody, 'utf8')
        .digest('hex')}`;
    try {
        return safeCompare(expected, signature);
    } catch {
        return false;
    }
}
