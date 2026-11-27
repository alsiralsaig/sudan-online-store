import React from 'react';
import {
  ArrowRightLeft, BadgeDollarSign, BarChart3, Boxes, Building2, ChefHat,
  ClipboardList, Coins, FileText, Megaphone, PackagePlus, Receipt,
  ShoppingBag, ShoppingCart, Truck, Users, Wallet, ScanSearch, Home,
} from 'lucide-react';

type MerchantTab =
  | 'welcome' | 'pos' | 'inventory' | 'sales' | 'reports' | 'shifts'
  | 'purchases_expenses' | 'links' | 'inventory_audit' | 'transfers'
  | 'branches_employees' | 'currencies' | 'store_orders' | 'my_ads'
  | 'kitchen' | 'subscription';

interface Props {
  tenantName?: string;
  branchName?: string;
  onNavigateTab: (tab: MerchantTab) => void;
}

const services: { id: MerchantTab; title: string; hint: string; Icon: React.ElementType; primary?: boolean }[] = [
  { id: 'pos', title: 'بيع للزبون', hint: 'سجّل عملية بيع جديدة', Icon: ShoppingCart, primary: true },
  { id: 'inventory', title: 'بضاعتي ومنتجاتي', hint: 'شوف الأصناف والكميات', Icon: Boxes, primary: true },
  { id: 'sales', title: 'المبيعات والفواتير', hint: 'راجع البيع والفواتير', Icon: Receipt, primary: true },
  { id: 'purchases_expenses', title: 'المشتريات والمصروفات', hint: 'سجّل بضاعة أو مصروفًا', Icon: Truck, primary: true },
  { id: 'reports', title: 'التقارير والأرباح', hint: 'ملخص حركة متجرك', Icon: BarChart3 },
  { id: 'shifts', title: 'الورديات والخزينة', hint: 'فتح وردية ومراجعة النقدية', Icon: Wallet },
  { id: 'links', title: 'الموردون والربط', hint: 'تواصل مع الموردين', Icon: Users },
  { id: 'inventory_audit', title: 'جرد البضاعة', hint: 'طابق الكميات بالمحل', Icon: ScanSearch },
  { id: 'transfers', title: 'نقل بضاعة بين الفروع', hint: 'للمتاجر متعددة الفروع', Icon: ArrowRightLeft },
  { id: 'branches_employees', title: 'الفروع والعاملون', hint: 'إدارة فريقك وفروعك', Icon: Building2 },
  { id: 'currencies', title: 'العملات وأسعار الصرف', hint: 'إعداد العملات', Icon: Coins },
  { id: 'store_orders', title: 'طلبات المتجر الإلكتروني', hint: 'تابع طلبات الزبائن', Icon: ShoppingBag },
  { id: 'my_ads', title: 'إعلانات متجري', hint: 'إدارة إعلاناتك', Icon: Megaphone },
  { id: 'kitchen', title: 'شاشة المطبخ', hint: 'للمطاعم والمقاهي', Icon: ChefHat },
  { id: 'subscription', title: 'الاشتراك والباقات', hint: 'تفاصيل اشتراكك', Icon: BadgeDollarSign },
  { id: 'welcome', title: 'الرئيسية', hint: 'الرجوع لهذه الصفحة', Icon: Home },
];

export const MerchantHomeDashboard: React.FC<Props> = ({ tenantName, branchName, onNavigateTab }) => (
  <main dir="rtl" className="min-h-full bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
    <div className="mx-auto max-w-6xl">
      <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-emerald-800 px-5 py-6 text-white shadow-sm sm:px-8">
        <div>
          <p className="mb-1 text-sm font-semibold text-emerald-100">{tenantName || 'سَنَد للتاجر'}</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">أهلًا بك 👋</h1>
          <p className="mt-2 text-base text-emerald-50 sm:text-lg">شنو حابب تعمل اليوم؟ اختار الخدمة من المربعات تحت.</p>
        </div>
        {branchName && <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">🏬 {branchName}</div>}
      </section>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <h2 className="text-xl font-extrabold text-slate-900">خدمات متجرك</h2>
        <p className="text-sm text-slate-500">كل خدمات القائمة في مكان واحد</p>
      </div>

      <section aria-label="كل خدمات التاجر" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {services.map(({ id, title, hint, Icon, primary }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigateTab(id)}
            className={`group flex min-h-[148px] flex-col items-start justify-between rounded-3xl border p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-emerald-300 sm:min-h-[168px] sm:p-5 ${primary ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}
            aria-label={`${title}: ${hint}`}
          >
            <span className={`grid h-12 w-12 place-items-center rounded-2xl sm:h-14 sm:w-14 ${primary ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800'}`}>
              <Icon aria-hidden="true" size={27} strokeWidth={2.2} />
            </span>
            <span className="mt-4 block text-base font-extrabold leading-snug text-slate-900 sm:text-lg">{title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-500 sm:text-sm">{hint}</span>
          </button>
        ))}
      </section>
      <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">محتاج مساعدة؟ تواصل مع الدعم من زر المساعدة في أعلى الصفحة.</p>
    </div>
  </main>
);
