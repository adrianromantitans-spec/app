# Google OAuth preflight: original design and findings

**Current implementation and activation guide: [Trusted Google registration broker](GOOGLE-BROKER.md).**
The broker is now implemented with server-owned Google OAuth, one-use verifier/flow
binding and guards for both user creation and identity enrollment. It remains
inactive pending manual configuration and staging acceptance. The material below
describes the original preflight and its limitations; use the broker guide for
current deployment, native support and rollback instructions.


Status: implementation only; nothing deployed or activated. Browser preflight is **disabled** in public `config.js`. No Auth Hook is registered by `supabase/config.toml`; SQL initially sets policy mode to `observe`. The public Site Key is configured; the Secret Key has not been requested, received, or committed.

## Existing architecture and findings

This repository serves browser ES modules through `server.mjs`/GitHub Pages. There is no root Vite dependency or React web build; the separate `native/` app uses React Native. Preserve this architecture.

`cloud.js` is a small Supabase REST client. Google starts at `/auth/v1/authorize` with a locally generated PKCE S256 challenge; the verifier and legal consent stay in tab storage. The provider callback remains `https://xvtqmmpufvmyuokpmjvf.supabase.co/auth/v1/callback`. DivZplit's allowed return remains `https://divzplit.com/`; `landing-route.js` forwards the callback to `/app/`, where the verifier is exchanged and `/auth/v1/user` confirms identity. The existing root/legacy bridge checks remain intact. Pending group invitations are not auto-accepted by signin.

Legacy Android TWA uses the same browser flow. Current React Native Android opens the existing provider in an external browser and returns through App Links. The preflight itself does not import a DOM widget into native code. The new [broker implementation](GOOGLE-BROKER.md) adds a prepared external-browser flow for updated native clients. Existing enrolled Google identities retain legacy login; new enrollment requires the updated client after enforcement.

A read-only query of the public Auth settings during investigation showed Google and email enabled, anonymous users and Apple disabled, email confirmation enabled and new signups allowed. Private CAPTCHA/Hook settings and secrets are not exposed by that endpoint and have not been inspected or changed. `supabase/config.toml` does not establish the full production dashboard configuration.

## Security boundary: preflight does NOT protect direct OAuth signup

The documented Before User Created payload contains a candidate user and request metadata (request UUID/time/name/IP). It does **not** provide the app's PKCE challenge, OAuth state, Turnstile token, browser cookie, or verified app-flow authorization. Supabase owns the provider state. In the inspected upstream Auth implementation, the external callback invokes the hook with a candidate user after deciding to create an account; the PKCE flow state is not part of the hook JSON. Existing account login/linking bypasses the new-user creation hook.

Therefore the standard flow cannot reliably consume a short-lived, one-time CAPTCHA authorization bound to *that* signup. PKCE protects the code exchange, not user creation: a caller can invoke Supabase OAuth directly and reach creation without using this app. A verified preflight URL, a browser `captcha_verified` flag, a request-supplied email, a recent IP match, an email pattern, or `user_metadata` is not trustworthy proof. Do not infer a match by searching private `auth.flow_state` tables by IP/time. Do not pass a grant in `redirect_to` and assume the hook receives or attests it.

**No such fake grant is issued or accepted here.** Token reservation below protects the preflight endpoint from replay; it is not an Auth entitlement. CORS is browser isolation, not authentication, and the Site Key/publishable key are public.

### Safest feasible server restriction with this architecture

The optional Postgres hook `public.divzplit_before_user_created` can be manually placed in `block_new_google` mode. It rejects **every new Google-created account**, even direct OAuth/ID-token attempts; it does not pretend to allow CAPTCHA-approved Google signup. Existing Google users retain normal login because Auth only invokes this hook for account creation. The policy uses Auth-owned `app_metadata.provider`, not user-editable metadata or email heuristics. Only Supabase Auth can execute it; clients cannot edit the private policy.

This is a deliberate signup pause, not transparent CAPTCHA protection. Approved new users need a trusted administrator-created/invited account and a tested identity-linking path. Do not present the existing unprotected email signup as a secure way around this policy. The hook leaves email/Apple policies unchanged; it is not a global signup firewall. For an emergency global registration pause, Supabase's **Allow new users to sign up** setting can be disabled manually, but that broader product restriction is not performed here.

If frictionless new Google signup with compulsory Turnstile is required, use a trusted OAuth broker: it must own Google state/nonce/PKCE and callback processing, verify Google's issuer/audience/signature/subject, bind the challenge to a server-created flow, and hold a short-lived random authorization in private storage. User creation must occur exclusively through that trusted server path; a registered Auth hook would atomically consume a server-authenticated authorization bound to flow, verified provider subject and intended user ID, rejecting missing/expired/reused/mismatched authorizations. Direct Supabase provider creation must remain denied. A browser flag, user metadata or unverified email must never substitute for that server proof. This requires a reviewed broker/admin-creation contract and Google/client/callback changes, not just another frontend flag; the [broker implementation](GOOGLE-BROKER.md) now supplies that contract using trusted Admin creation and a one-use identity-enrollment guard. It is implemented but **not deployed or activated**.

## What is implemented

- Optional Turnstile managed challenge inside the existing Google consent modal. The widget is lazy-loaded only after consent/age validation. It uses compact, light, interaction-only presentation and ES/EN/RO copy. It does not alter opening animations, existing fields, legal consent or provider redirects. Disabled mode loads no Cloudflare script and preserves the original flow.
- `oauth-protection.js` binds widget `cData` to the existing PKCE challenge. The browser sends token, challenge and fixed redirect to the Edge Function before navigating. Failure remains on the modal; retry generates a fresh flow. Cancel removes the widget and pending verifier record. Only the exact original authorize URL can be accepted from the server. Apple/recovery flows are not gated.
- `oauth-turnstile` Edge Function calls the fixed HTTPS Cloudflare Siteverify endpoint using `TURNSTILE_SECRET_KEY` from server secrets. It requires successful proof, exact allowlisted hostname, action `google_oauth`, matching `cdata` and a timestamp within five minutes (30-second future clock tolerance). It limits JSON to 8 KiB and tokens to 2,048 characters, restricts CORS and return URLs, uses timeouts/no-store, and returns generic error codes without secrets.
- Service-only SQL atomically reserves a SHA-256 token digest for six minutes *before* Siteverify, so concurrent replay cannot rely on Cloudflare's eventually-consistent duplicate detection. A per-flow digest bucket permits six attempts per minute. Private tables have RLS/no client access; raw tokens, verifiers, IPs and identities are not stored. Bounded cleanup removes expired records on subsequent requests.
- The separate optional Auth Hook starts in observation mode and can log observed or blocked Google creation without PII. It is not registered/activated automatically. Spoofed user metadata cannot satisfy it.

## Monitoring and rate-limit limits

Edge logs contain only `oauth_preflight`, a fixed outcome code, random request ID and elapsed milliseconds. Monitor `verified`, `challenge_invalid`, `challenge_reused`, `rate_limited`, `verification_unavailable` and configuration errors. Do not add tokens, bodies, authorization headers, full URLs, emails, verifiers or secrets to logs. Postgres emits fixed `divzplit_oauth_policy` observation/block log lines. Inspect Supabase Auth/Audit logs to detect direct signup attempts; a rise in Google creation without corresponding preflight successes indicates bypass but is not itself proof about an individual user.

The six-per-minute limit is per flow, **not per person/IP**. Attackers can rotate flows and public origins can be forged by non-browser callers. These controls prevent replay/accidental repeat verification; they are not a distributed-bot or cost firewall. This implementation does not trust arbitrary `X-Forwarded-For`/`CF-Connecting-IP` as an identity and does not bind signup authorization to IP (mobile/NAT changes are legitimate). Use provider/platform abuse controls, alerts, and a verified trusted gateway/edge rate limiter before expanding public traffic. A proxy-only WAF is insufficient if the public Supabase origin remains directly reachable. Do not impose a low shared NAT/global limit that denies legitimate existing users.

## Manual staging and deployment

1. Create/use a staging Supabase project and Google client first. Use an isolated staging copy of the public `cloudConfig.url`/publishable key and return URL. Keep production redirects/provider settings and existing clients unchanged. Use a managed Turnstile widget; restrict its allowed hostnames in Cloudflare. Production widget keys should not allow localhost. Real hostname/action/cdata checks require real staging keys; dummy tokens alone do not validate production integration.
2. Review/apply `supabase/oauth-abuse.sql` **in staging first**. It creates private storage/functions with `observe` mode; it does not register an Auth Hook. Do not configure the preflight Edge Function URL as an Auth Hook.
3. Copy `supabase/functions/oauth-turnstile/.env.example` to an ignored local `.env.oauth` and privately populate `TURNSTILE_SECRET_KEY`. Use exact allowlists for staging/production. Never put the Secret Key in `config.js`, `VITE_*`, GitHub, a browser request or this chat. The service-role key stays in the Edge runtime and is never sent to clients.
4. Manually set secrets and deploy **only** the preflight function when ready. Commands below are instructions, not actions performed by this change:

```sh
supabase secrets set --env-file .env.oauth --project-ref YOUR_STAGING_PROJECT_REF
supabase functions deploy oauth-turnstile --project-ref YOUR_STAGING_PROJECT_REF
```

5. Test the real widget/backend in staging, then choose whether to enable the **bypassable preflight** in `config.js` (`cloudConfig.oauthProtection.enabled=true`). Update the public Site Key for the environment. Deploy/reload the web app; the app entry/script CSP allows only the required Cloudflare challenge origin, without `unsafe-eval`. Preflight outages fail closed for that enabled app flow. Disabling it is an explicit operational rollback, not an automatic fallback. The Secret Key is never used for this public setting.
6. Separately review the signup policy. To test observation, select **Authentication → Hooks → Before User Created → Postgres function → public.divzplit_before_user_created** in staging. Registration of this hook is manual. Keep `observe` during initial compatibility testing.
7. **Only if you deliberately want to pause new Google registrations**, manually set the policy in staging and repeat all acceptance tests. Production activation must be a separate explicit operational decision:

```sql
update divzplit_security.oauth_policy set mode='block_new_google' where id;
```

8. Rollback: return mode to `observe` or disable the Hook in the dashboard to restore Google creation. Independently set public preflight `enabled:false` to restore the previous browser flow. Do not remove shared auth/users/groups or rotate existing signing/Google credentials for this feature.

Do not enable Supabase's project-wide CAPTCHA toggle as part of this change. It affects other Auth endpoints and requires compatible token submission from **all** email/login/recovery clients, including released Android binaries; it is not established here as a reliable way to bind the existing redirect-based Google signup to the new preflight.

## Tests and acceptance

Automated (no Google/Cloudflare/Supabase production writes or email):

```sh
npm run check
npm test
cd native && npm test
# Disposable local Postgres container only; see test module header.
npm run test:oauth-database
# Existing dev server + Playwright/Chromium:
NEXO_URL=http://127.0.0.1:3045/app/ python tests/oauth_turnstile_browser.py
# Deno tooling, if available:
deno check --config supabase/functions/deno.json supabase/functions/oauth-turnstile/index.ts
```

The focused tests cover Siteverify failure/mismatched context, age, replay/concurrency, body bounds, return-URL substitution, server outages, limits, cancellation and localized messages. Local PostgreSQL tests cover permissions, mode defaults/idempotence, concurrent one-use reservations, cleanup, limits, forged metadata and policy rollback. Browser fixtures exercise disabled legacy flow and full successful PKCE return, rejection/outage/rate/expiry/cancel/tampered-return cases in ES/EN/RO. The older `tests/auth_browser.py` top-level scenario predates the current welcome screen and fails its initial login-heading assumption; the new test reuses only its transport/PKCE fixture and validates the current UI.

Required manual staging tests:

- Real valid/invalid/expired/reused Turnstile proof; wrong hostname/action/cdata; script blocked/offline; cancel and retry; phone-sized interactive challenge.
- Existing Google accounts on desktop, iPhone PWA, Android Chrome/TWA and released native Android; root/App Links, pending invite and session restore remain correct. Also test existing verified email accounts linking Google according to actual project linking configuration.
- Without the optional block policy, direct `/authorize` can still create a user: this is an expected demonstrated limitation, not a passing security claim.
- With the optional block policy, new Google users must be denied via both the app and direct provider/ID-token flows, even after passing Turnstile or forging metadata; existing Google logins must succeed. Email/Apple behavior is unchanged. Tests against local SQL do not prove hosted Auth integration or provider credentials.
- Validate observer/block logs and restore `observe` to prove rollback. Confirm limits do not penalize shared networks/mobile IP changes. Private dashboard hook settings, actual Google/Cloudflare credentials and physical devices require owner-led acceptance.

## File map and verified results

- `app.js`, `oauth-protection.js`, `account.css`, `app/index.html`: opt-in Google challenge orchestration, cancellation, localized UI, minimal widget styling, entry version and CSP.
- `config.js`: public Site Key and disabled browser flag; no secret.
- `server.mjs`: serve the added browser module through the existing architecture.
- `supabase/functions/oauth-turnstile/{index.ts,verify.mjs,.env.example}`: server-only configuration, bounded verification handler and blank secret setup template.
- `supabase/oauth-abuse.sql`, `supabase/config.toml`: manual private proof storage/rate limits and optional policy function; public pre-login Edge Function declaration. No registered Hook or enabled CAPTCHA setting.
- `tests/oauth-turnstile.test.mjs`, `tests/oauth_abuse_database.py`, `tests/oauth_turnstile_browser.py`, `package.json`: focused security/UI tests and normal commands.
- This document and `docs/SOCIAL-LOGIN.md`: findings, activation/rollback and honest scope.

Verified locally: syntax checks and the full shared/web npm suite; eleven focused preflight tests; 122 native tests; 24 browser mode/language cases; real disposable PostgreSQL idempotence/permission/concurrency/policy tests; Deno type checking of the Edge entry. No production write, provider account creation, email, Cloudflare proof consumption, secret setup, Hook activation or deployment was performed. Google/TWA/App Links/real interactive challenge acceptance remains a staging/device test.

## Sources checked

- [Supabase Before User Created hook: input and timing](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Supabase Auth hook implementation](https://github.com/supabase/auth/blob/master/internal/api/hooks.go) and [external provider state](https://github.com/supabase/auth/blob/master/internal/api/external.go) and [ID-token creation path](https://github.com/supabase/auth/blob/master/internal/api/token_oidc.go)
- [Supabase CAPTCHA integration](https://supabase.com/docs/guides/auth/auth-captcha), [general signup settings](https://supabase.com/docs/guides/auth/general-configuration), [Auth audit logs](https://supabase.com/docs/guides/auth/audit-logs)
- [Cloudflare Siteverify and token handling](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [widget configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/), [testing limitations](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
