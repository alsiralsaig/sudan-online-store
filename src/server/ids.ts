/**
 * Collision-resistant identifiers.
 *
 * The old pattern `prod_${Date.now()}` collides whenever two requests land in
 * the same millisecond — under concurrent load one record silently overwrote
 * another (same primary key, ON CONFLICT DO UPDATE). Timestamp for sortability
 * plus crypto randomness for uniqueness.
 */
import { randomUUID } from 'crypto';

export function newId(prefix: string): string {
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

/** Deterministic-looking but unique short code, used for SKUs and doc numbers. */
export function newCode(prefix: string, pad = 6): string {
  const rand = randomUUID().replace(/-/g, '').slice(0, pad).toUpperCase();
  return `${prefix}-${rand}`;
}
