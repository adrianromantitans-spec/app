# Mobile dock effects

Baseline: production commit `4ce0c50957f5ecbcd2580c246c8b55bcede70a0e`.

Only the two approved video effects are added:

- A magnifying glass lens follows a horizontal drag on the existing dock. Releasing over a control clicks that original control once; an ordinary tap still uses the original click handler.
- Real content scrolling contracts the dock around the existing central add button. The dock expands after 280 ms without further scrolling. The add button remains available. The viewport's height changes from mobile browser chrome do not reset a scrolling dock.

`dock-effects.js` is an independent presentation module. It observes the existing rendered dock; it does not import or change application state, navigation, authentication, translations, calculations or Supabase. Its transient magnifying copy is inert, hidden from accessibility APIs and contains no functional buttons or action attributes. A canceled drag does not navigate. The module yields to the original page-edge drawer gesture outside the bar.

`dock-effects.css` applies only to the mobile dock. The original JavaScript and stylesheets remain byte-identical. With reduced motion enabled the dock stays expanded and the lens is disabled. Keyboard focus expands the controls; desktop retains the existing sidebar. Opening a modal or changing pages removes/rebuilds the transient effect layer.

Changed production files:

- New `dock-effects.js` and `dock-effects.css`.
- `app/index.html`: include those two resources.
- `server.mjs`: allow serving those resources locally.

The landing page, screenshots, startup assets, original application code, database and configuration are unchanged.

Validation:

- Full unit tests and original syntax checks passed; `node --check dock-effects.js` passed.
- `tests/dock_effects_invariants.py`: 70 original JS/CSS/manifest files, app entry and landing preserved after normalizing only the two resource inclusions and static allowlist entries.
- `tests/dock_effects_browser.py`: resting screenshot matches the original pixel for pixel; one drag produces one route; lens semantics, compact/expanded states, add menu, expense form, keyboard, cancellation, reduced motion and viewport changes pass in Spanish, English and Romanian.
- `tests/dock_touch_browser.py`: native Chromium touch events verify horizontal selection, vertical panning/inertia, idle restoration and an ordinary add-button tap.
- `tests/dock_intro_browser.py`: identical startup keyframes, timing, fonts and target coordinates for guests and signed-in sessions at mobile and desktop sizes.
- Existing 111-surface translation audit passed. Existing responsive functional suite passed using the current edge-swipe menu on mobile and original sidebar on desktop; no production data or emails are used.

These are automated Chromium checks, including touch emulation; a physical iPhone/Android test was not performed in this workspace.
