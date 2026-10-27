import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  AlertTriangle,
  History,
  Search,
  Filter,
  Layers,
  ArrowUpDown,
  Barcode,
  X,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  Truck,
  FileText,
  CheckCircle2,
  DollarSign,
  Clock,
  ArrowRight,
  Sparkles,
  Smartphone,
  Image as ImageIcon,
  Video,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import type { Product, Branch, BranchInventory, StockMovement } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { InventoryAuditModal } from './InventoryAuditModal.tsx';
import { uploadProductImage, uploadProductVideo, PRODUCT_VIDEO_MAX_SECONDS } from '../../lib/uploadProductMedia.ts';

interface InventoryViewProps {
  products: Product[];
  branches: Branch[];
  currentBranch: Branch | null;
  onRefresh: () => void;
  canViewCogs?: boolean;
  canEditPrices?: boolean;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  branches,
  currentBranch,
  onRefresh,
  canViewCogs = true,
  canEditPrices = true,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'movements'>('catalog');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(currentBranch?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  // Smart Inventory Audit modal state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  // Side alert panel for reorder threshold deficit products
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false);

  // Direct Purchase Order Modal State
  interface PoItemState {
    productId: string;
    productName: string;
    unit: string;
    currentStock: number;
    reorderPoint: number;
    orderQuantity: number;
    unitCostSdg: number;
  }
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [poItems, setPoItems] = useState<PoItemState[]>([]);
  const [poSupplier, setPoSupplier] = useState('');
  const [poInvoiceNo, setPoInvoiceNo] = useState('');
  const [poBranchId, setPoBranchId] = useState(currentBranch?.id || branches[0]?.id || '');
  const [poPaymentStatus, setPoPaymentStatus] = useState<'paid' | 'partial' | 'credit'>('paid');
  const [poNotes, setPoNotes] = useState('أمر شراء وتوريد مباشر لتعزيز مخزون النواقص');
  const [isPoSubmitting, setIsPoSubmitting] = useState(false);

  // Inventories from server
  const [inventoryList, setInventoryList] = useState<
    (BranchInventory & { product?: Product; branch?: Branch })[]
  >([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add Product Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newCategory, setNewCategory] = useState('المواد التموينية والأساسية');
  const [newUnit, setNewUnit] = useState('حبة');
  const [newPurchaseCost, setNewPurchaseCost] = useState('10000');
  const [newCostCurrency, setNewCostCurrency] = useState('SDG');
  const [newSellingPrice, setNewSellingPrice] = useState('12500');
  const [newMinAlert, setNewMinAlert] = useState('10');
  const [newInitialStock, setNewInitialStock] = useState('20');
  const [newIsTaxExempt, setNewIsTaxExempt] = useState(false);
  const [newCustomTaxRate, setNewCustomTaxRate] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [mediaBusy, setMediaBusy] = useState<null | 'image' | 'video'>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Adjust Stock Modal
  const [adjustingProduct, setAdjustingProduct] = useState<{
    product: Product;
    currentQty: number;
    branchId: string;
  } | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<string>('0');
  const [adjustReason, setAdjustReason] = useState('عجز جرد دوري ومطابقة رفوف');
  const [adjustType, setAdjustType] = useState<'adjustment' | 'damage_expired'>('adjustment');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  const copyRealBarcode = async (code: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const value = (code || '').trim();
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedBarcode(value);
      window.setTimeout(() => setCopiedBarcode((cur) => (cur === value ? null : cur)), 1600);
    } catch {
      setMsg({ type: 'error', text: 'ما قدرنا ننسخ الباركود — جرّب تاني' });
    }
  };

  // Load Inventory data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const invRes = await api.getInventory(selectedBranchId || undefined);
      setInventoryList(invRes.inventory);

      if (activeTab === 'movements') {
        const movRes = await api.getStockMovements(selectedBranchId || undefined);
        setMovements(movRes.movements);
      }
    } catch (err: any) {
      console.warn('Failed loading inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBranchId, activeTab]);

  const categories = ['الكل', ...Array.from(new Set(products.map((p) => p.category)))];

  // Calculate alert statistics using minimumStock / minStockAlert threshold
  const totalStockRows = products.map((prod) => {
    const inv = inventoryList.find((i) => i.productId === prod.id && (!selectedBranchId || i.branchId === selectedBranchId));
    const qty = inv ? inv.quantity : 0;
    const minThreshold = prod.minimumStock !== undefined ? prod.minimumStock : prod.minStockAlert;
    const isOutOfStock = qty === 0;
    const isBelowMin = qty <= minThreshold;
    const isApproaching = qty > minThreshold && qty <= minThreshold * 1.4;
    const stockRatio = minThreshold > 0 ? Math.min(100, Math.round((qty / minThreshold) * 100)) : 100;

    return {
      product: prod,
      quantity: qty,
      minThreshold,
      isOutOfStock,
      isBelowMin,
      isApproaching,
      isAlert: isBelowMin,
      stockRatio,
    };
  });

  const outOfStockCount = totalStockRows.filter((r) => r.isOutOfStock).length;
  const belowMinCount = totalStockRows.filter((r) => r.isBelowMin).length;
  const totalAlertCount = outOfStockCount + belowMinCount;

  // Filtered rows
  const productStockRows = totalStockRows.filter((row) => {
    const matchesSearch =
      row.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.product.barcode.includes(searchQuery);
    const matchesCategory = selectedCategory === 'الكل' || row.product.category === selectedCategory;

    let matchesFilter = true;
    if (showLowStockOnly) {
      matchesFilter = row.isAlert;
    }

    return matchesSearch && matchesCategory && matchesFilter;
  });

  // Handle Add Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMsg(null);

    try {
      const res = await api.createProduct({
        name: newProductName,
        sku: newSku,
        barcode: newBarcode,
        category: newCategory,
        unit: newUnit,
        purchaseCost: Number(newPurchaseCost),
        costCurrency: newCostCurrency,
        sellingPriceSdg: Number(newSellingPrice),
        minStockAlert: Number(newMinAlert),
        initialStock: Number(newInitialStock),
        branchId: selectedBranchId || branches[0]?.id,
        isTaxExempt: newIsTaxExempt,
        customTaxRate: newCustomTaxRate ? Number(newCustomTaxRate) : undefined,
        imageUrl: newImageUrl || undefined,
        videoUrl: newVideoUrl || undefined,
      });

      if (res.success) {
        setIsAddModalOpen(false);
        setNewProductName('');
        setNewIsTaxExempt(false);
        setNewCustomTaxRate('');
        setNewImageUrl('');
        setNewVideoUrl('');
        setMediaError(null);
        onRefresh();
        loadData();
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'فشل إضافة المنتج' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickProductImage = async (file?: File | null) => {
    if (!file) return;
    setMediaError(null);
    setMediaBusy('image');
    try {
      const url = await uploadProductImage(file);
      setNewImageUrl(url);
    } catch (err: any) {
      setMediaError(err.message || 'تعذر رفع الصورة');
    } finally {
      setMediaBusy(null);
    }
  };

  const pickProductVideo = async (file?: File | null) => {
    if (!file) return;
    setMediaError(null);
    setMediaBusy('video');
    try {
      const url = await uploadProductVideo(file);
      setNewVideoUrl(url);
    } catch (err: any) {
      setMediaError(err.message || 'تعذر رفع الفيديو');
    } finally {
      setMediaBusy(null);
    }
  };

  // Handle Stock Adjustment
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    setIsSubmitting(true);

    try {
      const res = await api.adjustInventory({
        branchId: adjustingProduct.branchId,
        productId: adjustingProduct.product.id,
        delta: Number(adjustDelta),
        reason: adjustReason,
        type: adjustType,
      });

      if (res.success) {
        setAdjustingProduct(null);
        loadData();
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تعديل المخزون');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Products that reached/exceeded reorder threshold (below or at minimum stock)
  const deficitProducts = totalStockRows.filter((r) => r.isBelowMin);

  // Open Direct Purchase Order for a single deficit product
  const openDirectPoForItem = (row: (typeof totalStockRows)[0]) => {
    const suggestedQty = Math.max(row.minThreshold, row.minThreshold * 2 - row.quantity);
    setPoItems([
      {
        productId: row.product.id,
        productName: row.product.name,
        unit: row.product.unit,
        currentStock: row.quantity,
        reorderPoint: row.minThreshold,
        orderQuantity: suggestedQty,
        unitCostSdg: row.product.purchaseCost,
      },
    ]);
    setPoSupplier(
      row.product.category.includes('سكر') || row.product.name.includes('سكر')
        ? 'شركة سكر كنانة المحدودة'
        : row.product.name.includes('سيقا') || row.product.category.includes('تموينية')
        ? 'مجموعة سيقا للسلع الغذائية'
        : row.product.category.includes('شاي') || row.product.name.includes('شاي')
        ? 'شركة الغزالتين للشاي'
        : 'شركة التوريدات الوطنية المعتمدة'
    );
    setPoInvoiceNo(`PO-${Date.now().toString().slice(-6)}`);
    setPoBranchId(selectedBranchId || branches[0]?.id || '');
    setIsPoModalOpen(true);
  };

  // Open Bulk Direct Purchase Order for all deficit products
  const openBulkPoForDeficitItems = () => {
    if (deficitProducts.length === 0) return;
    const items: PoItemState[] = deficitProducts.map((row) => ({
      productId: row.product.id,
      productName: row.product.name,
      unit: row.product.unit,
      currentStock: row.quantity,
      reorderPoint: row.minThreshold,
      orderQuantity: Math.max(row.minThreshold, row.minThreshold * 2 - row.quantity),
      unitCostSdg: row.product.purchaseCost,
    }));
    setPoItems(items);
    setPoSupplier('مجموعة الموردين المعتمدين - طلبيات تعزيز النواقص');
    setPoInvoiceNo(`PO-${Date.now().toString().slice(-6)}`);
    setPoBranchId(selectedBranchId || branches[0]?.id || '');
    setIsPoModalOpen(true);
  };

  // Handle direct purchase submission
  const handleSubmitDirectPo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poItems.length || !poBranchId) return;
    setIsPoSubmitting(true);
    setMsg(null);
    try {
      const res = await api.createPurchase({
        branchId: poBranchId,
        supplierName: poSupplier,
        invoiceNumber: poInvoiceNo,
        currency: 'SDG',
        exchangeRate: 1,
        items: poItems.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.orderQuantity,
          costInCurrency: it.unitCostSdg,
          currency: 'SDG',
          exchangeRate: 1,
          costSdg: it.unitCostSdg,
        })),
        paymentStatus: poPaymentStatus,
        notes: poNotes,
      });

      if (res.success) {
        setIsPoModalOpen(false);
        setIsAlertPanelOpen(false);
        setMsg({
          type: 'success',
          text: `تم بنجاح إصدار أمر الشراء (${res.purchase.invoiceNumber}) وتوريد الأصناف مباشرة وإضافتها لأرصدة الفرع!`,
        });
        loadData();
        onRefresh();
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'فشل إصدار أمر الشراء المباشر' });
    } finally {
      setIsPoSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title & Top Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">إدارة المخزون والمنتجات</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة أرصدة الفروع، تنبيهات النواقص، تسويات الجرد، وسجل حركة الأصناف
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'catalog' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              دليل الأصناف والأرصدة
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'movements' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              سجل حركة المخزون
            </button>
          </div>

          {/* Side Alert Panel Trigger Button */}
          <button
            onClick={() => setIsAlertPanelOpen(!isAlertPanelOpen)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs ${
              isAlertPanelOpen
                ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                : totalAlertCount > 0
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <div className="relative">
              <AlertTriangle className={`w-4 h-4 ${isAlertPanelOpen ? 'text-white' : 'text-amber-600'}`} />
              {totalAlertCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-600 absolute -top-0.5 -right-0.5 animate-ping" />
              )}
            </div>
            <span>لوحة تنبيهات النواقص</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                isAlertPanelOpen ? 'bg-amber-800 text-white' : 'bg-amber-200 text-amber-950'
              }`}
            >
              {totalAlertCount}
            </span>
          </button>

          {canEditPrices && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صنف جديد</span>
          </button>
          )}

          {/* Smart Inventory Audit (Mobile Stocktaking) Button */}
          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
            title="جرد المخزون السريع بالهاتف ومقارنة الأرصدة الفعلية مع النظام فورياً"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>تدقيق وجرد بالهاتف</span>
          </button>
        </div>
      </div>

      {/* VISUAL ALERT BANNER: Highlights when products are reaching minimum threshold */}
      {totalAlertCount > 0 && (
        <div className="bg-amber-50/80 border border-amber-300/80 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-950">
                  نظام التنبيه المبكر: توجد أصناف وصلت لحد الأمان الأدنى
                </h3>
                <span className="text-xs font-mono font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded">
                  {totalAlertCount} أصناف حرجة
                </span>
              </div>
              <p className="text-xs text-amber-900/90 mt-0.5">
                {outOfStockCount > 0 && (
                  <span className="font-semibold text-rose-700">
                    {outOfStockCount} صنف نفد تماماً (رصيد 0)
                  </span>
                )}
                {outOfStockCount > 0 && belowMinCount > 0 && <span> · </span>}
                {belowMinCount > 0 && (
                  <span className="font-semibold text-amber-800">
                    {belowMinCount} صنف دون حد الطلب الأدنى المحدد
                  </span>
                )}
                <span> — يرجى تعزيز الرصيد أو طلب تحويل بين الفروع لتفادي توقف مبيعات الكاشير.</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              onClick={() => setIsAlertPanelOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>لوحة النواقص والشراء المباشر ({deficitProducts.length})</span>
            </button>
            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                showLowStockOnly
                  ? 'bg-amber-700 text-white border-amber-700 shadow-xs'
                  : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {showLowStockOnly ? 'إلغاء التصفية (عرض الكل)' : 'حصر وعرض النواقص بالجدول'}
            </button>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Branch selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">الفرع:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">كافة الفروع المجمعة</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">التصنيف:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Dedicated Toggle Switch: Products needing reordering */}
          <label className={`flex items-center gap-2.5 text-xs font-semibold cursor-pointer select-none px-3 py-1.5 rounded-lg border transition-all ${
            showLowStockOnly
              ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
          }`}>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                role="switch"
                aria-checked={showLowStockOnly}
                checked={showLowStockOnly}
                onChange={(e) => setShowLowStockOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className={`w-3.5 h-3.5 ${showLowStockOnly ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>المنتجات التي تحتاج إعادة طلب فقط</span>
              <span className={`text-[11px] font-mono px-1.5 py-0.2 rounded font-bold ${
                showLowStockOnly ? 'bg-amber-200 text-amber-950' : 'bg-slate-200 text-slate-600'
              }`}>
                {totalAlertCount}
              </span>
            </div>
          </label>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الباركود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'catalog' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {showLowStockOnly && (
            <div className="px-4 py-2.5 bg-amber-50/90 border-b border-amber-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  تصفية نشطة: يتم الآن حصر وعرض{' '}
                  <strong className="font-bold text-amber-950">
                    «المنتجات التي تحتاج إعادة طلب»
                  </strong>{' '}
                  (المخزون مساوٍ أو أقل من حد الأمان). عدد الأصناف:{' '}
                  <span className="font-mono font-bold">{productStockRows.length}</span>
                </span>
              </div>
              <button
                onClick={() => setShowLowStockOnly(false)}
                className="text-amber-900 hover:text-amber-950 text-xs font-bold underline hover:no-underline"
              >
                إلغاء التصفية وعرض الكل
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">الصورة / الصنف</th>
                  <th className="py-3 px-4">التصنيف والوحدة</th>
                  <th className="py-3 px-4">الباركود (اضغط للنسخ)</th>
                  {canViewCogs && <th className="py-3 px-4">سعر التكلفة</th>}
                  <th className="py-3 px-4">سعر البيع (ج.س)</th>
                  <th className="py-3 px-4">الرصيد المتاح</th>
                  <th className="py-3 px-4">الحد الأدنى للأمان</th>
                  <th className="py-3 px-4">مقياس التوفر</th>
                  <th className="py-3 px-4">حالة المخزون والتنبيه</th>
                  <th className="py-3 px-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {productStockRows.map(({ product, quantity, minThreshold, isOutOfStock, isBelowMin, isApproaching, stockRatio }) => {
                  // Determine row visual emphasis
                  const rowClass = isOutOfStock
                    ? 'bg-rose-50/50 hover:bg-rose-50/80 transition-colors'
                    : isBelowMin
                    ? 'bg-amber-50/40 hover:bg-amber-50/70 transition-colors'
                    : 'hover:bg-slate-50/70 transition-colors';

                  return (
                    <tr key={product.id} className={rowClass}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 relative">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                                {product.name.slice(0, 1)}
                              </div>
                            )}
                            {isOutOfStock && (
                              <div className="absolute inset-0 bg-rose-900/60 flex items-center justify-center text-white font-bold text-[9px]">
                                نفد
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 leading-tight">
                                {product.name}
                              </span>
                              {isBelowMin && (
                                <span
                                  title={`تنبيه: انخفض المخزون الحالي (${quantity}) عن حد الأمان (${minThreshold})`}
                                  className="inline-flex items-center text-red-600 shrink-0"
                                >
                                  <AlertCircle className="w-4 h-4 text-red-600" />
                                </span>
                              )}
                            </div>
                            {isBelowMin && (
                              <span className="text-[10px] text-red-700 font-medium block mt-0.5">
                                انخفض عن حد الأمان ({minThreshold}) · بحاجة لتوريد (+{Math.max(1, minThreshold - quantity)} {product.unit})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-slate-800 font-medium block">{product.category}</span>
                        <span className="text-[11px] text-slate-500 font-mono">({product.unit})</span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600">
                        {product.barcode ? (
                          <button
                            type="button"
                            onClick={(e) => copyRealBarcode(product.barcode, e)}
                            title="نسخ الباركود"
                            className="group flex items-center gap-1.5 text-right max-w-full"
                          >
                            <span className="font-mono font-bold text-slate-900 select-all break-all" dir="ltr">
                              {product.barcode}
                            </span>
                            {copiedBarcode === product.barcode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-400">ما في باركود</span>
                        )}
                        {copiedBarcode === product.barcode && (
                          <div className="text-[10px] text-emerald-700 font-sans font-bold">تم نسخ الباركود</div>
                        )}
                        <div className="text-[10px] text-slate-400 select-none">{product.sku}</div>
                      </td>

                      {canViewCogs && (
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {product.purchaseCost.toLocaleString()} {product.costCurrency}
                      </td>
                      )}

                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-slate-900">{product.sellingPriceSdg.toLocaleString()} ج.س</div>
                        {product.isTaxExempt ? (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-sans font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            معفى ضريبياً
                          </span>
                        ) : (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-sans font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            خاضع {product.customTaxRate ? `${product.customTaxRate}%` : 'للضريبة'}
                          </span>
                        )}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-4 font-mono font-bold text-base">
                        <span
                          className={
                            isOutOfStock
                              ? 'text-rose-700'
                              : isBelowMin
                              ? 'text-amber-700'
                              : 'text-slate-900'
                          }
                        >
                          {quantity.toLocaleString()}
                        </span>
                        <span className="text-[11px] font-sans text-slate-500 mr-1 font-normal">
                          {product.unit}
                        </span>
                      </td>

                      {/* Minimum Stock Threshold */}
                      <td className="py-3 px-4 font-mono text-slate-700 font-semibold">
                        <span>{product.minStockAlert.toLocaleString()}</span>
                        <span className="text-[10px] font-sans text-slate-400 mr-1 font-normal">حد أدنى</span>
                      </td>

                      {/* Visual Stock Meter */}
                      <td className="py-3 px-4 min-w-[120px]">
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isOutOfStock
                                ? 'w-0'
                                : isBelowMin
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(isOutOfStock ? 0 : 8, stockRatio))}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono mt-1 text-slate-500">
                          <span>{stockRatio}% من الحد</span>
                          {isBelowMin && (
                            <span className="text-amber-700 font-bold font-sans">ناقص</span>
                          )}
                        </div>
                      </td>

                      {/* Alert State with Explicit Badge */}
                      <td className="py-3 px-4">
                        {isOutOfStock ? (
                          <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                            <span>نفاد تام (رصيد 0)</span>
                          </div>
                        ) : isBelowMin ? (
                          <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>دون الحد الأدنى</span>
                          </div>
                        ) : isApproaching ? (
                          <div className="text-slate-600 text-[11px]">
                            <span>يقترب من حد الطلب</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>رصيد آمن وكافٍ</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            // If low stock, prefill adjustment with the shortage delta
                            const suggestedDelta = isBelowMin || isOutOfStock ? product.minStockAlert * 2 - quantity : 10;
                            setAdjustDelta(suggestedDelta.toString());
                            setAdjustReason(
                              isBelowMin || isOutOfStock
                                ? `إعادة تعزيز المخزون لبلوغ حد الأمان (${product.minStockAlert})`
                                : 'تسوية جرد دوري'
                            );
                            setAdjustingProduct({
                              product,
                              currentQty: quantity,
                              branchId: selectedBranchId || branches[0]?.id || 'branch_kht_main',
                            });
                          }}
                          className={`px-2.5 py-1 text-xs rounded font-semibold whitespace-nowrap transition-colors ${
                            isOutOfStock
                              ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs'
                              : isBelowMin
                              ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isOutOfStock || isBelowMin ? 'تعزيز المخزون' : 'تسوية جردية'}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {productStockRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      لا توجد أصناف مطابقة للبحث أو التصفية الحالية.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Movements Log */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">الصنف</th>
                  <th className="py-3 px-4">نوع الحركة</th>
                  <th className="py-3 px-4">الكمية</th>
                  <th className="py-3 px-4">الرصيد بعد الحركة</th>
                  <th className="py-3 px-4">المسؤول</th>
                  <th className="py-3 px-4">السبب / الملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(m.timestamp).toLocaleString('ar-SD')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{m.productName}</td>
                    <td className="py-3 px-4">
                      {m.type === 'purchase_receive' && <span className="text-emerald-700">استلام مشتريات</span>}
                      {m.type === 'sale_deduction' && <span className="text-slate-600">بيع كاشير</span>}
                      {m.type === 'transfer_out' && <span className="text-amber-700">ترحيل صادر لفرع</span>}
                      {m.type === 'transfer_in' && <span className="text-blue-700">ترحيل وارد من فرع</span>}
                      {m.type === 'adjustment' && <span className="text-purple-700">تسوية جرد</span>}
                      {m.type === 'damage_expired' && <span className="text-rose-700">تالف / منتهي</span>}
                      {m.type === 'return_refund' && <span className="text-emerald-700">مرتجع مبيعات</span>}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      <span className={m.quantityDelta > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{m.balanceAfter}</td>
                    <td className="py-3 px-4 text-slate-700">{m.actorName}</td>
                    <td className="py-3 px-4 text-slate-500">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD PRODUCT MODAL
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddProduct}
            className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col"
          >
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">إضافة صنف جديد لدليل المنتجات</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">اسم المنتج التجاري الكامل:</label>
                <input
                  type="text"
                  required
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="مثال: زيت صباح نقي 4.5 لتر"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">التصنيف:</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الوحدة:</label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="مثال: حبة / باكت / كرتونة"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الباركود:</label>
                  <input
                    type="text"
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    placeholder="امسح أو اترك للتوليد التلقائي"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">رمز SKU:</label>
                  <input
                    type="text"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="توليد تلقائي"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {canViewCogs && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">سعر التكلفة:</label>
                  <input
                    type="number"
                    required
                    value={newPurchaseCost}
                    onChange={(e) => setNewPurchaseCost(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                )}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">سعر البيع (ج.س):</label>
                  <input
                    type="number"
                    required
                    value={newSellingPrice}
                    onChange={(e) => setNewSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 font-mono font-bold text-emerald-800 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">حد تنبيه النواقص:</label>
                  <input
                    type="number"
                    value={newMinAlert}
                    onChange={(e) => setNewMinAlert(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">الرصيد الافتتاحي في هذا الفرع:</label>
                <input
                  type="number"
                  value={newInitialStock}
                  onChange={(e) => setNewInitialStock(e.target.value)}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">صورة الصنف:</label>
                  <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-400 bg-slate-50 px-2 py-3 cursor-pointer min-h-[7.5rem]">
                    {newImageUrl ? (
                      <img src={newImageUrl} alt="" className="max-h-24 w-full object-contain rounded-lg" />
                    ) : mediaBusy === 'image' ? (
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                    ) : (
                      <>
                        <ImageIcon className="w-6 h-6 text-emerald-600" />
                        <span className="font-bold text-slate-700">اختر صورة</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        pickProductImage(e.target.files?.[0] || null);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {newImageUrl && (
                    <button type="button" onClick={() => setNewImageUrl('')} className="mt-1 text-[10px] text-rose-600 font-bold">
                      حذف الصورة
                    </button>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    فيديو قصير (حتى {PRODUCT_VIDEO_MAX_SECONDS} ثوانٍ):
                  </label>
                  <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-400 bg-slate-50 px-2 py-3 cursor-pointer min-h-[7.5rem]">
                    {newVideoUrl ? (
                      <video src={newVideoUrl} className="max-h-24 w-full rounded-lg" muted playsInline />
                    ) : mediaBusy === 'video' ? (
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                    ) : (
                      <>
                        <Video className="w-6 h-6 text-emerald-600" />
                        <span className="font-bold text-slate-700 text-center leading-tight">اختر فيديو قصير جداً</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        pickProductVideo(e.target.files?.[0] || null);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {newVideoUrl && (
                    <button type="button" onClick={() => setNewVideoUrl('')} className="mt-1 text-[10px] text-rose-600 font-bold">
                      حذف الفيديو
                    </button>
                  )}
                </div>
              </div>
              {mediaError && (
                <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-800">
                  {mediaError}
                </p>
              )}

              {/* VAT (ضريبة القيمة المضافة) Settings per Product */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px]">حالة ضريبة القيمة المضافة (VAT):</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newIsTaxExempt}
                      onChange={(e) => setNewIsTaxExempt(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded"
                    />
                    <span className="font-semibold text-amber-800 text-[11px]">معفى من ضريبة القيمة المضافة</span>
                  </label>
                </div>

                {!newIsTaxExempt ? (
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 pt-1">
                    <span>نسبة الضريبة المخصصة % (اختياري، اترك فارغاً لتطبيق النسبة الافتراضية للمنشأة):</span>
                    <input
                      type="number"
                      placeholder="افتراضي (15%)"
                      value={newCustomTaxRate}
                      onChange={(e) => setNewCustomTaxRate(e.target.value)}
                      className="w-24 px-2 py-1 font-mono text-[11px] border border-slate-300 rounded bg-white"
                    />
                  </div>
                ) : (
                  <p className="text-[10px] text-amber-700">
                    هذا الصنف معفى بنسبة 0% ولن تُحتسب عليه أي ضريبة في فواتير الكاشير.
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !!mediaBusy}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-50"
              >
                حفظ المنتج
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          STOCK ADJUSTMENT MODAL
          ========================================================================= */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAdjustStock}
            className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">تسوية رصيد مخزني</h3>
                <p className="text-[11px] text-slate-400">{adjustingProduct.product.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between">
                <span className="text-slate-600 font-semibold">الرصيد الحالي المسجل بالفرع:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {adjustingProduct.currentQty} {adjustingProduct.product.unit}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">نوع التسوية:</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="adjustment">تسوية جردية عامة (زيادة أو نقص)</option>
                  <option value="damage_expired">إتلاف بضاعة منتهية الصلاحية أو مكسورة</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  كمية التعديل (موجب للإضافة، سالب للخصم):
                </label>
                <input
                  type="number"
                  required
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="مثال: -5 أو +10"
                  className="w-full px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  الرصيد الجديد المتوقع سيكون:{' '}
                  <strong className="font-mono text-slate-900">
                    {adjustingProduct.currentQty + (Number(adjustDelta) || 0)}
                  </strong>
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">سبب التسوية الإلزامي:</label>
                <textarea
                  required
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="اذكر السبب للتدقيق والرقابة المالية..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                تطبيق التسوية
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          SIDE ALERT PANEL (لوحة تنبيهات النواقص وتجاوز حد إعادة الطلب)
          ========================================================================= */}
      {isAlertPanelOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsAlertPanelOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          {/* Slide-in Drawer Container */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 border-s border-slate-200 animate-in slide-in-from-left duration-300">
            {/* Drawer Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">لوحة تنبيهات النواقص وإعادة الطلب</h3>
                    <span className="text-[11px] font-mono bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                      {deficitProducts.length} أصناف
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    الأصناف التي تجاوزت حد الأمان وبحاجة لإصدار أمر شراء عاجل
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAlertPanelOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Bulk Action Banner */}
            <div className="p-4 bg-amber-50/90 border-b border-amber-200 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-amber-950">
                <span className="font-bold block">إجراء توريد سريع:</span>
                <span className="text-[11px] text-amber-900">
                  يمكنك إنشاء أمر شراء مجمع لكافة الأصناف الناقصة دفعة واحدة.
                </span>
              </div>
              <button
                onClick={openBulkPoForDeficitItems}
                disabled={deficitProducts.length === 0}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>طلب شراء جماعي</span>
              </button>
            </div>

            {/* Products List in Side Panel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {deficitProducts.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">المخزون في حالة ممتازة!</p>
                  <p className="text-xs">لا توجد حالياً أي منتجات تجاوزت حد إعادة الطلب الأدنى.</p>
                </div>
              ) : (
                deficitProducts.map((row) => {
                  const prod = row.product;
                  const shortage = Math.max(1, row.minThreshold - row.quantity);
                  const suggestedOrder = Math.max(row.minThreshold, row.minThreshold * 2 - row.quantity);
                  const estCost = suggestedOrder * prod.purchaseCost;

                  return (
                    <div
                      key={prod.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 relative">
                          {prod.imageUrl ? (
                            <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">
                              {prod.name.slice(0, 1)}
                            </div>
                          )}
                          {row.isOutOfStock && (
                            <div className="absolute inset-0 bg-rose-900/70 flex items-center justify-center text-white font-bold text-[9px]">
                              نفد
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-xs text-slate-900 truncate">{prod.name}</h4>
                            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                            <span>{prod.category}</span>
                            <span>·</span>
                            <span>{prod.sku}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stock stats grid */}
                      <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-lg text-center font-mono text-[11px] border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">الرصيد المتاح</span>
                          <span className={`font-bold ${row.isOutOfStock ? 'text-rose-700' : 'text-amber-700'}`}>
                            {row.quantity} {prod.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">حد إعادة الطلب</span>
                          <span className="font-bold text-slate-700">
                            {row.minThreshold} {prod.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">مقدار النقص</span>
                          <span className="font-bold text-rose-700">
                            -{shortage} {prod.unit}
                          </span>
                        </div>
                      </div>

                      {/* Cost & Direct Purchase Action */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[11px]">
                          <span className="text-slate-500 block">التكلفة التقديرية للتعزيز:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {estCost.toLocaleString()} ج.س
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono mr-1">
                            ({suggestedOrder} {prod.unit})
                          </span>
                        </div>

                        <button
                          onClick={() => openDirectPoForItem(row)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إنشاء أمر شراء مباشر</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DIRECT PURCHASE ORDER MODAL (إنشاء أمر شراء مباشر)
          ========================================================================= */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitDirectPo}
            className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-sm">إنشاء أمر شراء وتوريد مباشر للمخزون</h3>
                  <p className="text-[11px] text-emerald-200 mt-0.5">
                    سيتم قيد أمر الشراء واستلام الأصناف مباشرة وإضافتها لأرصدة الفرع
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPoModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Branch selection */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الفرع المستلم:</label>
                  <select
                    value={poBranchId}
                    onChange={(e) => setPoBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* PO / Invoice Number */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">رقم أمر الشراء / الفاتورة:</label>
                  <input
                    type="text"
                    required
                    value={poInvoiceNo}
                    onChange={(e) => setPoInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 font-mono font-semibold border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Supplier Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">اسم المورد / شركة التوريد:</label>
                <input
                  type="text"
                  required
                  value={poSupplier}
                  onChange={(e) => setPoSupplier(e.target.value)}
                  placeholder="أدخل اسم المورد أو اختر من المقترحات أدناه..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-slate-400">موردين معتمدين:</span>
                  {[
                    'شركة سكر كنانة المحدودة',
                    'مجموعة سيقا للسلع الغذائية',
                    'شركة الغزالتين للشاي',
                    'شركة أروما للبن والبهارات',
                    'المورد المحلي المعتمد',
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPoSupplier(s)}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items List Table */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  أصناف التوريد والكميات المطلوبة ({poItems.length} أصناف):
                </label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">الصنف</th>
                        <th className="py-2 px-3">الرصيد / الحد</th>
                        <th className="py-2 px-3 w-24">الكمية المطلوبة</th>
                        <th className="py-2 px-3 w-28">سعر التكلفة (ج.س)</th>
                        <th className="py-2 px-3">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {poItems.map((item, idx) => (
                        <tr key={item.productId} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {item.productName}
                            <span className="text-[10px] text-slate-400 block font-normal">({item.unit})</span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                            <span className="text-rose-700 font-bold">{item.currentStock}</span> / {item.reorderPoint}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="1"
                              required
                              value={item.orderQuantity}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value) || 1);
                                setPoItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, orderQuantity: val } : it))
                                );
                              }}
                              className="w-20 px-2 py-1 text-center font-mono font-bold border border-slate-300 rounded"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              required
                              value={item.unitCostSdg}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                setPoItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, unitCostSdg: val } : it))
                                );
                              }}
                              className="w-24 px-2 py-1 text-center font-mono font-bold border border-slate-300 rounded"
                            />
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            {(item.orderQuantity * item.unitCostSdg).toLocaleString()} ج.س
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Order Summary */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-300 block">إجمالي قيمة أمر الشراء:</span>
                  <span className="text-[11px] text-slate-400">
                    {poItems.reduce((acc, it) => acc + it.orderQuantity, 0)} قطعة / عبوة إجمالية
                  </span>
                </div>
                <div className="font-mono text-xl font-bold text-emerald-400">
                  {poItems.reduce((acc, it) => acc + it.orderQuantity * it.unitCostSdg, 0).toLocaleString()} ج.س
                </div>
              </div>

              {/* Payment Status & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">حالة السداد للمورد:</label>
                  <select
                    value={poPaymentStatus}
                    onChange={(e) => setPoPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="paid">مدفوع نقداً / تحويل فوري</option>
                    <option value="partial">سداد جزئي</option>
                    <option value="credit">آجل على الحساب (Credit)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ملاحظات أمر التوريد:</label>
                  <input
                    type="text"
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                    placeholder="ملاحظات التسليم أو رقم السند..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsPoModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isPoSubmitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isPoSubmitting ? 'جاري تأكيد التوريد...' : 'تأكيد واستلام أمر الشراء بالمخزون'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Smart Inventory Audit Modal */}
      <InventoryAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        branch={currentBranch}
        branches={branches}
        products={products}
        onAuditCompleted={() => {
          loadData();
          onRefresh();
        }}
      />
    </div>
  );
};
