import React from 'react';
import {
  X,
  Store,
  Star,
  BookOpen,
  Gavel,
  ChevronLeft,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ClientSectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSection: (sectionKey: string) => void;
}

export const ClientSectionsModal: React.FC<ClientSectionsModalProps> = ({
  isOpen,
  onClose,
  onSelectSection,
}) => {
  if (!isOpen) return null;

  const sections = [
    {
      key: 'showrooms_shops',
      title: 'المعارض و المحلات',
      subtitle: 'تصفح المعارض والمحلات المسجلة',
      icon: Store,
      badgeColor: 'bg-emerald-50 text-emerald-800',
    },
    {
      key: 'celebrity_stores',
      title: 'متاجر المشاهير',
      subtitle: 'متاجر المشاهير والمنتجات الخاصة بهم',
      icon: Star,
      badgeColor: 'bg-slate-100 text-slate-800',
    },
    {
      key: 'business_directory',
      title: 'الدليل التجاري',
      subtitle: 'الشركات والخدمات التجارية الموثقة',
      icon: BookOpen,
      badgeColor: 'bg-emerald-950/10 text-emerald-900',
    },
    {
      key: 'auctions',
      title: 'المزادات',
      subtitle: 'تصفح مزادات المستخدمين والعروض النشطة',
      icon: Gavel,
      badgeColor: 'bg-teal-50 text-teal-800',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-6 animate-in slide-in-from-bottom duration-300 border border-slate-100"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center flex-1 pr-2">
            <h3 className="text-xl font-extrabold text-emerald-950">الأقسام</h3>
            <p className="text-xs text-slate-500 font-medium">اختر القسم الذي تريد الدخول إليه</p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-emerald-900 text-white flex items-center justify-center shadow-md">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Section Cards */}
        <div className="space-y-3">
          {sections.map((sec) => {
            const Icon = sec.icon;
            return (
              <button
                key={sec.key}
                onClick={() => {
                  onSelectSection(sec.key);
                  onClose();
                }}
                className="w-full p-4 rounded-2xl border border-slate-200 hover:border-emerald-600 bg-white hover:bg-emerald-50/40 text-right transition-all flex items-center justify-between gap-4 group shadow-2xs"
              >
                <div className="text-slate-400 group-hover:text-emerald-700 transition-colors">
                  <ChevronLeft className="w-5 h-5 rtl:-scale-x-100" />
                </div>

                <div className="flex items-center gap-3.5 flex-1 justify-end">
                  <div className="text-right">
                    <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-950">
                      {sec.title}
                    </h4>
                    <p className="text-xs text-slate-500">{sec.subtitle}</p>
                  </div>

                  <div
                    className={`w-11 h-11 rounded-2xl ${sec.badgeColor} flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom indicator hint */}
        <div className="pt-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>منصة سند الموحدة · تدعم جميع المحلات والمعارض والمزادات في السودان</span>
        </div>
      </div>
    </div>
  );
};
