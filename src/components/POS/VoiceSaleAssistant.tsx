import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, X, CheckCircle2, AlertTriangle, Sparkles, Plus, Minus, Keyboard, Trash2 } from 'lucide-react';
import type { Product } from '../../types/index.ts';
import { parseSudaneseSale, type ParsedLine } from '../../lib/sudaneseSpeech.ts';
import { priceForUnit, unitsForProduct } from '../../lib/sudaneseUnits.ts';

/**
 * البيع بالصوت — اللهجة السودانية.
 *
 * المحرك منقول من مشروع «حساباتي السودان» ويعمل محلياً بدون إنترنت.
 * لو المتصفح ما يدعم التعرف على الصوت العربي (كثير من أجهزة أندرويد)،
 * يظل الكاشير يكتب نفس الجملة في الخانة اليدوية وتشتغل بنفس المحرك.
 */

interface VoiceSaleAssistantProps {
  products: Product[];
  onClose: () => void;
  onApply: (
    items: { product: Product; quantity: number; unitPrice: number; note: string }[]
  ) => void;
}

interface DraftLine extends ParsedLine {
  key: string;
}

const EXAMPLES = [
  'بعت اتنين كيلو سكر ورطل شاي',
  'تلاتة دستة صابون وجوال دقيق',
  'خمسة علبة لبن وخصم 2000',
  'كيلو ونص عدس بنكك',
];

export const VoiceSaleAssistant: React.FC<VoiceSaleAssistantProps> = ({
  products,
  onClose,
  onApply,
}) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [draftText, setDraftText] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [clarifications, setClarifications] = useState<
    { phrase: string; reason: string; suggestions: Product[] }[]
  >([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(true);
  const recognitionRef = useRef<any>(null);

  // الحقول المطابقة للوحدات المتاحة لكل سطر
  const unitOptionsFor = (product: Product) => unitsForProduct(product.unit);

  const analyze = (text: string) => {
    const value = (text || '').trim();
    if (!value) {
      setError('اكتب أو قُول جملة البيع أولاً.');
      return;
    }
    setError(null);
    const result = parseSudaneseSale(value, products);
    setLines(
      result.lines.map((l, i) => ({ ...l, key: `${l.product?.id || 'x'}-${i}-${Date.now()}` }))
    );
    setClarifications(result.clarifications);
    setSummary(result.summary);
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('المتصفح ده ما يدعم التعرف على الصوت — اكتب الجملة في الخانة تحت.');
      setManualOpen(true);
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'ar-SD';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (event: any) => {
        let finalText = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const res = event.results[i];
          if (res.isFinal) finalText += res[0].transcript;
          else interim += res[0].transcript;
        }
        if (finalText) {
          setTranscript(finalText.trim());
          setDraftText(finalText.trim());
        } else if (interim) {
          setTranscript(interim);
        }
      };
      rec.onerror = (e: any) => {
        setListening(false);
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          setError('المتصفح رفض إذن المايك — اسمح بالمايك للموقع أو اكتب الجملة.');
        } else if (e?.error === 'no-speech') {
          setError('ما سمعنا صوتاً — جرّب تاني أو اكتب الجملة.');
        } else {
          setError('تعذّر التعرف على الصوت — اكتب الجملة في الخانة اليدوية.');
        }
        setManualOpen(true);
      };
      rec.onend = () => {
        setListening(false);
        setTranscript((t) => t);
      };
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
      setError(null);
    } catch {
      setError('تعذّر تشغيل المايك — اكتب الجملة في الخانة اليدوية.');
      setManualOpen(true);
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      /* تجاهل */
    }
    setListening(false);
  };

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* تجاهل */
      }
    };
  }, []);

  const updateQty = (key: string, delta: number) => {
    setLines((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, quantity: Math.max(0.125, Math.round((l.quantity + delta) * 1000) / 1000) } : l
      )
    );
  };

  const updateUnit = (key: string, unitId: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key || !l.product) return l;
        const priced = priceForUnit(l.product.sellingPriceSdg, l.product.unit, unitId, l.quantity);
        return {
          ...l,
          unitId,
          unitName: unitId === 'kg' ? 'كجم' : l.unitName,
          unitPrice: priced.ok ? priced.unitPrice : l.unitPrice,
          note: priced.explanation,
        };
      })
    );
  };

  /** إضافة صنف من اقتراحات التوضيح بسطر يدوي */
  const addSuggestion = (product: Product) => {
    setLines((prev) => [
      ...prev,
      {
        key: `${product.id}-manual-${Date.now()}`,
        product,
        spokenName: product.name,
        quantity: 1,
        unitId: 'piece',
        unitName: product.unit,
        unitPrice: product.sellingPriceSdg,
        confidence: 1,
        note: 'أُضيف يدوياً من الاقتراحات',
      },
    ]);
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + (l.unitPrice || 0) * (l.quantity || 0), 0),
    [lines]
  );

  const apply = () => {
    const items = lines
      .filter((l) => l.product && l.quantity > 0)
      .map((l) => ({
        product: l.product as Product,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        note: `${l.quantity} ${l.unitName} — ${l.note}`,
      }));
    if (!items.length) {
      setError('ما في أصناف جاهزة للإضافة.');
      return;
    }
    onApply(items);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" dir="rtl">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">
        {/* الرأس */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-3xl bg-slate-900 px-5 py-3.5 text-white">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black leading-tight">البيع بالصوت — باللهجة السودانية</h3>
              <p className="text-[10px] text-slate-400">يشتغل بدون إنترنت · الأسعار من مخزونك فقط</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 p-1.5 text-slate-300 hover:bg-white/20"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {/* زر المايك */}
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <button
              onClick={listening ? stopListening : startListening}
              className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition-all ${
                listening ? 'bg-rose-600 shadow-lg shadow-rose-300' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
              title={listening ? 'إيقاف الاستماع' : 'ابدأ الكلام'}
            >
              {listening && (
                <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/40" />
              )}
              {listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-800">
                {listening ? 'جاري الاستماع… اتكلم عادي' : 'اضغط المايك وقول الطلب'}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {transcript || 'مثال: «بعت اتنين كيلو سكر ورطل شاي»'}
              </p>
            </div>
            {transcript && !listening && (
              <button
                onClick={() => analyze(transcript)}
                className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-black text-white"
              >
                حلّل
              </button>
            )}
          </div>

          {/* الإدخال اليدوي — دايماً متاح */}
          <div className="rounded-2xl border border-slate-200 p-3">
            <button
              onClick={() => setManualOpen((v) => !v)}
              className="flex w-full items-center justify-between text-[11px] font-black text-slate-700"
            >
              <span className="flex items-center gap-1.5">
                <Keyboard className="h-3.5 w-3.5" />
                أو اكتب الجملة يدوياً
              </span>
              <span className="text-slate-400">{manualOpen ? '—' : '+'}</span>
            </button>

            {manualOpen && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={2}
                  placeholder="بعت اتنين كيلو سكر ورطل شاي وخصم 500"
                  className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setDraftText(ex)}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => analyze(draftText)}
                  className="w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white hover:bg-emerald-800"
                >
                  حلّل الجملة
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">{error}</p>
          )}

          {/* السطور المتعرَّف عليها */}
          {lines.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-800">الأصناف ({lines.length})</span>
                <span className="text-[11px] font-black text-emerald-700">
                  {Math.round(total).toLocaleString()} ج.س
                </span>
              </div>

              {lines.map((line) => (
                <div key={line.key} className="rounded-2xl border border-slate-200 bg-white p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">{line.product?.name}</p>
                      <p className="truncate text-[10px] text-slate-500">{line.note}</p>
                    </div>
                    <button
                      onClick={() => removeLine(line.key)}
                      className="shrink-0 rounded-lg bg-rose-50 p-1.5 text-rose-700"
                      title="حذف السطر"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-xl border border-slate-200">
                      <button
                        onClick={() => updateQty(line.key, -1)}
                        className="p-1.5 text-slate-600 hover:bg-slate-50"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[2.5rem] text-center text-xs font-black text-slate-900">
                        {line.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(line.key, 1)}
                        className="p-1.5 text-slate-600 hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {line.product && (
                      <select
                        value={line.unitId}
                        onChange={(e) => updateUnit(line.key, e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-800 focus:outline-none"
                      >
                        {unitOptionsFor(line.product).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.symbolAr}
                          </option>
                        ))}
                      </select>
                    )}

                    <span className="text-xs font-black text-slate-900">
                      {Math.round(line.unitPrice * line.quantity).toLocaleString()} ج.س
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* التوضيحات */}
          {clarifications.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5" />
                محتاج توضيح ({clarifications.length})
              </div>
              {clarifications.map((c, i) => (
                <div key={i} className="rounded-xl bg-white/70 p-2">
                  <p className="text-[11px] font-bold text-slate-800">«{c.phrase}»</p>
                  <p className="text-[10px] text-slate-600">{c.reason}</p>
                  {c.suggestions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.suggestions.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => addSuggestion(p)}
                          className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700"
                        >
                          + {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {summary && lines.length === 0 && clarifications.length === 0 && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-700">{summary}</p>
          )}
        </div>

        {/* التذييل */}
        <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white p-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-700"
          >
            إلغاء
          </button>
          <button
            onClick={apply}
            disabled={!lines.length}
            className="flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            أضف {lines.length || ''} للسلة · {Math.round(total).toLocaleString()} ج.س
          </button>
        </div>
      </div>
    </div>
  );
};
