# Migration candidate validation — 17 November 2026

Base repository commit: `f05d0c887587fa614da35c0461f67fc35db6feda`.

## Passed automatically

- Existing repository `npm run check` and complete `npm test` command.
- `npm test --prefix native`: 22 tests, including real shared Cloud/model integration through a fixture HTTP transport, canonical identity/version mapping, registration consent, financial failure/retry/concurrency, permissions, stale activity response, callback origins, binary encoding, persisted PKCE state and SHA-256.
- Receipt tests cover exact binary uploads through the existing Cloud transport, private storage/session headers, input limits, failed-save retry reuse, account/group changes, safe old-photo cleanup, monthly calendar anchors, stopped series, deletion permissions and concurrent refreshes. They do not call the production backend.
- Metro production Android bundle; Gradle release compilation (Kotlin, Java, C++ and Hermes), R8 and AAB generation for ARM64 and ARMv7.
- Android `lintRelease`: 0 errors, 19 warnings. Warnings concern the pinned Gradle version, Android framework ExifInterface, private AppCompat resources referenced by the inherited React Native text-input drawable, and unused resources inherited from the existing Android wrapper. No lint baseline or error suppression was added.
- Existing upload certificate comparison and `jarsigner -verify`.
- Bundletool 1.18.3 `validate` on the final signed candidate. Manifest: package `com.divzplit.app`, version code `8`, name `1.2.0-native.2`, minimum API 24 / target API 36, native `MainActivity` launcher.
- Final bundle contains the offline Hermes application bundle, bundled Latin-script ML Kit OCR models, Manrope font and its OFL license. All 13 packaged ARM64 libraries, including the OCR pipeline, have ELF LOAD alignment of at least 16 KB. This static check does not replace an installation test on a 16 KB device.
- Final manifest contains a nonexported receipt FileProvider with temporary grants, and no broad camera, media-library or storage permission.
- The application screens use React Native views, with no WebView activity or browser-based application shell in this candidate.
- Source scope scan: all existing website, domain/backend and legacy Android wrapper files unchanged. This follow-up changes only files under `native/`. No private signing key or service-account private key is included.

Final local review artifact (not published to Play):

```
divzplit-1.2.0-native.2.aab
bytes: 32790379
SHA-256: 9116b402266ee3ae768499a4a21c067207268b36e12e3cbf7cde24db0c4c7110
```

Android upload certificates are normally self-signed: jarsigner reports the untrusted certificate chain and absence of a timestamp while verifying the bundle signature. The build checks the certificate against the repository's existing upload certificate before signing.

## Not verified and not production-ready

No Android device is connected to this environment, and Android runtime/emulator validation was not completed. A compile or signing success does not prove the UI launches correctly, authentication returns correctly, notifications arrive, or features match the published app.

The explicit remaining feature matrix is in [README.md](README.md). Complete those features and test real Google/Apple sign-in, upgrades, Keystore/session lifecycle, permissions, camera/OCR, payments, Firebase delivery, TalkBack, introductory animation/design parity and 60/120 Hz devices before replacing the current Play version. Native opening timing has a separate port, but its visual equivalence has not been established. The original web animation is unchanged.

This source addition does not merge itself, deploy the site, upload an AAB, or change the existing published Android release.
