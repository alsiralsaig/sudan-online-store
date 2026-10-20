import React, { useState, useEffect, useRef } from 'react';
import type { KitchenTicket, KitchenStatus, Branch } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import {
  UtensilsCrossed,
  Clock,
  CheckCircle,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Filter,
  AlertTriangle,
  Flame,
  CheckCircle2,
  ShoppingBag,
  BellRing,
  RefreshCw,
} from 'lucide-react';

interface KitchenDisplayViewProps {
  branches: Branch[];
  currentBranch: Branch | null;
}

export const KitchenDisplayView: React.FC<KitchenDisplayViewProps> = ({
  branches,
  currentBranch,
}) => {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterBranchId, setFilterBranchId] = useState<string>(currentBranch?.id || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [now, setNow] = useState<number>(Date.now());
  const prevCountRef = useRef<number>(0);

  // Play audio chime for new orders
  const playKitchenChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio autoplay handled
    }
  };

  const loadTickets = async () => {
    try {
      const res = await api.getKitchenTickets(
        filterBranchId || undefined,
        statusFilter !== 'all' ? statusFilter : undefined
      );
      if (res && res.tickets) {
        if (res.tickets.length > prevCountRef.current && prevCountRef.current > 0) {
          playKitchenChime();
        }
        prevCountRef.current = res.tickets.length;
        setTickets(res.tickets);
      }
    } catch (err) {
      console.warn('Failed to load kitchen tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(() => {
      setNow(Date.now());
      loadTickets();
    }, 10000);
    return () => clearInterval(interval);
  }, [filterBranchId, statusFilter]);

  const handleUpdateStatus = async (ticketId: string, nextStatus: KitchenStatus) => {
    try {
      await api.updateKitchenTicketStatus(ticketId, nextStatus);
      loadTickets();
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    }
  };

  const handleToggleItemStatus = async (ticketId: string, itemId: string, currentStatus: KitchenStatus) => {
    const nextStatus: KitchenStatus = currentStatus === 'ready' ? 'pending' : 'ready';
    try {
      await api.updateKitchenItemStatus(ticketId, itemId, nextStatus);
      loadTickets();
    } catch (err) {
      console.error('Failed to update item status:', err);
    }
  };

  // Helper for elapsed minutes
  const getElapsedMinutes = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    return Math.max(0, Math.floor((now - created) / 60000));
  };

  // Counts
  const pendingCount = tickets.filter((t) => t.status === 'pending').length;
  const preparingCount = tickets.filter((t) => t.status === 'preparing').length;
  const readyCount = tickets.filter((t) => t.status === 'ready').length;
  const completedCount = tickets.filter((t) => t.status === 'completed').length;

  return (
    <div className="min-h-full bg-slate-900 text-slate-100 flex flex-col" dir="rtl">
      {/* KDS Header Bar */}
      <header className="bg-slate-950/80 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">
                شاشة عرض المطبخ وتجهيز الطلبات (KDS)
              </h1>
              <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] px-2 py-0.5 rounded font-mono font-semibold">
                Kitchen Display System
              </span>
            </div>
            <p className="text-xs text-slate-400">
              متابعة بنود الطلبات وملاحظات الطلب السريع وتأكيد إتمام التجهيز فورياً
            </p>
          </div>
        </div>

        {/* Status badges summary */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              statusFilter === 'pending'
                ? 'bg-rose-600/30 text-rose-300 border-rose-500 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>بانتظار التحضير:</span>
            <span className="bg-rose-500 text-white px-1.5 py-0.2 rounded-full text-[11px] font-mono">
              {pendingCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('preparing')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              statusFilter === 'preparing'
                ? 'bg-amber-600/30 text-amber-300 border-amber-500 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>قيد التجهيز:</span>
            <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold">
              {preparingCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('ready')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              statusFilter === 'ready'
                ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>جاهز للتسليم:</span>
            <span className="bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold">
              {readyCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              statusFilter === 'completed'
                ? 'bg-slate-700 text-slate-200 border-slate-500 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <span>مكتمل ({completedCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-700 text-white border-slate-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
            }`}
          >
            الكل
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Branch filter */}
          <select
            value={filterBranchId}
            onChange={(e) => setFilterBranchId(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
          >
            <option value="">كافة الفروع</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Sound alert toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'كتم التنبيه الصوتي' : 'تفعيل التنبيه الصوتي'}
            className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Refresh button */}
          <button
            onClick={loadTickets}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="تحديث فوري للطلبات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main KDS Board Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm">جاري مزامنة تذاكر المطبخ والطلبات...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-center text-slate-400 border-2 border-dashed border-slate-800 rounded-2xl p-8 max-w-lg mx-auto my-12">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-4">
              <UtensilsCrossed className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">المطبخ خالٍ من الطلبات المعلقة</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              أي طلب جديد يسجله الكاشير في نقطة البيع وملاحظات الطلب السريع سيظهر هنا فورياً مع مؤقت التجهيز
            </p>
            <button
              onClick={() => {
                setStatusFilter('all');
                setFilterBranchId('');
                loadTickets();
              }}
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
            >
              عرض كافة الطلبات والمسجلة سابقاً
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tickets.map((ticket) => {
              const elapsed = getElapsedMinutes(ticket.createdAt);
              const isUrgent = elapsed >= 15;
              const isWarning = elapsed >= 7 && elapsed < 15;

              return (
                <div
                  key={ticket.id}
                  className={`flex flex-col rounded-xl border bg-slate-850 shadow-md transition-all ${
                    ticket.status === 'ready'
                      ? 'border-emerald-500/50 bg-slate-900/90'
                      : ticket.status === 'preparing'
                      ? 'border-amber-500/50 bg-slate-900/90'
                      : isUrgent
                      ? 'border-rose-500 bg-rose-950/20 shadow-rose-950/50'
                      : 'border-slate-800 bg-slate-900/90'
                  }`}
                >
                  {/* Ticket Header */}
                  <div
                    className={`px-4 py-3 rounded-t-xl border-b flex items-center justify-between ${
                      ticket.status === 'ready'
                        ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-200'
                        : ticket.status === 'preparing'
                        ? 'bg-amber-950/40 border-amber-500/20 text-amber-200'
                        : isUrgent
                        ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-white">
                          #{ticket.invoiceNumber}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            ticket.orderType === 'quick_order'
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                              : ticket.orderType === 'takeaway'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {ticket.orderType === 'quick_order'
                            ? '⚡ طلب سريع'
                            : ticket.orderType === 'takeaway'
                            ? '🛍️ سفري'
                            : '🍽️ محلي'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{ticket.customerName || 'عميل نقدي'}</span>
                        <span>•</span>
                        <span>{ticket.branchName}</span>
                      </div>
                    </div>

                    {/* Timer Badge */}
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                        isUrgent
                          ? 'bg-rose-600 text-white animate-pulse'
                          : isWarning
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                      title={`وقت الطلب: ${new Date(ticket.createdAt).toLocaleTimeString('ar-SD')}`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{elapsed} د</span>
                    </div>
                  </div>

                  {/* Items List with Quick Order Notes Prominently Styled */}
                  <div className="p-4 flex-1 space-y-2.5 overflow-y-auto max-h-72">
                    {ticket.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItemStatus(ticket.id, item.id, item.status)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                          item.status === 'ready' || item.status === 'completed'
                            ? 'bg-emerald-950/30 border-emerald-500/30 text-slate-400 line-through'
                            : 'bg-slate-800/80 border-slate-700/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded flex items-center justify-center text-xs font-mono font-bold ${
                                item.status === 'ready'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-700 text-orange-400 border border-slate-600'
                              }`}
                            >
                              {item.quantity}×
                            </span>
                            <span className="font-semibold text-xs text-slate-100">
                              {item.productName}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {item.unit}
                          </span>
                        </div>

                        {/* Quick Order Note Callout */}
                        {item.notes && item.notes.trim().length > 0 && (
                          <div className="mt-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] px-2.5 py-1.5 rounded-md flex items-start gap-1.5 font-medium not-italic">
                            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span>
                              <strong className="text-amber-200">ملاحظة التجهيز: </strong>
                              {item.notes}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Ticket Actions Footer */}
                  <div className="p-3 border-t border-slate-800 bg-slate-950/40 rounded-b-xl flex items-center gap-2">
                    {ticket.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(ticket.id, 'preparing')}
                        className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>بدء التحضير</span>
                      </button>
                    )}

                    {ticket.status === 'preparing' && (
                      <button
                        onClick={() => handleUpdateStatus(ticket.id, 'ready')}
                        className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>جاهز للتسليم</span>
                      </button>
                    )}

                    {ticket.status === 'ready' && (
                      <button
                        onClick={() => handleUpdateStatus(ticket.id, 'completed')}
                        className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تأكيد الإتمام والتسليم</span>
                      </button>
                    )}

                    {ticket.status === 'completed' && (
                      <button
                        onClick={() => handleUpdateStatus(ticket.id, 'preparing')}
                        className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة للتحضير</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
