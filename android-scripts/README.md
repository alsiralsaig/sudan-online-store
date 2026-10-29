# بناء تطبيقات أندرويد (كاشير / متجر / إدارة)

ثلاثة تطبيقات أصلية من نفس الكود: كل واحد بمعرّف مستقل، اسم مستقل، أيقونة مستقلة،
ومفتاح توقيع مستقل — فتُثبَّت الثلاثة على نفس الجوال بلا تعارض.

| التطبيق | Package ID | يفتح |
|---|---|---|
| كاشير سند | `sd.sanad.merchant` | `/?app=merchant` |
| متجر سند | `sd.sanad.client` | `/?app=client` |
| إدارة سند | `sd.sanad.admin` | `/?app=super_admin` |

## خطوات البناء
```bash
npm ci --legacy-peer-deps          # مرة واحدة
npm run native:setup               # تنزيل JDK 17 + Android SDK (مرة واحدة لكل بيئة)
npm run native:web                 # بناء الواجهة بوضع التطبيق الأصلي (API مطلق)
npm run native:copy                # نسخ الواجهة داخل مشروع أندرويد
npm run native:build               # بناء وAPK موقّع للثلاثة
```
النواتج: `/tmp/apkout/sanad-{merchant,client,admin}.apk` — انسخها إلى
`public/downloads/apk/` ثم ارفع.

## مهم
- **مفاتيح التوقيع** في `/home/user/sanad-signing-keys/` (خارج الريبو). أي تحديث
  لنفس التطبيق يجب أن يُوقَّع بنفس المفتاح، وإلا يرفض أندرويد التحديث.
- بصمات الشهادات المنشورة في `public/.well-known/assetlinks.json` تُستخدم لو فُتح
  رابط الموقع من داخل التطبيق (Digital Asset Links).
- `server.androidScheme=https` تجعل الواجهة تُقدَّم من `https://localhost`، لذلك
  تُبنى الواجهة بـ `VITE_API_BASE` (عنوان خادم سند) وتُرسل الجلسة كـBearer لأن
  الكوكيز لا تُحفظ بين أصول مختلفة.
