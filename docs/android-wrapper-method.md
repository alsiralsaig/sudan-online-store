# طريقة بناء تطبيقات سند الثلاثة — «غلاف أندرويد» (Android Wrapper)

هذا الملف يشرح **الطريقة اللي اتبنت بيها الملفات الجاهزة** اللي وصلت (تاجر السند / السند / إدارة السند)،
والكود الجاهز لإعادة بنائها بنفسك في `native-wrapper/`.

---

## 1) الفكرة في سطر واحد
> تطبيق أندرويد صغير جدًا (نشاط واحد + WebView) يفتح نسخة الويب من خادم سند مباشرة،
> وكل «تطبيق» = نفس الكود يُبنى بمعرّف/اسم/لون/رابط بدء مختلف.

ليست TWA وليست Capacitor: **لا** `assetlinks` مطلوبة، **ولا** حزمة ويب داخل التطبيق —
الواجهة تُحمّل من النت في كل مرة (لذلك تحتاج إنترنت، لكن التحديث فوري بدون إعادة تثبيت).

---

## 2) ما استُخرج من الملفات الجاهزة (تحليل فعلي)

| العنصر | القيمة في ملفاتك |
|---|---|
| الحزمة | `com.sanad.merchant` · `com.sanad.marketplace` · `com.sanad.platformadmin` |
| الأسماء | `تاجر السند` · `السند` · `إدارة السند` |
| النشاط | `app.wrapper.MainActivity` (نشاط واحد فقط) |
| النطاق | `sudan-online-store-eta.vercel.app` |
| رابط البدء | `https://…/?app=merchant` · `?app=client` · `?app=super_admin` |
| الأدوات | `compileSdk/targetSdk 35` · `minSdk 24` · AGP 8.x · Java (لا Kotlin) |
| الحجم | ≈ 354 KB لكل ملف (بلا مكتبات: لا AndroidX WebView ولا Capacitor) |
| التوقيع | v2 + v3 (لا v1) بشهادة `CN=Sanad Android, O=Sanad, C=SD` — **نفس الشهادة للثلاثة** |
| الصلاحيات | INTERNET · ACCESS_NETWORK_STATE · CAMERA · RECORD_AUDIO · MODIFY_AUDIO_SETTINGS |
| المؤشر المخصص | `User-Agent: SanadMerchant/1.0.8` (لكل تطبيق وسْم خاص) |

### ما يفعله الكود داخل الملفات (من `dexdump`)
- `onCreate`: يُنشئ WebView برمجيًا (بلا تخطيط XML)، يضبط الشريط بلون العلامة،
  ويحمّل `START_URL`.
- إعدادات WebSettings: `JavaScript` + `DomStorage` + `Database` + `AllowFileAccess`
  + `MediaPlaybackRequiresUserGesture=false` + `MixedContentMode=NEVER_ALLOW`
  + `CacheMode=LOAD_DEFAULT` + إلحاق وسْم في `User-Agent`.
- `WebViewClient`:
  - `shouldOverrideUrlLoading` → `isInternal(uri)`: لو المضيف = نطاق سند يفتح داخل التطبيق،
    وغير كده `openExternal` (واتساب/تليفون/متصفح النظام).
  - `onPageFinished` → `evaluateJavascript("window.print=function(){AndroidApp.print()};")`
    و`addJavascriptInterface(..., "AndroidApp")` → طباعة أندرويد الحقيقية (`PrintManager`).
  - `onReceivedError(isForMainFrame)` → شاشة HTML عربية «ما في اتصال بالإنترنت» بزر إعادة محاولة.
- `WebChromeClient`:
  - `onShowFileChooser` → `startActivityForResult(params.createIntent(), FILE_REQ)` ثم
    `FileChooserParams.parseResult` (رفع صور/فيديو من التطبيق).
  - `onPermissionRequest` → يمنح `CAMERA`/`RECORD_AUDIO` فقط بعد `checkSelfPermission`،
    ولو ناقصة يطلبها بـ`requestPermissions(MIC_REQ)`.
- `onBackPressed` + `onKeyDown(BACK)`: رجوع داخل الصفحة، والثاني خلال ثانيتين يخرج برسالة
  «اضغط رجوع تاني للخروج».
- `onPause`: `CookieManager.flush()` · `onSaveInstanceState`: `web.saveState()`.
- المانيفست: `launchMode=singleTask` · `windowSoftInputMode=adjustResize` ·
  `configChanges` واسعة (بلا إعادة إنشاء عند الدوران) · `supportsRtl=true` ·
  `usesCleartextTraffic=false`.

### الأيقونة
`mipmap-anydpi-v26/ic_launcher.xml` = `adaptive-icon` بعنصرين:
`<background android:drawable="@color/ic_bg"/>` (أبيض `#ffffffff`) +
`<foreground android:drawable="@mipmap/ic_fg"/>`.
وفي الملفات الجاهزة **نفس صورة `ic_launcher`/`ic_fg` للثلاثة** (شعار SANAD الأخضر) —
لذلك تظهر متشابهة على الشاشة.

---

## 3) كيف تبنيها بنفسك (الكود جاهز عندي في `native-wrapper/`)

```bash
# 1) الأدوات (مرة واحدة): JDK 17 + Android SDK
npm run native:setup            # أو: bash android-scripts/setup_android_toolchain.sh
export ANDROID_HOME=$HOME/.toolchain/android-sdk    # يحتاج platform android-35

# 2) بناء الثلاثة (كل واحد بمعرّفه/اسمه/لونه)
bash native-wrapper/build_wrapper_apks.sh
#   ↓ النواتج
#   /tmp/wrapper-out/sanad-merchant.apk   com.sanad.merchant       ?app=merchant
#   /tmp/wrapper-out/sanad-client.apk     com.sanad.marketplace    ?app=client
#   /tmp/wrapper-out/sanad-admin.apk      com.sanad.platformadmin  ?app=super_admin
```

المشروع كله 4 ملفات: `MainActivity.java` (~200 سطر) + `AndroidManifest.xml` +
`app/build.gradle` (كل الهوية فيه: `applicationId`, `START_URL`, `THEME`, `UA_TAG`,
`versionCode`) + الأيقونات. لا مكتبات، فالحجم ≈ 2.5 MB (أكبر من ملفاتك لأنها مبنية
بـAndroidX؛ لو شلت `appcompat` تنزل لحجم ~300 KB).

### تغيير هوية تطبيق
كل شيء يمر عبر ملف خصائص واحد يُولّده السكربت:

```properties
appId=com.sanad.merchant
appKey=merchant
versionCode=10008
versionName=1.0.8
host=sudan-online-store-eta.vercel.app
startUrl=https://sudan-online-store-eta.vercel.app/?app=merchant
theme=#047857
uaTag=SanadMerchant
keystore=/home/user/sanad-signing-keys/merchant/signing.keystore
storePassword=…
keyAlias=sanad
keyPassword=…
```

---

## 4) قرارات مهمة قبل ما تنشر (فروق بين الملفات الجاهزة وطريقتي)

| الموضوع | ملفاتك الجاهزة | ملاحظات / توصيتي |
|---|---|---|
| **الوضع بدون إنترنت** | ❌ لا يفتح (الواجهة من النت) | نسختي (Capacitor) تحمل الواجهة داخل التطبيق وتعمل أوفلاين. لو التاجر في محل بلا شبكة، الغلاف يوريه «ما في اتصال». |
| **الكاميرا/الميكروفون** | يطلب الصلاحيات من أول تشغيل | يُفضّل الطلب عند الحاجة فقط (أفضل للمستخدم ولـPlay). |
| **التوقيع** | نفس الشهادة للثلاثة، مفتاحها غير موجود عندك | ملفات لا يمكن تحديثها إلا بنفس المفتاح؛ إن لم تحتفظ به لن تستطيع التحديث أبدًا (يجب إلغاء التثبيت). مفاتيحي الثلاثة موجودة في `sanad-signing-keys/`. |
| **معرّفات الحزم** | `com.sanad.*` | حزمي `sd.sanad.*` — الاثنان يعملان، لكن **لا تخلط** نسختين لنفس الوظيفة (تثبيت مزدوج). |
| **اسم الحزمة داخل الكود** | `app.wrapper` | سليم، لكن namespace ثابت مع applicationId متغير = مقبول. |
| **الطباعة** | `PrintManager` عبر `window.print` | نفس طريقتي (مهم لطباعة الفواتير الحرارية). |
| **الرجوع** | رجوع داخلي ثم خروج برسالة | نفس السلوك. |

---

## 5) ملاحظات أمنية/تشغيلية
- الغلاف يفتح **موقعك الحقيقي**؛ أي تغيير في الويب يظهر فورًا بدون تحديث التطبيق (ميزة).
- `usesCleartextTraffic=false` + `NEVER_ALLOW` = لا HTTP ولا محتوى مختلط (سليم).
- لا يوجد `WebView.setWebContentsDebuggingEnabled` ⇒ لا يمكن فحصه من الخارج (جيد).
- الشهادة الموقّعة في ملفاتك: SHA-256 = `e5dbf33c16f2d1fcb5757a30c8c1fd7ecf679cfcc377a87b71072ddf09f0dff1`
  (احتفظ بها للمقارنة إن أردت التحقق من أي ملف قبل تثبيته: `apksigner verify --print-certs file.apk`).
