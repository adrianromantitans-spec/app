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

## Code 13 follow-up

Following the owner's request for circular liquid-glass controls, the native dock uses half-height/half-width radii: capsule 72/36 px, add button 52/26 px, selection marker 34/17 px. SVG gradient bounds match the view clipping. This replaces the earlier squircle controls; the rest of the approved design and opening animation remain intact. UI text is now resolved through the shared catalog plus the native localization supplement, including examples, viewer labels and error re-localization. User-created content remains opaque.

## Code 14 motion follow-up

The balance gradient is sized from the actual card border box, with a purple fallback and minimum rather than fixed height. It does not use a percentage-sized background inside a padded native container. Two-member badges name the counterparty; larger groups retain person counts. User-authored names remain opaque template values.

The dock's visible plate is a numeric SVG capsule (72 px expanded height) that morphs into a 64 px circle. The 52 px add control and 40 px selection marker are SVG circles. Selection uses a native-driven spring; layout/opacity morphs use a separate JS graph. Scroll phases are provided only around signed-in page content. The 280 ms idle return follows the website's behavior without a custom frame-rate loop. Screen-reader/reduced-motion navigation stays expanded.

A direct native vector and a supported Android 12+ exit fade improve the system handoff; mandatory system behavior remains. The custom opening assembly/hold/flight durations and branding are unchanged. Font layout is measured before flight, and the measured window origin is subtracted at the header handoff, avoiding per-frame React size updates.


## Sheet and entrance correction — code 15

Reference inspected: current `app.js` quickAddModal/expenseModal, `glass.css` quick-action styles and `liquid.css` mobile refinements, plus actual local mobile-web screenshots with fictional fixtures. The native add sheet now shares the icon/copy hierarchy and primary purple expense action. Task, poll, shopping and group actions are present, with existing native join/invite preserved. Expense entry includes the category emoji, payer avatar and save check.

The modal uses an explicit measured height capped below the top safe area, a finite scrolling body and bottom padding of 22 px plus the navigation inset. The keyboard reduces the available viewport; the header/close control remains outside the scrolling body. There is no fixed content-height assumption or hidden final action. Native fade/translation sheet and page entrances avoid font/layout animation. The main app is dimmed beneath sheets, without Android’s expensive full-surface blur filter.

The original custom logo assembly, palette, hold and 1161 ms flight remain. Fixed-size glyphs now move/scale/fade entirely through the native driver. A final 15%-of-flight blend into an exact fixed header wordmark avoids the spacing snap at handoff. No per-frame font size, line height, letter-spacing or React state changes.

## iPhone web audit — code 16

Compare against the current main website with fictional matching data at 320/393/430 px. Measure styles in the actual DOM, not only nominal CSS values: the more-specific nested `.stat-number` stays at 37 px on mobile (34 px below 361 px), even though its wrapper reports 41 px. Match this, 17 px currency, locale currency placement, credit #C7F3DC/#12553C, debt #FFE1E6/#A2213C with downward sign, 10 px balance caption, 13 px recent title and #187552 self-paid amounts. Use numeric CSS-angle-equivalent SVG endpoints at 125° for the balance card and correct the border/avatars/header target geometry. Preserve user names and financial calculations.

Dock: 357×72 at a 393 px viewport, 68×60 compact plate, 26 px bottom gap plus system inset, add moves down 6 px, label 9/13.5 px, icons 22 px; primary native controls remain circular per explicit user preference. Use the reference transparent white/lavender stops and spring coefficients; SVG does not reproduce Safari backdrop blur/refraction. Keep native selector motion separate from JS SVG/layout collapse. Idle, user-intent, momentum, disabled/motion/reader gates remain covered. Primary route entry matches the website's 24 px lateral/180 ms transition and navigation order.

Z: one native clock with the source CSS keyframe/easing samples (0/25/38/76/90/100%), native 50%/85% transform origin and no segment-completion JS callbacks. All custom opening durations and the measured final header blend remain. Opening ink matches #2D203E and lands on the actual #272133 header; the original radial curtain is retained. The explicit native font faces and OS text rendering may differ slightly from Safari.

The native candidate must still be viewed on Android, with comparison to the owner's actual installed iPhone web app. Browser-rendered native JSX and computed-style contracts cannot prove physical glass optics, keyboard behavior or frame pacing. WebKit was not installed in the execution environment; this audit uses Chromium rendering of the same web source.

## Explicit code 17 overrides

The owner requested a static access-screen wordmark and an opaque dock after testing code 16. Guest welcome/login therefore no longer uses the custom opening/flight; the existing signed-in opening and Android system splash remain. Resolve the startup session before displaying signed-in chrome/opening so the header/dock do not flash before the animation. Once guest auth is shown, later login must not replay the opening.

Dock gradients now use full-opacity white/lavender stops, an opaque purple add gradient and solid lavender selection. This deliberately replaces the prior Safari-translucency approximation while preserving the reference geometry and all scroll/navigation springs. Body color behind the plate must not affect its interior pixels.

Guest welcome content is first revealed after its actual viewport has been measured, rather than placing the wordmark using an estimated full-window height and correcting it on the first layout event. This prevents a second small vertical shift independently of removing the guest opening flight.

## Group picker/invite and FX reference — code 18

Inspect/capture `chooseGroup`, `inviteModal`, `generateInvite`, `fxPanel`, `fxDetails` and `renderSettlements` from current main in a local browser with fictional Casa/RON two-person data. Match the group photos/type/member count/active indicator, Create group button and owner-only Details/Invite footer. Invitation generation is a separate explicit action after the original warning; the result step uses the original title, selectable link, expiry, WhatsApp and Copy controls. Names and link tokens stay opaque. Use the existing bounded native Sheet rather than reproducing Safari system widgets.

FX uses the original title/intro, summary/toggle, pending status, white rounded transfer cards, target amount with the original smaller amount beneath, disclosure and lavender panel. Keep the original base-currency button, localized ISO/name options excluding base, loading/retry/refresh, `1 target = rate base`, dated quote/source metadata and original-currency disclaimer. Rates shown in this detail are presentation only; money is still converted by the existing validated integer routines and revalidated at confirmation.
