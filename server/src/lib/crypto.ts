import crypto from 'crypto';

/**
 * Cryptographic utilities for HMAC signing, hashing, etc.
 * Used for webhook signatures, API key hashing, etc.
 */

/**
 * Generate HMAC-SHA256 signature
 * Used for webhook payload signing
 */
export function generateHmacSignature(secret: string, payload: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify HMAC-SHA256 signature (constant-time comparison)
 */
export function verifyHmacSignature(
  secret: string,
  payload: string,
  signature: string
): boolean {
  const expectedSignature = generateHmacSignature(secret, payload);

  // Use timingSafeEqual to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(expectedSignature);
    const actualBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch (error) {
    return false;
  }
}

/**
 * Generate a secure random string (for API keys, secrets, etc.)
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash a value using SHA-256
 * Used for API key storage (not for passwords - use bcrypt for those)
 */
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a deterministic ID from multiple fields
 * Useful for creating idempotency keys
 */
export function generateIdempotencyKey(...fields: string[]): string {
  const combined = fields.join(':');
  return hashValue(combined);
}
