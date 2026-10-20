import React, { useState, useEffect } from 'react';
import {
  Printer,
  Bluetooth,
  Network,
  Monitor,
  Check,
  X,
  Sparkles,
  Settings,
  HelpCircle,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { PosPrinterSettings } from '../../types/index.ts';
import {
  getPosPrinterSettings,
  savePosPrinterSettings,
  executePosPrint,
} from '../../lib/printerSettings.ts';

interface PosPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PosPrinterModal: React.FC<PosPrinterModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<PosPrinterSettings>(getPosPrinterSettings());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isBluetoothSupported, setIsBluetoothSupported] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setSettings(getPosPrinterSettings());
      setTestResult(null);
      setIsBluetoothSupported('bluetooth' in navigator);
    }
  }, [isOpen]);

  const handleSave = () => {
    savePosPrinterSettings(settings);
    onClose();
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await executePosPrint('printable-receipt', settings);
      setTestResult(res.message);
    } catch (err: any) {
      setTestResult('فشل اختبار الطباعة: ' + (err?.message || 'خطأ غير متوقع'));
    } finally {
      setIsTesting(false);
    }
  };

  const pairBluetooth = async () => {
    if (!('bluetooth' in navigator)) {
      alert('خاصية Web Bluetooth غير مدعومة في هذا المتصفح. استخدم متصفح Chrome أو Edge على Android/PC.');
      return;
    }
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
        ],
      });
      if (device) {
        setSettings((prev) => ({
          ...prev,
          printerType: 'bluetooth',
          bluetoothDeviceName: device.name || 'طابعة بلوتوث حرارية',
        }));
        setTestResult(`تم اقتران الطابعة: ${device.name || 'طابعة حرارية'}`);
      }
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        console.warn('Bluetooth pairing error:', err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">إعدادات الطابعة الافتراضية للفواتير</h3>
              <p className="text-xs text-slate-400">تخصيص نمط توجيه أوامر الطباعة المباشرة من الكاشير</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Printer Mode Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              اختر نوع الطابعة الافتراضية:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: Browser default */}
              <button
                type="button"
                onClick={() => setSettings({ ...settings, printerType: 'browser' })}
                className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                  settings.printerType === 'browser'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Monitor
                    className={`w-5 h-5 ${
                      settings.printerType === 'browser' ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  />
                  {settings.printerType === 'browser' && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">طابعة النظام / المتصفح</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    نافذة الطباعة الافتراضية لنظام التشغيل (USB / Driver)
                  </div>
                </div>
              </button>

              {/* Option 2: Bluetooth Thermal Printer */}
              <button
                type="button"
                onClick={() => setSettings({ ...settings, printerType: 'bluetooth' })}
                className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                  settings.printerType === 'bluetooth'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Bluetooth
                    className={`w-5 h-5 ${
                      settings.printerType === 'bluetooth' ? 'text-blue-600' : 'text-slate-500'
                    }`}
                  />
                  {settings.printerType === 'bluetooth' && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">طابعة بلوتوث حرارية</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    اتصال مباشر بطابعات Bluetooth ESC/POS المتنقلة
                  </div>
                </div>
              </button>

              {/* Option 3: Network Printer */}
              <button
                type="button"
                onClick={() => setSettings({ ...settings, printerType: 'network' })}
                className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                  settings.printerType === 'network'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Network
                    className={`w-5 h-5 ${
                      settings.printerType === 'network' ? 'text-purple-600' : 'text-slate-500'
                    }`}
                  />
                  {settings.printerType === 'network' && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">طابعة شبكة (IP LAN/WiFi)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    إرسال لمنفذ الطباعة عبر الشبكة المحلية (Port 9100)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Configuration fields for selected type */}
          {settings.printerType === 'bluetooth' && (
            <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-950">طابعة البلوتوث المقترنة:</span>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    {settings.bluetoothDeviceName || 'لم يتم اقتران طابعة بعد'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={pairBluetooth}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>{settings.bluetoothDeviceName ? 'تغيير الطابعة' : 'اقتران طابعة بلوتوث'}</span>
                </button>
              </div>
              {!isBluetoothSupported && (
                <div className="p-2 bg-amber-100/80 rounded text-amber-900 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>تنبيه: متصفحك الحالي لا يدعم Web Bluetooth، سيتم استخدام طابعة النظام كبديل آمن.</span>
                </div>
              )}
            </div>
          )}

          {settings.printerType === 'network' && (
            <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200 space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-semibold text-purple-950 mb-1">
                    عنوان IP الطابعة (LAN/WiFi):
                  </label>
                  <input
                    type="text"
                    value={settings.networkIp || ''}
                    onChange={(e) => setSettings({ ...settings, networkIp: e.target.value })}
                    placeholder="192.168.1.200"
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-purple-950 mb-1">المنفذ (Port):</label>
                  <input
                    type="number"
                    value={settings.networkPort || 9100}
                    onChange={(e) =>
                      setSettings({ ...settings, networkPort: Number(e.target.value) || 9100 })
                    }
                    placeholder="9100"
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-white font-mono"
                  />
                </div>
              </div>
              <p className="text-[11px] text-purple-800">
                منفذ 9100 هو المنفذ القياسي لطابعات إيصالات الشبكة الحرارية (Epson, Bixolon, Xprinter).
              </p>
            </div>
          )}

          {/* Paper Width & Copies */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                عرض ورق الفاتورة الحرارية:
              </label>
              <select
                value={settings.paperWidth}
                onChange={(e) =>
                  setSettings({ ...settings, paperWidth: e.target.value as '80mm' | '58mm' })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="80mm">80 ملم (طابعات كاشير قياسية - عريض)</option>
                <option value="58mm">58 ملم (طابعات فواتير صغيرة متنقلة)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                عدد النسخ المطبوعة:
              </label>
              <select
                value={settings.printCopies}
                onChange={(e) =>
                  setSettings({ ...settings, printCopies: Number(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value={1}>نسخة واحدة (للعميل)</option>
                <option value={2}>نسختان (نسخة عميل + نسخة محاسبة/مطبخ)</option>
              </select>
            </div>
          </div>

          {/* Auto Print Toggle */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoPrintOnSale}
                onChange={(e) => setSettings({ ...settings, autoPrintOnSale: e.target.checked })}
                className="w-4 h-4 mt-0.5 accent-emerald-600 rounded cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  طباعة الفاتورة تلقائياً فور تأكيد البيع
                </span>
                <span className="text-[11px] text-slate-500">
                  إرسال أمر الطباعة إلى الطابعة الافتراضية مباشرة بعد إتمام الدفع دون الحاجة للنقر على زر الطباعة.
                </span>
              </div>
            </label>
          </div>

          {/* Test Print Result Banner */}
          {testResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{testResult}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={isTesting}
            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isTesting ? 'جاري الاختبار...' : 'طباعة صفحة تجريبية'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
            >
              حفظ كطابعة افتراضية
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
