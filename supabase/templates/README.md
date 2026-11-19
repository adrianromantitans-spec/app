# Signup confirmation by email code

Web/iPhone and Android now keep the user on a code-entry screen after email signup. `POST /auth/v1/verify` with `type: signup` confirms the email and returns the session, without asking for the password again. The client accepts only a confirmed user matching the pending email. Recovery codes remain a separate flow. No passwords or codes are stored for this step. Previously sent confirmation links still confirm email, but require an explicit password sign-in.

**Required production step:** GitHub merge/AAB upload do not update emails stored in Supabase.

1. Open **Authentication → Email → Templates → Confirm signup** in the existing Supabase project.
2. Paste the complete [confirm-signup.html](confirm-signup.html) into the body.
3. Set the subject below and save. Keep email confirmations enabled, the current SMTP/Resend settings, and the existing expiry/rate limits. No SQL migration or Firebase change is needed.

```gotemplate
{{ if eq .Data.language "ro" }}DivZplit — Confirmă contul cu acest cod{{ else if eq .Data.language "es" }}DivZplit — Código para confirmar tu cuenta{{ else }}DivZplit — Confirm your account with this code{{ end }}
```

The template must contain `{{ .Token }}`, not `{{ .TokenHash }}`. Do not add a `{{ .ConfirmationURL }}` button: this flow verifies the code inside the app. It supports numeric codes of 6–10 digits and uses the account’s saved language (ES/RO/EN, English fallback). Resends are available after one minute and are also subject to Supabase limits. Wrong/expired codes keep the form open for retry. Existing accounts receive Supabase’s generic signup response; the app does not disclose whether an address exists. Existing users can return to normal sign-in.

Deploy both web and Android code and save this template before inviting new users. Emails already sent are not rewritten. On a real device, create a test account, switch to the mail app, return and paste the code: the confirmed session should open DivZplit without another password. Also test wrong/expired code, resend after a minute, and an existing account. Automated checks use fixtures and send no email.

# Password recovery by email code

The app verifies a recovery OTP through Supabase Auth (`POST /auth/v1/verify`, `type: recovery`). It never treats an unverified code as a recovery session. Existing PKCE recovery links remain supported for previously sent emails.

Production email templates are stored in Supabase, independently of GitHub Pages. To enable code emails:

1. Open the project's **Authentication → Email → Templates → Reset password** (in some dashboard versions: **Authentication → Email Templates**).
2. Set the subject to the localized template below.
3. Paste the complete contents of [reset-password.html](reset-password.html) into the body and save.

The template uses `{{ .Token }}` for the actual recovery code and renders only the account’s saved language (`.Data.language`): Spanish, Romanian, or English as fallback. Do not replace it with `{{ .TokenHash }}` or add `{{ .ConfirmationURL }}`. Keep the existing expiry and rate-limit settings; the app accepts numeric codes of 6–10 digits. No database migration or new credentials are needed.

Validation requires a real recovery request after saving the template. Automated tests only use local fixtures and do not send email.

Localized subject (paste this into the subject field):

```gotemplate
{{ if eq .Data.language "ro" }}DivZplit — Cod de recuperare{{ else if eq .Data.language "es" }}DivZplit — Código de recuperación{{ else }}DivZplit — Recovery code{{ end }}
```

Language follows the account metadata, matching the confirmation email template. Accounts without a saved language use English. A device-only language selection does not change existing account metadata. The email uses the reference design’s light background, white card, purple accent and a lavender code panel. Some email clients may still apply their own dark-mode adjustments.
