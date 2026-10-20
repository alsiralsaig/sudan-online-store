import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  X,
  Truck,
  Building,
} from 'lucide-react';
import type { BranchTransfer, Branch, Product } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface TransfersViewProps {
  transfers: BranchTransfer[];
  branches: Branch[];
  products: Product[];
  onRefresh: () => void;
}

export const TransfersView: React.FC<TransfersViewProps> = ({
  transfers,
  branches,
  products,
  onRefresh,
}) => {
  // New Transfer Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [sourceBranchId, setSourceBranchId] = useState(branches[0]?.id || '');
  const [targetBranchId, setTargetBranchId] = useState(branches[1]?.id || '');
  const [transferItems, setTransferItems] = useState<{ productId: string; requestedQty: number }[]>([
    { productId: products[0]?.id || '', requestedQty: 10 },
  ]);
  const [transferNotes, setTransferNotes] = useState('');

  // Receive Transfer Modal
  const [receivingTransfer, setReceivingTransfer] = useState<BranchTransfer | null>(null);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [receiverNotes, setReceiverNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add Item Line
  const addItemLine = () => {
    setTransferItems([...transferItems, { productId: products[0]?.id || '', requestedQty: 5 }]);
  };

  const removeItemLine = (idx: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== idx));
  };

  const updateItemLine = (idx: number, field: 'productId' | 'requestedQty', value: any) => {
    const copy = [...transferItems];
    copy[idx] = { ...copy[idx], [field]: value };
    setTransferItems(copy);
  };

  // Submit Request
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceBranchId === targetBranchId) {
      alert('لا يمكن اختيار نفس الفرع كمصدر ووجهة');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const formattedItems = transferItems.map((item) => {
      const prod = products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        productName: prod?.name || 'منتج',
        requestedQty: Number(item.requestedQty),
      };
    });

    try {
      const res = await api.requestTransfer({
        sourceBranchId,
        targetBranchId,
        items: formattedItems,
        notes: transferNotes,
      });

      if (res.success) {
        setIsNewModalOpen(false);
        setTransferNotes('');
        onRefresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إنشاء طلب التحويل');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Dispatch
  const handleDispatch = async (transferId: string) => {
    if (!confirm('هل أنت متأكد من إرسال الشحنة وخصم الكميات من مخزون فرع المصدر؟')) return;
    try {
      const res = await api.dispatchTransfer(transferId);
      if (res.success) {
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message || 'فشل إرسال الشحنة');
    }
  };

  // Open Receive Modal
  const handleOpenReceive = (transfer: BranchTransfer) => {
    setReceivingTransfer(transfer);
    const initialQty: Record<string, number> = {};
    for (const it of transfer.items) {
      initialQty[it.productId] = it.dispatchedQty;
    }
    setReceivedQuantities(initialQty);
    setReceiverNotes('');
  };

  // Submit Receive
  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingTransfer) return;
    setIsSubmitting(true);

    const receivedItems = receivingTransfer.items.map((it) => ({
      productId: it.productId,
      receivedQty: Number(receivedQuantities[it.productId] ?? it.dispatchedQty),
    }));

    try {
      const res = await api.receiveTransfer(receivingTransfer.id, {
        receivedItems,
        receiverNotes,
      });

      if (res.success) {
        setReceivingTransfer(null);
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message || 'فشل إتمام استلام الشحنة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">تحويلات البضاعة والمخزون بين الفروع</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            دورة تحويل نظامية كاملة: طلب التحويل ← الإرسال والخصم ← الاستلام وتوثيق أي فوارق
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء طلب تحويل بضاعة</span>
        </button>
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">رقم الإرسالية</th>
                <th className="py-3 px-4">فرع المصدر (المُرسِل)</th>
                <th className="py-3 px-4">فرع الوجهة (المُستلِم)</th>
                <th className="py-3 px-4">الأصناف والكميات</th>
                <th className="py-3 px-4">تاريخ الطلب</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {transfers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {t.transferNumber}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {t.sourceBranchName}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {t.targetBranchName}
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-0.5">
                      {t.items.map((i, idx) => (
                        <div key={idx} className="text-slate-700 font-mono">
                          <span className="font-sans font-medium text-slate-900">{i.productName}</span>:{' '}
                          طلب ({i.requestedQty})
                          {t.status !== 'requested' && ` | أُرسل (${i.dispatchedQty})`}
                          {t.status === 'received' || t.status === 'discrepancy_reported'
                            ? ` | استلم (${i.receivedQty})`
                            : ''}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {new Date(t.createdAt).toLocaleDateString('ar-SD')}
                  </td>
                  <td className="py-3 px-4">
                    {t.status === 'requested' && (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>طلب جديد (بانتظار الإرسال)</span>
                      </span>
                    )}
                    {t.status === 'dispatched' && (
                      <span className="text-blue-700 font-semibold flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" />
                        <span>في الطريق (تم الشحن)</span>
                      </span>
                    )}
                    {t.status === 'received' && (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>مكتمل ومستلم بالكامل</span>
                      </span>
                    )}
                    {t.status === 'discrepancy_reported' && (
                      <span className="text-rose-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>مستلم مع وجود فارق</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {t.status === 'requested' && (
                        <button
                          onClick={() => handleDispatch(t.id)}
                          className="px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded font-medium flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>إرسال وشحن</span>
                        </button>
                      )}
                      {t.status === 'dispatched' && (
                        <button
                          onClick={() => handleOpenReceive(t)}
                          className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>تأكيد الاستلام</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          NEW TRANSFER MODAL
          ========================================================================= */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRequest}
            className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">إنشاء طلب تحويل بضاعة بين الفروع</h3>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">من فرع (المصدر):</label>
                  <select
                    value={sourceBranchId}
                    onChange={(e) => setSourceBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">إلى فرع (الوجهة):</label>
                  <select
                    value={targetBranchId}
                    onChange={(e) => setTargetBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 border-t border-b border-slate-200 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">الأصناف المراد تحويلها:</span>
                  <button
                    type="button"
                    onClick={addItemLine}
                    className="text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة صنف</span>
                  </button>
                </div>

                {transferItems.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={line.productId}
                      onChange={(e) => updateItemLine(idx, 'productId', e.target.value)}
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      required
                      value={line.requestedQty}
                      onChange={(e) => updateItemLine(idx, 'requestedQty', e.target.value)}
                      className="w-20 px-2.5 py-1.5 font-mono text-center border border-slate-300 rounded-lg"
                      placeholder="الكمية"
                    />

                    {transferItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemLine(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ملاحظات التحويل:</label>
                <textarea
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="سبب التحويل أو بيانات السائق والترحيل..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                إنشاء طلب التحويل
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          RECEIVE TRANSFER MODAL
          ========================================================================= */}
      {receivingTransfer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitReceive}
            className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">استلام ومعاينة الشحنة</h3>
                <p className="text-[11px] text-slate-400">{receivingTransfer.transferNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setReceivingTransfer(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-3">
                <span className="font-bold text-slate-900 block">
                  أدخل الكميات المستلمة فعلياً في المستودع:
                </span>
                {receivingTransfer.items.map((item) => (
                  <div
                    key={item.productId}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 block">{item.productName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        المشحون من المصدر: {item.dispatchedQty}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600">المستلم:</span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={receivedQuantities[item.productId] ?? item.dispatchedQty}
                        onChange={(e) =>
                          setReceivedQuantities({
                            ...receivedQuantities,
                            [item.productId]: Number(e.target.value),
                          })
                        }
                        className="w-16 px-2 py-1 font-mono font-bold text-center border border-slate-300 rounded bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ملاحظات الاستلام (أو أسباب الفارق إن وجد):
                </label>
                <textarea
                  rows={2}
                  value={receiverNotes}
                  onChange={(e) => setReceiverNotes(e.target.value)}
                  placeholder="سجل أي تلف أو نقص أو مطابقة تامة..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReceivingTransfer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                اعتماد الاستلام وإضافة الرصيد
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
