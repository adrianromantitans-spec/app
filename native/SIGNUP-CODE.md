# Signup verification code — 19 November 2026

Candidate: `1.2.0-native.18`, code `24`, package `com.divzplit.app`. Existing React Native architecture and upload signing identity are retained.

After email/password registration, web/iPhone and Android present a numeric email-code field. Verifying the signup OTP confirms the email and accepts the matching confirmed Supabase session without submitting the password again. This does not change password login, OAuth or password recovery. Signup OTPs use `type: signup`; recovery keeps `type: recovery`.

## Changed files

- `cloud.js`: pending-email context without credentials, strict OTP format, confirmed-email/session validation, stale-request/account-switch rejection, signup resend with a 60-second cooldown and server rate-limit handling; clear context on logout.
- `app.js`: dedicated signup-code page, delegated submit/resend/error handling and existing `connectAccount()` after verification; no confirmation-link modal.
- `app/index.html`, `i18n.js`: updated asset references for the new client/catalog.
- `translations.js`: new signup instructions/errors in English and Romanian; Spanish source copy retained.
- `native/src/session.mjs`: registration result and signup verification/resend controller actions, existing session persistence and group loading.
- `native/src/App.js`: signup-code mode, fixed pending email, OTP autofill/numeric input, retry/resend/change-email controls; clear the password after registration.
- `supabase/templates/confirm-signup.html`: branded localized `.Token` panel replaces the button and fallback confirmation URL.
- `supabase/templates/README.md`: exact **Confirm signup** dashboard installation instructions, subject, sequencing and physical acceptance steps. This repository cannot update the live Supabase template.
- `tests/signup-code.test.mjs`, `native/tests/session.test.mjs`, `native/tests/auth-entry.test.mjs`, `package.json`: API/security/identity/rate-limit tests, actual native Auth handler rendering and controller integration; include shared tests in the normal command.
- `native/package.json`, `native/package-lock.json`, `native/native-config.json`: candidate version only; no added dependencies.
- This report documents the release and validation limits.

## Validation

- `npm run check` and the complete shared/web `npm test` suite pass, including six new signup-code tests.
- `cd native && npm test`: 122 passing tests, including actual Auth submit handlers, pending-email display and removal of the password field after registration.
- Browser fixtures exercise the actual web application at 360×640 and 1280×850 in ES/EN/RO: registration, cooldown, invalid code, retry and direct signed-in group screen. They send no email and use only fictional accounts.
- Actual native JSX rendered in an external React Native Web harness exercises code entry/errors/direct signin. This is a UI simulation, not a physical Android test.

## Required release steps

Merge/deploy the source change, save the **Confirm signup** template in Supabase as documented, and upload code 24 to the existing Google Play testing track. Keep email confirmation enabled. Existing sent emails are not rewritten. No SQL, Firebase or Resend credentials change is required.

On physical Android and iPhone/web, create a test account, switch to the email app and return to paste the code. Verify direct signin, resend/expiry and normal login for an existing account. If the app process or browser page is closed/reloaded during signup, the in-memory code-entry context is lost: restart registration or use normal login after confirming through a previously sent link. Do not claim live delivery or device acceptance from fixtures alone.
