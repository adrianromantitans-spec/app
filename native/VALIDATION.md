# Add sheets and native entrances — 18 November 2026

Base: `2598429` (main after merged PR 20). Candidate `1.2.0-native.9`, code `15`.

## Changes and every modified file

- `src/Sheet.js` (new): reusable modal with an explicit measured panel height, a finite scrolling viewport, top safe-area cap and bottom padding of 22 px plus the system inset. KeyboardAvoidingView shrinks available space; the header/close control stays outside the scrolling content. Transparent system-bar configuration is paired with real safe padding. Wait for content measurement before starting the native 280 ms slide/fade entrance. Respect reduced motion and Android Back.
- `src/sheet-layout.mjs` (new): finite height calculation for content/header measurement, small screens, expanded options and keyboard-resized viewports.
- `src/QuickAdd.js` (new): mobile-web action hierarchy/icons/descriptions for expense, task, poll, shopping and new group; current group context/selection; existing join/invite entry points remain. Group/title content is not translated as UI copy.
- `src/ScreenEntrance.js` (new): 220 ms native opacity/translation entrance for keyed pages and modal steps; no per-frame React/layout/font work; reduced-motion branch.
- `src/App.js`: replace the old unconstrained Sheet; connect quick actions and keyed page entrances; remove full-screen Android blur beneath modals, retaining the dimmed backdrop. Expense entry shows an inferred category emoji, payer avatar and save check. Amount input can shrink beside the currency without overflow. Existing financial save/read/validation/auth/receipt logic and payloads remain unchanged.
- `src/icons.js`: existing web receipt, vote and share/link outline paths, without an icon dependency.
- `src/Opening.js`: keep the original font/colors, assembly, hold and 1161 ms flight. Animate the flight with native translation/scale/opacity and fixed glyph metrics instead of JavaScript font-size/line-height/letter-spacing changes. Compensate for the scale origin; blend to an exact fixed header wordmark during the final 15% of that same flight to avoid a spacing snap. No added timer or per-frame layout state. Skip/reduced-motion behavior remains.
- `native-config.json`, `package.json`, `package-lock.json`: version .9/code 15, no dependency changes.
- `tests/opening-native-driver.test.mjs`: retain the earlier mixed-driver crash reproduction; exercise actual Opening with pinned React Native Animated graphs, fixed metrics, native-only flight, measured landing, exact header blend, skip and reduced motion.
- `tests/sheet-layout.test.mjs` (new): bounded long forms across short/tall/keyboard-sized screens, safe-area caps and content/header changes.
- `tests/sheet-native-driver.test.mjs` (new): actual Sheet/ScreenEntrance native graph checks, finite scrolling body, bottom inset, Android keyboard behavior, bar settings, Back dismissal and reduced motion.
- `README.md`, `DESIGN-REFERENCE.md`, `DEVICE-TESTS.md` and this report: current behavior, reference and validation/device checklist.

All modifications are under native/. No website, legacy wrapper, backend, database, signing identity, financial calculations or dependency set changes. No phone/emulator was attached.

## Passed checks

- `npm --prefix native test`: **89 passing tests**, including previous group-query, localization, native graph, finance/session, receipt and feature regressions.
- Host-free tests use the pinned React Native Animated Value/Style/Props/Animation classes with host/bridge/hooks mocked. They validate graph/configuration behavior, not Android rendering/frame pacing.
- Inspected and captured the actual current local mobile website with fictional fixtures for quick-add and expense entry. No production account or live data writes.
- Development-only actual native JSX browser fixtures in ES/EN/RO, 320×568, 393×852 and 430×780: bounded quick-add and expense panels, action icon rows, reachable scroll bottoms and a keyboard-sized 360 px viewport. Fixture actions open task/poll/group/shopping destinations, expand expense options, show the inferred emoji, and send the existing amount/category/participant/group save payload through a fixture-only interception. The no-group menu works. These browser shims/dependencies remain outside the repository and Android artifact.
- Final `native/scripts/build-android.py`: release lint and Metro/Hermes/Java/Kotlin/native/R8/AAB build pass. **0 lint errors, 21 warnings**, unchanged from code 14 (including two legacy splash resources unused by this native configuration).
- Signed using the existing upload key; build script verifies its certificate against `android/upload-certificate.pem`. `jarsigner -verify` passes. No new key, package or app identity.
- Bundletool 1.18.3 validation passes; manifest com.divzplit.app / code 15 / version 1.2.0-native.9 / MainActivity. Fonts and Hermes bundle present. All 13 ARM64 ELF shared libraries have LOAD alignment of at least 16 KB.

## Signed artifact

`native/android/app/build/outputs/review/divzplit-1.2.0-native.9.aab`

- Bytes: `34746425`
- SHA-256: `804845d3ff8846ee23b7b7695d44e6665fec174c4e7d0b8015e014dd9d96f2a8`

Upload the new AAB to the existing Google Play test track and update the installed app without clearing data. Source merge alone cannot update native UI/animation code. No additional Firebase/Supabase/Play signing configuration is required.

## Required real Android checks

Confirm actual keyboard/IME focus and scrolling, three-button/gesture navigation insets, small/rotated/large-text layouts, all quick actions and one test expense, cold/warm logo handoff, reduced motion/TalkBack and 60/120 Hz frame pacing. Physical smoothness and system behavior cannot be established by the browser fixtures or host-free tests. Existing Google sign-in, camera/OCR and FCM device checks remain applicable.

No automatic source merge, website deployment or Google Play upload has been performed.
