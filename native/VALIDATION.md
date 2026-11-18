# Design restoration candidate — 18 November 2026

Base: `d8d72ac8b337c36e340c6eab26f2cc860312ecaa` (main after PR 14). Scope and file-by-file changes: [DESIGN-REFERENCE.md](DESIGN-REFERENCE.md).

## Passed automatically

- Full existing repository `npm run check` and `npm test`.
- `npm test --prefix native`: 56 passing tests. The existing 54 tests cover shared Cloud/model transport, financial concurrency/idempotence, permissions, account/group isolation, receipts, collaboration/checkout, groups, FX, history/inbox, preferences and recovery. Two new tests compare native opening timings/keyframes with the actual original website sources and validate static Manrope font tables.
- Development-only browser rendering of the native JSX with fictional local fixtures: home, plans, activity, account, tasks, polls, shopping, expenses and settlements at 320/393/430 px, without horizontal document overflow or uncaught rendering errors. Additional ES/EN/RO checks cover navigation, notifications, group details, expense detail/edit, and help; welcome/email login displays the Google mark. This is a composition/JavaScript check, not an Android runtime test. Preview tooling/dependencies are outside the repository and are not bundled in Android.
- Final Metro production bundle, Hermes compilation, Java/Kotlin/C++ release compilation, R8 and ARM64/ARMv7 AAB generation.
- Android `lintRelease`: 0 errors, 19 warnings. These concern the pinned Gradle version, inherited resources and framework ExifInterface; no lint baseline or suppression added.
- Build-time upload certificate comparison against `android/upload-certificate.pem`; `jarsigner -verify` passes with the existing key. The normal self-signed chain/no-timestamp notices remain.
- Bundletool 1.18.3 `validate` passes on the final signed AAB. Dumped manifest: package `com.divzplit.app`, code `11`, name `1.2.0-native.5`, minimum API 24 / target API 36, native `MainActivity` launcher.
- The bundle contains the offline Hermes application, all five Manrope faces/OFL license, existing website photos/welcome screenshots and bundled Latin-script OCR models. All 13 ARM64 shared libraries have ELF LOAD alignment of at least 16 KB.
- Git scope: only `native/` sources, assets, version metadata, tests and documentation changed. Website animation/UI, Supabase integration/backend, legacy wrapper and signing identity remain unchanged. No private signing key or Firebase service-account key is committed.

Final signed review artifact:

```
divzplit-1.2.0-native.5.aab
bytes: 34728646
SHA-256: f561c660f00c33988373d616f8476b08142ba22c8ad8ddb10c89efd8fd0f5bdd
```

## Physical validation remains

No Android phone or emulator is connected. The build and browser preview do not establish Android visual/animation parity, font rasterization, keyboard/safe areas, selector behavior, 60/120 Hz performance, successful real OAuth callbacks, camera/OCR or FCM delivery. Follow [DEVICE-TESTS.md](DEVICE-TESTS.md), including the new design-restoration section, after installing through the existing Google Play test track. The original web animation sources and their durations are preserved; the separate native port still needs side-by-side acceptance on Android.

This change does not merge itself, deploy the website or upload/publish a Google Play release. The AAB is a signed test candidate, not a claim of production readiness. No new Google Play signing, Firebase or Supabase configuration is required for this visual update.
