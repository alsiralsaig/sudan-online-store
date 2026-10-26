import React, { useState } from 'react';
import {
  Sparkles,
  ShoppingBag,
  Smartphone,
  Store,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  Globe,
  BellRing,
  PackageCheck,
  TrendingUp,
} from 'lucide-react';
import { SanadLogo } from '../Common/SanadLogo.tsx';

interface AdminWelcomeBannerProps {
  tenantName?: string;
  branchName?: string;
  onNavigateTab: (tab: string) => void;
  onSwitchToClientApp: () => void;
  totalProductsCount?: number;
  activeShiftsCount?: number;
  pendingOrdersCount?: number;
}

export const AdminWelcomeBanner: React.FC<AdminWelcomeBannerProps> = ({
  tenantName = 'مؤسسة الرواد التجارية',
  branchName = 'فرع الخرطوم الرئيسي',
  onNavigateTab,
  onSwitchToClientApp,
  totalProductsCount = 48,
  activeShiftsCount = 1,
  pendingOrdersCount = 3,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    return localStorage.getItem('sanad_admin_banner_minimized') === 'true';
  });

  const toggleMinimize = () => {
    const next = !isMinimized;
    setIsMinimized(next);
    localStorage.setItem('sanad_admin_banner_minimized', String(next));
  };

  const bannerImg = '/assets/images/sanad_pos_hero_1792173270140.jpg';

  if (isMinimized) {
    return (
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-md border border-emerald-800/40 flex items-center justify-between mb-5 animate-in fade-in">
        <div className="flex items-center gap-3">
          <SanadLogo size="xs" theme="dark" variant="compact" />
          <span className="text-xs text-slate-300 hidden sm:inline">|</span>
          <span className="text-xs font-semibold text-emerald-300">
            مرحباً بك في لوحة الإدارة ونقاط البيع · {tenantName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onSwitchToClientApp}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-xs"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>معاينة تطبيق الجمهور</span>
          </button>
          <button
            onClick={toggleMinimize}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            title="توسيع البانر الترويجي"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white border border-emerald-500/20 shadow-2xl mb-6 group">
      {/* Background Hero Banner Image with refined overlays */}
      <div className="absolute inset-0">
        <img
          src={bannerImg}
          alt="سند لنقاط البيع السحابية"
          className="w-full h-full object-cover object-center opacity-30 transform group-hover:scale-102 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-emerald-950/60" />
      </div>

      {/* Decorative ambient lights */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 p-6 md:p-8 flex flex-col justify-between">
        {/* Top Header Row within Banner */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <SanadLogo size="lg" theme="dark" variant="full" />
            <div className="flex flex-col border-r border-white/15 pr-3 mr-1 lg:pr-4 lg:mr-2">
              <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                منظومة الإدارة المركزية
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {tenantName} · {branchName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>الإصدار السحابي 2026</span>
            </span>

            <button
              onClick={toggleMinimize}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="تصغير البانر الترويجي"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hero Headline & Description */}
        <div className="max-w-3xl mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-lg border border-amber-400/20 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>نظام سند المتكامل: تطبيق الإدارة والتحكم + تطبيق الجمهور للعملاء</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
            لوحة الإدارة السحابية والتحكم الشامل بنقاط البيع والفروع
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed font-normal">
            إدارة فورية لكافة المبيعات النقدية وبنكك والعملات المشفرة، ربط الفروع، جرد المخزون الذكي بالهاتف، وتلقي وتجهيز طلبات العملاء المسبقة القادمة من تطبيق الجمهور <strong className="text-emerald-400 font-bold">(SanadClientApp)</strong>.
          </p>
        </div>

        {/* Quick Administrative KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">المنتجات النشطة</div>
              <div className="text-lg font-black text-white font-mono">{totalProductsCount} منتجاً</div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">طلبات المتجر الواردة</div>
              <div className="text-lg font-black text-amber-400 font-mono">{pendingOrdersCount} قيد التنفيذ</div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">الورديات المفتوحة</div>
              <div className="text-lg font-black text-teal-300 font-mono">{activeShiftsCount} وردية</div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">المزامنة والحماية</div>
              <div className="text-lg font-black text-emerald-400">سحابي ومحمي</div>
            </div>
          </div>
        </div>

        {/* Quick Launchpad Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
          <button
            onClick={() => onNavigateTab('pos')}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 active:scale-98"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>نقطة البيع والكاشير (POS)</span>
          </button>

          <button
            onClick={() => onNavigateTab('inventory_audit')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-white font-bold text-sm rounded-xl border border-emerald-500/30 transition-all active:scale-98"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>جرد وتدقيق المخزون بالهاتف</span>
          </button>

          <button
            onClick={() => onNavigateTab('store_orders')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-sm rounded-xl border border-white/10 transition-all active:scale-98"
          >
            <BellRing className="w-4 h-4 text-amber-400" />
            <span>إدارة طلبات المتجر والطلبات المسبقة</span>
          </button>

          <div className="mr-auto">
            <button
              onClick={onSwitchToClientApp}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-98"
            >
              <Globe className="w-4 h-4" />
              <span>فتح تطبيق الجمهور (SanadClientApp)</span>
              <ArrowUpRight className="w-4 h-4 opacity-75" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
