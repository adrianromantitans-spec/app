# Initial download hints

The application entry now declares `modulepreload` hints for its existing 24 static modules and a preconnection to the existing Supabase origin. URLs match the current imports, so the browser reuses the downloads. No new scripts, API calls, account data caches, changes to authentication or reordered application operations are introduced. Module execution still starts through the original module script. Startup animation files and durations are unchanged.

The change addresses discovery waterfalls before the app can render its logo. It does not eliminate backend latency for a signed-in account: session restoration, groups and activity still use the original sequence and guards.

Validation on Chromium with an isolated fictional account, cold cache, 180 ms simulated latency and 250 KB/s download throughput:

| Fixture | Previous entry | With hints |
| --- | ---: | ---: |
| Guest ready | 4.35 s | 4.07 s |
| Signed-in ready | 4.35 s | 4.08 s |

These are local measurements with reduced motion to isolate loading from the existing animation, not a guarantee for a physical device or production account. No browser errors or duplicate module downloads occurred. Runtime source and animation files match commit `1259aee`; only HTML network hints changed. `tests/loading_ui_invariants.py` verifies all original behavior with the previous presentation changes accounted for. Measurement script/log: `/workspace/scratch/divzplit-startup-94/profile.py` and `profile.log`.

## iPhone/Safari logo handoff

The subsequent auth-transition update keeps the original letter/Z keyframes, colors,
1539 ms hold, 1161 ms flight/fade and final header position. The flight uses a single
composited transform with frozen text metrics, instead of animating `left`, `top`,
`font-size` and `letter-spacing`. `glass.css` now hints only `transform` for that
temporary wordmark. The actual header remains sharp and takes over at cleanup.

Continuous target polling is replaced with batched layout/DOM/viewport change
notifications. Retargeting preserves the current visual transform, avoiding a jump
when Safari's viewport moves; cleanup disconnects observers and listeners.

In a local 393 px comparison, a stationary 200 ms sample measured 24 target geometry
reads with the previous module and zero with the correction. This is evidence of
removed main-thread work, not an FPS guarantee on a physical iPhone.

`tests/auth_intro_motion_browser.py` checks Chromium and WebKit at 320, 393, 440,
768 and 1440 px for welcome, login and registration. It verifies transform-only
flight, stable font/layout properties, subpixel final alignment, retarget continuity,
DOM replacement, reduced motion, cleanup and usable controls. Run against the local
server with `NEXO_URL=http://127.0.0.1:3050/app/`; set `NEXO_BROWSER=webkit` for Safari's
engine. Full shared/web and 125 native tests also pass. Physical iPhone/PWA testing
is still needed to assess frame pacing on the user's device.

Deploy the web change through the existing process. App entry, transition and CSS
versions are refreshed. No Android AAB, native opening animation, account flow or
expense/group behavior changes in this update.
