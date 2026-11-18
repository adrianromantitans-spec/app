# iPhone web surface/motion audit — 18 November 2026

Base: `cc5d55f` (main after PR 21). Candidate `1.2.0-native.10`, Android code `16`.

## Every modified file

- `src/design.mjs`: measured balance credit/debt/caption/self-paid colors, currency metrics and dock reference constants; numeric CSS-angle gradient endpoints; correct nested mobile amount sizes (34/37/40 px) and opening font clamp/ink.
- `src/ReferenceScreens.js`: apply that palette, CSS-equivalent 125° balance gradient, locale currency order/17 px weight, responsive amount/title sizes, down-arrow debt badge, actual caption/footer metrics, recent title weight/size, home avatar size/border/context width, and account-row typography. Financial values and opaque names stay unchanged.
- `src/Dock.js`: web 68×60 compact footprint, 6 px plus shift, exact slot/icon/label alignment and gradient stops; spring collapse 240/28 and native selection 420/36. Native selection/add remain circular as explicitly requested. Stop any in-flight collapse and immediately expand when disabled, Reduce motion or screen reader becomes active. Existing scroll/momentum/idle/provider graph isolation remains.
- `src/dock-motion.mjs`: five-column slot padding matches the reference; derive primary-route direction without changing page actions or scroll-intent handling.
- `src/ScreenEntrance.js`: primary route entrances use the website's lateral 24 px / 180 ms motion, captured once per mount; secondary/sheet entry and reduced motion remain supported. Native transform/opacity only.
- `src/App.js`: wire route direction, live Reduce motion updates, 26 px dock bottom gap plus system inset and matching primary-header logo geometry. Preserve all authentication/session/expense/backend behavior.
- `src/opening-motion.mjs` (new): sample the original CSS per-keyframe cubic-bezier once into interpolation ranges. Native Z animation uses one clock rather than JavaScript callbacks between segments.
- `src/Opening.js`: native Z timeline and original 50%/85% pivot; retain original assembly, 1539 ms hold and 1161 ms flight, skip and exact header blend. Match opening ink/font clamp and curtain ellipse. No per-frame font/layout updates or new timing loop.
- `src/FeatureScreens.js`: fix the non-embedded settlement container declaration discovered in the all-page rendering audit. It previously resolved to a props object rather than ScrollView. Embedded and full-page settlement modes now render; calculations/requests are unchanged.
- `native-config.json`, `package.json`, `package-lock.json`: .10/code 16 only; dependency set unchanged.
- `tests/iphone-parity.test.mjs` (new): CSS keyframe/easing/pivot contract, palette/dock/spring reference contract, angle-correct numeric gradients, responsive digit sizes and directional route behavior.
- `tests/opening-native-driver.test.mjs`: actual native graph has exactly one 1550 ms Z animation, no interaction/layout/font animation; retain all old crash/landing/header/reduced-motion checks.
- `tests/dock-native-driver.test.mjs`: actual compact geometry and unchanged native/JS graph isolation.
- `tests/sheet-native-driver.test.mjs`: actual directional page entrance on both sides, 180 ms/native driver, plus all previous keyboard/inset/reduced-motion sheet checks.
- `README.md`, `DESIGN-REFERENCE.md`, `DEVICE-TESTS.md` and this report: scope, evidence and remaining physical checks.

Only native/ changes. No website, database, credentials, authentication, financial calculation, notification or signing identity changes. No new dependencies.

## Validation completed

- **95 native tests pass.** Includes previous financial/session/group query/localization/receipt/feature regressions plus the actual pinned React Native Animated graph checks. Host-free graph tests mock platform/bridge/hooks; they are not an Android renderer.
- Actual local current-main mobile website captured with fictional matching data and computed-style measurements. Visual side-by-side with native JSX preview used to inspect Home/Plans/Account and the main screen set. The public live-site stylesheet hash check returned HTTP 403 from this environment; equality with a cached installed iPhone copy cannot be established remotely. WebKit is not installed; web fixture rendering uses Chromium.
- Native JSX browser fixtures: Home, Groups, Activity, Profile, Tasks, Polls, Shopping, Expenses and full-page Settlements at 320/393/430 px, no JavaScript errors/horizontal overflow. Guest welcome/login checked; Google entry remains present.
- ES/EN/RO motion/card fixtures: localized two-person labels, full measured gradient bounds, larger-text card growth, intermediate moving circular selector and compact/expanded geometry. User scroll phases are simulated through native callback fixtures; this does not establish physical Android gesture delivery/frame pacing.
- Quick/expense panels checked in all three languages and short/tall/keyboard-sized viewports. Quick-action destinations, expanded expense options, inferred emoji and existing amount/category/participants/group save payload checked with a fixture-only controller interception. No-group menu passes. No production writes.
- Live Reduce motion fixture stops an in-flight dock, restores navigation immediately, preserves session/group identity and leaves + usable. Screen-reader fixture keeps the dock expanded.
- Final source-frozen release build and signing pass (`native/scripts/build-android.py`). Native src aggregate SHA-256: `0aa3a70a9da44ce71745b68bfc8d85f993e121f1186da6992c6a30233d037407`. Lint: **0 errors, 21 unchanged warnings**.
- Build script verifies the original upload certificate against `android/upload-certificate.pem`; jarsigner verification passes. Existing com.divzplit.app identity retained.
- Bundletool 1.18.3 validation passes. Manifest version code 16/name 1.2.0-native.10 and MainActivity confirmed. Hermes bundle/fonts present; all 13 ARM64 shared libraries have LOAD alignment at least 16 KB.

## Signed candidate

`native/android/app/build/outputs/review/divzplit-1.2.0-native.10.aab`

- Bytes: `34748014`
- SHA-256: `19cdffac75bfb8d3eafb2564834a08a4c689a030815f534e0296a36b947c6d79`

Upload to the existing Google Play test track and update without clearing data. No Firebase/Supabase/Play signing configuration changes are required. Merging native source alone cannot update an installed AAB.

## Physical/optical limits

No phone/emulator was attached. Actual 60/120 Hz frame pacing, cold/warm launch, native gesture delivery, IME/system insets, TalkBack and the owner's installed iPhone comparison remain device acceptance checks. Native SVG translucency approximates Safari glass; it does not reproduce CSS backdrop blur/refraction or iOS system pickers pixel for pixel. Circular selector/add controls intentionally preserve the user's explicit request. Do not claim an identical physical rendering or measured FPS from browser/graph checks.

No automatic source merge, website deployment or Google Play upload has been performed.
