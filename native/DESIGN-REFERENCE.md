# Mobile website design restoration — 18 November 2026

Reference approved by the owner: the current mobile design of divzplit.com, including the opening animation. The reference source is the website at base commit `d8d72ac8b337c36e340c6eab26f2cc860312ecaa`. The website's final computed styles include `refined.css`, `dock-effects.css`, `glass.css` and `welcome.css`; earlier overridden CSS declarations are not the reference.

## Implementation

The app remains React Native, using native views and the existing controller, Cloud/Supabase client and domain modules. There is no WebView conversion or new production dependency. Website and legacy Android wrapper sources are unchanged.

- `src/design.mjs`: shared purple/white/lavender palette and original opening timings.
- `src/Opening.js`: purple Z and period, original letter assembly/keyframes, curtain and measured handoff to the actual wordmark. The original web animation files are unchanged. Native rendering remains a port, so physical visual acceptance is required.
- `src/App.js`: original welcome/login composition and background screenshot, Google/Apple marks, wordmark, header, floating dock, sheets, expense editor, tasks, polls and shopping. The welcome phone keeps the original 1550 ms delay and 1100 ms entrance. Editing/reminders/clearing remain available through task avatar actions and poll controls.
- `src/ReferenceScreens.js`: reference home balance/shortcuts/recent rows, photo-covered plans, expense details, grouped account rows, help and shared group heading. Uses the existing website photos, localized welcome screenshots and help content.
- `src/FeatureScreens.js`: original expense list, activity cards/chart, forms and settlement presentation; existing payment/history/notification permissions and confirmations remain in place. Settlement currency selection uses the existing FX controller.
- `src/icons.js` and `src/ReceiptEditor.js`: matching icon paths and purple crop controls.
- `src/runtime.js` / `src/session.mjs`: inject the existing help module; no authentication or financial controller behavior changes.
- Android `DivZplitModule.java`: bounded, cancellable system choice dialog used for native select fields. No browser navigation or security bypass.
- Android themes and launch background: use the reference purple and pale launch background. Android 12's required system splash is retained.
- Bundled Manrope faces: static 400/500/600/700/800 instances of the existing website font, generated with fontTools `instantiateVariableFont(font, {'wght': weight}, inplace=True)`. Separate family names avoid Android synthetic bold. The original OFL license remains bundled. Website weight 850 resolves to the original font's maximum 800.
- `native-config.json`, `package.json`, `package-lock.json`: version `1.2.0-native.5`, code `11`; unchanged package `com.divzplit.app`.

## Reference measurements

At 393 CSS pixels: 67 px header, 25 px header wordmark with -1 px spacing, 20 px content margins, 142 px balance card with 23 px corners, 63 px shortcuts, 67 px compact recent rows and a 72 px floating dock. Welcome wordmark is 39.3 px, with -2.5 px spacing. Plan images are 160 px high. Native safe-area insets are used for Android system bars.

The original assembly is 1350 ms, Z movement 1550 ms, hold 1539 ms and handoff 1161 ms. `tests/design-reference.test.mjs` compares those timings and Z stops with the original CSS/JavaScript rather than a duplicate fixture. It also verifies bundled static font tables.

## Validation limits

Development-only React Native Web rendering was used outside the repository to compare the actual JSX against the local website with fictional fixtures at 320, 393 and 430 px. It ships neither browser shims nor preview dependencies in Android. This checks composition and catches JavaScript/rendering errors; it does not prove Android font rasterization, system dialogs, keyboard/safe areas, frame pacing or animation parity. Native release build/lint, the existing workflow tests and final bundle checks are separate checks. Run `DEVICE-TESTS.md` on an Android phone before wider release.
