import type {
  Tenant,
  Branch,
  Employee,
  Product,
  BranchInventory,
  BranchTransfer,
  CashierShift,
  Sale,
  CurrencyConfig,
  CurrencyRateHistory,
  StorefrontOrder,
  Expense,
  Purchase,
  SubscriptionPlan,
  SubscriptionPayment,
  AuditLog,
  ReturnRecord,
  Customer,
  AlbandarListing,
  AlbandarShowroom,
  KitchenTicket,
  KitchenStatus,
  RecurringExpense,
  PromotionRule,
  InventoryAlert,
  InventoryAudit,
  InventoryAuditItem,
} from '../types/index.ts';

import {
  cacheProductsLocally,
  getLocallyCachedProducts,
  saveOfflineSale,
  getPendingOfflineSales,
  clearSyncedSales,
} from './indexedDb.ts';

/** ترجمة رموز الأخطاء الشائعة إلى عربية واضحة (تُستخدم عندما لا يرسل الخادم رسالة). */
const ARABIC_ERRORS: Record<string, string> = {
  INVALID_CODE: 'الكود غير صحيح أو ليس كود دخول متجر — تأكد أنك نسخت كود المتجر (SND-…) كاملاً.',
  CODE_NOT_ISSUED: 'هذا المتجر لم يُصدر له كود دخول بعد — تواصل مع إدارة سند.',
  CODE_TENANT_MISMATCH: 'هذا الكود يخص متجراً آخر.',
  TENANT_SUSPENDED: 'هذا المتجر موقوف — تواصل مع إدارة سند.',
  INVALID_PIN: 'الرمز السري غير صحيح.',
  EMPLOYEE_NOT_FOUND: 'الموظف غير موجود في هذا المتجر.',
  OFFLINE_MODE: 'لا يوجد اتصال بالإنترنت.',
  UNAUTHORIZED: 'يلزم تسجيل الدخول أولاً.',
};

/**
 * عنوان الـAPI كما يراه التطبيق الأصلي (APK).
 * ---------------------------------------------------------------------------
 * داخل المتصفح كل الطلبات نسبية (`/api/...`) وتعمل لأن الصفحة والـAPI على نفس
 * النطاق. لكن داخل تطبيق أندرويد الأصلي تُقدَّم الواجهة من أصل `https://localhost`
 * (WebView محلي، ليعمل بدون إنترنت)، فلا بد من عنوان مطلق لخادم سند.
 * يُحدَّد عبر VITE_API_BASE وقت البناء، ويرجع لسلوك المتصفح تلقائياً لو غير موجود.
 */
const NATIVE_SHELL_ORIGIN =
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const API_BASE = String((import.meta as any)?.env?.VITE_API_BASE || '').replace(/\/$/, '');

/**
 * رمز جلسة المتجر محفوظ أيضاً في localStorage.
 * ---------------------------------------------------------------------------
 * ملف تعريف الارتباط (Cookie) لا يُحفظ داخل تطبيق أندرويد لأن الطلبات تعبر
 * أصولاً مختلفة (localhost ← خادم سند)، لذلك نحفظ الرمز ونرسله كـBearer —
 * الخادم يقبل الاثنين (extractToken) فلم نحتج لتغيير الخادم.
 */
const MERCHANT_TOKEN_KEY = 'sanad_merchant_token';
const ADMIN_TOKEN_KEY = 'sanad_admin_token';

function readStoredToken(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStoredToken(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* التخزين غير متاح (وضع خاص) — نكمل بالكوكي فقط */
  }
}

/**
 * يحوّل أي مسار داخلي (`/api/...`) إلى عنوان مطلق عند العمل داخل التطبيق الأصلي.
 * الروابط المُخزّنة في قاعدة البيانات للصور والفيديو نسبية، فتصبح مطلقة تلقائياً.
 */
export function apiUrl(pathOrUrl: string): string {
  if (!pathOrUrl || !API_BASE) return pathOrUrl;
  if (/^(https?:|data:|blob:)/i.test(pathOrUrl)) return pathOrUrl;
  return pathOrUrl.startsWith('/') ? `${API_BASE}${pathOrUrl}` : `${API_BASE}/${pathOrUrl}`;
}

function absolutizeDeep<T>(value: T, depth = 0): T {
  if (!API_BASE || depth > 8 || value == null) return value;
  if (typeof value === 'string') {
    return (value.startsWith('/api/') ? `${API_BASE}${value}` : value) as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => absolutizeDeep(v, depth + 1)) as unknown as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = absolutizeDeep(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}

class ApiClient {
  private tenantId: string = 'tenant_alrowad';
  /**
   * الافتراضي «مالك المتجر» لا اسم شخص بعينه — الاسم الحقيقي يأتي من بيانات
   * المتجر بعد التحميل (كان الافتراضي اسم مالك المتجر التجريبي، فيظهر في كل
   * المتاجر كأنه المالك).
   */
  private currentActor = {
    id: 'owner_default',
    name: 'مالك المتجر',
    role: 'owner',
  };
  private currentBranchId: string = 'branch_kht_main';
  private isSimulatedOffline: boolean = false;
  private onOfflineStatusChangeCallbacks: ((isOffline: boolean) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const savedTenant = localStorage.getItem('sanad_tenant_id');
      if (savedTenant) this.tenantId = savedTenant;

      const savedBranch = localStorage.getItem('sanad_branch_id');
      if (savedBranch) this.currentBranchId = savedBranch;

      const savedActor = localStorage.getItem('sanad_actor');
      if (savedActor) {
        try {
          this.currentActor = JSON.parse(savedActor);
        } catch {
          // ignore
        }
      }

      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());
    }
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  /**
   * يمسح أي أثر لمتجر/موظف سابق على هذا الجهاز.
   * ليه: التاجر دخل بكود متجر جديد فظهر له متجره القديم «برادايس»، لأن
   * معرّف المتجر والموظف محفوظان في localStorage من جلسة سابقة.
   */
  public clearLocalSession() {
    this.tenantId = null;
    this.currentActor = { id: 'owner_default', name: 'مالك المتجر', role: 'owner' };
    this.currentBranchId = '';
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sanad_tenant_id');
      localStorage.removeItem('sanad_actor');
      localStorage.removeItem('sanad_branch_id');
    }
  }

  public setTenantId(id: string) {
    this.tenantId = id;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sanad_tenant_id', id);
    }
  }

  public getBranchId(): string {
    return this.currentBranchId;
  }

  public setBranchId(id: string) {
    this.currentBranchId = id;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sanad_branch_id', id);
    }
  }

  public getActor() {
    return this.currentActor;
  }

  public setActor(actor: { id: string; name: string; role: string }) {
    this.currentActor = actor;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sanad_actor', JSON.stringify(actor));
    }
  }

  public isOffline(): boolean {
    if (this.isSimulatedOffline) return true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
    return false;
  }

  public toggleSimulateOffline(simulate?: boolean): boolean {
    this.isSimulatedOffline = simulate !== undefined ? simulate : !this.isSimulatedOffline;
    this.handleNetworkChange();
    return this.isSimulatedOffline;
  }

  public isSimulatingOffline(): boolean {
    return this.isSimulatedOffline;
  }

  public onNetworkStatusChange(callback: (isOffline: boolean) => void) {
    this.onOfflineStatusChangeCallbacks.push(callback);
    return () => {
      this.onOfflineStatusChangeCallbacks = this.onOfflineStatusChangeCallbacks.filter((c) => c !== callback);
    };
  }

  private handleNetworkChange() {
    const offline = this.isOffline();
    for (const cb of this.onOfflineStatusChangeCallbacks) {
      cb(offline);
    }
  }

  private getHeaders(): Record<string, string> {
    // HTTP header values must be Latin-1, so the Arabic actor name is
    // percent-encoded here and decoded again on the server.
    return {
      'Content-Type': 'application/json',
      'x-tenant-id': this.tenantId,
      /*
       * لا نرسل x-actor-id: هوية الموظف تُستخرج من الجلسة على الخادم، وإرسالها
       * من المتصفح كان يخلق خلطاً (طالب تصريح يُرى كأنه المالك). أُبقي الرأس
       * محذوفاً عمداً.
       */
      'x-actor-name': encodeURIComponent(this.currentActor.name || ''),
      'x-actor-role': this.currentActor.role,
      /*
       * داخل التطبيق الأصلي لا تُحفظ الكوكيز عبر الأصول، فنرسل رمز الجلسة
       * كـBearer. في المتصفح لا يوجد رمز محفوظ عادةً فالكوكي يتولى الأمر.
       */
      ...(readStoredToken(MERCHANT_TOKEN_KEY) || readStoredToken(ADMIN_TOKEN_KEY)
        ? { authorization: `Bearer ${readStoredToken(MERCHANT_TOKEN_KEY) || readStoredToken(ADMIN_TOKEN_KEY)}` }
        : {}),
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (this.isOffline() && !endpoint.startsWith('/storefront/')) {
      throw new Error('OFFLINE_MODE');
    }

    const res = await fetch(`${API_BASE}/api${endpoint}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      let msg = 'حدث خطأ في استجابة الخادم';
      try {
        const data = await res.json();
        /*
         * نُفضّل الرسالة العربية (message) على الرمز الإنجليزي (error).
         * ليه: التاجر كان يرى «INVALID_CODE» وحدها فلا يفهم إن كان الكود
         * خطأ أم أن المتجر لم يُفعّل بعد.
         */
        msg = data.message || ARABIC_ERRORS[data.error] || data.error || msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    const data = await res.json();
    return absolutizeDeep(data);
  }

  /* Auth — merchant per-store code + platform admin */
  public async getAuthStatus(): Promise<{ authSecretConfigured: boolean; adminPasswordConfigured: boolean }> {
    return this.request('/auth/status');
  }
  public async merchantLogin(code: string, hint?: string): Promise<{ success: boolean; token: string; tenant: any }> {
    /*
     * مدخل واحد «متجري»: يقبل كود المتجر أو كود الطلب المعتمد، ويُنشئ متجر
     * المتجر الجديد ويدخله في نفس الطلب — بلا تفعيل منفصل ولا انتظار.
     */
    try {
      const res = await this.request<{ success: boolean; token: string; tenant: any; merchantCode?: string | null; welcomeMessage?: string }>(
        '/auth/merchant/enter',
        { method: 'POST', body: JSON.stringify({ code }) }
      );
      if (res?.token) writeStoredToken(MERCHANT_TOKEN_KEY, res.token);
      return res as any;
    } catch (primary: any) {
      /* توافق خلفي: المسار القديم ما زال يعمل (أكواد قديمة ٤٤ خانة) */
      try {
        const res = await this.request<{ success: boolean; token: string; tenant: any }>(
          '/auth/merchant/login',
          { method: 'POST', body: JSON.stringify({ code, slug: hint, tenantId: hint }) }
        );
        if (res?.token) writeStoredToken(MERCHANT_TOKEN_KEY, res.token);
        return res;
      } catch {
        throw primary;
      }
    }
  }
  /** يسترجع/يصدر كود دخول المتجر لتاجر يملك كود الطلب المعتمد. */
  public async getStoreAccessCode(applicationCode: string, rotate = false): Promise<{ success: boolean; issued?: boolean; tenant?: any; merchantCode: string | null; merchantCodeMessage?: string; canRotate?: boolean }> {
    return this.request('/tenant-applications/access-code', {
      method: 'POST',
      body: JSON.stringify({ code: applicationCode, rotate }),
    });
  }

  public async merchantMe(): Promise<{ authenticated: boolean; tenant: Tenant }> {
    return this.request('/auth/merchant/me');
  }
  public async merchantLogout(): Promise<{ success: boolean }> {
    const res = await this.request<{ success: boolean }>('/auth/merchant/logout', { method: 'POST', body: '{}' });
    writeStoredToken(MERCHANT_TOKEN_KEY, '');
    return res;
  }

  /* ---- دخول الموظف برمزه السري ---- */

  public async staffList(): Promise<{ success: boolean; employees: { id: string; name: string; role: string }[] }> {
    return this.request('/auth/staff/list');
  }

  public async staffMe(): Promise<{ success: boolean; staffSession: boolean; employee: { id: string; name: string; role: string } }> {
    return this.request('/auth/staff/me');
  }

  public async staffLogin(employeeId: string, pin: string): Promise<{ success: boolean; employee: { id: string; name: string; role: string } }> {
    const res = await this.request<{ success: boolean; token?: string; employee: { id: string; name: string; role: string } }>(
      '/auth/staff/login',
      { method: 'POST', body: JSON.stringify({ employeeId, pin }) }
    );
    if (res?.token) writeStoredToken(MERCHANT_TOKEN_KEY, res.token);
    return res;
  }

  public async staffLogout(): Promise<{ success: boolean }> {
    return this.request('/auth/staff/logout', { method: 'POST', body: '{}' });
  }
  public async adminLogin(password: string): Promise<{ success: boolean; token: string }> {
    const res = await this.request<{ success: boolean; token: string }>(
      '/auth/admin/login',
      { method: 'POST', body: JSON.stringify({ password }) }
    );
    if (res?.token) writeStoredToken(ADMIN_TOKEN_KEY, res.token);
    return res;
  }
  public async adminMe(): Promise<{ authenticated: boolean }> {
    return this.request('/auth/admin/me');
  }
  public async adminLogout(): Promise<{ success: boolean }> {
    const res = await this.request<{ success: boolean }>('/auth/admin/logout', { method: 'POST', body: '{}' });
    writeStoredToken(ADMIN_TOKEN_KEY, '');
    return res;
  }
  /** إصلاح شامل: إصدار كود دخول لكل متجر نشط بلا كود (بعد النشر). */
  public async repairMerchantCodes(rotateAll = false): Promise<{ success: boolean; count: number; repaired: { tenantId: string; name: string; code: string }[]; message: string }> {
    return this.request('/admin/tenants/repair-codes', { method: 'POST', body: JSON.stringify({ rotateAll }) });
  }

  /** تحويل كل أكواد المتاجر إلى الصيغة القصيرة الجديدة (يعيد كل الأكواد). */
  public async shortenAllCodes(): Promise<{ success: boolean; count: number; repaired: { tenantId: string; name: string; code: string }[]; message: string }> {
    return this.request('/admin/tenants/repair-codes', { method: 'POST', body: JSON.stringify({ rotateAll: true }) });
  }

  /* ---- الربط بين الطبقات (B2B Item Sync) ---- */

  /** المتاجر التي يمكنني الربط بها (الطبقة الأعلى فقط). */
  public async getLinkSources(): Promise<{ sources: any[]; viewer: { accountSegment: string; isVip: boolean } }> {
    return this.request('/links/sources');
  }

  /** كتالوج أصناف متجر مصدر + حالة الربط لكل صنف. */
  public async getLinkCatalog(tenantId: string, q = ''): Promise<{ source: any; products: any[] }> {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    return this.request(`/links/catalog/${encodeURIComponent(tenantId)}${query}`);
  }

  /** طلبات التوريد: الواردة (أنا المورد) والصادرة (أنا الطالب). */
  public async getSupplyOrders(): Promise<{ incoming: any[]; outgoing: any[]; totals: { incomingPending: number; outgoingPending: number } }> {
    return this.request('/supply-orders');
  }

  public async sendSupplyOrder(payload: { sellerTenantId: string; items: Array<{ productId: string; quantity: number }>; note?: string }) {
    return this.request('/supply-orders', { method: 'POST', body: JSON.stringify(payload) });
  }

  public async setSupplyOrderStatus(id: string, status: string, sellerNote?: string) {
    return this.request(`/supply-orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status, sellerNote }) });
  }

  /** للطبقة الأعلى: من ربط بأصنافي وبأي هامش وسعر. */
  public async getIncomingLinks(): Promise<{ buyers: any[]; totals: { buyers: number; links: number; itemsLinked: number } }> {
    return this.request('/links/incoming');
  }

  /** روابطي (تزامن فوري عند الفتح). */
  public async getItemLinks(): Promise<{ links: any[]; count: number }> {
    return this.request('/links');
  }

  /** ربط سلعة بهامش نسبة %. */
  public async linkItem(input: { sourceItemId: string; marginPercent: number; myItemId?: string }) {
    return this.request('/links', { method: 'POST', body: JSON.stringify(input) });
  }

  public async updateLinkMargin(linkId: string, marginPercent: number) {
    return this.request(`/links/${encodeURIComponent(linkId)}`, { method: 'PATCH', body: JSON.stringify({ marginPercent }) });
  }

  /** تعديل سعري يدوياً (مسموح). */
  public async setLinkPrice(linkId: string, sellingPriceSdg: number) {
    return this.request(`/links/${encodeURIComponent(linkId)}/price`, { method: 'PATCH', body: JSON.stringify({ sellingPriceSdg }) });
  }

  /** إرجاع السعر للحساب التلقائي. */
  public async resetLinkPrice(linkId: string) {
    return this.request(`/links/${encodeURIComponent(linkId)}/reset-price`, { method: 'POST', body: '{}' });
  }

  public async unlinkItem(linkId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
  }

  /** المنصة: نوع الحساب (قطاعي/جملة/مورد) + تشغيل VIP. */
  public async setTenantSegment(
    tenantId: string,
    accountSegment?: 'retailer' | 'wholesaler' | 'supplier',
    isVip?: boolean
  ): Promise<{ success: boolean; tenant: any }> {
    return this.request(`/admin/tenants/${encodeURIComponent(tenantId)}/segment`, {
      method: 'POST',
      body: JSON.stringify({ accountSegment, isVip }),
    });
  }

  public async issueMerchantCode(tenantId: string): Promise<{ success: boolean; code: string; tenantId: string }> {
    return this.request(`/admin/tenants/${encodeURIComponent(tenantId)}/merchant-code`, { method: 'POST', body: '{}' });
  }

  /* Tenant endpoints */
  /** قائمة المتاجر العامة لتطبيق الجمهور (بلا بيانات حساسة). */
  public async getPublicStores(): Promise<{ tenants: any[] }> {
    return this.request('/market/stores');
  }
  /** قائمة المتاجر الكاملة — للإدارة فقط. */
  public async getTenantsList(): Promise<{ tenants: any[] }> {
    return this.request('/tenants/list');
  }

  public async getCurrentTenant(): Promise<{ tenant: Tenant }> {
    return this.request('/tenants/current');
  }

  public async updateCurrentTenant(payload: Partial<Tenant>): Promise<{ success: boolean; tenant: Tenant }> {
    return this.request('/tenants/current', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  /* Branches */
  public async getBranches(): Promise<{ branches: Branch[] }> {
    return this.request('/branches');
  }

  public async createBranch(payload: Partial<Branch>): Promise<{ success: boolean; branch: Branch }> {
    return this.request('/branches', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /* Employees */
  public async getEmployees(): Promise<{ employees: Employee[] }> {
    return this.request('/employees');
  }

  public async createEmployee(payload: Partial<Employee>): Promise<{ success: boolean; employee: Employee }> {
    return this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateEmployee(
    id: string,
    payload: Partial<Employee>
  ): Promise<{ success: boolean; employee: Employee }> {
    return this.request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public async deleteEmployee(id: string): Promise<{ success: boolean }> {
    return this.request(`/employees/${id}`, { method: 'DELETE' });
  }

  /* ---- تصريح المالك لإضافة الموظفين ---- */

  /** هل هذه الإضافة تحتاج تصريح مالك؟ */
  public async checkEmployeeApproval(role: string, permissions: string[]): Promise<{ required: boolean; reason: string }> {
    return this.request('/employees/approval-check', {
      method: 'POST',
      body: JSON.stringify({ role, permissions }),
    });
  }

  public async requestEmployeeApproval(payload: {
    employeeName: string;
    employeeRole: string;
    permissions: string[];
  }): Promise<{ success: boolean; required: boolean; approval: any; reason: string }> {
    return this.request('/employees/approvals', { method: 'POST', body: JSON.stringify(payload) });
  }

  public async getEmployeeApprovals(): Promise<{ success: boolean; approvals: any[] }> {
    return this.request('/employees/approvals');
  }

  public async getEmployeeApproval(id: string): Promise<{ success: boolean; approval: any }> {
    return this.request(`/employees/approvals/${encodeURIComponent(id)}`);
  }

  public async approveEmployeeApproval(id: string, ownerPin: string): Promise<{ success: boolean; approval: any }> {
    return this.request(`/employees/approvals/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ ownerPin }),
    });
  }

  public async rejectEmployeeApproval(id: string): Promise<{ success: boolean; approval: any }> {
    return this.request(`/employees/approvals/${encodeURIComponent(id)}/reject`, { method: 'POST', body: '{}' });
  }

  /** تحليل جملة بيع باللهجة السودانية على الخادم (قواعد ثم Gemini) */
  public async parseSaleVoice(speechText: string): Promise<{
    source: string;
    lines: {
      productId: string | null;
      productName: string;
      quantity: number;
      unit: string;
      unitId?: string;
      unitPrice: number;
      confidence: number;
      notes: string;
    }[];
    clarifications: { phrase: string; reason: string; suggestions: string[] }[];
    paymentMethod: string;
    discountAmount: number;
    discountPercent: number;
    customerName: string | null;
    summary: string;
  }> {
    return this.request('/ai/parse-sale', {
      method: 'POST',
      body: JSON.stringify({ speechText }),
    });
  }

  /* Products & Inventory with Offline Fallback */
  public async getProducts(): Promise<{ products: Product[] }> {
    if (this.isOffline()) {
      const cached = await getLocallyCachedProducts();
      return { products: cached };
    }
    const res = await this.request<{ products: Product[] }>('/products');
    if (res.products) {
      cacheProductsLocally(res.products).catch((err) => console.warn('Cache error:', err));
    }
    return res;
  }

  public async createProduct(payload: any): Promise<{ success: boolean; product: Product }> {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateProduct(id: string, payload: Record<string, unknown>): Promise<{ success: boolean; product: Product }> {
    return this.request(`/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  public async deleteProduct(id: string): Promise<{ success: boolean }> {
    return this.request(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  public async getInventory(branchId?: string): Promise<{ inventory: (BranchInventory & { product?: Product; branch?: Branch })[] }> {
    const q = branchId ? `?branchId=${branchId}` : '';
    return this.request(`/inventory${q}`);
  }

  public async adjustInventory(payload: {
    branchId: string;
    productId: string;
    delta: number;
    reason: string;
    type?: string;
  }): Promise<{ success: boolean; newBalance: number }> {
    return this.request('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getStockMovements(branchId?: string): Promise<{ movements: any[] }> {
    const q = branchId ? `?branchId=${branchId}` : '';
    return this.request(`/inventory/movements${q}`);
  }

  /* Branch Transfers */
  public async getTransfers(): Promise<{ transfers: BranchTransfer[] }> {
    return this.request('/transfers');
  }

  public async requestTransfer(payload: any): Promise<{ success: boolean; transfer: BranchTransfer }> {
    return this.request('/transfers/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async dispatchTransfer(id: string): Promise<{ success: boolean; transfer: BranchTransfer }> {
    return this.request(`/transfers/${id}/dispatch`, { method: 'POST' });
  }

  public async receiveTransfer(id: string, payload: any): Promise<{ success: boolean; transfer: BranchTransfer }> {
    return this.request(`/transfers/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /* POS Shifts */
  public async getCurrentShift(cashierId?: string): Promise<{ shift: CashierShift | null }> {
    const q = cashierId ? `?cashierId=${cashierId}` : '';
    return this.request(`/pos/shifts/current${q}`);
  }

  public async openShift(payload: {
    branchId: string;
    openingCashSdg: number;
    cashierId?: string;
    cashierName?: string;
  }): Promise<{ success: boolean; shift: CashierShift }> {
    return this.request('/pos/shifts/open', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async closeShift(payload: {
    shiftId: string;
    actualCashSdg: number;
    closeNotes?: string;
  }): Promise<{ success: boolean; shift: CashierShift }> {
    return this.request('/pos/shifts/close', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async reviewShift(id: string, payload: { reviewNotes: string }): Promise<{ success: boolean; shift: CashierShift }> {
    return this.request(`/pos/shifts/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getShifts(): Promise<{ shifts: CashierShift[] }> {
    return this.request('/pos/shifts');
  }

  /* POS Sales with OFFLINE-FIRST support */
  public async recordSale(salePayload: any): Promise<{ success: boolean; sale: Sale; isOffline?: boolean }> {
    const saleId = salePayload.id || `sale_cli_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const invoiceNumber = salePayload.invoiceNumber || `INV-OFF-${Date.now().toString().slice(-6)}`;

    const fullSale: Sale = {
      ...salePayload,
      id: saleId,
      invoiceNumber,
      tenantId: this.tenantId,
      cashierId: this.currentActor.id,
      cashierName: this.currentActor.name,
      createdAt: new Date().toISOString(),
    };

    if (this.isOffline()) {
      fullSale.isOfflineCreated = true;
      await saveOfflineSale(fullSale);
      return { success: true, sale: fullSale, isOffline: true };
    }

    try {
      const res = await this.request<{ success: boolean; sale: Sale }>('/pos/sales', {
        method: 'POST',
        body: JSON.stringify(fullSale),
      });
      return { ...res, isOffline: false };
    } catch (err: any) {
      console.warn('Network error during online sale, saving offline:', err);
      fullSale.isOfflineCreated = true;
      await saveOfflineSale(fullSale);
      return { success: true, sale: fullSale, isOffline: true };
    }
  }

  public async getSales(branchId?: string): Promise<{ sales: Sale[] }> {
    const q = branchId ? `?branchId=${branchId}` : '';
    return this.request(`/pos/sales${q}`);
  }

  public async refundSale(
    saleId: string,
    payload: {
      reason: string;
      returnItems?: { productId: string; quantity: number }[];
    }
  ): Promise<{ success: boolean; returnRecord?: ReturnRecord; sale?: Sale }> {
    return this.request(`/pos/sales/${saleId}/refund`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getReturns(branchId?: string): Promise<{ returns: ReturnRecord[] }> {
    const q = branchId ? `?branchId=${branchId}` : '';
    return this.request(`/pos/returns${q}`);
  }

  /* Customers & Loyalty Points */
  public async getCustomers(search?: string): Promise<{ customers: Customer[] }> {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/pos/customers${q}`);
  }

  public async createCustomer(data: Partial<Customer>): Promise<{ success: boolean; customer: Customer }> {
    return this.request('/pos/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateCustomer(id: string, data: Partial<Customer>): Promise<{ success: boolean; customer: Customer }> {
    return this.request(`/pos/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async getCustomerHistory(id: string): Promise<{
    customer: Customer;
    sales: Sale[];
    summary: {
      totalInvoices: number;
      totalSpentSdg: number;
      averageInvoiceSdg: number;
      loyaltyPoints: number;
      lastPurchaseAt?: string;
    };
  }> {
    return this.request(`/pos/customers/${id}/history`);
  }

  /* Offline Sync Queue */
  public async syncPendingOfflineSales(): Promise<{ success: boolean; syncedCount: number; errors: any[] }> {
    const pending = await getPendingOfflineSales();
    if (!pending.length) {
      return { success: true, syncedCount: 0, errors: [] };
    }

    const res = await fetch('/api/sync/batch', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ sales: pending }),
    });

    if (!res.ok) {
      throw new Error('فشلت مزامنة المبيعات مع الخادم');
    }

    const result = await res.json();
    if (result.syncedIds && result.syncedIds.length) {
      await clearSyncedSales(result.syncedIds);
    }

    return result;
  }

  public async getPendingOfflineCount(): Promise<number> {
    const pending = await getPendingOfflineSales();
    return pending.length;
  }

  /* Multi-Currency */
  public async getCurrencies(): Promise<{ currencies: CurrencyConfig[] }> {
    return this.request('/currencies');
  }

  public async updateCurrencyRate(code: string, rateToSdg: number, isActive?: boolean): Promise<{ success: boolean; currency: CurrencyConfig }> {
    return this.request(`/currencies/${code}`, {
      method: 'PUT',
      body: JSON.stringify({ rateToSdg, isActive }),
    });
  }

  /** Live parallel-market rates snapshot (used by the currencies screen). */
  public async getParallelRates(): Promise<{
    snapshot: any;
    stale: boolean;
    sources: any;
    refreshEveryHours: number;
  }> {
    return this.request('/currency/parallel-rates');
  }

  /** Force a refresh from the public sources right now. */
  /**
   * «تحديث الآن» لأسعار السوق الموازي.
   * المسار العام (/currency/refresh) يعمل للتاجر والجمهور بلا صلاحية إدارية؛
   * المسار الإداري يبقى للمتوافق لو أردنا استخدامه لاحقاً.
   */
  public async refreshParallelRates(): Promise<{ success: boolean; updated?: number; snapshot: any }> {
    return this.request('/currency/refresh', { method: 'POST' });
  }

  public async runCurrencyAlertScan(): Promise<{
    success: boolean;
    refreshed?: boolean;
    reason?: string;
    message: string;
    moves?: Array<{ code: string; name: string; rate: number; percent: number }>;
    alerts?: { triggered: any[]; inApp: number };
  }> {
    // مسار عام: التاجر يستخدم «فحص التحركات» بلا صلاحية إدارية
    return this.request('/currency/alerts/run', { method: 'POST' });
  }

  public async getCurrencyHistory(): Promise<{ history: CurrencyRateHistory[] }> {
    return this.request('/currencies/history');
  }

  /* Financial Reports */
  public async getReportsSummary(branchId?: string): Promise<{ summary: any }> {
    const q = branchId ? `?branchId=${branchId}` : '';
    return this.request(`/reports/summary${q}`);
  }

  /* Expenses & Purchases */
  public async getExpenses(): Promise<{ expenses: Expense[] }> {
    return this.request('/expenses');
  }

  public async createExpense(payload: any): Promise<{ success: boolean; expense: Expense }> {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getPurchases(): Promise<{ purchases: Purchase[] }> {
    return this.request('/purchases');
  }

  public async createPurchase(payload: {
    branchId: string;
    supplierName: string;
    invoiceNumber?: string;
    currency?: string;
    exchangeRate?: number;
    items: any[];
    paymentStatus?: 'paid' | 'partial' | 'credit';
    notes?: string;
  }): Promise<{ success: boolean; purchase: Purchase }> {
    return this.request('/purchases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /* Storefront */
  public async getStorefront(slug: string): Promise<{ store: any; branches: any[]; products: any[] }> {
    const res = await fetch(`/api/storefront/${slug}`);
    if (!res.ok) {
      /* نُبقي رسالة الخادم (VIP/جملة/قيد المراجعة) حتى تظهر للمستخدم كما هي */
      const body = await res.json().catch(() => null);
      const msg = (body && (body.error || body.message)) || 'المتجر غير متاح';
      throw new Error(msg === 'المتجر غير متاح أو قيد المراجعة' ? 'المعروضات متاحة لعملاء VIP — رقِّ حسابك إلى VIP لتتمكن من مشاهدة المعروضات' : msg);
    }
    return res.json();
  }

  public async submitStoreOrder(slug: string, payload: any): Promise<{ success: boolean; order: StorefrontOrder }> {
    const res = await fetch(`/api/storefront/${slug}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('فشل إرسال الطلب');
    return res.json();
  }

  public async getStorefrontOrders(): Promise<{ orders: StorefrontOrder[] }> {
    return this.request('/storefront-orders');
  }

  public async updateStoreOrderStatus(id: string, status: string, paymentStatus?: string): Promise<{ success: boolean }> {
    return this.request(`/storefront-orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, paymentStatus }),
    });
  }

  /* Subscriptions */
  public async getSubscriptionPlans(): Promise<{ plans: SubscriptionPlan[] }> {
    return this.request('/subscriptions/plans');
  }

  public async getCurrentSubscription(): Promise<{ tenant: Tenant; currentPlan: SubscriptionPlan; payments: SubscriptionPayment[] }> {
    return this.request('/subscriptions/current');
  }

  public async submitSubscriptionPayment(payload: {
    planId: string;
    amountSdg: number;
    paymentMethod: string;
    paymentRef: string;
    bankTransferSlipUrl?: string;
  }): Promise<{ success: boolean; payment: SubscriptionPayment }> {
    return this.request('/subscriptions/submit-payment', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /* ---------------- Market catalog & auctions (public) ---------------- */

  /** كتالوج السوق العام: منتجات كل المتاجر + الإعلانات الفردية. */
  /** التصنيفات الموجودة فعلاً في السوق (من البيانات لا قائمة ثابتة). */
  public async getMarketCategories(): Promise<{ categories: Array<{ name: string; count: number }>; total: number }> {
    return this.request('/market/categories');
  }

  public async getMarketCatalog(params: { category?: string; search?: string; limit?: number } = {}): Promise<{
    items: any[];
    counts: { products: number; ads: number; stores: number };
  }> {
    const q = new URLSearchParams();
    if (params.category) q.set('category', params.category);
    if (params.search) q.set('search', params.search);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return this.request(`/market/catalog${qs ? `?${qs}` : ''}`);
  }

  /** المزادات العامة + مزاداتي. */
  public async getMarketAuctions(ownerToken?: string): Promise<{ auctions: any[]; mine: any[] }> {
    return this.request('/market/auctions', {
      headers: ownerToken ? { 'x-owner-token': ownerToken } : {},
    });
  }

  public async createMarketAuction(payload: any): Promise<{ success: boolean; auction: any; message: string }> {
    return this.request('/market/auctions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async placeAuctionBid(id: string, amountSdg: number, bidder: string): Promise<{ success: boolean; auction: any }> {
    return this.request(`/market/auctions/${encodeURIComponent(id)}/bid`, {
      method: 'POST',
      body: JSON.stringify({ amountSdg, bidder }),
    });
  }

  /* Central SaaS Admin */
  /* ---------------- Market ads ---------------- */

  public async getMarketAds(ownerToken?: string): Promise<{
    ads: any[]; mine: any[]; pricing: { standardFeeSdg: number; vipFeeSdg: number; currency: string };
  }> {
    return this.request('/market-ads', {
      headers: ownerToken ? { 'x-owner-token': ownerToken } : {},
    });
  }

  public async createMarketAd(payload: any): Promise<{ success: boolean; ad: any; message: string }> {
    return this.request('/market-ads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** تعديل إعلان أملكه — نفس جهاز النشر (owner token) */
  public async updateMyMarketAd(
    id: string,
    ownerToken: string,
    payload: any
  ): Promise<{ success: boolean; ad: any; message?: string }> {
    return this.request(`/market-ads/${id}`, {
      method: 'PUT',
      headers: { 'x-owner-token': ownerToken },
      body: JSON.stringify(payload),
    });
  }

  /** تفعيل متجر موافَق عليه بكود الدخول الذي أرسلته الإدارة */
  public async activateTenantStore(code: string): Promise<{ success: boolean; created?: boolean; tenant: any; message?: string }> {
    return this.request('/tenant-applications/activate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  public async deleteMyMarketAd(id: string, ownerToken: string): Promise<{ success: boolean }> {
    return this.request(`/market-ads/${id}`, {
      method: 'DELETE',
      headers: { 'x-owner-token': ownerToken },
    });
  }

  public async getAdminMarketAds(status: string = 'all'): Promise<{
    ads: any[]; counts: any; pricing: any;
  }> {
    return this.request(`/admin/market-ads?status=${encodeURIComponent(status)}`);
  }

  /* ---------------- Admin: auctions moderation ---------------- */

  public async getAdminMarketAuctions(status: string = 'all'): Promise<{
    auctions: any[]; counts: any;
  }> {
    return this.request(`/admin/market-auctions?status=${encodeURIComponent(status)}`);
  }

  public async reviewMarketAuction(
    id: string,
    decision: 'approved' | 'rejected',
    note?: string
  ): Promise<{ success: boolean; auction: any }> {
    return this.request(`/admin/market-auctions/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    });
  }

  public async deleteAdminMarketAuction(id: string): Promise<{ success: boolean }> {
    return this.request(`/admin/market-auctions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  public async reviewMarketAd(
    id: string,
    decision: 'approved' | 'rejected',
    note?: string,
    paymentConfirmed?: boolean
  ): Promise<{ success: boolean; ad: any }> {
    return this.request(`/admin/market-ads/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, note, paymentConfirmed }),
    });
  }

  public async adminDeleteMarketAd(id: string): Promise<{ success: boolean }> {
    return this.request(`/admin/market-ads/${id}`, { method: 'DELETE' });
  }

  /* Store (tenant) applications */
  public async getTenantApplicationConfig(): Promise<{
    registrationFeeSdg: number; currency: string; wilayas: string[]; businessTypes: string[];
  }> {
    return this.request('/tenant-applications/pricing');
  }

  public async submitTenantApplication(payload: any): Promise<{
    success: boolean; application: any; message: string;
  }> {
    return this.request('/tenant-applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getTenantApplicationStatus(code: string): Promise<{ application: any }> {
    return this.request(`/tenant-applications/status?code=${encodeURIComponent(code)}`);
  }

  public async getAdminTenantApplications(status: string = 'all'): Promise<{
    applications: any[]; counts: any; pricing: any;
  }> {
    return this.request(`/admin/tenant-applications?status=${encodeURIComponent(status)}`);
  }

  public async reviewTenantApplication(
    id: string,
    decision: 'approved' | 'rejected',
    options: { note?: string; registrationFeeSdg?: number; codeSentVia?: 'whatsapp' | 'sms' | 'email' } = {}
  ): Promise<{ success: boolean; application: any; message: string }> {
    return this.request(`/admin/tenant-applications/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, ...options }),
    });
  }

  public async markTenantApplicationSent(id: string, via: 'whatsapp' | 'sms' | 'email'): Promise<{ success: boolean }> {
    return this.request(`/admin/tenant-applications/${id}/mark-sent`, {
      method: 'POST',
      body: JSON.stringify({ via }),
    });
  }

  public async adminDeleteTenantApplication(id: string): Promise<{ success: boolean }> {
    return this.request(`/admin/tenant-applications/${id}`, { method: 'DELETE' });
  }

  /* Notifications + web push */
  /**
   * إشعارات تطبيق معيّن.
   * ------------------------------------------------------------------
   * تمرّر هوية المتجر (tenantId) لتطبيق التاجر، حتى تظهر إشعارات هذا
   * المتجر فقط — كانت إشعارات نقص مخزون كل المتاجر تظهر في متجر واحد.
   */
  public async getNotifications(app: string, ownerToken?: string, limit = 50): Promise<{
    notifications: any[]; unreadCount: number; app: string;
  }> {
    const tenantHint = app === 'merchant' && this.tenantId ? `&tenantId=${encodeURIComponent(this.tenantId)}` : '';
    return this.request(`/notifications?app=${encodeURIComponent(app)}&limit=${limit}${tenantHint}`, {
      headers: ownerToken ? { 'x-owner-token': ownerToken } : {},
    });
  }

  public async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return this.request(`/notifications/${id}/read`, { method: 'POST', body: '{}' });
  }

  public async markAllNotificationsRead(app: string, ownerToken?: string): Promise<{ success: boolean; changed: number }> {
    return this.request('/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({ app }),
      headers: ownerToken ? { 'x-owner-token': ownerToken } : {},
    });
  }

  public async deleteNotification(id: string): Promise<{ success: boolean }> {
    return this.request(`/notifications/${id}`, { method: 'DELETE' });
  }

  public async scanNotifications(): Promise<{ success: boolean; lowStock?: number; subscriptions?: number }> {
    return this.request('/notifications/scan', { method: 'POST', body: '{}' });
  }

  public async lazyScanNotifications(): Promise<{ success: boolean; skipped?: boolean }> {
    return this.request('/notifications/scan-lazy', { method: 'POST', body: '{}' });
  }

  public async getPushPublicKey(): Promise<{ enabled: boolean; publicKey?: string; message?: string }> {
    return this.request('/push/public-key');
  }

  public async subscribePush(subscription: any, app: string, ownerToken?: string): Promise<{ success: boolean }> {
    return this.request('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription, app, ownerToken }),
    });
  }

  public async unsubscribePush(endpoint: string): Promise<{ success: boolean }> {
    return this.request('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) });
  }

  public async sendTestPush(app: string, ownerToken?: string): Promise<{ success: boolean }> {
    return this.request('/push/test', {
      method: 'POST',
      body: JSON.stringify({ app }),
      headers: ownerToken ? { 'x-owner-token': ownerToken } : {},
    });
  }

  /* Market banners */
  public async getMarketBanners(): Promise<{ banners: any[] }> {
    return this.request('/market-banners');
  }

  public async getAdminMarketBanners(): Promise<{ banners: any[] }> {
    return this.request('/admin/market-banners');
  }

  public async createMarketBanner(payload: any): Promise<{ success: boolean; banner: any }> {
    return this.request('/admin/market-banners', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateMarketBanner(id: string, patch: any): Promise<{ success: boolean; banner: any }> {
    return this.request(`/admin/market-banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  }

  public async deleteMarketBanner(id: string): Promise<{ success: boolean }> {
    return this.request(`/admin/market-banners/${id}`, { method: 'DELETE' });
  }

  /** Registers a shopper tap on a banner (fire-and-forget analytics). */
  public async trackMarketBannerClick(id: string): Promise<{ success: boolean; clicks: number }> {
    return this.request(`/market-banners/${id}/click`, { method: 'POST' });
  }

  /** Registers that a banner was really shown on screen (batched per rotation). */
  public async trackMarketBannerImpressions(ids: string[]): Promise<{ success: boolean; counted: number }> {
    return this.request('/market-banners/impressions', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  /** Merchant: the banners linked to the signed-in store. */
  public async getMyMarketBanners(): Promise<{ banners: any[] }> {
    return this.request('/merchant/market-banners');
  }

  /** Merchant: report for one of *my* banners (server rejects other stores' ids). */
  public async getMyMarketBannerReport(
    id: string,
    range: { from?: string; to?: string } = {}
  ): Promise<{
    success: boolean;
    banner: any;
    from: string;
    to: string;
    days: Array<{ date: string; impressions: number; clicks: number; ctr: number }>;
    totals: { impressions: number; clicks: number; ctr: number };
  }> {
    const qs = new URLSearchParams();
    if (range.from) qs.set('from', range.from);
    if (range.to) qs.set('to', range.to);
    const q = qs.toString();
    return this.request(`/merchant/market-banners/${id}/report${q ? `?${q}` : ''}`);
  }

  /** Admin: day-by-day report for one banner (defaults to everything recorded). */
  public async getMarketBannerReport(
    id: string,
    range: { from?: string; to?: string } = {}
  ): Promise<{
    success: boolean;
    banner: any;
    from: string;
    to: string;
    days: Array<{ date: string; impressions: number; clicks: number; ctr: number }>;
    totals: { impressions: number; clicks: number; ctr: number };
  }> {
    const qs = new URLSearchParams();
    if (range.from) qs.set('from', range.from);
    if (range.to) qs.set('to', range.to);
    const q = qs.toString();
    return this.request(`/admin/market-banners/${id}/report${q ? `?${q}` : ''}`);
  }

  /** Admin: zero both counters (clicks + impressions) for one banner. */
  public async resetMarketBannerClicks(id: string): Promise<{ success: boolean; banner: any }> {
    return this.request(`/admin/market-banners/${id}/reset-clicks`, { method: 'POST' });
  }

  /** Uploads an image (compressed client-side) and returns its public URL. */
  public async uploadMedia(dataUrl: string, kind: 'image' | 'video' = 'image'): Promise<{ url: string; [k: string]: any }> {
    return this.request('/media', {
      method: 'POST',
      body: JSON.stringify({ dataUrl, kind }),
    });
  }

  public async getAdminTenants(): Promise<{ tenants: any[] }> {
    return this.request('/admin/tenants');
  }

  public async setTenantStatus(tenantId: string, status: string, reason?: string): Promise<{ success: boolean }> {
    return this.request(`/admin/tenants/${tenantId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
  }

  public async getAdminPayments(): Promise<{ payments: any[] }> {
    return this.request('/admin/payments');
  }

  public async reviewPayment(
    paymentId: string,
    decision: 'approved' | 'rejected',
    reviewNote?: string,
    reviewerName?: string
  ): Promise<{ success: boolean }> {
    return this.request(`/admin/payments/${paymentId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, reviewNote, reviewerName }),
    });
  }

  public async getAdminStats(): Promise<{ stats: any }> {
    return this.request('/admin/stats');
  }

  public async getAuditLogs(): Promise<{ logs: AuditLog[] }> {
    return this.request('/audit-logs');
  }

  /* Albandar Marketplace & Classifieds */
  public async getAlbandarListings(params?: {
    category?: string;
    city?: string;
    search?: string;
    condition?: string;
  }): Promise<{ listings: AlbandarListing[] }> {
    const q = new URLSearchParams();
    if (params?.category && params.category !== 'all' && params.category !== 'الكل') {
      q.append('category', params.category);
    }
    if (params?.city && params.city !== 'all' && params.city !== 'الكل') {
      q.append('city', params.city);
    }
    if (params?.search) {
      q.append('search', params.search);
    }
    if (params?.condition && params.condition !== 'all' && params.condition !== 'الكل') {
      q.append('condition', params.condition);
    }
    const queryString = q.toString() ? `?${q.toString()}` : '';
    return this.request(`/albandar/listings${queryString}`);
  }

  public async createAlbandarListing(payload: Partial<AlbandarListing>): Promise<{ success: boolean; listing: AlbandarListing }> {
    return this.request('/albandar/listings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getAlbandarShowrooms(): Promise<{ showrooms: AlbandarShowroom[] }> {
    return this.request('/albandar/showrooms');
  }

  public async publishProductToAlbandar(
    productId: string,
    category?: string,
    condition?: string,
    locationDetails?: string
  ): Promise<{ success: boolean; listing: AlbandarListing }> {
    return this.request('/albandar/publish-product', {
      method: 'POST',
      body: JSON.stringify({ productId, category, condition, locationDetails }),
    });
  }

  public async incrementListingView(id: string): Promise<{ success: boolean; viewsCount: number }> {
    return this.request(`/albandar/listings/${id}/view`, {
      method: 'POST',
    });
  }

  /* ==========================================
     Kitchen Display System (KDS)
     ========================================== */
  public async getKitchenTickets(branchId?: string, status?: string): Promise<{ tickets: KitchenTicket[] }> {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);
    if (status) params.append('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/kitchen/tickets${qs}`);
  }

  public async updateKitchenTicketStatus(
    id: string,
    status: KitchenStatus
  ): Promise<{ success: boolean; ticket: KitchenTicket }> {
    return this.request(`/kitchen/tickets/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  public async updateKitchenItemStatus(
    ticketId: string,
    itemId: string,
    status: KitchenStatus
  ): Promise<{ success: boolean; ticket: KitchenTicket }> {
    return this.request(`/kitchen/tickets/${ticketId}/items/${itemId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  /* ==========================================
     Recurring Expenses (المصروفات الدورية)
     ========================================== */
  public async getRecurringExpenses(branchId?: string): Promise<{ recurringExpenses: RecurringExpense[] }> {
    const qs = branchId ? `?branchId=${branchId}` : '';
    return this.request(`/recurring-expenses${qs}`);
  }

  public async createRecurringExpense(
    data: Partial<RecurringExpense>
  ): Promise<{ success: boolean; recurringExpense: RecurringExpense }> {
    return this.request('/recurring-expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateRecurringExpense(
    id: string,
    data: Partial<RecurringExpense>
  ): Promise<{ success: boolean; recurringExpense: RecurringExpense }> {
    return this.request(`/recurring-expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async deleteRecurringExpense(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/recurring-expenses/${id}`, {
      method: 'DELETE',
    });
  }

  public async postRecurringExpenseNow(id: string): Promise<{
    success: boolean;
    message: string;
    expense: Expense;
    recurringExpense: RecurringExpense;
  }> {
    return this.request(`/recurring-expenses/${id}/post-now`, {
      method: 'POST',
    });
  }

  /* ==========================================
     Promotional Offers (العروض الترويجية)
     ========================================== */
  public async getPromotions(): Promise<{ promotions: PromotionRule[] }> {
    return this.request('/promotions');
  }

  public async createPromotion(
    data: Partial<PromotionRule>
  ): Promise<{ success: boolean; promotion: PromotionRule }> {
    return this.request('/promotions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updatePromotion(
    id: string,
    data: Partial<PromotionRule>
  ): Promise<{ success: boolean; promotion: PromotionRule }> {
    return this.request(`/promotions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async deletePromotion(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/promotions/${id}`, {
      method: 'DELETE',
    });
  }

  /* ==========================================
     Inventory Alerts (نظام تنبيهات حد إعادة الطلب)
     ========================================== */
  public async getInventoryAlerts(branchId?: string): Promise<{
    alerts: InventoryAlert[];
    unreadCount: number;
    criticalCount: number;
  }> {
    const query = branchId ? `?branchId=${branchId}` : '';
    return this.request(`/inventory/alerts${query}`);
  }

  public async syncInventoryAlerts(branchId?: string): Promise<{
    success: boolean;
    alerts: InventoryAlert[];
    unreadCount: number;
    criticalCount: number;
  }> {
    return this.request('/inventory/alerts/sync', {
      method: 'POST',
      body: JSON.stringify({ branchId }),
    });
  }

  public async markInventoryAlertRead(id: string): Promise<{ success: boolean }> {
    return this.request(`/inventory/alerts/${id}/read`, {
      method: 'POST',
    });
  }

  public async dismissInventoryAlert(id: string): Promise<{ success: boolean }> {
    return this.request(`/inventory/alerts/${id}/dismiss`, {
      method: 'POST',
    });
  }

  /* ==========================================
     CSV Products & Inventory Bulk Import
     ========================================== */
  public async importProductsCsv(
    branchId: string,
    items: Array<{
      name: string;
      sku?: string;
      barcode?: string;
      category?: string;
      unit?: string;
      purchaseCost?: number;
      costCurrency?: string;
      sellingPriceSdg: number;
      minStockAlert?: number;
      initialStock?: number;
      isTaxExempt?: boolean;
      customTaxRate?: number;
    }>
  ): Promise<{
    success: boolean;
    importedCount: number;
    errors: string[];
    products: any[];
  }> {
    return this.request('/inventory/import-csv', {
      method: 'POST',
      body: JSON.stringify({ branchId, items }),
    });
  }

  /* ==========================================
     Smart Inventory Audit (تدقيق وجرد المخزون الذكي)
     ========================================== */
  public async getInventoryAudits(branchId?: string): Promise<{ success: boolean; audits: InventoryAudit[] }> {
    const q = branchId ? `?branchId=${branchId}` : '';
    return this.request(`/inventory/audits${q}`);
  }

  public async getInventoryAudit(id: string): Promise<{ success: boolean; audit: InventoryAudit }> {
    return this.request(`/inventory/audits/${id}`);
  }

  public async createInventoryAudit(payload: {
    branchId: string;
    title?: string;
    scope?: 'all' | 'category' | 'partial';
    categoryFilter?: string;
    deviceInfo?: string;
    notes?: string;
  }): Promise<{ success: boolean; audit: InventoryAudit }> {
    return this.request('/inventory/audits', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateInventoryAudit(
    id: string,
    updates: Partial<InventoryAudit>
  ): Promise<{ success: boolean; audit: InventoryAudit }> {
    return this.request(`/inventory/audits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  public async reconcileInventoryAudit(
    id: string
  ): Promise<{ success: boolean; audit: InventoryAudit; adjustedCount: number }> {
    return this.request(`/inventory/audits/${id}/reconcile`, {
      method: 'POST',
    });
  }

  public async cancelInventoryAudit(id: string): Promise<{ success: boolean }> {
    return this.request(`/inventory/audits/${id}/cancel`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();

