import React from 'react';
import {
  Home,
  Gavel,
  Plus,
  Mail,
  Menu,
  ShoppingCart,
  Heart,
  Sparkles,
} from 'lucide-react';
import type { ClientActiveTab } from '../types.ts';

interface ClientBottomNavProps {
  activeTab: ClientActiveTab;
  onSelectTab: (tab: ClientActiveTab) => void;
  onOpenCreateModal: () => void;
  cartCount: number;
  unreadMessagesCount?: number;
}

export const ClientBottomNav: React.FC<ClientBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenCreateModal,
  cartCount,
  unreadMessagesCount = 2,
}) => {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200/90 shadow-2xl safe-area-bottom">
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between relative" dir="rtl">
        {/* Tab 1: الرئيسية (Home) */}
        <button
          onClick={() => onSelectTab('market_home')}
          className={`flex-1 flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'market_home' || activeTab === 'catalog'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px]">الرئيسية</span>
        </button>

        {/* Tab 2: المزادات (Auctions) */}
        <button
          onClick={() => onSelectTab('auctions')}
          className={`flex-1 flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'auctions'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Gavel className="w-5 h-5" />
          <span className="text-[11px]">المزادات</span>
        </button>

        {/* Center Highlighted Action Button: (+) */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            onClick={onOpenCreateModal}
            className="w-13 h-13 rounded-full bg-emerald-800 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center shadow-lg border-4 border-white transition-all transform hover:scale-105"
            title="إضافة إعلان أو طلب شراء من المتاجر (+)"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab 3: الرسائل (Messages) */}
        <button
          onClick={() => onSelectTab('messages')}
          className={`flex-1 flex flex-col items-center gap-1 transition-colors relative ${
            activeTab === 'messages'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Mail className="w-5 h-5" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </div>
          <span className="text-[11px]">الرسائل</span>
        </button>

        {/* Tab 4: المزيد (More) */}
        <button
          onClick={() => onSelectTab('more')}
          className={`flex-1 flex flex-col items-center gap-1 transition-colors relative ${
            activeTab === 'more'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Menu className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 text-[9px] font-bold bg-amber-500 text-slate-950 rounded-full font-mono">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[11px]">المزيد</span>
        </button>
      </div>
    </div>
  );
};
