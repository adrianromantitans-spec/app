# DivZplit Android test candidate

Version 1.2.0-native.19 / code 25. Package com.divzplit.app.
Source: https://github.com/adrianromantitans-spec/app/commit/c321d7e247f61a7bccb132a31b951086d1664db7

Fixes Supabase-required Turnstile CAPTCHA for email signup, password login, recovery and resend. Publish the source web change including /auth-challenge/ BEFORE installing this AAB. 125 native tests, shared/web checks, 30 Chromium and 12 WebKit browser cases pass. Signed release build/lint, bundletool and signature validation passed. No real device, real CAPTCHA proof or email delivery test was performed; final acceptance is required. Existing upload signature preserved. No Supabase setting or Google-broker activation is performed.
This AAB must be uploaded to the existing Google Play testing track; it cannot be installed by opening the file on a phone. Real Android design/animation/auth/notifications acceptance remains required.

Bytes: 34765865
SHA-256: e8a90e3e9dbd672a1ded1267d1951240674f3253bc1ff86e979c246b072cbb32

No source/main changes or Play upload are performed by this download branch.
