import React from 'react';
import {
  ShoppingCart,
  Search,
  Package,
  Clock,
  MapPin,
  Building,
  ShieldCheck,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Phone,
  ArrowLeft,
  LayoutDashboard,
  Heart,
  Gift,
  Award,
  Store,
} from 'lucide-react';
import { SanadLogo } from '../../components/Common/SanadLogo.tsx';
import { TenantApplicationModal } from '../../components/Common/TenantApplicationModal.tsx';
import type { ClientActiveTab } from '../types.ts';
import type { Branch, Tenant, Product } from '../../types/index.ts';
import { ClientAutocompleteSearch } from './ClientAutocompleteSearch.tsx';

interface ClientHeaderProps {
  activeTab: ClientActiveTab;
  onTabChange: (tab: ClientActiveTab) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  wishlistCount: number;
  loyaltyPoints: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  branches: Branch[];
  selectedBranch: Branch | null;
  onSelectBranch: (branch: Branch) => void;
  tenant: Tenant | null;
  onSwitchToAdmin?: () => void;
  currency: string;
  products?: Product[];
  onSelectProduct?: (product: Product) => void;
}

export const ClientHeader: React.FC<ClientHeaderProps> = ({
  activeTab,
  onTabChange,
  cartCount,
  cartTotal,
  onOpenCart,
  wishlistCount = 0,
  loyaltyPoints = 1450,
  searchQuery,
  onSearchChange,
  branches,
  selectedBranch,
  onSelectBranch,
  tenant,
  currency = 'SDG',
  products = [],
  onSelectProduct,
}) => {
  const [isTenantModalOpen, setIsTenantModalOpen] = React.useState(false);

  return (
    <>
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner Notice for Dual App System */}
      <div className="bg-slate-900 text-white px-4 py-1.5 text-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-emerald-300">
              تطبيق المتسوقين والجمهور (SanadClientApp)
            </span>
          </div>

          {/* Quick Loyalty Points pill */}
          <button
            onClick={() => onTabChange('loyalty')}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold hover:bg-amber-400/30 transition-colors"
            title="فتح لوحة مكافآت ونقاط الولاء"
          >
            <Gift className="w-3 h-3 text-amber-400" />
            <span>نقاطي: {loyaltyPoints.toLocaleString()} نقطة</span>
          </button>
        </div>

      </div>

      {/* Main Header Row */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Brand & Store Identity */}
        <div className="flex items-center gap-2 shrink-0">
          <SanadLogo size="md" variant="full" onClick={() => onTabChange('catalog')} />
          {tenant && (
            <div className="hidden md:flex flex-col border-r border-slate-200 pr-3 mr-1">
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {tenant.tradeName || tenant.name}
              </span>
              <span className="text-[11px] text-slate-500">
                المتجر الرقمي المعتمد
              </span>
            </div>
          )}
        </div>

        {/* Search Bar with Autocomplete */}
        <div className="flex-1 max-w-md hidden sm:block">
          <ClientAutocompleteSearch
            products={products}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onSelectProduct={onSelectProduct}
          />
        </div>

        {/* Actions Row: Branch, Loyalty, Wishlist, Cart */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Branch Picker */}
          {branches.length > 0 && (
            <div className="relative hidden lg:block">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>الفرع:</span>
                <select
                  value={selectedBranch?.id || ''}
                  onChange={(e) => {
                    const br = branches.find((b) => b.id === e.target.value);
                    if (br) onSelectBranch(br);
                  }}
                  className="bg-transparent font-bold text-slate-900 border-none focus:outline-none cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Wishlist Button */}
          <button
            onClick={() => onTabChange('wishlist')}
            className={`hidden min-[430px]:flex relative p-2 rounded-xl border transition-all ${
              activeTab === 'wishlist'
                ? 'bg-rose-50 border-rose-300 text-rose-600'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-slate-100'
            }`}
            title="قائمة الرغبات والمفضلة"
          >
            <Heart className={`w-4 h-4 ${wishlistCount > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black font-mono">
                {wishlistCount}
              </span>
            )}
          </button>

          {/* Loyalty Dashboard Quick Button */}
          <button
            onClick={() => onTabChange('loyalty')}
            className={`hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
              activeTab === 'loyalty'
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-2xs'
                : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
            }`}
            title="لوحة نقاط الولاء والمكافآت"
          >
            <Award className="w-4 h-4 text-amber-600" />
            <span>الولاء والمكافآت</span>
          </button>

          {/* Track Orders Quick Link */}
          <button
            onClick={() => onTabChange('track_order')}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
              activeTab === 'track_order'
                ? 'bg-slate-900 text-emerald-400'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">تتبع طلبي</span>
          </button>

          {/* Store application — visible entry point for traders */}
          <button
            onClick={() => setIsTenantModalOpen(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-black rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 active:scale-98 transition-all shadow-2xs whitespace-nowrap"
            title="طلب فتح متجر على منصة سند"
          >
            <Store className="w-4 h-4 text-emerald-700" />
            <span>طلب متجر</span>
          </button>

          {/* Cart Trigger */}
          <button
            onClick={onOpenCart}
            className="relative flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-sm transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">السلة</span>
            {cartCount > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black font-mono">
                {cartCount}
              </span>
            )}
            {cartTotal > 0 && (
              <span className="hidden md:inline font-mono text-xs pr-1 border-r border-emerald-400/40 text-emerald-100">
                {cartTotal.toLocaleString()} {currency}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Search Bar Row with Autocomplete */}
      <div className="sm:hidden px-4 pb-2.5">
        <ClientAutocompleteSearch
          products={products}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onSelectProduct={onSelectProduct}
        />
      </div>

      {/* Navigation Tabs Bar */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto gap-4 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTabChange('catalog')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'catalog'
                  ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛍️ تصفح كافة المنتجات
            </button>

            <button
              onClick={() => onTabChange('pre_orders')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap flex items-center gap-1 transition-colors ${
                activeTab === 'pre_orders'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>الطلبات المسبقة (Pre-Orders)</span>
            </button>

            <button
              onClick={() => onTabChange('wishlist')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                activeTab === 'wishlist'
                  ? 'bg-white text-rose-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${wishlistCount > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>قائمة الرغبات ({wishlistCount})</span>
            </button>

            <button
              onClick={() => onTabChange('loyalty')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                activeTab === 'loyalty'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>لوحة الولاء والمكافآت</span>
            </button>

            <button
              onClick={() => onTabChange('track_order')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'track_order'
                  ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🔍 تتبع حالة الطلب
            </button>

            <button
              onClick={() => onTabChange('branches_info')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'branches_info'
                  ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📍 الفروع ومواقع الاستلام
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3 text-slate-500 text-[11px] shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>دفع موثوق عبر بنكك وكاش</span>
            </span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold">توصيل سريع لكافة المدن</span>
          </div>
        </div>
      </div>
    </header>

    <TenantApplicationModal
      isOpen={isTenantModalOpen}
      onClose={() => setIsTenantModalOpen(false)}
      source="client"
    />
    </>
  );
};
