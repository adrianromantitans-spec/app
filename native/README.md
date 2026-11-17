# DivZplit Android — React Native migration candidate

This is an independent native Android UI candidate. It renders React Native views using Fabric/Hermes; it does not embed the website in a WebView. The existing website and `android/` TWA/WebView application remain unchanged.

**Not ready for production or replacement of the current Play release.** See the release gates in `native-config.json` and the migration matrix below. A successful build is not evidence of functional or visual parity.

## Reused architecture

The candidate uses the existing `cloud.js`, `model.js`, `home.js`, `settlement-plan.js`, translations and Supabase RPCs. No database migration, Firebase project, account system, or new backend is introduced. Metro resolves existing cache-version import suffixes to their canonical modules. Babel maps the existing legal URL's `import.meta.url` to its public HTTPS location.

Android provides the Keystore-backed encrypted session file, secure randomness and SHA-256 for PKCE, date chooser, document export, clipboard, notification permission and Firebase messaging. Google authentication opens the system browser with PKCE and returns through the existing verified HTTPS App Link. A browser screen during authentication is expected; app screens are native views. Never embed Google sign-in in a WebView.

The package remains `com.divzplit.app`. The migration candidate reserves version code 8; confirm the latest Play code before a future release. It uses the existing upload certificate and Play signing identity. It does not read WebView cookies: the first native launch requires sign-in and notification consent again. Existing server accounts and groups are reused.

## Current coverage and release gates

| Area | Implemented in candidate | Still required before replacement |
| --- | --- | --- |
| Authentication | Email sign-in, signup with existing consent, recovery code, Google PKCE callback | Physical Android Google callback, email link lifecycle, Apple entry and account switching |
| Groups | List/create/select, copy existing invitation link, consume invitation | Complete group settings/member/permission/destructive-action parity |
| Expenses | Add/edit/delete, currency minor units and splits; camera/photo picker, local OCR confirmation, private receipts; weekly/monthly/yearly recurrence and stop | Physical camera/OCR/upload validation, crop/manual rotation controls, full permission UX and regression against web workflows |
| Balances | Existing balance and settlement calculation, payment request/response | FX conversion, pending-request reservation presentation, advanced settlement parity |
| Collaboration | Basic tasks, votes, shopping checks, activity and inbox | Full editing/deletion, reminders, shopping checkout, history pagination/details and notification destination presentation |
| Account | Language, data export, deletion, logout | Full lifecycle and accessibility validation |
| Notifications | Existing Firebase project and backend, session-bound native delivery, opt-in/out | Real device foreground/background/killed-app, permission denial, token rotation and logout/account-switch checks |
| Startup/design | Existing launcher assets, purple/white native screens, native port of intro timeline | Side-by-side intro/design/typography parity on devices; native intro is not yet visually certified |
| Fluidity | Native scrolling and native-driver animation, no fixed 60 FPS interval | Real 60/120 Hz phones, reduced motion, large fonts, keyboard/insets, TalkBack |

### Receipts and recurring expenses

The native receipt bridge uses Android image capture and the document picker with temporary URI grants; no broad camera, gallery or storage permission is requested. Photos are normalized for EXIF orientation, rendered over white and re-encoded as JPEG (at most 1800 pixels on the long side / 1 MiB for upload), dropping metadata. A separate normalized copy is retained in private app cache for bundled ML Kit Latin-script OCR (`com.google.mlkit:text-recognition:16.0.1`). OCR runs locally and its text is not persisted or uploaded. Selected totals, dates and titles are applied only after confirmation; uncertain or different currencies do not change the amount. Receipt files still use the existing private Supabase bucket and short-lived signed URLs. Unmounted/replaced selections release the OCR copy; abandoned cache files older than 24 hours are removed when the module initializes. Device tests must verify capture cancellation, rotation, large/blurred photos, format support and upload retry behavior. Native crop/manual rotation controls remain pending.

Recurring charges reuse `extras.js` calendar anchors and deterministic IDs. Refresh materializes only charges editable by the current account, coalesces concurrent refreshes and saves through the existing versioned group API. Stopping a series preserves past charges. Deleting its source does not delete past occurrences. Receipt images are not duplicated into generated occurrences. No server cron or database change is introduced.

The web opening animation and every existing web file remain unchanged. The native animation port is separate and must pass visual comparison before release. Matching durations alone does not establish identical motion.

## Build and validation

Requires Node per `package.json`, JDK 17, Android SDK 36 / Build Tools 36.0.0, NDK 27.1.12297006 and access to Maven/Google repositories. Gradle 9.4.1 is pinned with its distribution checksum. Dependencies are locked in `package-lock.json`.

```sh
cd native
npm ci
npm test
npm run bundle:android
```

For a signed candidate set `JAVA_HOME`, `ANDROID_HOME` and the **existing** `DIVZPLIT_UPLOAD_STORE_FILE`, `DIVZPLIT_UPLOAD_STORE_PASSWORD`, `DIVZPLIT_UPLOAD_KEY_ALIAS`, `DIVZPLIT_UPLOAD_KEY_PASSWORD` environment variables. Do not commit their values or generate another upload key.

```sh
python3 native/scripts/build-android.py  # from repository root
```

The script checks the certificate against `android/upload-certificate.pem`, runs release lint and the bundle build, signs/verifies the review artifact, and never deploys it. Output: `native/android/app/build/outputs/review/`. Do not upload the candidate to the existing tester channel until release gates are complete.

Use the release bundle for offline launch testing. Metro is a development server, not part of the released app. This candidate does not yet include a debug network-security exception for a Metro connection.

Run the existing root `npm run check` and `npm test` as regression checks. Native tests exercise the existing expense model through the new controller, save failures/retries/concurrency, permissions, callback origins, persistence and PKCE SHA-256 using a simulated native bridge. They do not replace device tests of Android Keystore, App Links, Firebase delivery or rendered UI.

## Future Play rollout

1. Complete the matrix above and compare existing functionality using real accounts on a controlled test backend.
2. Confirm `assetlinks.json` still authorizes `com.divzplit.app` with the **Play app signing certificate**, not merely the upload key. No new signing fingerprint is required solely for React Native.
3. Verify an upgrade over the current Play-installed version on a physical Android phone; expect native sign-in again, but no loss of server data.
4. Build with a version code higher than every existing Play release and the existing upload key. Publish first to an appropriate restricted test channel.
5. Validate startup, offline/error cases, back button, links, payments, receipts, notifications, accessibility and 60/120 Hz devices before expanding rollout.

Merging this source does not change the published Android app. The existing website hosting does not build this independent native project.
