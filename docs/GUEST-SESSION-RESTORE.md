# Guest launch and rejected saved sessions — 19 November 2026

## Problem and result

The shared client mapped every HTTP 403 to “You do not have access to this group”, including Supabase Auth failures while restoring a saved session before displaying login. Rejected sessions could remain saved and repeat the warning on subsequent launches.

An Auth-rejected saved session now returns a clean signed-out result. Its local credentials are removed, no group requests run and the existing login form remains usable. Auth failures during explicit signin use session-specific messages; invalid/expired OTPs retain their code-specific messages. Real group permission failures still display their group error and do not discard a valid account. Network/5xx failures remain visible and retain saved credentials for retry.

## Files

- `cloud.js`: distinguish Auth errors from group permissions; clear rejected user/refresh sessions; silently handle only definitive saved-session rejections during restore. Do not suppress transient failures or group errors.
- `app.js`, `app/index.html`: refresh the client/entry URLs and matching preloads so returning web/PWA users receive the corrected client. Preserve the shared locale module version.
- `tests/cloud.test.mjs`: fresh guest makes no protected requests; rejected user/refresh sessions clear and do not retry on next restore; temporary failures retain credentials; explicit signin, actual group permissions and invalid OTPs remain distinguishable.
- `scripts/check-guest-session.py`: real web UI with intercepted local fixtures, eight startup/error scenarios in ES/EN/RO, including successful password login after rejected-session cleanup. No live accounts, email or database writes.
- This report records the cause and validation scope.

## Checks and release

`npm run check`, full web/shared suite (including 42 Cloud tests), 122 native tests, and 24 browser scenario/language combinations pass. Local fixtures cover no session, Auth user 401/403, refresh 400/403, network/500, and actual group 403. Native production code and Android version remain unchanged; the shared-client fix will also be included in a future native build.

Merge/deploy the web PR and reopen the PWA/browser. No Supabase SQL, email template, permissions or credential change is required. There is no new AAB in this web-focused fix. Physical Android behavior is not certified by the browser fixtures.
