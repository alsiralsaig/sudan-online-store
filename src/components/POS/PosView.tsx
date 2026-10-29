import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  CreditCard,
  QrCode,
  Smartphone,
  Banknote,
  Percent,
  X,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Camera,
  UtensilsCrossed,
  Tag,
  FileText,
  DollarSign,
  Globe,
  Settings,
  Users,
  Star,
  UserPlus,
  Mic,
} from 'lucide-react';
import type {
  Product,
  Branch,
  CashierShift,
  Sale,
  SaleItem,
  Customer,
  CurrencyConfig,
  MultiCurrencyPayment,
  ThermalReceiptSettings,
  PosPrinterSettings,
  PromotionRule,
  Tenant,
} from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { generateZatcaTlvBase64, generateQrSvg } from '../../lib/zatcaQr.ts';
import { CameraBarcodeScanner } from './CameraBarcodeScanner.tsx';
import { CopyBarcodeButton } from '../Common/CopyBarcodeButton.tsx';
import { findByBarcodeOrSku, looksLikeBarcode, pastedBarcode, productMatchesSearch } from '../../lib/barcodeMatch.ts';
import { PosPrinterModal } from './PosPrinterModal.tsx';
import { PosCustomerModal } from './PosCustomerModal.tsx';
import { VoiceSaleAssistant } from './VoiceSaleAssistant.tsx';
import {
  getPosPrinterSettings,
  getThermalReceiptSettings,
  executePosPrint,
  resolveReceiptSettings,
} from '../../lib/printerSettings.ts';

interface PosViewProps {
  products: Product[];
  currentBranch: Branch | null;
  activeShift: CashierShift | null;
  currencies?: CurrencyConfig[];
  onRefreshShift: () => void;
  onOpenShiftModal: () => void;
  onOpenKitchen?: () => void;
  isOffline: boolean;
  onSaleCompleted: (sale: Sale, isOffline?: boolean) => void;
  tenant?: Tenant | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  notes?: string; // Quick order notes: 'بدون ثلج', 'تغليف هدايا', etc.
}

const QUICK_ORDER_TAGS = [
  'بدون ثلج',
  'تغليف هدايا',
  'بدون سكر',
  'سفري / تيك أواي',
  'تسليم فوري',
  'ساخن جداً',
  'شطة إضافية',
  'مع فاتورة ضريبية',
];

export const PosView: React.FC<PosViewProps> = ({
  products,
  currentBranch,
  activeShift,
  currencies = [],
  onRefreshShift,
  onOpenShiftModal,
  onOpenKitchen,
  isOffline,
  onSaleCompleted,
  tenant = null,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('عميل نقدي');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [promotions, setPromotions] = useState<PromotionRule[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');

  useEffect(() => {
    api
      .getPromotions()
      .then((res) => {
        if (res && res.promotions) {
          setPromotions(res.promotions.filter((p) => p.isActive));
        }
      })
      .catch(() => {});
  }, []);

  // Camera Barcode Scanner Modal
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  // Default Printer & Thermal Receipt Settings
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [printerSettings, setPrinterSettings] = useState<PosPrinterSettings>(getPosPrinterSettings());
  const [receiptSettings, setReceiptSettings] = useState<ThermalReceiptSettings>(() =>
    resolveReceiptSettings(tenant, currentBranch)
  );

  useEffect(() => {
    const sync = () => setReceiptSettings(resolveReceiptSettings(tenant, currentBranch));
    sync();
    window.addEventListener('sanad_receipt_settings_updated', sync);
    return () => window.removeEventListener('sanad_receipt_settings_updated', sync);
  }, [tenant, currentBranch]);

  // Quick Order item note editing
  const [editingNoteProductId, setEditingNoteProductId] = useState<string | null>(null);
  const [customNoteText, setCustomNoteText] = useState('');

  // Multi-Currency Collection in Payment Modal
  const [selectedCurrency, setSelectedCurrency] = useState<string>('SDG');
  const [customExchangeRate, setCustomExchangeRate] = useState<number>(1);
  const [foreignCashReceived, setForeignCashReceived] = useState<string>('');

  // Scanner Audio & Status
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scannerNotification, setScannerNotification] = useState<{
    type: 'success' | 'error';
    title: string;
    description: string;
    barcode: string;
  } | null>(null);
  const [isSimulatingScan, setIsSimulatingScan] = useState(false);
  const notifTimeoutRef = useRef<any>(null);

  // Keyboard wedge scanner buffers
  const scannerBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const keyTimestampsRef = useRef<number[]>([]);

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bankak' | 'fawry' | 'syberpay' | 'split'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitBankak, setSplitBankak] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Completed Receipt Modal
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Sync settings when updated in other tabs or Admin
  useEffect(() => {
    const handleReceiptUpdate = () => setReceiptSettings(getThermalReceiptSettings());
    const handlePrinterUpdate = () => setPrinterSettings(getPosPrinterSettings());
    window.addEventListener('sanad_receipt_settings_updated', handleReceiptUpdate);
    window.addEventListener('sanad_printer_settings_updated', handlePrinterUpdate);
    return () => {
      window.removeEventListener('sanad_receipt_settings_updated', handleReceiptUpdate);
      window.removeEventListener('sanad_printer_settings_updated', handlePrinterUpdate);
    };
  }, []);

  // Synthesize realistic POS beep tone using Web Audio API
  const playBeep = useCallback((success: boolean) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (success) {
        // High crisp POS scanner chirp (1600Hz -> 1800Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1850, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else {
        // Warning low frequency tone (300Hz)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch {
      // Audio autoplay policy handled smoothly
    }
  }, [soundEnabled]);

  // Show floating notification
  const triggerScannerToast = (
    type: 'success' | 'error',
    title: string,
    description: string,
    barcode: string
  ) => {
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    setScannerNotification({ type, title, description, barcode });
    notifTimeoutRef.current = setTimeout(() => {
      setScannerNotification(null);
    }, 2800);
  };

  /** البيع بالصوت */
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  /** إضافة أصناف تحلّلت من اللهجة السودانية — بكمية وسعر وحدة محسوبين */
  const applyVoiceItems = useCallback(
    (items: { product: Product; quantity: number; unitPrice: number; note: string }[]) => {
      setCart((prev) => {
        const next = [...prev];
        for (const item of items) {
          const idx = next.findIndex(
            (line) => line.product.id === item.product.id && line.unitPrice === item.unitPrice
          );
          if (idx >= 0) {
            next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity };
          } else {
            next.push({
              product: item.product,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: 0,
              notes: item.note,
            } as any);
          }
        }
        return next;
      });
      playBeep(true);
    },
    [playBeep]
  );

  // Add to cart
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].quantity += 1;
        return next;
      }
      return [...prev, { product, quantity: 1, unitPrice: product.sellingPriceSdg, discount: 0 }];
    });
  }, []);

  // Process barcode input (used by both hardware scanner and manual submission)
  const processBarcodeScan = useCallback((code: string, source: 'hardware_scanner' | 'manual' = 'hardware_scanner') => {
    const cleanCode = code.trim();
    if (!cleanCode) return false;

    // Search product by barcode or SKU
    const found = findByBarcodeOrSku(products, cleanCode);

    if (found) {
      addToCart(found);
      playBeep(true);
      triggerScannerToast(
        'success',
        `تم مسح الباركود: ${found.name}`,
        `${found.sellingPriceSdg.toLocaleString()} ج.س · تم زيادة الكمية بالسلة بنجاح (${source === 'hardware_scanner' ? 'ماسح ضوئي' : 'إدخال يدوي'})`,
        cleanCode
      );
      setBarcodeInput('');
      return true;
    } else {
      playBeep(false);
      triggerScannerToast(
        'error',
        'صنف غير مسجل',
        `لم يتم العثور على أي منتج يطابق الباركود: ${cleanCode}`,
        cleanCode
      );
      return false;
    }
  }, [products, addToCart, playBeep]);

  // Global Keyboard Wedge Event Listener for Hardware Barcode Scanners
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // If user is typing in regular text inputs other than our barcode input,
      // only intercept if keystrokes are coming in at scanner speed (< 50ms)
      const now = performance.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;

      // Handle barcode termination (Enter key)
      if (event.key === 'Enter') {
        const buffer = scannerBufferRef.current.trim();
        const timestamps = keyTimestampsRef.current;

        // If buffer has minimum barcode length (at least 3 characters)
        if (buffer.length >= 3 && timestamps.length >= 2) {
          const totalDuration = now - timestamps[0];
          const avgInterval = totalDuration / timestamps.length;

          // Hardware scanners type extremely fast: avg interval is typically < 65ms
          // Or if target wasn't an input at all (cashier scanning hands-free)
          const isHardwareScanner = avgInterval < 75 || !isInput || target?.id === 'pos-barcode-field';

          if (isHardwareScanner) {
            event.preventDefault();
            event.stopPropagation();
            processBarcodeScan(buffer, 'hardware_scanner');

            // Reset buffers
            scannerBufferRef.current = '';
            keyTimestampsRef.current = [];
            lastKeyTimeRef.current = 0;
            return;
          }
        }

        // Reset if Enter was pressed
        scannerBufferRef.current = '';
        keyTimestampsRef.current = [];
        lastKeyTimeRef.current = 0;
        return;
      }

      // Ignore modifier and non-printable keys
      if (
        event.key.length !== 1 ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      ) {
        return;
      }

      // Inter-character timing check:
      // If gap is too large (> 120ms), this is a new scan sequence or human typing
      if (timeSinceLastKey > 120) {
        scannerBufferRef.current = event.key;
        keyTimestampsRef.current = [now];
      } else {
        scannerBufferRef.current += event.key;
        keyTimestampsRef.current.push(now);
      }
      lastKeyTimeRef.current = now;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    };
  }, [processBarcodeScan]);

  // Barcode quick add form submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    processBarcodeScan(barcodeInput, 'manual');
  };

  // Simulate hardware scanner wedge for testing
  const simulateHardwareScan = (barcodeToScan: string) => {
    setIsSimulatingScan(true);
    // Simulate keyboard wedge bursts
    processBarcodeScan(barcodeToScan, 'hardware_scanner');
    setTimeout(() => {
      setIsSimulatingScan(false);
    }, 400);
  };

  // Extract categories
  const categories = ['الكل', ...Array.from(new Set(products.map((p) => p.category)))];

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'الكل' || p.category === selectedCategory;
    const matchesSearch = productMatchesSearch(p, searchQuery);
    return matchesCategory && matchesSearch && p.isActive;
  });

  // Update item quantity
  /**
   * كتابة الكمية يدوياً (كيلو / نصف كيلو / دستة).
   * ليه: أزرار + و − تعمل خطوة واحدة، وبيع ٢٥ كيلو بالضغط ٢٥ مرة غير عملي.
   */
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});

  const setQuantity = (productId: string, value: string) => {
    /* نُبقي النص كما كتبه المستخدم (يسمح بـ «1.5» و«0.») ونحدّث السلة إن صحّ */
    setQtyDraft((prev) => ({ ...prev, [productId]: value }));
    const parsed = Number(value.replace(',', '.'));
    if (!value.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: parsed } : item))
    );
  };

  const commitQuantity = (productId: string) => {
    /* عند مغادرة الحقل: نُنظّف المسودة فيظهر الرقم الحقيقي من السلة */
    setQtyDraft((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setQtyDraft((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove item
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Quick Note Helpers
  const toggleQuickTag = (productId: string, tag: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const currentNotes = item.notes ? item.notes.split(' · ') : [];
          const exists = currentNotes.includes(tag);
          const updated = exists ? currentNotes.filter((t) => t !== tag) : [...currentNotes, tag];
          return { ...item, notes: updated.join(' · ') || undefined };
        }
        return item;
      })
    );
  };

  const setItemCustomNote = (productId: string, note: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          return { ...item, notes: note.trim() || undefined };
        }
        return item;
      })
    );
    setEditingNoteProductId(null);
    setCustomNoteText('');
  };

  const removeItemNote = (productId: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          return { ...item, notes: undefined };
        }
        return item;
      })
    );
  };

  // Currency Selection Helper
  const handleCurrencySelect = (code: string) => {
    setSelectedCurrency(code);
    if (code === 'SDG') {
      setCustomExchangeRate(1);
      setForeignCashReceived('');
    } else {
      const found = currencies.find((c) => c.code === code);
      let defaultRate = 2750;
      if (code === 'USD') defaultRate = 2750;
      else if (code === 'SAR') defaultRate = 733.33;
      else if (code === 'TRY') defaultRate = 82.5;
      else if (code === 'EGP') defaultRate = 56.8;
      else if (code === 'AED') defaultRate = 748.5;
      else if (code === 'EUR') defaultRate = 2980;
      else if (code === 'QAR') defaultRate = 755;
      else if (found) defaultRate = found.rateToSdg;

      const activeRate = found?.rateToSdg && found.rateToSdg > 0 ? found.rateToSdg : defaultRate;
      setCustomExchangeRate(activeRate);
      const foreignTotal = (grandTotal / activeRate).toFixed(2);
      setForeignCashReceived(foreignTotal);
    }
  };

  // VAT and Tax Calculations
  const isVatActive = receiptSettings.vatEnabled ?? true;
  const defaultVatPct = receiptSettings.defaultVatPct ?? 15;
  const isPricesIncludeVat = receiptSettings.pricesIncludeVat ?? false;

  let computedTaxTotal = 0;
  const processedCartItems = cart.map((item) => {
    const isExempt = Boolean(item.product.isTaxExempt);
    const taxRate = isExempt || !isVatActive ? 0 : Number(item.product.customTaxRate ?? defaultVatPct);
    const lineTotal = item.quantity * item.unitPrice - item.discount;
    let taxAmount = 0;
    if (isVatActive && taxRate > 0) {
      if (isPricesIncludeVat) {
        taxAmount = lineTotal - lineTotal / (1 + taxRate / 100);
      } else {
        taxAmount = lineTotal * (taxRate / 100);
      }
    }
    computedTaxTotal += taxAmount;
    return {
      ...item,
      isTaxExempt: isExempt,
      taxRate,
      taxAmount,
    };
  });

  // ==========================================
  // Automatic Promotions Engine
  // ==========================================
  const appliedPromotions: Array<{
    id: string;
    title: string;
    discountSdg: number;
    description?: string;
  }> = [];

  for (const promo of promotions) {
    if (!promo.isActive) continue;

    if (promo.type === 'buy_x_get_y' && promo.buyProductId && promo.buyQuantity && promo.freeQuantity) {
      const cartItem = cart.find((it) => it.product.id === promo.buyProductId);
      if (cartItem) {
        const step = promo.buyQuantity + promo.freeQuantity;
        let freeSets = Math.floor(cartItem.quantity / step);
        if (freeSets === 0 && cartItem.quantity >= promo.buyQuantity) {
          freeSets = Math.floor(cartItem.quantity / promo.buyQuantity);
        }
        if (freeSets > 0) {
          const disc = Math.round(freeSets * promo.freeQuantity * cartItem.unitPrice);
          if (disc > 0) {
            appliedPromotions.push({
              id: promo.id,
              title: promo.title,
              discountSdg: disc,
              description: `عرض اشترِ ${promo.buyQuantity} واحصل على ${promo.freeQuantity} مجاناً`,
            });
          }
        }
      }
    } else if (promo.type === 'qty_discount_pct' && promo.productId && promo.minQuantity && promo.discountPct) {
      const cartItem = cart.find((it) => it.product.id === promo.productId);
      if (cartItem && cartItem.quantity >= promo.minQuantity) {
        const itemGross = cartItem.quantity * cartItem.unitPrice;
        const disc = Math.round(itemGross * (promo.discountPct / 100));
        if (disc > 0) {
          appliedPromotions.push({
            id: promo.id,
            title: promo.title,
            discountSdg: disc,
            description: `خصم كمية ${promo.discountPct}% على «${cartItem.product.name}»`,
          });
        }
      }
    } else if (promo.type === 'cart_fixed_discount' && promo.minCartTotalSdg && promo.discountAmountSdg) {
      const currentGross = cart.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
      if (currentGross >= promo.minCartTotalSdg) {
        appliedPromotions.push({
          id: promo.id,
          title: promo.title,
          discountSdg: promo.discountAmountSdg,
          description: `خصم مكافأة السلة الكبيرة`,
        });
      }
    }
  }

  const autoPromoDiscountTotal = appliedPromotions.reduce((acc, p) => acc + p.discountSdg, 0);
  const totalCombinedDiscount = discountTotal + autoPromoDiscountTotal;

  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unitPrice - item.discount, 0);
  const taxTotal = Math.round(computedTaxTotal * 100) / 100;
  const grandTotal = isPricesIncludeVat
    ? Math.max(0, subtotal - totalCombinedDiscount)
    : Math.max(0, subtotal - totalCombinedDiscount + taxTotal);

  // Open Payment modal
  const handleProceedToPayment = () => {
    if (!cart.length) return;
    if (!activeShift) {
      alert('لا توجد وردية مفتوحة للكاشير. يرجى فتح الوردية أولاً لتسجيل المبيعات.');
      onOpenShiftModal();
      return;
    }
    setCashReceived(grandTotal.toString());
    setSplitCash(Math.round(grandTotal / 2));
    setSplitBankak(Math.round(grandTotal / 2));
    setSelectedCurrency('SDG');
    setCustomExchangeRate(1);
    setForeignCashReceived('');
    setErrorMsg(null);
    setIsPaymentModalOpen(true);
  };

  // Submit Sale
  const handleFinalizeSale = async () => {
    if (!currentBranch || !activeShift) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const saleItems: SaleItem[] = processedCartItems.map((i) => ({
      productId: i.product.id,
      productName: i.product.name,
      unit: i.product.unit,
      quantity: i.quantity,
      unitPriceSdg: i.unitPrice,
      discountSdg: i.discount,
      totalSdg: i.quantity * i.unitPrice - i.discount,
      costPerUnitSdg: i.product.purchaseCost,
      notes: i.notes || undefined,
      isTaxExempt: i.isTaxExempt,
      taxRate: i.taxRate,
      taxAmountSdg: Math.round(i.taxAmount * 100) / 100,
    }));

    const currencyNames: Record<string, string> = {
      USD: 'دولار أمريكي',
      SAR: 'ريال سعودي',
      AED: 'درهم إماراتي',
      EUR: 'يورو',
    };
    const currencySymbols: Record<string, string> = {
      USD: '$',
      SAR: 'ر.س',
      AED: 'د.إ',
      EUR: '€',
    };

    let multiCurrencyData: MultiCurrencyPayment | undefined = undefined;
    if (selectedCurrency !== 'SDG' && customExchangeRate > 0) {
      const totalForeign = Number((grandTotal / customExchangeRate).toFixed(2));
      const receivedForeign = Number(foreignCashReceived) || totalForeign;
      const changeForeign = Math.max(0, Number((receivedForeign - totalForeign).toFixed(2)));
      const changeSdg = Math.round(changeForeign * customExchangeRate);

      multiCurrencyData = {
        currencyCode: selectedCurrency,
        currencyName: currencyNames[selectedCurrency] || selectedCurrency,
        currencySymbol: currencySymbols[selectedCurrency] || selectedCurrency,
        exchangeRate: customExchangeRate,
        totalForeign,
        amountReceivedForeign: receivedForeign,
        changeForeign,
        changeSdg,
      };
    }

    const payload = {
      branchId: currentBranch.id,
      shiftId: activeShift.id,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer ? selectedCustomer.name : customerName,
      customerPhone: selectedCustomer ? selectedCustomer.phone : customerPhone,
      items: saleItems,
      discountTotalSdg: totalCombinedDiscount,
      taxTotalSdg: taxTotal,
      vatEnabled: isVatActive,
      defaultVatPct,
      pricesIncludeVat: isPricesIncludeVat,
      paymentMethod,
      paymentReference: paymentMethod === 'bankak' ? paymentReference : undefined,
      splitDetails:
        paymentMethod === 'split'
          ? {
              cashAmountSdg: Number(splitCash),
              bankakAmountSdg: Number(splitBankak),
              fawryAmountSdg: 0,
              cardAmountSdg: 0,
            }
          : undefined,
      multiCurrency: multiCurrencyData,
    };

    try {
      const res: any = await api.recordSale(payload);
      if (res.success) {
        setCompletedSale(res.sale);
        if (res.customer) {
          setSelectedCustomer(res.customer);
        }
        setCart([]);
        setDiscountTotal(0);
        setIsPaymentModalOpen(false);
        onSaleCompleted(res.sale, res.isOffline);
        onRefreshShift();

        // Auto-print to default printer if enabled
        if (printerSettings.autoPrintOnSale) {
          setTimeout(() => {
            executePosPrint('printable-receipt', printerSettings);
          }, 350);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء إتمام عملية البيع');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Thermal print trigger
  const handlePrint = async () => {
    await executePosPrint('printable-receipt', printerSettings);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-0 lg:h-[calc(100dvh-9.5rem)] overflow-x-hidden overflow-y-auto lg:overflow-hidden bg-slate-950">
      {/* Shift status alert banner if no open shift */}
      {!activeShift && (
        <div className="absolute top-16 left-0 right-0 z-30 bg-amber-500 text-white px-6 py-2.5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="w-4 h-4" />
            <span>تنبيه: لا توجد وردية مفتوحة حالياً للكاشير. لن تتمكن من إصدار الفواتير حتى فتح الوردية.</span>
          </div>
          <button
            onClick={onOpenShiftModal}
            className="px-4 py-1 text-xs font-bold bg-white text-amber-900 rounded-md hover:bg-amber-100 transition-colors whitespace-nowrap"
          >
            افتتاح الوردية الآن
          </button>
        </div>
      )}

      {isVoiceOpen && (
        <VoiceSaleAssistant
          products={products}
          onClose={() => setIsVoiceOpen(false)}
          onApply={applyVoiceItems}
        />
      )}

      {/* Floating Hardware Scanner Toast Alert */}
      {scannerNotification && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            scannerNotification.type === 'success'
              ? 'bg-emerald-950/95 text-white border-emerald-500/50 shadow-emerald-950/40'
              : 'bg-rose-950/95 text-white border-rose-500/50 shadow-rose-950/40'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              scannerNotification.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            {scannerNotification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs">{scannerNotification.title}</span>
              <span className="font-mono text-[10px] bg-white/20 px-1.5 py-0.5 rounded tracking-wider">
                {scannerNotification.barcode}
              </span>
            </div>
            <p className="text-[11px] text-slate-200 mt-0.5">{scannerNotification.description}</p>
          </div>
          <button
            onClick={() => setScannerNotification(null)}
            className="text-white/60 hover:text-white mr-1 text-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Left/Main Column: Product Catalog & Search */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Hardware & Camera Barcode Scanner Status Banner */}
        <div className="bg-slate-900 text-white px-3 py-2 rounded-xl mb-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 shadow-sm border border-slate-800 overflow-visible">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 relative" />
            </div>
            <Barcode className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-100">
              ماسح الباركود متصل وجاهز
            </span>
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              (دعم تلقائي لأجهزة قارئ الباركود USB/Wedge أو كاميرا الهاتف)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {/* Camera Barcode Scanner Trigger Button */}
            <button
              type="button"
              onClick={() => setIsCameraScannerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all shrink-0"
              title="فتح كاميرا الجهاز لمسح باركود المنتجات تلقائياً"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>مسح بالكاميرا</span>
            </button>

            {/* البيع بالصوت — اللهجة السودانية */}
            <button
              type="button"
              onClick={() => setIsVoiceOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-lg text-xs font-black shadow-sm transition-all shrink-0"
              title="اتكلم باللهجة السودانية والسلة تتملى وحدها"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>بيع بالصوت</span>
            </button>

            {/* Default Printer Settings Trigger Button */}
            <button
              type="button"
              onClick={() => setIsPrinterModalOpen(true)}
              title="تخصيص الطابعة الافتراضية (بلوتوث أو شبكية أو المتصفح)"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold border border-slate-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">
                طابعة: {printerSettings.printerType === 'bluetooth' ? 'بلوتوث' : printerSettings.printerType === 'network' ? 'شبكة IP' : 'المتصفح'} ({printerSettings.paperWidth})
              </span>
            </button>

            {/* Audio Feedback Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'كتم صوت رنين المسح' : 'تفعيل صوت رنين المسح (Beep)'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border ${
                soundEnabled
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
              <span className="hidden md:inline">{soundEnabled ? 'صوت' : 'صامت'}</span>
            </button>

            {/* Customers & Loyalty CRM Trigger Button */}
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              title="دليل العملاء وبرنامج نقاط الولاء (CRM)"
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-bold border border-amber-500/40 transition-all shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="whitespace-nowrap">العملاء والولاء</span>
              {selectedCustomer && (
                <span className="bg-amber-500 text-slate-900 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black">
                  ⭐ {selectedCustomer.loyaltyPoints || 0}
                </span>
              )}
            </button>

            {/* Quick Kitchen Display System (KDS) Button */}
            {onOpenKitchen && (
              <button
                type="button"
                onClick={onOpenKitchen}
                title="الانتقال إلى لوحة شاشة المطبخ (KDS) لمتابعة تحضير الطلبات"
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-xs font-bold border border-emerald-500/40 transition-all"
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-400" />
                <span>شاشة المطبخ</span>
              </button>
            )}

            {tenant?.id === 'tenant_alrowad' && (
              <div className="hidden xl:flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 px-1 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>تجربة:</span>
                </span>
                <button
                  type="button"
                  onClick={() => simulateHardwareScan('628100123001')}
                  className="px-1.5 py-0.5 text-[10px] bg-slate-700 hover:bg-emerald-600 text-white rounded transition-colors"
                  title="محاكاة مسح باركود: سكر كنانة"
                >
                  سكر
                </button>
                <button
                  type="button"
                  onClick={() => simulateHardwareScan('628100123002')}
                  className="px-1.5 py-0.5 text-[10px] bg-slate-700 hover:bg-emerald-600 text-white rounded transition-colors"
                  title="محاكاة مسح باركود: زيت صباح"
                >
                  زيت
                </button>
                <button
                  type="button"
                  onClick={() => simulateHardwareScan('628100123004')}
                  className="px-1.5 py-0.5 text-[10px] bg-slate-700 hover:bg-emerald-600 text-white rounded transition-colors"
                  title="محاكاة مسح باركود: شاي الغزالتين"
                >
                  شاي
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search & Manual Barcode Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 mb-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              placeholder="الصق الباركود أو ابحث بالاسم"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                const cleaned = pastedBarcode(text) || text.trim();
                if (!cleaned) return;
                e.preventDefault();
                setSearchQuery(cleaned);
              }}
              dir={looksLikeBarcode(searchQuery) ? 'ltr' : 'rtl'}
              className="w-full pr-10 pl-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm font-mono"
            />
          </div>

          <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-1.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Barcode className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="pos-barcode-field"
                type="text"
                inputMode="numeric"
                autoCapitalize="off"
                autoCorrect="off"
                placeholder="الصق الباركود هنا"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text');
                  const cleaned = pastedBarcode(text) || text.trim();
                  if (!cleaned) return;
                  e.preventDefault();
                  setBarcodeInput(cleaned);
                }}
                dir="ltr"
                className="w-full pr-9 pl-9 py-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono shadow-sm"
              />
              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(true)}
                title="مسح بالكاميرا"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 p-0.5 transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <button
              type="submit"
              className="px-3.5 py-2.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shadow-sm"
            >
              إضافة
            </button>
          </form>
        </div>

        {/* Categories Tabs */}
        <div className="flex items-center gap-1.5 pb-2 overflow-x-auto no-scrollbar shrink-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 pt-2">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              onClick={() => addToCart(prod)}
              className="bg-white rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer p-2.5 flex flex-col justify-between group select-none"
            >
              <div className="relative aspect-square w-full rounded-lg bg-slate-100 overflow-hidden mb-2">
                {prod.imageUrl ? (
                  <img
                    src={prod.imageUrl}
                    alt={prod.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                    {prod.name.slice(0, 2)}
                  </div>
                )}
                <span className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-xs text-white text-[10px] px-1.5 py-0.5 rounded">
                  {prod.unit}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug mb-1">
                  {prod.name}
                </h4>
                <div className="flex items-center justify-between gap-1 mt-1">
                  <span className="text-xs font-bold text-emerald-700 font-mono tabular-nums">
                    {prod.sellingPriceSdg.toLocaleString()} ج.س
                  </span>
                  <CopyBarcodeButton code={prod.barcode} compact className="text-slate-700" />
                </div>
              </div>
            </div>
          ))}

          {filteredProducts.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
              <Search className="w-10 h-10 mb-2 stroke-1" />
              <p className="text-sm font-medium">لم يتم العثور على منتجات مطابقة للبحث</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Active Cart & Fast Checkout */}
      <div className="w-full lg:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-lg shrink-0 text-slate-100">
        {/* Cart Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white">سلة المبيعات الحالية</span>
            <span className="text-xs text-slate-500 font-mono">({cart.length} أصناف)</span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إفراغ</span>
            </button>
          )}
        </div>

        {/* Customer Select / Input */}
        <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-white">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="اسم العميل (افتراضي: عميل نقدي)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full text-xs py-1 border-b border-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col gap-1.5 transition-all hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 leading-tight">
                  {item.product.name}
                </span>
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-slate-400 hover:text-rose-600 transition-colors p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Order Note Display */}
              {item.notes ? (
                <div className="flex items-center justify-between bg-amber-50/90 border border-amber-200 rounded-lg px-2 py-1 text-[11px] text-amber-900">
                  <div className="flex items-center gap-1 font-semibold overflow-hidden text-ellipsis">
                    <UtensilsCrossed className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>طلب سريع: {item.notes}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNoteProductId(item.product.id);
                        setCustomNoteText(item.notes || '');
                      }}
                      className="text-amber-800 hover:underline text-[10px] font-bold"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItemNote(item.product.id)}
                      className="text-amber-600 hover:text-rose-600 p-0.5"
                      title="حذف الملاحظة"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteProductId(
                        editingNoteProductId === item.product.id ? null : item.product.id
                      );
                      setCustomNoteText('');
                    }}
                    className="inline-flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition-colors"
                  >
                    <UtensilsCrossed className="w-3 h-3" />
                    <span>+ طلب سريع / ملاحظة خاصة للمطبخ أو التغليف</span>
                  </button>
                </div>
              )}

              {/* Inline Quick Order Note Selector Popup */}
              {editingNoteProductId === item.product.id && (
                <div className="bg-white p-2.5 rounded-lg border border-emerald-300 shadow-sm space-y-2 animate-in fade-in text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                    <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-emerald-600" />
                      <span>اختر وسوماً سريعة أو اكتب ملاحظتك:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingNoteProductId(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Predefined Quick Tags */}
                  <div className="flex flex-wrap gap-1">
                    {QUICK_ORDER_TAGS.map((tag) => {
                      const isSelected = item.notes?.split(' · ').includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleQuickTag(item.product.id, tag)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                            isSelected
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Note input */}
                  <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                    <input
                      type="text"
                      value={customNoteText}
                      onChange={(e) => setCustomNoteText(e.target.value)}
                      placeholder="أو اكتب ملاحظة مخصصة..."
                      className="flex-1 px-2 py-1 text-[11px] border border-slate-300 rounded focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customNoteText.trim()) {
                          const existing = item.notes ? `${item.notes} · ${customNoteText.trim()}` : customNoteText.trim();
                          setItemCustomNote(item.product.id, existing);
                        } else {
                          setEditingNoteProductId(null);
                        }
                      }}
                      className="px-2.5 py-1 bg-emerald-600 text-white font-bold text-[10px] rounded hover:bg-emerald-700"
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                {/* Quantity Controls */}
                <div className="flex items-center border border-slate-300 rounded bg-white">
                  <button
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="p-1 hover:bg-slate-100 text-slate-600"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label="الكمية"
                    value={qtyDraft[item.product.id] ?? String(item.quantity)}
                    onChange={(e) => setQuantity(item.product.id, e.target.value)}
                    onBlur={() => commitQuantity(item.product.id)}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { commitQuantity(item.product.id); e.currentTarget.blur(); }
                    }}
                    dir="ltr"
                    className="w-12 py-0.5 text-center font-mono font-semibold tabular-nums bg-transparent border-0 border-x border-slate-200 focus:outline-none focus:bg-sky-50 rounded-none"
                  />
                  <button
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="p-1 hover:bg-slate-100 text-slate-600"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-left font-mono">
                  <span className="font-bold text-slate-900 tabular-nums">
                    {(item.quantity * item.unitPrice - item.discount).toLocaleString()} ج.س
                  </span>
                  <div className="text-[10px] text-slate-500 tabular-nums">
                    @{item.unitPrice.toLocaleString()} ج.س
                  </div>
                </div>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <span className="text-xs">السلة فارغة، انقر على الأصناف لإضافتها</span>
            </div>
          )}
        </div>

        {/* Cart Totals & Checkout Button */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 space-y-2">
          {/* Subtotal */}
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>المجموع الأولي:</span>
            <span className="font-mono tabular-nums">{subtotal.toLocaleString()} ج.س</span>
          </div>

          {/* Discount Field */}
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-600">
              <Percent className="w-3.5 h-3.5 text-amber-600" />
              <span>الخصم اليدوي الإضافي:</span>
            </span>
            <input
              type="number"
              min="0"
              max={subtotal}
              value={discountTotal || ''}
              onChange={(e) => setDiscountTotal(Math.min(subtotal, Number(e.target.value) || 0))}
              placeholder="0"
              className="w-24 text-left px-2 py-0.5 text-xs border border-slate-300 rounded bg-white font-mono"
            />
          </div>

          {/* Automatic Promotion Badges if any */}
          {appliedPromotions.length > 0 && (
            <div className="space-y-1.5 pt-1.5 border-t border-slate-200">
              <div className="flex items-center justify-between text-[11px] font-bold text-orange-700">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                  <span>عروض ترويجية نشطة مطبقة:</span>
                </span>
                <span className="font-mono text-orange-800">
                  -{autoPromoDiscountTotal.toLocaleString()} ج.س
                </span>
              </div>
              {appliedPromotions.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-[10px] bg-orange-50 border border-orange-200/90 text-orange-900 px-2 py-1 rounded-md"
                >
                  <span className="font-semibold truncate max-w-[190px]">{p.title}</span>
                  <span className="font-mono font-bold text-orange-700">
                    -{p.discountSdg.toLocaleString()} ج.س
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* VAT breakdown if active */}
          {isVatActive && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>ضريبة القيمة المضافة ({defaultVatPct}%):</span>
              <span className="font-mono tabular-nums text-slate-700">
                +{taxTotal.toLocaleString()} ج.س
              </span>
            </div>
          )}

          {/* Net Grand Total */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <span className="font-bold text-slate-900 text-sm">المبلغ الإجمالي الصافي:</span>
            <span className="font-bold text-emerald-700 text-lg font-mono tabular-nums">
              {grandTotal.toLocaleString()} ج.س
            </span>
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleProceedToPayment}
            disabled={cart.length === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 mt-2"
          >
            <Banknote className="w-4 h-4" />
            <span>الدفع وإصدار الفاتورة ({grandTotal.toLocaleString()} ج.س)</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          PAYMENT MODAL
          ========================================================================= */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">إتمام عملية الدفع</h3>
                <p className="text-xs text-slate-400">إجمالي الفاتورة: {grandTotal.toLocaleString()} ج.س</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner if any */}
            {errorMsg && (
              <div className="bg-rose-50 text-rose-800 px-6 py-2.5 text-xs flex items-center gap-2 border-b border-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="p-6 space-y-4">
              {/* Payment Methods Tabs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">طريقة الدفع:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 border transition-all ${
                      paymentMethod === 'cash'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>نقداً (Cash)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bankak')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 border transition-all ${
                      paymentMethod === 'bankak'
                        ? 'border-red-600 bg-red-50 text-red-800 ring-2 ring-red-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-red-600" />
                    <span>بنكك (Bankak)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('fawry')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 border transition-all ${
                      paymentMethod === 'fawry'
                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>فوري / بطاقة</span>
                  </button>
                </div>
              </div>

              {/* Multi-Currency Collection Section */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <span>عملة التحصيل (متعدد العملات):</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    يمكنك تحديد عملة أجنبية وسعر صرف مخصص
                  </span>
                </div>

                                {/* Currency selector chips */}
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {[
                    { code: "SDG", label: "SDG جنيه", badge: "أساس" },
                    { code: "USD", label: "USD دولار", badge: "2,750" },
                    { code: "SAR", label: "SAR ريال", badge: "733" },
                    { code: "TRY", label: "TRY ليرة", badge: "82.5" },
                    { code: "EGP", label: "EGP مصري", badge: "56.8" },
                    { code: "AED", label: "AED درهم", badge: "748" },
                    { code: "EUR", label: "EUR يورو", badge: "2,980" },
                  ].map((cur) => (
                    <button
                      key={cur.code}
                      type="button"
                      onClick={() => handleCurrencySelect(cur.code)}
                      className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all text-center flex flex-col items-center gap-0.5 ${
                        selectedCurrency === cur.code
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span>{cur.label}</span>
                      <span className={`text-[9px] font-mono ${selectedCurrency === cur.code ? "text-emerald-200" : "text-slate-400"}`}>
                        {cur.badge}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Foreign Currency Calculation Fields */}
                {selectedCurrency !== 'SDG' && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-amber-950 mb-0.5">
                          سعر الصرف المخصص (ج.س/1 {selectedCurrency}):
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={customExchangeRate}
                          onChange={(e) => {
                            const rate = Number(e.target.value) || 1;
                            setCustomExchangeRate(rate);
                            setForeignCashReceived((grandTotal / rate).toFixed(2));
                          }}
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-amber-300 rounded bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-amber-950 mb-0.5">
                          المطلوب بـ ({selectedCurrency}):
                        </label>
                        <div className="px-2.5 py-1.5 text-xs font-mono font-bold text-amber-950 bg-amber-100/60 rounded border border-amber-300">
                          {(grandTotal / customExchangeRate).toFixed(2)} {selectedCurrency}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-200 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-amber-950 mb-0.5">
                          المبلغ المستلم ({selectedCurrency}):
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={foreignCashReceived}
                          onChange={(e) => setForeignCashReceived(e.target.value)}
                          placeholder="المستلم"
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-amber-300 rounded bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-amber-950 mb-0.5">
                          المتبقي للزبون (الفكة):
                        </label>
                        <div className="px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-800 bg-white rounded border border-emerald-200">
                          {Number(foreignCashReceived) >= grandTotal / customExchangeRate
                            ? `${(Number(foreignCashReceived) - grandTotal / customExchangeRate).toFixed(2)} ${selectedCurrency} (${Math.round((Number(foreignCashReceived) - grandTotal / customExchangeRate) * customExchangeRate).toLocaleString()} ج.س)`
                            : '0.00'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Cash specific inputs (when in SDG) */}
              {paymentMethod === 'cash' && selectedCurrency === 'SDG' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ المستلم من الزبون (ج.س):</label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg bg-white"
                      placeholder="أدخل المبلغ"
                    />
                  </div>

                  {Number(cashReceived) >= grandTotal && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                      <span className="font-semibold text-slate-700">المتبقي للزبون (الفكة):</span>
                      <span className="font-bold font-mono text-emerald-700 text-base">
                        {(Number(cashReceived) - grandTotal).toLocaleString()} ج.س
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Bankak specific inputs */}
              {paymentMethod === 'bankak' && (
                <div className="space-y-3 bg-red-50/50 p-4 rounded-xl border border-red-200 text-xs">
                  {tenant?.settings?.bankakAccount ? (
                    <div className="pb-2 border-b border-red-100 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-red-900">رقم حساب بنكك للمتجر — الزبون يحوّل عليه:</span>
                        <span className="font-mono font-bold text-red-800 text-sm" dir="ltr">
                          {tenant.settings.bankakAccount}
                        </span>
                      </div>
                      {tenant.settings.bankakAccountName && (
                        <p className="text-[11px] text-red-800">اسم الحساب: {tenant.settings.bankakAccountName}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-red-800 leading-relaxed">
                      ما في رقم بنكك محفوظ لهذا المتجر. أضفه من إعدادات المتجر عشان يظهر هنا للزبون.
                    </p>
                  )}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      رقم عملية التحويل من تطبيق بنكك (اختياري)
                    </label>
                    <p className="text-[11px] text-slate-500 mb-1 leading-relaxed">
                      بعد ما الزبون يحوّل، يظهر ليه رقم عملية في بنكك. اكتبه هنا عشان تراجع الإيداع بعدين. لو الدفع نقد ما تحتاج الخانة دي.
                    </p>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="رقم العملية من إشعار بنكك"
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Offline indicator in modal */}
              {isOffline && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    أنت تعمل دون اتصال بالإنترنت. سيتم حفظ الفاتورة محلياً وخصم المخزون التقديري، وستُرحل للخادم تلقائياً فور عودة الشبكة.
                  </span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalizeSale}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                {isSubmitting ? 'جاري الإصدار...' : 'تأكيد وقبض الفاتورة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PRINTABLE THERMAL RECEIPT MODAL (Customized Header & Footer & Multi-Currency)
          ========================================================================= */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-300 animate-in fade-in zoom-in-95 duration-150 ${
              receiptSettings.defaultTemplate === '58mm'
                ? 'w-full max-w-[320px]'
                : receiptSettings.defaultTemplate === 'a4'
                ? 'w-full max-w-md'
                : 'w-full max-w-sm'
            }`}
          >
            {/* Header actions */}
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold">فاتورة مبيعات إلكترونية معتمدة</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1 font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة ({receiptSettings.defaultTemplate})</span>
                </button>
                <button
                  onClick={() => setCompletedSale(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thermal Receipt Content Container */}
            <div id="printable-receipt" className="p-4 bg-white text-slate-900 font-sans text-xs space-y-2 select-text">
              {/* Optional Custom Logo */}
              {receiptSettings.logoUrl && (
                <div className="flex justify-center mb-1">
                  <img
                    src={receiptSettings.logoUrl}
                    alt="Logo"
                    className="max-h-12 object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                  />
                </div>
              )}

              {/* Receipt Header (Customized in Admin) */}
              <div className="text-center border-b border-dashed border-slate-400 pb-2">
                <h2 className="text-sm font-bold tracking-tight">
                  {receiptSettings.storeName || tenant?.tradeName || tenant?.name || 'المتجر'}
                </h2>
                <p className="text-[11px] text-slate-600">
                  {receiptSettings.storeSubtitle || completedSale.branchName}
                </p>
                {receiptSettings.address && (
                  <p className="text-[10px] text-slate-500">{receiptSettings.address}</p>
                )}
                {receiptSettings.taxNumber && (
                  <p className="text-[10px] text-slate-500">الرقم الضريبي: {receiptSettings.taxNumber}</p>
                )}
                {receiptSettings.phone && (
                  <p className="text-[10px] text-slate-500 font-mono">هاتف: {receiptSettings.phone}</p>
                )}
              </div>

              {/* Receipt Meta */}
              <div className="text-[10px] text-slate-600 space-y-0.5 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <span className="font-mono font-bold text-slate-900">{completedSale.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ والوقت:</span>
                  <span className="font-mono">{new Date(completedSale.createdAt).toLocaleString('ar-SD')}</span>
                </div>
                {receiptSettings.showCashierName && (
                  <div className="flex justify-between">
                    <span>الكاشير:</span>
                    <span>{completedSale.cashierName}</span>
                  </div>
                )}
                {receiptSettings.showCustomerInfo && (
                  <div className="flex justify-between">
                    <span>العميل:</span>
                    <span>{completedSale.customerName}</span>
                  </div>
                )}
                {completedSale.isOfflineCreated && (
                  <div className="text-amber-700 font-bold text-[9px] text-center pt-0.5">
                    (صدرت دون اتصال بالإنترنت - مسجلة محلياً)
                  </div>
                )}
              </div>

              {/* Items Table with Quick Order Notes */}
              <div className="border-b border-dashed border-slate-300 pb-2">
                <table className="w-full text-right text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300 text-[10px] text-slate-500">
                      <th className="py-1">الصنف</th>
                      <th className="py-1 text-center">الكمية</th>
                      <th className="py-1 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completedSale.items.map((it, idx) => (
                      <React.Fragment key={idx}>
                        <tr className="py-1">
                          <td className="py-1 font-medium">{it.productName}</td>
                          <td className="py-1 text-center font-mono">{it.quantity}</td>
                          <td className="py-1 text-left font-mono font-bold">{it.totalSdg.toLocaleString()}</td>
                        </tr>
                        {/* Display item notes for kitchen/packaging if enabled */}
                        {receiptSettings.showKitchenNotes && it.notes && (
                          <tr className="bg-amber-50/60">
                            <td colSpan={3} className="py-0.5 px-1 text-[9px] text-amber-900 font-semibold">
                              ↳ ملاحظة (طلب سريع/تغليف): {it.notes}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-xs border-b border-dashed border-slate-400 pb-2">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الأولي:</span>
                  <span className="font-mono">{completedSale.subtotalSdg.toLocaleString()} ج.س</span>
                </div>
                {completedSale.discountTotalSdg > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>الخصم الممنوح:</span>
                    <span className="font-mono">-{completedSale.discountTotalSdg.toLocaleString()} ج.س</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1">
                  <span>المبلغ المستحق:</span>
                  <span className="font-mono">{completedSale.grandTotalSdg.toLocaleString()} ج.س</span>
                </div>

                {/* Multi-Currency breakdown on receipt if present */}
                {completedSale.multiCurrency && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg space-y-0.5 text-[10px] text-emerald-950 font-medium my-1">
                    <div className="flex justify-between font-bold">
                      <span>السداد بالعملة:</span>
                      <span className="font-mono">
                        {completedSale.multiCurrency.totalForeign} {completedSale.multiCurrency.currencySymbol}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-[9px]">
                      <span>سعر الصرف:</span>
                      <span className="font-mono">
                        1 {completedSale.multiCurrency.currencyCode} = {completedSale.multiCurrency.exchangeRate.toLocaleString()} ج.س
                      </span>
                    </div>
                    {completedSale.multiCurrency.amountReceivedForeign && (
                      <div className="flex justify-between text-slate-600 text-[9px]">
                        <span>المستلم:</span>
                        <span className="font-mono">
                          {completedSale.multiCurrency.amountReceivedForeign} {completedSale.multiCurrency.currencySymbol}
                        </span>
                      </div>
                    )}
                    {Boolean(completedSale.multiCurrency.changeForeign) && (
                      <div className="flex justify-between text-emerald-800 font-bold text-[9px]">
                        <span>المتبقي للزبون (الفكة):</span>
                        <span className="font-mono">
                          {completedSale.multiCurrency.changeForeign} {completedSale.multiCurrency.currencySymbol} ({completedSale.multiCurrency.changeSdg?.toLocaleString()} ج.س)
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>طريقة السداد:</span>
                  <span className="font-medium">
                    {completedSale.paymentMethod === 'cash'
                      ? 'نقداً'
                      : completedSale.paymentMethod === 'bankak'
                      ? `بنكك (${completedSale.paymentReference || 'معتمد'})`
                      : completedSale.paymentMethod}
                  </span>
                </div>
              </div>

              {/* ZATCA / TLV Base64 QR Code */}
              {receiptSettings.showQrCode && (
                <div className="flex flex-col items-center justify-center pt-2 pb-1">
                  <div
                    className="w-24 h-24"
                    dangerouslySetInnerHTML={{
                      __html: generateQrSvg(
                        generateZatcaTlvBase64({
                          sellerName:
                            receiptSettings.storeName || tenant?.tradeName || tenant?.name || 'المتجر',
                          taxNumber: receiptSettings.taxNumber || tenant?.taxNumber || '',
                          timestamp: completedSale.createdAt,
                          totalWithVat: completedSale.grandTotalSdg.toString(),
                          vatTotal: '0',
                        }),
                        96
                      ),
                    }}
                  />
                  <span className="text-[9px] text-slate-400 mt-1 font-mono">رمز الفاتورة الإلكترونية المعتمدة</span>
                </div>
              )}

              {/* Receipt Footer (Customized in Admin) */}
              <div className="text-center text-[10px] text-slate-500 pt-1 border-t border-dashed border-slate-300 space-y-0.5">
                <p>{receiptSettings.footerMessage || 'شكراً لزيارتكم! البضاعة المباعة ترد وتستبدل خلال 3 أيام'}</p>
                {receiptSettings.secondaryFooter && (
                  <p className="font-mono text-[9px] text-slate-400">{receiptSettings.secondaryFooter}</p>
                )}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setCompletedSale(null)}
                className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
              >
                فاتورة جديدة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      <CameraBarcodeScanner
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScanSuccess={(code) => processBarcodeScan(code, 'hardware_scanner')}
        soundEnabled={soundEnabled}
      />

      {/* POS Default Printer Settings Modal */}
      <PosPrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => {
          setIsPrinterModalOpen(false);
          setPrinterSettings(getPosPrinterSettings());
        }}
      />
    </div>
  );
};
