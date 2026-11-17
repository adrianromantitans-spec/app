package com.divzplit.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import org.json.JSONException;

/** Stores only the local delivery binding, never Supabase tokens or server keys. */
final class NativePush {
    static final String CHANNEL = "divzplit-groups";
    private static final int PERMISSION = 42;
    private final Activity activity;
    private WebMessagePort pendingPort;
    private int pendingId;
    NativePush(Activity activity) { this.activity = activity; channel(activity); }
    static SharedPreferences prefs(Context context) { return context.getSharedPreferences("native-push", Context.MODE_PRIVATE); }
    static void channel(Context context) {
        if (Build.VERSION.SDK_INT >= 26) ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE))
                .createNotificationChannel(new NotificationChannel(CHANNEL, "DivZplit", NotificationManager.IMPORTANCE_DEFAULT));
    }
    private String permission() {
        if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            return prefs(activity).getBoolean("asked", false) ? "denied" : "default";
        NotificationManager manager = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return "denied";
        }
        return manager.areNotificationsEnabled() ? "granted" : "denied";
    }
    private JSONObject state() throws JSONException {
        SharedPreferences p = prefs(activity);
        return new JSONObject().put("permission", permission()).put("userId", p.getString("user", ""))
                .put("enabled", p.getBoolean("enabled", false)).put("token", p.getString("token", ""));
    }
    static void reply(WebMessagePort port, int id, Object value, boolean ok) {
        try { port.postMessage(new WebMessage(new JSONObject().put("id", id).put("ok", ok).put("value", value).toString())); }
        catch (JSONException | IllegalStateException ignored) { /* Page navigated or activity was closed. */ }
    }
    boolean handle(WebMessagePort port, JSONObject message) throws JSONException {
        String type = message.getString("type"); int id = message.getInt("id");
        if (!type.startsWith("push")) return false;
        switch (type) {
            case "pushState": reply(port, id, state(), true); break;
            case "pushPermission":
                if (Build.VERSION.SDK_INT >= 33 && "default".equals(permission())) {
                    if (pendingPort != null) { reply(port, id, null, false); break; }
                    pendingPort = port; pendingId = id;
                    prefs(activity).edit().putBoolean("asked", true).apply();
                    activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERMISSION);
                } else reply(port, id, permission(), true);
                break;
            case "pushToken":
                if (!"granted".equals(permission())) { reply(port, id, null, false); break; }
                FirebaseMessaging.getInstance().setAutoInitEnabled(true);
                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                    if (!task.isSuccessful()) { reply(port, id, null, false); return; }
                    prefs(activity).edit().putString("token", task.getResult()).apply();
                    reply(port, id, task.getResult(), true);
                }); break;
            case "pushBind":
                String user = message.getString("userId");
                if (!DivZplitMessagingService.uuid(user) || !"granted".equals(permission())) { reply(port, id, null, false); break; }
                prefs(activity).edit().putString("user", user).putBoolean("enabled", true).apply();
                reply(port, id, state(), true); break;
            case "pushClear":
                prefs(activity).edit().remove("user").putBoolean("enabled", false).apply();
                ((NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE)).cancelAll();
                FirebaseMessaging.getInstance().setAutoInitEnabled(false);
                FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener(task -> {
                    prefs(activity).edit().remove("token").apply();
                    reply(port, id, null, task.isSuccessful());
                }); break;
            default: reply(port, id, null, false);
        }
        return true;
    }
    void permissionResult(int request) {
        if (request != PERMISSION || pendingPort == null) return;
        reply(pendingPort, pendingId, permission(), true); pendingPort = null;
    }
    void close() { pendingPort = null; }
}
