package com.divzplit.app;
import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabsClient;
import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.PermissionAwareActivity;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
public final class DivZplitModule extends ReactContextBaseJavaModule {
 private final ReactApplicationContext context;
 private final EncryptedState state;
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 private Promise savePromise;private byte[] pendingExport;
 private AuthCaptchaDialog authChallenge;
 DivZplitModule(ReactApplicationContext context){
  super(context);this.context=context;state=new EncryptedState(context);NativePush.channel(context);
  context.addActivityEventListener(new BaseActivityEventListener(){@Override public void onActivityResult(Activity activity,int request,int result,Intent data){
   if(request!=61||savePromise==null)return;
   Promise reply=savePromise;byte[] bytes=pendingExport;savePromise=null;pendingExport=null;
   if(result!=Activity.RESULT_OK||data==null||data.getData()==null){reply.resolve(false);return;}
   Uri uri=data.getData();io.execute(()->{try(OutputStream out=context.getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IllegalStateException();out.write(bytes);reply.resolve(true);}catch(Exception error){reply.reject("EXPORT","Could not save export");}});
  }});
 }
 @Override public String getName(){return "DivZplit";}
 @ReactMethod public void initial(Promise reply){io.execute(()->{try{
  String stored=state.read();NativePush.prefs(context).edit().putBoolean("nativeSessionReady",false).apply();WritableMap result=Arguments.createMap();result.putString("storage",stored);result.putString("locale",Locale.getDefault().toLanguageTag());
  // WebView and native session stores differ: require consent again on the first RN launch.
  if(!NativePush.prefs(context).getBoolean("reactNativeInitialized",false)){
   NativePush.prefs(context).edit().remove("user").putBoolean("enabled",false).putBoolean("reactNativeInitialized",true).apply();
   ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).cancelAll();
  }
  reply.resolve(result);
 }catch(Exception error){reply.reject("STORAGE","Could not open saved session");}});}
 @ReactMethod public void persist(String json,Promise reply){io.execute(()->{try{new JSONObject(json);state.write(json);reply.resolve(true);}catch(Exception error){reply.reject("STORAGE","Could not save session");}});}
 @ReactMethod(isBlockingSynchronousMethod=true) public String randomBase64(int size){if(size<1||size>65536)throw new IllegalArgumentException();byte[] bytes=new byte[size];new SecureRandom().nextBytes(bytes);return Base64.encodeToString(bytes,Base64.NO_WRAP);}
 @ReactMethod public void sha256(String encoded,Promise reply){try{reply.resolve(Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(Base64.decode(encoded,Base64.NO_WRAP)),Base64.NO_WRAP));}catch(Exception error){reply.reject("CRYPTO","Could not create secure sign-in");}}
 @ReactMethod public void authCaptcha(String language,Promise reply){
  Activity activity=context.getCurrentActivity();if(activity==null){reply.reject("CAPTCHA_FAILED","Open DivZplit first");return;}
  activity.runOnUiThread(()->{if(authChallenge!=null){reply.reject("CAPTCHA_FAILED","Verification already open");return;}try{authChallenge=new AuthCaptchaDialog(activity,language,reply,()->authChallenge=null);}catch(Exception error){authChallenge=null;reply.reject("CAPTCHA_FAILED","Could not open verification");}});
 }
 @ReactMethod public void external(String url,Promise reply){
  Uri uri=Uri.parse(url);if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null){reply.reject("URL","Invalid secure URL");return;}
  Activity activity=context.getCurrentActivity();if(activity==null){reply.reject("ACTIVITY","Open DivZplit first");return;}
  activity.runOnUiThread(()->{try{new CustomTabsIntent.Builder().build().launchUrl(activity,uri);reply.resolve(true);}catch(Exception error){reply.reject("BROWSER","No secure browser available");}});
 }
 @ReactMethod public void googleBroker(String url,Promise reply){
  Uri uri=Uri.parse(url);if(!"https".equals(uri.getScheme())||!"divzplit.com".equals(uri.getHost())||uri.getUserInfo()!=null||!"/google-login/".equals(uri.getPath())){reply.reject("URL","Invalid secure URL");return;}
  Activity activity=context.getCurrentActivity();if(activity==null){reply.reject("ACTIVITY","Open DivZplit first");return;}
  activity.runOnUiThread(()->{try{String browser=CustomTabsClient.getPackageName(context,null);if(browser==null||browser.equals(context.getPackageName()))throw new IllegalStateException();CustomTabsIntent tab=new CustomTabsIntent.Builder().build();tab.intent.setPackage(browser);tab.launchUrl(activity,uri);reply.resolve(true);}catch(Exception error){reply.reject("BROWSER","No secure browser available");}});
 }
 @ReactMethod public void shareWhatsApp(String message,Promise reply){
  if(message==null||message.trim().isEmpty()||message.length()>4000){reply.reject("SHARE","Invalid invitation message");return;}
  Activity activity=context.getCurrentActivity();if(activity==null){reply.reject("ACTIVITY","Open DivZplit first");return;}
  activity.runOnUiThread(()->{try{
   // User-triggered compose only: never select a recipient or send automatically.
   Intent send=new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,message);
   try{activity.startActivity(send.setPackage("com.whatsapp"));reply.resolve("whatsapp");return;}
   catch(android.content.ActivityNotFoundException missing){
    try{activity.startActivity(send.setPackage("com.whatsapp.w4b"));reply.resolve("whatsapp-business");return;}
    catch(android.content.ActivityNotFoundException missingBusiness){/* Keep the existing secure-browser fallback. */}
   }
   new CustomTabsIntent.Builder().build().launchUrl(activity,Uri.parse("https://wa.me/?text="+Uri.encode(message)));reply.resolve("browser");
  }catch(Exception error){reply.reject("SHARE","Could not open WhatsApp. Copy the invitation link instead.");}});
 }
 @ReactMethod public void shareInvitation(String channel,String message,Promise reply){
  if(message==null||message.trim().isEmpty()||message.length()>4000||!("telegram".equals(channel)||"instagram".equals(channel)||"snapchat".equals(channel))){reply.reject("SHARE","Invalid invitation message");return;}
  Activity activity=context.getCurrentActivity();if(activity==null){reply.reject("ACTIVITY","Open DivZplit first");return;}
  activity.runOnUiThread(()->{try{
   Intent send=new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,message);
   String[] packages="telegram".equals(channel)?new String[]{"org.telegram.messenger","org.thunderdog.challegram"}:new String[]{"instagram".equals(channel)?"com.instagram.android":"com.snapchat.android"};
   boolean manualPaste=!"telegram".equals(channel);
   if(manualPaste)((ClipboardManager)context.getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("DivZplit",message));
   for(String target:packages){try{activity.startActivity(new Intent(send).setPackage(target));reply.resolve(manualPaste?"clipboard-app":"app");return;}catch(android.content.ActivityNotFoundException missing){/* Unsupported text target: use Android's chooser. */}}
   ((ClipboardManager)context.getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("DivZplit",message));
   activity.startActivity(Intent.createChooser(send,null));reply.resolve("chooser");
  }catch(Exception error){reply.reject("SHARE","No se ha podido compartir. Copia el enlace de invitación.");}});
 }
 @ReactMethod public void pickChoice(String title,ReadableArray values,ReadableArray labels,int selected,Promise reply){
  Activity activity=context.getCurrentActivity();if(activity==null){reply.resolve(null);return;}
  try{if(values.size()<1||values.size()>200||values.size()!=labels.size())throw new IllegalArgumentException();String[] items=new String[labels.size()],ids=new String[values.size()];for(int i=0;i<items.length;i++){items[i]=labels.getString(i);ids[i]=values.getString(i);if(items[i]==null||items[i].length()>200||ids[i]==null||ids[i].length()>160)throw new IllegalArgumentException();}
   activity.runOnUiThread(()->{try{AlertDialog dialog=new AlertDialog.Builder(activity).setTitle(title).setSingleChoiceItems(items,Math.max(0,Math.min(selected,items.length-1)),(view,index)->{reply.resolve(ids[index]);view.dismiss();}).create();dialog.setOnCancelListener(view->reply.resolve(null));dialog.show();}catch(Exception error){reply.reject("CHOICE","No se ha podido abrir el selector.");}});
  }catch(Exception error){reply.reject("CHOICE","Revisa las opciones del selector.");}
 }
 @ReactMethod public void pickDate(String iso,Promise reply){Activity activity=context.getCurrentActivity();if(activity==null){reply.resolve(null);return;}activity.runOnUiThread(()->{try{
  String[] parts=iso.split("-");DatePickerDialog dialog=new DatePickerDialog(activity,(picker,y,m,d)->reply.resolve(String.format(Locale.ROOT,"%04d-%02d-%02d",y,m+1,d)),Integer.parseInt(parts[0]),Integer.parseInt(parts[1])-1,Integer.parseInt(parts[2]));dialog.setOnCancelListener(v->reply.resolve(null));dialog.show();
 }catch(Exception error){reply.reject("DATE","Invalid date");}});}
 @ReactMethod public void pickTime(String value,Promise reply){
  Activity activity=context.getCurrentActivity();if(activity==null){reply.resolve(null);return;}
  activity.runOnUiThread(()->{try{
   if(!value.matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]"))throw new IllegalArgumentException();
   String[] parts=value.split(":");TimePickerDialog dialog=new TimePickerDialog(activity,(picker,h,m)->reply.resolve(String.format(Locale.ROOT,"%02d:%02d",h,m)),Integer.parseInt(parts[0]),Integer.parseInt(parts[1]),android.text.format.DateFormat.is24HourFormat(activity));
   dialog.setOnCancelListener(v->reply.resolve(null));dialog.show();
  }catch(Exception error){reply.reject("TIME","Invalid time");}});
 }
 @ReactMethod public void copy(String text,Promise reply){if(text.length()>65536){reply.reject("COPY","Text too long");return;}((ClipboardManager)context.getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("DivZplit",text));reply.resolve(true);}
 @ReactMethod public void exportJSON(String json,String name,Promise reply){
  if(savePromise!=null||json.length()>20*1024*1024){reply.reject("EXPORT","Export unavailable");return;}
  Activity activity=context.getCurrentActivity();if(activity==null){reply.reject("ACTIVITY","Open DivZplit first");return;}
  try{new JSONObject(json);}catch(Exception error){reply.reject("EXPORT","Invalid JSON");return;}
  savePromise=reply;pendingExport=json.getBytes(StandardCharsets.UTF_8);
  String filename=name.matches("[A-Za-z0-9_.-]{1,80}\\.json")?name:"divzplit-cuenta.json";
  activity.runOnUiThread(()->{try{activity.startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,filename),61);}catch(Exception error){savePromise=null;pendingExport=null;reply.reject("EXPORT","No file picker available");}});
 }
 private String permission(){
  if(Build.VERSION.SDK_INT>=33&&context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return NativePush.prefs(context).getBoolean("asked",false)?"denied":"default";
  NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
  if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=manager.getNotificationChannel(NativePush.CHANNEL);if(channel!=null&&channel.getImportance()==NotificationManager.IMPORTANCE_NONE)return "denied";}
  return manager.areNotificationsEnabled()?"granted":"denied";
 }
 @ReactMethod public void pushState(Promise reply){WritableMap result=Arguments.createMap();result.putString("permission",permission());result.putString("userId",NativePush.prefs(context).getString("user",""));result.putString("token",NativePush.prefs(context).getString("token",""));result.putBoolean("enabled",NativePush.prefs(context).getBoolean("enabled",false));reply.resolve(result);}
 @ReactMethod public void pushPermission(Promise reply){Activity activity=context.getCurrentActivity();if(activity==null){reply.resolve("denied");return;}
  if(Build.VERSION.SDK_INT>=33&&"default".equals(permission())){NativePush.prefs(context).edit().putBoolean("asked",true).apply();activity.runOnUiThread(()->((PermissionAwareActivity)activity).requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},42,(r,p,g)->{reply.resolve(permission());return true;}));}
  else reply.resolve(permission());
 }
 @ReactMethod public void pushToken(Promise reply){if(!"granted".equals(permission())){reply.reject("PERMISSION","Notification permission required");return;}FirebaseMessaging.getInstance().setAutoInitEnabled(true);FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task->{if(task.isSuccessful()){NativePush.prefs(context).edit().putString("token",task.getResult()).apply();reply.resolve(task.getResult());}else reply.reject("FCM","Could not register this device");});}
 @ReactMethod public void pushBind(String user,Promise reply){if(!DivZplitMessagingService.uuid(user)||!"granted".equals(permission())){reply.reject("PUSH","Invalid account");return;}NativePush.prefs(context).edit().putString("user",user).putBoolean("enabled",true).putBoolean("nativeSessionReady",true).apply();reply.resolve(true);}
 @ReactMethod public void pushClear(Promise reply){NativePush.prefs(context).edit().remove("user").putBoolean("enabled",false).putBoolean("nativeSessionReady",false).apply();((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).cancelAll();FirebaseMessaging.getInstance().setAutoInitEnabled(false);FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener(task->{NativePush.prefs(context).edit().remove("token").apply();reply.resolve(true);});}
 @ReactMethod public void notificationSettings(Promise reply){Intent intent=Build.VERSION.SDK_INT>=26?new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,context.getPackageName()):new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+context.getPackageName()));intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);context.startActivity(intent);reply.resolve(true);}
 @Override public void invalidate(){if(authChallenge!=null)new android.os.Handler(android.os.Looper.getMainLooper()).post(()->{if(authChallenge!=null)authChallenge.cancel();});if(savePromise!=null)savePromise.reject("CLOSED","Export interrupted");savePromise=null;pendingExport=null;io.shutdown();super.invalidate();}
}
