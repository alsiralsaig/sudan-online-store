# قاعدة البيانات — Sanad POS

## المشكلة التي كانت موجودة

كانت قاعدة البيانات ملف JSON على القرص (`.data/db.json`). على Vercel:

- نظام الملفات **للقراءة فقط** → الكود يتحول تلقائياً إلى وضع الذاكرة فقط
- كل instance له ذاكرة مستقلة → الكتابة في instance لا تظهر في آخر
- عند إعادة تشغيل الـ instance تُفقد البيانات

**النتيجة:** البيانات تُكتب (200 OK) ثم تختفي بصمت.

## الحل: Neon Postgres — 26 جدولاً علائقياً

### الحالة الحالية ✅

| البند | القيمة |
|---|---|
| المضيف | `ep-square-recipe-ba24xf1b-pooler.c-8.eu-central-1.aws.neon.tech` |
| المنطقة | Frankfurt (eu-central-1) — ودالة Vercel في `fra1` بجانبها |
| Pooling | مفعّل (`-pooler`) |
| SSL | مطلوب |
| الجداول | 26، وكلها منشأة |
| آخر خطأ اتصال | لا يوجد |
| زمن الكتابة | ~0.3 ثانية |

### الإعداد (لمشروع جديد)

1. [neon.tech](https://neon.tech) → New Project → **AWS Europe Central 1 (Frankfurt)**
2. Connect → فعّل **Connection pooling** → انسخ الرابط
3. Vercel → Settings → Environment Variables → `DATABASE_URL` = الرابط
   (لكل البيئات: Production + Preview + Development)
4. **Redeploy** — المتغيرات لا تُطبَّق على نشر قديم
5. `npm run db:migrate` (أو اتركه: السكيما تُنشأ وحدها عند أول طلب)

## كيف يعمل

```
طلب HTTP  →  قفل العملية (withInstanceLock)
              ├─ init()     إنشاء الجداول + البيانات الأولية (مرة لكل process)
              ├─ refresh()  قراءة كل الجداول في استعلام واحد (UNION ALL)
              ├─ المعالج
              └─ flush()    كتابة الصفوف المتغيرة فقط داخل transaction
```

### ثلاث مشكلات حقيقية ظهرت أثناء الاختبار وحُلّت

**١) خسارة تحديثات بين الـ instances**
كان كل حفظ ينفّذ `DELETE WHERE id <> ALL(ids)` لكل جدول. instance يقرأ نسخة قبل
أن يكتب آخر، ثم يكتب نسخته فيحذف صفوف غيره.
→ الحل: `persistDiff` يقارن كل صف ببصمته ويكتب فقط المتغيّر/الجديد/المحذوف.

**٢) أقفال الجلسة لا تعمل عبر Neon pooler**
`pg_advisory_lock` مربوط بالجلسة، و Neon pooler في وضع transaction لا يحافظ على
الجلسة. القفل كان يتحرر فوراً — أثبته الاختبار (3/8 نجت).
→ الحل: لم نعد نحتاج قفلاً بين العمليات بعد الكتابة على مستوى الصف.

**٣) تصادم المعرّفات**
`prod_${Date.now()}` يعطي نفس المفتاح لطلبين في نفس المللي ثانية، فيكتب الثاني
فوق الأول بـ `ON CONFLICT DO UPDATE` — وكلاهما يرجع 200 (فقدان صامت).
→ الحل: `newId()` = طابع زمني + UUID عشوائي (20 موضعاً في routes.ts).

### نتائج التحقق على الموقع الحيّ

| الاختبار | النتيجة |
|---|---|
| 45 كتابة متوازية (3 جولات × 15) | **45/45 محفوظة، صفر فقدان** |
| البيانات بعد إعادة تشغيل instance | باقية ✅ |
| زمن الكتابة | 0.3 ثانية |
| النص العربي والأرقام والمصفوفات | سليمة |

## نقاط API للمراقبة

```bash
curl https://sudan-online-store-eta.vercel.app/api/health
```

```json
{
  "database": {
    "enabled": true,
    "target": "ep-...-pooler.c-8.eu-central-1.aws.neon.tech/neondb pooler=true sslmode=require",
    "tables": 26,
    "persisted": true,
    "lastError": null
  }
}
```

## الاختبارات

```bash
npm run db:test        # 16 اختبار: السكيما، الحفظ، الحذف، إعادة التشغيل، الحقول الجديدة
npm run db:test:api    # 21 اختبار: نقاط API + الحفظ قبل الرد + الكتابة المتوازية
```

تعمل على **PGlite** (Postgres 18 → WebAssembly) بنفس كود الإنتاج، بدون خادم قاعدة بيانات.

## ملاحظات

- **لا تُرجع استخدام `pg_advisory_lock`** مع Neon pooler — لا يعمل.
- استخدم دائماً رابط **Pooled**.
- فشل الحفظ يرجع **5xx** ولا يُبلَّغ كنجاح؛ الكاشير يحتفظ بالبيعات في IndexedDB ويعيد المحاولة.
- بلا `DATABASE_URL` يعمل التطبيق في وضع الذاكرة (للتطوير المحلي فقط).
