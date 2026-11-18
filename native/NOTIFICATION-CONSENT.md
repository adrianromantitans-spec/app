# Android notification opt-in — 18 November 2026

Candidate `1.2.0-native.14` / code `20`, based on main `a769dad` (PR 25).

## Behavior

After signed-in startup/opening, offer notifications once on a foreground, idle screen, provided the existing native push service reports enabled. Never interrupt another sheet, recovery/sign-in, the opening or an operation. Existing opted-in users and denied/unknown permission states are not automatically prompted.

The localized sheet reuses the website's ES/EN/RO text, existing purple/white buttons and native Sheet. Opening it does not request OS permission or obtain/register a token. Activate invokes the existing Android permission bridge; Android 13+ can show POST_NOTIFICATIONS. Earlier Android versions use the explicit app-level opt-in without an unsupported OS permission dialog. Registration and binding require a grant and the same authenticated account throughout.

Not now, close/Back and rejection do not automatically prompt again. A persistent installation-wide marker survives reload/logout/account changes; explicit enable/disable also records the choice. The normal Account → Notifications entry remains available. Denied permission displays the existing phone-settings explanation and settings button. Server/token failure remains retryable; no successful opt-in is shown before registration/binding finishes.

## Files

- `src/NotificationConsent.js` (new): foreground/startup eligibility hook and shared offer/manual-settings panel.
- `src/App.js`: invoke the hook after startup; show the offer title/panel using the existing Sheet and settings route.
- `src/session.mjs`: permission status, persistent offer marker and eligibility; guard every async enable stage against account/recovery changes and return explicit success. Disable/logout preserve the recorded device choice.
- `tests/notification-consent.test.mjs` (new): six behavioral tests of persistence, no implicit registration, disabled/denied/recovery gates, stale account replies, grant/denial and explicit retry.
- `tests/auth-entry.test.mjs`: its isolated renderer loads the actual new consent module rather than treating its hook as a generic component stub.
- `native-config.json`, `package.json`, `package-lock.json`: version/code only; no dependency changes.
- This report.

No Java/manifest/SDK, Firebase/Supabase configuration, website/iPhone, financial, animation or layout changes beyond the notification panel. Existing POST_NOTIFICATIONS and FCM setup are reused. Existing opted-in background sync remains intact.

## Validation

112 native tests pass. External native-JSX browser fixtures verify ES/EN/RO offer timing after opening, no OS call before Activate, Not now + reload persistence, manual settings opt-in, and a bounded small-screen panel with both buttons visible. Grant, denial/settings, already enabled, service disabled, guest and previously blocked cases are simulated with intercepted permission/token/cloud calls. No real messages or production registrations are sent by these tests.

Android release build and original upload-certificate signing pass; lint 0 errors / 21 unchanged warnings. Bundletool validates com.divzplit.app, code 20/name .14, bundled fonts/Hermes and 16 KB alignment of all 13 ARM64 libraries.

AAB: `divzplit-1.2.0-native.14.aab`, 34,757,134 bytes.
SHA-256: `25139cbc0b90a7b6e82a69cfa6241a557538ffcc2bf90ccae3fe96d928d17217`.

## Real Android check

No phone/emulator is attached. Install/update through the existing Play testing track. On Android 13+, accept and reject the real system dialog; check cold/warm startup, background/foreground, close/Back and that the offer never repeats. Check an already blocked/allowed installation, Android 12 or earlier explicit app-level activation, device settings return, service unavailable/offline retry and account switching. Confirm actual FCM reception with an authorized test event; browser fixtures and a signed build do not prove provider delivery. No backend deployment or new Play/Firebase configuration is required.

No automatic source merge or Google Play upload is performed.
