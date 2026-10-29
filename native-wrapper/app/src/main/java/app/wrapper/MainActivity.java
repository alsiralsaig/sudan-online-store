package app.wrapper;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * غلاف أندرويد أصلي لتطبيق سند (كاشير / متجر / إدارة).
 * -----------------------------------------------------------------
 * نفس بنية الغلاف الذي وردت ملفاته جاهزة: نشاط واحد فيه WebView يفتح
 * نسخة الويب من الخادم مباشرة، مع:
 *   • شريط حالة بلون العلامة (edge-to-edge) وشاشة «ما في اتصال» بالعربية.
 *   • رفع الملفات/الكاميرا/الميكروفون من داخل الصفحة (FileChooser + PermissionRequest).
 *   • طباعة الفواتير عبر خدمة الطباعة في أندرويد (window.print من الويب).
 *   • الروابط الخارجية (واتساب/تليفون/أي نطاق آخر) تُفتح في تطبيق النظام لا داخل التطبيق.
 *   • زر الرجوع = رجوع داخل الصفحة، والثاني يخرج برسالة.
 */
public class MainActivity extends Activity {

    // ---- هوية كل تطبيق (تُستبدل قيمها وقت البناء من gradle) ----
    static final String HOST = BuildConfig.HOST;
    static final String START_URL = BuildConfig.START_URL;
    static final String THEME = BuildConfig.THEME;
    static final String UA_TAG = BuildConfig.UA_TAG;
    static final String VERSION = BuildConfig.VERSION_NAME;

    private static final int FILE_REQ = 1001;
    private static final int MIC_REQ = 1002;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingPermission;
    private long lastBack = 0L;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        // شريط الحالة بلون العلامة
        getWindow().setStatusBarColor(Color.parseColor(THEME));
        getWindow().setNavigationBarColor(Color.parseColor(THEME));

        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(Color.parseColor(THEME));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(false);
        // الفيديو/الصوت في المتجر يحتاج ضغطة واحدة فقط
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " " + UA_TAG + "/" + VERSION);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);

        // روابط داخل التطبيق فقط، والباقي لتطبيقات النظام
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (isInternal(u)) {
                    view.loadUrl(u.toString());
                } else {
                    openExternal(u);
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // يجعل زر «طباعة» في الويب يفتح طباعة أندرويد الحقيقية
                view.evaluateJavascript("window.print=function(){AndroidApp.print()};", null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) showOffline();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> grantAllowed(request));
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), FILE_REQ);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        // جسر بسيط: window.print → طباعة أندرويد
        web.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void print() {
                runOnUiThread(MainActivity.this::doPrint);
            }
        }, "AndroidApp");

        if (state != null) {
            web.restoreState(state);
        } else {
            web.loadUrl(START_URL);
        }
    }

    /** هل الرابط داخل نطاق سند؟ */
    private boolean isInternal(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme();
        String host = u.getHost() == null ? "" : u.getHost();
        return ("https".equals(scheme) || "http".equals(scheme))
                && (host.equals(HOST) || host.endsWith("." + HOST));
    }

    private void openExternal(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "ما في تطبيق يفتح الرابط ده", Toast.LENGTH_SHORT).show();
        }
    }

    /** شاشة عربية تظهر عند انقطاع الشبكة أو تعذّر الوصول للخادم. */
    private void showOffline() {
        String html = "<html dir='rtl'><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='font-family:sans-serif;background:" + THEME + ";color:#fff;display:flex;"
                + "flex-direction:column;align-items:center;justify-content:center;height:90vh;text-align:center'>"
                + "<div style='font-size:48px'>📡</div><h2>ما في اتصال بالإنترنت</h2>"
                + "<p style='opacity:.8'>اتأكد من الشبكة وجرّب تاني</p>"
                + "<button onclick=\"location.href='" + START_URL + "'\" style='margin-top:16px;padding:14px 40px;"
                + "border:0;border-radius:16px;background:#f59e0b;color:#111;font-size:16px;font-weight:bold'>"
                + "إعادة المحاولة</button></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    /** منح صلاحيات الكاميرا/الميكروفون المطلوبة من الصفحة فقط. */
    private void grantAllowed(PermissionRequest request) {
        java.util.List<String> wanted = new java.util.ArrayList<>();
        for (String res : request.getResources()) {
            if ("android.webkit.resource.AUDIO_CAPTURE".equals(res)) {
                wanted.add(android.Manifest.permission.RECORD_AUDIO);
            } else if ("android.webkit.resource.VIDEO_CAPTURE".equals(res)) {
                wanted.add(android.Manifest.permission.CAMERA);
            }
        }
        if (wanted.isEmpty()) {
            request.deny();
            return;
        }
        java.util.List<String> missing = new java.util.ArrayList<>();
        for (String p : wanted) {
            if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
        }
        if (missing.isEmpty()) {
            request.grant(request.getResources());
        } else {
            pendingPermission = request;
            requestPermissions(missing.toArray(new String[0]), MIC_REQ);
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code != MIC_REQ || pendingPermission == null) return;
        boolean all = true;
        for (int r : results) if (r != PackageManager.PERMISSION_GRANTED) all = false;
        if (all) pendingPermission.grant(pendingPermission.getResources());
        else pendingPermission.deny();
        pendingPermission = null;
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == FILE_REQ && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
    }

    /** طباعة الصفحة الحالية (تُستخدم لطباعة الفواتير من الويب). */
    private void doPrint() {
        PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
        String job = web.getTitle() == null ? "Sanad" : web.getTitle();
        PrintDocumentAdapter adapter = web.createPrintDocumentAdapter(job);
        pm.print(job, adapter, new PrintAttributes.Builder().build());
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    /** زر الرجوع مرتين للخروج (بعد آخر الصفحات). */
    @Override
    public void onBackPressed() {
        if (web.canGoBack()) {
            web.goBack();
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBack < 2000) {
            super.onBackPressed();
        } else {
            lastBack = now;
            Toast.makeText(this, "اضغط رجوع تاني للخروج", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        super.onPause();
    }
}
