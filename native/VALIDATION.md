# Balance card, navigation motion and startup — 18 November 2026

Base: `031a72f` (main after PR 19). Candidate `1.2.0-native.8`, code `14`.

## Changes and file scope

- `src/ReferenceScreens.js`: the balance card uses measured numeric SVG dimensions, a purple fallback and minimum/content height. This addresses percentage backgrounds being sized against a padded native content box, leaving the right/bottom unpainted. Preserve the original palette/amount/footer layout. Wire tracked scrolling and localized two-person balance copy.
- `src/balance-copy.mjs`: for exactly two members, name the actual counterparty in debit/credit badges. Keep settled and larger-group count summaries. No financial calculations/writes changed; names remain opaque values.
- `src/localization.mjs`: ES/EN/RO two-person templates.
- `src/Dock.js`: numeric SVG capsule-to-circle plate, explicit circular SVG add/selection shapes, native-driven spring selection, JS-driven collapse layout/fades in separate node graphs. Screen readers/reduced motion keep navigation expanded. Fast navigation cancels the old selection spring safely.
- `src/dock-motion.mjs`: user drag/momentum/idle controller, programmatic scroll rejection, disposal of old-page events and route-family slot mapping. Compact while scrolling; restore 280 ms after the gesture/momentum ends. No hard-coded refresh-rate animation loop.
- `src/DockScroll.js`: tracked native FlatList/ScrollView props forward original callbacks/ref and native scroll phases. No tracking outside the signed-in page provider or on horizontal scrolls.
- `src/App.js`: wire the page-only provider/dock, preserve sheets/auth, remove old static dock styles, fix the padded welcome-button gradient with numeric bounds and align the boot background with the curtain edge.
- `src/FeatureScreens.js`: tracked scroll imports for the existing page components; modal content remains outside the provider.
- `src/Opening.js`: measure the overlay window origin; freeze initial word metrics during flight so font-layout events do not drive React state renders every frame. Interpolate the actual top-left handoff. Existing assembly/keyframes/hold/flight times, colors, font face, native/JS graph separation, reduced motion and skip behavior remain.
- `android/app/src/main/res/drawable/ic_native_splash.xml`: direct vector preserving the existing brand paths/composition, without the adaptive background/transparent-foreground indirection. No bitmap was substituted.
- `android/app/src/main/res/values-v31/styles.xml`: use the dedicated vector for Android's mandatory system splash.
- `android/app/src/main/java/com/divzplit/app/MainActivity.kt`: supported Android 12+ exit listener fades the system splash out for 160 ms, then removes its view; disabled system animations remove it directly. No system-splash bypass or added hold.
- `android/app/build.gradle`: launch background matches the opening curtain edge, #FAF8FD.
- `native-config.json`, `package.json`, `package-lock.json`: .8/code 14; existing com.divzplit.app/signing identity and dependency set retained.
- `tests/dock-motion.test.mjs`: scroll/momentum/idle/reset/disposal, route slots, two-person/zero/larger-group summaries, and opaque names across languages.
- `tests/dock-native-driver.test.mjs`: actual component AnimatedProps graph isolation and collapsed SVG geometry, reduced-motion selector, plus tracked scroll callback/ref forwarding and modal/horizontal isolation.
- `tests/opening-native-driver.test.mjs`: extend the shipped-crash regression with exact measured handoff landing and ignored per-frame layout events.
- `tests/helpers/native-animated.cjs`: expose the pinned AnimatedProps class to the host-free integration checks.
- README, DESIGN-REFERENCE, DEVICE-TESTS and this validation report: scope/evidence/physical acceptance.

All changes are under native/. Website/legacy wrapper sources, shared domain/backend, previous REST/language fixes, credentials and production data are unchanged. No dependencies added.

## Passed checks

- `npm test --prefix native`: 84 passing tests, including all prior startup, REST-query, localization, financial, account/session, receipt, collaboration, recovery and feature coverage.
- Host-free tests use the pinned React Native Value/Style/Props/Animation implementations with platform/bridge and host/hook boundaries stubbed. They verify the native selector cannot promote the JS SVG/layout collapse graph to native, and retain the prior mixed-driver crash regression. They are not an Android renderer or performance measurement.
- Development-only actual native JSX/browser fixtures in ES/EN/RO: named pair badge, full numeric card bounds at 320/393/430 px and with larger text, intermediate moving selector, explicit circle marker, intermediate/compact/expanded plate geometry, no uncaught JS errors or horizontal document overflow. Native scroll callbacks were invoked through a development-only harness; a real Android scroll gesture still needs testing. Browser shims were adjusted for the RN global alias and RN Web's hard-coded screen-reader flag; those shims/instrumentation are outside the repository and never ship in Android.
- Final Metro/Hermes release, Java/Kotlin/C++ compilation, R8, AAB generation and lint pass. `lintRelease`: 0 errors, 21 warnings (the previous 19 plus two inherited splash resources now unused by the native build). Shared legacy resources were preserved; no suppression/baseline added.
- Existing upload certificate comparison and jarsigner verification pass. Normal self-signed/no-timestamp upload-certificate notices remain.
- Bundletool 1.18.3 validates the signed AAB. Manifest: com.divzplit.app, code 14, version 1.2.0-native.8, minimum API 24 / target API 36, native MainActivity launcher.
- The dedicated splash vector is packaged. Existing Hermes bundle/fonts/assets/OCR models remain; all 13 ARM64 libraries retain at least 16 KB ELF LOAD alignment.
- Git diff/whitespace checks pass.

Final signed artifact:

```
divzplit-1.2.0-native.8.aab
bytes: 34741944
SHA-256: bc29c6e6c3dff16c474c4f9212337cb229f4898df328581d37b43f5c0a8bc59b
```

## Device acceptance remains

No Android phone/emulator is attached. Browser fixtures and graph tests do not establish physical icon rasterization, native scroll dispatch/feel, safe-area behavior, animation smoothness/frame pacing or 60/120 Hz performance. Update code 13 to 14 through the same Play test track without uninstalling or clearing data; compare the reported card, couple/group badges, scroll/selection transitions and cold/warm system-icon handoff using DEVICE-TESTS.md. Android's initial system splash remains mandatory and has not been hidden. All earlier real-device OAuth/FCM/camera/financial gates remain.

This source change does not merge, deploy the site or publish a Google Play release.
