package com.divzplit.app;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
final class NativePush {
 static final String CHANNEL="divzplit-groups";
 static SharedPreferences prefs(Context c){return c.getSharedPreferences("native-push",Context.MODE_PRIVATE);}
 static void channel(Context c){if(Build.VERSION.SDK_INT>=26)((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel(CHANNEL,"DivZplit",NotificationManager.IMPORTANCE_DEFAULT));}
}
