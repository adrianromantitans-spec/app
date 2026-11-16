# Translation audit — revision 90

The app now loads the translation catalog through a new, consistent module revision. Every application module that imports the language engine shares the same URL, avoiding a stale catalog or two independent language states after an update. Existing startup modules, styles and Supabase configuration are unchanged.

The member summary now uses the existing localized `memberName()` helper for the current user: `Tú`, `You`, `Tu`. Other member names remain their stored names. The four-tab bar is checked for `Planes`, `Plans`, `Planuri`.

Updated the actual English/Romanian application captures and welcome images so their self labels match the rendered interface. Landing structure, copy and behavior are preserved; only image resource revisions change.

Validation:

- Full `npm test` and syntax checks passed.
- `tests/translation_audit_browser.py`: 111 rendered app/auth surfaces across Spanish, English and Romanian, including lists, forms, split modes, currency, notifications, account, help, login and registration. Checks visible copy, accessible labels, the self label and a single fresh language/catalog module graph. Uses local fictional transport only.
- `tests/account_language_browser.py`: language changes without reload/sign-out, persistence, URL overrides, fallback, money formatting and the Plans label.
- `tests/recovery_code_receipt_browser.py`: expired codes, resend, password change and photo-picker labels in three languages.
- Original intro comparison passed for guests and signed-in sessions at mobile and desktop sizes: same keyframes, timing, font metrics and final coordinates.
- Existing landing browser suite passed in all three languages, including image decoding and mobile layouts.

The browser checks run in Chromium; they do not represent a physical-device test. User-written group names, titles and member names are not treated as interface translations.
