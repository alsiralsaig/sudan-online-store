import React, { useState } from "react";
import {
  Smartphone,
  Download,
} from "lucide-react";
import { SanadLogo } from "./SanadLogo.tsx";
import { SanadAppIcon } from "./SanadAppIcon.tsx";
import { SanadAppDownloadModal } from "./SanadAppDownloadModal.tsx";

export type PlatformAppMode = "client" | "merchant" | "super_admin";

interface SanadAppModeBarProps {
  currentApp: PlatformAppMode;
  onSwitchApp: (app: PlatformAppMode) => void;
  tenantName?: string;
  branchName?: string;
}

export const SanadAppModeBar: React.FC<SanadAppModeBarProps> = ({
  currentApp,
  onSwitchApp,
  tenantName = "منصة سند",
  branchName = "الفرع الرئيسي",
}) => {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  return (
    <>
      <div className="app-mode-bar bg-slate-950 text-white text-xs border-b border-slate-800 px-3 sm:px-6 py-2 select-none" dir="rtl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
          {/* Brand & Active Context */}
          <div className="flex items-center gap-3">
            <SanadLogo size="xs" theme="dark" variant="compact" />
            <span className="text-slate-600 hidden sm:inline">|</span>
            <div className="text-[11px] text-slate-300 flex items-center gap-1.5 min-w-0">
              {currentApp === "super_admin" ? (
                <>
                  <span className="text-slate-400">المنظومة السحابية الموحدة:</span>
                  <span className="font-bold text-amber-400">منصة سند</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-200">الإدارة المركزية</span>
                </>
              ) : (
                <>
                  <span className="text-slate-400 hidden sm:inline">المنظومة السحابية الموحدة:</span>
                  <span className="font-bold text-emerald-400 break-words">
                    {tenantName || "منصة سند"}
                  </span>
                  {branchName ? (
                    <>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-300">{branchName}</span>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* 3-App Navigation Switcher */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {/* App 1: تطبيق الجمهور والزبائن */}
              <button
                onClick={() => onSwitchApp("client")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentApp === "client"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <SanadAppIcon app="client" size="xs" />
                <span>السند</span>
              </button>

              {/* App 2: تطبيق التاجر المشترك */}
              <button
                onClick={() => onSwitchApp("merchant")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentApp === "merchant"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <SanadAppIcon app="merchant" size="xs" />
                <span>تاجر السند</span>
              </button>

              {/* App 3: رابط المنصة الإداري */}
              <button
                onClick={() => onSwitchApp("super_admin")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentApp === "super_admin"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <SanadAppIcon app="super_admin" size="xs" />
                <span>إدارة السند</span>
              </button>
            </div>

            {/* Install / APK Download Trigger */}
            <button
              onClick={() => setIsDownloadModalOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 animate-pulse"
              title="تثبيت التطبيق مباشرة على شاشة الهاتف"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>تثبيت التطبيق على الجوال 📲</span>
            </button>
          </div>
        </div>
      </div>

      <SanadAppDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        currentMode={currentApp}
        onSwitchMode={onSwitchApp}
      />
    </>
  );
};
