# Localized invitation sharing — 19 November 2026

Base main `110fe40` (after PR 26). Android candidate `1.2.0-native.15`, code `21`.

## Result

New invitations use `https://divzplit.com/share/#invite=<token>`. The static crawler response contains only the DivZplit brand: title/Open Graph/Twitter title `DivZplit`, empty descriptions and brand-only body. It has no Spanish slogan, marketing description or image. The recipient is redirected to the existing `/app/#invite=` flow; installed Android accepts `/share/` through the existing verified host. Root and /app/ invitation links remain supported. Existing expiration, member limits, revocation and explicit generation are unchanged. Sharing/copying never generates another token.

The token remains in the fragment, not the HTTP request/query. The redirect accepts only the original lower-case 64-character token and a fixed local target. It does not fetch a group, identify its members, render private group details or accept an external redirect.

Web and native share the same four recognizable vector icon paths: WhatsApp, Telegram, Instagram and Snapchat. Icon buttons have accessible service names. All use a complete invitation sentence with the sender's selected ES/EN/RO language and opaque group name. Web no longer translates two sentence fragments independently.

WhatsApp uses its existing native compose/Business/browser fallback; Telegram uses Android's text sharing target (including Telegram X), or the standard HTTPS share URL on web. Instagram/Snapchat are not guaranteed text DM targets: Android tries the installed package with ACTION_SEND, preserving a clipboard copy for manual paste, and falls back to Android's chooser if unsupported/missing. Web copies the message and offers the system share sheet if supported; otherwise the copied text can be pasted in a chat. No Story image, fake DM deep link, new SDK, account connection or automatic sending is introduced. Telegram fallback on Android also uses the chooser/copy path.

## Files

- `invitation-share.js` (new): canonical neutral link, complete localized message, service icon/name/color definitions and safe WhatsApp/Telegram URLs.
- `share/index.html`, `share/redirect.js` (new): public brand-only preview and fixed validated fragment redirect.
- `server.mjs`: serve the new public files and /share/ slash route in the existing local server.
- `app.js`: generate neutral links, complete localized messages, icon links/buttons, guarded system sharing/copy fallback. Separate `data-share-group` avoids the existing group-selection click handler.
- `app/index.html`: update app.js import/preload cache version.
- `translations.js`: ES/EN/RO fallback notices.
- `native/src/GroupSheets.js`: four 52px accessible icon buttons, existing Copy link and localized manual-paste feedback.
- `native/src/invitation-view.mjs`: new generated link uses the shared helper.
- `native/src/session.mjs`: accept /share/ while retaining existing root/app link handling.
- `native/src/localization.mjs`: native fallback messages.
- `native/android/app/src/main/java/com/divzplit/app/DivZplitModule.java`: allowlisted Telegram/Instagram/Snapchat user-triggered text Intent with clipboard/chooser fallback; existing WhatsApp implementation remains.
- `native/tests/invitation-sharing.test.mjs` (new): four tests of neutral token URLs, identical native/web localization, URL encoding/service targets, existing/new native links, metadata and validated fixed redirects.
- `native/tests/features.test.mjs`: expected new generated URL; legacy join test remains.
- `native/native-config.json`, `native/package.json`, `native/package-lock.json`: version/code only; dependencies unchanged.

No auth/provider/signing/Firebase/Supabase/financial/animation changes. Group invitations still require existing account/owner checks. Preview metadata intentionally excludes group names; they appear only in the sender's explicitly shared message.

## Checks

116 native tests pass. Root shared/web tests and syntax checks pass. Actual native JSX browser fixtures and current website fixtures pass in ES/EN/RO: all four icon controls, same token and complete localized group message, no extra generation, WhatsApp/Telegram encoding, Instagram/Snapchat share payload and clipboard fallback. Native fixture checked at 320px width; website at the existing mobile reference viewport. Public preview tested without JavaScript as a crawler; real redirect preserves the token while HTTP requests exclude it. No real invitations, messages or production writes were made.

No Android phone/emulator is attached. Real WhatsApp preview rendering/cache, installed/missing Telegram/Instagram/Snapchat routing, clipboard/compose/cancel/Back and recipient App Link handling require phone acceptance. Browser dispatch fixtures do not prove delivery or platform-specific text support. Old messages/previews can remain cached; only newly generated links use the new /share/ preview.

## Deployment order

Merge/review the website changes through the existing Pages process first. Confirm `https://divzplit.com/share/` returns 200 with the brand-only HTML and that a test invitation opens the existing join flow. Then upload the new signed AAB to the existing Play test track and update without clearing data. Do not upload a native bundle generating /share/ links before those public files are deployed, or browser recipients will see 404. No backend migration/new signing key is required.

No automatic source merge, website deployment or Play upload is performed.

## Signed Android artifact

Release build/signing passed with the existing upload certificate and com.divzplit.app. Lint: 0 errors, 21 existing warnings. Bundletool manifest/version, fonts/Hermes and 16 KB LOAD alignment of all 13 ARM64 libraries pass.

- File: `divzplit-1.2.0-native.15.aab` / code 21.
- Bytes: `34759380`.
- SHA-256: `80955463ac0a7e9310bd77c843911a153e9ec29b2cfdd58124e26d5b2f285980`.
