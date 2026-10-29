import React, { useState } from 'react';
import { Barcode, Camera, Image as ImageIcon, Loader2, Save, Trash2, Video, X } from 'lucide-react';
import type { Branch, Product } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { uploadProductImage, uploadProductVideo, PRODUCT_VIDEO_MAX_SECONDS } from '../../lib/uploadProductMedia.ts';
import { CameraBarcodeScanner } from '../POS/CameraBarcodeScanner.tsx';

interface Props {
  product: Product;
  branch: Branch | null;
  stock: number;
  stockReady: boolean;
  canEdit: boolean;
  canViewCogs: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export const ProductDetailsModal: React.FC<Props> = ({ product, branch, stock, stockReady, canEdit, canViewCogs, onClose, onChanged }) => {
  const [name, setName] = useState(product.name || '');
  const [sku, setSku] = useState(product.sku || '');
  const [barcode, setBarcode] = useState(product.barcode || '');
  const [category, setCategory] = useState(product.category || '');
  const [unit, setUnit] = useState(product.unit || '');
  const [cost, setCost] = useState(String(product.purchaseCost ?? 0));
  const [currency, setCurrency] = useState(product.costCurrency || 'SDG');
  const [price, setPrice] = useState(String(product.sellingPriceSdg ?? 0));
  const [minimum, setMinimum] = useState(String(product.minimumStock ?? product.minStockAlert ?? 0));
  const [quantity, setQuantity] = useState(String(stock));
  const [stockAtEdit, setStockAtEdit] = useState<number | null>(null);
  const [taxExempt, setTaxExempt] = useState(Boolean(product.isTaxExempt));
  const [taxRate, setTaxRate] = useState(product.customTaxRate == null ? '' : String(product.customTaxRate));
  const [imageUrl, setImageUrl] = useState(product.imageUrl || '');
  const [videoUrl, setVideoUrl] = useState(product.videoUrl || '');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File | undefined, kind: 'image' | 'video') => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = kind === 'image' ? await uploadProductImage(file) : await uploadProductVideo(file);
      if (kind === 'image') setImageUrl(url); else setVideoUrl(url);
    } catch (e: any) {
      setError(e.message || 'تعذر رفع الملف.');
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || busy || uploading) return;
    setError('');
    const requiredNumbers = [price, minimum, ...(canViewCogs ? [cost] : [])];
    if (!name.trim() || requiredNumbers.some((n) => !n.trim() || !Number.isFinite(Number(n)) || Number(n) < 0) || Number(price) <= 0 || (taxRate !== '' && (!Number.isFinite(Number(taxRate)) || Number(taxRate) < 0 || Number(taxRate) > 100))) {
      setError('تأكد من الاسم والأسعار والحد الأدنى والضريبة.');
      return;
    }
    if (branch && stockReady && stockAtEdit !== null && (!quantity.trim() || !Number.isFinite(Number(quantity)))) {
      setError('أدخل كمية صالحة لرصيد الفرع.');
      return;
    }
    const payload: Record<string, unknown> = {
      name: name.trim(), sku: sku.trim(), barcode: barcode.trim(), category: category.trim(), unit: unit.trim(),
      sellingPriceSdg: Number(price), minStockAlert: Number(minimum), isTaxExempt: taxExempt,
      customTaxRate: taxRate === '' ? null : Number(taxRate), imageUrl, videoUrl,
    };
    if (canViewCogs) { payload.purchaseCost = Number(cost); payload.costCurrency = currency.trim() || 'SDG'; }
    if (branch && stockReady && stockAtEdit !== null && Number(quantity) !== stockAtEdit) {
      payload.branchId = branch.id; payload.expectedStock = stockAtEdit; payload.stockQuantity = Number(quantity);
    }
    setBusy(true);
    try {
      await api.updateProduct(product.id, payload);
      onChanged();
    } catch (e: any) {
      setError(e.message === 'OFFLINE_MODE' ? 'يلزم الاتصال بالإنترنت لحفظ التعديلات.' : e.message || 'تعذر حفظ التعديلات.');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!canEdit || busy || uploading) return;
    setError(''); setBusy(true);
    try {
      await api.deleteProduct(product.id);
      setConfirmDelete(false);
      onChanged();   // تحديث قوائم الأصناف والمخزون
      onClose();     // إغلاق النافذة بعد نجاح الحذف
    } catch (e: any) {
      setError(e.message === 'OFFLINE_MODE' ? 'يلزم الاتصال بالإنترنت لحذف الصنف.' : e.message || 'تعذر حذف الصنف.');
    } finally { setBusy(false); }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 disabled:opacity-75';
  const labelClass = 'block mb-1 font-bold text-slate-700';
  return <>
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="product-details-title">
      <form onSubmit={save} className="bg-white w-full max-w-lg max-h-[92dvh] rounded-2xl border border-slate-300 shadow-2xl overflow-hidden flex flex-col text-sm">
        <div className="bg-emerald-700 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div><h2 id="product-details-title" className="font-bold">تفاصيل الصنف وتعديله</h2><p className="text-xs text-emerald-100">{product.name}</p></div>
          <button type="button" onClick={onClose} disabled={busy || uploading} aria-label="إغلاق" className="p-2"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4">
          {!canEdit && <p className="text-amber-700 bg-amber-100 rounded-lg p-2">يمكنك عرض التفاصيل فقط؛ لا توجد لديك صلاحية التعديل.</p>}
          {error && <div role="alert" className="rounded-lg bg-rose-100 text-rose-800 p-3">{error}</div>}
          <fieldset disabled={!canEdit || busy || uploading} className="space-y-3">
            <div><label className={labelClass} htmlFor="edit-product-name">اسم الصنف</label><input id="edit-product-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass} htmlFor="edit-product-category">التصنيف</label><input id="edit-product-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass} htmlFor="edit-product-unit">الوحدة</label><input id="edit-product-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass} htmlFor="edit-product-barcode">الباركود</label><div className="flex gap-1"><input id="edit-product-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} dir="ltr" className={`${inputClass} min-w-0 font-mono`} /><button type="button" onClick={() => setScannerOpen(true)} aria-label="مسح باركود الصنف" className="shrink-0 p-2 bg-emerald-600 text-white rounded-lg"><Barcode className="w-5 h-5" /></button></div></div>
              <div><label className={labelClass} htmlFor="edit-product-sku">رمز SKU</label><input id="edit-product-sku" value={sku} onChange={(e) => setSku(e.target.value)} dir="ltr" className={`${inputClass} font-mono`} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {canViewCogs && <div><label className={labelClass} htmlFor="edit-product-cost">سعر التكلفة</label><input id="edit-product-cost" type="number" min="0" step="any" required value={cost} onChange={(e) => setCost(e.target.value)} className={inputClass} /></div>}
              <div><label className={labelClass} htmlFor="edit-product-price">سعر البيع (ج.س)</label><input id="edit-product-price" type="number" min="0.01" step="any" required value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} /></div>
              {canViewCogs && <div><label className={labelClass} htmlFor="edit-product-currency">عملة التكلفة</label><input id="edit-product-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} dir="ltr" className={inputClass} /></div>}
              <div><label className={labelClass} htmlFor="edit-product-minimum">حد تنبيه النواقص</label><input id="edit-product-minimum" type="number" min="0" step="any" required value={minimum} onChange={(e) => setMinimum(e.target.value)} className={inputClass} /></div>
            </div>
            <div><label className={labelClass} htmlFor="edit-product-stock">الرصيد في {branch?.name || 'الفرع'}</label><input id="edit-product-stock" type="number" step="any" disabled={!branch || !stockReady} value={stockAtEdit === null ? String(stock) : quantity} onChange={(e) => { if (stockAtEdit === null) setStockAtEdit(stock); setQuantity(e.target.value); }} className={inputClass} /><p className="text-xs text-slate-500 mt-1">تغيير الرصيد يُسجّل كتسوية مخزنية لهذا الفرع فقط.</p></div>
            <div className="grid grid-cols-2 gap-3 items-end"><label className="flex items-center gap-2 text-slate-700 font-bold"><input type="checkbox" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} /> معفى من الضريبة</label><div><label className={labelClass} htmlFor="edit-product-tax">نسبة ضريبة خاصة %</label><input id="edit-product-tax" type="number" min="0" max="100" step="any" placeholder="الافتراضية" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className={inputClass} /></div></div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className={labelClass}>صورة الصنف</span>{imageUrl && <img src={imageUrl} alt="صورة الصنف" className="h-24 w-full object-contain rounded-lg border border-slate-200 mb-2"  referrerPolicy="no-referrer" />}<div className="flex flex-wrap gap-2"><label className="cursor-pointer px-3 py-2 rounded-lg bg-emerald-600 text-white flex items-center gap-1"><ImageIcon className="w-4 h-4" /> اختيار صورة<input type="file" accept="image/*" className="hidden" onChange={(e) => { void upload(e.target.files?.[0], 'image'); e.target.value = ''; }} /></label><label className="cursor-pointer px-3 py-2 rounded-lg bg-slate-200 text-slate-800 flex items-center gap-1"><Camera className="w-4 h-4" /> تصوير<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void upload(e.target.files?.[0], 'image'); e.target.value = ''; }} /></label>{imageUrl && <button type="button" onClick={() => setImageUrl('')} className="text-rose-600 underline">حذف الصورة</button>}</div></div>
              <div><span className={labelClass}>فيديو الصنف</span>{videoUrl && <video src={videoUrl} className="h-24 w-full rounded-lg mb-2" controls playsInline />}<label className="cursor-pointer px-3 py-2 rounded-lg bg-slate-200 text-slate-800 inline-flex items-center gap-1"><Video className="w-4 h-4" /> اختيار فيديو<input type="file" accept="video/*" className="hidden" onChange={(e) => { void upload(e.target.files?.[0], 'video'); e.target.value = ''; }} /></label><p className="text-xs text-slate-500 mt-1">حتى {PRODUCT_VIDEO_MAX_SECONDS} ثانية</p>{videoUrl && <button type="button" onClick={() => setVideoUrl('')} className="text-rose-600 underline">حذف الفيديو</button>}</div>
            </div>
          </fieldset>
          {uploading && <p className="text-emerald-600 flex gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جارٍ رفع الملف...</p>}
        </div>
        <div className="border-t border-slate-200 p-3 flex flex-wrap gap-2 shrink-0">
          {canEdit && <><button type="submit" disabled={busy || uploading || confirmDelete} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" /> {busy ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</button><button type="button" disabled={busy || uploading} onClick={() => setConfirmDelete(true)} className="bg-rose-100 text-rose-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"><Trash2 className="w-4 h-4" /> حذف الصنف</button></>}
          <button type="button" onClick={onClose} disabled={busy || uploading} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700">إغلاق</button>
        </div>
      </form>
    </div>
    {confirmDelete && canEdit && (
      <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title">
        <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-300 shadow-2xl overflow-hidden text-sm" dir="rtl">
          <div className="px-4 py-3 bg-rose-600 text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            <h3 id="confirm-delete-title" className="font-bold">تأكيد حذف «{product.name}»؟</h3>
          </div>
          <div className="p-4 space-y-3 text-slate-700">
            <p className="text-xs leading-relaxed">سيختفي الصنف فوراً من قوائم المتجر ونقاط البيع وتطبيق المتسوقين. الفواتير وحركات المخزون تبقى محفوظة في السجل.</p>
            {error && <div role="alert" className="rounded-lg bg-rose-100 text-rose-800 p-2 text-xs">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button type="button" disabled={busy} onClick={() => void remove()} className="flex-1 bg-rose-700 text-white px-3 py-2.5 rounded-xl font-bold disabled:opacity-50">{busy ? 'جارٍ الحذف...' : 'نعم، احذف الصنف'}</button>
              <button type="button" disabled={busy} onClick={() => { setConfirmDelete(false); setError(''); }} className="flex-1 bg-slate-200 text-slate-800 px-3 py-2.5 rounded-xl font-bold disabled:opacity-50">تراجع</button>
            </div>
          </div>
        </div>
      </div>
    )}
    {scannerOpen && <div className="relative z-[80]"><CameraBarcodeScanner isOpen onClose={() => setScannerOpen(false)} onScanSuccess={(code) => { setBarcode(code); setScannerOpen(false); }} submitLabel="اعتماد الباركود" /></div>}
  </>;
};
