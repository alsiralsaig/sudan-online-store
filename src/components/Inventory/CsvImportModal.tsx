import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle,
  X,
  FileText,
  Layers,
  ArrowRight,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import type { Branch, Product } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface CsvImportModalProps {
  branches: Branch[];
  currentBranch: Branch | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedCount: number) => void;
}

interface ParsedCsvRow {
  name: string;
  sellingPriceSdg: number;
  purchaseCost?: number;
  costCurrency?: string;
  initialStock?: number;
  minStockAlert?: number;
  sku?: string;
  barcode?: string;
  category?: string;
  unit?: string;
  isTaxExempt?: boolean;
  customTaxRate?: number;
  isValid: boolean;
  error?: string;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  branches,
  currentBranch,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    currentBranch?.id || branches[0]?.id || ''
  );
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    count: number;
    errors: string[];
  } | null>(null);
  const [activeInputMode, setActiveInputMode] = useState<'upload' | 'paste'>('upload');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const headers = [
      'اسم_المنتج',
      'سعر_البيع_ج_س',
      'سعر_الشراء_ج_س',
      'الكمية_الافتتاحية',
      'حد_إعادة_الطلب',
      'رمز_المنتج_SKU',
      'الباركود',
      'التصنيف',
      'الوحدة',
      'معفى_من_الضريبة',
    ];

    const sampleRows = [
      ['سكر كنانة 5 كجم', '24000', '19500', '50', '15', 'SKU-SUG-05', '628100123001', 'المواد التموينية والأساسية', 'كيس', '0'],
      ['زيت صباح 1 لتر', '8500', '6800', '40', '10', 'SKU-OIL-01', '628100123002', 'المواد التموينية والأساسية', 'قارورة', '0'],
      ['دقيق سيقا فاخر 10 كجم', '38000', '31000', '30', '8', 'SKU-FLR-10', '628100123003', 'المواد التموينية والأساسية', 'شوال', '0'],
      ['شاي الغزالتين 400 جم', '9200', '7400', '60', '12', 'SKU-TEA-400', '628100123004', 'المشروبات والمنبهات', 'علبة', '0'],
      ['صلصة البستان علبة', '2800', '2100', '100', '25', 'SKU-BST-01', '628100123005', 'المعلبات والمحفوظات', 'علبة', '0'],
      ['صابون صفا لغسيل الأواني', '1800', '1350', '80', '20', 'SKU-SOAP-01', '628100123006', 'المنظفات والعناية المنزلية', 'قطعة', '0'],
    ];

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...sampleRows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join(
        '\r\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'نموذج_استيراد_المنتجات_منصة_سند.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CSV Text Parsing Logic
  const parseCsvText = (text: string) => {
    setIsParsing(true);
    setImportResult(null);

    try {
      const cleanText = text.replace(/^\uFEFF/, '').trim();
      if (!cleanText) {
        setParsedRows([]);
        setIsParsing(false);
        return;
      }

      // Split into lines
      const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        setParsedRows([]);
        setIsParsing(false);
        return;
      }

      // Helper to split a CSV line respecting quotes
      const splitLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        const separator = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === separator && !inQuotes) {
            result.push(cur.trim().replace(/^["']|["']$/g, ''));
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim().replace(/^["']|["']$/g, ''));
        return result;
      };

      const headerLine = splitLine(lines[0]).map((h) => h.toLowerCase().trim());

      // Header map matcher for Arabic and English headers
      const getColIndex = (...candidates: string[]) => {
        return headerLine.findIndex((h) =>
          candidates.some((c) => h.includes(c.toLowerCase()) || h === c.toLowerCase())
        );
      };

      const nameIdx = getColIndex('اسم_المنتج', 'اسم المنتج', 'name', 'product', 'المنتج', 'item');
      const sellPriceIdx = getColIndex(
        'سعر_البيع',
        'سعر البيع',
        'sellingprice',
        'price',
        'السعر',
        'بيع'
      );
      const buyCostIdx = getColIndex(
        'سعر_الشراء',
        'سعر الشراء',
        'purchasecost',
        'cost',
        'تكلفة',
        'شراء'
      );
      const stockIdx = getColIndex(
        'الكمية_الافتتاحية',
        'الكمية الافتتاحية',
        'stock',
        'initialstock',
        'الكمية',
        'رصيد',
        'الرصيد'
      );
      const minAlertIdx = getColIndex(
        'حد_إعادة_الطلب',
        'حد إعادة الطلب',
        'حد_الطلب',
        'minstock',
        'reorder',
        'alert',
        'الحد الأدنى'
      );
      const skuIdx = getColIndex('رمز_المنتج', 'sku', 'كود');
      const barcodeIdx = getColIndex('الباركود', 'barcode', 'باركود');
      const categoryIdx = getColIndex('التصنيف', 'category', 'الفئة', 'قسم');
      const unitIdx = getColIndex('الوحدة', 'unit', 'وحدة');
      const exemptIdx = getColIndex('معفى', 'taxexempt', 'ضريبة');

      const parsed: ParsedCsvRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = splitLine(lines[i]);
        if (cols.length === 0 || cols.every((c) => !c.trim())) continue;

        const name = nameIdx !== -1 ? cols[nameIdx] || '' : cols[0] || '';
        const sellPriceStr =
          sellPriceIdx !== -1 ? cols[sellPriceIdx] || '' : cols[1] || '';
        const buyCostStr = buyCostIdx !== -1 ? cols[buyCostIdx] || '' : '';
        const stockStr = stockIdx !== -1 ? cols[stockIdx] || '' : '';
        const minAlertStr = minAlertIdx !== -1 ? cols[minAlertIdx] || '' : '';
        const sku = skuIdx !== -1 ? cols[skuIdx] || '' : '';
        const barcode = barcodeIdx !== -1 ? cols[barcodeIdx] || '' : '';
        const category = categoryIdx !== -1 ? cols[categoryIdx] || '' : 'المواد التموينية والأساسية';
        const unit = unitIdx !== -1 ? cols[unitIdx] || '' : 'حبة';
        const exemptStr = exemptIdx !== -1 ? cols[exemptIdx] || '' : '0';

        const sellingPrice = parseFloat(sellPriceStr.replace(/[^0-9.]/g, ''));
        const purchaseCost = parseFloat(buyCostStr.replace(/[^0-9.]/g, '')) || 0;
        const initialStock = parseFloat(stockStr.replace(/[^0-9.]/g, '')) || 0;
        const minStockAlert = parseFloat(minAlertStr.replace(/[^0-9.]/g, '')) || 5;
        const isTaxExempt = exemptStr === '1' || exemptStr.toLowerCase() === 'true' || exemptStr === 'نعم';

        let isValid = true;
        let error = '';

        if (!name.trim()) {
          isValid = false;
          error = 'اسم المنتج مطلوب';
        } else if (isNaN(sellingPrice) || sellingPrice <= 0) {
          isValid = false;
          error = 'سعر البيع يجب أن يكون رقماً أكبر من صفر';
        }

        parsed.push({
          name: name.trim(),
          sellingPriceSdg: isNaN(sellingPrice) ? 0 : sellingPrice,
          purchaseCost: isNaN(purchaseCost) ? 0 : purchaseCost,
          costCurrency: 'SDG',
          initialStock: isNaN(initialStock) ? 0 : initialStock,
          minStockAlert: isNaN(minStockAlert) ? 5 : minStockAlert,
          sku: sku.trim(),
          barcode: barcode.trim(),
          category: category.trim() || 'المواد التموينية والأساسية',
          unit: unit.trim() || 'حبة',
          isTaxExempt,
          isValid,
          error,
        });
      }

      setParsedRows(parsed);
    } catch (err: any) {
      console.error('Error parsing CSV:', err);
    } finally {
      setIsParsing(false);
    }
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawText(text);
        parseCsvText(text);
      };
      reader.readAsText(selected, 'UTF-8');
    }
  };

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawText(text);
        parseCsvText(text);
      };
      reader.readAsText(droppedFile, 'UTF-8');
    }
  };

  // Execute Import
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const payload = validRows.map((r) => ({
        name: r.name,
        sellingPriceSdg: r.sellingPriceSdg,
        purchaseCost: r.purchaseCost,
        costCurrency: r.costCurrency || 'SDG',
        initialStock: r.initialStock,
        minStockAlert: r.minStockAlert,
        sku: r.sku,
        barcode: r.barcode,
        category: r.category,
        unit: r.unit,
        isTaxExempt: r.isTaxExempt,
      }));

      const res = await api.importProductsCsv(selectedBranchId, payload);

      if (res.success) {
        setImportResult({
          success: true,
          count: res.importedCount,
          errors: res.errors || [],
        });
        onSuccess(res.importedCount);
      } else {
        setImportResult({
          success: false,
          count: 0,
          errors: res.errors || ['فشل استيراد المنتجات من الخادم'],
        });
      }
    } catch (err: any) {
      setImportResult({
        success: false,
        count: 0,
        errors: [err.message || 'حدث خطأ أثناء رفع بيانات الملف'],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;
  const totalStockSum = parsedRows.reduce((acc, r) => acc + (r.initialStock || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                استيراد المنتجات والمخزون عبر ملف CSV
              </h3>
              <p className="text-xs text-slate-300">
                تسريع بدء العمل للمتاجر الجديدة برفع قوائم الأصناف والأسعار والأرصدة الأولية دفعة واحدة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1 & 2: Quick Template Download & Branch Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Download Template Box */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-600" />
                  قالب ملف CSV النموذجي
                </span>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  يحتوي على الأعمدة القياسية وعينات سلع سودانية حقيقية جاهزة للتعديل عليها مباشرة.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل القالب</span>
              </button>
            </div>

            {/* Target Branch Selector */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                الفرع المورّد إليه الرصيد الافتتاحي:
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city}) {b.isMain ? '• الرئيسي' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                سيتم قيد الكميات الافتتاحية للمنتجات المستوردة في مخزون هذا الفرع تلقائياً.
              </p>
            </div>
          </div>

          {/* Mode Switcher: Upload File or Direct Paste */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveInputMode('upload')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeInputMode === 'upload'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>رفع ملف CSV من الجهاز</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveInputMode('paste')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeInputMode === 'paste'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>لصق نص CSV يدوياً</span>
            </button>
          </div>

          {/* Input Method Content */}
          {activeInputMode === 'upload' ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {file ? file.name : 'اضغط لاختيار ملف CSV أو اسحبه وأفلته هنا'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  يدعم الملفات المشفرة بصيغة UTF-8 مع الفواصل العادية (Commas) أو المنقوطة (Semicolons)
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">
                الصق محتوى جدول Excel أو ملف CSV هنا (السطر الأول للعناوين):
              </label>
              <textarea
                rows={5}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  parseCsvText(e.target.value);
                }}
                placeholder="اسم_المنتج,سعر_البيع_ج_س,سعر_الشراء_ج_س,الكمية_الافتتاحية,حد_إعادة_الطلب&#10;سكر كنانة,24000,19500,50,15&#10;زيت صباح 1 لتر,8500,6800,40,10"
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          )}

          {/* Summary Stats after parsing */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-3 rounded-xl text-xs font-semibold">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-slate-800">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>جاهز للاستيراد:</span>
                    <strong className="text-emerald-700 font-bold">{validCount} صنف</strong>
                  </span>
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1.5 text-rose-700">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>غير صالح:</span>
                      <strong className="font-bold">{invalidCount} صفوف</strong>
                    </span>
                  )}
                  <span className="text-slate-600 hidden sm:inline">
                    • إجمالي الأرصدة الافتتاحية: <strong>{totalStockSum.toLocaleString()} وحدة</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => parseCsvText(rawText)}
                  className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>إعادة الفحص</span>
                </button>
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">اسم المنتج</th>
                      <th className="p-2.5">سعر البيع</th>
                      <th className="p-2.5">سعر الشراء</th>
                      <th className="p-2.5">الرصيد الأولي</th>
                      <th className="p-2.5">حد إعادة الطلب</th>
                      <th className="p-2.5">التصنيف</th>
                      <th className="p-2.5">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50 hover:bg-rose-50'}
                      >
                        <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-bold">
                          {row.name || <span className="text-rose-500 italic">مفقود</span>}
                          {row.sku && (
                            <span className="block text-[10px] text-slate-400 font-mono">
                              {row.sku}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-emerald-700">
                          {row.sellingPriceSdg.toLocaleString()} ج.س
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">
                          {row.purchaseCost?.toLocaleString() || 0} ج.س
                        </td>
                        <td className="p-2.5 font-mono font-bold text-blue-700">
                          {row.initialStock || 0} {row.unit}
                        </td>
                        <td className="p-2.5 font-mono text-amber-700">
                          {row.minStockAlert || 5}
                        </td>
                        <td className="p-2.5 text-slate-500 text-[11px]">{row.category}</td>
                        <td className="p-2.5">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              صالح
                            </span>
                          ) : (
                            <span
                              title={row.error}
                              className="inline-flex items-center gap-1 text-[11px] text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full font-semibold"
                            >
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              {row.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Result Notification */}
          {importResult && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                importResult.success
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}
            >
              {importResult.success ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-bold">
                  {importResult.success
                    ? `تم بنجاح استيراد وتحديث (${importResult.count}) منتج في المخزون!`
                    : 'حدثت بعض الأخطاء أثناء الاستيراد:'}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-700">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {validCount > 0 ? (
              <span>
                سيتم استيراد <strong>{validCount}</strong> منتج إلى قاعدة البيانات
              </span>
            ) : (
              <span>يرجى اختيار أو لصق ملف CSV لبدء المعاينة</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={validCount === 0 || isImporting}
              onClick={handleExecuteImport}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الاستيراد...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>تأكيد واستيراد ({validCount}) منتج</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
