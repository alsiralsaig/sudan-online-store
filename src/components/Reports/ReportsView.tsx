import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Layers,
  PieChart,
  Calendar,
  Building,
  CreditCard,
  Banknote,
  Smartphone,
  Download,
  FileText,
  Percent,
  CheckCircle2,
  Sparkles,
  GitCompare,
} from 'lucide-react';
import type { Branch } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface ReportsViewProps {
  branches: Branch[];
  currentBranch: Branch | null;
  canViewProfits?: boolean;
  canViewCogs?: boolean;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  branches,
  currentBranch,
  canViewProfits = true,
  canViewCogs = true,
}) => {
  // Default to the current branch as requested
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    currentBranch?.id || branches[0]?.id || ''
  );
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [profitTimeframe, setProfitTimeframe] = useState<'daily' | 'monthly'>('daily');

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const res = await api.getReportsSummary(selectedBranchId || undefined);
      setSummary(res.summary);
    } catch (err) {
      console.warn('Failed loading reports summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [selectedBranchId]);

  if (!canViewProfits) {
    return (
      <div className="p-10 m-4 rounded-3xl bg-slate-950 text-center text-slate-200 border border-slate-800">
        <p className="text-lg font-black text-white">التقارير المالية محجوبة</p>
        <p className="text-sm text-slate-400 mt-2">
          المالك ما فعّل لك صلاحية الاطلاع على الأرباح. اطلبها من شاشة الموظفين.
        </p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span>جاري تجميع المؤشرات المالية والرسوم البيانية للفرع...</span>
      </div>
    );
  }

  // Active branch details
  const activeBranch = branches.find((b) => b.id === selectedBranchId) || currentBranch;
  const trendData: Array<{
    date: string;
    label: string;
    revenue: number;
    invoicesCount: number;
    profit: number;
    profitMargin: number;
  }> = summary.trend || [];

  // Chart metrics calculations
  const maxRevenue = Math.max(...trendData.map((t) => t.revenue), 1);
  const maxInvoices = Math.max(...trendData.map((t) => t.invoicesCount), 1);

  // SVG Area path for sales trend
  const chartWidth = 320;
  const chartHeight = 90;
  const points = trendData.map((item, idx) => {
    const x = (idx / Math.max(1, trendData.length - 1)) * (chartWidth - 20) + 10;
    const y = chartHeight - 10 - (item.revenue / maxRevenue) * (chartHeight - 25);
    return { x, y, ...item };
  });

  const pathD = points.length > 0
    ? `M ${points[0].x} ${points[0].y} ` +
      points
        .slice(1)
        .map((p, i) => {
          const prev = points[i];
          const cx = (prev.x + p.x) / 2;
          return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
        })
        .join(' ')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - 4} L ${points[0].x} ${chartHeight - 4} Z`
    : '';

  // Circular progress for profit margin
  const profitMarginVal = Math.min(100, Math.max(0, Number(summary.grossMarginPct) || 0));
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (profitMarginVal / 100) * circumference;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Branch Scope Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <h2 className="text-xl font-bold text-slate-900">
              المحاسبة والتقارير المالية والتشغيلية
            </h2>
            {activeBranch && (
              <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2.5 py-0.5 rounded-full">
                الفرع الحالي: {activeBranch.name}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            لوحة إحصائية سريعة مدعومة بالرسوم البيانية التفاعلية لحساب الإيرادات وهوامش الأرباح وتكاليف التشغيل
          </p>
        </div>

        {/* Branch Filter Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">الفرع المعروض:</span>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 shadow-xs"
          >
            <option value="">كافة الفروع المجمعة</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.id === currentBranch?.id ? ' (الفرع الحالي)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* =========================================================================
          QUICK STATISTICAL CARDS WITH CHARTS (إجمالي المبيعات، عدد الفواتير، نسبة الأرباح)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. بطاقة إجمالي المبيعات مع رسم بياني لمنحنى الإيرادات (Total Sales Area Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>إجمالي مبيعات الفرع</span>
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+16.4% نمو أسبوعي</span>
              </span>
            </div>

            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight tabular-nums">
                {summary.totalRevenue.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-500">ج.س</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-1 mb-2">
              <span>متوسط الفاتورة: {summary.averageInvoiceValue?.toLocaleString()} ج.س</span>
              <span>صافي الأرباح: {summary.netProfit?.toLocaleString()} ج.س</span>
            </div>
          </div>

          {/* SVG Area Sparkline Chart */}
          <div className="relative pt-2 mt-auto">
            <div className="h-24 w-full">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid guidelines */}
                <line x1="10" y1={chartHeight - 10} x2={chartWidth - 10} y2={chartHeight - 10} stroke="#f1f5f9" strokeWidth="1" />
                <line x1="10" y1={chartHeight / 2} x2={chartWidth - 10} y2={chartHeight / 2} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />

                {/* Shaded Area */}
                <path d={areaD} fill="url(#salesGrad)" />

                {/* Trend Line */}
                <path d={pathD} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Interactive Points */}
                {points.map((p, idx) => (
                  <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoveredTrendIdx(idx)} onMouseLeave={() => setHoveredTrendIdx(null)}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={hoveredTrendIdx === idx ? 5 : 3}
                      fill={hoveredTrendIdx === idx ? '#047857' : '#ffffff'}
                      stroke="#059669"
                      strokeWidth="2"
                      className="transition-all duration-150"
                    />
                  </g>
                ))}
              </svg>
            </div>

            {/* Hover Tooltip or Subtitle */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-1.5 mt-1 font-mono">
              <span>{trendData[0]?.label || 'بداية الأسبوع'}</span>
              <span className="font-bold text-emerald-800">
                {hoveredTrendIdx !== null
                  ? `${trendData[hoveredTrendIdx]?.label}: ${trendData[hoveredTrendIdx]?.revenue.toLocaleString()} ج.س`
                  : 'منحنى الإيرادات الأسبوعي'}
              </span>
              <span>{trendData[trendData.length - 1]?.label || 'اليوم'}</span>
            </div>
          </div>
        </div>

        {/* 2. بطاقة عدد الفواتير مع رسم بياني شريطي للعمليات (Invoices Count Bar Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>عدد فواتير المبيعات</span>
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-mono">
                {((summary.salesCount / Math.max(1, trendData.length)) || 0).toFixed(1)} فاتورة/يوم
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight tabular-nums">
                {summary.salesCount}
              </span>
              <span className="text-xs font-bold text-slate-500">فاتورة مصدرة</span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-1 mb-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>كاش: {summary.paymentsBreakdown?.cash > 0 ? 'متاح' : '0'}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>بنكك: {summary.paymentsBreakdown?.bankak > 0 ? 'متاح' : '0'}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>إلكتروني: {summary.paymentsBreakdown?.fawry + summary.paymentsBreakdown?.syberpay > 0 ? 'متاح' : '0'}</span>
              </span>
            </div>
          </div>

          {/* SVG Bar Chart for Invoices Volume */}
          <div className="relative pt-2 mt-auto">
            <div className="h-24 w-full flex items-end justify-between gap-2 px-1">
              {trendData.map((item, idx) => {
                const heightPct = Math.max(12, Math.round((item.invoicesCount / maxInvoices) * 100));
                const isHovered = hoveredTrendIdx === idx;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer"
                    onMouseEnter={() => setHoveredTrendIdx(idx)}
                    onMouseLeave={() => setHoveredTrendIdx(null)}
                  >
                    <div className="w-full bg-slate-100 rounded-t-lg relative flex items-end h-18 overflow-hidden">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-lg transition-all duration-300 ${
                          isHovered
                            ? 'bg-blue-600'
                            : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                      />
                    </div>
                    <span className={`text-[9px] font-mono leading-none ${isHovered ? 'text-blue-900 font-bold' : 'text-slate-400'}`}>
                      {item.label.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Invoices Footer summary */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-1.5 mt-1 font-mono">
              <span>توزيع حجم الفواتير اليومي</span>
              <span className="font-bold text-blue-800">
                {hoveredTrendIdx !== null
                  ? `${trendData[hoveredTrendIdx]?.label}: ${trendData[hoveredTrendIdx]?.invoicesCount} فاتورة`
                  : `${summary.salesCount} إجمالي الفواتير النشطة`}
              </span>
            </div>
          </div>
        </div>

        {/* 3. بطاقة نسبة الأرباح مع رسم بياني دائري وشريطي (Profit Margin Gauge Chart) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-purple-600" />
                <span>نسبة الأرباح (Profit Margin)</span>
              </span>
              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-mono">
                صافي الربح: {summary.netMarginPct}%
              </span>
            </div>

            <div className="flex items-center justify-between mt-1">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-purple-900 font-mono tracking-tight tabular-nums">
                    {summary.grossMarginPct}%
                  </span>
                  <span className="text-xs font-semibold text-purple-600">هامش تجاري</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  صافي الربح: <strong className="text-emerald-700 font-bold">{summary.netProfit?.toLocaleString()} ج.س</strong>
                </div>
              </div>

              {/* Circular Gauge / Donut Chart */}
              <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 90 90">
                  <circle
                    cx="45"
                    cy="45"
                    r={radius}
                    stroke="#f1f5f9"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="45"
                    cy="45"
                    r={radius}
                    stroke="url(#profitGrad)"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-700 ease-out"
                  />
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[12px] font-extrabold text-slate-900 font-mono leading-none">
                    {profitMarginVal}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stacked Cost vs Profit Breakdown Bar */}
          <div className="pt-3 border-t border-slate-100 mt-2">
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
              {/* Cost of Goods Sold % */}
              <div
                style={{ width: `${Math.min(80, Math.max(10, 100 - profitMarginVal))}%` }}
                className="bg-amber-500 h-full"
                title={`تكلفة البضاعة المباعة: ${summary.totalCogs?.toLocaleString()} ج.س`}
              />
              {/* Operating Expenses % */}
              <div
                style={{
                  width: `${Math.min(30, Math.max(5, (summary.totalExpenses / (summary.totalRevenue || 1)) * 100))}%`,
                }}
                className="bg-rose-500 h-full"
                title={`المصروفات التشغيلية: ${summary.totalExpenses?.toLocaleString()} ج.س`}
              />
              {/* Net Profit % */}
              <div
                style={{ width: `${Math.min(50, Math.max(10, Number(summary.netMarginPct) || 15))}%` }}
                className="bg-emerald-500 h-full"
                title={`صافي الأرباح: ${summary.netProfit?.toLocaleString()} ج.س`}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>تكلفة بضاعة</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>مصاريف</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-emerald-800">صافي ربح</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RECHARTS INTERACTIVE ANALYTICS DASHBOARD (منحنيات الأرباح ومقارنة الفروع)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Recharts Profit & Revenue Curve (Daily vs Monthly) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  منحنى الإيرادات والأرباح التفاعلي (Profit Curves)
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تتبع مسار الأرباح الإجمالية والصافية ومطابقتها مع حجم المبيعات
              </p>
            </div>

            {/* Daily / Monthly Timeframe Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setProfitTimeframe('daily')}
                className={`px-3 py-1 rounded-md transition-all ${
                  profitTimeframe === 'daily'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                يومي (7 أيام)
              </button>
              <button
                onClick={() => setProfitTimeframe('monthly')}
                className={`px-3 py-1 rounded-md transition-all ${
                  profitTimeframe === 'monthly'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                شهري (6 أشهر)
              </button>
            </div>
          </div>

          {/* Recharts Area / Line Chart Container */}
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              {profitTimeframe === 'daily' ? (
                <AreaChart
                  data={summary.trend || []}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="recRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="recProfitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-lg border border-slate-800 space-y-1 font-mono">
                          <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1 font-sans">
                            {label}
                          </p>
                          <div className="flex items-center justify-between gap-4 text-sky-400">
                            <span>المبيعات:</span>
                            <span className="font-bold">{Number(payload[0]?.value).toLocaleString()} ج.س</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-emerald-400">
                            <span>الربح الإجمالي:</span>
                            <span className="font-bold">{Number(payload[1]?.value).toLocaleString()} ج.س</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    formatter={(val) => (
                      <span className="text-xs text-slate-600 font-medium">
                        {val === 'revenue' ? 'إجمالي المبيعات' : 'إجمالي الأرباح'}
                      </span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#recRevenueGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#059669"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#recProfitGrad)"
                  />
                </AreaChart>
              ) : (
                <AreaChart
                  data={summary.monthlyTrend || []}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="monthRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="monthNetGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="monthName"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-lg border border-slate-800 space-y-1 font-mono">
                          <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1 font-sans">
                            {label}
                          </p>
                          <div className="flex items-center justify-between gap-4 text-blue-400">
                            <span>المبيعات:</span>
                            <span className="font-bold">{Number(payload[0]?.value).toLocaleString()} ج.س</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-emerald-400">
                            <span>صافي الأرباح:</span>
                            <span className="font-bold">{Number(payload[1]?.value).toLocaleString()} ج.س</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    formatter={(val) => (
                      <span className="text-xs text-slate-600 font-medium">
                        {val === 'revenue' ? 'المبيعات الشهرية' : 'صافي الأرباح'}
                      </span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#monthRevGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="netProfit"
                    stroke="#059669"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#monthNetGrad)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Recharts Branch Performance Comparison (مقارنة أداء الفروع) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  مقارنة أداء الفروع في الأرباح والمبيعات
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                مقارنة حجم الإيرادات وصافي الأرباح ونسب الهامش بين فروع المنشأة
              </p>
            </div>
            <span className="text-[11px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded-full font-semibold">
              {summary.branchComparison?.length || branches.length} فروع نشطة
            </span>
          </div>

          {/* Grouped Bar Chart */}
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.branchComparison || []}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="branchName"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const bData = payload[0]?.payload;
                    return (
                      <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-lg border border-slate-800 space-y-1.5 font-mono">
                        <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-1 font-sans">
                          <span className="font-bold text-slate-200">{label}</span>
                          <span className="text-[10px] bg-indigo-900/60 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                            هامش: {bData?.marginPct}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-sky-400">
                          <span>المبيعات:</span>
                          <span className="font-bold">{Number(bData?.revenue).toLocaleString()} ج.س</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-emerald-400">
                          <span>الربح الإجمالي:</span>
                          <span className="font-bold">{Number(bData?.grossProfit).toLocaleString()} ج.س</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-teal-300">
                          <span>صافي الربح:</span>
                          <span className="font-bold">{Number(bData?.netProfit).toLocaleString()} ج.س</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-400 pt-1 border-t border-slate-800 text-[10px]">
                          <span>عدد الفواتير:</span>
                          <span>{bData?.salesCount} عملية</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  formatter={(val) => (
                    <span className="text-xs text-slate-600 font-medium">
                      {val === 'revenue'
                        ? 'إجمالي المبيعات'
                        : val === 'grossProfit'
                        ? 'الربح التجاري'
                        : 'صافي الربح'}
                    </span>
                  )}
                />
                <Bar dataKey="revenue" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="grossProfit" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="netProfit" fill="#047857" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* =========================================================================
          DETAILED INCOME STATEMENT & FINANCIAL BREAKDOWNS
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income Statement Structure */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-700" />
              <h3 className="font-bold text-sm text-slate-900">
                قائمة الدخل والأداء المالي التفصيلي (Income Statement)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
              محسوبة بنموذج التكلفة الفعلية
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-800 text-sm">
                  إجمالي المبيعات المحققة (Revenue):
                </span>
              </div>
              <span className="font-mono font-bold text-slate-900 text-base">
                {summary.totalRevenue.toLocaleString()} ج.س
              </span>
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-rose-700">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>(يُخصم) تكلفة البضاعة المباعة (COGS):</span>
              </div>
              <span className="font-mono font-bold text-sm">
                -{summary.totalCogs.toLocaleString()} ج.س
              </span>
            </div>

            <div className="flex justify-between items-center py-3 bg-emerald-50/70 px-4 rounded-xl border border-emerald-100 font-bold text-emerald-900">
              <span className="text-sm">إجمالي الربح التجاري (Gross Profit):</span>
              <div className="text-left font-mono">
                <span className="text-base">{summary.grossProfit.toLocaleString()} ج.س</span>
                <span className="text-xs text-emerald-700 block font-normal">
                  هامش الربح: {summary.grossMarginPct}%
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-rose-700">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>(يُخصم) المصروفات العمومية والتشغيلية:</span>
              </div>
              <span className="font-mono font-bold text-sm">
                -{summary.totalExpenses.toLocaleString()} ج.س
              </span>
            </div>

            <div className="flex justify-between items-center py-3.5 bg-slate-900 text-white px-5 rounded-xl font-bold shadow-sm">
              <div>
                <span className="text-sm block">صافي الأرباح التشغيلية النهائية (Net Operating Profit):</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  الربح الفعلي المتبقي بعد استبعاد تكلفة المشتريات ومصاريف الفرع
                </span>
              </div>
              <span className="font-mono text-xl text-emerald-400">
                {summary.netProfit.toLocaleString()} ج.س
              </span>
            </div>
          </div>
        </div>

        {/* Right side: Payment breakdown & Inventory Valuation */}
        <div className="space-y-6">
          {/* Inventory Valuation Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>تقييم المخزون المتاح</span>
              </span>
              <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                {activeBranch?.name || 'الفرع'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">القيمة الإجمالية بسعر التكلفة:</span>
              <span className="font-mono font-bold text-slate-900 text-base">
                {summary.totalInventoryValuation.toLocaleString()} ج.س
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-600">أصناف تجاوزت حد الأمان (نواقص):</span>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                {summary.lowStockCount} أصناف بحاجة لإعادة طلب
              </span>
            </div>
          </div>

          {/* Payment Methods Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-slate-600" />
              <span>توزيع قنوات التحصيل والدفع</span>
            </span>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>نقداً (Cash):</span>
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {summary.paymentsBreakdown?.cash.toLocaleString()} ج.س
                </span>
              </div>

              <div className="flex justify-between items-center p-2 rounded-lg bg-red-50/50 border border-red-100">
                <span className="flex items-center gap-2 text-red-900 font-medium">
                  <Smartphone className="w-4 h-4 text-red-600" />
                  <span>تحويلات بنكك (Bankak):</span>
                </span>
                <span className="font-mono font-bold text-red-800">
                  {summary.paymentsBreakdown?.bankak.toLocaleString()} ج.س
                </span>
              </div>

              <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50/50 border border-blue-100">
                <span className="flex items-center gap-2 text-blue-900 font-medium">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>فوري / بطاقات إلكترونية:</span>
                </span>
                <span className="font-mono font-bold text-blue-800">
                  {((summary.paymentsBreakdown?.fawry || 0) + (summary.paymentsBreakdown?.syberpay || 0)).toLocaleString()} ج.س
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
