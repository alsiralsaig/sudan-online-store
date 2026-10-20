import React, { useState } from "react";
import {
  X,
  Smartphone,
  CheckCircle,
  Sparkles,
  ShoppingBag,
  Store,
  Building,
  ShieldCheck,
  Zap,
  ArrowRight,
  MoreVertical,
  PlusSquare,
  Share,
} from "lucide-react";
import { usePwaInstall } from "../../lib/usePwaInstall.ts";
import type { PlatformAppMode } from "./SanadAppModeBar.tsx";

interface SanadAppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode?: PlatformAppMode;
  onSwitchMode?: (mode: PlatformAppMode) => void;
}

export const SanadAppDownloadModal: React.FC<SanadAppDownloadModalProps> = ({
  isOpen,
  onClose,
  currentMode = "client",
  onSwitchMode,
}) => {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [selectedApp, setSelectedApp] = useState<PlatformAppMode>(currentMode);
  const [hasPrompted, setHasPrompted] = useState(false);

  if (!isOpen) return null;

  const appsInfo = {
    client: {
      title: "تطبيق الجمهور والزبائن (متجر سند)",
      shortTitle: "متجر سند",
      desc: "تصفح المنتجات، سلة الشراء، نشر إعلانات السوق، وطلبات الشراء من المتاجر.",
      themeColor: "from-emerald-700 to-teal-800",
      icon: ShoppingBag,
    },
    merchant: {
      title: "تطبيق التاجر ونقاط البيع (كاشير سند)",
      shortTitle: "كاشير سند",
      desc: "نقطة بيع سحابية، دعم أوفلاين دون إنترنت، تحصيل العملات الأجنبية، والمخزون.",
      themeColor: "from-slate-900 to-emerald-950",
      icon: Store,
    },
    super_admin: {
      title: "رابط المنصة الإداري (إدارة سند)",
      shortTitle: "إدارة سند",
      desc: "إدارة كافة المتاجر والتجار والاشتراكات وأسعار الصرف المركزية.",
      themeColor: "from-amber-600 to-slate-900",
      icon: Building,
    },
  };

  const currentAppMeta = appsInfo[selectedApp];
  const AppIcon = currentAppMeta.icon;

  const handleInstallClick = async () => {
    if (onSwitchMode && selectedApp !== currentMode) {
      onSwitchMode(selectedApp);
    }
    setHasPrompted(true);
    await promptInstall();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-100">
        {/* Header */}
        <div className={`p-5 bg-gradient-to-r ${currentAppMeta.themeColor} text-white flex items-center justify-between relative`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-md">
              <AppIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">تثبيت التطبيق على جوالك</h3>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full font-mono">
                  فوري ومجاني
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">
                تنزيل «{currentAppMeta.shortTitle}» كأيقونة تطبيق كاملة على الشاشة الرئيسية
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-right">
          {/* 1. App Selection Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              اختر التطبيق المراد تثبيته:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["client", "merchant", "super_admin"] as PlatformAppMode[]).map((mode) => {
                const info = appsInfo[mode];
                const Icon = info.icon;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setSelectedApp(mode);
                      if (onSwitchMode && mode !== currentMode) {
                        onSwitchMode(mode);
                      }
                    }}
                    className={`p-2.5 rounded-2xl border text-right transition-all flex flex-col items-center gap-1.5 ${
                      selectedApp === mode
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 font-bold"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    }`}
                  >
                    <Icon className="w-5 h-5 text-emerald-700" />
                    <span className="text-xs">{info.shortTitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 space-y-3 text-center">
            <h4 className="text-sm font-black text-emerald-950">
              اضغط الزر الأخضر لتثبيت التطبيق فوراً على هاتفك:
            </h4>

            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 hover:from-emerald-500 hover:to-teal-700 text-white font-extrabold rounded-2xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 transform active:scale-95 cursor-pointer"
            >
              <Smartphone className="w-5 h-5" />
              <span>تثبيت «{currentAppMeta.shortTitle}» الآن على جوالي 📲</span>
            </button>

            {hasPrompted && (
              <p className="text-xs text-emerald-800 font-bold animate-pulse">
                ✓ إذا ظهرت لك نافذة التثبيت في الشاشة اضغط "تثبيت" أو "إضافة".
              </p>
            )}
          </div>

          {/* Super Clear 2-Step Android Instructions */}
          
          {/* Direct ZIP Package Download */}
          <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <strong className="text-xs font-bold text-slate-900 block">ملف حزمة التثبيت المباشر (ZIP)</strong>
              <p className="text-[11px] text-slate-500">يحتوي على ملفات التشغيل والروابط المباشرة لهاتفك</p>
            </div>
            <a
              href="/downloads/sanad-apps-installers.zip"
              download="sanad-apps-installers.zip"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>تحميل الحزمة (ZIP) 💾</span>
            </a>
          </div>

          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>إذا لم يظهر التثبيت التلقائي، اتبع هاتين الخطوتين البسيطتين:</span>
            </h4>

            {/* Step 1 */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0">
                1
              </div>
              <div className="text-xs text-slate-700 leading-relaxed">
                اضغط على زر <strong>الثلاث نقاط (⋮)</strong> الموجود في أعلى زاوية متصفح كروم على جوالك.
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-sm shrink-0">
                2
              </div>
              <div className="text-xs text-emerald-950 leading-relaxed">
                اختر من القائمة: <strong>«تثبيت التطبيق» (Install app)</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.
              </div>
            </div>

            {/* Result */}
            <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
              <div className="text-xs text-teal-900 leading-relaxed">
                <strong>النتيجة:</strong> سينزل التطبيق فوراً كأيقونة مستقلة على شاشة هاتفك، يفتح بملء الشاشة، ويعمل أوفلاين دون إنترنت تماماً مثل أي تطبيق عادي!
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>متوافق 100% مع أندرويد وسامسونج وشاومي وهواوي وآيفون</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold"
          >
            فهمت، إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
