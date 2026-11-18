# Android regression review — 18 November 2026

Candidate: `1.2.0-native.13`, code `19`. Base: main `8b97891`, after PR 24.

## Change requested

`src/ReferenceScreens.js` now always renders the home balance currency after the number, including RON in English. Digits/grouping remain localized and the value is unchanged. No changes to financial calculations, conversion, the bar, colors, animation timelines, authentication, backend or web/iPhone files. The other changed application files are package/package-lock/native-config release metadata only; this report records the review.

## Automated scope

- Native suite: 106 tests covering authenticated sessions/account isolation, group loading/retries, expense payloads and split modes, pending payments, conversion expiry/rounding/stale replies, invitations/owner gates, receipt transport and opening/dock/sheet/page animation graphs.
- Root shared/web `npm test` and `npm run check`: passed. Covers model/splits, settlements, home, FX, planning, shopping, auth email language, i18n, privacy, notifications, receipts, cloud contract and installed UI behavior.
- All 11 `test:database` suites and `test:native-database` passed against a disposable PostgreSQL 17 container with networking disabled. Covers server permissions/RLS, all split modes and exact-cent balances, concurrent/stale saves, task/poll editing/voting/reminders, shopping checkout/idempotency, pending-payment confirmation/cancellation, invitation rotation/expiry/revocation, trusted cross-currency quotes, notification preferences/leases and account-scoped export/deletion. No production database was accessed.
- Actual native JSX in an external browser-only fixture: 11 routes × 7 viewport sizes × ES/EN/RO. Sizes: 320×568, 360×640, 393×852, 430×932, 600×960, 768×1024 and landscape 740×360. No document horizontal overflow or page errors; home RON follows the amount in every locale. The fixture uses fictional data and intercepted native/cloud calls; it does not ship with the app.
- UI flow checks: expense detail/edit, help, + task/poll/group/shopping/expense routes, advanced expense options and unchanged save payload. Existing no-group and load-error/retry states, language switching and localized email examples are covered.
- Motion/access checks: home card and vector background dimensions, dock compact/idle expansion, circular moving selector, reduced motion/TalkBack fixture, static signed-out logo, retained signed-in opening, Google consent from welcome/login and opaque dock pixels. These establish behavior/animation graphs, not physical frame pacing.
- Group-picker invitations, explicit generation/copy/WhatsApp reuse, owner restrictions, currency presentation/reset/retry/stale responses and lost-group safety are rechecked without sending messages or writing production data.

## Limits that require real Android acceptance

No phone/emulator is attached. Browser bounds and release compilation cannot certify every device, real Android IME/fontScale/insets/rotation, TalkBack gestures or 60/120 Hz frame pacing. A forced CSS 150% font override is not Android fontScale and produces cramped text in the fixture; it is not counted as passing large-font visual acceptance. Check actual large-text settings on hardware before public rollout.

Also test real Google/Apple browser return, WhatsApp/Business/no-app routing, camera/OCR/photo permissions, clipboard, FCM foreground/background/killed-app delivery, offline/resume, and a disposable end-to-end two-account payment. Local/server tests do not establish delivery through Google/FCM/WhatsApp or production connectivity. No test invitation, payment or email was sent to a real user.

The existing `DEVICE-TESTS.md` remains the full hardware checklist. No automatic source merge, production deployment or Play upload is performed.

## Release validation

Android release build/signing passed with the existing upload certificate and unchanged `com.divzplit.app`. Lint: 0 errors, 21 existing warnings. Bundletool validation and 16 KB LOAD alignment for all 13 ARM64 libraries passed; manifest version code/name and bundled Hermes/fonts checked.

Signed file: `divzplit-1.2.0-native.13.aab` (34,755,553 bytes).
SHA-256: `b1e7d18edba2495760860199d470cb592677ecdc6110cd06501d99d38fa274f8`.

Upload to the same Play testing track and update without clearing data. No backend/Firebase/Google/signing configuration change is needed. Merging source alone does not update the installed app.
