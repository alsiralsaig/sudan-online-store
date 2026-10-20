import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { PosView } from './components/POS/PosView.tsx';
import { ShiftsView } from './components/Shifts/ShiftsView.tsx';
import { InventoryView } from './components/Inventory/InventoryView.tsx';
import { TransfersView } from './components/Transfers/TransfersView.tsx';
import { SalesView } from './components/Sales/SalesView.tsx';
import { PurchasesExpensesView } from './components/PurchasesExpenses/PurchasesExpensesView.tsx';
import { ReportsView } from './components/Reports/ReportsView.tsx';
import { CurrenciesView } from './components/Currencies/CurrenciesView.tsx';
import { BranchesEmployeesView } from './components/BranchesEmployees/BranchesEmployeesView.tsx';
import { StorefrontView } from './components/Storefront/StorefrontView.tsx';
import { SubscriptionView } from './components/Subscription/SubscriptionView.tsx';
import { CentralAdminView } from './components/Admin/CentralAdminView.tsx';
import { KitchenDisplayView } from './components/Kitchen/KitchenDisplayView.tsx';
import { InventoryAuditModal } from './components/Inventory/InventoryAuditModal.tsx';
import { SanadClientApp } from './SanadClientApp/SanadClientApp.tsx';
import { SanadAIAssistant } from './components/Common/SanadAIAssistant.tsx';
import { SanadAppModeBar, type PlatformAppMode } from './components/Common/SanadAppModeBar.tsx';
import { AdminWelcomeBanner } from './components/Admin/AdminWelcomeBanner.tsx';

import type {
  Tenant,
  Branch,
  Employee,
  Product,
  BranchTransfer,
  CashierShift,
  Sale,
  CurrencyConfig,
  InventoryAlert,
} from './types/index.ts';
import { api } from './lib/api.ts';
import {
  Users,
  Globe,
  Sparkles,
  Building,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  X,
} from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('pos');
  // 3-App Architecture: 'client' (Shopper/Public), 'merchant' (Store POS), 'super_admin' (Central SaaS Admin)
  const [appMode, setAppMode] = useState<PlatformAppMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const appParam = params.get('app');
      // Shared content from another app always lands in the shopper catalog
      if (params.get('share-target') === '1' || params.has('shared')) return 'client';
      if (appParam === 'super_admin' || appParam === 'saas') return 'super_admin';
      if (appParam === 'client' || window.location.hash === '#client') return 'client';
      if (appParam === 'merchant' || appParam === 'pos' || appParam === 'admin') return 'merchant';

      const saved = localStorage.getItem('sanad_app_mode') as PlatformAppMode;
      if (saved && (saved === 'client' || saved === 'merchant' || saved === 'super_admin')) {
        return saved;
      }
    }
    return 'client';
  });

  const switchAppMode = (mode: PlatformAppMode) => {
    setAppMode(mode);
    localStorage.setItem('sanad_app_mode', mode);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `?app=${mode}`);
    }
  };

  // Application Data States
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<BranchTransfer[]>([]);
  const [shifts, setShifts] = useState<CashierShift[]>([]);
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);

  // Actor / Role state for testing and permissions
  const [actor, setActor] = useState<{ id: string; name: string; role: string }>(api.getActor());

  // Offline / Network States
  const [isOffline, setIsOffline] = useState<boolean>(api.isOffline());
  const [isSimulatingOffline, setIsSimulatingOffline] = useState<boolean>(api.isSimulatingOffline());
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'warning' | 'info'; text: string } | null>(null);

  // Available tenants for demo switching
  const [tenantsList, setTenantsList] = useState<any[]>([]);

  // Shift Modal Open Trigger
  const [isShiftModalRequested, setIsShiftModalRequested] = useState(false);

  // Load primary data
  const loadPrimaryData = async () => {
    try {
      const [tListRes, curTenantRes, brRes, empRes, prodRes, shiftsRes, currRes, salesRes, trfRes] =
        await Promise.allSettled([
          api.getTenantsList(),
          api.getCurrentTenant(),
          api.getBranches(),
          api.getEmployees(),
          api.getProducts(),
          api.getShifts(),
          api.getCurrencies(),
          api.getSales(),
          api.getTransfers(),
        ]);

      if (tListRes.status === 'fulfilled') setTenantsList(tListRes.value.tenants);
      if (curTenantRes.status === 'fulfilled') setTenant(curTenantRes.value.tenant);

      if (brRes.status === 'fulfilled') {
        setBranches(brRes.value.branches);
        const savedBranchId = api.getBranchId();
        const activeBr = brRes.value.branches.find((b) => b.id === savedBranchId) || brRes.value.branches[0] || null;
        setCurrentBranch(activeBr);
      }

      if (empRes.status === 'fulfilled') setEmployees(empRes.value.employees);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.products);
      if (shiftsRes.status === 'fulfilled') {
        setShifts(shiftsRes.value.shifts);
        const openS = shiftsRes.value.shifts.find((s) => s.status === 'open');
        setActiveShift(openS || null);
      }
      if (currRes.status === 'fulfilled') setCurrencies(currRes.value.currencies);
      if (salesRes.status === 'fulfilled') setSales(salesRes.value.sales);
      if (trfRes.status === 'fulfilled') setTransfers(trfRes.value.transfers);

      // Check pending offline queue count
      const offlineCount = await api.getPendingOfflineCount();
      setPendingOfflineCount(offlineCount);
    } catch (err) {
      console.warn('Initialization error:', err);
    }
  };

  useEffect(() => {
    loadPrimaryData();

    // Listen to network status changes
    const unsub = api.onNetworkStatusChange((offline) => {
      setIsOffline(offline);
      setIsSimulatingOffline(api.isSimulatingOffline());

      if (!offline) {
        // Attempt background auto-sync when online returns
        handleSyncOffline();
      }
    });

    return () => unsub();
  }, []);

  // Background Sync Trigger
  const handleSyncOffline = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const res = await api.syncPendingOfflineSales();
      if (res.syncedCount > 0) {
        setNotification({
          type: 'success',
          text: `تمت بنجاح مزامنة (${res.syncedCount}) فواتير بيع من الدرج إلى الخادم السحابي!`,
        });
        loadPrimaryData();
      }
      const count = await api.getPendingOfflineCount();
      setPendingOfflineCount(count);
    } catch (err: any) {
      setNotification({
        type: 'warning',
        text: 'تعذر إتمام مزامنة بعض الفواتير حالياً، سيتم إعادة المحاولة تلقائياً.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Triggered by the Service Worker on Background Sync / Periodic Sync
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onSwMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SANAD_SYNC_REQUEST') {
        handleSyncOffline();
      }
    };

    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing]);

  // Toggle offline simulation
  const handleToggleSimulateOffline = () => {
    const isSim = api.toggleSimulateOffline();
    setIsOffline(isSim);
    setIsSimulatingOffline(isSim);

    if (isSim) {
      setNotification({
        type: 'warning',
        text: 'تم تفعيل وضع محاكاة انقطاع الإنترنت! يمكنك الآن تجربة البيع دون اتصال وسيتم تخزين الفواتير محلياً في IndexedDB.',
      });
    } else {
      setNotification({
        type: 'info',
        text: 'تمت استعادة الاتصال بالإنترنت! جاري ترحيل الفواتير المعلقة...',
      });
      handleSyncOffline();
    }
  };

  // On sale completed in POS
  const handleSaleCompleted = async (sale: Sale, isOfflineSale?: boolean) => {
    if (isOfflineSale) {
      const count = await api.getPendingOfflineCount();
      setPendingOfflineCount(count);
      setNotification({
        type: 'warning',
        text: `تم حفظ الفاتورة ${sale.invoiceNumber} محلياً دون اتصال. ستُرفع تلقائياً عند الاتصال.`,
      });
    } else {
      setNotification({
        type: 'success',
        text: `تم إصدار وحفظ الفاتورة ${sale.invoiceNumber} بنجاح.`,
      });
    }
    loadPrimaryData();
  };

  // Role Switcher for easy testing
  const handleActorSwitch = (newRole: string) => {
    let newActor = { id: 'emp_owner_rowad', name: 'أحمد الطيب الرواد', role: 'owner' };
    if (newRole === 'cashier') {
      newActor = { id: 'emp_cashier_kht', name: 'محمد عبد الله (كاشير)', role: 'cashier' };
    } else if (newRole === 'branch_manager') {
      newActor = { id: 'emp_mgr_kht', name: 'عثمان عبد الرحيم (مدير الفرع)', role: 'branch_manager' };
    } else if (newRole === 'accountant') {
      newActor = { id: 'emp_accountant_rowad', name: 'سارة مصطفى (المحاسب)', role: 'accountant' };
    } else if (newRole === 'super_admin') {
      newActor = { id: 'saas_admin', name: 'مدير المنصة المركزي', role: 'super_admin' };
    }
    setActor(newActor);
    api.setActor(newActor);
  };

  // Branch Switcher
  const handleBranchSwitch = (branchId: string) => {
    const found = branches.find((b) => b.id === branchId);
    if (found) {
      setCurrentBranch(found);
      api.setBranchId(found.id);
      loadPrimaryData();
    }
  };

  // Tenant Switcher
  const handleTenantSwitch = (tenantId: string) => {
    api.setTenantId(tenantId);
    loadPrimaryData();
  };

  if (appMode === 'client') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900">
        {/* The app-switcher bar is a platform-admin tool: shoppers and
            merchants must never see links into the other apps. */}
        <SanadClientApp />
        <SanadAIAssistant
          currentMode="client"
          tenantName={tenant?.tradeName || tenant?.name}
          branchName={currentBranch?.name}
        />
      </div>
    );
  }

  if (appMode === 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased select-none" dir="rtl">
        <SanadAppModeBar
          currentApp="super_admin"
          onSwitchApp={(app) => switchAppMode(app)}
          tenantName={tenant?.tradeName || tenant?.name}
          branchName={currentBranch?.name}
        />
        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-right">
                <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-bold font-mono">
                  SaaS Platform Super Admin
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  رابط المنصة الإداري المركزي (سند SaaS)
                </h1>
                <p className="text-xs text-slate-400">
                  إدارة كافة التجار والمتاجر المسجلة في السودان، نسب العمولات، الاشتراكات الشهرية والسنوية، والتحكم في إعلانات السوق.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => switchAppMode('merchant')}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  فتح لوحة التاجر ونقطة البيع (POS)
                </button>
                <button
                  onClick={() => switchAppMode('client')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700"
                >
                  فتح تطبيق المتسوقين
                </button>
              </div>
            </div>

            <CentralAdminView />
          </div>
        </div>
        <SanadAIAssistant
          currentMode="admin"
          onSwitchMode={(m) => switchAppMode(m as any)}
          tenantName={tenant?.tradeName || tenant?.name}
          branchName={currentBranch?.name}
        />
      </div>
    );
  }

  // Merchant Mode (Store POS & Management)
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none antialiased">
      {/* No app-switcher bar here: merchants open their own app, and the
          platform console is reachable through its URL only. */}

      {/* Top Notification Toast */}
      {notification && (
        <div
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-4 ${
            notification.type === 'success'
              ? 'bg-emerald-800 text-white border-emerald-700'
              : notification.type === 'warning'
              ? 'bg-amber-800 text-white border-amber-700'
              : 'bg-slate-900 text-white border-slate-800'
          }`}
        >
          {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-300 shrink-0" />}
          {notification.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />}
          {notification.type === 'info' && <Clock className="w-4 h-4 text-blue-300 shrink-0" />}
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="text-white/70 hover:text-white p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        tenantName={tenant?.tradeName || tenant?.name || 'منصة سند'}
        branchName={currentBranch?.name || 'الفرع الرئيسي'}
        actor={actor}
        isOffline={isOffline}
        isSimulatingOffline={isSimulatingOffline}
        onToggleSimulateOffline={handleToggleSimulateOffline}
        pendingOfflineCount={pendingOfflineCount}
        onSyncOffline={handleSyncOffline}
        isSyncing={isSyncing}
        onOpenStorefront={() => setCurrentTab('store_orders')}
        onSwitchToClientApp={() => switchAppMode('client')}
      />

      {/* Quick Testing Context Bar (Tenant, Branch & Role Switcher for Review) */}
      <div className="bg-slate-800 text-slate-300 text-[11px] px-6 py-1.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700">
        <div className="flex flex-wrap items-center gap-4">
          {/* Tenant Switcher */}
          <div className="flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-white">المنشأة المستأجرة:</span>
            <select
              value={tenant?.id || ''}
              onChange={(e) => handleTenantSwitch(e.target.value)}
              className="bg-slate-900 text-white border border-slate-600 rounded px-2 py-0.5 text-[11px] focus:outline-none"
            >
              {tenantsList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.city})
                </option>
              ))}
            </select>
          </div>

          {/* Branch Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-white">فرع العمل:</span>
            <select
              value={currentBranch?.id || ''}
              onChange={(e) => handleBranchSwitch(e.target.value)}
              className="bg-slate-900 text-white border border-slate-600 rounded px-2 py-0.5 text-[11px] focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-white">دور المستخدم (RBAC):</span>
            <select
              value={actor.role}
              onChange={(e) => handleActorSwitch(e.target.value)}
              className="bg-slate-900 text-white border border-slate-600 rounded px-2 py-0.5 text-[11px] focus:outline-none font-semibold"
            >
              <option value="owner">المالك (أحمد الطيب - صلاحيات كاملة)</option>
              <option value="branch_manager">مدير فرع (عثمان عبد الرحيم)</option>
              <option value="cashier">كاشير نقاط البيع (محمد عبد الله)</option>
              <option value="accountant">محاسب مالي (سارة مصطفى)</option>
              <option value="super_admin">مدير المنصة المركزي (SaaS Super Admin)</option>
            </select>
          </div>
        </div>

        {/* Client App Quick Switcher Button */}
          <button
            onClick={() => switchAppMode('client')}
            className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-all shadow-xs"
            title="فتح تطبيق المتسوقين والجمهور SanadClientApp"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>عرض تطبيق الجمهور (SanadClientApp)</span>
          </button>

        {/* Offline indicator quick status */}
        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span>العملة الافتراضية: SDG (جنيه سوداني)</span>
          {pendingOfflineCount > 0 && (
            <span className="text-amber-400 font-bold">
              • فواتير أوفلاين معلقة: {pendingOfflineCount}
            </span>
          )}
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-auto">
        {/* Sanad POS Promotional Welcome Banner for Admin */}
        {(currentTab === 'welcome' || currentTab === 'pos') && (
          <div className="px-6 pt-5">
            <AdminWelcomeBanner
              tenantName={tenant?.tradeName || tenant?.name}
              branchName={currentBranch?.name}
              onNavigateTab={(t) => setCurrentTab(t)}
              onSwitchToClientApp={() => switchAppMode('client')}
              totalProductsCount={products.length}
              activeShiftsCount={shifts.filter((s) => s.status === 'open').length || 1}
              pendingOrdersCount={3}
            />
          </div>
        )}

        {currentTab === 'welcome' && (
          <div className="px-6 pb-6 space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
              <h2 className="text-xl font-black text-slate-900">نظرة عامة على النظام وروابط سريعة</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <button
                  onClick={() => setCurrentTab('pos')}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-500 text-right space-y-1 transition-all"
                >
                  <strong className="text-sm font-bold text-slate-900 block">نقطة البيع (POS)</strong>
                  <p className="text-slate-500">إصدار الفواتير الفورية، الدفع ببنكك، العملات المشفرة، والباركود</p>
                </button>
                <button
                  onClick={() => setCurrentTab('inventory_audit')}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-500 text-right space-y-1 transition-all"
                >
                  <strong className="text-sm font-bold text-slate-900 block">تدقيق المخزون بالهاتف</strong>
                  <p className="text-slate-500">جرد سريع عبر الكاميرا ومطابقة الأرصدة الفعلية مع النظام فورياً</p>
                </button>
                <button
                  onClick={() => switchAppMode('client')}
                  className="p-4 rounded-2xl bg-amber-50 border border-amber-200 hover:border-amber-400 text-right space-y-1 transition-all"
                >
                  <strong className="text-sm font-bold text-slate-950 block">تطبيق الجمهور (SanadClientApp)</strong>
                  <p className="text-amber-900">تصفح الكتالوج، الطلبات المسبقة، والسلة وتتبع الشحنات</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'pos' && (
          <PosView
            products={products}
            currentBranch={currentBranch}
            activeShift={activeShift}
            currencies={currencies}
            onRefreshShift={loadPrimaryData}
            onOpenShiftModal={() => setCurrentTab('shifts')}
            onOpenKitchen={() => setCurrentTab('kitchen')}
            isOffline={isOffline}
            onSaleCompleted={handleSaleCompleted}
          />
        )}

        {currentTab === 'kitchen' && (
          <KitchenDisplayView
            branches={branches}
            currentBranch={currentBranch}
          />
        )}

        {currentTab === 'shifts' && (
          <ShiftsView
            shifts={shifts}
            currentBranch={currentBranch}
            activeShift={activeShift}
            onRefresh={loadPrimaryData}
            actor={actor}
          />
        )}

        {currentTab === 'inventory' && (
          <InventoryView
            products={products}
            branches={branches}
            currentBranch={currentBranch}
            onRefresh={loadPrimaryData}
          />
        )}

        {currentTab === 'inventory_audit' && (
          <div className="space-y-4">
            <InventoryView
              products={products}
              branches={branches}
              currentBranch={currentBranch}
              onRefresh={loadPrimaryData}
            />
            <InventoryAuditModal
              isOpen={true}
              onClose={() => setCurrentTab('inventory')}
              branch={currentBranch}
              branches={branches}
              products={products}
              onAuditCompleted={loadPrimaryData}
            />
          </div>
        )}

        {currentTab === 'transfers' && (
          <TransfersView
            transfers={transfers}
            branches={branches}
            products={products}
            onRefresh={loadPrimaryData}
          />
        )}

        {currentTab === 'sales' && (
          <SalesView
            sales={sales}
            branches={branches}
            currentBranch={currentBranch}
            onRefresh={loadPrimaryData}
          />
        )}

        {currentTab === 'purchases_expenses' && (
          <PurchasesExpensesView
            branches={branches}
            currentBranch={currentBranch}
            currencies={currencies}
            onRefresh={loadPrimaryData}
          />
        )}

        {currentTab === 'reports' && (
          <ReportsView branches={branches} currentBranch={currentBranch} />
        )}

        {currentTab === 'branches_employees' && (
          <BranchesEmployeesView
            branches={branches}
            employees={employees}
            onRefresh={loadPrimaryData}
          />
        )}

        {currentTab === 'currencies' && (
          <CurrenciesView currencies={currencies} onRefresh={loadPrimaryData} />
        )}

        {currentTab === 'store_orders' && (
          <StorefrontView
            tenant={tenant}
            branches={branches}
            products={products}
            onRefresh={loadPrimaryData}
          />
        )}

        {currentTab === 'subscription' && (
          <SubscriptionView tenant={tenant} onRefresh={loadPrimaryData} />
        )}

        {currentTab === 'admin' && <CentralAdminView />}
      </main>

      {/* Floating Sudanese AI Assistant for Admin Mode */}
      <SanadAIAssistant
        currentMode="admin"
        onNavigateTab={(tab) => setCurrentTab(tab)}
        onSwitchMode={(m) => switchAppMode(m as any)}
        tenantName={tenant?.tradeName || tenant?.name}
        branchName={currentBranch?.name}
      />
    </div>
  );
}
