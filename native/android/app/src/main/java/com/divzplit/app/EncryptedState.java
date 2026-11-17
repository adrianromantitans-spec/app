package com.divzplit.app;
import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.nio.charset.StandardCharsets;
/** App-private, no-backup state. AES-GCM key stays in Android Keystore. */
final class EncryptedState {
 private static final String ALIAS="divzplit-react-native-state-v1";
 private final AtomicFile file;
 EncryptedState(Context context){file=new AtomicFile(new File(context.getNoBackupFilesDir(),"react-native-state.enc"));}
 private SecretKey key() throws Exception {
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
  if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
  KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
  generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
  return generator.generateKey();
 }
 synchronized String read() throws Exception {
  if(!file.getBaseFile().exists())return "{}";
  byte[] bytes=file.readFully();if(bytes.length<30||bytes[0]!=1)throw new IllegalStateException("Invalid state version");
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Arrays.copyOfRange(bytes,1,13)));
  return new String(cipher.doFinal(Arrays.copyOfRange(bytes,13,bytes.length)),StandardCharsets.UTF_8);
 }
 synchronized void write(String value) throws Exception {
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
  FileOutputStream out=file.startWrite();
  try {out.write(1);out.write(cipher.getIV());out.write(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)));file.finishWrite(out);}
  catch(Exception error){file.failWrite(out);throw error;}
 }
}
