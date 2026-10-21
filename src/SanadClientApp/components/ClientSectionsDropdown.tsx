import React, { useEffect, useRef } from 'react';
import { Store, Star, BookOpen, Gavel, ChevronLeft, Layers } from 'lucide-react';

interface ClientSectionsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSection: (sectionKey: string) => void;
  /** Which edge of the trigger to align with (RTL default: right). */
  align?: 'right' | 'left';
}

const SECTIONS = [
  {
    key: 'showrooms_shops',
    title: 'المعارض و المحلات',
    subtitle: 'تصفح المعارض والمحلات المسجلة',
    icon: Store,
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  {
    key: 'celebrity_stores',
    title: 'متاجر المشاهير',
    subtitle: 'متاجر المشاهير والمنتجات الخاصة بهم',
    icon: Star,
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    key: 'business_directory',
    title: 'الدليل التجاري',
    subtitle: 'الشركات والخدمات التجارية الموثقة',
    icon: BookOpen,
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    key: 'auctions',
    title: 'المزادات',
    subtitle: 'مزادات المستخدمين والعروض النشطة',
    icon: Gavel,
    tone: 'bg-teal-50 text-teal-800 border-teal-200',
  },
];

/**
 * Sections menu that drops *under* the «أقسام» pill (no full-screen sheet),
 * the way the reference landing page behaves: the page behind stays visible.
 */
export const ClientSectionsDropdown: React.FC<ClientSectionsDropdownProps> = ({
  isOpen,
  onClose,
  onSelectSection,
  align = 'right',
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Escape closes the menu (mobile keyboards/back gestures friendly)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Transparent catcher: tapping anywhere outside closes the menu */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        dir="rtl"
        role="menu"
        className={`absolute top-full mt-1.5 z-50 w-[min(19rem,calc(100vw-1.5rem))] ${
          align === 'right' ? 'right-0' : 'left-0'
        } bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/15 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150`}
      >
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-700" />
          <span className="text-[11px] font-black text-slate-700">اختر القسم</span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto overscroll-contain divide-y divide-slate-100">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            return (
              <button
                key={sec.key}
                role="menuitem"
                onClick={() => {
                  onSelectSection(sec.key);
                  onClose();
                }}
                className="w-full px-3 py-2.5 flex items-center justify-between gap-2.5 text-right hover:bg-emerald-50/60 active:bg-emerald-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="flex-1 min-w-0 text-right">
                  <span className="block text-[12.5px] font-bold text-slate-900 leading-tight">
                    {sec.title}
                  </span>
                  <span className="block text-[10.5px] text-slate-500 truncate">
                    {sec.subtitle}
                  </span>
                </span>
                <span
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${sec.tone}`}
                >
                  <Icon className="w-4 h-4" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
