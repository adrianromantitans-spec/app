# DivZplit Android — React Native migration candidate

This is an independent native Android UI candidate. It renders React Native views using Fabric/Hermes; it does not embed the website in a WebView. The existing website and `android/` TWA/WebView application remain unchanged.

**Not ready for production or replacement of the current Play release.** See the release gates in `native-config.json` and the migration matrix below. The previously listed implementation gaps have native flows; a successful build is not evidence of functional or visual parity on a device.

## Reused architecture

The candidate uses the existing `cloud.js`, `model.js`, `home.js`, `settlement-plan.js`, translations and Supabase RPCs. No database migration, Firebase project, account system, or new backend is introduced. Metro resolves existing cache-version import suffixes to their canonical modules. Babel maps the existing legal URL's `import.meta.url` to its public HTTPS location.

Android provides the Keystore-backed encrypted session file, secure randomness and SHA-256 for PKCE, date chooser, document export, clipboard, notification permission and Firebase messaging. Google authentication opens the system browser with PKCE and returns through the existing verified HTTPS App Link. A browser screen during authentication is expected; app screens are native views. Never embed Google sign-in in a WebView.

The package remains `com.divzplit.app`. The migration candidate reserves version code 10; confirm the latest Play code before a future release. It uses the existing upload certificate and Play signing identity. It does not read WebView cookies: the first native launch requires sign-in and notification consent again. Existing server accounts and groups are reused.

## Current coverage and release gates

| Area | Implemented in candidate | Still required before replacement |
| --- | --- | --- |
| Authentication | Email sign-in/signup, Google/Apple entry when enabled, email confirmation, PKCE recovery links, separate code verification/password confirmation/sign-out, account/session isolation | Real provider/link/session and upgrade tests |
| Groups | Stable-ID creation; name/icon/type/place/dates/currency/budget editing; member/owner view; invitation copy/join/revocation; versioned, typed-confirmation deletion | Real multi-account permissions and deletion/cleanup tests |
| Expenses | Add/edit/delete, personal/all filters, category inference, per-person shares and mode drafts; camera/gallery, crop/rotate, local OCR confirmation and private receipts; recurrence/stop | Real capture, crop gestures, OCR, uploads and concurrent financial edits |
| Balances | Basic/simplified plans, pending-payment reservations, current server-issued FX quotes, explicit confirmation and stable request IDs, receiver/sender responses and archived repayment lists | Real multi-user payments, quote expiry and conflict/retry tests |
| Collaboration | Task/poll create/edit/delete/clear, immutable options/votes, dates and reminders; versioned shopping/atomic checkout; spending charts, paginated history/detail and permissioned cleanup | Real concurrent edits, scheduling and UI/accessibility tests |
| Account | Language, export/deletion/logout, separate notification category and muted-group preferences | Real lifecycle/permission and export checks |
| Notifications | Session-bound native delivery/consent, paginated inbox, unread/read/clear, detail and validated group/section navigation | Real foreground/background/killed-app delivery and account switching |
| Startup/design | Existing launcher assets and purple/white native UI; existing native intro port unchanged | Side-by-side visual/intro/typography checks; visual equivalence is not certified |
| Fluidity | Native scrolling, virtual lists and native-driver animation without fixed FPS timing | Physical 60/120 Hz, reduced motion, keyboard/insets, large fonts and TalkBack |

### Collaboration and shopping

Task/poll forms reuse `planning.js` validation and the existing planning RPCs. Dates and times use Android dialogs and are converted from local wall time to UTC with the original validator; existing seconds are preserved when the displayed minute is unchanged. Editing a poll keeps its original options and votes. Creator/owner checks guard editing/deletion/manual reminders, list clearing is owner-only, and closed polls reject voting. Server permission checks, scheduling capability checks, throttles and notification preferences remain authoritative.

Shopping mutations use the existing item versions and permission policy. Products already linked to an expense cannot be checked or edited. Checkout opens the normal native expense form for explicit amount/payer/split review, pins its group and selected product IDs, and calls `Cloud.saveGroup` with the existing atomic checkout RPC. The stable form expense ID is reused after network failures; no client-side optimistic expense or product link is created. Failed list refreshes after a confirmed checkout show a notice without treating the financial write as failed. Late shopping replies cannot overwrite another group/account. Pull-to-refresh and foreground refresh reload shared state. No backend/schema changes or new dependencies are required.

### Receipts and recurring expenses

The native receipt bridge uses Android image capture and the document picker with temporary URI grants; no broad camera, gallery or storage permission is requested. Photos are normalized for EXIF orientation, rendered over white and re-encoded as JPEG (at most 1800 pixels on the long side / 1 MiB for upload), dropping metadata. A separate normalized copy is retained in private app cache for bundled ML Kit Latin-script OCR (`com.google.mlkit:text-recognition:16.0.1`). OCR runs locally and its text is not persisted or uploaded. Selected totals, dates and titles are applied only after confirmation; uncertain or different currencies do not change the amount. Receipt files still use the existing private Supabase bucket and short-lived signed URLs. Unmounted/replaced selections release the OCR copy; abandoned cache files older than 24 hours are removed when the module initializes. Device tests must verify capture cancellation, rotation, large/blurred photos, format support and upload retry behavior. Native crop/manual rotation controls are included; gesture precision and camera/format behavior need physical validation.

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

1. Run the physical acceptance checklist in `DEVICE-TESTS.md` and compare existing functionality using controlled test accounts.
2. Confirm `assetlinks.json` still authorizes `com.divzplit.app` with the **Play app signing certificate**, not merely the upload key. No new signing fingerprint is required solely for React Native.
3. Verify an upgrade over the current Play-installed version on a physical Android phone; expect native sign-in again, but no loss of server data.
4. Build with a version code higher than every existing Play release and the existing upload key. Publish first to an appropriate restricted test channel.
5. Validate startup, offline/error cases, back button, links, payments, receipts, notifications, accessibility and 60/120 Hz devices before expanding rollout.

Merging this source does not change the published Android app. The existing website hosting does not build this independent native project.

## Scope of member management

The current shared backend owns member identities and names. Its website exposes membership through invitations and owner/member roles; it does not expose a safe account removal, ownership transfer or group-leave RPC. The native UI mirrors those available capabilities and does not fabricate membership edits by overwriting canonical member arrays. Adding those new capabilities would require a separate backend/product change, rather than completion of an existing web feature.

## Final implementation pass

`FeatureScreens.js` and `features.mjs` finish group settings/budget/date validation, reserved settlement suggestions, server-verified conversion quotes, history pagination/detail/cleanup, notification preferences/inbox/detail routing and recovery lifecycle. `ReceiptEditor.js` and the native receipt bridge provide private-cache crop/rotation without new dependencies. The original website and Android wrapper remain unchanged. All implementation work is reviewable in the native source; only device acceptance and release verification remain for the coverage matrix above.

## Restored mobile website design

Candidate `1.2.0-native.5` / code `11` restores the approved website design while keeping React Native. See [DESIGN-REFERENCE.md](DESIGN-REFERENCE.md) for scope, original timing measurements, bundled font faces and preview limitations. Upload this new AAB to the existing Play test track; merging source alone does not update an installed native app. No new Firebase, Supabase or signing configuration is required for this visual update.

## Startup hotfix (code 12)

Candidate `1.2.0-native.6` fixes the native/JavaScript Animated graph collision in the code 11 opening handoff. Native opacity/transforms now live on wrapper views; JavaScript font metrics stay on the nested text views. Design and durations are unchanged. Update through the same Play track with the existing signing key; uninstalling or clearing app data is unnecessary. Tests reproduce the previous React Native exception and exercise the actual corrected component graph; this is not a substitute for a physical launch/upgrade test.

## Groups, languages and round dock (code 13)

Candidate `1.2.0-native.7` corrects React Native fetch's `cache: 'no-store'` URL mutation: the native transport uses no-store HTTP headers without adding `_=` to PostgREST queries. Existing groups, history and other REST GET data can use their original server queries. Read/loading/failure/confirmed-empty states are distinct; failed background reads retain same-account data, and failed recurrence writes no longer hide successfully loaded groups or publish unconfirmed charges. Retry and a token-free support diagnostic are available on failure.

Native-only localization supplements the shared catalog, translates known previously localized error strings into the current language, localizes the email example and viewer label, and preserves user-written names/titles. The dock has a 72 px capsule with 36 px corners, circular 52 px add control and circular 34 px selection marker. The opening animation and code 12 driver correction are unchanged. Update through the existing Play track; do not recreate groups, clear data or change backend permissions.
