import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Smartphone,
  ScanBarcode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  FileText,
  Share2,
  Printer,
  Search,
  Filter,
  Check,
  Plus,
  Minus,
  Save,
  Eye,
  Play,
  Volume2,
  VolumeX,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Hash,
  Clock,
  User,
  Building,
  SlidersHorizontal,
  ChevronDown,
  Lock,
  Flame,
} from 'lucide-react';
import type {
  Product,
  Branch,
  InventoryAudit,
  InventoryAuditItem,
  InventoryDiscrepancyStatus,
} from '../../types/index.ts';
import { CameraBarcodeScanner } from '../POS/CameraBarcodeScanner.tsx';
import { api } from '../../lib/api.ts';
import { barcodesMatch, findByBarcodeOrSku, normalizeBarcode } from '../../lib/barcodeMatch.ts';

interface InventoryAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch | null;
  branches: Branch[];
  products: Product[];
  onAuditCompleted: () => void;
}

export const InventoryAuditModal: React.FC<InventoryAuditModalProps> = ({
  isOpen,
  onClose,
  branch,
  branches,
  products,
  onAuditCompleted,
}) => {
  // Current active audit session
  const [activeAudit, setActiveAudit] = useState<InventoryAudit | null>(null);
  const [auditList, setAuditList] = useState<InventoryAudit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // View state: 'list' (manage sessions) | 'audit' (performing audit) | 'reconcile_confirm' | 'report_preview'
  const [viewMode, setViewMode] = useState<'list' | 'audit' | 'reconcile_confirm' | 'report_preview'>('list');

  // Mobile layout switch: 'phone' (optimized for handheld phone) vs 'table' (expanded desktop table)
  const [layoutMode, setLayoutMode] = useState<'phone' | 'table'>('phone');

  // New session modal options
  const [isNewAuditModalOpen, setIsNewAuditModalOpen] = useState(false);
  const [newAuditTitle, setNewAuditTitle] = useState('');
  const [newAuditBranchId, setNewAuditBranchId] = useState(branch?.id || branches[0]?.id || '');
  const [newAuditScope, setNewAuditScope] = useState<'all' | 'category'>('all');
  const [newAuditCategory, setNewAuditCategory] = useState('الكل');

  // Search, filter & scanning states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDiscrepancy, setFilterDiscrepancy] = useState<
    'all' | 'uncounted' | 'discrepancy' | 'deficit' | 'surplus' | 'matched'
  >('all');
  const [filterCategory, setFilterCategory] = useState('الكل');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Barcode Scanning / Camera simulator
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  // Selected item in phone focus mode
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  // Audio synthesizer chime
  const playSound = (type: 'beep' | 'success' | 'alert' = 'beep') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'beep') {
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
        osc.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.08); // E6
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } else {
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }

      if (navigator.vibrate) {
        navigator.vibrate(35);
      }
    } catch {
      // Browser autoplay policy ignore
    }
  };

  // Categories list
  const categories = useMemo(() => {
    return ['الكل', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];
  }, [products]);

  // Load audits on open
  const loadAudits = async () => {
    setIsLoading(true);
    try {
      const targetBranchId = branch?.id || newAuditBranchId;
      const res = await api.getInventoryAudits(targetBranchId || undefined);
      if (res.audits) {
        setAuditList(res.audits);
        // If there's an in_progress audit and none selected, auto-select it
        if (!activeAudit) {
          const inProgress = res.audits.find((a) => a.status === 'in_progress');
          if (inProgress) {
            setActiveAudit(inProgress);
            setViewMode('audit');
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load audits:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAudits();
    }
  }, [isOpen, branch?.id]);

  // Create new audit session
  const handleStartNewAudit = async () => {
    if (!newAuditBranchId) {
      setErrorMessage('يرجى تحديد الفرع أولاً');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const selectedBr = branches.find((b) => b.id === newAuditBranchId);
      const title =
        newAuditTitle.trim() ||
        `جرد ذكي سريع - ${selectedBr?.name || 'الفرع'} (${new Date().toLocaleDateString('ar-SD')})`;

      const res = await api.createInventoryAudit({
        branchId: newAuditBranchId,
        title,
        scope: newAuditScope,
        categoryFilter: newAuditScope === 'category' ? newAuditCategory : undefined,
        deviceInfo: 'هاتف ذكي / ماسح باركود',
      });

      if (res.success && res.audit) {
        setActiveAudit(res.audit);
        setViewMode('audit');
        setIsNewAuditModalOpen(false);
        playSound('success');
        loadAudits();
        setSuccessMessage('تم بدء جلسة الجرد بنجاح! يمكنك الآن فحص الباركود وإدخال الكميات الفعلية.');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل إنشاء جلسة الجرد');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Scanning or manual barcode submission
  const handleBarcodeSubmit = async (code: string) => {
    const trimmed = normalizeBarcode(code);
    if (!trimmed || !activeAudit || activeAudit.reconciled) return;

    const fromSession = findByBarcodeOrSku(
      activeAudit.items.map((item) => ({
        ...item,
        name: item.productName,
      })),
      trimmed
    );
    const fromCatalog = findByBarcodeOrSku(products, trimmed);
    const targetItem =
      (fromSession && activeAudit.items.find((i) => i.productId === fromSession.productId)) ||
      (fromCatalog && activeAudit.items.find((i) => i.productId === fromCatalog.id)) ||
      activeAudit.items.find(
        (item) => barcodesMatch(item.barcode, trimmed) || normalizeBarcode(item.sku) === trimmed
      );

    if (targetItem) {
      playSound('beep');
      setFocusedItemId(targetItem.productId);
      const nextActual = (targetItem.status === 'uncounted' ? 0 : targetItem.actualQuantity) + 1;
      updateItemCount(targetItem.productId, nextActual);
      setBarcodeInput('');
      setSuccessMessage(`تم مسح: ${targetItem.productName} (الكمية الحالية: ${nextActual})`);
      setTimeout(() => setSuccessMessage(null), 2500);
      return;
    }

    if (fromCatalog) {
      let systemQty = 0;
      try {
        const inv = await api.getInventory(activeAudit.branchId);
        const row = inv.inventory.find((r) => r.productId === fromCatalog.id);
        systemQty = row?.quantity ?? 0;
      } catch {
        /* نضيفو برصيد صفر لو الجرد ما رجع */
      }
      const newItem: InventoryAuditItem = {
        productId: fromCatalog.id,
        productName: fromCatalog.name,
        sku: fromCatalog.sku,
        barcode: fromCatalog.barcode || trimmed,
        category: fromCatalog.category || 'عام',
        unit: fromCatalog.unit || 'حبة',
        costPrice: fromCatalog.purchaseCost || 0,
        sellingPrice: fromCatalog.sellingPriceSdg || 0,
        systemQuantity: systemQty,
        actualQuantity: 0,
        difference: 0 - systemQty,
        differenceCostValue: (0 - systemQty) * (fromCatalog.purchaseCost || 0),
        status: 'uncounted',
        notes: 'أُضيف بالمسح أثناء الجرد',
      };
      const auditWithItem: InventoryAudit = {
        ...activeAudit,
        items: [...activeAudit.items, newItem],
      };
      playSound('beep');
      setFocusedItemId(fromCatalog.id);
      updateItemCount(fromCatalog.id, 1, newItem.notes, auditWithItem);
      setBarcodeInput('');
      setSuccessMessage(`اتضاف للجرد واتعد: ${fromCatalog.name} (1)`);
      setTimeout(() => setSuccessMessage(null), 2500);
      return;
    }

    playSound('alert');
    setErrorMessage(`ما لقينا صنف بالباركود ${trimmed} في مخزون المحل ده.`);
    setTimeout(() => setErrorMessage(null), 3500);
  };

  // Update item count & discrepancy state
  const updateItemCount = (
    productId: string,
    actualQuantity: number,
    notes?: string,
    auditBase?: InventoryAudit
  ) => {
    const base = auditBase || activeAudit;
    if (!base || base.reconciled) return;

    const safeQty = Math.max(0, Number(actualQuantity) || 0);

    const updatedItems = base.items.map((item) => {
      if (item.productId === productId) {
        const diff = safeQty - item.systemQuantity;
        const diffCost = diff * item.costPrice;
        let status: InventoryDiscrepancyStatus = 'matched';
        if (diff < 0) status = 'deficit';
        else if (diff > 0) status = 'surplus';

        return {
          ...item,
          actualQuantity: safeQty,
          difference: diff,
          differenceCostValue: diffCost,
          status,
          notes: notes !== undefined ? notes : item.notes,
          lastScannedAt: new Date().toISOString(),
        };
      }
      return item;
    });

    // Recalculate summary metrics
    const totalProductsCount = updatedItems.length;
    const countedProductsCount = updatedItems.filter((i) => i.status !== 'uncounted').length;
    const matchedCount = updatedItems.filter((i) => i.status === 'matched').length;
    const deficitCount = updatedItems.filter((i) => i.status === 'deficit').length;
    const surplusCount = updatedItems.filter((i) => i.status === 'surplus').length;
    const uncountedCount = updatedItems.filter((i) => i.status === 'uncounted').length;

    let totalDeficitValueSdg = 0;
    let totalSurplusValueSdg = 0;
    let netDiscrepancyCostSdg = 0;

    for (const it of updatedItems) {
      if (it.status === 'uncounted') continue;
      if (it.difference < 0) totalDeficitValueSdg += Math.abs(it.differenceCostValue);
      if (it.difference > 0) totalSurplusValueSdg += it.differenceCostValue;
      netDiscrepancyCostSdg += it.differenceCostValue;
    }

    const updatedAudit: InventoryAudit = {
      ...base,
      items: updatedItems,
      totalProductsCount,
      countedProductsCount,
      matchedCount,
      deficitCount,
      surplusCount,
      uncountedCount,
      totalDeficitValueSdg,
      totalSurplusValueSdg,
      netDiscrepancyCostSdg,
      updatedAt: new Date().toISOString(),
    };

    setActiveAudit(updatedAudit);
    debouncedSave(updatedAudit);
  };

  // One-click match with system
  const handleMarkAsMatched = (productId: string) => {
    if (!activeAudit) return;
    const item = activeAudit.items.find((i) => i.productId === productId);
    if (!item) return;
    playSound('beep');
    updateItemCount(productId, item.systemQuantity);
  };

  // Quick increment/decrement
  const handleDeltaChange = (productId: string, delta: number) => {
    if (!activeAudit) return;
    const item = activeAudit.items.find((i) => i.productId === productId);
    if (!item) return;
    const currentActual = item.status === 'uncounted' ? 0 : item.actualQuantity;
    playSound('beep');
    updateItemCount(productId, Math.max(0, currentActual + delta));
  };

  // Save changes to backend
  const saveTimeoutRef = useRef<any>(null);
  const debouncedSave = (auditToSave: InventoryAudit) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        await api.updateInventoryAudit(auditToSave.id, {
          items: auditToSave.items,
        });
      } catch (err) {
        console.warn('Auto-save audit failed:', err);
      } finally {
        setIsSaving(false);
      }
    }, 800);
  };

  // Final Reconcile & Commit Stock Differences
  const handleConfirmReconcile = async () => {
    if (!activeAudit) return;
    setIsReconciling(true);
    setErrorMessage(null);
    try {
      const res = await api.reconcileInventoryAudit(activeAudit.id);
      if (res.success && res.audit) {
        setActiveAudit(res.audit);
        setViewMode('audit');
        playSound('success');
        setSuccessMessage(
          `🎉 تم اعتماد وتسوية المخزون فورياً بنجاح! تم تعديل أرصدة (${res.adjustedCount}) صنف في الفرع.`
        );
        onAuditCompleted();
        loadAudits();
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل اعتماد وتسوية المخزون');
    } finally {
      setIsReconciling(false);
    }
  };

  // Cancel audit session
  const handleCancelAudit = async (auditId: string) => {
    if (!confirm('هل أنت متأكد من إلغاء جلسة الجرد هذه؟ لن يتم تعديل أرصدة المخزون.')) return;
    try {
      await api.cancelInventoryAudit(auditId);
      loadAudits();
      if (activeAudit?.id === auditId) {
        setActiveAudit(null);
        setViewMode('list');
      }
    } catch (err: any) {
      alert(err.message || 'فشل إلغاء الجلسة');
    }
  };

  // Filter items in active session
  const filteredItems = useMemo(() => {
    if (!activeAudit) return [];
    return activeAudit.items.filter((item) => {
      // Category filter
      if (filterCategory !== 'الكل' && item.category !== filterCategory) return false;

      // Discrepancy filter
      if (filterDiscrepancy === 'uncounted' && item.status !== 'uncounted') return false;
      if (filterDiscrepancy === 'matched' && item.status !== 'matched') return false;
      if (filterDiscrepancy === 'deficit' && item.status !== 'deficit') return false;
      if (filterDiscrepancy === 'surplus' && item.status !== 'surplus') return false;
      if (filterDiscrepancy === 'discrepancy' && item.status !== 'deficit' && item.status !== 'surplus')
        return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.productName.toLowerCase().includes(q);
        const matchesSku = item.sku?.toLowerCase().includes(q);
        const matchesBarcode = item.barcode?.toLowerCase().includes(q);
        return matchesName || matchesSku || matchesBarcode;
      }

      return true;
    });
  }, [activeAudit, filterCategory, filterDiscrepancy, searchQuery]);

  // WhatsApp share generator
  const shareAuditViaWhatsApp = () => {
    if (!activeAudit) return;
    const text = `📊 *تقرير تدقيق وجرد المخزون الذكي*
🏢 *الفرع:* ${activeAudit.branchName}
🔢 *رقم الجلسة:* ${activeAudit.auditNumber}
👤 *المسؤول:* ${activeAudit.auditorName}
📅 *التاريخ:* ${new Date(activeAudit.startedAt).toLocaleDateString('ar-SD')}

📈 *ملخص الفروقات:*
- إجمالي الأصناف: ${activeAudit.totalProductsCount}
- تم جردها: ${activeAudit.countedProductsCount}
- الأصناف المتطابقة: ${activeAudit.matchedCount}
- أصناف بها عجز: ${activeAudit.deficitCount} (القيمة: ${activeAudit.totalDeficitValueSdg.toLocaleString()} ج.س)
- أصناف بها فائض: ${activeAudit.surplusCount} (القيمة: ${activeAudit.totalSurplusValueSdg.toLocaleString()} ج.س)
- *صافي الفروقات:* ${activeAudit.netDiscrepancyCostSdg.toLocaleString()} ج.س
- *الحالة:* ${activeAudit.reconciled ? 'تم اعتماد التسوية في النظام ✅' : 'قيد التدقيق والتسوية ⏳'}`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Printable report
  const handlePrintReport = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-50 w-full max-w-6xl max-h-[96vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ========================================================
            TOP HEADER BAR
        ======================================================== */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm ring-2 ring-emerald-400/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  أداة تدقيق وجرد المخزون الذكية
                </h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Phone Audit & Quick Reconcile
                </span>
              </div>
              <p className="text-xs text-slate-400">
                جرد ميداني فوري بالهاتف مع مقارنة فورية بين الفعلي والمسجل بالنظام
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View navigation buttons */}
            {viewMode !== 'list' && (
              <button
                onClick={() => setViewMode('list')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">سجل الجلسات</span>
              </button>
            )}

            {/* Audio toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'كتم التنبيهات الصوتية' : 'تفعيل التنبيهات الصوتية'}
              className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
                soundEnabled
                  ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================
            ALERT / FEEDBACK MESSAGES
        ======================================================== */}
        {errorMessage && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-center justify-between text-rose-800 text-xs font-semibold animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center justify-between text-emerald-900 text-xs font-semibold animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================
            BODY CONTENT SWITCH
        ======================================================== */}
        <div className="flex-1 overflow-y-auto">
          {/* 1. SESSIONS LIST VIEW */}
          {viewMode === 'list' && (
            <div className="p-4 sm:p-6 space-y-6">
              {/* Top Banner / New Audit Action */}
              <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>الجرد السريع بالباركود وكاميرا الموبايل</span>
                  </div>
                  <h4 className="text-lg font-bold">جلسات تدقيق المخزون والمطابقة الميدانية</h4>
                  <p className="text-xs text-slate-300 max-w-xl">
                    ابدأ جلسة جرد جديدة لمطابقة الرفوف مع النظام واكتشاف العجز أو الفائض فورياً، أو استكمل الجلسات المفتوحة.
                  </p>
                </div>

                <button
                  onClick={() => setIsNewAuditModalOpen(true)}
                  className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 shrink-0 active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  <span>بدء جلسة جرد جديدة بالهاتف</span>
                </button>
              </div>

              {/* Sessions List */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>سجل جلسات الجرد السابقة والحالية ({auditList.length})</span>
                  </div>
                  <button
                    onClick={loadAudits}
                    className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white text-xs flex items-center gap-1 font-semibold"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>تحديث</span>
                  </button>
                </div>

                {auditList.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <Smartphone className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">لا توجد جلسات جرد سابقة</p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      يمكنك بدء أول جلسة جرد ذكي الآن لفحص كميات المخزون في الفرع باستخدام كاميرا هاتفك أو قارئ الباركود.
                    </p>
                    <button
                      onClick={() => setIsNewAuditModalOpen(true)}
                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>بدء أول جلسة جرد</span>
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {auditList.map((aud) => {
                      const isComplete = aud.status === 'completed' || aud.reconciled;
                      const isCancelled = aud.status === 'cancelled';
                      const progressPct =
                        aud.totalProductsCount > 0
                          ? Math.round((aud.countedProductsCount / aud.totalProductsCount) * 100)
                          : 0;

                      return (
                        <div
                          key={aud.id}
                          className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {aud.auditNumber}
                              </span>
                              <h5 className="font-bold text-slate-900 text-sm">{aud.title}</h5>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                  aud.reconciled
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : isCancelled
                                    ? 'bg-slate-100 text-slate-500 border-slate-300'
                                    : 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                                }`}
                              >
                                {aud.reconciled
                                  ? 'معتمد ومُسوّى بالنظام ✅'
                                  : isCancelled
                                  ? 'ملغي'
                                  : 'قيد التدقيق والجرد 📱'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Building className="w-3.5 h-3.5 text-slate-400" />
                                {aud.branchName}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                {aud.auditorName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {new Date(aud.startedAt).toLocaleString('ar-SD')}
                              </span>
                            </div>

                            {/* Discrepancy KPI pills */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                فُحص: {aud.countedProductsCount} / {aud.totalProductsCount} ({progressPct}%)
                              </span>
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                متطابق: {aud.matchedCount}
                              </span>
                              {aud.deficitCount > 0 && (
                                <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  عجز: {aud.deficitCount} صنف ({aud.totalDeficitValueSdg.toLocaleString()} ج.س)
                                </span>
                              )}
                              {aud.surplusCount > 0 && (
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  فائض: {aud.surplusCount} صنف (+{aud.totalSurplusValueSdg.toLocaleString()} ج.س)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                            <button
                              onClick={() => {
                                setActiveAudit(aud);
                                setViewMode('audit');
                              }}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
                            >
                              <Smartphone className="w-4 h-4" />
                              <span>{aud.reconciled ? 'عرض تفاصيل الجرد' : 'متابعة الجرد بالهاتف'}</span>
                            </button>

                            {!aud.reconciled && !isCancelled && (
                              <button
                                onClick={() => handleCancelAudit(aud.id)}
                                title="إلغاء الجلسة"
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. ACTIVE AUDIT SESSION (PHONE & TABLE MODES) */}
          {viewMode === 'audit' && activeAudit && (
            <div className="flex flex-col h-full space-y-4 p-3 sm:p-5">
              {/* Header Info & Progress Bar */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded">
                        {activeAudit.auditNumber}
                      </span>
                      <h4 className="text-base font-bold text-slate-900">{activeAudit.title}</h4>
                      {activeAudit.reconciled ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          معتمد ومسوّى بالنظام ✅
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                          قيد الجرد الفعلي 📱
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>الفرع: {activeAudit.branchName}</span>
                      <span>•</span>
                      <span>المسؤول: {activeAudit.auditorName}</span>
                      {isSaving && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            جاري الحفظ التلقائي...
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions: Reconcile, WhatsApp, Print, Layout switch */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Switch layout button */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                      <button
                        onClick={() => setLayoutMode('phone')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${
                          layoutMode === 'phone'
                            ? 'bg-white text-emerald-700 shadow-xs font-bold'
                            : 'text-slate-600'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>وضع الهاتف</span>
                      </button>
                      <button
                        onClick={() => setLayoutMode('table')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${
                          layoutMode === 'table'
                            ? 'bg-white text-emerald-700 shadow-xs font-bold'
                            : 'text-slate-600'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>وضع الجدول</span>
                      </button>
                    </div>

                    {/* WhatsApp share */}
                    <button
                      onClick={shareAuditViaWhatsApp}
                      title="مشاركة ملخص الجرد عبر واتساب"
                      className="p-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors flex items-center gap-1"
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="hidden sm:inline">واتساب</span>
                    </button>

                    {/* Reconcile button */}
                    {!activeAudit.reconciled && (
                      <button
                        onClick={() => setViewMode('reconcile_confirm')}
                        disabled={activeAudit.countedProductsCount === 0}
                        className={`px-4 py-2 rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all ${
                          activeAudit.countedProductsCount === 0
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>اعتماد وتسوية المخزون فورياً</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-slate-600">
                      نسبة إنجاز الجرد: {activeAudit.countedProductsCount} من أصل {activeAudit.totalProductsCount} صنف
                    </span>
                    <span className="text-emerald-700 font-mono">
                      {activeAudit.totalProductsCount > 0
                        ? Math.round((activeAudit.countedProductsCount / activeAudit.totalProductsCount) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          activeAudit.totalProductsCount > 0
                            ? (activeAudit.countedProductsCount / activeAudit.totalProductsCount) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* KPI Discrepancy Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  {/* Matched */}
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-emerald-800">مطابق تماماً</p>
                      <p className="text-base font-black text-emerald-950 font-mono mt-0.5">
                        {activeAudit.matchedCount} صنف
                      </p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  </div>

                  {/* Deficit */}
                  <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-rose-800">عجز في المخزون</p>
                      <p className="text-base font-black text-rose-950 font-mono mt-0.5">
                        {activeAudit.deficitCount} صنف
                      </p>
                      <p className="text-[10px] text-rose-600 font-mono">
                        -{activeAudit.totalDeficitValueSdg.toLocaleString()} ج.س
                      </p>
                    </div>
                    <TrendingDown className="w-5 h-5 text-rose-600 shrink-0" />
                  </div>

                  {/* Surplus */}
                  <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-blue-800">فائض وزيادة</p>
                      <p className="text-base font-black text-blue-950 font-mono mt-0.5">
                        {activeAudit.surplusCount} صنف
                      </p>
                      <p className="text-[10px] text-blue-600 font-mono">
                        +{activeAudit.totalSurplusValueSdg.toLocaleString()} ج.س
                      </p>
                    </div>
                    <TrendingUp className="w-5 h-5 text-blue-600 shrink-0" />
                  </div>

                  {/* Net difference */}
                  <div className="p-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-slate-300">صافي أثر الفروقات</p>
                      <p
                        className={`text-base font-black font-mono mt-0.5 ${
                          activeAudit.netDiscrepancyCostSdg < 0
                            ? 'text-rose-400'
                            : activeAudit.netDiscrepancyCostSdg > 0
                            ? 'text-emerald-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {activeAudit.netDiscrepancyCostSdg > 0 ? '+' : ''}
                        {activeAudit.netDiscrepancyCostSdg.toLocaleString()} ج.س
                      </p>
                    </div>
                    <Flame className="w-5 h-5 text-amber-400 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Barcode & Search Controls */}
              <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {/* Barcode Quick Scan Input */}
                  <div className="flex-1 relative">
                    <ScanBarcode className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      placeholder="امسح الباركود بالكاميرا/القارئ أو اكتب اسم الصنف / SKU واضغط Enter..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleBarcodeSubmit(barcodeInput);
                        }
                      }}
                      disabled={activeAudit.reconciled}
                      className="w-full pr-11 pl-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Manual trigger scan */}
                  <button
                    onClick={() => handleBarcodeSubmit(barcodeInput)}
                    disabled={!barcodeInput.trim() || activeAudit.reconciled}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-xl text-xs font-bold transition-all shrink-0"
                  >
                    إدخال
                  </button>

                  {/* Camera toggle */}
                  <button
                    onClick={() => setIsCameraActive(!isCameraActive)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0 ${
                      isCameraActive
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isCameraActive ? 'إيقاف الكاميرا' : 'فتح الكاميرا'}</span>
                  </button>
                </div>

                {/* Real Camera Barcode Scanner Modal */}
                <CameraBarcodeScanner
                  isOpen={isCameraActive}
                  onClose={() => setIsCameraActive(false)}
                  onScanSuccess={(code) => {
                    handleBarcodeSubmit(code);
                  }}
                  soundEnabled={soundEnabled}
                  defaultContinuous={true}
                  submitLabel="تسجيل بالجرد"
                />

                {/* Filter and Category Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  {/* Discrepancy Status Filters */}
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      onClick={() => setFilterDiscrepancy('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        filterDiscrepancy === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      الكل ({activeAudit.items.length})
                    </button>
                    <button
                      onClick={() => setFilterDiscrepancy('uncounted')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        filterDiscrepancy === 'uncounted'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      لم يُجرد ({activeAudit.uncountedCount})
                    </button>
                    <button
                      onClick={() => setFilterDiscrepancy('discrepancy')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        filterDiscrepancy === 'discrepancy'
                          ? 'bg-rose-700 text-white'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      به فروقات ({activeAudit.deficitCount + activeAudit.surplusCount})
                    </button>
                    <button
                      onClick={() => setFilterDiscrepancy('deficit')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        filterDiscrepancy === 'deficit'
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      عجز فقط ({activeAudit.deficitCount})
                    </button>
                    <button
                      onClick={() => setFilterDiscrepancy('surplus')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        filterDiscrepancy === 'surplus'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      فائض فقط ({activeAudit.surplusCount})
                    </button>
                    <button
                      onClick={() => setFilterDiscrepancy('matched')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        filterDiscrepancy === 'matched'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      متطابق ({activeAudit.matchedCount})
                    </button>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ========================================================
                  PRODUCTS AUDIT LIST / CARDS
              ======================================================== */}
              {layoutMode === 'phone' ? (
                /* SMARTPHONE HANDHELD TOUCH VIEW */
                <div className="space-y-3 pb-6">
                  {filteredItems.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                      <p className="text-xs font-bold">لا توجد أصناف تطابق معايير الفلترة الحالية</p>
                    </div>
                  ) : (
                    filteredItems.map((item) => {
                      const isUncounted = item.status === 'uncounted';
                      const isDeficit = item.status === 'deficit';
                      const isSurplus = item.status === 'surplus';
                      const isMatched = item.status === 'matched';
                      const isFocused = focusedItemId === item.productId;

                      return (
                        <div
                          key={item.productId}
                          className={`bg-white rounded-2xl p-4 border transition-all duration-150 ${
                            isFocused
                              ? 'border-emerald-500 ring-2 ring-emerald-400/40 shadow-md'
                              : isDeficit
                              ? 'border-rose-300 bg-rose-50/20 shadow-xs'
                              : isSurplus
                              ? 'border-blue-300 bg-blue-50/20 shadow-xs'
                              : isMatched
                              ? 'border-emerald-300 bg-emerald-50/20'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Item Top Info */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-slate-400">
                                  {item.barcode || item.sku}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {item.category}
                                </span>
                              </div>
                              <h5 className="text-sm font-bold text-slate-900 mt-0.5">{item.productName}</h5>
                              <p className="text-[11px] text-slate-500">
                                التكلفة: {item.costPrice.toLocaleString()} ج.س | الوحدة: {item.unit}
                              </p>
                            </div>

                            {/* Status Tag */}
                            <div className="shrink-0 text-left">
                              {isUncounted ? (
                                <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                  لم يُجرد بعد ⏳
                                </span>
                              ) : isMatched ? (
                                <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  متطابق (0)
                                </span>
                              ) : isDeficit ? (
                                <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                  <TrendingDown className="w-3 h-3" />
                                  عجز: {item.difference} {item.unit}
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  فائض: +{item.difference} {item.unit}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quantities Comparison Grid */}
                          <div className="grid grid-cols-3 gap-2 my-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 block">المسجل بالنظام</span>
                              <span className="text-sm font-black text-slate-800 font-mono">
                                {item.systemQuantity}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-slate-500 block">الفعلي بالجرد</span>
                              <span
                                className={`text-sm font-black font-mono ${
                                  isUncounted
                                    ? 'text-amber-600'
                                    : isMatched
                                    ? 'text-emerald-700'
                                    : isDeficit
                                    ? 'text-rose-700'
                                    : 'text-blue-700'
                                }`}
                              >
                                {isUncounted ? '—' : item.actualQuantity}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-slate-500 block">الفارق المالي</span>
                              <span
                                className={`text-xs font-black font-mono ${
                                  isUncounted
                                    ? 'text-slate-400'
                                    : item.differenceCostValue < 0
                                    ? 'text-rose-700'
                                    : item.differenceCostValue > 0
                                    ? 'text-blue-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {isUncounted ? '—' : `${item.differenceCostValue.toLocaleString()} ج.س`}
                              </span>
                            </div>
                          </div>

                          {/* Quick Mobile Touch Controls */}
                          {!activeAudit.reconciled && (
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center gap-2">
                                {/* Stepper buttons: -1, +1, +5, +10 */}
                                <button
                                  onClick={() => handleDeltaChange(item.productId, -1)}
                                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-black text-sm flex items-center justify-center border border-slate-200 transition-transform active:scale-90"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>

                                <input
                                  type="number"
                                  min="0"
                                  placeholder="الكمية"
                                  value={item.status === 'uncounted' ? '' : item.actualQuantity}
                                  onChange={(e) => updateItemCount(item.productId, Number(e.target.value))}
                                  className="flex-1 h-10 px-3 bg-white border border-slate-300 rounded-xl text-center font-mono font-black text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />

                                <button
                                  onClick={() => handleDeltaChange(item.productId, 1)}
                                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-black text-sm flex items-center justify-center border border-slate-200 transition-transform active:scale-90"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => handleDeltaChange(item.productId, 5)}
                                  className="px-2.5 h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 transition-transform active:scale-90"
                                >
                                  +5
                                </button>

                                <button
                                  onClick={() => handleDeltaChange(item.productId, 10)}
                                  className="px-2.5 h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 transition-transform active:scale-90"
                                >
                                  +10
                                </button>
                              </div>

                              {/* Action pill: Match button & reason input */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleMarkAsMatched(item.productId)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 flex items-center gap-1 transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>مطابق للمسجل ({item.systemQuantity})</span>
                                </button>

                                <input
                                  type="text"
                                  placeholder="ملاحظات العجز/الفائض (تالف، منتهي، مفقود...)"
                                  value={item.notes || ''}
                                  onChange={(e) => updateItemCount(item.productId, item.actualQuantity, e.target.value)}
                                  className="flex-1 py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:bg-white focus:border-slate-300"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* DESKTOP/TABLET TABLE VIEW */
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">الصنف / الباركود</th>
                        <th className="p-3">التصنيف</th>
                        <th className="p-3 text-center">الكمية المسجلة</th>
                        <th className="p-3 text-center">الكمية الفعلية</th>
                        <th className="p-3 text-center">الفارق</th>
                        <th className="p-3 text-center">الفارق المالي (ج.س)</th>
                        <th className="p-3 text-center">الحالة</th>
                        <th className="p-3">ملاحظات</th>
                        {!activeAudit.reconciled && <th className="p-3 text-center">إجراءات سريعة</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item) => {
                        const isDeficit = item.status === 'deficit';
                        const isSurplus = item.status === 'surplus';
                        const isMatched = item.status === 'matched';
                        const isUncounted = item.status === 'uncounted';

                        return (
                          <tr
                            key={item.productId}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isDeficit ? 'bg-rose-50/30' : isSurplus ? 'bg-blue-50/30' : ''
                            }`}
                          >
                            <td className="p-3">
                              <p className="font-bold text-slate-900">{item.productName}</p>
                              <span className="font-mono text-[10px] text-slate-400">
                                {item.barcode || item.sku}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">{item.category}</td>
                            <td className="p-3 text-center font-mono font-bold text-slate-800">
                              {item.systemQuantity} {item.unit}
                            </td>
                            <td className="p-3 text-center">
                              {activeAudit.reconciled ? (
                                <span className="font-mono font-bold text-slate-900">
                                  {item.actualQuantity}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  value={isUncounted ? '' : item.actualQuantity}
                                  placeholder="—"
                                  onChange={(e) => updateItemCount(item.productId, Number(e.target.value))}
                                  className="w-16 p-1 text-center font-mono font-bold bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500"
                                />
                              )}
                            </td>
                            <td className="p-3 text-center font-mono font-bold">
                              {isUncounted ? (
                                <span className="text-slate-400">—</span>
                              ) : isMatched ? (
                                <span className="text-emerald-700">0</span>
                              ) : isDeficit ? (
                                <span className="text-rose-700">{item.difference}</span>
                              ) : (
                                <span className="text-blue-700">+{item.difference}</span>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono font-bold">
                              {isUncounted ? (
                                <span className="text-slate-400">—</span>
                              ) : (
                                <span
                                  className={
                                    item.differenceCostValue < 0
                                      ? 'text-rose-700'
                                      : item.differenceCostValue > 0
                                      ? 'text-blue-700'
                                      : 'text-emerald-700'
                                  }
                                >
                                  {item.differenceCostValue.toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {isUncounted ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                                  لم يُجرد
                                </span>
                              ) : isMatched ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  مطابق
                                </span>
                              ) : isDeficit ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  عجز
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  فائض
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {activeAudit.reconciled ? (
                                <span className="text-slate-600 text-xs">{item.notes || '—'}</span>
                              ) : (
                                <input
                                  type="text"
                                  value={item.notes || ''}
                                  placeholder="ملاحظات..."
                                  onChange={(e) => updateItemCount(item.productId, item.actualQuantity, e.target.value)}
                                  className="w-full p-1 bg-white border border-slate-200 rounded text-xs"
                                />
                              )}
                            </td>
                            {!activeAudit.reconciled && (
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleMarkAsMatched(item.productId)}
                                    title="تطابق فوري"
                                    className="p-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeltaChange(item.productId, 1)}
                                    title="+1"
                                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeltaChange(item.productId, -1)}
                                    title="-1"
                                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. RECONCILIATION CONFIRMATION MODAL VIEW */}
          {viewMode === 'reconcile_confirm' && activeAudit && (
            <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 text-amber-950 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold">تأكيد اعتماد وتسوية فروقات المخزون</h4>
                    <p className="text-xs text-amber-800">
                      سيقوم النظام بتحديث كميات المخزون فورياً وتعديل الأرصدة الفعلية في فرع [{activeAudit.branchName}].
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-amber-200 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">إجمالي الأصناف المجرودة:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {activeAudit.countedProductsCount} من أصل {activeAudit.totalProductsCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">أصناف بها عجز (ستُخصم من المخزون):</span>
                    <span className="font-bold text-rose-700 font-mono">
                      {activeAudit.deficitCount} صنف (-{activeAudit.totalDeficitValueSdg.toLocaleString()} ج.س)
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">أصناف بها فائض (ستُضاف للمخزون):</span>
                    <span className="font-bold text-blue-700 font-mono">
                      {activeAudit.surplusCount} صنف (+{activeAudit.totalSurplusValueSdg.toLocaleString()} ج.س)
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 text-sm font-black text-slate-900">
                    <span>صافي أثر الفروقات المالية:</span>
                    <span className="font-mono text-emerald-800">
                      {activeAudit.netDiscrepancyCostSdg.toLocaleString()} ج.س
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-amber-900">
                  ⚠️ تنبيه: سيتم إنشاء حركات مخزنية من نوع تسوية جرد (Adjustment) وتوثيقها باسم المدقق ({activeAudit.auditorName}) وسيقفل هذا الجرد ولا يمكن تعديله لاحقاً.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setViewMode('audit')}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
                >
                  الرجوع ومتابعة الجرد
                </button>

                <button
                  onClick={handleConfirmReconcile}
                  disabled={isReconciling}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-2 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isReconciling ? 'جاري الاعتماد وتحديث المخزون...' : 'نعم، اعتماد التسوية وتحديث النظام'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            NEW AUDIT SESSION MODAL (SUB-MODAL)
        ======================================================== */}
        {isNewAuditModalOpen && (
          <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-bold text-slate-900 text-base">بدء جلسة جرد مخزني جديدة</h4>
                </div>
                <button
                  onClick={() => setIsNewAuditModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">الفرع المراد تدقيقه *</label>
                  <select
                    value={newAuditBranchId}
                    onChange={(e) => setNewAuditBranchId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">عنوان الجلسة (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مثال: جرد الرفوف الأمامية - قسم المشروبات"
                    value={newAuditTitle}
                    onChange={(e) => setNewAuditTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">نطاق الجرد</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewAuditScope('all')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                        newAuditScope === 'all'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      كامل أصناف الفرع
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAuditScope('category')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                        newAuditScope === 'category'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      تصنيف محدد فقط
                    </button>
                  </div>
                </div>

                {newAuditScope === 'category' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">حدد التصنيف</label>
                    <select
                      value={newAuditCategory}
                      onChange={(e) => setNewAuditCategory(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsNewAuditModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleStartNewAudit}
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  {isLoading ? 'جاري البدء...' : 'بدء الجرد الآن'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
