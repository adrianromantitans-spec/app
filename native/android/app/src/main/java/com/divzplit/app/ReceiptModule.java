package com.divzplit.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.facebook.react.bridge.*;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.io.*;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** User-selected receipts only. Original photos and OCR text never enter public storage. */
public final class ReceiptModule extends ReactContextBaseJavaModule {
 private static final int PICK=621,CAMERA=622,MAX_SOURCE=20*1024*1024,MAX_UPLOAD=1024*1024;
 private final ReactApplicationContext context;
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 private final File directory;
 private Promise pending;
 private File cameraFile;

 ReceiptModule(ReactApplicationContext context){
  super(context);this.context=context;directory=new File(context.getCacheDir(),"native-receipts");
  io.execute(()->{directory.mkdirs();File[] files=directory.listFiles();if(files!=null)for(File f:files)if(f.lastModified()<System.currentTimeMillis()-86400000L)f.delete();});
  context.addActivityEventListener(new BaseActivityEventListener(){
   @Override public void onActivityResult(Activity activity,int request,int result,Intent data){
    if((request!=PICK&&request!=CAMERA)||pending==null)return;
    Promise reply=pending;pending=null;File capture=cameraFile;cameraFile=null;
    if(result!=Activity.RESULT_OK){if(capture!=null)capture.delete();reply.resolve(null);return;}
    Uri uri=request==CAMERA&&capture!=null?Uri.fromFile(capture):data==null?null:data.getData();
    if(uri==null){reply.reject("PHOTO","No photo selected");return;}
    io.execute(()->{try{reply.resolve(prepare(uri));}catch(Exception|OutOfMemoryError error){reply.reject("PHOTO","No se ha podido leer la foto. Elige una imagen de hasta 20 MB.");}finally{if(capture!=null)capture.delete();}});
   }
  });
 }
 @Override public String getName(){return "DivZplitReceipts";}

 @ReactMethod public void choose(String source,Promise reply){
  Activity activity=context.getCurrentActivity();if(activity==null){reply.reject("ACTIVITY","Open DivZplit first");return;}
  activity.runOnUiThread(()->{
   if(pending!=null){reply.reject("BUSY","Finish choosing the current photo first");return;}
   if(!"camera".equals(source)&&!"library".equals(source)){reply.reject("PHOTO","Invalid photo source");return;}
   pending=reply;
   try{
    if("camera".equals(source)){
     directory.mkdirs();cameraFile=File.createTempFile("capture-",".jpg",directory);
     Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".native.receipts",cameraFile);
     Intent intent=new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT,uri)
       ;
     intent.setClipData(ClipData.newRawUri("DivZplit receipt",uri));
     intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
     activity.startActivityForResult(intent,CAMERA);
    }else activity.startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),PICK);
   }catch(Exception error){pending=null;if(cameraFile!=null)cameraFile.delete();cameraFile=null;reply.reject("PHOTO","No se ha podido abrir la cámara o el selector de fotos.");}
  });
 }

 private byte[] source(Uri uri) throws Exception {
  try(InputStream in=context.getContentResolver().openInputStream(uri);ByteArrayOutputStream out=new ByteArrayOutputStream()){
   if(in==null)throw new IOException();byte[] buffer=new byte[16384];int read,total=0;
   while((read=in.read(buffer))!=-1){total+=read;if(total>MAX_SOURCE)throw new IOException("Photo too large");out.write(buffer,0,read);}
   return out.toByteArray();
  }
 }
 private WritableMap prepare(Uri uri) throws Exception {
  byte[] source=source(uri);BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
  BitmapFactory.decodeByteArray(source,0,source.length,bounds);
  if(bounds.outWidth<1||bounds.outHeight<1||(long)bounds.outWidth*bounds.outHeight>80000000L)throw new IOException("Invalid dimensions");
  if(!java.util.Arrays.asList("image/jpeg","image/png","image/webp","image/heif","image/heic").contains(bounds.outMimeType))throw new IOException("Unsupported photo format");
  BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=1;
  while(Math.max(bounds.outWidth,bounds.outHeight)/options.inSampleSize>3200)options.inSampleSize*=2;
  Bitmap decoded=BitmapFactory.decodeByteArray(source,0,source.length,options);if(decoded==null)throw new IOException();
  Bitmap oriented=decoded,ocr=null,upload=null;
  String id=UUID.randomUUID().toString();File scratch=new File(directory,id+".jpg");
  try{
   int orientation=ExifInterface.ORIENTATION_NORMAL;
   try{orientation=new ExifInterface(new ByteArrayInputStream(source)).getAttributeInt(ExifInterface.TAG_ORIENTATION,ExifInterface.ORIENTATION_NORMAL);}catch(IOException unsupportedMetadata){/* Older Android versions cannot read every decodable format's EXIF. */}
   Matrix matrix=new Matrix();
   switch(orientation){
    case 2:matrix.setScale(-1,1);break;case 3:matrix.setRotate(180);break;case 4:matrix.setScale(1,-1);break;
    case 5:matrix.setRotate(90);matrix.postScale(-1,1);break;case 6:matrix.setRotate(90);break;
    case 7:matrix.setRotate(-90);matrix.postScale(-1,1);break;case 8:matrix.setRotate(-90);break;
    default:break;
   }
   oriented=Bitmap.createBitmap(decoded,0,0,decoded.getWidth(),decoded.getHeight(),matrix,true);
   ocr=whiteScaled(oriented,2400);directory.mkdirs();
   try(OutputStream out=new FileOutputStream(scratch)){if(!ocr.compress(Bitmap.CompressFormat.JPEG,92,out))throw new IOException();}
   upload=whiteScaled(oriented,1800);byte[] bytes=null;
   for(int quality=82;quality>=42;quality-=10){ByteArrayOutputStream out=new ByteArrayOutputStream();upload.compress(Bitmap.CompressFormat.JPEG,quality,out);bytes=out.toByteArray();if(bytes.length<=MAX_UPLOAD)break;}
   if(bytes==null||bytes.length>MAX_UPLOAD)throw new IOException("Crop receipt first");
   WritableMap result=Arguments.createMap();result.putString("id",id);result.putString("type","image/jpeg");result.putString("base64",Base64.encodeToString(bytes,Base64.NO_WRAP));result.putInt("size",bytes.length);result.putInt("width",upload.getWidth());result.putInt("height",upload.getHeight());return result;
  }catch(Exception|OutOfMemoryError error){scratch.delete();throw error;}
  finally{if(upload!=null)upload.recycle();if(ocr!=null)ocr.recycle();if(oriented!=decoded)oriented.recycle();decoded.recycle();}
 }
 private Bitmap whiteScaled(Bitmap source,int dimension){
  float ratio=Math.min(1f,(float)dimension/Math.max(source.getWidth(),source.getHeight()));
  int w=Math.max(1,Math.round(source.getWidth()*ratio)),h=Math.max(1,Math.round(source.getHeight()*ratio));
  Bitmap result=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(result);canvas.drawColor(Color.WHITE);
  android.graphics.Paint paint=new android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG);
  canvas.drawBitmap(source,null,new android.graphics.Rect(0,0,w,h),paint);return result;
 }
 private File receipt(String id){if(id==null||!id.matches("[a-f0-9-]{36}"))throw new IllegalArgumentException();return new File(directory,id+".jpg");}
 @ReactMethod public void read(String id,Promise reply){io.execute(()->{
  Bitmap bitmap;try{File file=receipt(id);bitmap=BitmapFactory.decodeFile(file.getPath());if(bitmap==null)throw new IOException();}catch(Exception|OutOfMemoryError error){reply.reject("OCR","Vuelve a elegir la foto del ticket.");return;}
  final Bitmap image=bitmap;com.google.mlkit.vision.text.TextRecognizer recognizer;
  try{recognizer=TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);}catch(Exception error){image.recycle();reply.reject("OCR","No se ha podido iniciar la lectura del ticket.");return;}
  try{recognizer.process(InputImage.fromBitmap(image,0))
   .addOnSuccessListener(result->{WritableMap output=Arguments.createMap();String text=result.getText();output.putString("text",text.substring(0,Math.min(50000,text.length())));reply.resolve(output);})
   .addOnFailureListener(error->reply.reject("OCR","No se ha podido leer el ticket. Puedes escribir el importe."))
   .addOnCompleteListener(task->{image.recycle();recognizer.close();});
  }catch(Exception error){image.recycle();recognizer.close();reply.reject("OCR","No se ha podido leer el ticket. Puedes escribir el importe.");}
 });}
 @ReactMethod public void release(String id,Promise reply){io.execute(()->{try{receipt(id).delete();reply.resolve(true);}catch(Exception error){reply.reject("PHOTO","Invalid receipt");}});}
 @Override public void invalidate(){if(pending!=null)pending.reject("CLOSED","Photo selection interrupted");pending=null;io.shutdown();super.invalidate();}
}
