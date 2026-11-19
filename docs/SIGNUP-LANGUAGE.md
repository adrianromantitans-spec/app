# Signup interface language — 19 November 2026

## Reproduced issue

A returning web/iPhone user can load the new signup code screen while the browser reuses `i18n.js?v=language-90` from before the code-flow release. That cached module imports the previous translation catalogue: existing labels such as “Verify code” translate, while new signup instructions and title fall back to Spanish. This was reproduced using the actual signup page and locally intercepted old module responses; no real account/email was used.

## Fix

Refresh the versioned imports of the shared locale module and its transitive importers together, so all app modules use `i18n.js?v=signup-locale-2`. Refresh the application entry URL and align its module preloads with the actual graph, including the newer translation catalogue. Only JavaScript import URLs and HTML module URLs change in production files; translations, UI layout, account/session logic, persisted preferences, user data and animations are unchanged.

Production files: `app/index.html`; `app.js`, `auth-ui.js`, `cloud.js`, `legal.js`, `model.js`, `home.js`, `settlement-plan.js`, `planning.js`, `extras.js`, `fx.js`, `help.js`, `notifications.js`, `receipt-ui.js`, `receipt-crop.js`, `activity-ui.js`, `activity-overview.js`.

Tests: `tests/signup-language.test.mjs` checks the canonical import graph/preloads, ES/EN/RO signup copy and shared Cloud cooldown language after changing the selected language. It is included by `package.json`. `scripts/check-signup-language.py` exercises the actual web signup with stale-cache fixtures in all three languages at 360×640 and 1280×850, covering signup, localized title/cooldown/invalid-code errors, retry and direct signin. All API calls are intercepted and use fictional data.

## Validation and release

`npm run check`, the complete web/shared test suite and all 122 native tests pass. The browser regression script passes six locale/viewport combinations, including with legacy cache responses available.

Merge and deploy the web change, then reload an already-open browser/PWA. No Supabase email-template edit or database migration is needed. No new Android AAB is required for this browser-cache correction: the existing .18/code 24 native bundle already embeds the complete signup translations, and Metro strips URL query versions when resolving shared modules. Physical device acceptance and real mail delivery are not certified by local browser fixtures.
