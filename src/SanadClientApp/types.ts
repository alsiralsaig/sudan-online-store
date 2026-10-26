import type { Product, Branch, Tenant } from '../types/index.ts';

export interface ClientCartItem {
  product: Product;
  quantity: number;
  isPreOrder?: boolean;
}

export type ClientActiveTab =
  | 'market_home'
  | 'catalog'
  | 'auctions'
  | 'messages'
  | 'more'
  | 'pre_orders'
  | 'wishlist'
  | 'loyalty'
  | 'track_order'
  | 'branches_info'
  | 'market_browse';

export interface WishlistItem {
  productId: string;
  addedAt: string;
  originalPriceSdg: number;
}

export interface LoyaltyVoucher {
  id: string;
  code: string;
  title: string;
  description: string;
  pointsCost: number;
  discountType: 'fixed_amount' | 'free_shipping' | 'percentage';
  discountValue: number; // in SDG or %
  minOrderValueSdg?: number;
  isRedeemed?: boolean;
  redeemedAt?: string;
  expiresAt: string;
}

export interface LoyaltyHistoryItem {
  id: string;
  type: 'earned' | 'redeemed' | 'bonus';
  points: number;
  description: string;
  date: string;
  referenceOrderNumber?: string;
}

export interface LoyaltyAccount {
  customerName: string;
  customerPhone: string;
  currentPoints: number;
  lifetimePoints: number;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  history: LoyaltyHistoryItem[];
  activeVouchers: LoyaltyVoucher[];
}

export interface ClientCheckoutForm {
  customerName: string;
  customerPhone: string;
  deliveryMethod: 'delivery' | 'pickup';
  pickupBranchId: string;
  deliveryAddress: string;
  paymentMethod: 'bankak' | 'cash' | 'crypto' | 'later_preorder';
  bankakRef?: string;
  cryptoTxHash?: string;
  orderNotes?: string;
  appliedVoucher?: LoyaltyVoucher | null;
}

export interface ProductReview {
  id: string;
  productId: string;
  customerName: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
  isVerifiedPurchase: boolean;
}

// User-submitted Ads in Market
export interface ClientMarketAd {
  id: string;
  title: string;
  category: string;
  priceSdg: number;
  location: string;
  timeAgo: string;
  imageUrl: string;
  /** Short video attached to the ad, served from /api/media/:id */
  videoUrl?: string;
  isVip?: boolean;
  tag?: string;
  phone?: string;
  whatsapp?: string;
  description?: string;
  publisherName?: string;
  createdAt: string;
  /** Review state — present on ads fetched from the server. */
  status?: 'pending' | 'approved' | 'rejected';
  feeSdg?: number;
  rejectionReason?: string;
  /** Subscription plan bought for this ad (monthly / 6 months / yearly). */
  planId?: string;
  planLabel?: string;
  durationDays?: number;
  /** The ad leaves the market automatically after this date. */
  expiresAt?: string;
}

// Customer Custom Purchase Requests (RFQ from registered stores)
export interface ClientPurchaseRequest {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  budgetSdg?: number;
  city: string;
  customerName: string;
  customerPhone: string;
  urgency: 'urgent' | 'this_week' | 'flexible';
  notes?: string;
  createdAt: string;
  status: 'open' | 'quoted' | 'fulfilled';
  quotesCount?: number;
}
