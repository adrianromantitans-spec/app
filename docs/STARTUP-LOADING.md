# Initial download hints

The application entry now declares `modulepreload` hints for its existing 24 static modules and a preconnection to the existing Supabase origin. URLs match the current imports, so the browser reuses the downloads. No new scripts, API calls, account data caches, changes to authentication or reordered application operations are introduced. Module execution still starts through the original module script. Startup animation files and durations are unchanged.

The change addresses discovery waterfalls before the app can render its logo. It does not eliminate backend latency for a signed-in account: session restoration, groups and activity still use the original sequence and guards.

Validation on Chromium with an isolated fictional account, cold cache, 180 ms simulated latency and 250 KB/s download throughput:

| Fixture | Previous entry | With hints |
| --- | ---: | ---: |
| Guest ready | 4.35 s | 4.07 s |
| Signed-in ready | 4.35 s | 4.08 s |

These are local measurements with reduced motion to isolate loading from the existing animation, not a guarantee for a physical device or production account. No browser errors or duplicate module downloads occurred. Runtime source and animation files match commit `1259aee`; only HTML network hints changed. `tests/loading_ui_invariants.py` verifies all original behavior with the previous presentation changes accounted for. Measurement script/log: `/workspace/scratch/divzplit-startup-94/profile.py` and `profile.log`.
