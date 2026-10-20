import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, Tag, Package, Sparkles, ArrowLeft, Building2, TrendingUp } from "lucide-react";
import type { Product } from "../../types/index.ts";

interface ClientAutocompleteSearchProps {
  products: Product[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectProduct?: (product: Product) => void;
  onSelectCategory?: (category: string) => void;
  placeholder?: string;
  className?: string;
}

export const ClientAutocompleteSearch: React.FC<ClientAutocompleteSearchProps> = ({
  products,
  searchQuery,
  onSearchChange,
  onSelectProduct,
  onSelectCategory,
  placeholder = "ابحث عن منتج، ماركة، سكر، زيت، دقيق، هاتف، سيارات...",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Popular / trending search terms
  const trendingSearches = [
    "سكر كنانة",
    "زيت صباح",
    "دقيق سيقا",
    "شاي الغزالتين",
    "حجز مسبق",
    "هيونداي",
  ];

  // Helper to highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const cleanQ = query.trim().toLowerCase();
    const idx = text.toLowerCase().indexOf(cleanQ);
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + cleanQ.length);
    const after = text.slice(idx + cleanQ.length);
    return (
      <>
        {before}
        <mark className="bg-emerald-100 text-emerald-900 font-black px-0.5 rounded">
          {match}
        </mark>
        {after}
      </>
    );
  };

  // Distinct brands and categories from product list
  const knownBrands = ["كنانة", "سيقا", "صباح", "الغزالتين", "هيونداي", "تويوتا", "أبل", "ماك بوك"];

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { categories: [], brands: [], products: [] };

    // Matching categories
    const allCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    const matchedCategories = allCategories
      .filter((c) => c.toLowerCase().includes(q))
      .slice(0, 3);

    // Matching brands / keywords
    const matchedBrands = knownBrands.filter((b) => b.toLowerCase().includes(q)).slice(0, 3);

    // Matching products
    const matchedProducts = products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.barcode?.includes(q)
      )
      .slice(0, 6);

    return {
      categories: matchedCategories,
      brands: matchedBrands,
      products: matchedProducts,
    };
  }, [products, searchQuery]);

  const hasSuggestions =
    suggestions.categories.length > 0 ||
    suggestions.brands.length > 0 ||
    suggestions.products.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all text-slate-800"
        />
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />

        {searchQuery && (
          <button
            onClick={() => {
              onSearchChange("");
              inputRef.current?.focus();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
            title="مسح البحث"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          {!searchQuery.trim() ? (
            /* Trending / Popular Queries when search is empty */
            <div className="p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>عمليات البحث الشائعة في المتجر:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSearchChange(item);
                      setIsOpen(false);
                    }}
                    className="px-3 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-200/60"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : !hasSuggestions ? (
            /* No Results */
            <div className="p-6 text-center text-xs text-slate-500 space-y-1">
              <Package className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="font-bold text-slate-700">لا توجد اقتراحات مطابقة لـ "{searchQuery}"</p>
              <p className="text-[11px] text-slate-400">جرب البحث بكلمات أبسط مثل سكر، زيت، دقيق، أو تصفح الأقسام</p>
            </div>
          ) : (
            /* Grouped Autocomplete Suggestions */
            <div className="divide-y divide-slate-100">
              {/* 1. Matching Categories */}
              {suggestions.categories.length > 0 && (
                <div className="p-2.5 bg-slate-50/50">
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3 h-3 text-emerald-600" />
                    <span>الأقسام المطابقة</span>
                  </div>
                  <div className="space-y-0.5">
                    {suggestions.categories.map((cat, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (onSelectCategory) onSelectCategory(cat);
                          onSearchChange(cat);
                          setIsOpen(false);
                        }}
                        className="w-full text-right px-3 py-1.5 rounded-lg hover:bg-emerald-50 text-xs font-semibold text-slate-800 flex items-center justify-between transition-colors group"
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{highlightMatch(cat, searchQuery)}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 group-hover:text-emerald-700 font-mono">
                          تصفية القسم ←
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Matching Brands / Keywords */}
              {suggestions.brands.length > 0 && (
                <div className="p-2.5 bg-slate-50/30">
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-amber-500" />
                    <span>الماركات والشركات</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-2 py-1">
                    {suggestions.brands.map((brand, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          onSearchChange(brand);
                          setIsOpen(false);
                        }}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold transition-colors"
                      >
                        {highlightMatch(brand, searchQuery)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Matching Products */}
              {suggestions.products.length > 0 && (
                <div className="p-2">
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider flex items-center gap-1">
                    <Package className="w-3 h-3 text-teal-600" />
                    <span>المنتجات المطابقة ({suggestions.products.length})</span>
                  </div>
                  <div className="space-y-1">
                    {suggestions.products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (onSelectProduct) onSelectProduct(p);
                          onSearchChange(p.name);
                          setIsOpen(false);
                        }}
                        className="w-full text-right p-2 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          <img
                            src={p.imageUrl || "/src/assets/images/product_sugar_kenana_1792173270044.jpg"}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs text-slate-900 truncate">
                            {highlightMatch(p.name, searchQuery)}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>{p.category}</span>
                            <span>•</span>
                            <span className="font-mono text-emerald-700 font-bold">
                              {p.sellingPriceSdg.toLocaleString()} SDG
                            </span>
                          </div>
                        </div>

                        <ArrowLeft className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick footer */}
          {searchQuery && (
            <div className="p-2 bg-slate-50 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[11px] text-emerald-700 font-bold hover:underline"
              >
                عرض كافة النتائج لـ "{searchQuery}"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
