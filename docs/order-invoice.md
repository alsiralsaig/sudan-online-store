# فاتورة طلب التوريد — تطبيق التاجر

## المسار الحالي
- بطاقة الطلب فيها أزرار الحالة المعتادة + زر واحد «إصدار الفاتورة».
- الزر ينادي `POST /api/supply-orders/:id/invoice`، فيُصدر السيرفر رقماً موحّداً
  `PUR-YYYY-NNNNN` مرة واحدة، ثم تُفتح نافذة الفاتورة الكاملة.
- تحت الفاتورة فقط: طباعة، PDF، إرسال للمشتري، نسخة لصاحب المتجر، اطبع من هذه
  الصفحة، نسخ نص الفاتورة.
- لا يوجد `window.prompt` ولا إدخال يدوي لرقم الفاتورة. `sellerInvoiceNumber`
  القديم مرجع للمورد فقط ولا يستبدل رقم سند.

## توحيد المستند
المعاينة والطباعة وPDF وواتساب ونسخة صاحب المتجر تُبنى من `buildOrderInvoice`.
النص والطباعة وPDF تعرض نفس رقم الفاتورة، الإجمالي بالجنيه، العملة، سعر الصرف،
والمبلغ بالعملة الأجنبية. مثال: 625,000 ج.س ÷ 10,500 = 59.52 USD.

## الحالات والمخزون
- `pending → accepted | rejected | cancelled`
- `accepted → fulfilled | cancelled`
- `fulfilled / rejected / cancelled` نهائية.
- المشتري يستطيع الإلغاء فقط قبل التسليم.
- التسليم ينشئ فاتورة مشتريات واحدة ويضيف المخزون مرة واحدة؛ تكرار التسليم لا
  يكرر المخزون ولا الفاتورة.
- التسليم محروس بـ `order.purchaseId`: لا يُنشأ سند مشتريات ثانٍ ولا يُضاف المخزون مرتين.
- ترقيم الفواتير ذرّي عبر `sanad_document_sequences` (UPSERT واحد في Postgres).
- ملاحظة: قفل الجلسات الاستشاري (`pg_advisory_lock`) غير مستخدم في مسار الطلبات،
  لأنه لا يعمل مع Neon pooler (PgBouncer transaction mode) ويسبب `DB_BUSY` لكل كتابة.

## الإشعارات وPush
- إشعار الحالة يصل للطرف الآخر من الطلب.
- نسخة الفاتورة تصل لصاحب المتجر الحالي فقط، ويولّدها السيرفر من الطلب.
- أجهزة Push مرتبطة بالمتجر من الجلسة الموقعة؛ إشعار متجر لا يصل لجهاز متجر آخر
  ولا لجهاز قديم غير مرتبط.
- التكرار يُمنع بمفاتيح dedupe، وتُحفظ النسخة كاملة داخل الإشعار بينما يكون نص
  قفل الشاشة مختصراً.

## الطباعة على الجوال
إذا منع المتصفح النافذة المنبثقة تبقى الفاتورة مفتوحة ويظهر بديل «اطبع من هذه
الصفحة». البديل يطبع المستند وحده على A4، ويمكن تنزيل PDF كخيار آخر.

## الاختبارات
```bash
npm ci --legacy-peer-deps
npm run lint
npm run test:order-invoice      # API + قاعدة معزولة PGlite
npm run build
npx playwright install chromium
npx playwright install-deps chromium
npm run test:order-invoice-ui   # متصفح 360px و1280px
npm run db:test:notify
npx tsx scripts/test-isolation.ts
npx tsx scripts/test-security-sessions.ts
npm run db:test
```

## معاينة محلية معزولة
```bash
npm run build
npm run preview:order-invoice
```
تفتح `/preview` معاينة ببيانات تجريبية معزولة، ولا تلمس قاعدة الإنتاج.
