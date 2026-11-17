#!/usr/bin/env python3
"""Exercise the pilot's actual Java URL policy and check build boundaries (no emulator)."""
import json,os,subprocess,tempfile,xml.etree.ElementTree as ET
from pathlib import Path
A=Path(__file__).resolve().parents[1]
P=A/'app/src/webview'
ns='{http://schemas.android.com/apk/res/android}'
config=json.loads((A/'webview-pilot.json').read_text())
twa=json.loads((A/'twa-manifest.json').read_text())
assert config['status']=='experimental-not-for-production' and config['productionBlockers']
assert config['appVersionCode']>twa['appVersionCode']
root=ET.parse(P/'AndroidManifest.xml').getroot()
assert {e.get(ns+'name') for e in root.findall('uses-permission')}=={'android.permission.INTERNET'}
app=root.find('application');assert app.get(ns+'usesCleartextTraffic')=='false'
assert app.get(ns+'allowBackup')=='false' and app.get(ns+'hardwareAccelerated')=='true'
activity=app.find('activity');assert activity.get(ns+'launchMode')=='singleTask'
assert activity.get(ns+'name')=='.WebViewActivity'
links=activity.findall('.//data');assert len(links)==2
assert all(e.get(ns+'scheme')=='https' and e.get(ns+'host')=='divzplit.com' for e in links)
assert {e.get(ns+'path') or e.get(ns+'pathPrefix') for e in links}=={'/','/app/'}
assert not app.findall('service')
provider=app.find('provider');assert provider is not None and provider.get(ns+'exported')=='false'
paths=ET.parse(P/'res/xml/webview_filepaths.xml').getroot();assert len(paths)==1 and paths[0].tag=='cache-path' and paths[0].get('path')=='receipt_camera/'
styles=ET.parse(P/'res/values-v31/styles.xml').getroot()
items={e.get('name'):e.text for e in styles.findall('./style/item')}
assert items['android:windowSplashScreenAnimatedIcon']=='@drawable/ic_splash'
assert items['android:windowSplashScreenBackground']=='@color/backgroundColor'
build=(A/'app/build.gradle').read_text()
assert "getOrElse('twa')" in build and "if (webViewPilot)" in build
assert "applicationId twaManifest.packageId" in build
activity_source=(P/'java/com/divzplit/app/WebViewActivity.java').read_text()
assert 'addJavascriptInterface' not in activity_source and 'handler.proceed' not in activity_source
assert 'handler.cancel()' in activity_source and 'MIXED_CONTENT_NEVER_ALLOW' in activity_source
assert 'setWebContentsDebuggingEnabled(false)' in activity_source
assert 'setAllowFileAccess(false)' in activity_source and 'setAllowContentAccess(false)' in activity_source
assert 'setAcceptThirdPartyCookies(web, false)' in activity_source
assert 'createWebMessageChannel()' in activity_source and 'Uri.parse(ORIGIN)' in activity_source
javahome=os.environ.get('JAVA_HOME')
javac=str(Path(javahome)/'bin/javac') if javahome else 'javac'
java=str(Path(javahome)/'bin/java') if javahome else 'java'
with tempfile.TemporaryDirectory(prefix='divzplit-webview-') as tmp:
 harness=Path(tmp)/'PolicyTest.java'
 harness.write_text('''import com.divzplit.app.WebViewPolicy;
public class PolicyTest {
 public static void main(String[] args) {
  String[] good={"https://divzplit.com/app/?source=installed", "https://divzplit.com/?code=fixture", "https://divzplit.com/app/#invite=fixture", "https://DIVZPLIT.COM:443/privacy/"};
  String[] bad={"http://divzplit.com/app/", "https://divzplit.com.evil.test/app/", "https://evil.test/?next=https://divzplit.com", "https://divzplit.com@evil.test/", "https://evil@divzplit.com/app/", "https://divzplit.com:444/app/", "https://divzplit.com\\\\@evil.test/", "file:///etc/passwd", "content://divzplit.com/app", "javascript:alert(1)", "intent://divzplit.com", "data:text/html,x", "https://%64ivzplit.com/", "not a URL"};
  for(String url:good)if(!WebViewPolicy.internal(url))throw new AssertionError(url);
  for(String url:bad)if(WebViewPolicy.internal(url))throw new AssertionError(url);
  String[] external={"https://accounts.google.com/o/oauth2/auth", "https://fixture.supabase.co/auth/v1/authorize", "https://wa.me/?text=x", "mailto:support@divzplit.com", "tel:+123"};
  for(String url:external)if(!WebViewPolicy.external(url))throw new AssertionError(url);
  for(String url:new String[]{"javascript:alert(1)","intent://evil", "file:///tmp/a", "content://evil/a", "http://evil.test/", "https://user@evil.test/"})if(WebViewPolicy.external(url))throw new AssertionError(url);
  if(WebViewPolicy.internal(null)||WebViewPolicy.external(null))throw new AssertionError("null");
 }
}''')
 subprocess.run([javac,'-d',tmp,str(P/'java/com/divzplit/app/WebViewPolicy.java'),str(harness)],check=True)
 subprocess.run([java,'-cp',tmp,'PolicyTest'],check=True)
print('PASS WebView real Java URL policy, HTTPS App Links, permissions, identity, opt-in build and bridge boundaries; physical device tests still required.')
