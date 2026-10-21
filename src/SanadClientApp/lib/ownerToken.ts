/**
 * Per-device token that proves who published an ad.
 *
 * The shopper app has no login, so "ownership" is established by a random
 * secret generated once and kept in localStorage. It is required to delete an
 * ad — the server rejects any request that cannot present it.
 */
const STORAGE_KEY = 'sanad_owner_token';

export function getOwnerToken(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;

    const token =
      'own_' +
      (crypto.randomUUID?.() ??
        `${Date.now()}_${Math.random().toString(36).slice(2)}`
      ).replace(/-/g, '');
    localStorage.setItem(STORAGE_KEY, token);
    return token;
  } catch {
    // Private mode / storage blocked: still return something usable per session.
    return 'own_fallback_' + Math.random().toString(36).slice(2);
  }
}
