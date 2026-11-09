# Loading presentation

This change replaces initial content-loading paragraphs with accessible skeletons in shopping, activity, notifications, exchange quotes and receipt previews. Background refreshes retain existing content and display a small header indicator. Selected existing submit and action buttons display a spinner while their original handler runs. Existing errors and confirmations remain available.

`loading-ui.js` and `loading-ui.css` contain the presentation helpers. The hooks in `app.js` and `notifications.js` preserve the existing handlers, request guards, payloads, validation, navigation and state. Buttons are not newly disabled. Short timers control visual feedback only. Reduced-motion preferences are respected. No startup or dock animation files, existing styles, translations, landing assets, backend or database files changed.

## Validation

- `npm test`, `npm run check`, `node --check loading-ui.js`.
- `python3 tests/loading_ui_invariants.py`: removing the audited presentation hooks restores the baseline application and notification source exactly; verifies the other runtime/style/manifest files and landing remain unchanged.
- `NEXO_URL=http://127.0.0.1:3063/app/ python3 tests/loading_ui_browser.py`: isolated browser fixtures cover slow loads, retained background data, stale responses, errors, retry, original save payloads and duplicate-submit protection in Spanish, English and Romanian. Completed home matches the baseline screenshot pixel for pixel.
- Existing translation audit: 111 surfaces across the three languages.
- Existing responsive suite, adapted in memory to the current drawer entry and local port: routes at six widths, registration, currency/group creation, native controls, expense add/edit/delete, tasks, voting, shopping checkout, budget and account language.
- Existing dock suite: drag, scroll collapse/restore, central action, keyboard, cancellation, reduced motion and resize.
- Startup comparison against baseline `75753eedf31102a6b2cacf548a98b062dd861bcd`: unchanged keyframes, timings, font sizes and target coordinates for guest and signed-in fixtures at mobile and desktop widths.

All checks passed in Chromium with local fictional data; no production account or database writes were performed. Physical iOS and Android devices were not tested. Validation logs and screenshots are local task artifacts under `/workspace/scratch/divzplit-loading-92/` and `/workspace/preview/loading-92/`.
