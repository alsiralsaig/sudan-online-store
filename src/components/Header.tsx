import React from 'react';
import {
  Store,
  ShoppingCart,
  Layers,
  BarChart3,
  ArrowLeftRight,
  ShieldAlert,
  Megaphone,
  Globe,
  Coins,
  CreditCard,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  UserCheck,
  UtensilsCrossed,
  Bell,
  AlertTriangle,
  Package,
  ExternalLink,
  Smartphone,
  CheckCircle,
  Sparkles,
  LayoutDashboard,
  Cloud,
  CloudOff,
  CloudUpload,
  Menu,
  ChevronDown,
  X,
} from 'lucide-react';
import type { InventoryAlert } from '../types/index.ts';
import { SanadLogo } from './Common/SanadLogo.tsx';
import { NotificationBell } from './Common/NotificationBell.tsx';
import { ThemeSwitcher } from './Common/ThemeSwitcher.tsx';

/**
 * وحدات تطبيق التاجر — مصدر واحد للقائمة المنسدلة.
 * الترتيب مقصود: الأكثر استخداماً في الأعلى (الكاشير ثم المخزون ثم المبيعات).
 */
const MERCHANT_NAV: { id: string; label: string }[] = [
  { id: 'welcome', label: 'الرئيسية' },
  { id: 'pos', label: 'الكاشير (نقطة البيع)' },
  { id: 'inventory', label: 'المخزون والمنتجات' },
  { id: 'sales', label: 'سجل المبيعات والفواتير' },
  { id: 'reports', label: 'التقارير والأرباح' },
  { id: 'shifts', label: 'الورديات ومطابقة الخزينة' },
  { id: 'purchases_expenses', label: 'المشتريات والمصروفات' },
  { id: 'links', label: 'الربط والموردون' },
  { id: 'inventory_audit', label: 'تدقيق المخزون (بالهاتف)' },
  { id: 'transfers', label: 'تحويلات الفروع' },
  { id: 'branches_employees', label: 'الفروع والموظفين' },
  { id: 'currencies', label: 'العملات والصرف (6 عملات)' },
  { id: 'store_orders', label: 'طلبات المتجر الإلكتروني' },
  { id: 'my_ads', label: 'إعلاناتي' },
  { id: 'kitchen', label: 'شاشة المطبخ (KDS)' },
  { id: 'subscription', label: 'الاشتراك والباقات' },
];

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  tenantName: string;
  branchName: string;
  actor: { name: string; role: string };
  isOffline: boolean;
  isSimulatingOffline: boolean;
  onToggleSimulateOffline: () => void;
  pendingOfflineCount: number;
  onSyncOffline: () => void;
  isSyncing: boolean;
  onOpenStorefront: () => void;
  onSwitchToClientApp?: () => void;
  inventoryAlerts?: InventoryAlert[];
  onDismissAlert?: (id: string) => void;
  onRefreshAlerts?: () => void;
  /** فتح نافذة «تفعيل متجر بكود الدخول» */
  onOpenActivateStore?: () => void;
  onOpenCloud?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  tenantName,
  branchName,
  isOffline,
  isSimulatingOffline,
  onToggleSimulateOffline,
  pendingOfflineCount,
  onSyncOffline,
  isSyncing,
  onOpenStorefront,
  onSwitchToClientApp,
  inventoryAlerts = [],
  onDismissAlert,
  onRefreshAlerts,
  onOpenActivateStore,
  onOpenCloud,
}) => {
  const [isNavOpen, setIsNavOpen] = React.useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = React.useState(false);

  return (
    <>
    <header className="border-b border-slate-800 bg-slate-950 sticky top-0 z-40 text-slate-100">
      {/* Top Bar Contract: 3 Zones */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6 px-4 sm:px-6 py-3.5 min-w-0 overflow-visible">
        {/* Zone 1: Sanad Logo Brand Wordmark */}
        <div className="flex items-start gap-2 min-w-0 w-full">
          <div className="shrink-0">
            <SanadLogo size="sm" variant="icon" theme="dark" onClick={() => onTabChange('welcome')} />
          </div>
          {/*
            اسم المحل هو أهم معلومة في الشريط: صار أكبر (15px على الجوال)
            وله سطران كاملان بعد إزالة صف الأدوات السفلي، مع قصّ أنيق إن طال.
          */}
          <div className="flex flex-col min-w-0 flex-1 pr-1">
            <span className="text-[15px] sm:text-base font-black text-white leading-snug line-clamp-2 break-words [overflow-wrap:anywhere]">
              {tenantName}
            </span>
            <span className="text-[11px] sm:text-xs text-slate-400 leading-snug truncate">
              {branchName}
            </span>
          </div>
        </div>

        {/* Zone 2: Primary navigation links */}
        <nav className="hidden xl:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => onTabChange('pos')}
            className={`whitespace-nowrap pb-1 transition-colors ${
              currentTab === 'pos'
                ? 'text-emerald-700 font-semibold border-b-2 border-emerald-600'
                : 'hover:text-slate-900'
            }`}
          >
            نقطة البيع (POS)
          </button>
          <button
            onClick={() => onTabChange('inventory')}
            className={`whitespace-nowrap pb-1 transition-colors ${
              currentTab === 'inventory'
                ? 'text-emerald-700 font-semibold border-b-2 border-emerald-600'
                : 'hover:text-slate-900'
            }`}
          >
            المخزون والمنتجات
          </button>
          <button
            onClick={() => onTabChange('transfers')}
            className={`whitespace-nowrap pb-1 transition-colors ${
              currentTab === 'transfers'
                ? 'text-emerald-700 font-semibold border-b-2 border-emerald-600'
                : 'hover:text-slate-900'
            }`}
          >
            تحويلات الفروع
          </button>
          <button
            onClick={() => onTabChange('shifts')}
            className={`whitespace-nowrap pb-1 transition-colors ${
              currentTab === 'shifts'
                ? 'text-emerald-700 font-semibold border-b-2 border-emerald-600'
                : 'hover:text-slate-900'
            }`}
          >
            الورديات والخزينة
          </button>
          <button
            onClick={() => onTabChange('reports')}
            className={`whitespace-nowrap pb-1 transition-colors ${
              currentTab === 'reports'
                ? 'text-emerald-700 font-semibold border-b-2 border-emerald-600'
                : 'hover:text-slate-900'
            }`}
          >
            المحاسبة والتقارير
          </button>
          {/* إدارة المنصة المركزية — لا تظهر داخل تطبيق التاجر؛ للإدارة فقط عبر ?app=super_admin */}
        </nav>

        {/* Zone 3: Primary Action & Quick Tools */}
        {/* كانت shrink-0 بلا wrap فكانت الأزرار الأخيرة (جرس الإشعارات) تخرج
            خارج الشاشة على الجوال ولا تُرى أصلاً */}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 min-w-0">
          {/* Dual-App Switcher Pill */}
          <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => onTabChange('pos')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-emerald-800 shadow-2xs flex items-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5 text-emerald-600" />
              <span>تطبيق الإدارة</span>
            </button>
            <button
              onClick={onSwitchToClientApp || onOpenStorefront}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 hover:text-emerald-700 flex items-center gap-1.5 transition-colors"
              title="الانتقال إلى تطبيق الجمهور والعملاء SanadClientApp"
            >
              <Globe className="w-3.5 h-3.5 text-amber-500" />
              <span>تطبيق الجمهور (SanadClientApp)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </button>
          </div>

          {/*
            «طلب متجر» و«تفعيل بالكود» أُزيلا من شريط التاجر:
            التاجر داخل متجره بالفعل، فلا معنى لطلب متجر جديد أو تفعيل كود
            من هنا. الطلب والتفعيل يبقيان في تطبيق الجمهور (شاشة الدخول)
            وفي شاشة «أول مرة؟ فعّل متجري» داخل بوابة الدخول.
          */}
          {/*
            صف واحد يجمع الأربعة على الجوال — بلا التفاف لبند ثانٍ:
            [متصل بالخادم] [الجرس] [الوضع] [السحابة]
            على الجوال يُقصّر زر الاتصال إلى «متصل» حتى لا يفيض الصف.
          */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-nowrap">
            {/* Offline indicator & simulation button */}
            <button
              onClick={onToggleSimulateOffline}
              title={isOffline ? 'اضغط للاتصال بالإنترنت' : 'اضغط لمحاكاة انقطاع الإنترنت وتجربة الكاشير دون اتصال'}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-black rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                isOffline
                  ? 'bg-amber-500 text-slate-950 border border-amber-300'
                  : 'bg-emerald-600 text-white border border-emerald-300'
              }`}
            >
              {isOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-slate-950" />
                  <span className="hidden sm:inline">وضع دون اتصال {isSimulatingOffline && '(محاكاة)'}</span>
                  <span className="sm:hidden">دون اتصال</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-white" />
                  <span className="hidden sm:inline">متصل بالخادم</span>
                  <span className="sm:hidden">متصل</span>
                </>
              )}
            </button>

            {/* جرس الإشعارات — ملاصق لزر الاتصال */}
            <div className="relative flex items-center shrink-0">
              <NotificationBell
                app="merchant"
                theme="dark"
                onNavigate={(tab) => onTabChange(tab as any)}
              />
            </div>

            <div className="shrink-0"><ThemeSwitcher compact /></div>

            {/* السحابة */}
            {onOpenCloud && (
              <button
                type="button"
                onClick={onOpenCloud}
                title={isOffline ? 'السحابة: دون اتصال — اضغط للتفاصيل' : 'السحابة والرفع'}
                className={`relative flex items-center gap-1.5 rounded-xl border px-2 sm:px-2.5 py-1.5 font-black text-xs transition-all shrink-0 ${
                  isOffline
                    ? 'border-amber-300 bg-amber-500 text-slate-950'
                    : pendingOfflineCount > 0
                      ? 'border-sky-300 bg-sky-500 text-slate-950'
                      : 'border-emerald-300 bg-emerald-600 text-white'
                }`}
              >
                {isOffline ? (
                  <CloudOff className="w-5 h-5" />
                ) : pendingOfflineCount > 0 || isSyncing ? (
                  <CloudUpload className={`w-5 h-5 ${isSyncing ? 'animate-pulse' : ''}`} />
                ) : (
                  <Cloud className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">السحابة</span>
                {pendingOfflineCount > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 min-w-[1.1rem] h-5 px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                    {pendingOfflineCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Pending Sync Button if any */}
          {pendingOfflineCount > 0 && (
            <button
              onClick={onSyncOffline}
              disabled={isSyncing || isOffline}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>مزامنة ({pendingOfflineCount}) فواتير</span>
            </button>
          )}

          {/* Public Storefront button */}
          <button
            onClick={onOpenStorefront}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5 text-slate-600" />
            <span>المتجر الإلكتروني</span>
          </button>

          {/* Quick Mobile Stocktaking Audit Button */}
          <button
            onClick={() => onTabChange('inventory_audit')}
            title="بدء جرد سريع بالهاتف ومقارنة المخزون الفعلي بالمسجل فورياً"
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
              currentTab === 'inventory_audit'
                ? 'bg-slate-900 text-emerald-400 border-slate-900 shadow-sm'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span>جرد بالهاتف</span>
          </button>

          {/* جرس نواقص المخزون — يظهر فقط لو فيه تنبيه، عشان ما يعمل زحمة فاضية */}
          {inventoryAlerts.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setIsAlertsOpen(!isAlertsOpen)}
              title="تنبيهات نواقص المخزون وحد إعادة الطلب"
              className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg border bg-amber-500 text-slate-950 border-amber-300 hover:bg-amber-400 transition-all"
            >
              <Bell className="w-3.5 h-3.5 text-slate-950 animate-pulse" />
              <span className="hidden lg:inline">تنبيهات المخزون</span>
              {inventoryAlerts.length > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full text-[10px] font-black bg-rose-600 text-white font-mono">
                  {inventoryAlerts.length}
                </span>
              )}
            </button>

            {/* Dropdown Panel */}
            {isAlertsOpen && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-xs">تنبيهات حد إعادة الطلب ({inventoryAlerts.length})</span>
                  </div>
                  {onRefreshAlerts && (
                    <button
                      onClick={onRefreshAlerts}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>تحديث</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {inventoryAlerts.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 space-y-2">
                      <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700">المخزون في الحدود الآمنة</p>
                      <p className="text-[11px] text-slate-400">لا توجد منتجات وصلت إلى حد إعادة الطلب حالياً</p>
                    </div>
                  ) : (
                    inventoryAlerts.map((alt) => (
                      <div
                        key={alt.id}
                        className={`p-3 text-xs transition-colors hover:bg-slate-50 flex items-start justify-between gap-3 ${
                          alt.severity === 'critical' ? 'bg-rose-50/40' : 'bg-amber-50/30'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                alt.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
                              }`}
                            />
                            <strong className="font-bold text-slate-900">{alt.productName}</strong>
                            <span className="text-[10px] text-slate-400 font-mono">({alt.sku})</span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center gap-2">
                            <span>الرصيد المتبقي: <strong className={alt.currentQuantity === 0 ? 'text-rose-600 font-bold' : 'text-amber-700 font-bold'}>{alt.currentQuantity}</strong></span>
                            <span>•</span>
                            <span>حد الطلب: <strong>{alt.reorderPoint}</strong></span>
                          </div>
                          <div className="text-[10px] text-slate-400">{alt.branchName}</div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              setIsAlertsOpen(false);
                              onTabChange('inventory');
                            }}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-md flex items-center gap-1 shadow-2xs"
                          >
                            <span>توريد</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                          {onDismissAlert && (
                            <button
                              onClick={() => onDismissAlert(alt.id)}
                              className="text-[10px] text-slate-400 hover:text-slate-600"
                            >
                              إخفاء
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">نظام التنبيهات التلقائي</span>
                  <button
                    onClick={() => {
                      setIsAlertsOpen(false);
                      onTabChange('inventory');
                    }}
                    className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <span>فتح لوحة المخزون بالكامل</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/*
        * التنقل بين الوحدات — قائمة منسدلة في أعلى اليمين.
        * ليه: الشريط الأفقي المنسحب كان الناس ما يعرفوش إنه فيه تبويبات مخفية
        * على الجوال. القائمة المنسدلة تفتح بزر واضح وتُظهر كل الوحدات مرة واحدة.
        */}
      <div className="relative flex items-center justify-between gap-2 px-3 sm:px-6 py-2 bg-slate-900 border-t border-slate-800 text-xs">
        <button
          onClick={() => setIsNavOpen((v) => !v)}
          aria-expanded={isNavOpen}
          aria-haspopup="menu"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700"
        >
          <Menu className="w-4 h-4 text-sky-400" />
          <span>{MERCHANT_NAV.find((n) => n.id === currentTab)?.label || 'القائمة'}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isNavOpen ? 'rotate-180' : ''}`} />
        </button>

        <button
          onClick={() => onTabChange('pos')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold ${
            currentTab === 'pos' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>الكاشير</span>
        </button>

      </div>

    </header>
      {isNavOpen && (
          <>
            {/* Bottom Sheet على الجوال (أسهل للوصول بالإبهام) — وقائمة منسدلة على الديسكتوب */}
            <div
              className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-[2px] sm:hidden"
              onClick={() => setIsNavOpen(false)}
            />
            <div className="fixed inset-0 z-[90] hidden sm:block" onClick={() => setIsNavOpen(false)} />

            <div
              role="menu"
              className="fixed bottom-0 inset-x-0 z-[91] sm:absolute sm:top-full sm:start-0 sm:inset-x-auto sm:bottom-auto sm:mt-1 sm:w-[min(92vw,20rem)] bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[78vh] sm:max-h-[70vh] overflow-y-auto"
            >
              <div className="sm:hidden sticky top-0 bg-slate-900 pt-2 pb-1 px-3 flex items-center justify-between border-b border-slate-800">
                <span className="w-10 h-1.5 rounded-full bg-slate-600 mx-auto absolute start-1/2 -translate-x-1/2 top-2" />
                <span className="text-[11px] font-bold text-slate-400 mt-2">الوحدات</span>
                <button
                  onClick={() => setIsNavOpen(false)}
                  className="text-slate-400 hover:text-white p-1 mt-1"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:block p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] space-y-0.5">
                {MERCHANT_NAV.map((item) => (
                  <button
                    key={item.id}
                    role="menuitem"
                    onClick={() => {
                      onTabChange(item.id);
                      setIsNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-3 sm:py-2.5 rounded-xl text-right transition-colors ${
                      currentTab === item.id
                        ? 'bg-sky-600/20 text-sky-300 font-bold border border-sky-500/40'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                    <span className="truncate flex-1">{item.label}</span>
                    {currentTab === item.id && <CheckCircle className="w-4 h-4 text-sky-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

    </>
  );
};
