#!/usr/bin/env python3
"""Build a signed React Native candidate; never deploy or replace the existing wrapper."""
import hashlib,json,os,ssl,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
N=ROOT/'native';A=N/'android'
env=os.environ.copy()
required=['DIVZPLIT_UPLOAD_STORE_FILE','DIVZPLIT_UPLOAD_STORE_PASSWORD','DIVZPLIT_UPLOAD_KEY_ALIAS','DIVZPLIT_UPLOAD_KEY_PASSWORD','JAVA_HOME','ANDROID_HOME']
if any(not env.get(name) for name in required):sys.exit('Configure the existing JDK/SDK/upload signing environment. No new key will be generated.')
keytool=str(Path(env['JAVA_HOME'])/'bin/keytool');signer=str(Path(env['JAVA_HOME'])/'bin/jarsigner')
certificate=subprocess.check_output([keytool,'-exportcert','-rfc','-keystore',env['DIVZPLIT_UPLOAD_STORE_FILE'],'-storepass:env','DIVZPLIT_UPLOAD_STORE_PASSWORD','-alias',env['DIVZPLIT_UPLOAD_KEY_ALIAS']],env=env,stderr=subprocess.DEVNULL,text=True)
expected=(ROOT/'android/upload-certificate.pem').read_text()
if hashlib.sha256(ssl.PEM_cert_to_DER_cert(certificate)).digest()!=hashlib.sha256(ssl.PEM_cert_to_DER_cert(expected)).digest():sys.exit('Upload certificate mismatch: stopped without producing a different app identity.')
subprocess.run([str(A/'gradlew'),'--no-daemon','--console=plain',':app:lintRelease',':app:bundleRelease'],cwd=A,env=env,check=True)
config=json.loads((N/'native-config.json').read_text());out=A/'app/build/outputs/review';out.mkdir(parents=True,exist_ok=True)
bundle=A/'app/build/outputs/bundle/release/app-release.aab';target=out/('divzplit-'+config['versionName']+'.aab')
subprocess.run([signer,'-keystore',env['DIVZPLIT_UPLOAD_STORE_FILE'],'-storepass:env','DIVZPLIT_UPLOAD_STORE_PASSWORD','-keypass:env','DIVZPLIT_UPLOAD_KEY_PASSWORD','-sigalg','SHA256withRSA','-digestalg','SHA-256','-signedjar',str(target),str(bundle),env['DIVZPLIT_UPLOAD_KEY_ALIAS']],env=env,check=True)
subprocess.run([signer,'-verify',str(target)],env=env,check=True)
print('SIGNED NATIVE CANDIDATE:',target)
print('NOT PRODUCTION READY. Feature/animation/device gates in native/native-config.json remain mandatory.')
