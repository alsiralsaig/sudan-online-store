import React, { useState, useEffect } from 'react';
import {
  Printer,
  Image as ImageIcon,
  Phone,
  Building,
  FileText,
  Save,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  QrCode,
  Eye,
  Sliders,
  UtensilsCrossed,
  Percent,
  Star,
} from 'lucide-react';
import type { ThermalReceiptSettings } from '../../types/index.ts';
import {
  getThermalReceiptSettings,
  saveThermalReceiptSettings,
  DEFAULT_RECEIPT_SETTINGS,
} from '../../lib/printerSettings.ts';
import { generateZatcaTlvBase64, generateQrSvg } from '../../lib/zatcaQr.ts';

export const ThermalReceiptSettingsView: React.FC = () => {
  const [settings, setSettings] = useState<ThermalReceiptSettings>(getThermalReceiptSettings());
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setSettings(getThermalReceiptSettings());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveThermalReceiptSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    if (confirm('هل أنت متأكد من رغبتك في إعادة ضبط إعدادات الفاتورة إلى القيم الافتراضية؟')) {
      setSettings(DEFAULT_RECEIPT_SETTINGS);
      saveThermalReceiptSettings(DEFAULT_RECEIPT_SETTINGS);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  // Sample items for live preview
  const sampleItems = [
    { name: 'سكر كنانة بلوري 10 كجم', qty: 2, price: 34000, total: 68000, notes: 'تغليف خاص للشحن', isTaxExempt: false },
    { name: 'شاي الغزالتين الأصلي 400 جم', qty: 3, price: 4200, total: 12600, notes: 'بدون سكر', isTaxExempt: false },
    { name: 'زيت صباح نقي 4.5 لتر', qty: 1, price: 29500, total: 29500, isTaxExempt: false },
  ];
  const sampleSubtotal = sampleItems.reduce((acc, it) => acc + it.total, 0);

  // Dynamic VAT calculation for live preview
  const sampleVatPct = settings.vatEnabled ? (settings.defaultVatPct ?? 15) : 0;
  const sampleVatAmount = settings.vatEnabled && sampleVatPct > 0
    ? (settings.pricesIncludeVat
        ? Math.round(sampleSubtotal - (sampleSubtotal / (1 + sampleVatPct / 100)))
        : Math.round(sampleSubtotal * (sampleVatPct / 100)))
    : 0;

  const sampleGrandTotal = settings.vatEnabled
    ? (settings.pricesIncludeVat ? sampleSubtotal : sampleSubtotal + sampleVatAmount)
    : sampleSubtotal;

  return (
    <div className="space-y-6">
      {/* Title & Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Printer className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">تخصيص ترويسة وتذييل الفاتورة الحرارية</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            خصص مظهر الإيصال الحراري المطبوع لعملائك (الشعار، اسم المتجر، أرقام الهاتف، التذييل، وقالب الورق الافتراضي)
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>تم حفظ إعدادات الفاتورة بنجاح!</span>
          </div>
        )}
      </div>

      {/* Main Grid: Form on the Right / Live Preview on the Left */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Settings (7 cols) */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          {/* Section 1: Store & Header Info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Building className="w-4 h-4 text-emerald-600" />
              <span>بيانات الترويسة وهوية المتجر (Header)</span>
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                اسم المتجر / الشركة التجاري:
              </label>
              <input
                type="text"
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                placeholder="مثال: شركة الرواد للتجارة والمحاصيل"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الاسم الفرعي / وصف النشاط:
                </label>
                <input
                  type="text"
                  value={settings.storeSubtitle}
                  onChange={(e) => setSettings({ ...settings, storeSubtitle: e.target.value })}
                  placeholder="مثال: فرع بورتسودان - السوق الكبير"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  أرقام الهاتف والتواصل:
                </label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="مثال: 0912345678 / 0123456789"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                العنوان التفصيلي:
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="مثال: بورتسودان، شارع الجمهورية، عمارة الأوقاف"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الرقم الضريبي (TIN / VAT):
                </label>
                <input
                  type="text"
                  value={settings.taxNumber}
                  onChange={(e) => setSettings({ ...settings, taxNumber: e.target.value })}
                  placeholder="1004892348"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  رقم السجل التجاري:
                </label>
                <input
                  type="text"
                  value={settings.commercialRegister}
                  onChange={(e) => setSettings({ ...settings, commercialRegister: e.target.value })}
                  placeholder="CR-SD-884920"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                رابط شعار المتجر (Logo URL):
              </label>
              <input
                type="url"
                value={settings.logoUrl || ''}
                onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png (اختياري - يظهر أعلى الفاتورة)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Section 2: Footer & Customer Notes */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>بيانات التذييل وسياسات المتجر (Footer)</span>
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                رسالة التذييل الأساسية (شروط الاستبدال أو الإرجاع):
              </label>
              <textarea
                rows={2}
                value={settings.footerMessage}
                onChange={(e) => setSettings({ ...settings, footerMessage: e.target.value })}
                placeholder="شكراً لزيارتكم! البضاعة المباعة ترد وتستبدل خلال 3 أيام بموجب الفاتورة"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ملاحظة ختامية ثانوية (رابط الموقع، حساب بنكك، أو رسالة ترحيبية):
              </label>
              <input
                type="text"
                value={settings.secondaryFooter}
                onChange={(e) => setSettings({ ...settings, secondaryFooter: e.target.value })}
                placeholder="سند لنقاط البيع الذكية · حساب بنكك: 2498765 · www.sanad.sd"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Section 2.5: VAT / Sales Tax Customization */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-600" />
                <span>إعدادات ضريبة القيمة المضافة (VAT) والفواتير الضريبية</span>
              </h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.vatEnabled ?? true}
                  onChange={(e) => setSettings({ ...settings, vatEnabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span className="text-xs font-bold text-emerald-700">تفعيل الضريبة</span>
              </label>
            </div>

            {settings.vatEnabled && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Default VAT Rate */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    نسبة ضريبة القيمة المضافة الافتراضية (%):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={settings.defaultVatPct ?? 15}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          defaultVatPct: Number(e.target.value) || 0,
                        })
                      }
                      className="w-28 px-3 py-2 text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex items-center gap-1.5">
                      {[15, 17, 5, 0].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setSettings({ ...settings, defaultVatPct: rate })}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                            (settings.defaultVatPct ?? 15) === rate
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {rate}% {rate === 15 ? '(القياسي)' : rate === 17 ? '(السودان)' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    تطبق هذه النسبة تلقائياً على كافة الأصناف ما لم يتم تحديد صنف بأنه "معفى من الضريبة" في شاشة المخزون.
                  </p>
                </div>

                {/* Pricing Mode */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    طريقة تطبيق واحتساب الضريبة على الأسعار:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2 ${
                        !settings.pricesIncludeVat
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-1 ring-emerald-500'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pricesIncludeVat"
                        checked={!settings.pricesIncludeVat}
                        onChange={() => setSettings({ ...settings, pricesIncludeVat: false })}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <div>
                        <span className="font-bold block">الأسعار غير شاملة للضريبة</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          تُضاف قيمة الضريبة ({settings.defaultVatPct ?? 15}%) فوق إجمالي أسعار الأصناف عند الدفع في الكاشير.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2 ${
                        settings.pricesIncludeVat
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-1 ring-emerald-500'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pricesIncludeVat"
                        checked={Boolean(settings.pricesIncludeVat)}
                        onChange={() => setSettings({ ...settings, pricesIncludeVat: true })}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <div>
                        <span className="font-bold block">الأسعار شاملة للضريبة (مدمجة)</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          سعر البيع المعلن يشمل الضريبة، ويتم استخراج وتفصيل مبلغ الضريبة على الفاتورة فقط.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Thermal Receipt VAT Display Options */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="block text-xs font-semibold text-slate-700 mb-1">
                    خيارات إظهار تفاصيل الضريبة في الفاتورة الحرارية:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showVatBreakdown ?? true}
                        onChange={(e) => setSettings({ ...settings, showVatBreakdown: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span className="font-semibold text-slate-800">
                        عرض سطر تفصيل ضريبة القيمة المضافة
                      </span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showTaxPerItem ?? true}
                        onChange={(e) => setSettings({ ...settings, showTaxPerItem: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span className="font-semibold text-slate-800">
                        إظهار رمز خضوع الضريبة (*) لكل صنف
                      </span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showLoyaltyPoints ?? true}
                        onChange={(e) => setSettings({ ...settings, showLoyaltyPoints: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span className="font-semibold text-slate-800">
                        إظهار رصيد نقاط الولاء للعميل في الفاتورة
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Print Template & Display Toggles */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>قالب الطباعة الافتراضي وعناصر العرض</span>
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                قالب الطباعة الافتراضي (Paper Template):
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, defaultTemplate: '80mm' })}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    settings.defaultTemplate === '80mm'
                      ? 'border-emerald-600 bg-emerald-50 font-bold text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs">طابعة حرارية 80mm</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">الورق العريض القياسي</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, defaultTemplate: '58mm' })}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    settings.defaultTemplate === '58mm'
                      ? 'border-emerald-600 bg-emerald-50 font-bold text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs">طابعة حرارية 58mm</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">الورق المضغوط الصغير</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, defaultTemplate: 'a4' })}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    settings.defaultTemplate === 'a4'
                      ? 'border-emerald-600 bg-emerald-50 font-bold text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs">فاتورة A4 كاملة</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">مستند ضريبي رسمي</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={settings.showQrCode}
                  onChange={(e) => setSettings({ ...settings, showQrCode: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span className="font-semibold text-slate-800">إظهار رمز الاستجابة السريع QR (ZATCA)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={settings.showCashierName}
                  onChange={(e) => setSettings({ ...settings, showCashierName: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span className="font-semibold text-slate-800">إظهار اسم الكاشير المصدر للفاتورة</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={settings.showKitchenNotes}
                  onChange={(e) => setSettings({ ...settings, showKitchenNotes: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span className="font-semibold text-slate-800">إظهار ملاحظات الطلب السريع (المطبخ/التغليف)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={settings.showCustomerInfo}
                  onChange={(e) => setSettings({ ...settings, showCustomerInfo: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <span className="font-semibold text-slate-800">إظهار بيانات العميل وهاتفه</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط للافتراضي</span>
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التعديلات وتطبيقها</span>
            </button>
          </div>
        </form>

        {/* Live Thermal Receipt Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 text-white mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>معاينة حية ومباشرة للفاتورة الحرارية</span>
            </div>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-300 font-mono">
              {settings.defaultTemplate === '80mm' ? '80 ملم' : settings.defaultTemplate === '58mm' ? '58 ملم' : 'A4'}
            </span>
          </div>

          {/* Thermal Paper Simulation Container */}
          <div className="flex justify-center bg-slate-200 p-4 sm:p-6 rounded-2xl border border-slate-300 shadow-inner">
            <div
              className={`bg-white text-slate-900 shadow-2xl p-4 font-sans text-xs transition-all duration-300 select-text ${
                settings.defaultTemplate === '58mm'
                  ? 'w-[260px] text-[10px]'
                  : settings.defaultTemplate === 'a4'
                  ? 'w-[360px] text-xs'
                  : 'w-[310px] text-[11px]'
              }`}
              style={{ minHeight: '440px' }}
            >
              {/* Optional Logo */}
              {settings.logoUrl && (
                <div className="flex justify-center mb-2">
                  <img
                    src={settings.logoUrl}
                    alt="Logo"
                    className="max-h-12 object-contain"
                    onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                  />
                </div>
              )}

              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-400 pb-2">
                <h2 className="text-sm font-black tracking-tight leading-snug">{settings.storeName || 'اسم المتجر'}</h2>
                {settings.storeSubtitle && (
                  <p className="text-[10px] text-slate-600 mt-0.5">{settings.storeSubtitle}</p>
                )}
                {settings.address && (
                  <p className="text-[9px] text-slate-500 mt-0.5">{settings.address}</p>
                )}
                {settings.phone && (
                  <p className="text-[10px] font-mono text-slate-600 mt-0.5">هاتف: {settings.phone}</p>
                )}
                {settings.taxNumber && (
                  <p className="text-[9px] font-mono text-slate-500">الرقم الضريبي: {settings.taxNumber}</p>
                )}
                {settings.commercialRegister && (
                  <p className="text-[9px] font-mono text-slate-500">السجل: {settings.commercialRegister}</p>
                )}
              </div>

              {/* Metadata */}
              <div className="text-[9px] text-slate-600 space-y-0.5 border-b border-dashed border-slate-300 py-2">
                <div className="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <span className="font-mono font-bold text-slate-900">INV-2026-889123</span>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ:</span>
                  <span className="font-mono">{new Date().toLocaleString('ar-SD')}</span>
                </div>
                {settings.showCashierName && (
                  <div className="flex justify-between">
                    <span>الكاشير:</span>
                    <span>محمد عبد الله</span>
                  </div>
                )}
                {settings.showCustomerInfo && (
                  <div className="flex justify-between">
                    <span>العميل:</span>
                    <span>
                      م. عبد العظيم الفاتح
                      {settings.showLoyaltyPoints && (
                        <span className="font-mono text-amber-700 font-bold mr-1">
                          (340 ⭐)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="border-b border-dashed border-slate-300 py-2">
                <table className="w-full text-right text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-300 text-[9px] text-slate-500">
                      <th className="py-1">الصنف</th>
                      <th className="py-1 text-center">الكمية</th>
                      <th className="py-1 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sampleItems.map((it, idx) => (
                      <React.Fragment key={idx}>
                        <tr className="py-1">
                          <td className="py-1 font-semibold">
                            {it.name}
                            {settings.vatEnabled && settings.showTaxPerItem && (
                              <span className="text-emerald-700 font-mono text-[9px] mr-1">
                                [ض {settings.defaultVatPct}%]
                              </span>
                            )}
                          </td>
                          <td className="py-1 text-center font-mono">{it.qty}</td>
                          <td className="py-1 text-left font-mono font-bold">{it.total.toLocaleString()}</td>
                        </tr>
                        {settings.showKitchenNotes && it.notes && (
                          <tr>
                            <td colSpan={3} className="pb-1">
                              <span className="inline-flex items-center gap-1 text-[9px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                                <UtensilsCrossed className="w-2.5 h-2.5" />
                                <span>ملاحظة: {it.notes}</span>
                              </span>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & VAT Breakdown */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 py-2">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الأولي:</span>
                  <span className="font-mono">{sampleSubtotal.toLocaleString()} ج.س</span>
                </div>

                {settings.vatEnabled && settings.showVatBreakdown && (
                  <div className="flex justify-between text-emerald-800 font-medium text-[10px] bg-emerald-50/70 px-1.5 py-0.5 rounded">
                    <span>
                      ضريبة القيمة المضافة ({settings.defaultVatPct}%
                      {settings.pricesIncludeVat ? ' مدمجة' : ''}):
                    </span>
                    <span className="font-mono font-bold">
                      {sampleVatAmount.toLocaleString()} ج.س
                    </span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-xs text-slate-900 pt-0.5">
                  <span>المبلغ المستحق:</span>
                  <span className="font-mono">{sampleGrandTotal.toLocaleString()} ج.س</span>
                </div>

                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>طريقة السداد:</span>
                  <span className="font-semibold">نقداً (معتمد)</span>
                </div>

                {settings.showLoyaltyPoints && (
                  <div className="flex justify-between text-[10px] text-amber-800 font-semibold pt-0.5 border-t border-dashed border-slate-200">
                    <span>نقاط الولاء المكتسبة:</span>
                    <span className="font-mono font-bold">
                      +{Math.max(1, Math.floor(sampleGrandTotal / 1000))} ⭐
                    </span>
                  </div>
                )}
              </div>

              {/* QR Code */}
              {settings.showQrCode && (
                <div className="flex flex-col items-center justify-center pt-2 pb-1">
                  <div
                    className="w-20 h-20"
                    dangerouslySetInnerHTML={{
                      __html: generateQrSvg(
                        generateZatcaTlvBase64({
                          sellerName: settings.storeName || 'شركة الرواد',
                          taxNumber: settings.taxNumber || '1004892348',
                          timestamp: new Date().toISOString(),
                          totalWithVat: sampleGrandTotal.toString(),
                          vatTotal: sampleVatAmount.toString(),
                        }),
                        80
                      ),
                    }}
                  />
                  <span className="text-[8px] text-slate-400 mt-1 font-mono">فاتورة إلكترونية معتمدة</span>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-dashed border-slate-300 space-y-1">
                {settings.footerMessage && <p>{settings.footerMessage}</p>}
                {settings.secondaryFooter && (
                  <p className="font-mono text-[8px] text-slate-400">{settings.secondaryFooter}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
