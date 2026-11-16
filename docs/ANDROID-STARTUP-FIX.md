# DivZplit: Android launch and TWA verification fix

Investigated 16 November 2026. Native changes are based on the existing `review/google-play-preparation` project (commit `297c2815b1ff91a4995e0cb161529a429dcb1217`), which generated the installed 1.0.0 bundle. That Android project has not been merged into `main`; it is present in the repository's review branch. It is reused here, not regenerated. The website remains served from the current deployed domain.

## Browser bar: cause and fix

The Android application is **Bubblewrap / Trusted Web Activity**, using Android Browser Helper 2.7.4 with supported **Custom Tabs fallback**. It is not an embedded WebView. The checked-in web package is an existing JavaScript module application; this change does not introduce or assume a React/Vite rebuild.

- Package: `com.divzplit.app` (unchanged).
- Launcher: `https://divzplit.com/app/?source=installed` (unchanged); checked HTTP 200 with no redirect.
- App-side `assetStatements` authorizes the web origin `https://divzplit.com`.
- Intent filter: HTTPS, the same host, `/app/`, `autoVerify=true` (unchanged).
- Additional trusted origins: none. External Google/Supabase authentication pages are not falsely marked as owned origins; their browser UI may legitimately be visible while off-origin.
- Live `/.well-known/assetlinks.json`: HTTP 200, `application/json`, no redirect, but only fingerprint `90:65:22:5B:4D:37:F8:41:9D:EE:6E:A5:96:4F:81:EF:3D:80:D5:DF:D8:E4:FF:F6:4D:39:35:24:13:73:F0:72` at inspection time.
- **Play App Signing SHA-256 supplied by the owner:** `65:59:83:FB:B9:3A:E3:CC:0F:46:86:D7:2D:C8:05:FA:40:79:45:68:29:1E:47:84:7E:B9:22:B4:5E:A9:BC:64`.
- Upload SHA-256: `7A:B0:37:0C:C1:18:70:90:F6:4D:50:51:D8:89:2C:83:2C:9A:0E:17:2C:83:DD:1F:DF:A5:A3:0E:95:75:02:58`; this is not the Play distribution certificate.

The live site does not authorize the supplied Play signer. A correctly secured TWA therefore cannot establish that relationship from the current file and may display browser UI. The domain fix adds **the actual Play certificate** while preserving the previous fingerprint. It is isolated in a separate branch based on current `main`, so it can be reviewed/deployed without waiting for or merging the Android project.

**The server fix must actually be deployed.** A new AAB alone cannot fix the site-side certificate. Conversely, deploying the correct Asset Links can fix trust for the already-installed 1.0.0 version without another binary, subject to Chrome verification/cache and browser compatibility. No toolbar-hiding tricks, verification bypass or additional trusted third-party domains are used.

The certificate was supplied from Play Console by the owner; this environment cannot independently inspect the APK installed on the test phone. Obtain or reconfirm it in **Play Console → App integrity / Integridad de la app → App signing / Firma de aplicaciones → App signing key certificate / Certificado de firma de la aplicación → SHA-256**. Do not use the upload certificate. If Play later rotates distribution keys, preserve applicable old/new distribution fingerprints according to Play's certificate configuration.

### Deploy and check

Review and merge/deploy the dedicated Asset Links change using the site's existing approved GitHub Pages process. This task does not auto-merge or deploy. Once deployed:

```sh
python3 android/scripts/check-assetlinks.py --fingerprint "65:59:83:FB:B9:3A:E3:CC:0F:46:86:D7:2D:C8:05:FA:40:79:45:68:29:1E:47:84:7E:B9:22:B4:5E:A9:BC:64"
```

It verifies the exact relation, package and signer, HTTPS status 200, JSON MIME type and no redirects. Before deployment, use `--file /path/to/prepared/assetlinks.json`. Local PASS is not a statement that the live site or installed APK has changed.

Launch the version installed from the **normal Play closed-test track**. Internal App Sharing is a separate tool and can use a different certificate. Verification may be cached by the browser; after deployment allow propagation, update/reopen the app and check again. Do not clear browser storage or account data by default. `adb shell pm get-app-links com.divzplit.app` can diagnose Android link routing, but it does not independently prove Chrome TWA trust. On a test device, the actual APK signer can be inspected by pulling the APK and running SDK `apksigner verify --print-certs`; compare the certificate to Play's SHA-256 above.

## Startup: native system splash versus web animation

The original wrapper configured an optional image splash (`SPLASH_IMAGE_DRAWABLE`) plus a **300 ms native fade**, in addition to Android's own launch behavior and the web intro. The installed helper's actual bytecode was inspected: it only creates `PwaWrapperSplashScreenStrategy` when a splash drawable is configured.

Changes:

1. Remove only the optional Bubblewrap image-splash and fade metadata. Set the native wrapper fade setting to 0 so it cannot reintroduce that delay.
2. Apply a launcher-specific native theme; use the existing `backgroundColor` for its starting surface.
3. On API 31+, explicitly use that same background and the **existing application icon** for the Android system splash. No blank icon, system-splash suppression, hold timer, new splash activity or dependency is introduced.
4. Version becomes **1.0.1 / code 2**, required because code 1 has already been used in Play. Package, key, SDKs, URLs, permissions, orientation, notification delegation and authentication remain unchanged.

The Android 12+ system splash is platform-managed and can still briefly show the icon. This patch does not promise to remove mandatory Android UI, network loading time or every browser-owned transition. It removes the redundant optional wrapper image stage and matches launch colors. The custom web opening animation and all website transition timing are **byte-for-byte unchanged**. No website file, stylesheet, component, Supabase/authentication code or expense feature is modified.

## Updated AAB and Play Console

Build from the Android startup branch using the existing key:

```sh
python3 android/scripts/check-project.py
python3 android/scripts/test-assetlinks.py
python3 android/scripts/build-release.py --keystore "/private/path/divzplit-upload.jks"
```

The existing script securely prompts for passwords and checks the upload certificate. Output: `android/app/build/outputs/play/divzplit-1.0.1.aab`. The same upload key is used; no new key was generated. If a higher version code has since been uploaded, increase the code beyond the highest used value before rebuilding.

In Play Console, create the next release **in the existing closed-testing track**, upload this AAB, review the changes and distribute the test update. Do not create a new application or change the package or Play signing identity. Install/update through Play and verify the device has version code 2. Moving the build into production still requires your normal approval and Google's requirements; nothing is published automatically here.

## Validation and real-device checks

Automated checks: Android identity/SDK/origin configuration, launcher theme and API 31 system-splash resources, absence of the optional splash metadata, certificate-match checker regression tests, release build/lint, AAB signature/certificate, bundletool validation and compiled manifest. Existing web syntax/unit suites are run without production account actions. Tracked non-Android files were compared to the base to confirm no web-animation or application changes. See `android/startup-verification.json` for the artifact hash/results.

Still required on real Android:

- Confirm the installed APK has the Play distribution signer, including any relevant rotated-key cases.
- After server deployment/cache refresh, cold launch and warm launch from the launcher without a URL bar; verify internal navigation stays on the trusted origin.
- Android 12+ cold launch: required system icon → existing web animation → app, without the extra Bubblewrap image/fade stage. Verify there is no background-color flash or unexpected browser-owned splash.
- Check pre-Android-12 behavior on a compatible browser; Android 7 is the technical package minimum but current Chrome requires Android 10+.
- Google/email sign-in, return from external authentication, back navigation, group/expense flows and notifications on the Play-installed update. External origin browser controls are expected security UI, not something to suppress.

No real phone, emulator with the Play signing key, Play Console session or closed-test installation is available in this environment. Native build success and source invariance do not replace these checks. The live domain will still fail the new signer check until the separate server change is approved and deployed.
