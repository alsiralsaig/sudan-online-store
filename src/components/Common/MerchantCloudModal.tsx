import React from 'react';
import { Cloud, CloudOff, CloudUpload, RefreshCw, Wifi, WifiOff, X } from 'lucide-react';

interface MerchantCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName: string;
  branchName: string;
  isOffline: boolean;
  isSyncing: boolean;
  pendingOfflineCount: number;
  lastSyncAt: string | null;
  onUpload: () => void;
  onRefreshFromServer: () => void;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'ما في مزامنة بعد';
  try {
    return new Date(iso).toLocaleString('ar-SD', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

/** شاشة السحابة — زي حساباتي: رفع واضح، حالة الاتصال، فواتير معلّقة */
export const MerchantCloudModal: React.FC<MerchantCloudModalProps> = ({
  isOpen,
  onClose,
  tenantName,
  branchName,
  isOffline,
  isSyncing,
  pendingOfflineCount,
  lastSyncAt,
  onUpload,
  onRefreshFromServer,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" dir="rtl">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-black flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-400" />
            السحابة — مزامنة بين الأجهزة
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2">
            <span className="font-bold text-slate-300">حالة الخادم</span>
            {isOffline ? (
              <span className="flex items-center gap-1.5 text-amber-300 font-black">
                <WifiOff className="w-3.5 h-3.5" /> دون اتصال
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-400 font-black">
                <Wifi className="w-3.5 h-3.5" /> متصل بالسحابة
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-black text-sm text-white truncate">{tenantName}</p>
                <p className="text-slate-400 truncate">{branchName}</p>
              </div>
              <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                محلي + سحابي
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div>آخر رفع: {formatWhen(lastSyncAt)}</div>
              <div>
                فواتير معلّقة:{' '}
                <span className={pendingOfflineCount ? 'text-amber-300 font-black' : 'text-emerald-400 font-black'}>
                  {pendingOfflineCount}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onUpload}
              disabled={isOffline || isSyncing}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-3 font-black text-white"
            >
              {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
              ارفع الآن
            </button>
            <button
              type="button"
              onClick={onRefreshFromServer}
              disabled={isOffline || isSyncing}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 py-3 font-black text-white"
            >
              <Cloud className="w-4 h-4" />
              نزّل من السحابة
            </button>
          </div>

          {isOffline && (
            <p className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-amber-200 font-bold">
              الجهاز دون اتصال — الفواتير الجديدة تتحفظ هنا وترفع لما يرجع النت.
            </p>
          )}

          <p className="text-[10px] text-slate-500 leading-relaxed">
            الشغل اليومي يشتغل أوفلاين. الزر الأخضر يرفع فواتير الدرج للخادم. الزر الأزرق يجدّد المخزون والفروع من السحابة.
          </p>
        </div>
      </div>
    </div>
  );
};
