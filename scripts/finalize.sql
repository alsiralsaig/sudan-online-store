-- إنهاء: تنظيف منتج الاختبار + إرجاع الصفوف المفقودة
--
-- شغّله في Neon → SQL Editor

-- 1) احذف المنتج التجريبي الذي أُضيف في آخر فحص
DELETE FROM sanad_branch_inventories
WHERE "productId" IN (SELECT id FROM sanad_products WHERE name = 'سكر كنانة - عبوة 5 كجم');

DELETE FROM sanad_products WHERE name = 'سكر كنانة - عبوة 5 كجم';

-- 2) (اختياري) إرجاع فرع بورتسودان والعميلة سارة إلى منشأة نيلة بوتيك
DELETE FROM sanad_branches  WHERE code = 'PSD-01' AND "tenantId" <> 'tenant_nile_boutique';
DELETE FROM sanad_customers WHERE phone = '0912556677' AND "tenantId" <> 'tenant_nile_boutique';

INSERT INTO sanad_branches
  (id, "tenantId", name, code, city, address, phone, "isMain", "isActive", "createdAt")
VALUES
  ('branch_psd_main', 'tenant_nile_boutique', 'فرع بورتسودان الرئيسي', 'PSD-01',
   'بورتسودان', 'شارع السيد علي الميرغني، وسط البلد', '0928887777',
   true, true, now() - interval '45 days')
ON CONFLICT (id) DO UPDATE SET
  "tenantId" = EXCLUDED."tenantId", name = EXCLUDED.name,
  city = EXCLUDED.city, address = EXCLUDED.address,
  phone = EXCLUDED.phone, "isMain" = EXCLUDED."isMain";

INSERT INTO sanad_customers
  (id, "tenantId", name, phone, email, city, address,
   "loyaltyPoints", "totalPurchasesSdg", "invoicesCount", "createdAt", "lastPurchaseAt")
VALUES
  ('cust_05', 'tenant_nile_boutique', 'سارة خالد البدوي', '0912556677',
   'sara.kh@gmail.com', 'بورتسودان', 'حي الشاطئ',
   95, 140000, 2, now() - interval '15 days', now() - interval '4 days')
ON CONFLICT (id) DO UPDATE SET
  "tenantId" = EXCLUDED."tenantId", name = EXCLUDED.name,
  "loyaltyPoints" = EXCLUDED."loyaltyPoints";

-- 3) تحقّق نهائي — المتوقع: 2 / 3 / 8 / 5
SELECT
  (SELECT COUNT(*) FROM sanad_tenants)   AS tenants,
  (SELECT COUNT(*) FROM sanad_branches)  AS branches,
  (SELECT COUNT(*) FROM sanad_products)  AS products,
  (SELECT COUNT(*) FROM sanad_customers) AS customers;
