import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import {
  adminRevision,
  merchantCodeHash,
  passwordMatches,
  sessionRevisionMatches,
  signSession,
  verifySession,
  validSigningSecret,
} from './securitySessions.ts';

export type AuthenticatedRequest = Request & {
  tenantId: string;
  actorName: string;
  actorRole: string;
  actorId: string;
  authRole: 'merchant';
};

export type AdminRequest = Request & {
  adminName: string;
  adminRevision: string;
};

function getSecret(): string | undefined {
  return process.env.SANAD_AUTH_SECRET;
}

function getAdminPassword(): string | undefined {
  return process.env.SANAD_ADMIN_PASSWORD;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function bearerToken(req: Request): string | undefined {
  const h = (req.headers.authorization as string) || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  return undefined;
}

function extractToken(req: Request, names: string[]): string | undefined {
  const cookies = parseCookies(req.headers.cookie as string | undefined);
  for (const n of names) {
    if (cookies[n]) return cookies[n];
  }
  const bearer = bearerToken(req);
  if (bearer) return bearer;
  // Fallback for tests: x-* headers
  const alt = (req.headers['x-admin-token'] as string) || (req.headers['x-merchant-token'] as string);
  if (alt) return alt as string;
  return undefined;
}

function cookieOpts(maxAgeSec: number) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  return `HttpOnly; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${isProd ? '; Secure' : ''}`;
}

function setCookie(res: Response, name: string, value: string, maxAgeSec: number) {
  const serialized = `${name}=${encodeURIComponent(value)}; ${cookieOpts(maxAgeSec)}`;
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', serialized);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, serialized]);
  } else {
    res.setHeader('Set-Cookie', [existing as string, serialized]);
  }
}

function clearCookie(res: Response, name: string) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const serialized = `${name}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProd ? '; Secure' : ''}`;
  const existing = res.getHeader('Set-Cookie');
  if (!existing) res.setHeader('Set-Cookie', serialized);
  else if (Array.isArray(existing)) res.setHeader('Set-Cookie', [...existing, serialized]);
  else res.setHeader('Set-Cookie', [existing as string, serialized]);
}

export function authSecretConfigured(): boolean {
  return validSigningSecret(getSecret());
}

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const secret = getSecret();
  const password = getAdminPassword();
  if (!validSigningSecret(secret) || !password) {
    // Dev fallback: allow open access when not configured (local testing without secrets)
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL && !validSigningSecret(secret)) {
      (req as any).adminName = 'مدير المنصة (مؤقت — بلا حماية)';
      return next();
    }
    return res.status(500).json({ error: 'AUTH_NOT_CONFIGURED', message: 'إعدادات الأمان غير مكتملة في الخادم.' });
  }
  const token = extractToken(req, ['sanad_admin_token', 'sanad_admin']);
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'يجب تسجيل دخول الإدارة أولاً.' });
  const claims = verifySession(token, secret, 'admin');
  if (!claims) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'انتهت صلاحية الجلسة، سجّل الدخول مجدداً.' });
  const expected = adminRevision(password);
  if (!sessionRevisionMatches(claims, expected)) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'كلمة المرور تغيّرت، سجّل الدخول مجدداً.' });
  }
  (req as AdminRequest).adminName = 'مدير المنصة';
  (req as AdminRequest).adminRevision = expected;
  (req as any).adminClaims = claims;
  next();
}

export function merchantAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const secret = getSecret();
  if (!validSigningSecret(secret)) {
    // Dev fallback: honor legacy x-tenant-id header when auth not configured
    const fallbackId = (req.headers['x-tenant-id'] as string) || 'tenant_alrowad';
    const fallbackTenant = db.getTenant(fallbackId);
    if (!fallbackTenant) return res.status(404).json({ error: 'المنشأة غير موجودة في النظام' });
    const authReq = req as AuthenticatedRequest;
    authReq.tenantId = fallbackId;
    const rawActorName = (req.headers['x-actor-name'] as string) || '';
    let decodedActorName = fallbackTenant.ownerName || fallbackTenant.tradeName || 'مالك المتجر';
    if (rawActorName) { try { decodedActorName = decodeURIComponent(rawActorName); } catch { decodedActorName = rawActorName; } }
    authReq.actorName = decodedActorName;
    authReq.actorRole = (req.headers['x-actor-role'] as string) || 'owner';
    authReq.actorId = (req.headers['x-actor-id'] as string) || 'emp_owner_' + fallbackId;
    authReq.authRole = 'merchant';
    return next();
  }
  const token = extractToken(req, ['sanad_merchant_token', 'sanad_merchant']);
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'يجب تسجيل دخول المتجر أولاً.' });
  const claims = verifySession(token, secret, 'merchant');
  if (!claims || !claims.tenantId) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'جلسة المتجر غير صالحة.' });
  const tenant = db.getTenant(claims.tenantId);
  if (!tenant) return res.status(401).json({ error: 'TENANT_NOT_FOUND', message: 'المتجر غير موجود.' });
  if (tenant.status === 'suspended') return res.status(403).json({ error: 'TENANT_SUSPENDED', message: 'المتجر موقوف.' });
  const storedHash = (tenant as any).merchantCodeHash as string | undefined;
  if (!storedHash || !/^[0-9a-f]{64}$/.test(storedHash)) {
    return res.status(401).json({ error: 'CODE_NOT_ISSUED', message: 'لم يتم إصدار رمز لهذا المتجر بعد.' });
  }
  if (!sessionRevisionMatches(claims, storedHash)) {
    return res.status(401).json({ error: 'CODE_ROTATED', message: 'رمز المتجر تغيّر، سجّل الدخول مجدداً.' });
  }
  const authReq = req as AuthenticatedRequest;
  authReq.tenantId = tenant.id;

  /*
   * جلسة الموظف (staff): رمز الموظف نفسه هو المصادقة، فلا نحتاج رأس
   * x-actor-id — بل العكس: نرفض أي محاولة لانتحال دور غيره من نفس الجهاز.
   */
  const staffToken = extractToken(req, ['sanad_staff_token']);
  if (staffToken) {
    const staffClaims = verifySession(staffToken, secret, 'staff');
    if (!staffClaims || staffClaims.tenantId !== tenant.id) {
      return res.status(401).json({ error: 'STAFF_SESSION_INVALID', message: 'جلسة الموظف غير صالحة، أدخل رمزك مجدداً.' });
    }
    const staffEmployee = (db.getSchema().employees || []).find((e) => e.id === staffClaims.employeeId && e.tenantId === tenant.id);
    if (!staffEmployee || staffEmployee.isActive === false) {
      return res.status(403).json({ error: 'STAFF_REVOKED', message: 'هذا الموظف غير مفعّل — راجع مالك المتجر.' });
    }
    authReq.actorId = staffEmployee.id;
    authReq.actorName = staffEmployee.name;
    authReq.actorRole = staffEmployee.role;
    authReq.authRole = 'merchant';
    (req as any).merchantClaims = claims;
    (req as any).staffSession = true;
    return next();
  }

  // Validate actor belongs to this tenant
  const rawActorId = (req.headers['x-actor-id'] as string) || 'emp_owner_' + tenant.id;
  const rawActorName = (req.headers['x-actor-name'] as string) || '';
  let decodedName = tenant.ownerName || tenant.tradeName || 'مالك المتجر';
  if (rawActorName) {
    try { decodedName = decodeURIComponent(rawActorName); } catch { decodedName = rawActorName; }
  }
  const rawRole = (req.headers['x-actor-role'] as string) || 'owner';
  // If actorId provided, ensure it belongs to tenant; otherwise default to tenant owner
  const employees = db.getSchema().employees || [];
  const employee = employees.find((e) => e.id === rawActorId);
  if (employee) {
    if (employee.tenantId !== tenant.id) {
      return res.status(403).json({ error: 'FORBIDDEN_ACTOR', message: 'هذا المستخدم لا يتبع هذا المتجر.' });
    }
    authReq.actorId = employee.id;
    authReq.actorName = employee.name;
    authReq.actorRole = employee.role;
  } else {
    // Fallback to tenant owner identity
    authReq.actorId = `emp_owner_${tenant.id}`;
    authReq.actorName = decodedName;
    authReq.actorRole = rawRole || 'owner';
  }
  authReq.authRole = 'merchant';
  (req as any).merchantClaims = claims;
  next();
}

// Optional helper to allow either admin or merchant for shared endpoints like audit logs?
// For now audit logs are merchant only.

export function issueAdminSession(password: string, res: Response): string | null {
  const secret = getSecret();
  const configured = getAdminPassword();
  if (!validSigningSecret(secret) || !configured) return null;
  if (!passwordMatches(password, configured)) return null;
  const revision = adminRevision(configured);
  const token = signSession({ role: 'admin', revision }, secret);
  setCookie(res, 'sanad_admin_token', token, 12 * 60 * 60);
  return token;
}

export function destroyAdminSession(res: Response) {
  clearCookie(res, 'sanad_admin_token');
}

export function issueMerchantSession(tenantId: string, codeHash: string, res: Response): string | null {
  const secret = getSecret();
  if (!validSigningSecret(secret)) return null;
  const tenant = db.getTenant(tenantId);
  if (!tenant) return null;
  const stored = (tenant as any).merchantCodeHash;
  if (stored !== codeHash) return null;
  const token = signSession({ role: 'merchant', tenantId, revision: codeHash }, secret);
  setCookie(res, 'sanad_merchant_token', token, 14 * 24 * 60 * 60);
  return token;
}

export function destroyMerchantSession(res: Response) {
  clearCookie(res, 'sanad_merchant_token');
  clearCookie(res, 'sanad_staff_token');
}

/**
 * جلسة الموظف — تُصدر بعد التحقق من رمزه السري.
 * مدة قصيرة (12 ساعة) لأنها جلسة وردية عمل، وتُربط برمز المتجر الحالي
 * (revision) فتبطل تلقائياً لو تغيّر كود المتجر.
 */
export function issueStaffSession(tenantId: string, revision: string, employeeId: string, res: Response): string | null {
  const secret = getSecret();
  if (!validSigningSecret(secret)) return null;
  try {
    const token = signSession({ role: 'staff', tenantId, employeeId, revision }, secret);
    setCookie(res, 'sanad_staff_token', token, 12 * 60 * 60);
    return token;
  } catch {
    return null;
  }
}

export function destroyStaffSession(res: Response) {
  clearCookie(res, 'sanad_staff_token');
}

/** الموظفون المتاحون للدخول في هذا المتجر (اسم + دور فقط — بلا أي بيانات حساسة). */
export function listStaffForLogin(tenantId: string): { id: string; name: string; role: string }[] {
  return (db.getSchema().employees || [])
    .filter((e) => e.tenantId === tenantId && e.isActive !== false && e.role !== 'super_admin')
    .map((e) => ({ id: e.id, name: e.name, role: e.role }));
}

/** يتحقق من رمز الموظف داخل متجر محدد. */
export function staffPinMatches(tenantId: string, employeeId: string, pin: unknown): { employee?: any; error?: 'EMPLOYEE_NOT_FOUND' | 'INVALID_PIN' } {
  const pinClean = String(pin ?? '').replace(/\D/g, '').slice(0, 6);
  if (pinClean.length < 4) return { error: 'INVALID_PIN' };
  const employee = (db.getSchema().employees || []).find((e) => e.id === employeeId && e.tenantId === tenantId);
  if (!employee || employee.isActive === false) return { error: 'EMPLOYEE_NOT_FOUND' };
  const actual = String((employee as any).pin || '');
  if (!actual) return { error: 'INVALID_PIN' };
  return actual === pinClean ? { employee } : { error: 'INVALID_PIN' };
}

export function merchantCodeMatchesForLogin(inputCode: string): { tenant: any; hash: string } | null {
  const hash = merchantCodeHash(inputCode);
  if (!hash) return null;
  const tenant = db.findTenantByMerchantCodeHash(hash);
  if (!tenant) return null;
  return { tenant, hash };
}
