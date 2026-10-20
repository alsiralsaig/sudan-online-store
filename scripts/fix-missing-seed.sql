-- إصلاح: إرجاع فرع بورتسودان والعميلة سارة خالد إلى المنشأة الصحيحة
-- (نِيلة بوتيك) بدل الرَّوَّاد، مع المعرّفات الأصلية.

-- 1) احذف الصفّين اللذين أُنشئا بالـ API تحت منشأة خاطئة
DELETE FROM sanad_branches  WHERE code = 'PSD-01' AND "tenantId" <> 'tenant_nile_boutique';
DELETE FROM sanad_customers WHERE phone = '0912556677' AND "tenantId" <> 'tenant_nile_boutique';

-- 2) أعد إدخال الفرع الأصلي
INSERT INTO sanad_branches
  (id, "tenantId", name, code, city, address, phone, "isMain", "isActive", "createdAt")
VALUES
  ('branch_psd_main', 'tenant_nile_boutique', 'فرع بورتسودان الرئيسي', 'PSD-01',
   'بورتسودان', 'شارع السيد علي الميرغني، وسط البلد', '0928887777',
   true, true, now() - interval '45 days')
ON CONFLICT (id) DO UPDATE SET
  "tenantId" = EXCLUDED."tenantId",
  name       = EXCLUDED.name,
  city       = EXCLUDED.city,
  address    = EXCLUDED.address,
  phone      = EXCLUDED.phone,
  "isMain"   = EXCLUDED."isMain",
  "isActive" = EXCLUDED."isActive";

-- 3) أعد إدخال العميلة الأصلية
INSERT INTO sanad_customers
  (id, "tenantId", name, phone, email, city, address,
   "loyaltyPoints", "totalPurchasesSdg", "invoicesCount", "createdAt", "lastPurchaseAt")
VALUES
  ('cust_05', 'tenant_nile_boutique', 'سارة خالد البدوي', '0912556677',
   'sara.kh@gmail.com', 'بورتسودان', 'حي الشاطئ',
   95, 140000, 2, now() - interval '15 days', now() - interval '4 days')
ON CONFLICT (id) DO UPDATE SET
  "tenantId" = EXCLUDED."tenantId",
  name       = EXCLUDED.name,
  "loyaltyPoints" = EXCLUDED."loyaltyPoints",
  "totalPurchasesSdg" = EXCLUDED."totalPurchasesSdg";

-- 4) تحقّق
SELECT
  (SELECT COUNT(*) FROM sanad_branches)  AS branches,
  (SELECT COUNT(*) FROM sanad_customers) AS customers,
  (SELECT COUNT(*) FROM sanad_products)  AS products;
