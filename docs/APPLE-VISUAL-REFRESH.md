# DivZplit visual refresh

## Scope and baseline

Implemented against production commit `89c74f1ac6d364a263c31f2604c04bf32dcc0c1b` in an isolated worktree. Earlier uncommitted startup work in the original checkout was not included.

The reference video supplies visual direction only. The actual application keeps its purple balance card, original labels, translations, fields, actions and state. Rounded grouped surfaces, spacing, shadows and existing form controls are styled by an additional CSS layer. The correction following version 85 matches the video layout: four bottom destinations (Home, Plans, Activity, Account), three home actions (Add expense, Shopping, Vote), a larger group heading, compact purple balance and bottom-aligned expense sheet. These controls reuse the existing delegated handlers. The full original drawer retains every route and the desktop sidebar stays available. Existing greeting copy remains below recent expenses; the original general quick-add control remains available separately.

Application JavaScript changes are restricted to visual templates: additional existing-action buttons, four-tab presentation, actual member avatars/names and decorative SVG icons. No event handler, state mutation, navigation implementation, authentication, Supabase code, database schema, original stylesheet, startup effect or transition was changed. The new stylesheet contains no animation, transition or transform overrides and does not style the startup or authentication screens. Current language settings, account deletion/export, recovery codes and native date/currency controls remain intact.

## Changed files

- `refined.css`: scoped application presentation layer.
- `app/index.html`: one additional stylesheet link and visual resource revisions.
- `app.js`: the presentation-only template additions listed above; all existing handlers and calculations are unchanged.
- `translations.js`: two new labels (Plans and Vote), translated into English and Romanian; all original translations remain.
- `server.mjs`: allow the local server to serve that stylesheet.
- `scripts/capture-landing.py`: capture the existing current inline tasks/polls and collapsed currency panel.
- `assets/landing/`: 45 actual application views/crops in Spanish, English and Romanian, each at 1x and 2x WebP, plus the share image and capture manifest.
- `assets/welcome-es.png`, `assets/welcome-en.png`, `assets/welcome-ro.png`: matching real application captures.
- `landing.js`, `scripts/build-landing.mjs`: image resource revision strings only.
- `index.html`: generated image references and matching image dimensions/metadata. Existing landing sections, words, links, phone frames and behavior are preserved.
- `tests/visual_refresh_browser.py`, `tests/visual_refresh_intro_browser.py`, `tests/visual_refresh_invariants.py`: visual interaction, startup comparison and source-preservation checks.
- This document.

Captures render the real application with isolated fictional fixture data, not invented screens or live personal data. Full phone views preserve the existing 393 x 852 proportions. Responsive WebP sources preserve the landing's existing loading and frame presentation.

## Verification

Passed `npm run check` and the full `npm test` suite, plus:

- Responsive application flows at 320, 393, 430, 768, 1024 and 1440 pixels: registration, groups, expense create/edit/delete, shopping checkout, tasks, polls, budget and account language.
- Existing usability, account-language and recovery-code/receipt browser suites, including Spanish, English and Romanian where applicable.
- New visual browser checks: purple balance card, four recent expense rows, existing dock and drawer actions, account contact/export/delete/language, tasks, polls, shopping and budget.
- Runtime startup comparison with and without the added stylesheet: guest and authenticated sessions at 393 and 1440 pixels. Letter keyframes, effect timing, fonts and final target coordinates match.
- Source invariants: all 69 existing JavaScript/CSS/manifest files preserve their original contents after normalizing the exact presentation-only template additions, two translated labels, server allowlist and resource revisions. The app entry differs only by its visual stylesheet link and resource revision.
- Landing structural parity: same sections, text, links, frames and script structure after normalizing only updated image resources and crop dimensions.
- Existing landing browser suite: three languages, responsive controls, image decoding, reduced motion, language links, no-JavaScript fallback and no backend calls.

Browser verification uses Chromium with phone-sized viewports; it is not a physical iPhone or Android device test. No production database writes were made. A separate MP4 demonstration records the implemented application, including the purple card, using the same isolated fixture data.
