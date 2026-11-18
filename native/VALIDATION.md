# Stable access screen, Google consent and opaque dock — 18 November 2026

Base: `c273091` (main after PR 22). Candidate `1.2.0-native.11`, Android code `17`.

## Root causes and every modified file

- `src/App.js`: Auth rendered the Google/Apple consent Sheet with `reduced={reduced}`, but `reduced` was absent from Auth's scope/props. Clicking the provider icon therefore raised `ReferenceError: reduced is not defined` before OAuth began. Pass the actual preference into Auth and its Sheet. Preserve age/legal consent, provider selection and OAuth/PKCE behavior.
- `src/App.js`: guest welcome/login now uses a static wordmark instead of the custom opening flight. Resolve startup session readiness before mounting a signed-in opening/header/dock; mark the guest intro complete so later login/logout cannot replay it. Reveal guest welcome content only after the actual viewport measurement, avoiding a visible correction from estimated full-window height to safe-area height. Retain the custom opening for restored signed-in sessions, original timings and Android's mandatory system splash.
- `src/Dock.js`: full-opacity gradient stops/stroke for the dock plate, full-opacity purple add gradient and solid selection color. Existing collapse/selection springs, geometry, idle and accessibility behavior stay unchanged. This overrides code 16 translucency at the owner's explicit request.
- `src/design.mjs`: solid lavender selection reference color.
- `src/Opening.js`: nonvisual test identifier for distinguishing the signed-in opening from guest entry; no keyframe/flight changes.
- `tests/auth-entry.test.mjs` (new): compile the actual App component with host/hook/platform boundaries mocked. Reproduce the missing-prop ReferenceError, render welcome/login Google/Apple consent in both motion modes, assert guest entry is static, signed-in opening waits for readiness, and welcome wordmark waits for measured layout.
- `tests/dock-native-driver.test.mjs`: inspect the actual Dock tree for opaque gradient stops/solid selection while retaining pinned Animated graph/motion regression coverage.
- `native-config.json`, `package.json`, `package-lock.json`: .11/code 17; no dependency changes.
- `README.md`, `DESIGN-REFERENCE.md`, `DEVICE-TESTS.md` and this report: scope and verification/device checklist.

Only native/ changes. No website, backend, database, expense calculations, notification, OAuth endpoint/security, Android secure-browser, package or signing identity changes. No new dependencies.

## Checks completed

- **100 native tests pass**, including prior group/query/localization, financial/session, OAuth callback/PKCE, receipt and feature regressions. Host-free component/graph tests are not an Android renderer.
- Reproduced the original provider-icon crash in development browser fixtures using the previous main App source: `reduced is not defined`. The fixture build remains outside the repository and Android artifact.
- Actual corrected native JSX/browser fixture: welcome and login Google icon opens consent, Continue stays disabled until both acknowledgements are selected, then dispatches the unchanged provider/consent payload via a fixture-only controller interception. Both normal and reduced-motion modes pass without page errors. This does not perform a live Google account login.
- Guest brand stays at the same measured bounding box across startup samples; no custom opening overlay is mounted. Restored signed-in fixture still runs and completes the custom Z/opening.
- Actual dock screenshots with a red then blue test surface placed behind it: five interior samples have identical pixels, proving the interior opacity in this renderer. Native tree tests assert all plate/add stops have opacity 1 and no alpha selection fill.
- ES/EN/RO card/dock-motion regressions pass: measured gradient bounds/large text, intermediate circular selector and compact/expanded geometry. Quick-action/expanded expense/save-payload/no-group fixture checks pass. No production writes.
- Final source-frozen `native/scripts/build-android.py` release build and signing pass. Native src aggregate SHA-256: `4f92dc76bfc26ad92462feaa1e2dd4dc092820d105789ae8b1df36b000d9bb70`.
- Lint: **0 errors, 21 unchanged warnings**. Upload certificate checked against `android/upload-certificate.pem`; jarsigner verification passes.
- Bundletool 1.18.3 validates the final AAB; manifest com.divzplit.app / code 17 / 1.2.0-native.11 / MainActivity. Hermes bundle/fonts present. All 13 ARM64 ELF libraries have LOAD alignment at least 16 KB.

## Signed artifact

`native/android/app/build/outputs/review/divzplit-1.2.0-native.11.aab`

- Bytes: `34748136`
- SHA-256: `693657b895e8c68db13b4ba40966e3072d85fc3950253462e744cb68cb52fa03`

Upload to the same Google Play testing track and update without clearing data. No new Firebase/Supabase/Google/Play signing configuration is required. Source merge alone does not update the installed app.

## Remaining physical verification

No Android phone/emulator was attached. Confirm cold/warm guest entry, restored account opening, keyboard/insets, 60/120 Hz motion and the opaque bar on the device. Complete one real Google sign-in and return through the existing secure browser/App Links flow, plus cancel/retry; browser fixture dispatch and API contract tests cannot establish end-to-end provider/device success. Android's mandatory system splash remains.

No automatic source merge, website deployment or Google Play upload has been performed.
