# Password recovery by email code

The app verifies a recovery OTP through Supabase Auth (`POST /auth/v1/verify`, `type: recovery`). It never treats an unverified code as a recovery session. Existing PKCE recovery links remain supported for previously sent emails.

Production email templates are stored in Supabase, independently of GitHub Pages. To enable code emails:

1. Open the project's **Authentication → Email → Templates → Reset password** (in some dashboard versions: **Authentication → Email Templates**).
2. Set the subject to `DivZplit — Código / Code / Cod`.
3. Paste the complete contents of [reset-password.html](reset-password.html) into the body and save.

The template uses `{{ .Token }}` for the actual recovery code and contains Spanish, English and Romanian instructions. Do not replace it with `{{ .TokenHash }}` or add `{{ .ConfirmationURL }}`. Keep the existing expiry and rate-limit settings; the app accepts numeric codes of 6–10 digits. No database migration or new credentials are needed.

Validation requires a real recovery request after saving the template. Automated tests only use local fixtures and do not send email.
