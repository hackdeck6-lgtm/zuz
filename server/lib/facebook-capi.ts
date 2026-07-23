import { createHash } from 'node:crypto';

/** SHA-256 hex de email normalizado (trim + lowercase), conforme exigido pelo CAPI. */
export function hashEmail(email: string): string {
  return createHash('sha256')
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex');
}
