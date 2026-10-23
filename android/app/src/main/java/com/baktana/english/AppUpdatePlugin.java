package com.baktana.english;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Updates the app from inside it (see src/lib/update.ts): reports the installed version,
 * reads the published version file, and downloads a new APK and opens Android's installer.
 * Network calls run here rather than in the WebView, so GitHub's missing CORS headers don't matter.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    @PluginMethod
    public void getInstalledVersion(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo info = pm.getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            JSObject result = new JSObject();
            result.put("versionCode", code);
            result.put("versionName", info.versionName);
            // False in the Google Play build, which Play updates (see app/build.gradle).
            result.put("inAppUpdates", BuildConfig.IN_APP_UPDATES);
            call.resolve(result);
        } catch (PackageManager.NameNotFoundException e) {
            call.reject("Package info unavailable", e);
        }
    }

    @PluginMethod
    public void fetchText(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("Missing url");
            return;
        }
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                conn = open(url);
                try (InputStream in = conn.getInputStream()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    copy(in, out, -1);
                    JSObject result = new JSObject();
                    result.put("text", out.toString(StandardCharsets.UTF_8.name()));
                    call.resolve(result);
                }
            } catch (IOException e) {
                call.reject("Fetch failed", e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        if (!BuildConfig.IN_APP_UPDATES) {
            call.unavailable("Updates come from Google Play in this build");
            return;
        }
        String url = call.getString("url");
        if (url == null) {
            call.reject("Missing url");
            return;
        }
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Cannot create " + dir);
                File apk = new File(dir, "BaktanaEnglish.apk");
                conn = open(url);
                long total = conn.getContentLengthLong();
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
                    copy(in, out, total);
                }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                // The first time, Android asks to allow installs from this app, then shows the installer.
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Update failed", e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    private static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.setUseCaches(false);
        conn.setInstanceFollowRedirects(true);
        int status = conn.getResponseCode();
        if (status < 200 || status >= 300) {
            conn.disconnect();
            throw new IOException("HTTP " + status);
        }
        return conn;
    }

    /** Copies the stream, sending "progress" events (0–100) when the total size is known. */
    private void copy(InputStream in, OutputStream out, long total) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        long done = 0;
        int lastPercent = -1;
        int n;
        while ((n = in.read(buffer)) != -1) {
            out.write(buffer, 0, n);
            done += n;
            if (total > 0) {
                int percent = (int) (done * 100 / total);
                if (percent != lastPercent) {
                    lastPercent = percent;
                    JSObject event = new JSObject();
                    event.put("percent", percent);
                    notifyListeners("progress", event);
                }
            }
        }
    }
}
