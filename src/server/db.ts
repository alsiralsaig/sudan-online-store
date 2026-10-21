import {
  isDbEnabled,
  acquireWriteLock,
  closePool,
} from './pg.ts';
import { newId } from './ids.ts';
import {
  ensureSchema,
  loadAll,
  persistAll,
  persistDiff,
  buildBaseline,
  type TableDef,
  type Baseline,
} from './repository.ts';
import type {
  Tenant,
  SubscriptionPlan,
  SubscriptionPayment,
  Branch,
  Employee,
  Product,
  BranchInventory,
  StockMovement,
  BranchTransfer,
  CashierShift,
  Sale,
  ReturnRecord,
  CurrencyConfig,
  CurrencyRateHistory,
  StorefrontOrder,
  Expense,
  Purchase,
  AuditLog,
  AlbandarListing,
  AlbandarShowroom,
  Customer,
  KitchenTicket,
  KitchenStatus,
  RecurringExpense,
  PromotionRule,
  InventoryAlert,
  InventoryAudit,
  InventoryAuditItem,
  MarketAd,
} from '../types/index.ts';

export interface DatabaseSchema {
  tenants: Tenant[];
  subscriptionPlans: SubscriptionPlan[];
  subscriptionPayments: SubscriptionPayment[];
  branches: Branch[];
  employees: Employee[];
  products: Product[];
  branchInventories: BranchInventory[];
  stockMovements: StockMovement[];
  branchTransfers: BranchTransfer[];
  cashierShifts: CashierShift[];
  sales: Sale[];
  returns: ReturnRecord[];
  customers: Customer[];
  currencies: CurrencyConfig[];
  currencyRateHistory: CurrencyRateHistory[];
  storefrontOrders: StorefrontOrder[];
  expenses: Expense[];
  purchases: Purchase[];
  auditLogs: AuditLog[];
  albandarListings: AlbandarListing[];
  albandarShowrooms: AlbandarShowroom[];
  kitchenTickets: KitchenTicket[];
  recurringExpenses: RecurringExpense[];
  promotions: PromotionRule[];
  inventoryAlerts: InventoryAlert[];
  inventoryAudits: InventoryAudit[];
  marketAds: MarketAd[];
}

// Initial seed data for Sudanese market
const INITIAL_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_starter',
    name: 'باقة التاجر المبتدئ (Starter)',
    description: 'مثالية للمتاجر الصغيرة والدكاكين الفردية',
    monthlyPriceSdg: 75000,
    maxBranches: 1,
    maxEmployees: 3,
    features: ['فرع واحد فقط', 'حتى 3 موظفين', 'نقطة بيع POS تعمل دون إنترنت', 'إدارة المخزون والباركود', 'تقارير المبيعات اليومية'],
  },
  {
    id: 'plan_growth',
    name: 'باقة الأعمال والنمو (Growth)',
    description: 'الأنسب للشركات ومحلات التجزئة ذات الفروع المتعددة',
    monthlyPriceSdg: 180000,
    maxBranches: 4,
    maxEmployees: 15,
    features: [
      'حتى 4 فروع مستقلة',
      'حتى 15 موظفاً مع صلاحيات مخصصة',
      'تحويلات المخزون بين الفروع مع محاضر الاستلام',
      'متجر إلكتروني عام مع استقبال طلبات الزبائن',
      'تعدد العملات وتكلفة البضاعة بدقة',
      'ربط الدفع الإلكتروني وبنكك',
    ],
    isPopular: true,
  },
  {
    id: 'plan_enterprise',
    name: 'باقة الشركات والمؤسسات (Enterprise)',
    description: 'شاملة لكبرى المؤسسات وسلاسل السوبرماركت',
    monthlyPriceSdg: 350000,
    maxBranches: 20,
    maxEmployees: 100,
    features: [
      'فروع غير محدودة (حتى 20 فرعاً)',
      'موظفون غير محدودين',
      'تقارير محاسبية تفصيلية وقوائم الأرباح والخسائر',
      'إدارة الورديات وتدقيق العجز والفائض المتقدم',
      'دعم فني مخصص على مدار 24 ساعة',
      'نسخ احتياطي فوري وسحابي آمن',
    ],
  },
];

const INITIAL_TENANTS: Tenant[] = [
  {
    id: 'tenant_alrowad',
    slug: 'alrowad-trade',
    name: 'شركة الرواد للتجارة والمحاصيل',
    tradeName: 'الرواد ماركت وتوزيع الجملة',
    phone: '+249 91 234 5678',
    city: 'الخرطوم',
    address: 'السوق العربي - عمارة الرواد - الخرطوم',
    currency: 'SDG',
    status: 'active',
    subscriptionPlanId: 'plan_growth',
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    settings: {
      receiptHeader: 'شركة الرواد للتجارة والمواد الاستهلاكية\nالخرطوم - هاتف: 0912345678',
      receiptFooter: 'شكراً لزيارتكم! البضاعة المباعة ترد وتستبدل خلال 3 أيام مع إبراز الفاتورة.\nرقم الشكاوى: 0123456789',
      allowNegativeStock: false,
      defaultMaxDiscountPct: 15,
      zatcaQrEnabled: true,
      taxNumber: '1004892348',
      commercialRegNo: 'SD-KHT-2021-998',
      bankakAccount: '2498765',
      bankakAccountName: 'شركة الرواد للتجارة',
      bankakPhone: '0912345678',
      costingMethod: 'weighted_average',
      vatEnabled: true,
      defaultVatPct: 15,
      taxIdentificationNumber: '1004892348',
      pricesIncludeVat: false,
      showVatBreakdown: true,
      showTaxPerItem: true,
      loyaltyRateSdgPerPoint: 1000,
    },
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tenant_nile_boutique',
    slug: 'nile-boutique',
    name: 'بوتيك النيل للملابس والأناقة',
    tradeName: 'النيل فاشون',
    phone: '+249 92 888 7777',
    city: 'بورتسودان',
    address: 'سوق ديم سواكن - شارع الميناء - بورتسودان',
    currency: 'SDG',
    status: 'active',
    subscriptionPlanId: 'plan_starter',
    subscriptionExpiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    settings: {
      receiptHeader: 'بوتيك النيل للملابس والأناقة\nبورتسودان - ترحاباً بكم',
      receiptFooter: 'شكراً لاختياركم بوتيك النيل! تابعوا تشكيلتنا على الإنستغرام',
      allowNegativeStock: false,
      defaultMaxDiscountPct: 10,
      zatcaQrEnabled: true,
      taxNumber: '2005991823',
      commercialRegNo: 'SD-PSD-2023-412',
      bankakAccount: '3109844',
      bankakAccountName: 'بوتيك النيل',
      bankakPhone: '0928887777',
      costingMethod: 'fifo',
      vatEnabled: true,
      defaultVatPct: 15,
      taxIdentificationNumber: '2005991823',
      pricesIncludeVat: false,
      showVatBreakdown: true,
      showTaxPerItem: true,
      loyaltyRateSdgPerPoint: 1000,
    },
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'branch_kht_main',
    tenantId: 'tenant_alrowad',
    name: 'فرع الخرطوم الرئيسي (الرياض / المشتل)',
    code: 'KHT-01',
    city: 'الخرطوم',
    address: 'تقاطع شارع المشتل مع الجزار، الرياض',
    phone: '0912345678',
    isMain: true,
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'branch_madani',
    tenantId: 'tenant_alrowad',
    name: 'فرع ود مدني (السوق الكبير)',
    code: 'MDN-02',
    city: 'ود مدني',
    address: 'السوق الكبير - بالقرب من البنك الأهلي المصري',
    phone: '0912345679',
    isMain: false,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'branch_psd_main',
    tenantId: 'tenant_nile_boutique',
    name: 'فرع بورتسودan الرئيسي',
    code: 'PSD-01',
    city: 'بورتسودان',
    address: 'شارع السيد علي الميرغني، وسط البلد',
    phone: '0928887777',
    isMain: true,
    isActive: true,
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp_owner_rowad',
    tenantId: 'tenant_alrowad',
    name: 'أحمد الطيب الرواد',
    email: 'ahmed@alrowad.sd',
    phone: '0912000001',
    role: 'owner',
    pin: '1234',
    permissions: ['all'],
    maxDiscountPct: 50,
    isActive: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'emp_mgr_kht',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    name: 'عثمان عبد الرحيم (مدير فرع الخرطوم)',
    email: 'osman@alrowad.sd',
    phone: '0912000002',
    role: 'branch_manager',
    pin: '4321',
    permissions: ['pos:view', 'pos:sell', 'inventory:view', 'inventory:transfer', 'shifts:review', 'reports:view'],
    maxDiscountPct: 20,
    isActive: true,
    createdAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'emp_cashier_kht',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    name: 'محمد عبد الله (كاشير - الخرطوم)',
    email: 'mohamed@alrowad.sd',
    phone: '0912000003',
    role: 'cashier',
    pin: '0000',
    permissions: ['pos:view', 'pos:sell', 'shifts:manage'],
    maxDiscountPct: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'emp_inventory_rowad',
    tenantId: 'tenant_alrowad',
    name: 'إبراهيم علي (مسؤول المخزن)',
    email: 'ibrahim@alrowad.sd',
    phone: '0912000004',
    role: 'inventory_officer',
    pin: '5555',
    permissions: ['inventory:view', 'inventory:edit', 'inventory:transfer', 'purchases:manage'],
    maxDiscountPct: 0,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'emp_accountant_rowad',
    tenantId: 'tenant_alrowad',
    name: 'سارة مصطفى (المحاسب المالي)',
    email: 'sara@alrowad.sd',
    phone: '0912000005',
    role: 'accountant',
    pin: '7777',
    permissions: ['reports:view', 'expenses:manage', 'purchases:view', 'accounting:view'],
    maxDiscountPct: 0,
    isActive: true,
    createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_sugar_kenana',
    tenantId: 'tenant_alrowad',
    name: 'سكر كنانة نقي فاخر 10 كجم',
    sku: 'SUG-KEN-10KG',
    barcode: '628100123001',
    category: 'المواد التموينية والأساسية',
    unit: 'كيس 10 كجم',
    purchaseCost: 26000,
    costCurrency: 'SDG',
    sellingPriceSdg: 31500,
    minStockAlert: 15,
    minimumStock: 15,
    imageUrl: '/assets/images/product_sugar_kenana_1792173270044.jpg',
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod_cooking_oil',
    tenantId: 'tenant_alrowad',
    name: 'زيت صباح نقي للطهي 4.5 لتر',
    sku: 'OIL-SBH-4.5L',
    barcode: '628100123002',
    category: 'الزيوت والسمن',
    unit: 'جركن 4.5 لتر',
    purchaseCost: 19500,
    costCurrency: 'SDG',
    sellingPriceSdg: 23800,
    minStockAlert: 10,
    minimumStock: 10,
    imageUrl: '/assets/images/product_cooking_oil_1792173269992.jpg',
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod_sayga_flour',
    tenantId: 'tenant_alrowad',
    name: 'دقيق سيقا مخصوص فاخر 1 كجم',
    sku: 'FLR-SYG-1KG',
    barcode: '628100123003',
    category: 'المواد التموينية والأساسية',
    unit: 'باكت 1 كجم',
    purchaseCost: 2100,
    costCurrency: 'SDG',
    sellingPriceSdg: 2650,
    minStockAlert: 30,
    minimumStock: 30,
    imageUrl: '/assets/images/product_sayga_flour_1792173271374.jpg',
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod_tea_ghazal',
    tenantId: 'tenant_alrowad',
    name: 'شاي الغزالتين سيلاني فاخر 400 جم',
    sku: 'TEA-GHZ-400G',
    barcode: '628100123004',
    category: 'المشروبات والشاي',
    unit: 'علبة 400 جم',
    purchaseCost: 5800,
    costCurrency: 'SDG',
    sellingPriceSdg: 7200,
    minStockAlert: 15,
    minimumStock: 15,
    imageUrl: '/assets/images/product_tea_box_1792173271153.jpg',
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod_kapo_milk',
    tenantId: 'tenant_alrowad',
    name: 'حليب كابو بودرة كامل الدسم 2.25 كجم',
    sku: 'MLK-KAPO-2.25K',
    barcode: '628100123005',
    category: 'الألبان ومشتقاتها',
    unit: 'علبة صفيح',
    purchaseCost: 32000,
    costCurrency: 'SDG',
    sellingPriceSdg: 37500,
    minStockAlert: 10,
    minimumStock: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod_badr_soap',
    tenantId: 'tenant_alrowad',
    name: 'صابون غسيل البدر دستة (12 قطعة)',
    sku: 'SOP-BDR-12PC',
    barcode: '628100123006',
    category: 'المنظفات والعناية المنزلية',
    unit: 'دستة (12 قطعة)',
    purchaseCost: 6500,
    costCurrency: 'SDG',
    sellingPriceSdg: 8200,
    minStockAlert: 15,
    minimumStock: 15,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod_coffee_beans',
    tenantId: 'tenant_alrowad',
    name: 'بن حبشي هرري درجة أولى 1 كجم',
    sku: 'COF-ETH-1KG',
    barcode: '628100123007',
    category: 'المشروبات والشاي',
    unit: 'كجم',
    purchaseCost: 11000,
    costCurrency: 'SDG',
    sellingPriceSdg: 14500,
    minStockAlert: 12,
    minimumStock: 12,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod_rice_prince',
    tenantId: 'tenant_alrowad',
    name: 'أرز مصري البرنس كامولينو 5 كجم',
    sku: 'RCE-PRN-5KG',
    barcode: '628100123008',
    category: 'المواد التموينية والأساسية',
    unit: 'كيس 5 كجم',
    purchaseCost: 13500,
    costCurrency: 'SDG',
    sellingPriceSdg: 16800,
    minStockAlert: 20,
    minimumStock: 20,
    isActive: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_INVENTORIES: BranchInventory[] = [
  // Branch Khartoum Main
  { id: 'inv_1', tenantId: 'tenant_alrowad', branchId: 'branch_kht_main', productId: 'prod_sugar_kenana', quantity: 45, minAlertQuantity: 15, lastUpdated: new Date().toISOString() },
  { id: 'inv_2', tenantId: 'tenant_alrowad', branchId: 'branch_kht_main', productId: 'prod_cooking_oil', quantity: 28, minAlertQuantity: 10, lastUpdated: new Date().toISOString() },
  { id: 'inv_3', tenantId: 'tenant_alrowad', branchId: 'branch_kht_main', productId: 'prod_sayga_flour', quantity: 120, minAlertQuantity: 30, lastUpdated: new Date().toISOString() },
  { id: 'inv_4', tenantId: 'tenant_alrowad', branchId: 'branch_kht_main', productId: 'prod_tea_ghazal', quantity: 6, minAlertQuantity: 15, lastUpdated: new Date().toISOString() }, // Low stock: 6 <= 15
  { id: 'inv_5', tenantId: 'tenant_alrowad', branchId: 'branch_kht_main', productId: 'prod_kapo_milk', quantity: 18, minAlertQuantity: 10, lastUpdated: new Date().toISOString() },
  { id: 'inv_6', tenantId: 'tenant_alrowad', branchId: 'branch_kht_main', productId: 'prod_badr_soap', quantity: 50, minAlertQuantity: 15, lastUpdated: new Date().toISOString() },
  { id: 'inv_7', tenantId: 'tenant_alrowad', branchId: 'branch_kht_main', productId: 'prod_coffee_beans', quantity: 4, minAlertQuantity: 12, lastUpdated: new Date().toISOString() }, // Low stock: 4 <= 12
  { id: 'inv_8', tenantId: 'tenant_alrowad', branchId: 'branch_kht_main', productId: 'prod_rice_prince', quantity: 8, minAlertQuantity: 20, lastUpdated: new Date().toISOString() }, // Low stock: 8 <= 20

  // Branch Wad Madani
  { id: 'inv_9', tenantId: 'tenant_alrowad', branchId: 'branch_madani', productId: 'prod_sugar_kenana', quantity: 20, minAlertQuantity: 10, lastUpdated: new Date().toISOString() },
  { id: 'inv_10', tenantId: 'tenant_alrowad', branchId: 'branch_madani', productId: 'prod_cooking_oil', quantity: 14, minAlertQuantity: 8, lastUpdated: new Date().toISOString() },
  { id: 'inv_11', tenantId: 'tenant_alrowad', branchId: 'branch_madani', productId: 'prod_sayga_flour', quantity: 55, minAlertQuantity: 20, lastUpdated: new Date().toISOString() },
  { id: 'inv_12', tenantId: 'tenant_alrowad', branchId: 'branch_madani', productId: 'prod_tea_ghazal', quantity: 5, minAlertQuantity: 15, lastUpdated: new Date().toISOString() }, // Low stock: 5 <= 15
  { id: 'inv_13', tenantId: 'tenant_alrowad', branchId: 'branch_madani', productId: 'prod_kapo_milk', quantity: 3, minAlertQuantity: 10, lastUpdated: new Date().toISOString() }, // Low stock: 3 <= 10
  { id: 'inv_14', tenantId: 'tenant_alrowad', branchId: 'branch_madani', productId: 'prod_badr_soap', quantity: 25, minAlertQuantity: 10, lastUpdated: new Date().toISOString() },
  { id: 'inv_15', tenantId: 'tenant_alrowad', branchId: 'branch_madani', productId: 'prod_coffee_beans', quantity: 2, minAlertQuantity: 12, lastUpdated: new Date().toISOString() }, // Low stock: 2 <= 12
  { id: 'inv_16', tenantId: 'tenant_alrowad', branchId: 'branch_madani', productId: 'prod_rice_prince', quantity: 18, minAlertQuantity: 20, lastUpdated: new Date().toISOString() },
];

const INITIAL_CURRENCIES: CurrencyConfig[] = [
  { code: 'SDG', name: 'جنيه سوداني', symbol: 'ج.س', rateToSdg: 1, isBase: true, isActive: true, lastUpdated: new Date().toISOString() },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', rateToSdg: 2750, isBase: false, isActive: true, lastUpdated: new Date().toISOString() },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', rateToSdg: 733.33, isBase: false, isActive: true, lastUpdated: new Date().toISOString() },
  { code: 'TRY', name: 'ليرة تركية', symbol: '₺', rateToSdg: 82.5, isBase: false, isActive: true, lastUpdated: new Date().toISOString() },
  { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م', rateToSdg: 56.8, isBase: false, isActive: true, lastUpdated: new Date().toISOString() },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', rateToSdg: 748.5, isBase: false, isActive: true, lastUpdated: new Date().toISOString() },
  { code: 'EUR', name: 'يورو أوروبي', symbol: '€', rateToSdg: 2980, isBase: false, isActive: true, lastUpdated: new Date().toISOString() },
  { code: 'QAR', name: 'ريال قطري', symbol: 'ر.ق', rateToSdg: 755, isBase: false, isActive: true, lastUpdated: new Date().toISOString() },
];

const INITIAL_SHIFTS: CashierShift[] = [
  {
    id: 'shift_kht_001',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي (الرياض / المشتل)',
    cashierId: 'emp_cashier_kht',
    cashierName: 'محمد عبد الله (كاشير - الخرطوم)',
    openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    openingCashSdg: 50000,
    expectedCashSdg: 144500,
    status: 'open',
    totalSalesSdg: 236000,
    totalCashSalesSdg: 94500,
    totalBankakSalesSdg: 121500,
    totalCardSalesSdg: 20000,
    salesCount: 6,
    refundsCount: 0,
    refundsTotalSdg: 0,
  },
];

const INITIAL_SALES: Sale[] = [
  {
    id: 'sale_demo_1',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    shiftId: 'shift_kht_001',
    invoiceNumber: 'INV-2026-00101',
    customerName: 'الأستاذ هاشم ميرغني',
    customerPhone: '0912111222',
    items: [
      {
        productId: 'prod_sugar_kenana',
        productName: 'سكر كنانة نقي فاخر 10 كجم',
        unit: 'كيس 10 كجم',
        quantity: 2,
        unitPriceSdg: 31500,
        discountSdg: 0,
        totalSdg: 63000,
        costPerUnitSdg: 26000,
      },
      {
        productId: 'prod_cooking_oil',
        productName: 'زيت صباح نقي للطهي 4.5 لتر',
        unit: 'جركن 4.5 لتر',
        quantity: 1,
        unitPriceSdg: 23800,
        discountSdg: 0,
        totalSdg: 23800,
        costPerUnitSdg: 19500,
      },
    ],
    subtotalSdg: 86800,
    discountTotalSdg: 0,
    taxTotalSdg: 0,
    grandTotalSdg: 86800,
    paymentMethod: 'bankak',
    paymentReference: 'BNK-TXN-8849201',
    status: 'completed',
    cashierId: 'emp_cashier_kht',
    cashierName: 'محمد عبد الله',
    isOfflineCreated: false,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sale_demo_2',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    shiftId: 'shift_kht_001',
    invoiceNumber: 'INV-2026-00102',
    customerName: 'عميل نقدي',
    items: [
      {
        productId: 'prod_tea_ghazal',
        productName: 'شاي الغزالتين سيلاني فاخر 400 جم',
        unit: 'علبة 400 جم',
        quantity: 3,
        unitPriceSdg: 7200,
        discountSdg: 600,
        totalSdg: 21000,
        costPerUnitSdg: 5800,
      },
      {
        productId: 'prod_sayga_flour',
        productName: 'دقيق سيقا مخصوص فاخر 1 كجم',
        unit: 'باكت 1 كجم',
        quantity: 5,
        unitPriceSdg: 2650,
        discountSdg: 0,
        totalSdg: 13250,
        costPerUnitSdg: 2100,
      },
    ],
    subtotalSdg: 34850,
    discountTotalSdg: 600,
    taxTotalSdg: 0,
    grandTotalSdg: 34250,
    paymentMethod: 'cash',
    status: 'completed',
    cashierId: 'emp_cashier_kht',
    cashierName: 'محمد عبد الله',
    isOfflineCreated: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust_01',
    tenantId: 'tenant_alrowad',
    name: 'م. عبد العظيم الفاتح',
    phone: '0912389441',
    email: 'abdelazim.f@gmail.com',
    city: 'الخرطوم',
    address: 'الرياض - شارع المشتل',
    loyaltyPoints: 340,
    totalPurchasesSdg: 485000,
    invoicesCount: 6,
    notes: 'عميل دائم - يفضل التوصيل السريع للمنزل',
    createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'cust_02',
    tenantId: 'tenant_alrowad',
    name: 'د. فاطمة عثمان أحمد',
    phone: '0911223344',
    email: 'dr.fatima@hotmail.com',
    city: 'الخرطوم',
    address: 'المعمورة - مربع 69',
    loyaltyPoints: 185,
    totalPurchasesSdg: 230000,
    invoicesCount: 3,
    notes: 'طبيبة بالعيادات المجمعة - تسوق دوري للسلع المنزلية',
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'cust_03',
    tenantId: 'tenant_alrowad',
    name: 'شركة الأفق للاستشارات الهندسية',
    phone: '0123998877',
    email: 'procurement@alofuq.sd',
    city: 'الخرطوم',
    address: 'العمارات - شارع 15',
    taxNumber: '1008823194',
    loyaltyPoints: 850,
    totalPurchasesSdg: 1250000,
    invoicesCount: 12,
    notes: 'مشتريات مكتبية ومواد ضيافة بفواتير ضريبية معتمدة للشركة',
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'cust_04',
    tenantId: 'tenant_alrowad',
    name: 'الأستاذ هاشم ميرغني',
    phone: '0912111222',
    email: 'hashem.m@yahoo.com',
    city: 'الخرطوم',
    address: 'الصحافة شرق',
    loyaltyPoints: 120,
    totalPurchasesSdg: 165000,
    invoicesCount: 2,
    notes: 'عميل أستاذ جامعي',
    createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: 'cust_05',
    tenantId: 'tenant_nile_boutique',
    name: 'سارة خالد البدوي',
    phone: '0912556677',
    email: 'sara.kh@gmail.com',
    city: 'بورتسودان',
    address: 'حي الشاطئ',
    loyaltyPoints: 95,
    totalPurchasesSdg: 140000,
    invoicesCount: 2,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    lastPurchaseAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
  },
];

const INITIAL_TRANSFERS: BranchTransfer[] = [
  {
    id: 'trf_001',
    tenantId: 'tenant_alrowad',
    transferNumber: 'TRF-2026-001',
    sourceBranchId: 'branch_kht_main',
    sourceBranchName: 'فرع الخرطوم الرئيسي',
    targetBranchId: 'branch_madani',
    targetBranchName: 'فرع ود مدني',
    status: 'received',
    items: [
      { productId: 'prod_sugar_kenana', productName: 'سكر كنانة نقي فاخر 10 كجم', requestedQty: 10, dispatchedQty: 10, receivedQty: 10 },
      { productId: 'prod_cooking_oil', productName: 'زيت صباح نقي للطهي 4.5 لتر', requestedQty: 5, dispatchedQty: 5, receivedQty: 5 },
    ],
    notes: 'تعزيز مخزون فرع ود مدني لمواكبة الطلب الأسبوعي',
    createdBy: 'أحمد الطيب الرواد',
    dispatchedBy: 'إبراهيم علي',
    receivedBy: 'عبد القادر موسى',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    dispatchedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp_001',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    category: 'كهرباء ومياه',
    amountSdg: 45000,
    description: 'شراء كروت كهرباء تجارية للمحل والإنارة والثلاجات',
    paidBy: 'عثمان عبد الرحيم',
    receiptNumber: 'ELEC-2026-90',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'exp_002',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    category: 'نقل وتفريغ',
    amountSdg: 30000,
    description: 'عتالة وتنزيل شحنة سكر وزيوت من المستودع المركزي',
    paidBy: 'إبراهيم علي',
    receiptNumber: 'LOG-771',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_RECURRING_EXPENSES: RecurringExpense[] = [
  {
    id: 'recexp_01',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    title: 'إيجار العقار والمقر التجاري الرئيسي',
    category: 'إيجار',
    amountSdg: 350000,
    frequency: 'monthly',
    dayOfMonth: 1,
    nextDueDate: new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString().split('T')[0],
    lastPostedDate: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString().split('T')[0],
    autoPost: true,
    isActive: true,
    notes: 'تحويل الحساب للمالك عبر تطبيق بنكك أول كل شهر ميلادي',
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'recexp_02',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    title: 'رواتب موظفي وعمال الفرع الشهري',
    category: 'رواتب',
    amountSdg: 850000,
    frequency: 'monthly',
    dayOfMonth: 28,
    nextDueDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
    lastPostedDate: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString().split('T')[0],
    autoPost: true,
    isActive: true,
    notes: 'مسير الرواتب لعدد 5 موظفين وكاشير وعمال النظافة',
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'recexp_03',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    title: 'اشتراك فايبر إنترنت وسيرفر نقاط البيع (كانار/سوداني)',
    category: 'إنترنت واتصالات',
    amountSdg: 45000,
    frequency: 'monthly',
    dayOfMonth: 5,
    nextDueDate: new Date(Date.now() + 16 * 24 * 3600 * 1000).toISOString().split('T')[0],
    lastPostedDate: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
    autoPost: false,
    isActive: true,
    notes: 'اشتراك إنترنت النطاق العريض غير المحدود مع خط احتياطي شريحة 4G',
    createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'recexp_04',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    title: 'شحن كروت كهرباء تجاري 3 فاز أسبوعي',
    category: 'كهرباء ومياه',
    amountSdg: 30000,
    frequency: 'weekly',
    dayOfWeek: 0,
    nextDueDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
    lastPostedDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().split('T')[0],
    autoPost: true,
    isActive: true,
    notes: 'شحن عداد الدفع المسبق لضمان عمل أجهزة التبريد والثلاجات المستمر',
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
];

const INITIAL_PROMOTIONS: PromotionRule[] = [
  {
    id: 'promo_01',
    tenantId: 'tenant_alrowad',
    title: 'عرض الصباح: اشترِ 2 واحصل على 1 مجاناً',
    description: 'عند شراء قطعتين من شاي الغزالتين الأصلي احصل على الثالثة مجاناً',
    type: 'buy_x_get_y',
    buyProductId: 'prod_tea_ghazalteen',
    buyProductName: 'شاي الغزالتين الأصلي 450 جم',
    buyQuantity: 2,
    freeProductId: 'prod_tea_ghazalteen',
    freeProductName: 'شاي الغزالتين الأصلي 450 جم',
    freeQuantity: 1,
    isActive: true,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'promo_02',
    tenantId: 'tenant_alrowad',
    title: 'خصم الجملة: 10% عند شراء أكثر من 5 عبوات',
    description: 'خصم فوري 10% على كل عبوة زيت صباح نقي عند شراء 5 قطع أو أكثر',
    type: 'qty_discount_pct',
    productId: 'prod_cooking_oil',
    productName: 'زيت صباح نقي للطهي 4.5 لتر',
    minQuantity: 5,
    discountPct: 10,
    isActive: true,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'promo_03',
    tenantId: 'tenant_alrowad',
    title: 'مكافأة السلة الكبيرة: خصم 5,000 ج.س عند تجاوز 100,000 ج.س',
    description: 'خصم مقطوع ومباشر 5,000 جنيه سوداني على إجمالي الفاتورة عند وصول السلة إلى 100,000 جنيه',
    type: 'cart_fixed_discount',
    minCartTotalSdg: 100000,
    discountAmountSdg: 5000,
    isActive: true,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
  },
];

const INITIAL_KITCHEN_TICKETS: KitchenTicket[] = [
  {
    id: 'kds_01',
    saleId: 'sale_demo_01',
    invoiceNumber: 'INV-2026-0001',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    customerName: 'م. عبد العظيم الفاتح',
    orderType: 'quick_order',
    status: 'preparing',
    items: [
      {
        id: 'kds_item_1',
        productId: 'prod_sugar_kenana',
        productName: 'سكر كنانة نقي فاخر 10 كجم',
        quantity: 2,
        unit: 'كيس 10 كجم',
        notes: 'طلب سريع - تجهيز للتسليم المباشر بالسيارة',
        status: 'ready',
      },
      {
        id: 'kds_item_2',
        productId: 'prod_tea_ghazalteen',
        productName: 'شاي الغزالتين الأصلي 450 جم',
        quantity: 3,
        unit: 'باكت',
        notes: 'عرض اشتر 2 واحصل على 1 مجاناً - تغليف هدية',
        status: 'preparing',
      },
    ],
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'kds_02',
    saleId: 'sale_demo_02',
    invoiceNumber: 'INV-2026-0002',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    customerName: 'د. منى الطاهر',
    orderType: 'takeaway',
    status: 'pending',
    items: [
      {
        id: 'kds_item_3',
        productId: 'prod_cooking_oil',
        productName: 'زيت صباح نقي للطهي 4.5 لتر',
        quantity: 1,
        unit: 'جركانة',
        notes: 'طلب سريع - بدون شطة سفري / وضع في كيس مزدوج مقوى',
        status: 'pending',
      },
    ],
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
];

const INITIAL_PURCHASES: Purchase[] = [
  {
    id: 'purch_001',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    supplierName: 'شركة السكر السودانية المحدودة',
    invoiceNumber: 'SUP-SUG-8821',
    currency: 'SDG',
    exchangeRate: 1,
    items: [
      {
        productId: 'prod_sugar_kenana',
        productName: 'سكر كنانة نقي فاخر 10 كجم',
        quantity: 100,
        costInCurrency: 26000,
        currency: 'SDG',
        exchangeRate: 1,
        costSdg: 2600000,
      },
    ],
    totalCostSdg: 2600000,
    paymentStatus: 'paid',
    notes: 'شراء دفعة شهرية مباشرة من المورد',
    createdBy: 'أحمد الطيب الرواد',
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'purch_002',
    tenantId: 'tenant_alrowad',
    branchId: 'branch_kht_main',
    branchName: 'فرع الخرطوم الرئيسي',
    supplierName: 'مؤسسة الشاي العالمية (دبي)',
    invoiceNumber: 'IMP-TEA-2026',
    currency: 'AED',
    exchangeRate: 748.5,
    items: [
      {
        productId: 'prod_tea_ghazal',
        productName: 'شاي الغزالتين سيلاني فاخر 400 جم',
        quantity: 100,
        costInCurrency: 7.75, // 7.75 AED * 748.5 = ~5800 SDG
        currency: 'AED',
        exchangeRate: 748.5,
        costSdg: 580087.5,
      },
    ],
    totalCostSdg: 580087.5,
    paymentStatus: 'paid',
    notes: 'استيراد بالدرهم الإماراتي مع قيد سعر الصرف التاريخي الفعلي',
    createdBy: 'أحمد الطيب الرواد',
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_STORE_ORDERS: StorefrontOrder[] = [
  {
    id: 'ord_101',
    tenantId: 'tenant_alrowad',
    orderNumber: 'ORD-2026-901',
    customerName: 'فاطمة عبد المنعم',
    customerPhone: '0912445566',
    deliveryMethod: 'delivery',
    deliveryAddress: 'حي الصفا، الخرطوم - قرب مسجد النور',
    items: [
      { productId: 'prod_cooking_oil', productName: 'زيت صباح نقي للطهي 4.5 لتر', quantity: 1, unitPriceSdg: 23800, totalSdg: 23800 },
      { productId: 'prod_sugar_kenana', productName: 'سكر كنانة نقي فاخر 10 كجم', quantity: 1, unitPriceSdg: 31500, totalSdg: 31500 },
    ],
    totalSdg: 55300,
    status: 'new',
    paymentStatus: 'paid_bankak',
    bankakRef: 'BNK-APP-998231',
    notes: 'يرجى الاتصال قبل الوصول للتسليم',
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
  },
];

const INITIAL_PAYMENTS: SubscriptionPayment[] = [
  {
    id: 'pay_sub_01',
    tenantId: 'tenant_alrowad',
    planId: 'plan_growth',
    amountSdg: 180000,
    paymentMethod: 'bankak',
    paymentRef: 'BNK-TXN-1099238',
    bankTransferSlipUrl: '/assets/images/sanad_pos_hero_1792173270140.jpg',
    status: 'approved',
    submittedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    reviewedBy: 'إدارة منصة سند المركزية',
    reviewNote: 'تم التحقق من مطابقة الحساب والإيداع وتفعيل الاشتراك لمدة شهر إضافي',
    reviewedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pay_sub_02',
    tenantId: 'tenant_nile_boutique',
    planId: 'plan_starter',
    amountSdg: 75000,
    paymentMethod: 'bankak',
    paymentRef: 'BNK-TXN-2049182',
    status: 'pending_review',
    submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud_1',
    tenantId: 'tenant_alrowad',
    actorId: 'emp_owner_rowad',
    actorName: 'أحمد الطيب الرواد',
    action: 'DISPATCH_TRANSFER',
    entity: 'BranchTransfer',
    entityId: 'trf_001',
    details: 'إرسال شحنة بضاعة من فرع الخرطوم إلى فرع ود مدني بعد المعاينة',
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'aud_2',
    tenantId: 'tenant_alrowad',
    actorId: 'emp_cashier_kht',
    actorName: 'محمد عبد الله',
    action: 'OPEN_SHIFT',
    entity: 'CashierShift',
    entityId: 'shift_kht_001',
    details: 'افتتاح وردية الصباح برصيد نقدي أولي قدره 50,000 ج.س',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_ALBANDAR_SHOWROOMS: AlbandarShowroom[] = [
  {
    id: 'shw_albandar_motors',
    name: 'معرض البندر الدولي للسيارات والمعدات',
    tradeName: 'البندر موتورز - بورتسودان',
    category: 'سيارات ومركبات',
    city: 'بورتسودان',
    address: 'شارع ديم سواكن - بجوار الميناء الجنوبي',
    phone: '+249912300456',
    whatsapp: '+249912300456',
    logo: '/assets/images/albander_hyundai_car_1792184093653.jpg',
    bannerImage: '/assets/images/albander_pickup_truck_1792184123630.jpg',
    verified: true,
    rating: 4.9,
    listingsCount: 28,
    bio: 'معرض معتمد لبيع وشراء كافة أنواع السيارات، البكاسي، الركشات والشاحنات وارد الخليج والوكيل.',
    bankakAccount: '2847591',
  },
  {
    id: 'shw_alrowad',
    name: 'مؤسسة الرواد التجارية والاستيراد',
    tradeName: 'الرواد للمواد التموينية والجملة',
    category: 'سلع ومواد تموينية',
    city: 'عطبرة',
    address: 'السوق الكبير - مجمع الرواد التجاري',
    phone: '+249912345678',
    whatsapp: '+249912345678',
    logo: '/assets/images/product_sugar_kenana_1792173270044.jpg',
    bannerImage: '/assets/images/sanad_pos_hero_1792173270140.jpg',
    verified: true,
    rating: 4.8,
    listingsCount: 45,
    bio: 'وكلاء كبرى الشركات الغذائية (كنانة، صباح، سيقا، الغزالتين) - بيع جملة وتجزئة لكافة ولايات السودان.',
    bankakAccount: '1982736',
    tenantSlug: 'alrowad-co',
  },
  {
    id: 'shw_neelain_tech',
    name: 'مركز النيلين للتقنية والطاقة الشمسية',
    tradeName: 'النيلين إلكترونكس',
    category: 'هواتف وإلكترونيات',
    city: 'كسلا',
    address: 'السوق الشعبي - شارع المدارس',
    phone: '+249900112233',
    whatsapp: '+249900112233',
    logo: '/assets/images/albander_macbook_laptop_1792184108039.jpg',
    bannerImage: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
    verified: true,
    rating: 4.9,
    listingsCount: 34,
    bio: 'أحدث الهواتف الذكية، أجهزة الكمبيوتر، ومنظومات الطاقة الشمسية الهجينة والبطاريات عالية الكفاءة.',
    bankakAccount: '3109482',
  },
  {
    id: 'shw_gedaref_crops',
    name: 'وكالة القضارف للمحاصيل والثروة الحيوانية',
    tradeName: 'بورصة محاصيل الفشقة',
    category: 'محاصيل وثروة حيوانية',
    city: 'القضارف',
    address: 'بورصة أسواق المحاصيل - القضارف',
    phone: '+249915556677',
    whatsapp: '+249915556677',
    logo: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80',
    verified: true,
    rating: 4.7,
    listingsCount: 19,
    bio: 'توريد وتصدير السمسم الأبيض والأحمر، الصمغ العربي، الفول السوداني والمواشي الحية بأسعار البورصة.',
    bankakAccount: '4452109',
  },
];

const INITIAL_ALBANDAR_LISTINGS: AlbandarListing[] = [
  {
    id: 'alb_car_01',
    title: 'هيونداي أفانتي HD موديل 2018 خالية من الملاحظات وارد الخليج',
    description: 'عربية شاذة وكرت، ترخيص بورتسودان جمرك كامل، مكيف ثلاجة، قير أوتوماتيك، شاشة وكاميرا، كفرات جديدة مع بطارية زيرو، السعر قابل للتفاوض البسيط بعد المعاينة.',
    category: 'cars',
    categoryNameAr: 'سيارات ومركبات',
    priceSdg: 18500000,
    priceUsd: 6850,
    city: 'بورتسودان',
    state: 'البحر الأحمر',
    condition: 'مستعمل بحالة ممتازة',
    imageUrl: '/assets/images/albander_hyundai_car_1792184093653.jpg',
    sellerName: 'معرض البندر للسيارات',
    sellerType: 'showroom',
    sellerPhone: '+249912300456',
    sellerWhatsapp: '+249912300456',
    isVerifiedMerchant: true,
    viewsCount: 1420,
    featured: true,
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    locationDetails: 'حي المطار - شارع ديم سواكن الرئيسي',
    bankakAccount: '2847591',
  },
  {
    id: 'alb_car_02',
    title: 'تويوتا هايلوكس دبل كابينة موديل 2022 GLX ديزل أصلية',
    description: 'بوكس دبل كاب ما شاء الله صلاة النبي، دفع رباعي 4x4، مكنة كبيرة ديزل تيربو، استهلاك وقود ممتاز، مفحوصة ومجمركة بالكامل في القضارف جاهزة للتحويل.',
    category: 'cars',
    categoryNameAr: 'سيارات ومركبات',
    priceSdg: 52000000,
    priceUsd: 19250,
    city: 'القضارف',
    state: 'القضارف',
    condition: 'وارد دبي',
    imageUrl: '/assets/images/albander_pickup_truck_1792184123630.jpg',
    sellerName: 'شركة القضارف للتجارة والآليات',
    sellerType: 'merchant',
    sellerPhone: '+249123456789',
    sellerWhatsapp: '+249123456789',
    isVerifiedMerchant: true,
    viewsCount: 980,
    featured: true,
    createdAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
    locationDetails: 'المنطقة الصناعية - القضارف',
    bankakAccount: '1982736',
  },
  {
    id: 'alb_elec_01',
    title: 'أبل ماك بوك برو M3 Pro سعة 512 جيجابايت كرتونة زيرو',
    description: 'Apple MacBook Pro M3 Pro Chip, 18GB Unified Memory, 512GB SSD, Retina XDR Display. جهاز جديد لم يُفتح وارد الوكيل، ضمان سنة كاملة، بطارية تدوم حتى 22 ساعة.',
    category: 'electronics',
    categoryNameAr: 'هواتف وإلكترونيات',
    priceSdg: 4200000,
    priceUsd: 1550,
    city: 'عطبرة',
    state: 'نهر النيل',
    condition: 'جديد بالكرتونة',
    imageUrl: '/assets/images/albander_macbook_laptop_1792184108039.jpg',
    sellerName: 'متجر النيلين للتقنية والأجهزة',
    sellerType: 'showroom',
    sellerPhone: '+249900112233',
    sellerWhatsapp: '+249900112233',
    isVerifiedMerchant: true,
    viewsCount: 760,
    featured: true,
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    locationDetails: 'السوق الكبير - عمارة السلام',
    bankakAccount: '3109482',
  },
  {
    id: 'alb_prop_01',
    title: 'شقة مفروشة راقية VIP للإيجار الشهري واليومي حي المطار',
    description: 'شقة سوبر ديلوكس 3 غرف وصالة وهول كبير، 2 حمام، مطبخ مجهز بكافة الأجهزة الكهربائية، مكيفات سبليت في كل الغرف، مولد كهربائي أوتوماتيكي ومياه متوفرة 24 ساعة، حراسة ومصعد.',
    category: 'real_estate',
    categoryNameAr: 'عقارات وأراضي',
    priceSdg: 950000,
    priceUsd: 350,
    city: 'بورتسودان',
    state: 'البحر الأحمر',
    condition: 'مفروشة بالكامل',
    imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
    sellerName: 'الدار للخدمات العقارية',
    sellerType: 'merchant',
    sellerPhone: '+249911223344',
    sellerWhatsapp: '+249911223344',
    isVerifiedMerchant: true,
    viewsCount: 2310,
    featured: true,
    createdAt: new Date(Date.now() - 15 * 3600 * 1000).toISOString(),
    locationDetails: 'بورتسودان - حي المطار جوار صالة كبار الزوار',
  },
  {
    id: 'alb_crops_01',
    title: 'سمسم القضارف الأبيض درجة أولى للتصدير (جوال 100 كجم)',
    description: 'سمسم أبيض نخب أول غربلة وتعبئة حديثة، مواصفات قياسية للتصدير والمعاصر، خالي من الشوائب بنسبة 99.5%، متوفر كميات كبيرة من المخزن مباشرة للتسليم.',
    category: 'livestock_crops',
    categoryNameAr: 'محاصيل وثروة حيوانية',
    priceSdg: 185000,
    priceUsd: 68,
    city: 'القضارف',
    state: 'القضارف',
    condition: 'إنتاج محلي نخب أول',
    imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
    sellerName: 'وكالة محاصيل الفشقة',
    sellerType: 'merchant',
    sellerPhone: '+249915556677',
    sellerWhatsapp: '+249915556677',
    isVerifiedMerchant: true,
    viewsCount: 890,
    featured: false,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    locationDetails: 'مخازن المنطقة الصناعية بالقضارف',
  },
  {
    id: 'alb_groc_01',
    title: 'سكر كنانة نقي فاخر عبوة 10 كجم و50 كجم جملة للمتاجر',
    description: 'سكر كنانة نقي أبيض بلورات فاخرة، الكميات متوفرة في كافة فروعنا مع إمكانية التوصيل والشحن لكافة مدن ولاية البحر الأحمر ونهر النيل، دفع عبر بنكك مباشرة.',
    category: 'groceries',
    categoryNameAr: 'سلع ومواد تموينية',
    priceSdg: 31500,
    priceUsd: 12,
    city: 'عطبرة',
    state: 'نهر النيل',
    condition: 'جديد إنتاج كنانة',
    imageUrl: '/assets/images/product_sugar_kenana_1792173270044.jpg',
    sellerName: 'مؤسسة الرواد التجارية (المتجر المعتمد)',
    sellerType: 'merchant',
    sellerPhone: '+249912345678',
    sellerWhatsapp: '+249912345678',
    isVerifiedMerchant: true,
    viewsCount: 3120,
    featured: true,
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    locationDetails: 'سوق عطبرة الكبير - مجمع الرواد',
    bankakAccount: '1982736',
  },
  {
    id: 'alb_elec_02',
    title: 'سامسونج جالكسي S24 ألترا 512 جيجابايت تيتانيوم كرتونة',
    description: 'Samsung Galaxy S24 Ultra 512GB Titanium Grey, شريحتين Nano-SIM + eSIM، قلم S-Pen مدمج، يدعم الذكاء الاصطناعي Galaxy AI بالكامل، ملحقات أصلية كاملة.',
    category: 'electronics',
    categoryNameAr: 'هواتف وإلكترونيات',
    priceSdg: 2950000,
    priceUsd: 1090,
    city: 'كسلا',
    state: 'كسلا',
    condition: 'جديد كرتونة',
    imageUrl: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=80',
    sellerName: 'البرنس للموبايل والإلكترونيات',
    sellerType: 'individual',
    sellerPhone: '+249918765432',
    sellerWhatsapp: '+249918765432',
    isVerifiedMerchant: false,
    viewsCount: 1140,
    featured: false,
    createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    locationDetails: 'كسلا - السوق الشعبي',
  },
  {
    id: 'alb_prop_02',
    title: 'منزل لودبيرنق مسلح تشطيب سوبر ديلوكس حي النهضة',
    description: 'مساحة 400 متر مربع، مبني لودبيرنق يركب طابقين إضافية، 4 غرف، صالون كبير، 3 حمامات، حوش واسع سيراميك، جاهز للسكن الفوري، شهادة بحث ملك حر.',
    category: 'real_estate',
    categoryNameAr: 'عقارات وأراضي',
    priceSdg: 48000000,
    priceUsd: 17800,
    city: 'عطبرة',
    state: 'نهر النيل',
    condition: 'جديد',
    imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    sellerName: 'مكتب الوفاق العقاري',
    sellerType: 'merchant',
    sellerPhone: '+249922334455',
    sellerWhatsapp: '+249922334455',
    isVerifiedMerchant: true,
    viewsCount: 1890,
    featured: false,
    createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    locationDetails: 'عطبرة - حي النهضة مربع 4',
  },
  {
    id: 'alb_fash_01',
    title: 'ثياب سودانية توتال سويسري حرير كريب مع تطريز شك يدوي',
    description: 'أرقى تشكيلة ثياب مناسبات وأعراس، قماش توتال سويسري أصلي بارد وثابت، تطريز حرير وشك خرز يدوي فاخر، ألوان زاهية وكميات حصرية للأناقة السودانية.',
    category: 'fashion',
    categoryNameAr: 'أزياء وموضة',
    priceSdg: 450000,
    priceUsd: 165,
    city: 'بورتسودان',
    state: 'البحر الأحمر',
    condition: 'جديد أصلي',
    imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
    sellerName: 'بوتيك النيلين للأزياء الراقية',
    sellerType: 'merchant',
    sellerPhone: '+249912987654',
    sellerWhatsapp: '+249912987654',
    isVerifiedMerchant: true,
    viewsCount: 650,
    featured: false,
    createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    locationDetails: 'بورتسودان - شارع البلدية',
  },
  {
    id: 'alb_serv_01',
    title: 'خدمات تخليص جمركي وترحيل بضائع ميناء بورتسودان',
    description: 'تخليص ومناولة كافة الحاويات والبضائع بالميناء الجنوبي والشمالي، سرعة في الإجراءات الجمركية، تأمين أساطيل شاحنات للنقل والتوزيع لكافة الولايات.',
    category: 'services',
    categoryNameAr: 'خدمات وأعمال',
    priceSdg: 120000,
    priceUsd: 45,
    city: 'بورتسودان',
    state: 'البحر الأحمر',
    condition: 'خدمة معتمدة',
    imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
    sellerName: 'مكتب البندر للخدمات اللوجستية والتخليص',
    sellerType: 'showroom',
    sellerPhone: '+249911998877',
    sellerWhatsapp: '+249911998877',
    isVerifiedMerchant: true,
    viewsCount: 1350,
    featured: true,
    createdAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    locationDetails: 'بورتسودان - قرب رئاسة هيئة الموانئ البحرية',
  },
];


/** Ads that ship with the platform so the market is never empty. */
const INITIAL_MARKET_ADS: MarketAd[] = [
  {
    id: 'mkt_ad_aircon',
    title: 'مكيفات آيس فخامة وجودة',
    category: 'الإلكترونيات',
    priceSdg: 1350000,
    location: 'الخرطوم',
    phone: '0912345678',
    whatsapp: '0912345678',
    description: 'مكيفات ماء كرتين أصلية وموفرة للطاقة مع كفالة سنتين وتركيب فوري.',
    imageUrl: '/assets/images/product_cooking_oil_1792173269992.jpg',
    isVip: true,
    publisherName: 'معرض الأجهزة المعتمد',
    ownerToken: 'seed-owner-aircon',
    feeSdg: 5000,
    status: 'approved',
    reviewedBy: 'إدارة سند',
    reviewedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: 'mkt_ad_car',
    title: 'أعلن عن معرض سياراتك هنا',
    category: 'السيارات والمركبات',
    priceSdg: 0,
    location: 'الخرطوم',
    phone: '0913009060',
    whatsapp: '0913009060',
    description: 'كن من أوائل المعلنين في البندر وسند.',
    imageUrl: '/assets/images/albander_hyundai_car_1792184093653.jpg',
    isVip: false,
    publisherName: 'منصة سند',
    ownerToken: 'seed-owner-cars',
    feeSdg: 0,
    status: 'approved',
    reviewedBy: 'إدارة سند',
    reviewedAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
  },
  {
    id: 'mkt_ad_laptop',
    title: 'لابتوب وماك بوك مستعمل بحالة ممتازة',
    category: 'الإلكترونيات',
    priceSdg: 850000,
    location: 'بورتسودان',
    phone: '0912556677',
    description: 'ماك بوك برو 2021، ذاكرة 16 جيجا، بطارية أصلية.',
    imageUrl: '/assets/images/albander_macbook_laptop_1792184108039.jpg',
    isVip: false,
    publisherName: 'سارة خالد',
    ownerToken: 'seed-owner-laptop',
    feeSdg: 0,
    status: 'pending',
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
  },
];

class Database {
  private data: DatabaseSchema;
  private tableDefs: TableDef[] = [];
  private ready: Promise<void> | null = null;
  private dirty = false;
  /** Row-level snapshot of what Postgres already holds. */
  private baseline: Baseline = new Map();

  constructor() {
    // Synchronous seed so the API still answers if the database is unreachable.
    this.data = this.getInitialSeedData();
  }

  /* ------------------------------------------------------------------ */
  /*  Postgres lifecycle                                                */
  /* ------------------------------------------------------------------ */

  /** Create the schema (once per process) and make sure seed data exists. */
  public async init(): Promise<void> {
    if (!isDbEnabled()) {
      console.warn('[DB] DATABASE_URL not set — running in memory-only mode. Data will NOT persist.');
      return;
    }

    if (!this.ready) {
      this.ready = (async () => {
        const seed = this.getInitialSeedData() as unknown as Record<string, any[]>;
        this.tableDefs = await ensureSchema(seed);

        const loaded = await loadAll(this.tableDefs);
        const hasTenants = (loaded.tenants || []).length > 0;

        if (hasTenants) {
          this.data = { ...this.data, ...loaded } as DatabaseSchema;

          // A collection added after the database was first created starts
          // empty; seed it so new features ship with sensible defaults.
          const missing = Object.entries(seed).filter(
            ([collection, rows]) =>
              rows.length > 0 && (loaded[collection] || []).length === 0
          );
          for (const [collection, rows] of missing) {
            (this.data as any)[collection] = rows;
          }
          if (missing.length > 0) {
            await persistAll(
              this.tableDefs,
              this.data as unknown as Record<string, any[]>,
              new Set(missing.map(([c]) => c))
            );
            for (const [collection] of missing) {
              loaded[collection] = (this.data as any)[collection];
            }
            console.log('[DB] Seeded new collections:', missing.map(([c]) => c).join(', '));
          }

          this.captureBaseline();
          console.log('[DB] Loaded from Postgres:', Object.entries(loaded)
            .map(([k, v]) => `${k}=${v.length}`)
            .join(' '));
        } else {
          this.data = seed as unknown as DatabaseSchema;
          await persistAll(this.tableDefs, seed);
          console.log('[DB] Empty database — seeded initial Sanad data.');
        }
      })();

      this.ready.catch((err) => {
        console.error('[DB] Init failed, continuing with in-memory seed:', (err as Error).message);
        this.ready = null;
      });
    }

    await this.ready;
  }

  /** Re-read every table. Called at the start of each request so no instance
   *  ever serves a stale snapshot. */
  public async refresh(): Promise<void> {
    if (!isDbEnabled() || this.tableDefs.length === 0) return;
    const loaded = await loadAll(this.tableDefs);
    this.data = { ...this.data, ...loaded } as DatabaseSchema;
    this.captureBaseline();
  }

  /** Remember exactly which rows Postgres already holds. */
  private captureBaseline(): void {
    this.baseline = buildBaseline(
      this.tableDefs,
      this.data as unknown as Record<string, any[]>
    );
  }

  /** Flush the in-memory snapshot back to Postgres. Serialised by an advisory
   *  lock so concurrent lambdas cannot overwrite each other. */
  public async flush(options: { lock?: boolean } = {}): Promise<void> {
    const useLock = options.lock !== false;
    if (!isDbEnabled() || this.tableDefs.length === 0) return;
    if (!this.dirty) return;

    const release = useLock ? await acquireWriteLock() : async () => {};
    try {
      const result = await persistDiff(
        this.tableDefs,
        this.data as unknown as Record<string, any[]>,
        this.baseline
      );

      this.dirty = false;

      if (result.upserts || result.deletes) {
        // Re-snapshot only the collections we just wrote.
        const partial = buildBaseline(
          this.tableDefs.filter((d) => result.collections.includes(d.collection)),
          this.data as unknown as Record<string, any[]>
        );
        for (const [collection, rows] of partial) {
          this.baseline.set(collection, rows);
        }
      }
    } finally {
      await release();
    }
  }

  public async shutdown(): Promise<void> {
    await closePool();
  }

  /* ------------------------------------------------------------------ */
  /*  Market ads (public listings with admin moderation)                 */
  /* ------------------------------------------------------------------ */

  public getMarketAds(): MarketAd[] {
    return this.data.marketAds || [];
  }

  public getMarketAd(id: string): MarketAd | undefined {
    return (this.data.marketAds || []).find((a) => a.id === id);
  }

  /** New ads always enter as `pending` — nothing reaches the market unreviewed. */
  public createMarketAd(
    input: Omit<MarketAd, 'id' | 'status' | 'createdAt'>
  ): MarketAd {
    const ad: MarketAd = {
      ...input,
      id: newId('mkt'),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.data.marketAds = [ad, ...(this.data.marketAds || [])];
    this.save();
    return ad;
  }

  public reviewMarketAd(
    id: string,
    decision: {
      decision: 'approved' | 'rejected';
      note?: string;
      reviewedBy?: string;
      paymentConfirmed?: boolean;
    }
  ): MarketAd | null {
    const ad = this.getMarketAd(id);
    if (!ad) return null;

    ad.status = decision.decision;
    ad.reviewedBy = decision.reviewedBy || 'إدارة سند';
    ad.reviewedAt = new Date().toISOString();

    if (decision.decision === 'rejected') {
      ad.rejectionReason = decision.note || 'لم يستوف الإعلان شروط النشر.';
    } else {
      ad.rejectionReason = undefined;
      if (decision.paymentConfirmed) {
        ad.paymentRef = ad.paymentRef || `PAID-${new Date().toISOString().slice(0, 10)}`;
      }
    }

    this.save();
    return ad;
  }

  /**
   * Deletion rules:
   *  - the publisher must present the token issued to their device
   *  - an admin can delete anything
   */
  public deleteMarketAd(
    id: string,
    auth: { ownerToken?: string; admin?: boolean }
  ): { ok: boolean; reason?: 'NOT_FOUND' | 'FORBIDDEN' } {
    const ad = this.getMarketAd(id);
    if (!ad) return { ok: false, reason: 'NOT_FOUND' };

    const isOwner = !!auth.ownerToken && ad.ownerToken === auth.ownerToken;
    if (!isOwner && !auth.admin) {
      return { ok: false, reason: 'FORBIDDEN' };
    }

    this.data.marketAds = (this.data.marketAds || []).filter((a) => a.id !== id);
    this.save();
    return { ok: true };
  }

  public isDatabaseEnabled(): boolean {
    return isDbEnabled();
  }

  public tableCount(): number {
    return this.tableDefs.length;
  }

  /** True when the schema is live and writes are actually reaching Postgres. */
  public isPersisting(): boolean {
    return isDbEnabled() && this.tableDefs.length > 0 && this.ready !== null;
  }

  private getInitialSeedData(): DatabaseSchema {
    return {
      tenants: INITIAL_TENANTS,
      subscriptionPlans: INITIAL_PLANS,
      subscriptionPayments: INITIAL_PAYMENTS,
      branches: INITIAL_BRANCHES,
      employees: INITIAL_EMPLOYEES,
      products: INITIAL_PRODUCTS,
      branchInventories: INITIAL_INVENTORIES,
      stockMovements: [],
      branchTransfers: INITIAL_TRANSFERS,
      cashierShifts: INITIAL_SHIFTS,
      sales: INITIAL_SALES,
      returns: [],
      customers: INITIAL_CUSTOMERS,
      currencies: INITIAL_CURRENCIES,
      currencyRateHistory: [],
      storefrontOrders: INITIAL_STORE_ORDERS,
      expenses: INITIAL_EXPENSES,
      purchases: INITIAL_PURCHASES,
      auditLogs: INITIAL_AUDIT_LOGS,
      albandarListings: INITIAL_ALBANDAR_LISTINGS,
      albandarShowrooms: INITIAL_ALBANDAR_SHOWROOMS,
      recurringExpenses: INITIAL_RECURRING_EXPENSES,
      promotions: INITIAL_PROMOTIONS,
      kitchenTickets: INITIAL_KITCHEN_TICKETS,
      inventoryAlerts: [],
      inventoryAudits: [],
      marketAds: INITIAL_MARKET_ADS,
    };
  }

  /** Mark the snapshot as changed; the request pipeline flushes it. */
  private save(_data?: DatabaseSchema) {
    this.dirty = true;
  }

  // Get raw schema (safe reference copy)
  public getSchema(): DatabaseSchema {
    return this.data;
  }

  public commit() {
    this.save();
  }

  // Tenant helper
  public getTenant(tenantId: string): Tenant | undefined {
    return this.data.tenants.find((t) => t.id === tenantId);
  }

  public getTenantBySlug(slug: string): Tenant | undefined {
    return this.data.tenants.find((t) => t.slug === slug);
  }

  // Branch helper
  public getBranches(tenantId: string): Branch[] {
    return this.data.branches.filter((b) => b.tenantId === tenantId);
  }

  // Products helper
  public getProducts(tenantId: string): Product[] {
    return this.data.products.filter((p) => p.tenantId === tenantId);
  }

  // Inventory helper
  public getInventory(tenantId: string, branchId?: string): (BranchInventory & { product?: Product; branch?: Branch })[] {
    return this.data.branchInventories
      .filter((inv) => inv.tenantId === tenantId && (!branchId || inv.branchId === branchId))
      .map((inv) => {
        const product = this.data.products.find((p) => p.id === inv.productId);
        const branch = this.data.branches.find((b) => b.id === inv.branchId);
        return {
          ...inv,
          product,
          branch,
        };
      });
  }

  // Get stock for a specific branch and product
  public getProductStock(tenantId: string, branchId: string, productId: string): number {
    const inv = this.data.branchInventories.find(
      (i) => i.tenantId === tenantId && i.branchId === branchId && i.productId === productId
    );
    return inv ? inv.quantity : 0;
  }

  // Adjust stock atomically with reason and movement logging
  public adjustStock(params: {
    tenantId: string;
    branchId: string;
    productId: string;
    delta: number;
    type: StockMovement['type'];
    reason: string;
    actorName: string;
    referenceId?: string;
  }): { success: boolean; newBalance: number; error?: string } {
    let inv = this.data.branchInventories.find(
      (i) => i.tenantId === params.tenantId && i.branchId === params.branchId && i.productId === params.productId
    );

    const product = this.data.products.find((p) => p.id === params.productId && p.tenantId === params.tenantId);
    const tenant = this.getTenant(params.tenantId);

    const currentQty = inv ? inv.quantity : 0;
    const newQty = currentQty + params.delta;

    // Disallow negative stock if merchant policy enforces strict no negative stock
    if (newQty < 0 && (!tenant || !tenant.settings.allowNegativeStock)) {
      return {
        success: false,
        newBalance: currentQty,
        error: `الرصيد المتاح غير كافٍ (${currentQty}) ولا يمكن خصم الكمية المطلوبة دون رصيد سالب.`,
      };
    }

    if (!inv) {
      inv = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenantId: params.tenantId,
        branchId: params.branchId,
        productId: params.productId,
        quantity: newQty,
        minAlertQuantity: product ? product.minStockAlert : 5,
        lastUpdated: new Date().toISOString(),
      };
      this.data.branchInventories.push(inv);
    } else {
      inv.quantity = newQty;
      inv.lastUpdated = new Date().toISOString();
    }

    // Record movement
    const movement: StockMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      productId: params.productId,
      productName: product?.name || 'غير معروف',
      type: params.type,
      quantityDelta: params.delta,
      balanceAfter: newQty,
      costPerUnitSdg: product?.purchaseCost || 0,
      totalValueSdg: Math.abs(params.delta) * (product?.purchaseCost || 0),
      referenceId: params.referenceId,
      actorName: params.actorName,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    };
    this.data.stockMovements.unshift(movement);

    // Automated Reorder Point Alert Check
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    const threshold = product ? (product.minimumStock !== undefined ? product.minimumStock : product.minStockAlert) : 5;
    const branch = this.data.branches.find((b) => b.id === params.branchId);
    const branchName = branch ? branch.name : 'الفرع الرئيسي';

    if (newQty <= threshold) {
      const existingAlert = this.data.inventoryAlerts.find(
        (a) => a.tenantId === params.tenantId && a.branchId === params.branchId && a.productId === params.productId && a.status !== 'dismissed'
      );
      if (existingAlert) {
        existingAlert.currentQuantity = newQty;
        existingAlert.severity = newQty === 0 ? 'critical' : 'warning';
        existingAlert.status = 'unread';
      } else {
        this.data.inventoryAlerts.unshift({
          id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tenantId: params.tenantId,
          branchId: params.branchId,
          branchName,
          productId: params.productId,
          productName: product?.name || 'منتج',
          sku: product?.sku || '',
          currentQuantity: newQty,
          reorderPoint: threshold,
          severity: newQty === 0 ? 'critical' : 'warning',
          status: 'unread',
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      // If stock has been replenished above the reorder point, clear active alerts for this product
      this.data.inventoryAlerts = this.data.inventoryAlerts.filter(
        (a) => !(a.tenantId === params.tenantId && a.branchId === params.branchId && a.productId === params.productId)
      );
    }

    this.commit();
    return { success: true, newBalance: newQty };
  }

  // Audit logging helper
  public logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>) {
    const log: AuditLog = {
      ...entry,
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(log);
    this.commit();
    return log;
  }

  // Albandar Marketplace Helpers
  public getAlbandarListings(): AlbandarListing[] {
    return this.data.albandarListings || [];
  }

  public addAlbandarListing(listing: AlbandarListing): AlbandarListing {
    if (!this.data.albandarListings) {
      this.data.albandarListings = [];
    }
    this.data.albandarListings.unshift(listing);
    this.commit();
    return listing;
  }

  public getAlbandarShowrooms(): AlbandarShowroom[] {
    return this.data.albandarShowrooms || [];
  }

  // Customer Management & Loyalty Points
  public getCustomers(tenantId: string, search?: string): Customer[] {
    let list = (this.data.customers || []).filter((c) => c.tenantId === tenantId);
    if (search) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.taxNumber && c.taxNumber.includes(q))
      );
    }
    return list;
  }

  public getCustomer(tenantId: string, id: string): Customer | undefined {
    return (this.data.customers || []).find((c) => c.id === id && c.tenantId === tenantId);
  }

  public addCustomer(customer: Customer): Customer {
    if (!this.data.customers) this.data.customers = [];
    this.data.customers.unshift(customer);
    this.commit();
    return customer;
  }

  public updateCustomer(tenantId: string, id: string, updates: Partial<Customer>): Customer | null {
    if (!this.data.customers) this.data.customers = [];
    const idx = this.data.customers.findIndex((c) => c.id === id && c.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.customers[idx] = { ...this.data.customers[idx], ...updates };
    this.commit();
    return this.data.customers[idx];
  }

  public recordCustomerSale(tenantId: string, customerId: string, saleGrandTotalSdg: number) {
    if (!this.data.customers) this.data.customers = [];
    const cust = this.data.customers.find((c) => c.id === customerId && c.tenantId === tenantId);
    if (cust) {
      const tenant = this.getTenant(tenantId);
      const rate = tenant?.settings?.loyaltyRateSdgPerPoint || 1000;
      const earnedPoints = Math.max(1, Math.floor(saleGrandTotalSdg / rate));
      cust.loyaltyPoints = (cust.loyaltyPoints || 0) + earnedPoints;
      cust.totalPurchasesSdg = (cust.totalPurchasesSdg || 0) + saleGrandTotalSdg;
      cust.invoicesCount = (cust.invoicesCount || 0) + 1;
      cust.lastPurchaseAt = new Date().toISOString();
      this.commit();
      return { cust, earnedPoints };
    }
    return null;
  }

  // ==========================================
  // Recurring Expenses (المصروفات الدورية)
  // ==========================================
  public getRecurringExpenses(tenantId: string, branchId?: string): RecurringExpense[] {
    let list = (this.data.recurringExpenses || []).filter((r) => r.tenantId === tenantId);
    if (branchId) {
      list = list.filter((r) => r.branchId === branchId);
    }
    return list;
  }

  public addRecurringExpense(item: RecurringExpense): RecurringExpense {
    if (!this.data.recurringExpenses) this.data.recurringExpenses = [];
    this.data.recurringExpenses.unshift(item);
    this.commit();
    return item;
  }

  public updateRecurringExpense(
    tenantId: string,
    id: string,
    updates: Partial<RecurringExpense>
  ): RecurringExpense | null {
    if (!this.data.recurringExpenses) this.data.recurringExpenses = [];
    const idx = this.data.recurringExpenses.findIndex((r) => r.id === id && r.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.recurringExpenses[idx] = { ...this.data.recurringExpenses[idx], ...updates };
    this.commit();
    return this.data.recurringExpenses[idx];
  }

  public deleteRecurringExpense(tenantId: string, id: string): boolean {
    if (!this.data.recurringExpenses) return false;
    const initialLen = this.data.recurringExpenses.length;
    this.data.recurringExpenses = this.data.recurringExpenses.filter(
      (r) => !(r.id === id && r.tenantId === tenantId)
    );
    if (this.data.recurringExpenses.length !== initialLen) {
      this.commit();
      return true;
    }
    return false;
  }

  public postRecurringExpenseNow(tenantId: string, id: string, actorName: string = 'النظام الآلي') {
    const rec = (this.data.recurringExpenses || []).find((r) => r.id === id && r.tenantId === tenantId);
    if (!rec) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const newExpense: Expense = {
      id: `exp_rec_${Date.now()}`,
      tenantId: rec.tenantId,
      branchId: rec.branchId,
      branchName: rec.branchName,
      category: rec.category,
      amountSdg: rec.amountSdg,
      description: `[مصروف دوري مجدول]: ${rec.title}`,
      paidBy: actorName,
      receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
    };

    if (!this.data.expenses) this.data.expenses = [];
    this.data.expenses.unshift(newExpense);

    // Advance nextDueDate
    const currDue = new Date(rec.nextDueDate);
    if (rec.frequency === 'weekly') {
      currDue.setDate(currDue.getDate() + 7);
    } else if (rec.frequency === 'yearly') {
      currDue.setFullYear(currDue.getFullYear() + 1);
    } else {
      // Monthly default
      currDue.setMonth(currDue.getMonth() + 1);
    }
    rec.lastPostedDate = todayStr;
    rec.nextDueDate = currDue.toISOString().split('T')[0];

    this.commit();
    return { expense: newExpense, recurring: rec };
  }

  // ==========================================
  // Promotions Management (العروض الترويجية)
  // ==========================================
  public getPromotions(tenantId: string): PromotionRule[] {
    return (this.data.promotions || []).filter((p) => p.tenantId === tenantId);
  }

  public addPromotion(promo: PromotionRule): PromotionRule {
    if (!this.data.promotions) this.data.promotions = [];
    this.data.promotions.unshift(promo);
    this.commit();
    return promo;
  }

  public updatePromotion(tenantId: string, id: string, updates: Partial<PromotionRule>): PromotionRule | null {
    if (!this.data.promotions) this.data.promotions = [];
    const idx = this.data.promotions.findIndex((p) => p.id === id && p.tenantId === tenantId);
    if (idx === -1) return null;
    this.data.promotions[idx] = { ...this.data.promotions[idx], ...updates };
    this.commit();
    return this.data.promotions[idx];
  }

  public deletePromotion(tenantId: string, id: string): boolean {
    if (!this.data.promotions) return false;
    const initialLen = this.data.promotions.length;
    this.data.promotions = this.data.promotions.filter((p) => !(p.id === id && p.tenantId === tenantId));
    if (this.data.promotions.length !== initialLen) {
      this.commit();
      return true;
    }
    return false;
  }

  // ==========================================
  // Kitchen Display System (KDS)
  // ==========================================
  public getKitchenTickets(tenantId: string, branchId?: string, status?: string): KitchenTicket[] {
    let list = (this.data.kitchenTickets || []).filter((t) => t.tenantId === tenantId);
    if (branchId) {
      list = list.filter((t) => t.branchId === branchId);
    }
    if (status && status !== 'all') {
      list = list.filter((t) => t.status === status);
    }
    return list;
  }

  public updateKitchenTicketStatus(ticketId: string, status: KitchenStatus): KitchenTicket | null {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    const ticket = this.data.kitchenTickets.find((t) => t.id === ticketId);
    if (!ticket) return null;
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    // Also update all items if ticket is marked completed or ready
    if (status === 'completed' || status === 'ready') {
      ticket.items.forEach((it) => {
        it.status = status;
      });
    }
    this.commit();
    return ticket;
  }

  public updateKitchenItemStatus(ticketId: string, itemId: string, status: KitchenStatus): KitchenTicket | null {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    const ticket = this.data.kitchenTickets.find((t) => t.id === ticketId);
    if (!ticket) return null;
    const it = ticket.items.find((i) => i.id === itemId);
    if (it) {
      it.status = status;
      ticket.updatedAt = new Date().toISOString();
      // If all items ready, mark ticket ready
      if (ticket.items.every((i) => i.status === 'completed')) {
        ticket.status = 'completed';
      } else if (ticket.items.every((i) => i.status === 'ready' || i.status === 'completed')) {
        ticket.status = 'ready';
      } else if (ticket.items.some((i) => i.status === 'preparing')) {
        ticket.status = 'preparing';
      }
      this.commit();
    }
    return ticket;
  }

  public createKitchenTicket(ticket: KitchenTicket): KitchenTicket {
    if (!this.data.kitchenTickets) this.data.kitchenTickets = [];
    this.data.kitchenTickets.unshift(ticket);
    this.commit();
    return ticket;
  }

  // ==========================================
  // Inventory Alerts (نظام تنبيهات حد إعادة الطلب)
  // ==========================================
  public getInventoryAlerts(tenantId: string, branchId?: string): InventoryAlert[] {
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    // Automatically make sure alerts are current
    this.syncInventoryAlerts(tenantId);
    return this.data.inventoryAlerts.filter(
      (a) => a.tenantId === tenantId && (!branchId || a.branchId === branchId)
    );
  }

  public dismissInventoryAlert(tenantId: string, alertId: string): boolean {
    if (!this.data.inventoryAlerts) return false;
    const alert = this.data.inventoryAlerts.find((a) => a.tenantId === tenantId && a.id === alertId);
    if (alert) {
      alert.status = 'dismissed';
      this.commit();
      return true;
    }
    return false;
  }

  public markInventoryAlertRead(tenantId: string, alertId: string): boolean {
    if (!this.data.inventoryAlerts) return false;
    const alert = this.data.inventoryAlerts.find((a) => a.tenantId === tenantId && a.id === alertId);
    if (alert && alert.status === 'unread') {
      alert.status = 'read';
      this.commit();
      return true;
    }
    return false;
  }

  public syncInventoryAlerts(tenantId: string): InventoryAlert[] {
    if (!this.data.inventoryAlerts) this.data.inventoryAlerts = [];
    const tenantProducts = this.getProducts(tenantId);
    const tenantBranches = this.getBranches(tenantId);

    for (const br of tenantBranches) {
      for (const prod of tenantProducts) {
        const threshold = prod.minimumStock !== undefined ? prod.minimumStock : (prod.minStockAlert || 5);
        const inv = this.data.branchInventories.find(
          (i) => i.tenantId === tenantId && i.branchId === br.id && i.productId === prod.id
        );
        const currentQty = inv ? inv.quantity : 0;

        if (currentQty <= threshold) {
          const existing = this.data.inventoryAlerts.find(
            (a) => a.tenantId === tenantId && a.branchId === br.id && a.productId === prod.id && a.status !== 'dismissed'
          );
          if (existing) {
            existing.currentQuantity = currentQty;
            existing.severity = currentQty === 0 ? 'critical' : 'warning';
          } else {
            this.data.inventoryAlerts.unshift({
              id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              tenantId,
              branchId: br.id,
              branchName: br.name,
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              currentQuantity: currentQty,
              reorderPoint: threshold,
              severity: currentQty === 0 ? 'critical' : 'warning',
              status: 'unread',
              createdAt: new Date().toISOString(),
            });
          }
        } else {
          // If stock is above threshold, clear active alerts for this product
          this.data.inventoryAlerts = this.data.inventoryAlerts.filter(
            (a) => !(a.tenantId === tenantId && a.branchId === br.id && a.productId === prod.id)
          );
        }
      }
    }
    this.commit();
    return this.data.inventoryAlerts.filter((a) => a.tenantId === tenantId);
  }

  // ==========================================
  // CSV Products & Inventory Bulk Import (استيراد المنتجات والمخزون)
  // ==========================================
  public importProductsCsv(params: {
    tenantId: string;
    branchId: string;
    items: Array<{
      name: string;
      sku?: string;
      barcode?: string;
      category?: string;
      unit?: string;
      purchaseCost?: number;
      costCurrency?: string;
      sellingPriceSdg: number;
      minStockAlert?: number;
      initialStock?: number;
      isTaxExempt?: boolean;
      customTaxRate?: number;
    }>;
    actorName: string;
  }): { success: boolean; importedCount: number; errors: string[]; products: Product[] } {
    const importedProducts: Product[] = [];
    const errors: string[] = [];

    for (let i = 0; i < params.items.length; i++) {
      const item = params.items[i];
      if (!item.name || !item.name.trim()) {
        errors.push(`السطر ${i + 1}: اسم المنتج مفقود.`);
        continue;
      }
      const price = Number(item.sellingPriceSdg);
      if (isNaN(price) || price <= 0) {
        errors.push(`السطر ${i + 1} (${item.name}): سعر البيع غير صالح.`);
        continue;
      }

      const newProd: Product = {
        id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenantId: params.tenantId,
        name: item.name.trim(),
        sku: item.sku && item.sku.trim() ? item.sku.trim() : `SKU-${Date.now().toString().slice(-5)}${i}`,
        barcode: item.barcode && item.barcode.trim() ? item.barcode.trim() : Math.floor(100000000000 + Math.random() * 900000000000).toString(),
        category: item.category && item.category.trim() ? item.category.trim() : 'عام',
        unit: item.unit && item.unit.trim() ? item.unit.trim() : 'حبة',
        purchaseCost: Number(item.purchaseCost) || 0,
        costCurrency: item.costCurrency || 'SDG',
        sellingPriceSdg: price,
        minStockAlert: Number(item.minStockAlert) || 5,
        minimumStock: Number(item.minStockAlert) || 5,
        isActive: true,
        isTaxExempt: Boolean(item.isTaxExempt),
        customTaxRate: item.customTaxRate !== undefined && item.customTaxRate !== null ? Number(item.customTaxRate) : undefined,
        createdAt: new Date().toISOString(),
      };

      this.data.products.push(newProd);
      importedProducts.push(newProd);

      const initStock = Number(item.initialStock);
      if (!isNaN(initStock) && initStock > 0 && params.branchId) {
        this.adjustStock({
          tenantId: params.tenantId,
          branchId: params.branchId,
          productId: newProd.id,
          delta: initStock,
          type: 'purchase_receive',
          reason: 'استيراد رصيد مخزون افتتاحي من ملف CSV',
          actorName: params.actorName,
        });
      }
    }

    if (importedProducts.length > 0) {
      this.syncInventoryAlerts(params.tenantId);
      this.commit();
      this.logAudit({
        tenantId: params.tenantId,
        actorId: 'system',
        actorName: params.actorName,
        action: 'IMPORT_CSV_PRODUCTS',
        entity: 'Product',
        entityId: `batch_${Date.now()}`,
        details: `استيراد جماعي لـ (${importedProducts.length}) منتج مع أرصدة المخزون عبر ملف CSV`,
      });
    }

    return {
      success: importedProducts.length > 0,
      importedCount: importedProducts.length,
      errors,
      products: importedProducts,
    };
  }

  // ==========================================
  // Smart Inventory Audit System (تدقيق وجرد المخزون الذكي)
  // ==========================================
  public getInventoryAudits(tenantId: string, branchId?: string): InventoryAudit[] {
    let audits = (this.data.inventoryAudits || []).filter((a) => a.tenantId === tenantId);
    if (branchId) {
      audits = audits.filter((a) => a.branchId === branchId);
    }
    return audits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getInventoryAudit(tenantId: string, auditId: string): InventoryAudit | undefined {
    return (this.data.inventoryAudits || []).find(
      (a) => a.tenantId === tenantId && a.id === auditId
    );
  }

  public createInventoryAudit(params: {
    tenantId: string;
    branchId: string;
    title: string;
    auditorId: string;
    auditorName: string;
    auditorRole: string;
    scope?: 'all' | 'category' | 'partial';
    categoryFilter?: string;
    deviceInfo?: string;
    notes?: string;
  }): InventoryAudit {
    const branch = this.data.branches.find((b) => b.id === params.branchId && b.tenantId === params.tenantId);
    const branchName = branch ? branch.name : 'الفرع الرئيسي';

    let prods = this.data.products.filter((p) => p.tenantId === params.tenantId && p.isActive !== false);
    if (params.scope === 'category' && params.categoryFilter && params.categoryFilter !== 'الكل') {
      prods = prods.filter((p) => p.category === params.categoryFilter);
    }

    const items: InventoryAuditItem[] = prods.map((prod) => {
      const stock = this.getProductStock(params.tenantId, params.branchId, prod.id);
      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        barcode: prod.barcode || '',
        category: prod.category || 'عام',
        unit: prod.unit || 'حبة',
        costPrice: prod.purchaseCost || 0,
        sellingPrice: prod.sellingPriceSdg || 0,
        systemQuantity: stock,
        actualQuantity: 0,
        difference: 0 - stock,
        differenceCostValue: (0 - stock) * (prod.purchaseCost || 0),
        status: 'uncounted',
        notes: '',
      };
    });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = (this.data.inventoryAudits?.length || 0) + 1;
    const auditNumber = `AUD-${dateStr}-${String(seq).padStart(3, '0')}`;

    const newAudit: InventoryAudit = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId: params.tenantId,
      branchId: params.branchId,
      branchName,
      auditNumber,
      title: params.title || `جرد مخزون ذكي - ${branchName}`,
      status: 'in_progress',
      startedAt: now.toISOString(),
      auditorId: params.auditorId,
      auditorName: params.auditorName,
      auditorRole: params.auditorRole,
      deviceInfo: params.deviceInfo || 'هاتف محمول ذكي',
      scope: params.scope || 'all',
      categoryFilter: params.categoryFilter,
      items,
      totalProductsCount: items.length,
      countedProductsCount: 0,
      matchedCount: 0,
      deficitCount: 0,
      surplusCount: 0,
      uncountedCount: items.length,
      totalDeficitValueSdg: 0,
      totalSurplusValueSdg: 0,
      netDiscrepancyCostSdg: 0,
      reconciled: false,
      notes: params.notes,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    if (!this.data.inventoryAudits) {
      this.data.inventoryAudits = [];
    }
    this.data.inventoryAudits.unshift(newAudit);
    this.commit();

    this.logAudit({
      tenantId: params.tenantId,
      actorId: params.auditorId,
      actorName: params.auditorName,
      action: 'START_INVENTORY_AUDIT',
      entity: 'InventoryAudit',
      entityId: newAudit.id,
      details: `بدء جلسة تدقيق وجرد مخزون رقم (${auditNumber}) لفرع [${branchName}] تشمل (${items.length}) صنف`,
    });

    return newAudit;
  }

  public updateInventoryAudit(
    tenantId: string,
    auditId: string,
    updates: Partial<InventoryAudit>
  ): InventoryAudit | null {
    if (!this.data.inventoryAudits) return null;
    const index = this.data.inventoryAudits.findIndex(
      (a) => a.tenantId === tenantId && a.id === auditId
    );
    if (index === -1) return null;

    const existing = this.data.inventoryAudits[index];
    const updated: InventoryAudit = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updates.items) {
      updated.totalProductsCount = updated.items.length;
      updated.countedProductsCount = updated.items.filter((i) => i.status !== 'uncounted').length;
      updated.matchedCount = updated.items.filter((i) => i.status === 'matched').length;
      updated.deficitCount = updated.items.filter((i) => i.status === 'deficit').length;
      updated.surplusCount = updated.items.filter((i) => i.status === 'surplus').length;
      updated.uncountedCount = updated.items.filter((i) => i.status === 'uncounted').length;

      let deficitVal = 0;
      let surplusVal = 0;
      let netCost = 0;

      for (const item of updated.items) {
        if (item.status === 'uncounted') continue;
        const diff = item.actualQuantity - item.systemQuantity;
        item.difference = diff;
        item.differenceCostValue = diff * item.costPrice;

        if (diff === 0) {
          item.status = 'matched';
        } else if (diff < 0) {
          item.status = 'deficit';
          deficitVal += Math.abs(item.differenceCostValue);
        } else {
          item.status = 'surplus';
          surplusVal += item.differenceCostValue;
        }
        netCost += item.differenceCostValue;
      }

      updated.totalDeficitValueSdg = deficitVal;
      updated.totalSurplusValueSdg = surplusVal;
      updated.netDiscrepancyCostSdg = netCost;
    }

    this.data.inventoryAudits[index] = updated;
    this.commit();
    return updated;
  }

  public reconcileInventoryAudit(params: {
    tenantId: string;
    auditId: string;
    actorName: string;
    actorId: string;
  }): { success: boolean; audit?: InventoryAudit; adjustedCount: number; error?: string } {
    const audit = this.getInventoryAudit(params.tenantId, params.auditId);
    if (!audit) {
      return { success: false, adjustedCount: 0, error: 'جلسة الجرد غير موجودة' };
    }
    if (audit.reconciled) {
      return { success: false, adjustedCount: 0, error: 'تمت تسوية هذه الجلسة مسبقاً' };
    }

    let adjustedCount = 0;

    for (const item of audit.items) {
      // Reconcile items that were actually counted and have differences
      if (item.status !== 'uncounted' && item.difference !== 0) {
        const delta = item.difference;
        const reason = `تسوية جرد مخزني ذكي (${audit.auditNumber}): ${
          item.notes ? item.notes : delta < 0 ? 'عجز فعلي مسجل بالجرد' : 'فائض فعلي مسجل بالجرد'
        }`;

        const adjRes = this.adjustStock({
          tenantId: params.tenantId,
          branchId: audit.branchId,
          productId: item.productId,
          delta,
          type: delta < 0 ? 'damage_expired' : 'adjustment',
          reason,
          actorName: params.actorName,
          referenceId: audit.auditNumber,
        });

        if (adjRes.success) {
          adjustedCount++;
        }
      }
    }

    audit.reconciled = true;
    audit.status = 'completed';
    audit.completedAt = new Date().toISOString();
    audit.reconciledAt = new Date().toISOString();
    audit.reconciledBy = params.actorName;
    audit.updatedAt = new Date().toISOString();

    this.syncInventoryAlerts(params.tenantId);
    this.commit();

    this.logAudit({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorName: params.actorName,
      action: 'RECONCILE_INVENTORY_AUDIT',
      entity: 'InventoryAudit',
      entityId: audit.id,
      details: `اعتماد وتسوية جرد مخزني رقم (${audit.auditNumber}) لفرع [${audit.branchName}]. تم تعديل أرصدة (${adjustedCount}) صنف بصافي فروقات (${audit.netDiscrepancyCostSdg.toLocaleString()} ج.س)`,
    });

    return { success: true, audit, adjustedCount };
  }

  public cancelInventoryAudit(
    tenantId: string,
    auditId: string
  ): { success: boolean; error?: string } {
    const audit = this.getInventoryAudit(tenantId, auditId);
    if (!audit) {
      return { success: false, error: 'جلسة الجرد غير موجودة' };
    }
    if (audit.reconciled) {
      return { success: false, error: 'لا يمكن إلغاء جلسة جرد تم اعتمادها وتسويتها في النظام' };
    }

    audit.status = 'cancelled';
    audit.updatedAt = new Date().toISOString();
    this.commit();
    return { success: true };
  }
}

export const db = new Database();

