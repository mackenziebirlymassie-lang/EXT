package org.pfcc.financeos;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

public class ApkFileProvider extends ContentProvider {

    public static final String APK_FILENAME = "PFCC-V2-latest.apk";

    public static File getUpdateApkFile(Context context) {
        File dir = new File(context.getCacheDir(), "updates");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return new File(dir, APK_FILENAME);
    }

    public static Uri getApkUri(Context context) {
        return new Uri.Builder()
            .scheme("content")
            .authority(context.getPackageName() + ".apkprovider")
            .appendPath(APK_FILENAME)
            .build();
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public String getType(Uri uri) {
        if (uri != null && ("/" + APK_FILENAME).equals(uri.getPath())) {
            return "application/vnd.android.package-archive";
        }
        return null;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        Context ctx = getContext();
        if (ctx == null || uri == null || !("/" + APK_FILENAME).equals(uri.getPath())) {
            return null;
        }
        File file = getUpdateApkFile(ctx);
        String[] cols = projection != null ? projection : new String[] {
            OpenableColumns.DISPLAY_NAME,
            OpenableColumns.SIZE
        };
        MatrixCursor cursor = new MatrixCursor(cols, 1);
        Object[] row = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) {
                row[i] = APK_FILENAME;
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
        if (ctx == null || uri == null || !("/" + APK_FILENAME).equals(uri.getPath())) {
            throw new SecurityException("Unauthorized APK provider URI");
        }
        if (mode != null && mode.contains("w")) {
            throw new SecurityException("Read-only APK provider");
        }
        File file = getUpdateApkFile(ctx);
        if (!file.exists()) {
            throw new FileNotFoundException("APK file not found: " + APK_FILENAME);
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
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
