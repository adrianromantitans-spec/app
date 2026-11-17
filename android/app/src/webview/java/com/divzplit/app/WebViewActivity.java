package com.divzplit.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.IOException;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.browser.customtabs.CustomTabsIntent;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import android.util.Base64;

/** Opt-in pilot. The live website, its intro, data model and auth stay unchanged. */
public final class WebViewActivity extends Activity {
    private static final String ORIGIN = "https://divzplit.com";
    private static final int PICK_FILE = 10, SAVE_JSON = 11, MAX_EXPORT = 20 * 1024 * 1024;
    private WebView web;
    private NativePush push;
    private FrameLayout surface;
    private View errorView;
    private ValueCallback<Uri[]> fileResult;
    private byte[] pendingExport;
    private File cameraFile;
    private Uri cameraUri;
    private WebMessagePort nativePort;
    private String bridgeScript;
    private boolean failed;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        push = new NativePush(this);
        surface = new FrameLayout(this);
        surface.setBackgroundColor(Color.rgb(248, 245, 253));
        surface.setFitsSystemWindows(true);
        setContentView(surface);
        surface.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars()
                        | android.view.WindowInsets.Type.displayCutout() | android.view.WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(248, 245, 253));
        surface.addView(web, new FrameLayout.LayoutParams(-1, -1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, agent, disposition, mime, length) -> {
            if (!WebViewPolicy.internal(web.getUrl())) return;
            if (url.startsWith("blob:" + ORIGIN + "/")) {
                web.evaluateJavascript("window.__divzplitDownload?.(" + JSONObject.quote(url) + ")", null);
            } else if (WebViewPolicy.external(url)) openExternal(Uri.parse(url));
        });
        try (InputStream input = getAssets().open("native-webview.js")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096]; int count;
            while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            bridgeScript = new String(bytes.toByteArray(), StandardCharsets.UTF_8);
        } catch (java.io.IOException error) { showError(); return; }
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::navigateBack);
        }
        String incoming = launchUrl(getIntent());
        if (state == null || web.restoreState(state) == null) web.loadUrl(incoming);
    }

    // Keep the PKCE callback in this SAME WebView: Chrome and WebView do not share sessionStorage.
    private String launchUrl(Intent intent) {
        Uri uri = intent.getData();
        if (uri == null || !WebViewPolicy.internal(uri.toString())) return getString(com.divzplit.app.R.string.launchUrl);
        if ("/".equals(uri.getPath()) && (uri.getQueryParameter("code") != null
                || uri.getQueryParameter("error") != null)) {
            return uri.buildUpon().path("/app/").appendQueryParameter("legacy_auth_return", "1")
                    .appendQueryParameter("source", "installed").build().toString();
        }
        if ("/".equals(uri.getPath()) && uri.getFragment() == null) return getString(com.divzplit.app.R.string.launchUrl);
        return uri.toString();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        if (intent.getData() != null && WebViewPolicy.internal(intent.getData().toString())) web.loadUrl(launchUrl(intent));
    }

    private boolean navigate(WebResourceRequest request) {
        String url = request.getUrl().toString();
        if (WebViewPolicy.internal(url)) return false;
        if (request.isForMainFrame() && WebViewPolicy.external(url)) openExternal(request.getUrl());
        return true; // Never load OAuth providers, external pages, file/content/javascript or intent URLs here.
    }

    private void openExternal(Uri uri) {
        try {
            if ("https".equalsIgnoreCase(uri.getScheme())) new CustomTabsIntent.Builder().build().launchUrl(this, uri);
            else startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, R.string.native_no_handler, Toast.LENGTH_SHORT).show();
        }
    }

    private final class Client extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return navigate(request); }
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            // shouldOverrideUrlLoading does not intercept POST navigations. Fail closed there too.
            if (request.isForMainFrame() && !WebViewPolicy.internal(request.getUrl().toString())) {
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", java.util.Collections.emptyMap(),
                        new java.io.ByteArrayInputStream(new byte[0]));
            }
            return null;
        }
        @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
            failed = false; closePort();
        }
        @Override public void onPageFinished(WebView view, String url) {
            if (view == web && !isFinishing() && !failed && WebViewPolicy.internal(url)) {
                if (errorView != null) { surface.removeView(errorView); errorView = null; }
                view.setVisibility(View.VISIBLE);
                view.evaluateJavascript(bridgeScript, ignored -> {
                    if (view != web || isFinishing() || !WebViewPolicy.internal(view.getUrl())) return;
                    closePort();
                    WebMessagePort[] ports = view.createWebMessageChannel(); nativePort = ports[0];
                    nativePort.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
                        @Override public void onMessage(WebMessagePort port, WebMessage message) { receive(port, message.getData()); }
                    }, new Handler(Looper.getMainLooper()));
                    view.postWebMessage(new WebMessage("divzplit-native-ready", new WebMessagePort[]{ports[1]}), Uri.parse(ORIGIN));
                });
            }
        }
        @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel(); showError();
        }
        @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) showError();
        }
        @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request.isForMainFrame() && response.getStatusCode() >= 400) showError();
        }
        @Override public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
            // A crashed renderer must not make this pilot silently fall back to a browser.
            surface.removeView(web); web.destroy(); web = null; recreate(); return true;
        }
    }

    private final class Chrome extends WebChromeClient {
        @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
        @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileResult != null) fileResult.onReceiveValue(null);
            fileResult = callback;
            clearCamera(true);
            Intent documents = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("image/*").putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
            Intent camera = cameraIntent();
            Intent picker = Intent.createChooser(documents, null);
            if (camera != null) picker.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
            try { startActivityForResult(params.isCaptureEnabled() && camera != null ? camera : picker, PICK_FILE); }
            catch (ActivityNotFoundException error) { clearCamera(true); fileResult.onReceiveValue(null); fileResult = null; }
            return true;
        }
        @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, android.os.Message result) {
            if (!userGesture) return false;
            WebView popup = new WebView(WebViewActivity.this);
            popup.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                    String url = request.getUrl().toString();
                    if (WebViewPolicy.internal(url)) web.loadUrl(url);
                    else if (WebViewPolicy.external(url)) openExternal(request.getUrl());
                    child.destroy(); return true;
                }
            });
            ((WebView.WebViewTransport) result.obj).setWebView(popup); result.sendToTarget(); return true;
        }
    }

    private Intent cameraIntent() {
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) == null) return null;
        try {
            File directory = new File(getCacheDir(), "receipt_camera");
            if (!directory.isDirectory() && !directory.mkdirs()) return null;
            File[] old = directory.listFiles();
            if (old != null) for (File file : old) {
                if (file.lastModified() < System.currentTimeMillis() - 24 * 60 * 60 * 1000L) file.delete();
            }
            cameraFile = File.createTempFile("receipt-", ".jpg", directory);
            cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".webviewfiles", cameraFile);
            camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            camera.setClipData(ClipData.newRawUri("DivZplit receipt", cameraUri));
            camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return camera;
        } catch (IOException | IllegalArgumentException error) { clearCamera(true); return null; }
    }

    private void clearCamera(boolean delete) {
        if (cameraUri != null) revokeUriPermission(cameraUri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        if (delete && cameraFile != null) cameraFile.delete();
        cameraFile = null; cameraUri = null;
    }

    private void receive(WebMessagePort port, String data) {
        if (web == null || !WebViewPolicy.internal(web.getUrl()) || data == null || data.length() > MAX_EXPORT * 2) return;
        int id = 0;
        try {
            JSONObject message = new JSONObject(data); id = message.getInt("id");
            if (push.handle(port, message)) return;
            if ("clipboard".equals(message.getString("type"))) {
                String text = message.getString("text");
                if (text.length() > 65536) throw new IllegalArgumentException();
                ((ClipboardManager) getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("DivZplit", text));
            } else if ("export".equals(message.getString("type"))) {
                if (pendingExport != null) throw new IllegalStateException();
                byte[] bytes = Base64.decode(message.getString("base64"), Base64.NO_WRAP);
                if (bytes.length > MAX_EXPORT) throw new IllegalArgumentException();
                // Only JSON exports, never arbitrary file types or filesystem paths.
                new JSONObject(new String(bytes, StandardCharsets.UTF_8));
                pendingExport = bytes;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("application/json").putExtra(Intent.EXTRA_TITLE, "divzplit-datos.json");
                startActivityForResult(intent, SAVE_JSON);
            } else throw new IllegalArgumentException();
            port.postMessage(new WebMessage("{\"id\":" + id + ",\"ok\":true}"));
        } catch (JSONException | IllegalArgumentException | IllegalStateException | ActivityNotFoundException error) {
            if (pendingExport != null) pendingExport = null;
            port.postMessage(new WebMessage("{\"id\":" + id + ",\"ok\":false}"));
        }
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(request, permissions, grants); push.permissionResult(request);
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE && fileResult != null) {
            Uri[] selected = WebChromeClient.FileChooserParams.parseResult(result, data);
            boolean captured = result == RESULT_OK && selected == null && cameraFile != null && cameraFile.length() > 0;
            if (captured) selected = new Uri[]{cameraUri};
            fileResult.onReceiveValue(selected); fileResult = null;
            // Successful output stays private in cache for the async web/OCR reader.
            clearCamera(!captured);
        }
        if (request == SAVE_JSON) {
            byte[] bytes = pendingExport; pendingExport = null;
            if (result == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (out == null) throw new java.io.IOException();
                    out.write(bytes);
                } catch (java.io.IOException error) { Toast.makeText(this, R.string.native_export_error, Toast.LENGTH_LONG).show(); }
            }
        }
    }

    private void showError() {
        failed = true; closePort();
        if (errorView != null) return;
        LinearLayout panel = new LinearLayout(this); panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(android.view.Gravity.CENTER); panel.setPadding(32, 32, 32, 32);
        panel.setBackgroundColor(Color.rgb(248, 245, 253));
        TextView text = new TextView(this); text.setText("DivZplit\n" + getString(R.string.native_connection)); text.setGravity(android.view.Gravity.CENTER);
        Button retry = new Button(this); retry.setText(R.string.native_retry); retry.setOnClickListener(v -> web.loadUrl(getString(com.divzplit.app.R.string.launchUrl)));
        panel.addView(text); panel.addView(retry); errorView = panel;
        surface.addView(panel, new FrameLayout.LayoutParams(-1, -1));
    }

    @Override public void onBackPressed() { navigateBack(); }
    private void navigateBack() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("window.__divzplitBack?.() || false", closed -> {
            if (web == null || isFinishing() || "true".equals(closed)) return;
            if (web.canGoBack()) web.goBack(); else finish();
        });
    }
    @Override protected void onSaveInstanceState(Bundle state) { if (web != null) web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { if (web != null) web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); web.evaluateJavascript("window.dispatchEvent(new Event(\"divzplit-native-resume\"))", null); } }
    private void closePort() { if (nativePort != null) { nativePort.close(); nativePort = null; } }
    @Override protected void onDestroy() {
        closePort(); if (push != null) push.close(); pendingExport = null; clearCamera(true);
        if (fileResult != null) { fileResult.onReceiveValue(null); fileResult = null; }
        if (web != null) { surface.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
}
