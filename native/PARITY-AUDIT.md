# Android / web parity and performance audit — 19 November 2026

Base main c56d673 (merged PR 28). Candidate 1.2.0-native.17 / code 23. No Android phone/emulator is attached (`adb devices` has no devices). This is a source, automated behavior, fixture-rendering and signed-release review, not physical Android frame-time certification.

## Findings corrected

1. **Last content hidden behind the dock with a large bottom system inset.** At a simulated 320×568 / 64px bottom inset, the final expense ended at y=447 while the dock began at y=406. Fixed the shared tracked vertical scroll wrapper to preserve existing padding while reserving system inset + dock offset 26 + height 72 + gap 16. The same row now ends at y=389, above y=406. Home expense and Account logout checked with bottom insets 0/24/48/64. Untracked/auth, horizontal and modal scrollers retain original spacing; larger custom padding is not reduced.
2. **Automatic refresh could begin while a user scroll was active.** Add a read-only drag/momentum signal to the existing scroll state machine and make the existing 30-second foreground poll skip while dragging, coasting, busy, showing the opening or a sheet. It reads the committed current route/gesture context without restarting the interval on route changes and resumes at a later normal idle poll. Pull-to-refresh, explicit actions and foreground refresh remain available. This removes avoidable background API/state work during scrolling; it is not an FPS claim.

Keep existing animation curves, durations, fonts, purple/white surfaces, opaque dock, icon geometry, auth, backend and financial calculations. No dependency, Java/manifest/permission/signing changes. No website source changes.

## Verification matrix

| Area | Completed checks | Limit |
| --- | --- | --- |
| Native behavior | **119 tests pass**: original 116 plus active-scroll gating and actual tracked-wrapper inset/isolation regression tests | Host-free native graphs/controllers do not render a physical phone |
| Shared/web | Root `npm test` and `npm run check` pass | Not a complete live-account/provider acceptance test |
| Server functions/data | All 11 database suites + native push database suite pass in a disposable PostgreSQL 17 container with networking disabled; container removed afterward | No production database or external delivery provider used |
| UI and localization | Actual native JSX fixtures: 11 routes × 7 viewports × ES/EN/RO, no page errors or horizontal document overflow; home amount/currency order retained | Viewports are browser fixtures, not a fleet of Android devices |
| Viewports | 320×568, 360×640, 393×852, 430×932, 600×960, 768×1024, landscape 740×360; separate 0/24/48/64 bottom-inset checks | Real cutouts, Android display/font scale and IME still need hardware |
| Forms | Expense detail/edit/advanced options, category emoji, exact save payload, + task/poll/group/shopping/expense routes, empty account, help | No real camera/OCR/file-picker/provider interaction |
| Loading/language | ES/EN/RO read failure/retry, no false empty group list, language switching and localized email example | Live network interruption/recovery still needs acceptance |
| Motion/navigation | Card/SVG bounds, circular selector with intermediate samples, compact/idle dock, reduced motion and screen-reader fixture, guest logo static, signed-in opening retained | No physical optical/frame-pacing or TalkBack gesture measurement |
| Stress | 24 interrupted route transitions + orientation + sheet entry at browser CPU throttle 4×; no JS errors or account/balance mutation | Synthetic RNWeb stress, **not Android FPS benchmarking** |
| Auth/notifications | Welcome/login Google consent fixture, notification offer after intro, allow/deny/manual settings/dismissal persistence, blocked/enabled/service-off/guest cases | Real Google/Apple return, OS permission dialog and FCM reception unverified here |
| Sharing/FX | Current brand icons, localized same-token sharing/copy and neutral preview, owner/changed-account guards; rates/sources/dates/original reset/failure/retry/stale reply/group-loss guards | Real social apps/cache/clipboard and a two-account payment require phone acceptance |
| Financial/server | Exact-cent splits/rounding, pending reservation/confirmation/cancellation, concurrent writes, trusted FX/expiry, invitations/revocation, tasks/polls/reminders, atomic shopping, notification isolation, privacy/export/deletion | Disposable fictional data only; no real payments, messages or production writes |

The historical forced CSS 150% font experiment is not Android fontScale and is not counted as passing native large-font visual acceptance. Test actual system font/display scaling (including 130/200%), narrow screens, keyboard and TalkBack before general release.

## Animation/performance assessment

- Opening glyph assembly/handoff, page entrances, sheet slide/fade and dock selection use native-driven transform/opacity graphs; existing tests check their actual graph compatibility and cancellation.
- The dock's SVG width/radius/layout morph remains **JS-driven**, isolated from the native selector to prevent the previously fixed mixed-driver crash. A blanket switch to `useNativeDriver: true` would be unsupported. No visual redesign or speculative animation rewrite was made during this audit.
- No artificial 60/120 Hz animation loop or forced display refresh was added. The OS/device settings select actual refresh behavior. Browser timing and release compilation cannot prove stable 60/120 fps on every GPU/CPU, thermal/battery state or dataset size.
- New polling guards reduce concurrent JS/API/state work during gestures. Actual jank attribution, large-list performance, startup times, memory/thermal behavior and long-session leaks require release-mode Android profiling on representative low/mid/high-end devices.
- Native system splash, IME, dialogs and Safari/iPhone rendering differ by platform. This audit verifies tested design/function parity; it does not certify pixel identity with Safari or perfect performance on every phone. The Android dock stays opaque as explicitly requested previously.

## Files changed

- src/DockScroll.js: inset-aware bottom clearance only for tracked vertical lists, preserving caller styles/scroll forwarding.
- src/dock-motion.mjs: read-only interaction state; no animation timing/geometry changes.
- src/App.js: existing automatic poll guarded by current dock interaction/opening/sheet/busy state.
- tests/dock-insets.test.mjs (new), tests/dock-motion.test.mjs: behavior/spacing regressions; tests/dock-native-driver.test.mjs updates its isolated safe-area/style boundary mock for the new hook.
- native-config.json, package.json, package-lock.json: version/code only.
- README, DEVICE-TESTS and this report: current validation and physical checklist.

## Physical release acceptance

Use the existing `DEVICE-TESTS.md` checklist on release builds: small/large Android, gesture + three-button navigation, notch/insets, font/display scales, actual keyboard and Back; low-end 60 Hz and capable 120 Hz, battery saver/thermal conditions, rapid interrupted navigation and long lists. Record real frame times/jank and memory, not only a visual impression. Test real Google/Apple return, social-app routing, camera/OCR, FCM foreground/background/killed state and a disposable two-account workflow. These are remaining verification gates, not automatically confirmed by the build.

No automatic merge, website deployment, Play upload or production data access was performed.

## Signed release validation

Final release build and signing with the existing upload certificate/package com.divzplit.app passed. Lint: 0 errors / 21 unchanged warnings. Bundletool confirms code 23/name 1.2.0-native.17, bundled Hermes/fonts and 16 KB LOAD alignment of all 13 ARM64 libraries.

AAB: divzplit-1.2.0-native.17.aab, 34,762,850 bytes.
SHA-256: aa513bd1ee2b3574bc7593f678b24ba99c316ab6b5af076a504f9f1300058194.

Merge the source review and upload the signed AAB to the existing restricted Play testing track; update without clearing data. No backend/Firebase/Google/signing change or website deployment is needed for these native fixes. General release remains subject to physical acceptance above.
