#!/usr/bin/env python3
"""Build a signed Play bundle without putting passwords in argv or project files."""
import argparse,getpass,hashlib,json,os,shutil,ssl,subprocess,sys
from pathlib import Path

ANDROID=Path(__file__).resolve().parents[1]

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--keystore',help='Existing private upload keystore (outside the repository).')
 parser.add_argument('--alias',help='Upload key alias (default: divzplit).')
 args=parser.parse_args()
 env=os.environ.copy()
 store=args.keystore or env.get('DIVZPLIT_UPLOAD_STORE_FILE') or input('Ruta del almacén de subida (.jks): ').strip()
 path=Path(store).expanduser().resolve()
 if not path.is_file():parser.error('No se encuentra el almacén. No se generará otra clave automáticamente.')
 env['DIVZPLIT_UPLOAD_STORE_FILE']=str(path)
 env['DIVZPLIT_UPLOAD_KEY_ALIAS']=args.alias or env.get('DIVZPLIT_UPLOAD_KEY_ALIAS') or 'divzplit'
 env['DIVZPLIT_UPLOAD_STORE_PASSWORD']=env.get('DIVZPLIT_UPLOAD_STORE_PASSWORD') or getpass.getpass('Contraseña del almacén: ')
 env['DIVZPLIT_UPLOAD_KEY_PASSWORD']=env.get('DIVZPLIT_UPLOAD_KEY_PASSWORD') or getpass.getpass('Contraseña de la clave (Enter si es la misma): ') or env['DIVZPLIT_UPLOAD_STORE_PASSWORD']
 java_home=env.get('JAVA_HOME')
 keytool=Path(java_home)/'bin'/('keytool.exe' if os.name=='nt' else 'keytool') if java_home else shutil.which('keytool')
 if not keytool:raise RuntimeError('Falta keytool: instala JDK 17 y configura JAVA_HOME.')
 expected=ANDROID/'upload-certificate.pem'
 if not expected.is_file():raise RuntimeError('Falta el certificado público esperado de la clave de subida.')
 certificate=subprocess.check_output([str(keytool),'-exportcert','-rfc','-keystore',str(path),'-storepass:env','DIVZPLIT_UPLOAD_STORE_PASSWORD','-alias',env['DIVZPLIT_UPLOAD_KEY_ALIAS']],env=env,text=True,stderr=subprocess.DEVNULL)
 if hashlib.sha256(ssl.PEM_cert_to_DER_cert(certificate)).digest()!=hashlib.sha256(ssl.PEM_cert_to_DER_cert(expected.read_text(encoding='utf-8'))).digest():
  raise RuntimeError('La clave no coincide con el certificado de subida preparado. No se generará un AAB con otra identidad.')
 wrapper=ANDROID/('gradlew.bat' if os.name=='nt' else 'gradlew')
 subprocess.run([sys.executable,str(ANDROID/'scripts/check-project.py')],check=True)
 subprocess.run([str(wrapper),'--no-daemon','--console=plain',':app:lintRelease',':app:bundleRelease'],cwd=ANDROID,env=env,check=True)
 bundle=ANDROID/'app/build/outputs/bundle/release/app-release.aab'
 if not bundle.is_file():raise RuntimeError('Gradle no ha generado el AAB esperado.')
 java_home=env.get('JAVA_HOME')
 verifier=Path(java_home)/'bin'/('jarsigner.exe' if os.name=='nt' else 'jarsigner') if java_home else shutil.which('jarsigner')
 if not verifier:raise RuntimeError('Falta jarsigner: instala un JDK 17 completo y configura JAVA_HOME.')
 release=json.loads((ANDROID/'twa-manifest.json').read_text(encoding='utf-8'))
 out=ANDROID/'app/build/outputs/play';out.mkdir(parents=True,exist_ok=True)
 target=out/f"divzplit-{release['appVersionName']}.aab"
 # Standard JDK packaging puts the JAR manifest first, avoiding JarInputStream
 # order warnings from the AGP ZIP layout. It uses the same verified upload key.
 subprocess.run([str(verifier),'-keystore',str(path),'-storepass:env','DIVZPLIT_UPLOAD_STORE_PASSWORD',
                 '-keypass:env','DIVZPLIT_UPLOAD_KEY_PASSWORD','-sigalg','SHA256withRSA','-digestalg','SHA-256',
                 '-signedjar',str(target),str(bundle),env['DIVZPLIT_UPLOAD_KEY_ALIAS']],check=True,env=env)
 subprocess.run([str(verifier),'-verify',str(target)],check=True,env=env)
 print('\nAAB firmado:',target)
 print('Comprueba en Play Console que el certificado de subida coincide. Nunca subas el .jks ni su contraseña.')

if __name__=='__main__':
 try:main()
 except (subprocess.CalledProcessError,RuntimeError,KeyboardInterrupt,EOFError) as error:
  print('No se ha completado la entrega firmada:',error,file=sys.stderr);sys.exit(1)
