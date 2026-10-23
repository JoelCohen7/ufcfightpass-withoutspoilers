package com.joelcohen.withoutspoilers;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Opens UFC Fight Pass in a WebView with the "UFC Fight Pass Without Spoilers" userscript injected.
 * Outside the player the D-pad moves a pointer (OK = click). Inside a video the keys jump in time.
 */
public class MainActivity extends Activity {
    private static final String HOME = "https://www.ufcfightpass.com/";
    private static final String SCRIPT_URL =
            "https://raw.githubusercontent.com/JoelCohen7/ufcfightpass-withoutspoilers/main/ufcfightpass-withoutspoilers.user.js";
    private static final String SCRIPT_ASSET = "ufcfightpass-withoutspoilers.user.js";
    private static final String SCRIPT_CACHE = "ufcfightpass-withoutspoilers.user.js";
    // Desktop user agent: with an Android one the site pushes the app instead of the website.
    private static final String DESKTOP_UA =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

    private WebView web;
    private CursorView cursor;
    private FrameLayout fullscreenHost;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private String script;
    private boolean startScriptRegistered;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean inPlayer;          // the page has the Fight Pass player
    private boolean inPreview;         // thumbnail mode is on
    private boolean forceCursor;       // in the player, the user asked for the pointer (key 0)
    private boolean helpShown;
    private long lastBack;
    private long lastCursorMove;
    private boolean clickPending;      // OK was pressed in pointer mode; the click happens on release

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        fullscreenHost = new FrameLayout(this);
        fullscreenHost.setVisibility(View.GONE);
        cursor = new CursorView(this);
        root.addView(web, match());
        root.addView(fullscreenHost, match());
        root.addView(cursor, match());
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(DESKTOP_UA);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);

        script = loadScript();
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            Set<String> origins = new HashSet<>();
            origins.add("https://www.ufcfightpass.com");
            origins.add("https://ufcfightpass.com");
            WebViewCompat.addDocumentStartJavaScript(web, script, origins);
            startScriptRegistered = true;
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (!startScriptRegistered && isFightPass(url)) view.evaluateJavascript(script, null);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // Fallback when the WebView lacks document-start scripts; the script guards against running twice.
                if (!startScriptRegistered && isFightPass(url)) view.evaluateJavascript(script, null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // DRM (Widevine): Paramount+ needs it; Fight Pass doesn't use it today.
                for (String r : request.getResources()) {
                    if (PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID.equals(r)) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID});
                        return;
                    }
                }
                request.deny();
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                customView = view;
                customViewCallback = callback;
                fullscreenHost.addView(view, match());
                fullscreenHost.setVisibility(View.VISIBLE);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });

        float d = getResources().getDisplayMetrics().density;
        cursor.moveTo(200 * d, 200 * d);
        web.loadUrl(HOME);
        handler.post(pollState);
        updateScriptInBackground();
    }

    private static FrameLayout.LayoutParams match() {
        return new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
    }

    private static boolean isFightPass(String url) {
        return url != null && (url.startsWith("https://www.ufcfightpass.com") || url.startsWith("https://ufcfightpass.com"));
    }

    private void exitFullscreen() {
        if (customView == null) return;
        fullscreenHost.removeView(customView);
        fullscreenHost.setVisibility(View.GONE);
        customView = null;
        if (customViewCallback != null) customViewCallback.onCustomViewHidden();
        customViewCallback = null;
    }

    // ---------- Script: the latest one saved from GitHub, or the one bundled with the app ----------

    private String loadScript() {
        String bundled = readAsset();
        File cache = new File(getFilesDir(), SCRIPT_CACHE);
        if (cache.exists()) {
            try (InputStream in = new java.io.FileInputStream(cache)) {
                String cached = new String(readAll(in), StandardCharsets.UTF_8);
                if (compareVersions(version(cached), version(bundled)) > 0) return cached;
            } catch (Exception ignored) {
            }
        }
        return bundled;
    }

    private String readAsset() {
        try (InputStream in = getAssets().open(SCRIPT_ASSET)) {
            return new String(readAll(in), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    /** Downloads the latest script; it's used on the next launch. */
    private void updateScriptInBackground() {
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(SCRIPT_URL).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                if (c.getResponseCode() != 200) return;
                String fresh;
                try (InputStream in = c.getInputStream()) {
                    fresh = new String(readAll(in), StandardCharsets.UTF_8);
                }
                if (!fresh.contains("==UserScript==")) return;
                if (compareVersions(version(fresh), version(script)) > 0) {
                    try (FileOutputStream out = new FileOutputStream(new File(getFilesDir(), SCRIPT_CACHE))) {
                        out.write(fresh.getBytes(StandardCharsets.UTF_8));
                    }
                    handler.post(() -> Toast.makeText(this,
                            "New script version (" + version(fresh) + "): it will be used next time you open the app",
                            Toast.LENGTH_LONG).show());
                }
            } catch (Exception ignored) {
            }
        }).start();
    }

    private static byte[] readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
    }

    private static String version(String s) {
        Matcher m = Pattern.compile("@version\\s+([0-9.]+)").matcher(s == null ? "" : s);
        return m.find() ? m.group(1) : "0";
    }

    private static int compareVersions(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? Integer.parseInt(x[i]) : 0;
            int q = i < y.length ? Integer.parseInt(y[i]) : 0;
            if (p != q) return Integer.compare(p, q);
        }
        return 0;
    }

    // ---------- Page state ----------

    private final Runnable pollState = new Runnable() {
        @Override
        public void run() {
            web.evaluateJavascript(
                    "(function(){var a=window.fpnsApi;return a?[a.isPlayer(),a.inPreview()].join(','):'false,false'})()",
                    value -> {
                        String v = value == null ? "" : value.replace("\"", "");
                        String[] p = v.split(",");
                        boolean player = p.length > 0 && "true".equals(p[0]);
                        inPreview = p.length > 1 && "true".equals(p[1]);
                        if (player != inPlayer) {
                            inPlayer = player;
                            forceCursor = false;
                            if (player && !helpShown) {
                                helpShown = true;
                                Toast.makeText(MainActivity.this,
                                        "OK pause · ←/→ 10 s · ↑/↓ 1 min · 1/3 30 s · 4/6 5 min · 5 thumbnails · 0 pointer",
                                        Toast.LENGTH_LONG).show();
                            }
                        }
                        updateCursorVisibility();
                    });
            handler.postDelayed(this, 400);
        }
    };

    private boolean playerKeys() {
        return inPlayer && !forceCursor;
    }

    /** The pointer is always shown outside the player; inside it, only after pressing 0. */
    private void updateCursorVisibility() {
        cursor.setVisibility(playerKeys() ? View.GONE : View.VISIBLE);
    }

    private void js(String code) {
        web.evaluateJavascript("window.fpnsApi&&(" + code + ")", null);
    }

    // ---------- Remote control ----------

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (e.getAction() == KeyEvent.ACTION_UP) {
            // Click on release: if the tap opens the on-screen keyboard, the release must not reach it (it closes it).
            if (clickPending && (k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER)) {
                clickPending = false;
                click(cursor.getCursorX(), cursor.getCursorY());
                return true;
            }
            return isHandledKey(k) || super.dispatchKeyEvent(e);
        }
        if (e.getAction() != KeyEvent.ACTION_DOWN) return super.dispatchKeyEvent(e);

        if (k == KeyEvent.KEYCODE_BACK) {
            onBackKey();
            return true;
        }
        if (playerKeys()) {
            if (playerKey(k, e.getRepeatCount())) return true;
        } else {
            if (cursorKey(k, e.getRepeatCount())) return true;
        }
        return super.dispatchKeyEvent(e);
    }

    private static boolean isHandledKey(int k) {
        switch (k) {
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
            case KeyEvent.KEYCODE_CHANNEL_UP:
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
                return true;
            default:
                return k >= KeyEvent.KEYCODE_0 && k <= KeyEvent.KEYCODE_9;
        }
    }

    private void onBackKey() {
        if (inPreview) {
            js("fpnsApi.previewCancel()");
            inPreview = false;
            return;
        }
        if (customView != null) {
            web.evaluateJavascript("document.exitFullscreen&&document.exitFullscreen()", null);
            exitFullscreen();
            return;
        }
        if (inPlayer && forceCursor) {
            forceCursor = false;
            updateCursorVisibility();
            return;
        }
        if (web.canGoBack()) {
            web.goBack();
            return;
        }
        long now = SystemClock.uptimeMillis();
        if (now - lastBack < 2500) {
            finish();
        } else {
            lastBack = now;
            Toast.makeText(this, "Press Back again to exit", Toast.LENGTH_SHORT).show();
        }
    }

    /** Keys inside the player. In thumbnail mode the arrows move the preview. */
    private boolean playerKey(int k, int repeat) {
        if (inPreview) {
            int step = repeat > 6 ? 120 : 30;
            switch (k) {
                case KeyEvent.KEYCODE_DPAD_LEFT: js("fpnsApi.previewMove(" + -step + ")"); return true;
                case KeyEvent.KEYCODE_DPAD_RIGHT: js("fpnsApi.previewMove(" + step + ")"); return true;
                case KeyEvent.KEYCODE_DPAD_UP: js("fpnsApi.previewMove(300)"); return true;
                case KeyEvent.KEYCODE_DPAD_DOWN: js("fpnsApi.previewMove(-300)"); return true;
                case KeyEvent.KEYCODE_DPAD_CENTER:
                case KeyEvent.KEYCODE_ENTER:
                case KeyEvent.KEYCODE_5:
                    js("fpnsApi.previewCommit()");
                    inPreview = false;
                    return true;
                default:
                    break;
            }
        }
        switch (k) {
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                if (repeat == 0) js("fpnsApi.togglePlay()");
                return true;
            case KeyEvent.KEYCODE_DPAD_LEFT: js("fpnsApi.jump(-10)"); return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT: js("fpnsApi.jump(10)"); return true;
            case KeyEvent.KEYCODE_DPAD_UP: js("fpnsApi.jump(60)"); return true;
            case KeyEvent.KEYCODE_DPAD_DOWN: js("fpnsApi.jump(-60)"); return true;
            case KeyEvent.KEYCODE_1: js("fpnsApi.jump(-30)"); return true;
            case KeyEvent.KEYCODE_3: js("fpnsApi.jump(30)"); return true;
            case KeyEvent.KEYCODE_4:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
                js("fpnsApi.jump(-300)");
                return true;
            case KeyEvent.KEYCODE_6:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
            case KeyEvent.KEYCODE_CHANNEL_UP:
                js("fpnsApi.jump(300)");
                return true;
            case KeyEvent.KEYCODE_2: js("fpnsApi.toggleElapsed()"); return true;
            case KeyEvent.KEYCODE_5:
                js("fpnsApi.previewMove(0)");
                inPreview = true;
                return true;
            case KeyEvent.KEYCODE_0:
                forceCursor = true;
                lastCursorMove = SystemClock.uptimeMillis();
                updateCursorVisibility();
                Toast.makeText(this, "Pointer (Back returns to the video controls)", Toast.LENGTH_SHORT).show();
                return true;
            default:
                return false;
        }
    }

    /** Keys outside the player: the pointer. */
    private boolean cursorKey(int k, int repeat) {
        float d = getResources().getDisplayMetrics().density;
        float step = Math.min(10 + repeat * 4, 40) * d;
        float x = cursor.getCursorX(), y = cursor.getCursorY();
        float w = cursor.getWidth(), h = cursor.getHeight();
        float edge = 4 * d;
        switch (k) {
            case KeyEvent.KEYCODE_DPAD_LEFT: x -= step; break;
            case KeyEvent.KEYCODE_DPAD_RIGHT: x += step; break;
            case KeyEvent.KEYCODE_DPAD_UP:
                if (y <= edge) { scroll(1); return true; }
                y -= step;
                break;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                if (y >= h - edge) { scroll(-1); return true; }
                y += step;
                break;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                if (repeat == 0) clickPending = true;
                return true;
            case KeyEvent.KEYCODE_CHANNEL_UP: scroll(3); return true;
            case KeyEvent.KEYCODE_CHANNEL_DOWN: scroll(-3); return true;
            default:
                return false;
        }
        x = Math.max(0, Math.min(w - 1, x));
        y = Math.max(0, Math.min(h - 1, y));
        cursor.moveTo(x, y);
        lastCursorMove = SystemClock.uptimeMillis();
        updateCursorVisibility();
        hover(x, y);
        return true;
    }

    private MotionEvent mouseEvent(int action, float x, float y) {
        long now = SystemClock.uptimeMillis();
        MotionEvent.PointerProperties[] props = {new MotionEvent.PointerProperties()};
        props[0].id = 0;
        props[0].toolType = MotionEvent.TOOL_TYPE_MOUSE;
        MotionEvent.PointerCoords[] coords = {new MotionEvent.PointerCoords()};
        coords[0].x = x;
        coords[0].y = y;
        return MotionEvent.obtain(now, now, action, 1, props, coords, 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_MOUSE, 0);
    }

    private View target() {
        return customView != null ? customView : web;
    }

    private void hover(float x, float y) {
        MotionEvent ev = mouseEvent(MotionEvent.ACTION_HOVER_MOVE, x, y);
        target().dispatchGenericMotionEvent(ev);
        ev.recycle();
    }

    /** Mouse wheel at the pointer position (positive = up). */
    private void scroll(float amount) {
        long now = SystemClock.uptimeMillis();
        MotionEvent.PointerProperties[] props = {new MotionEvent.PointerProperties()};
        props[0].toolType = MotionEvent.TOOL_TYPE_MOUSE;
        MotionEvent.PointerCoords[] coords = {new MotionEvent.PointerCoords()};
        coords[0].x = cursor.getCursorX();
        coords[0].y = cursor.getCursorY();
        coords[0].setAxisValue(MotionEvent.AXIS_VSCROLL, amount);
        MotionEvent ev = MotionEvent.obtain(now, now, MotionEvent.ACTION_SCROLL, 1, props, coords, 0, 0, 1f, 1f, 0, 0,
                InputDevice.SOURCE_MOUSE, 0);
        target().dispatchGenericMotionEvent(ev);
        ev.recycle();
    }

    private void click(float x, float y) {
        long down = SystemClock.uptimeMillis();
        MotionEvent a = MotionEvent.obtain(down, down, MotionEvent.ACTION_DOWN, x, y, 0);
        a.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        MotionEvent b = MotionEvent.obtain(down, down + 60, MotionEvent.ACTION_UP, x, y, 0);
        b.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        View t = target();
        if (t == web && !web.hasFocus()) web.requestFocus();
        t.dispatchTouchEvent(a);
        t.dispatchTouchEvent(b);
        a.recycle();
        b.recycle();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        web.destroy();
        super.onDestroy();
    }
}
