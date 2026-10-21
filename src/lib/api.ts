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

class ApiClient {
  private tenantId: string = 'tenant_alrowad';
  private currentActor = {
    id: 'emp_owner_rowad',
    name: 'أحمد الطيب الرواد',
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
      'x-actor-id': this.currentActor.id,
      'x-actor-name': encodeURIComponent(this.currentActor.name || ''),
      'x-actor-role': this.currentActor.role,
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (this.isOffline() && !endpoint.startsWith('/storefront/')) {
      throw new Error('OFFLINE_MODE');
    }

    const res = await fetch(`/api${endpoint}`, {
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
        if (data.error) msg = data.error;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    return res.json();
  }

  /* Tenant endpoints */
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
  public async refreshParallelRates(): Promise<{ success: boolean; updated?: number; snapshot: any }> {
    return this.request('/admin/currency/refresh', { method: 'POST' });
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
    if (!res.ok) throw new Error('المتجر غير متاح');
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
  public async getNotifications(app: string, ownerToken?: string, limit = 50): Promise<{
    notifications: any[]; unreadCount: number; app: string;
  }> {
    return this.request(`/notifications?app=${encodeURIComponent(app)}&limit=${limit}`, {
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

