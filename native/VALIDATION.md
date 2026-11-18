# Groups, languages and circular dock — 18 November 2026

Base: `cf84457` (main after PR 18). Candidate `1.2.0-native.7`, Android version code `13`.

## Cause of the missing groups

The shared browser Cloud client sends `cache: 'no-store'`. React Native's installed `whatwg-fetch` implementation turns that option into a synthetic `_=timestamp` query parameter on GET/HEAD. PostgREST interprets it as a filter and rejects the request with HTTP 400 / PGRST100. Auth endpoints can still work, while the groups/history REST queries fail. This explains why a signed-in account can show a generic connection error instead of its existing groups.

The regression uses the actual installed whatwg-fetch Request implementation: the prior options mutate the URL, while the corrected adapter preserves the groups query, Authorization/apikey headers, cancellation, JSON and receipt bytes. A separate read-only public-key probe with the malformed query returned HTTP 400 / PGRST100 from the live service. Its Python-urllib log was explicitly identified to the owner as our diagnostic probe, not an Android-device trace. No production account/session was used, no private group data was fetched and no backend writes were performed.

`src/receipt-transport.mjs` now removes the problematic native cache option and sends `Cache-Control: no-store` / `Pragma: no-cache` headers instead. The API URL and cache prevention are retained. Browser Cloud behavior, server permissions and database schema are unchanged.

## File-by-file changes

- `src/session.mjs`: distinct loading, confirmed-empty and failure states; Retry diagnostics without tokens/user data; same-account data retention on read failure; account-change isolation; server groups become usable before recurrence writes; failed optional recurrence saves retain the server snapshot and show a warning; no unconfirmed generated charges or selection changes. Connect native-only localization/member/template helpers.
- `src/localization.mjs`: shared catalog plus native UI/error supplement for ES/EN/RO; known already-translated errors can follow a subsequent language change. Email examples and self labels adapt; user content is never looked up for translation.
- `src/App.js`: localized email example, close controls, notices/errors, task/poll summaries and selections; explicit group load/retry/support states. Dock capsule 72/36 px, add button 52/26 px and active marker 34/17 px with matching SVG/view clipping.
- `src/ReferenceScreens.js`: translated member labels/templates; group/home pull-to-refresh reflects the actual read state. Existing user titles/group/member names remain opaque.
- `src/FeatureScreens.js`: localized viewer names and error/FX displays.
- `src/receipt-transport.mjs`: native cache/URL fix described above; byte handling unchanged.
- `tests/native-fetch.test.mjs`: actual RN Request mutation reproduction and corrected shared Cloud REST/headers/receipt contract.
- `tests/group-loading.test.mjs`: initial/background failure and retry, confirmed empty, recurrence failure/early visibility, selection and account isolation, safe diagnostics, real shared Cloud group mapping.
- `tests/localization.test.mjs`: source catalog completeness, placeholders, known error re-localization, opaque user names/template values and persisted language/auto-detection restart.
- `tests/session.test.mjs`: keep the simulated server snapshot independent of client state, which is cleared on an account change; retain the original recurrence/coalescing/authorization assertions.
- `native-config.json`, `package.json`, `package-lock.json`: version .7 / code 13, no dependency changes.
- `README.md`, `DEVICE-TESTS.md`, `DESIGN-REFERENCE.md`, `VALIDATION.md`: current scope, evidence, circular dimensions and physical acceptance.

The code 12 startup/driver correction and original opening animation source/timings remain unchanged. All changed source/assets are under native/. No website, backend, signing key, Firebase/Supabase settings or production data changes.

## Passed checks

- `npm test --prefix native`: 73 passing tests, including all previous startup, financial concurrency, permissions, account/session, receipts, collaboration, FX, recovery and feature checks.
- Development-only actual native JSX/browser fixture checks: failed initial read shows Retry instead of Create, retry loads existing fixture groups, all ES/EN/RO variants, live language changes, localized email example, no uncaught JS errors or horizontal document overflow. At 320/393/430 px the rendered add control and dock have exactly half-width/half-height corner radii. Separate multi-route preview checks pass. This is not an Android renderer/device test; no preview dependency ships in the app.
- Final Metro/Hermes production bundle, Java/Kotlin/C++ release compilation, R8 and AAB generation pass. `lintRelease`: 0 errors, 19 existing warnings; no new suppression/baseline.
- Existing upload certificate comparison and jarsigner verification pass. Normal self-signed/no-timestamp upload-certificate notices remain.
- Bundletool 1.18.3 validates the final signed AAB. Manifest: com.divzplit.app, code 13, version 1.2.0-native.7, minimum API 24 / target API 36, native MainActivity.
- Offline Hermes bundle and existing fonts/assets are present. All 13 ARM64 shared libraries retain at least 16 KB ELF LOAD alignment.
- Git diff/whitespace checks pass.

Final signed artifact:

```
divzplit-1.2.0-native.7.aab
bytes: 34734548
SHA-256: 6ff30fdfb13e55b3e00eaf826fdf08e971f63c1c028e27574015d49875794533
```

## Physical acceptance remains

No phone/emulator is attached. Update code 12 to 13 through the existing Play testing track without uninstalling or clearing data. Compare real existing groups and balances with the website using the same account, exercise history/notifications/receipts, ES/EN/RO and round dock, then follow the code 13 section in DEVICE-TESTS.md. Tests establish the request and state-management fixes; the owner's real account/device load still requires confirmation after installation. All broader real-device startup, OAuth, camera, FCM and performance gates remain.

This change does not merge itself, deploy the website or publish a Google Play release. Do not recreate groups or change backend permissions for this client-side request defect.
