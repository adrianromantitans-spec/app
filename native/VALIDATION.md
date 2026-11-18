# Group selector/invitations and FX view — 18 November 2026

Base: `63fd3f9` (main after PR 23). Candidate `1.2.0-native.12`, Android code `18`.

## Every modified file

- `src/GroupSheets.js` (new): group photos, type/member detail, selection and owner-only Details/Invite footer. Invitation explanation, explicit generation, separate result title, selectable URL, expiry/use notices, Copy/WhatsApp/Close and existing revocation confirmation. No invite is created merely by opening a panel; copy/share reuse the same generated result. Current group/account/owner gates remain active while sharing.
- `src/invitation-view.mjs` (new): validate the existing server token/expiry result and build the canonical divzplit.com/app/#invite URL; localize the share template with opaque user names/tokens.
- `src/session.mjs`: explicit owner-only createInvite uses the existing nexo_create_invite RPC, checks account/group/owner before returning a late result and never copies automatically. Retain the prior invite API as a guarded compatibility wrapper. No backend policy change.
- `android/app/src/main/java/com/divzplit/app/DivZplitModule.java`: user-triggered shareWhatsApp text/plain Intent, regular WhatsApp then Business, with a fixed HTTPS wa.me Custom Tabs fallback. Opens recipient/compose; never chooses a recipient or sends automatically. Existing OAuth external method is untouched; no SDK/permission changes.
- `src/App.js`: picker/Invite result steps, current-group editor action, same invitation panel from quick add/group settings; reference settlement title and reset to original currency on opening. Stale opening requests cannot switch to another group.
- `src/QuickAdd.js`: owner-only invitation entry routes to the shared panel, not immediate generation/copy.
- `src/FeatureScreens.js`: group settings use that same invitation entry. Settlement summary/toggle/pending status, white transfer cards, converted and original values, disclosure and currency panel follow the reference. Continue using existing settlementData/paymentQuote/onPayment guards; handle a removed group safely.
- `src/CurrencyPanel.js` (new): original-currency reset, localized target ISO/name options excluding base, loading/error/retry/refresh, source/date/rate detail and reference disclaimer. Keep newer quote selections when older reads fail. No monetary arithmetic/writes here.
- `src/fx-view.mjs` (new): presentation-only valid cross-rate (1 target = rate base), quote dates/source and localized currency names. Monetary conversion remains in the existing integer routines.
- `src/localization.mjs`: ES/EN/RO invitation template, original-currency label and new error copy; user values remain opaque.
- `tests/features.test.mjs`: explicit invite generation, owner guard, malformed/expired result rejection, no implicit copy and late account/group rejection.
- `tests/group-fx-view.test.mjs` (new): opaque/localized WhatsApp message, canonical link, cross-rate direction/date/mixed sources, unchanged monetary units and hidden invalid/pending/expired/foreign-group metadata.
- `native-config.json`, `package.json`, `package-lock.json`: .12/code 18; unchanged dependency set and identity.
- README, DESIGN-REFERENCE, DEVICE-TESTS and this report: reference/evidence/physical checklist.

Only native/ changes. No website/database/schema/configuration changes, new dependencies or new Android permissions. Expense/balance arithmetic, quote validation and payment confirmation code remain unchanged.

## Completed checks

- **106 native tests pass**, including all prior financial/session, FX expiry/replaced quote, pending reservation, group-loading, receipt, auth-crash and UI-motion regressions.
- Current-main original mobile-web picker, invite/result/WhatsApp and FX views captured locally with matching fictional Casa/RON data. Compare to actual native JSX browser fixtures; this is not a physical iPhone/Android screenshot comparison.
- ES/EN/RO actual JSX fixtures pass: picker -> explicit Invite -> one generation -> Copy and WhatsApp reuse the exact URL; generation does not occur on open. Currency selection displays 1 USD = 4 RON for the supplied test rates, converted plus original values, and original-currency reset. Balances are identical before/after conversion. Picker excludes the original currency. Fixture callbacks intercept all invitation, copy, share and quote operations; no live invitations/messages/payments are sent.
- Edge fixtures pass: member cannot see Invite; small/keyboard-sized generated sheet stays bounded; secure WhatsApp URL fallback; FX failure disables payment, retry restores detail, stale previous-currency failure does not overwrite current results; removing the active group closes conversion without an error.
- Final source-frozen release build, Android Java bridge compilation, lint and signing pass. Native src + Java aggregate SHA-256: `9be1e63fc33022098ddc8ccefbfea92a7e288aca839d5461485b1e3896586d5a`.
- Lint: **0 errors, 21 unchanged warnings**. Original upload certificate verified against android/upload-certificate.pem; jarsigner verification passes. Existing com.divzplit.app preserved.
- Bundletool 1.18.3 validation passes; manifest code 18/name 1.2.0-native.12/MainActivity, Hermes/fonts and all 13 ARM64 ELF libraries' LOAD alignment at least 16 KB confirmed.

## Signed AAB

`native/android/app/build/outputs/review/divzplit-1.2.0-native.12.aab`

- Bytes: `34755538`
- SHA-256: `d5f32a65947379e96c8d67c03837f45b5f054abbe11f18b3a15bb084d40502d9`

Upload to the same Play testing track and update without clearing data. No Firebase/Supabase/Google/Play signing changes or backend deployment are required. Merging source alone does not update native UI/bridge code.

## Device acceptance still required

No Android phone/emulator is attached. Confirm actual WhatsApp/Business/no-app Intent routing, compose/cancel/back and clipboard, real owner/member invitation use/revocation and real quote/service/payment confirmation, small/large-font/keyboard/inset behavior. A native build and browser dispatch fixture do not prove those OS/provider interactions. Existing code 17 Google completion and startup checks remain applicable.

No automatic source merge, website deployment or Play upload has been performed.
