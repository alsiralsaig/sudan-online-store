-- حذف بيانات الاختبار التي أنشأتها أثناء التحقق من قاعدة البيانات.
-- الآمن: يحذف فقط الأسماء المطابقة، ويترك المنتجات الثمانية الأصلية.

DELETE FROM sanad_branch_inventories
WHERE "productId" IN (
  SELECT id FROM sanad_products
  WHERE name ~ '^(فحص|منتج اختبار|توازي|Neon|اختبار نهائي|جولة|دقيقA|تأكيد|نهائي|قياس زمن|سرعة|فحص بعد الترحيل)'
);

DELETE FROM sanad_products
WHERE name ~ '^(فحص|منتج اختبار|توازي|Neon|اختبار نهائي|جولة|دقيقA|تأكيد|نهائي|قياس زمن|سرعة|فحص بعد الترحيل)';

-- تأكيد: يجب أن يعود 8
SELECT COUNT(*) AS remaining_products FROM sanad_products;
