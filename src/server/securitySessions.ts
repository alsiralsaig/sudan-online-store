/**
 * Authentication primitives for the staged access-control migration.
 * Pure functions: no cookies, database writes, or route policy are enabled here.
 * Callers MUST additionally check tenant status and compare revision against
 * the current stored code hash/password fingerprint on every request.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type SessionRole = 'admin' | 'merchant' | 'staff';
export interface SessionClaims {
  v: 1;
  role: SessionRole;
  tenantId?: string;
  /** للموظف: معرّف سجل الموظف داخل المتجر. */
  employeeId?: string;
  revision: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

function safeEqual(a: string, b: string): boolean {
  const first = createHash('sha256').update(a, 'utf8').digest();
  const second = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(first, second);
}

export function validSigningSecret(secret: string | undefined): secret is string {
  return typeof secret === 'string' && secret.length >= 32 && secret.length <= 1024;
}

export function passwordMatches(input: unknown, configured: string | undefined): boolean {
  if (typeof input !== 'string' || input.length > 1024 || !configured || configured.length > 1024) return false;
  return safeEqual(input, configured);
}

/**
 * كود المتجر — ثلاث مجموعات من ٤ خانات (SND-XXXX-XXXX-XXXX).
 * ليه: الكود القديم كان ٤٤ خانة (١١ مقطعاً) لا يمكن كتابته على ورقة أو
 * إملائه في الهاتف، وكان الحقل يعرض نصفه فقط فيُقصّ ويُرفض. الآن ١٢ خانة:
 * سهل النسخ والإملاء، ويُكتب بسرعة على لوحة أرقام/حروف.
 * الحصانة: ١٢ خانة من أبجدية ٣٢ حرفاً ≈ ٦٠ بت، مع حدّ محاولات خاطئة على
 * الخادم — كافية تماماً لكود دخول متجر.
 */
const MERCHANT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بلا I/O/0/1 (تُلتبس)

export function newMerchantCode(): string {
  const block = () =>
    Array.from({ length: 4 }, () => MERCHANT_CODE_ALPHABET[Math.floor(Math.random() * MERCHANT_CODE_ALPHABET.length)]).join('');
  return `SND-${block()}-${block()}-${block()}`;
}

/** يقبل الصيغة القصيرة الجديدة والقديمة (٤٤ خانة) — القديمة تبقى صالحة للدخول. */
export function merchantCodeHash(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 80) return null;
  const normalized = input.toUpperCase().replace(/[\s-]/g, '');
  /*
   * جديد: SND + ٨ إلى ١٦ خانة من أبجدية بلا I/O/0/1.
   * المدى يسمح بأن يكون كود الطلب (٤+٤ = ٨ خانات) هو نفسه كود الدخول —
   * كود واحد لكل متجر — وكذلك الكود القصير الجديد (٤+٤+٤ = ١٢ خانة).
   */
  if (/^SND[A-HJ-NP-Z2-9]{8,16}$/.test(normalized)) {
    return createHash('sha256').update(`sanad-merchant-code-v2:${normalized}`, 'utf8').digest('hex');
  }
  /* قديم: SND + 40 خانة hex */
  if (/^SND[0-9A-F]{40}$/.test(normalized)) {
    return createHash('sha256').update(`sanad-merchant-code-v1:${normalized}`, 'utf8').digest('hex');
  }
  return null;
}

export function merchantCodeMatches(input: unknown, expectedHash: unknown): boolean {
  if (typeof expectedHash !== 'string' || !/^[0-9a-f]{64}$/.test(expectedHash)) return false;
  const actual = merchantCodeHash(input);
  return actual !== null && safeEqual(actual, expectedHash);
}

export function adminRevision(password: string): string {
  return createHash('sha256').update(`sanad-admin-password-v1:${password}`, 'utf8').digest('hex');
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(`sanad-session-v1.${payload}`).digest('base64url');
}

export function signSession(input: { role: SessionRole; tenantId?: string; employeeId?: string; revision: string }, secret: string, now = Date.now()): string {
  if (!validSigningSecret(secret)) throw new Error('AUTH_SECRET_NOT_CONFIGURED');
  if (!/^[0-9a-f]{64}$/.test(input.revision)) throw new Error('INVALID_REVISION');
  if ((input.role === 'merchant' || input.role === 'staff') && (typeof input.tenantId !== 'string' || !input.tenantId || input.tenantId.length > 200)) throw new Error('TENANT_REQUIRED');
  if (input.role === 'admin' && input.tenantId !== undefined) throw new Error('INVALID_ADMIN_TENANT');
  if (input.role === 'staff' && (typeof input.employeeId !== 'string' || !input.employeeId || input.employeeId.length > 200)) throw new Error('EMPLOYEE_REQUIRED');
  const maxAge = input.role === 'admin' ? 12 * 60 * 60 * 1000 : 14 * 24 * 60 * 60 * 1000;
  const claims: SessionClaims = {
    v: 1,
    role: input.role,
    ...(input.role === 'merchant' || input.role === 'staff' ? { tenantId: input.tenantId } : {}),
    ...(input.role === 'staff' ? { employeeId: input.employeeId } : {}),
    revision: input.revision,
    issuedAt: now,
    expiresAt: now + maxAge,
    nonce: randomBytes(16).toString('hex'),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

/** Signature validation only. The caller must check current revision and status. */
export function verifySession(token: unknown, secret: string | undefined, role: SessionRole, now = Date.now()): SessionClaims | null {
  if (!validSigningSecret(secret) || typeof token !== 'string' || token.length > 4096) return null;
  const pieces = token.split('.');
  if (pieces.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(pieces[0]) || !/^[A-Za-z0-9_-]{43}$/.test(pieces[1])) return null;
  if (!safeEqual(pieces[1], signature(pieces[0], secret))) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(pieces[0], 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object') return null;
    const claims = value as SessionClaims;
    if (claims.v !== 1 || claims.role !== role || !Number.isSafeInteger(claims.issuedAt) || !Number.isSafeInteger(claims.expiresAt) || claims.issuedAt > now || claims.expiresAt <= now || claims.expiresAt <= claims.issuedAt || !/^[0-9a-f]{64}$/.test(claims.revision) || !/^[0-9a-f]{32}$/.test(claims.nonce)) return null;
    if ((claims.role === 'merchant' || claims.role === 'staff') && (typeof claims.tenantId !== 'string' || !claims.tenantId || claims.tenantId.length > 200)) return null;
    if (claims.role === 'admin' && claims.tenantId !== undefined) return null;
    if (claims.role === 'staff' && (typeof claims.employeeId !== 'string' || !claims.employeeId || claims.employeeId.length > 200)) return null;
    const maxAge = role === 'admin' ? 12 * 60 * 60 * 1000 : 14 * 24 * 60 * 60 * 1000;
    if (claims.expiresAt - claims.issuedAt > maxAge) return null;
    return claims;
  } catch { return null; }
}

export function sessionRevisionMatches(claims: SessionClaims, expected: unknown): boolean {
  return typeof expected === 'string' && /^[0-9a-f]{64}$/.test(expected) && safeEqual(claims.revision, expected);
}
