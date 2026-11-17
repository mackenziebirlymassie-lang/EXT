package org.pfcc.financeos;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
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

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private static final String ENTRY_URL = "file:///android_asset/www/index.html";
    private static final int REQ_FILE_PICKER = 1001;
    private static final int REQ_CREATE_DOCUMENT = 1002;

    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileCallback;
    private byte[] pendingSaveBytes;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();

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
    }
}
