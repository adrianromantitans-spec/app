package com.divzplit.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.facebook.react.bridge.Promise;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.security.SecureRandom;

/** CAPTCHA only: credentials never enter this view. No JavaScript interfaces. */
final class AuthCaptchaDialog {
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Promise reply;private final Runnable closed;private final WebView web;
 private final AlertDialog dialog;private final String nonce;private final long deadline;
 private boolean finished=false;
 AuthCaptchaDialog(Activity activity,String language,Promise promise,Runnable onClosed){
  reply=promise;closed=onClosed;byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);
  nonce=Base64.encodeToString(bytes,Base64.NO_WRAP|Base64.NO_PADDING|Base64.URL_SAFE);deadline=SystemClock.elapsedRealtime()+150000;
  String lang="es".equals(language)?"es":"ro".equals(language)?"ro":"en";
  web=new WebView(activity);web.setBackgroundColor(Color.rgb(252,250,255));web.setMinimumHeight((int)(300*activity.getResources().getDisplayMetrics().density));
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setGeolocationEnabled(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportMultipleWindows(false);settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
  dialog=new AlertDialog.Builder(activity).setView(web).setNegativeButton("es".equals(lang)?"Cancelar":"ro".equals(lang)?"Anulează":"Cancel",(d,w)->finish(null,"CAPTCHA_CANCELLED")).create();
  dialog.setOnDismissListener(d->finish(null,"CAPTCHA_CANCELLED"));
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return request.isForMainFrame()&&!trusted(request.getUrl());}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())finish(null,"CAPTCHA_FAILED");}
   @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){if(request.isForMainFrame()&&response.getStatusCode()>=400)finish(null,"CAPTCHA_FAILED");}
  });
  dialog.show();web.loadUrl("https://divzplit.com/auth-challenge/#nonce="+nonce+"&lang="+lang);handler.postDelayed(poll,300);
 }
 private static boolean trusted(Uri uri){return uri!=null&&"https".equals(uri.getScheme())&&"divzplit.com".equals(uri.getHost())&&uri.getPort()==-1&&uri.getUserInfo()==null&&"/auth-challenge/".equals(uri.getPath())&&uri.getQuery()==null;}
 private final Runnable poll=new Runnable(){public void run(){
  if(finished)return;if(SystemClock.elapsedRealtime()>deadline){finish(null,"CAPTCHA_FAILED");return;}
  String current=web.getUrl();if(current==null){handler.postDelayed(this,300);return;}
  if(!trusted(Uri.parse(current))){finish(null,"CAPTCHA_FAILED");return;}
  // evaluateJavascript runs only in the trusted main frame. Subframes receive
  // no native interface and cannot submit arbitrary navigation/credential data.
  web.evaluateJavascript("JSON.stringify(window.divzplitCaptcha || null)",value->{
   if(finished)return;
   try{
    Object decoded=new JSONTokener(value).nextValue();
    if(decoded instanceof String&&!"null".equals(decoded)){JSONObject data=new JSONObject((String)decoded);
     if(!nonce.equals(data.optString("nonce")))throw new IllegalStateException();
     String status=data.optString("status");
     if("failed".equals(status)){finish(null,"CAPTCHA_FAILED");return;}
     if("ready".equals(status)){String token=data.optString("token");if(token.isEmpty()||token.length()>2048)throw new IllegalStateException();finish(token,null);return;}
    }
   }catch(Exception error){finish(null,"CAPTCHA_FAILED");return;}
   handler.postDelayed(poll,300);
  });
 }};
 private void finish(String token,String code){if(finished)return;finished=true;handler.removeCallbacksAndMessages(null);dialog.dismiss();web.stopLoading();web.destroy();closed.run();if(token!=null)reply.resolve(token);else reply.reject(code,"Security verification did not complete");}
 void cancel(){finish(null,"CAPTCHA_CANCELLED");}
}
