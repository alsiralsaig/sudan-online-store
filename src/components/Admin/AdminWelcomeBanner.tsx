import React from 'react';
import {
  ShoppingBag,
  Smartphone,
  Store,
  ArrowUpRight,
  ShieldCheck,
  Globe,
  BellRing,
  PackageCheck,
  TrendingUp,
} from 'lucide-react';

interface AdminWelcomeBannerProps {
  tenantName?: string;
  branchName?: string;
  onNavigateTab: (tab: string) => void;
  onSwitchToClientApp: () => void;
  totalProductsCount?: number;
  activeShiftsCount?: number;
  pendingOrdersCount?: number;
}

/**
 * لوحة التاجر الرئيسية — كروت واضحة على الجوال بدون قصّ حروف أو شريط أسود فوق الكاشير.
 * البانر ما عاد يظهر في شاشة POS.
 */
export const AdminWelcomeBanner: React.FC<AdminWelcomeBannerProps> = ({
  tenantName = 'متجرك',
  branchName = 'الفرع الرئيسي',
  onNavigateTab,
  onSwitchToClientApp,
  totalProductsCount = 0,
  activeShiftsCount = 0,
  pendingOrdersCount = 0,
}) => {
  const kpis = [
    {
      label: 'المنتجات النشطة',
      value: String(totalProductsCount),
      hint: 'صنف',
      icon: Store,
      tone: 'text-emerald-300 bg-emerald-500/15',
    },
    {
      label: 'طلبات المتجر',
      value: String(pendingOrdersCount),
      hint: 'قيد التنفيذ',
      icon: PackageCheck,
      tone: 'text-amber-300 bg-amber-500/15',
    },
    {
      label: 'الورديات المفتوحة',
      value: String(activeShiftsCount),
      hint: 'وردية',
      icon: TrendingUp,
      tone: 'text-teal-300 bg-teal-500/15',
    },
    {
      label: 'المزامنة',
      value: 'سحابي',
      hint: 'ومحمي',
      icon: ShieldCheck,
      tone: 'text-indigo-300 bg-indigo-500/15',
    },
  ];

  return (
    <div className="rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-xl overflow-hidden">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-emerald-400">لوحة التاجر</p>
          <h1 className="text-lg sm:text-xl font-black leading-tight truncate">{tenantName}</h1>
          <p className="text-xs text-slate-400 truncate">{branchName}</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div
                key={k.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 min-w-0 flex items-start gap-2.5"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.tone}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400 leading-tight">{k.label}</div>
                  <div className="text-base font-black leading-tight truncate">
                    {k.value} <span className="text-[11px] font-bold text-slate-400">{k.hint}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1">
          <button
            onClick={() => onNavigateTab('pos')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            نقطة البيع والكاشير (POS)
          </button>
          <button
            onClick={() => onNavigateTab('inventory_audit')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-emerald-200 font-bold text-sm rounded-2xl border border-emerald-500/20"
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            جرد المخزون بالهاتف
          </button>
          <button
            onClick={() => onNavigateTab('store_orders')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm rounded-2xl border border-white/10"
          >
            <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
            طلبات المتجر والطلبات المسبقة
          </button>
          <button
            onClick={onSwitchToClientApp}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-2xl"
          >
            <Globe className="w-4 h-4 shrink-0" />
            فتح تطبيق الجمهور
            <ArrowUpRight className="w-4 h-4 opacity-70 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
