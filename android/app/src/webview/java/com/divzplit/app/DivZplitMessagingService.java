package com.divzplit.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public final class DivZplitMessagingService extends FirebaseMessagingService {
    static boolean uuid(String value) { return value != null && value.matches("(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"); }
    @Override public void onNewToken(String token) {
        // Re-register through authenticated JS when the app resumes; no session in native storage.
        NativePush.prefs(this).edit().putString("token", token).apply();
    }
    @Override public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData(); SharedPreferences p = NativePush.prefs(this);
        String user = data.get("userId"), notice = data.get("notificationId"), body = data.get("body");
        if (!uuid(user) || !uuid(notice) || !p.getBoolean("enabled", false) || !user.equals(p.getString("user", ""))
                || body == null || body.length() > 1024) return;
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (!manager.areNotificationsEnabled()) return;
        NativePush.channel(this);
        Uri uri = Uri.parse("https://divzplit.com/app/").buildUpon().appendQueryParameter("source", "installed")
                .appendQueryParameter("notification", notice).build();
        Intent intent = new Intent(this, WebViewActivity.class).setAction(Intent.ACTION_VIEW).setData(uri)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(this, notice.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            manager.notify(notice.hashCode(), new NotificationCompat.Builder(this, NativePush.CHANNEL)
                    .setSmallIcon(R.drawable.ic_notification_icon).setContentTitle("DivZplit").setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setContentIntent(tap).setAutoCancel(true).build());
        } catch (SecurityException ignored) { /* Permission can be revoked between the check and notify. */ }
    }
}
