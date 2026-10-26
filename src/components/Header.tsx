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
  PlusCircle,
  KeyRound,
} from 'lucide-react';
import type { InventoryAlert } from '../types/index.ts';
import { SanadLogo } from './Common/SanadLogo.tsx';
import { TenantApplicationModal } from './Common/TenantApplicationModal.tsx';
import { NotificationBell } from './Common/NotificationBell.tsx';

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
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  tenantName,
  branchName,
  actor,
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
}) => {
  const [isAlertsOpen, setIsAlertsOpen] = React.useState(false);
  const [isTenantModalOpen, setIsTenantModalOpen] = React.useState(false);
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'المالك';
      case 'branch_manager':
        return 'مدير فرع';
      case 'cashier':
        return 'كاشير';
      case 'inventory_officer':
        return 'مسؤول مخزون';
      case 'accountant':
        return 'محاسب';
      case 'super_admin':
        return 'مدير المنصة';
      default:
        return 'موظف';
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-40">
      {/* Top Bar Contract: 3 Zones */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6 px-4 sm:px-6 py-3.5 min-w-0">
        {/* Zone 1: Sanad Logo Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <SanadLogo size="sm" variant="full" onClick={() => onTabChange('welcome')} />
          {/* اسم المتجر ظاهر على الجوال أيضاً — كان مخفياً تحت sm فلا يرى
              التاجر أي أثر لاسم متغيّره بعد التفعيل أو التبديل */}
          <div className="flex flex-col border-r border-slate-200 pr-3 mr-1 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold text-slate-800 whitespace-nowrap truncate max-w-[38vw] sm:max-w-none">
              {tenantName}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-500 whitespace-nowrap truncate">
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
          <button
            onClick={() => onTabChange('admin')}
            className={`whitespace-nowrap pb-1 transition-colors ${
              currentTab === 'admin'
                ? 'text-emerald-700 font-semibold border-b-2 border-emerald-600'
                : 'hover:text-slate-900'
            }`}
          >
            إدارة المنصة المركزية
          </button>
        </nav>

        {/* Zone 3: Primary Action & Quick Tools */}
        {/* كانت shrink-0 بلا wrap فكانت الأزرار الأخيرة (جرس الإشعارات) تخرج
            خارج الشاشة على الجوال ولا تُرى أصلاً */}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 min-w-0">
          {/* Platform notifications — أول عنصر في الشريط فيظل مرئياً على الجوال */}
          <div className="relative flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 pl-1 pr-1 py-0.5">
            <NotificationBell
              app="merchant"
              onNavigate={(tab) => onTabChange(tab as any)}
            />
            <span className="hidden sm:inline pl-2 pr-1 text-[11px] font-bold text-rose-800">
              الإشعارات
            </span>
          </div>

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

          {/* Store application — same entry point as the shopper app */}
          <button
            onClick={() => setIsTenantModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 transition-all whitespace-nowrap"
            title="طلب فتح متجر جديد على منصة سند"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-700" />
            <span>طلب متجر</span>
          </button>

          {/* تفعيل متجر موافَق عليه بكود الدخول — زر ظاهر في الشريط الأبيض */}
          {onOpenActivateStore && (
            <button
              onClick={onOpenActivateStore}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 transition-all whitespace-nowrap"
              title="عندك كود دخول من الإدارة؟ فعّل متجرك هنا"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>تفعيل بالكود</span>
            </button>
          )}
          {/* Offline indicator & simulation button */}
          <button
            onClick={onToggleSimulateOffline}
            title={isOffline ? 'اضغط للاتصال بالإنترنت' : 'اضغط لمحاكاة انقطاع الإنترنت وتجربة الكاشير دون اتصال'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              isOffline
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            {isOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-700" />
                <span>وضع دون اتصال {isSimulatingOffline && '(محاكاة)'}</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>متصل بالخادم</span>
              </>
            )}
          </button>

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

          {/* Inventory Reorder Point Alerts Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setIsAlertsOpen(!isAlertsOpen)}
              title="تنبيهات نواقص المخزون وحد إعادة الطلب"
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                inventoryAlerts.length > 0
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Bell className={`w-3.5 h-3.5 ${inventoryAlerts.length > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-500'}`} />
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

          {/* Current Actor Tag */}
          <div className="flex items-center gap-2 pl-2 border-r border-slate-200 pr-2">
            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
              {actor.name.slice(0, 1)}
            </div>
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800 leading-tight">{actor.name}</span>
              <span className="text-[11px] text-slate-500">{getRoleLabel(actor.role)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary workspace navigation bar for all modules */}
      <div className="flex items-center gap-2 px-6 py-2 bg-slate-50 border-t border-slate-100 overflow-x-auto text-xs">
        <button
          onClick={() => onTabChange('welcome')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'welcome' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>الرئيسية والبانر الترويجي</span>
        </button>
        <button
          onClick={() => onTabChange('pos')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'pos' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>الكاشير (POS)</span>
        </button>
        <button
          onClick={() => onTabChange('kitchen')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'kitchen' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
          <span>شاشة المطبخ (KDS)</span>
        </button>
        <button
          onClick={() => onTabChange('inventory')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'inventory' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>المخزون والمنتجات</span>
        </button>
        <button
          onClick={() => onTabChange('inventory_audit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'inventory_audit'
              ? 'bg-slate-900 text-emerald-400 shadow-sm font-bold ring-1 ring-emerald-500/30'
              : 'text-slate-700 hover:text-slate-900 bg-emerald-50/70 border border-emerald-200/50 font-semibold'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
          <span>تدقيق المخزون (بالهاتف)</span>
        </button>
        <button
          onClick={() => onTabChange('transfers')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'transfers' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>تحويلات الفروع</span>
        </button>
        <button
          onClick={() => onTabChange('shifts')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'shifts' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>الورديات ومطابقة الخزينة</span>
        </button>
        <button
          onClick={() => onTabChange('sales')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'sales' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>سجل المبيعات والفواتير</span>
        </button>
        <button
          onClick={() => onTabChange('purchases_expenses')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'purchases_expenses' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>المشتريات والمصروفات</span>
        </button>
        <button
          onClick={() => onTabChange('reports')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'reports' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>التقارير والأرباح</span>
        </button>
        <button
          onClick={() => onTabChange('branches_employees')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'branches_employees' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>الفروع والموظفين</span>
        </button>
        <button
          onClick={() => onTabChange('currencies')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'currencies' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>العملات والصرف (6 عملات)</span>
        </button>
        <button
          onClick={() => onTabChange('store_orders')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'store_orders' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>طلبات المتجر الإلكتروني</span>
        </button>
        <button
          onClick={() => onTabChange('subscription')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'subscription' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>الاشتراك والباقات</span>
        </button>
        <button
          onClick={() => onTabChange('my_ads')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'my_ads'
              ? 'bg-white text-emerald-700 shadow-sm font-semibold'
              : 'text-slate-700 bg-emerald-50/70 border border-emerald-200/50 font-semibold hover:text-emerald-900'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5 text-emerald-600" />
          <span>إعلاناتي</span>
        </button>
        <button
          onClick={() => onTabChange('admin')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
            currentTab === 'admin' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>إدارة المنصة المركزية</span>
        </button>
      </div>

      <TenantApplicationModal
        isOpen={isTenantModalOpen}
        onClose={() => setIsTenantModalOpen(false)}
        source="merchant"
      />
    </header>
  );
};
