# Migration candidate validation — 17 November 2026

Base repository commit: `fe7cf5ae268d0b82461668cff7aa689e0f72c660`.

## Passed automatically

- Existing repository `npm run check` and complete `npm test` command.
- `npm test --prefix native`: 11 tests, including real shared Cloud/model integration through a fixture HTTP transport, canonical identity/version mapping, registration consent, financial failure/retry/concurrency, permissions, stale activity response, callback origins, binary encoding, persisted PKCE state and SHA-256.
- Metro production Android bundle; Gradle release compilation (Kotlin, Java, C++ and Hermes), R8 and AAB generation for ARM64 and ARMv7.
- Android `lintRelease`: 0 errors, 12 warnings. Warnings concern the pinned Gradle version and unused resources inherited from the existing Android wrapper. No lint baseline or error suppression was added.
- Existing upload certificate comparison and `jarsigner -verify`.
- Bundletool 1.18.3 `validate` on the final signed candidate. Manifest: package `com.divzplit.app`, version code `7`, name `1.2.0-native.1`, minimum API 24 / target API 36, native `MainActivity` launcher.
- Final bundle contains the offline Hermes application bundle, Manrope font and its OFL license. The application screens use React Native views, with no WebView activity or browser-based application shell in this candidate.
- Source scope scan: all existing website, domain/backend and legacy Android wrapper files unchanged. Only `.gitignore` and new `native/` files are included. No private signing key or service-account private key is included.

Final local review artifact (not published to Play):

```
divzplit-1.2.0-native.1.aab
bytes: 23165998
SHA-256: 7650b1d702f422c9a7bc299149b0ba132fcad8fd772afe26b55e68dc2d0fb452
```

Android upload certificates are normally self-signed: jarsigner reports the untrusted certificate chain and absence of a timestamp while verifying the bundle signature. The build checks the certificate against the repository's existing upload certificate before signing.

## Not verified and not production-ready

No Android device is connected to this environment, and Android runtime/emulator validation was not completed. A compile or signing success does not prove the UI launches correctly, authentication returns correctly, notifications arrive, or features match the published app.

The explicit remaining feature matrix is in [README.md](README.md). Complete those features and test real Google/Apple sign-in, upgrades, Keystore/session lifecycle, permissions, camera/OCR, payments, Firebase delivery, TalkBack, introductory animation/design parity and 60/120 Hz devices before replacing the current Play version. Native opening timing has a separate port, but its visual equivalence has not been established. The original web animation is unchanged.

This source addition does not merge itself, deploy the site, upload an AAB, or change the existing published Android release.
