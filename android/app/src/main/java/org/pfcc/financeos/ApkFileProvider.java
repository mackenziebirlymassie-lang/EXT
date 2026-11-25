package org.pfcc.financeos;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

public class ApkFileProvider extends ContentProvider {

    public static final String APK_FILENAME = "EXT-latest.apk";
    public static final String SHARE_PREFIX = "shares/";

    public static File getUpdateApkFile(Context context) {
        File dir = new File(context.getCacheDir(), "updates");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return new File(dir, APK_FILENAME);
    }

    public static File getShareFile(Context context, String filename) {
        String safeName = (filename == null ? "export" : filename).replaceAll("[^a-zA-Z0-9._-]", "_");
        if (safeName.isEmpty() || safeName.startsWith(".")) safeName = "export_" + safeName;
        File dir = new File(context.getCacheDir(), "shares");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return new File(dir, safeName);
    }

    public static Uri getApkUri(Context context) {
        return new Uri.Builder()
            .scheme("content")
            .authority(context.getPackageName() + ".apkprovider")
            .appendPath(APK_FILENAME)
            .build();
    }

    public static Uri getShareUri(Context context, String filename) {
        String safeName = getShareFile(context, filename).getName();
        return new Uri.Builder()
            .scheme("content")
            .authority(context.getPackageName() + ".apkprovider")
            .appendPath("shares")
            .appendPath(safeName)
            .build();
    }

    private File resolveAllowedFile(Context ctx, Uri uri) {
        if (ctx == null || uri == null || uri.getPath() == null) return null;
        String path = uri.getPath();
        if (("/" + APK_FILENAME).equals(path)) {
            return getUpdateApkFile(ctx);
        }
        if (path.startsWith("/" + SHARE_PREFIX)) {
            String rel = path.substring(1 + SHARE_PREFIX.length());
            if (!rel.isEmpty() && !rel.contains("/") && !rel.contains("..")) {
                return getShareFile(ctx, rel);
            }
        }
        return null;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public String getType(Uri uri) {
        if (uri != null && uri.getPath() != null) {
            String p = uri.getPath();
            if (("/" + APK_FILENAME).equals(p)) return "application/vnd.android.package-archive";
            if (p.startsWith("/" + SHARE_PREFIX)) {
                if (p.endsWith(".png")) return "image/png";
                if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
                if (p.endsWith(".csv")) return "text/csv";
                if (p.endsWith(".json")) return "application/json";
                return "application/octet-stream";
            }
        }
        return null;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        Context ctx = getContext();
        File file = resolveAllowedFile(ctx, uri);
        if (file == null) {
            return null;
        }
        String[] cols = projection != null ? projection : new String[] {
            OpenableColumns.DISPLAY_NAME,
            OpenableColumns.SIZE
        };
        MatrixCursor cursor = new MatrixCursor(cols, 1);
        Object[] row = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) {
                row[i] = file.getName();
            } else if (OpenableColumns.SIZE.equals(cols[i])) {
                row[i] = file.exists() ? file.length() : 0L;
            }
        }
        cursor.addRow(row);
        return cursor;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        Context ctx = getContext();
        File file = resolveAllowedFile(ctx, uri);
        if (file == null) {
            throw new SecurityException("Unauthorized APK provider URI");
        }
        if (mode != null && mode.contains("w")) {
            throw new SecurityException("Read-only APK provider");
        }
        if (!file.exists()) {
            throw new FileNotFoundException("File not found: " + file.getName());
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public AssetFileDescriptor openAssetFile(Uri uri, String mode) throws FileNotFoundException {
        ParcelFileDescriptor pfd = openFile(uri, mode);
        Context ctx = getContext();
        File file = resolveAllowedFile(ctx, uri);
        long len = file != null ? file.length() : AssetFileDescriptor.UNKNOWN_LENGTH;
        return new AssetFileDescriptor(pfd, 0, len);
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read-only provider");
    }
}
