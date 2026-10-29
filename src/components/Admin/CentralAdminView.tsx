import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Building,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Activity,
  History,
  AlertTriangle,
  Lock,
  Unlock,
  DollarSign,
  X,
  Sparkles,
  Megaphone,
  Store,
  Image as ImageIcon,
  Tag,
  Menu,
  ChevronDown,
} from 'lucide-react';
import type { AuditLog, Product } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { ThermalReceiptSettingsView } from './ThermalReceiptSettingsView.tsx';
import { PromotionsSettingsView } from './PromotionsSettingsView.tsx';
import { MarketAdsAdminView } from './MarketAdsAdminView.tsx';
import { TenantApplicationsAdminView } from './TenantApplicationsAdminView.tsx';
import { MarketBannersAdminView } from './MarketBannersAdminView.tsx';
import { NotificationBell } from '../Common/NotificationBell.tsx';

export const CentralAdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'merchants' | 'payments_queue' | 'audit_trail' | 'receipt_settings' | 'promotions' | 'market_ads' | 'tenant_requests' | 'banners'>('merchants');
  const [navOpen, setNavOpen] = useState(false);


  // Notification taps can open a specific admin tab via ?tab=
  useEffect(() => {
    const applyTab = (tab: string) => {
      const allowed = ['merchants', 'payments_queue', 'audit_trail', 'receipt_settings', 'promotions', 'market_ads', 'tenant_requests', 'banners'];
      if (allowed.includes(tab)) setActiveTab(tab as any);
    };
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (fromUrl) applyTab(fromUrl);
    const handler = (e: any) => applyTab(e?.detail || '');
    window.addEventListener('sanad:open-tab', handler);
    return () => window.removeEventListener('sanad:open-tab', handler);
  }, []);
  const [tenants, setTenants] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Review Payment Modal
  const [reviewingPayment, setReviewingPayment] = useState<any | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAll = async () => {
    try {
      const tRes = await api.getAdminTenants();
      setTenants(tRes.tenants);

      const pRes = await api.getAdminPayments();
      setPayments(pRes.payments);

      const sRes = await api.getAdminStats();
      setStats(sRes.stats);

      const aRes = await api.getAuditLogs();
      setAuditLogs(aRes.logs);

      const prodRes = await api.getProducts();
      setProducts(prodRes.products);
    } catch (err) {
      console.warn('Failed loading admin data:', err);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const [codeFor, setCodeFor] = useState<{ tenantId: string; name: string; code: string } | null>(null);

  const [repairResult, setRepairResult] = useState<{ name: string; code: string }[] | null>(null);
  const handleRepairCodes = async () => {
    if (!confirm('إصدار كود دخول لكل متجر نشط لا يملك كوداً؟\nالمتاجر التي لديها كود لن تتأثر.')) return;
    try {
      const res = await api.repairMerchantCodes();
      setRepairResult(res.repaired.map((r) => ({ name: r.name, code: r.code })));
      if (!res.count) alert(res.message);
      loadAll();
    } catch (e: any) {
      alert('تعذّر الإصلاح: ' + (e.message || ''));
    }
  };

  const handleIssueCode = async (tenantId: string, name: string) => {
    if (!confirm(`توليد رمز جديد للمتجر «${name}»؟\nالرمز القديم سيُلغى فوراً. انسخ الجديد وأرسله للتاجر عبر واتساب آمن.`)) return;
    try {
      const res = await api.issueMerchantCode(tenantId);
      setCodeFor({ tenantId, name, code: res.code });
      loadAll();
    } catch (e: any) {
      alert('فشل توليد الرمز: ' + (e.message || ''));
    }
  };

  // Suspend / Activate Tenant
  const handleToggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const reason = prompt(
      nextStatus === 'suspended'
        ? 'يرجى إدخال سبب إيقاف وتجميد حساب المنشأة:'
        : 'يرجى إدخال سبب إعادة تفعيل حساب المنشأة:'
    );
    if (reason === null) return;

    try {
      await api.setTenantStatus(tenantId, nextStatus, reason || undefined);
      loadAll();
    } catch (err) {
      alert('فشل تعديل حالة المنشأة');
    }
  };

  // Submit Payment Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingPayment) return;
    setIsSubmitting(true);

    try {
      await api.reviewPayment(reviewingPayment.id, reviewDecision, reviewNote, 'المدير التنفيذي للمنصة');
      setReviewingPayment(null);
      setReviewNote('');
      loadAll();
    } catch (err) {
      alert('فشل حفظ قرار المراجعة');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* أقسام المنصة في مكان واحد — تُستخدم في القائمة المنسدلة */
  const adminNavItems: { id: string; label: string; count: number | null }[] = [
    { id: 'merchants', label: 'سجل المنشآت والتجار', count: tenants.length },
    { id: 'payments_queue', label: 'طابور تدقيق السداد', count: payments.filter((p) => p.status === 'pending_review').length },
    { id: 'audit_trail', label: 'سجل التدقيق الأمني الشامل', count: null },
    { id: 'receipt_settings', label: 'إعدادات الفاتورة الحرارية', count: null },
    { id: 'promotions', label: 'نظام العروض الترويجية', count: null },
    { id: 'market_ads', label: 'إعلانات السوق', count: null },
    { id: 'tenant_requests', label: 'طلبات المتاجر', count: null },
    { id: 'banners', label: 'بانرات السوق', count: null },
  ];

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6 overflow-x-hidden">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900">لوحة تحكم إدارة منصة سند المركزية (SaaS Super Admin)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة حسابات التجار والمشتركين في السودان، تدقيق إشعارات بنكك وتفعيل الاشتراكات، والرقابة على العمليات
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
          <NotificationBell
            app="admin"
            onNavigate={(tab) => setActiveTab(tab as any)}
          />

        {/*
          * التنقل بين أقسام المنصة — قائمة منسدلة أعلى اليمين.
          * الشريط الأفقي المنسحب كان يُخفي أقساماً على الجوال والناس ما تعرف
          * إنه فيه المزيد. القائمة تُظهر كل الأقسام مرة واحدة مع عدّاداتها.
          */}
        <div className="relative w-full sm:w-auto">
          <button
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            aria-haspopup="menu"
            className="w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold border border-slate-700"
          >
            <span className="flex items-center gap-2">
              <Menu className="w-4 h-4 text-sky-400" />
              {adminNavItems.find((i) => i.id === activeTab)?.label || 'أقسام المنصة'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${navOpen ? 'rotate-180' : ''}`} />
          </button>

          {navOpen && (
            <>
              <div
                className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-[2px] sm:hidden"
                onClick={() => setNavOpen(false)}
              />
              <div className="fixed inset-0 z-[90] hidden sm:block" onClick={() => setNavOpen(false)} />

              <div
                role="menu"
                className="fixed bottom-0 inset-x-0 z-[91] sm:absolute sm:top-full sm:start-0 sm:inset-x-auto sm:bottom-auto sm:mt-1 sm:w-[min(92vw,22rem)] bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[78vh] sm:max-h-[70vh] overflow-y-auto"
              >
                <div className="sm:hidden sticky top-0 bg-white pt-2 pb-1 px-3 flex items-center justify-between border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 mt-2">أقسام المنصة</span>
                  <button onClick={() => setNavOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 mt-1" aria-label="إغلاق">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] space-y-0.5">
                  {adminNavItems.map((item) => (
                    <button
                      key={item.id}
                      role="menuitem"
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setNavOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-3 sm:py-2.5 rounded-xl text-right text-xs transition-colors ${
                        activeTab === item.id
                          ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate flex-1">{item.label}</span>
                      {item.count !== null && (
                        <span className="shrink-0 bg-slate-100 text-slate-700 rounded-lg px-2 py-0.5 font-mono font-bold">
                          {item.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {/* متاجر بلا كود دخول — كانت تبقى عالقة بلا وصول للتطبيق */}
      {tenants.some((t) => !t.hasMerchantCode) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-bold text-amber-900">
            ⚠️ {tenants.filter((t) => !t.hasMerchantCode).length} متجر بلا كود دخول — أصحابها لا يستطيعون الدخول للتطبيق.
          </p>
          <button
            onClick={handleRepairCodes}
            className="rounded-xl bg-amber-600 px-3 py-2 text-[11px] font-black text-white"
          >
            إصدار أكواد الدخول الآن
          </button>
        </div>
      )}

      {repairResult && repairResult.length > 0 && (
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-black text-emerald-900">✅ تم إصدار الأكواد — انسخها الآن (لن تظهر مرة أخرى)</p>
            <button onClick={() => setRepairResult(null)} className="text-[11px] font-bold text-emerald-800 underline">إغلاق</button>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {repairResult.map((r) => (
              <div key={r.code} className="flex items-center gap-2 bg-white rounded-xl border border-emerald-200 p-2">
                <span className="text-[11px] font-bold text-slate-700 truncate flex-1">{r.name}</span>
                <code dir="ltr" className="font-mono text-[10.5px] text-slate-900 break-all">{r.code}</code>
                <button
                  onClick={() => navigator.clipboard?.writeText(r.code).catch(() => {})}
                  className="shrink-0 rounded-lg bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white"
                >
                  نسخ
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform KPI Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block mb-1">المنشآت المسجلة</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono">{stats.totalTenants}</span>
              <span className="text-xs text-emerald-600 font-semibold">({stats.activeTenants} نشطة)</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block mb-1">إجمالي الفروع المربوطة</span>
            <span className="text-2xl font-bold text-slate-900 font-mono">{stats.totalBranches}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block mb-1">إجمالي مبيعات التجار عبر المنصة</span>
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">
              {stats.totalSalesRevenue.toLocaleString()} ج.س
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500 block mb-1">إيرادات اشتراكات SaaS المحصلة</span>
            <span className="text-xl font-bold text-emerald-700 font-mono tabular-nums">
              {stats.subscriptionRevenue.toLocaleString()} ج.س
            </span>
          </div>
        </div>
      )}

      {/* Content depending on active tab */}
      {activeTab === 'merchants' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">اسم المنشأة والاسم التجاري</th>
                  <th className="py-3 px-4">المدينة والهاتف</th>
                  <th className="py-3 px-4">الفروع / الموظفين</th>
                  <th className="py-3 px-4">الباقة المشترك بها</th>
                  <th className="py-3 px-4">صلاحية الاشتراك</th>
                  <th className="py-3 px-4">حالة الحساب</th>
                  <th className="py-3 px-4 text-center">إجراءات الإدارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{t.name}</div>
                      <div className="text-[11px] text-slate-500">{t.tradeName}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      <div>{t.city}</div>
                      <div className="text-[11px] text-slate-400">{t.phone}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800">
                      {t.branchCount} فروع · {t.employeeCount} موظف
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{t.planName}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(t.subscriptionExpiresAt).toLocaleDateString('ar-SD')}
                    </td>
                    <td className="py-3 px-4">
                      {t.status === 'active' ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>نشط ومفعل</span>
                        </span>
                      ) : (
                        <span className="text-rose-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>موقوف / مجمد</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        <button
                          onClick={() => handleIssueCode(t.id, t.name)}
                          className="px-3 py-1 rounded text-[11px] font-black bg-slate-900 text-white hover:bg-black whitespace-nowrap"
                        >
                          {t.hasMerchantCode ? 'إعادة إصدار رمز المتجر' : 'إصدار رمز المتجر'}
                        </button>
                        <span className={`text-[10px] ${t.hasMerchantCode ? 'text-emerald-600' : 'text-amber-600'}`}>{t.hasMerchantCode ? 'له رمز' : 'بلا رمز — أنشئه الآن'}</span>
                        <button
                          onClick={() => handleToggleTenantStatus(t.id, t.status)}
                          className={`px-3 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                            t.status === 'active'
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {t.status === 'active' ? 'تجميد الحساب' : 'إعادة التفعيل'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payments_queue' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">
              طابور التحقق من إشعارات تحويلات بنكك وسداد الاشتراكات
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">تاريخ الإرسال</th>
                  <th className="py-3 px-4">اسم المنشأة</th>
                  <th className="py-3 px-4">الباقة المطلوبة</th>
                  <th className="py-3 px-4">المبلغ</th>
                  <th className="py-3 px-4">رقم إشعار بنكك</th>
                  <th className="py-3 px-4">الحالة الحالية</th>
                  <th className="py-3 px-4 text-center">قرار المراجعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(p.submittedAt).toLocaleString('ar-SD')}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{p.tenantName}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{p.planName}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {p.amountSdg.toLocaleString()} ج.س
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-red-700">{p.paymentRef}</td>
                    <td className="py-3 px-4 font-semibold">
                      {p.status === 'pending_review' && (
                        <span className="text-amber-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>بانتظار المراجعة</span>
                        </span>
                      )}
                      {p.status === 'approved' && (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>معتمد</span>
                        </span>
                      )}
                      {p.status === 'rejected' && (
                        <span className="text-rose-700 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>مرفوض</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.status === 'pending_review' ? (
                        <button
                          onClick={() => {
                            setReviewingPayment(p);
                            setReviewDecision('approved');
                            setReviewNote('تمت مطابقة الإيداع بحساب بنكك بنجاح');
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold whitespace-nowrap"
                        >
                          فحص واعتماد
                        </button>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">مكتمل</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audit_trail' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">المستخدم والفاعل</th>
                  <th className="py-3 px-4">نوع الإجراء (Action)</th>
                  <th className="py-3 px-4">الكيان (Entity)</th>
                  <th className="py-3 px-4">التفاصيل الكاملة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(log.timestamp).toLocaleString('ar-SD')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{log.actorName}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-800">{log.action}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{log.entity}</td>
                    <td className="py-3 px-4 text-slate-700">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Thermal Receipt Customization */}
      {activeTab === 'receipt_settings' && <ThermalReceiptSettingsView />}

      {/* Tab 5: Promotional Offers Management */}
      {activeTab === 'promotions' && <PromotionsSettingsView products={products} />}
      {activeTab === 'market_ads' && <MarketAdsAdminView />}
      {activeTab === 'tenant_requests' && <TenantApplicationsAdminView />}
      {activeTab === 'banners' && <MarketBannersAdminView />}

      {/* =========================================================================
          REVIEW PAYMENT MODAL
          ========================================================================= */}
      {reviewingPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitReview}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">مراجعة وتدقيق إشعار سداد الاشتراك</h3>
                <p className="text-[11px] text-slate-400">{reviewingPayment.tenantName}</p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingPayment(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">الباقة:</span>
                  <span className="font-bold text-slate-900">{reviewingPayment.planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">المبلغ:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {reviewingPayment.amountSdg.toLocaleString()} ج.س
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">رقم مرجع بنكك:</span>
                  <span className="font-mono font-bold text-red-700">{reviewingPayment.paymentRef}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">القرار الإداري:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewDecision('approved')}
                    className={`py-2 px-3 rounded-lg border font-bold flex items-center justify-center gap-1.5 ${
                      reviewDecision === 'approved'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>اعتماد وتمديد 30 يوماً</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewDecision('rejected')}
                    className={`py-2 px-3 rounded-lg border font-bold flex items-center justify-center gap-1.5 ${
                      reviewDecision === 'rejected'
                        ? 'border-rose-600 bg-rose-50 text-rose-800'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>رفض التحويل</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ملاحظات التدقيق:</label>
                <textarea
                  required
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="سبب الاعتماد أو الرفض..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewingPayment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                حفظ القرار
              </button>
            </div>
          </form>
        </div>
      )}
      {codeFor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">رمز المتجر — {codeFor.name}</h3>
                <p className="text-[11px] text-slate-400">يُعرض مرة واحدة فقط. انسخه وأرسله عبر واتساب آمن.</p>
              </div>
              <button onClick={() => setCodeFor(null)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-[11px] text-slate-600">القديم (إن وجد) أُلغي. الجديد:</p>
              <div className="rounded-xl bg-slate-950 text-emerald-300 font-mono text-sm tracking-widest px-4 py-4 text-center select-all border border-slate-800">{codeFor.code}</div>
              <div className="flex gap-2">
                <button onClick={async()=>{ await navigator.clipboard.writeText(codeFor.code); alert('تم النسخ'); }} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black">نسخ الرمز</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(codeFor.code)}`} target="_blank" rel="noreferrer" className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-black text-center">إرسال واتساب</a>
              </div>
              <button onClick={()=>setCodeFor(null)} className="w-full py-2 text-xs text-slate-600">إغلاق — لن يظهر مرة أخرى</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
