#!/usr/bin/env python3
"""Check the release identity, HTTPS origins, wrapper integrity and manifest boundaries."""
import hashlib,json,re,xml.etree.ElementTree as ET
from pathlib import Path
A=Path(__file__).resolve().parents[1]
config=json.loads((A/'twa-manifest.json').read_text(encoding='utf-8'))
assert config['packageId']=='com.divzplit.app','Do not change an existing Play application ID.'
assert type(config['appVersionCode']) is int and config['appVersionCode']>0
assert re.fullmatch(r'\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?',config['appVersionName'])
assert config['host']=='divzplit.com' and config['startUrl']=='/app/?source=installed'
assert config['minSdkVersion']==24 and config['fallbackType']=='customtabs'
assert config['enableNotifications'] is True
assert hashlib.sha256((A/'gradle/wrapper/gradle-wrapper.jar').read_bytes()).hexdigest()=='2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046','Unexpected Gradle wrapper binary.'
props=(A/'gradle/wrapper/gradle-wrapper.properties').read_text()
assert 'gradle-8.11.1-bin.zip' in props
assert 'distributionSha256Sum=f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6' in props
build=(A/'app/build.gradle').read_text()
assert 'targetSdkVersion 36' in build and 'compileSdkVersion 36' in build
assert 'versionCode twaManifest.appVersionCode' in build and 'versionName twaManifest.appVersionName' in build
assert 'verifyUploadSigning' in build and 'checkReleaseBuilds true' in build
manifest=ET.parse(A/'app/src/main/AndroidManifest.xml').getroot();ns='{http://schemas.android.com/apk/res/android}'
app=manifest.find('application');assert app.get(ns+'usesCleartextTraffic')=='false'
permissions={item.get(ns+'name') for item in manifest.findall('uses-permission')}
assert permissions=={'android.permission.POST_NOTIFICATIONS'},permissions
links=manifest.findall('.//intent-filter/data');assert len(links)==1
assert links[0].get(ns+'scheme')=='https' and links[0].get(ns+'pathPrefix')=='/app/'
launcher=app.find("activity[@"+ns+"name='LauncherActivity']")
assert launcher is not None and launcher.get(ns+'theme')=='@style/Theme.DivZplit.Launcher'
metadata={item.get(ns+'name'):item for item in launcher.findall('meta-data')}
assert 'android.support.customtabs.trusted.SPLASH_IMAGE_DRAWABLE' not in metadata
assert 'android.support.customtabs.trusted.SPLASH_SCREEN_FADE_OUT_DURATION' not in metadata
assert config['splashScreenFadeOutDuration']==0
assert config['additionalTrustedOrigins']==[], 'Review and independently verify any additional origin.'
styles=ET.parse(A/'app/src/main/res/values-v31/styles.xml').getroot()
items={item.get('name'):item.text for item in styles.findall('./style/item')}
assert items['android:windowSplashScreenBackground']=='@color/backgroundColor'
assert items['android:windowSplashScreenAnimatedIcon']=='@drawable/ic_splash'
# The splash must keep the exact existing DZ path and avoid the launcher's small bitmap.
splash=ET.parse(A/'app/src/main/res/drawable/ic_splash_maskable.xml').getroot()
brand=ET.parse(A.parent/'assets/divzplit-logo.svg').getroot()
assert splash.tag=='vector'
assert splash.findall('.//path')[-1].get(ns+'pathData')==brand.find('{http://www.w3.org/2000/svg}path').get('d')
adaptive=ET.parse(A/'app/src/main/res/drawable-v31/ic_splash.xml').getroot()
assert any(item.get(ns+'drawable')=='@drawable/ic_splash_maskable' for item in adaptive.findall('.//item'))
assert not any((A/'app/src/main').rglob('*.so'))
print(f"PASS: {config['packageId']} {config['appVersionName']} ({config['appVersionCode']}), min 24 / target 36, Gradle wrapper verified, HTTPS TWA and notification delegation intact.")
