package org.pfcc.financeos;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.KeyguardManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {

    private static final String ENTRY_URL = "file:///android_asset/www/index.html";
    private static final String ALLOWED_APK_HOST_PREFIX = "https://github.com/mackenziebirlymassie-lang/EXT/releases/download/";
    private static final String ALLOWED_CDN_PREFIX = "https://objects.githubusercontent.com/";
    private static final String ALLOWED_RELEASE_ASSETS_PREFIX = "https://release-assets.githubusercontent.com/";
    private static final int REQ_FILE_PICKER = 1001;
    private static final int REQ_CREATE_DOCUMENT = 1002;
    private static final int REQ_UNKNOWN_SOURCES = 1003;
    private static final int REQ_DEVICE_CREDENTIAL = 1004;

    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileCallback;
    private byte[] pendingSaveBytes;
    private boolean pendingApkInstallReady;
    private boolean startupUpdateChecked;
    private String pendingShortcutAction;

    private String sanitizeShortcutAction(Intent intent) {
        if (intent == null) return null;
        String raw = intent.getStringExtra("ext_shortcut");
        if ("expense".equals(raw) || "budget".equals(raw) || "forecast".equals(raw)) {
            return raw;
        }
        return null;
    }

    private void dispatchShortcutToWeb(String action) {
        if (action == null || webView == null) return;
        webView.evaluateJavascript(
            "if(window.PFCC&&PFCC.handleAndroidShortcut){PFCC.handleAndroidShortcut(" + JSONObject.quote(action) + ");}",
            null
        );
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        pendingShortcutAction = sanitizeShortcutAction(getIntent());

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0A0A0A"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUriNavigation(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUriNavigation(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (pendingShortcutAction != null && url != null && url.startsWith("file:///android_asset/")) {
                    String shortcut = pendingShortcutAction;
                    pendingShortcutAction = null;
                    dispatchShortcutToWeb(shortcut);
                }
                if (BuildConfig.ENABLE_SELF_UPDATE && !startupUpdateChecked && url != null && url.startsWith("file:///android_asset/")) {
                    startupUpdateChecked = true;
                    checkForGitHubUpdate(false);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
            ) {
                if (pendingFileCallback != null) {
                    pendingFileCallback.onReceiveValue(null);
                }
                pendingFileCallback = filePathCallback;

                Intent intent;
                try {
                    intent = fileChooserParams != null
                        ? fileChooserParams.createIntent()
                        : new Intent(Intent.ACTION_GET_CONTENT).setType("*/*");
                    startActivityForResult(intent, REQ_FILE_PICKER);
                    return true;
                } catch (ActivityNotFoundException ex) {
                    Intent fallback = new Intent(Intent.ACTION_GET_CONTENT);
                    fallback.addCategory(Intent.CATEGORY_OPENABLE);
                    fallback.setType("*/*");
                    try {
                        startActivityForResult(Intent.createChooser(fallback, "Select file"), REQ_FILE_PICKER);
                        return true;
                    } catch (ActivityNotFoundException ignored) {
                        pendingFileCallback.onReceiveValue(null);
                        pendingFileCallback = null;
                        Toast.makeText(MainActivity.this, "No file picker available on device.", Toast.LENGTH_SHORT).show();
                        return false;
                    }
                }
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                if (url != null && url.startsWith("data:")) {
                    saveDataUri("export_file", url);
                }
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(ENTRY_URL);
        }
    }

    private void configureSystemBars() {
        Window window = getWindow();
        int onyx = Color.parseColor("#0A0A0A");
        window.setStatusBarColor(onyx);
        window.setNavigationBarColor(onyx);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            View decor = window.getDecorView();
            decor.setSystemUiVisibility(decor.getSystemUiVisibility()
                & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }

    private boolean handleUriNavigation(Uri uri) {
        if (uri == null) return false;
        String str = uri.toString();
        if (str.startsWith("file:///android_asset/") || str.startsWith("data:")) {
            return false;
        }
        try {
            Intent external = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(external);
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, "No application found to open link.", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private void checkForGitHubUpdate(boolean userInitiated) {
        if (!BuildConfig.ENABLE_SELF_UPDATE) return;
        ioExecutor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(BuildConfig.UPDATE_API_URL).openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.setRequestProperty("Accept", "application/vnd.github+json");
                conn.setRequestProperty("User-Agent", "EXT-Expense-Tracker-Android");

                int code = conn.getResponseCode();
                if (code != HttpURLConnection.HTTP_OK) {
                    if (userInitiated) {
                        runOnUiThread(() -> Toast.makeText(this, "Update check unavailable (" + code + ").", Toast.LENGTH_SHORT).show());
                    }
                    return;
                }

                StringBuilder sb = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                }

                JSONObject json = new JSONObject(sb.toString());
                String title = json.optString("name", "EXT Update");
                String body = json.optString("body", "");
                int remoteBuild = parseBuildNumber(body, title);
                String apkUrl = extractApkUrl(json.optJSONArray("assets"));

                if (remoteBuild > BuildConfig.APP_BUILD_NUMBER && apkUrl != null) {
                    String safeTitle = JSONObject.quote(title);
                    String safeUrl = JSONObject.quote(apkUrl);
                    runOnUiThread(() -> {
                        if (webView != null) {
                            webView.evaluateJavascript(
                                "window.PFCC && PFCC.onAppUpdateAvailable && PFCC.onAppUpdateAvailable("
                                    + remoteBuild + "," + safeTitle + "," + safeUrl + ");",
                                null
                            );
                        }
                    });
                } else if (userInitiated) {
                    runOnUiThread(() -> Toast.makeText(this, "Already on latest build (#" + BuildConfig.APP_BUILD_NUMBER + ").", Toast.LENGTH_SHORT).show());
                }
            } catch (Exception ex) {
                if (userInitiated) {
                    runOnUiThread(() -> Toast.makeText(this, "Offline or update check failed.", Toast.LENGTH_SHORT).show());
                }
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private int parseBuildNumber(String body, String title) {
        Matcher em = Pattern.compile("EXT_BUILD:(\\d+)").matcher(body != null ? body : "");
        if (em.find()) {
            return Integer.parseInt(em.group(1));
        }
        Matcher m = Pattern.compile("PFCC_BUILD:(\\d+)").matcher(body != null ? body : "");
        if (m.find()) {
            return Integer.parseInt(m.group(1));
        }
        Matcher tm = Pattern.compile("Build #(\\d+)").matcher(title != null ? title : "");
        if (tm.find()) {
            return Integer.parseInt(tm.group(1));
        }
        return 0;
    }

    private String extractApkUrl(JSONArray assets) {
        if (assets == null) return null;
        for (int i = 0; i < assets.length(); i++) {
            JSONObject item = assets.optJSONObject(i);
            if (item == null) continue;
            String name = item.optString("name", "");
            String url = item.optString("browser_download_url", "");
            if (name.endsWith(".apk") && url.startsWith(ALLOWED_APK_HOST_PREFIX)) {
                return url;
            }
        }
        return null;
    }

    private boolean isAllowedApkUrl(String url) {
        if (url == null) return false;
        return url.startsWith(ALLOWED_APK_HOST_PREFIX)
            || url.startsWith(ALLOWED_CDN_PREFIX)
            || url.startsWith(ALLOWED_RELEASE_ASSETS_PREFIX);
    }

    private void downloadAndInstallApk(String downloadUrl) {
        if (!isAllowedApkUrl(downloadUrl)) {
            runOnUiThread(() -> Toast.makeText(this, "Blocked untrusted APK update URL.", Toast.LENGTH_LONG).show());
            return;
        }
        ioExecutor.execute(() -> {
            HttpURLConnection conn = null;
            File outFile = ApkFileProvider.getUpdateApkFile(this);
            File tmpFile = new File(outFile.getParentFile(), "EXT-latest.tmp");
            try {
                String currentUrl = downloadUrl;
                for (int hops = 0; hops < 5; hops++) {
                    conn = (HttpURLConnection) new URL(currentUrl).openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "EXT-Expense-Tracker-Android");
                    int status = conn.getResponseCode();
                    if (status == HttpURLConnection.HTTP_MOVED_TEMP || status == HttpURLConnection.HTTP_MOVED_PERM || status == 307 || status == 308) {
                        String next = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (next == null || !next.startsWith("https://")) {
                            throw new SecurityException("Blocked non-HTTPS update redirect");
                        }
                        currentUrl = next;
                        continue;
                    }
                    if (status != HttpURLConnection.HTTP_OK) {
                        throw new IllegalStateException("HTTP " + status);
                    }
                    long totalBytes = 0;
                    byte[] magic = new byte[2];
                    int magicRead = 0;
                    try (InputStream in = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(tmpFile)) {
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = in.read(buf)) != -1) {
                            if (magicRead < 2) {
                                int copy = Math.min(2 - magicRead, n);
                                System.arraycopy(buf, 0, magic, magicRead, copy);
                                magicRead += copy;
                            }
                            fos.write(buf, 0, n);
                            totalBytes += n;
                        }
                        fos.flush();
                    }
                    if (totalBytes < 10240 || magicRead < 2 || magic[0] != 'P' || magic[1] != 'K') {
                        throw new IllegalStateException("Invalid APK archive downloaded");
                    }
                    if (outFile.exists()) outFile.delete();
                    if (!tmpFile.renameTo(outFile)) {
                        throw new IllegalStateException("Failed to finalize APK file");
                    }
                    runOnUiThread(this::triggerApkInstallIntent);
                    return;
                }
                throw new IllegalStateException("Too many redirects");
            } catch (Exception ex) {
                if (tmpFile.exists()) tmpFile.delete();
                runOnUiThread(() -> Toast.makeText(this, "APK download failed: " + ex.getMessage(), Toast.LENGTH_LONG).show());
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private void triggerApkInstallIntent() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
            pendingApkInstallReady = true;
            Toast.makeText(this, "Allow installs from this app to apply the update.", Toast.LENGTH_LONG).show();
            Intent permIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()));
            try {
                startActivityForResult(permIntent, REQ_UNKNOWN_SOURCES);
            } catch (ActivityNotFoundException ex) {
                pendingApkInstallReady = false;
                Toast.makeText(this, "Open Unknown App Sources settings manually.", Toast.LENGTH_LONG).show();
            }
            return;
        }
        pendingApkInstallReady = false;
        Uri apkUri = ApkFileProvider.getApkUri(this);
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(apkUri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        install.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
        install.putExtra(Intent.EXTRA_INSTALLER_PACKAGE_NAME, getPackageName());
        try {
            startActivity(install);
        } catch (ActivityNotFoundException ex) {
            Toast.makeText(this, "No package installer found on device.", Toast.LENGTH_SHORT).show();
        }
    }

    private void saveDataUri(String defaultFilename, String dataUri) {
        if (dataUri == null || !dataUri.startsWith("data:")) return;
        int commaIdx = dataUri.indexOf(',');
        if (commaIdx <= 5) return;

        String header = dataUri.substring(5, commaIdx);
        String payload = dataUri.substring(commaIdx + 1);
        String mimeType = header.split(";")[0];
        if (mimeType.isEmpty()) mimeType = "application/octet-stream";

        byte[] bytes;
        if (header.contains(";base64")) {
            bytes = Base64.decode(payload, Base64.DEFAULT);
        } else {
            bytes = Uri.decode(payload).getBytes(StandardCharsets.UTF_8);
        }

        launchCreateDocument(defaultFilename, mimeType, bytes);
    }

    private void launchCreateDocument(String filename, String mimeType, byte[] bytes) {
        runOnUiThread(() -> {
            pendingSaveBytes = bytes;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType != null && !mimeType.isEmpty() ? mimeType : "application/octet-stream");
            intent.putExtra(Intent.EXTRA_TITLE, filename != null && !filename.isEmpty() ? filename : "pfcc_export");
            try {
                startActivityForResult(intent, REQ_CREATE_DOCUMENT);
            } catch (ActivityNotFoundException ex) {
                pendingSaveBytes = null;
                Toast.makeText(this, "Document saver unavailable on device.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQ_FILE_PICKER) {
            if (pendingFileCallback != null) {
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                pendingFileCallback.onReceiveValue(results);
                pendingFileCallback = null;
            }
            return;
        }

        if (requestCode == REQ_UNKNOWN_SOURCES) {
            if (pendingApkInstallReady && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && getPackageManager().canRequestPackageInstalls()) {
                triggerApkInstallIntent();
            } else {
                pendingApkInstallReady = false;
            }
            return;
        }

        if (requestCode == REQ_DEVICE_CREDENTIAL) {
            final boolean unlocked = (resultCode == RESULT_OK);
            runOnUiThread(() -> {
                if (webView != null) {
                    webView.evaluateJavascript(
                        "if(window.PFCC&&PFCC.onDeviceUnlockResult){PFCC.onDeviceUnlockResult(" + (unlocked ? "true" : "false") + ");}",
                        null
                    );
                }
            });
            return;
        }

        if (requestCode == REQ_CREATE_DOCUMENT) {
            byte[] payload = pendingSaveBytes;
            pendingSaveBytes = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || payload == null) {
                return;
            }
            Uri targetUri = data.getData();
            ioExecutor.execute(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(targetUri)) {
                    if (out != null) {
                        out.write(payload);
                        out.flush();
                    }
                    runOnUiThread(() ->
                        Toast.makeText(this, "File saved.", Toast.LENGTH_SHORT).show()
                    );
                } catch (Exception ex) {
                    runOnUiThread(() ->
                        Toast.makeText(this, "Failed to save file: " + ex.getMessage(), Toast.LENGTH_LONG).show()
                    );
                }
            });
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
            "(function(){return !!(window.PFCC && PFCC.handleBackPress && PFCC.handleBackPress());})();",
            value -> {
                if ("true".equals(value)) {
                    return;
                }
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    MainActivity.super.onBackPressed();
                }
            }
        );
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    protected void onDestroy() {
        ioExecutor.shutdown();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void saveFile(String filename, String content, String mimeType) {
            if (content == null) return;
            String cleanMime = (mimeType == null || mimeType.isEmpty())
                ? "text/plain"
                : mimeType.split(";")[0].trim();
            launchCreateDocument(filename, cleanMime, content.getBytes(StandardCharsets.UTF_8));
        }

        @JavascriptInterface
        public void saveBase64(String filename, String dataUri) {
            saveDataUri(filename, dataUri);
        }

        @JavascriptInterface
        public String getAppBuild() {
            return "2.0." + BuildConfig.APP_BUILD_NUMBER + " (#" + BuildConfig.APP_BUILD_NUMBER + ")";
        }

        @JavascriptInterface
        public boolean isSelfUpdateEnabled() {
            return BuildConfig.ENABLE_SELF_UPDATE;
        }

        @JavascriptInterface
        public void checkForUpdates(boolean userInitiated) {
            if (!BuildConfig.ENABLE_SELF_UPDATE) return;
            checkForGitHubUpdate(userInitiated);
        }

        @JavascriptInterface
        public void startApkUpdate(String downloadUrl) {
            if (!BuildConfig.ENABLE_SELF_UPDATE) return;
            downloadAndInstallApk(downloadUrl);
        }

        @JavascriptInterface
        public boolean isDeviceLockSupported() {
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            return km != null && km.isKeyguardSecure();
        }

        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void requestDeviceUnlock() {
            runOnUiThread(() -> {
                KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
                if (km == null || !km.isKeyguardSecure()) {
                    Toast.makeText(MainActivity.this, "No screen lock or biometrics configured on this device.", Toast.LENGTH_SHORT).show();
                    return;
                }
                Intent intent = km.createConfirmDeviceCredentialIntent(
                    "Unlock EXT",
                    "Verify your identity to access local financial records."
                );
                if (intent != null) {
                    startActivityForResult(intent, REQ_DEVICE_CREDENTIAL);
                }
            });
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String shortcut = sanitizeShortcutAction(intent);
        if (shortcut != null) {
            if (webView != null) {
                dispatchShortcutToWeb(shortcut);
            } else {
                pendingShortcutAction = shortcut;
            }
        }
    }
}
