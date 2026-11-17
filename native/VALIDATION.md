# Migration candidate validation — 17 November 2026

Base repository commit: `b72aa4eb01f4245d4aae17c965dabdce860fcb8c`.

## Passed automatically

- Existing repository `npm run check` and complete `npm test` command.
- `npm test --prefix native`: 54 tests, including real shared Cloud/model integration through a fixture HTTP transport, canonical identity/version mapping, registration consent, financial failure/retry/concurrency, permissions, stale activity response, callback origins, binary encoding, persisted PKCE state and SHA-256.
- Receipt tests cover exact binary uploads through the existing Cloud transport, private storage/session headers, input limits, failed-save retry reuse, account/group changes, safe old-photo cleanup, monthly calendar anchors, stopped series, deletion permissions and concurrent refreshes. They do not call the production backend.
- Collaboration tests cover immutable poll options/votes, deadline validation with preserved seconds, assignment/owner permissions, closed polls, failed completion, item versions and linked-item locks, stale shopping replies, manual reminder guards, stable checkout IDs after lost responses, an actual shared Cloud atomic-checkout request, and confirmed-save/list-refresh separation. No production backend writes are performed.
- Final implementation tests add group ownership/version/confirmation and calendar/currency validation; invitation origin checks; real shared FX request payloads; pending-payment reservations and response roles; history/inbox pagination and stale-account guards; notification preferences; email confirmation without URL session adoption; separate password recovery and same-account recovery races. The 20 feature tests also pass with `TZ=Europe/Bucharest`.
- Metro production Android bundle; Gradle release compilation (Kotlin, Java, C++ and Hermes), R8 and AAB generation for ARM64 and ARMv7.
- Android `lintRelease`: 0 errors, 19 warnings. Warnings concern the pinned Gradle version, Android framework ExifInterface, private AppCompat resources referenced by the inherited React Native text-input drawable, and unused resources inherited from the existing Android wrapper. No lint baseline or error suppression was added.
- Existing upload certificate comparison and `jarsigner -verify`.
- Bundletool 1.18.3 `validate` on the final signed candidate. Manifest: package `com.divzplit.app`, version code `10`, name `1.2.0-native.4`, minimum API 24 / target API 36, native `MainActivity` launcher.
- Final bundle contains the offline Hermes application bundle, bundled Latin-script ML Kit OCR models, Manrope font and its OFL license. All 13 packaged ARM64 libraries, including the OCR pipeline, have ELF LOAD alignment of at least 16 KB. This static check does not replace an installation test on a 16 KB device.
- Final manifest contains a nonexported receipt FileProvider with temporary grants, and no broad camera, media-library or storage permission.
- The application screens use React Native views, with no WebView activity or browser-based application shell in this candidate.
- Source scope scan: all existing website, domain/backend and legacy Android wrapper files unchanged. This follow-up changes only files under `native/`. No private signing key or service-account private key is included.

Final local review artifact (not published to Play):

```
divzplit-1.2.0-native.4.aab
bytes: 32847029
SHA-256: 9ecd3f7762cb60d32d962759d4520a4146be2c31420e83967f11f045b72f2683
```

Android upload certificates are normally self-signed: jarsigner reports the untrusted certificate chain and absence of a timestamp while verifying the bundle signature. The build checks the certificate against the repository's existing upload certificate before signing.

## Not verified and not production-ready

No Android device is connected to this environment, and Android runtime/emulator validation was not completed. A compile or signing success does not prove the UI launches correctly, authentication returns correctly, notifications arrive, or features match the published app.

The implementation coverage matrix is in [README.md](README.md); the previously listed native flows are implemented. Run [DEVICE-TESTS.md](DEVICE-TESTS.md) to test real Google/Apple sign-in, upgrades, Keystore/session lifecycle, permissions, native date/time dialogs, task/poll editing and reminder delivery, multi-user shopping/atomic checkout, camera/OCR, payments, Firebase delivery, TalkBack, introductory animation/design parity and 60/120 Hz devices before replacing the current Play version. Native opening timing has a separate port, but its visual equivalence has not been established. The original web animation is unchanged.

This source addition does not merge itself, deploy the site, upload an AAB, or change the existing published Android release.

## Source changes in this completion pass

- `src/features.mjs`: group settings/deletion/invitations, reserved settlements/FX/payment guards, activity/inbox pagination, preferences, recovery lifecycle and native translations.
- `src/FeatureScreens.js`: native group/expense/settlement/activity/history/notification/preferences views.
- `src/ReceiptEditor.js`: native crop/rotation UI; `android/app/src/main/java/com/divzplit/app/ReceiptModule.java`: validated private-cache bitmap edits.
- `src/App.js`: native routes/forms, provider-aware Apple/Google entry, recovery screens, split drafts/shares/category inference and foreground refresh.
- `src/session.mjs` and `src/runtime.js`: connect shared domain modules, account/recovery isolation and extended workflows.
- `tests/features.test.mjs` and `tests/session.test.mjs`: workflow/financial/account coverage and fixtures.
- `native-config.json`, `package.json` and `package-lock.json`: candidate version 1.2.0-native.4/code 10; no dependency additions.
- `README.md`, `VALIDATION.md` and `DEVICE-TESTS.md`: implementation coverage, validation evidence and the physical acceptance checklist.

No private key, original web animation, shared web application module, backend schema or legacy Android wrapper source was changed. No production deployment or Play upload was performed.
