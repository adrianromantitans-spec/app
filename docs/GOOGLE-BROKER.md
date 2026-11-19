# Trusted Google registration: implementation and manual activation

The broker is implemented. It is **not deployed or active**. `googleBroker.enabled`
in public `config.js` and the example `GOOGLE_BROKER_ENABLED` secret default to
false. No restrictive Auth Hook, policy change, CAPTCHA setting, credential change,
or production deployment was performed. The public Turnstile Site Key is configured;
the private keys must be entered by the owner directly in Supabase.

## What changes and what stays compatible

The standard Supabase Before User Created hook does not receive the app PKCE
challenge, Google state, or Turnstile proof. It cannot safely match a browser grant
to that registration. Existing-account linking also bypasses that hook. Consequently
the earlier preflight alone cannot stop direct Supabase OAuth signup.

This implementation uses an explicit alternative: a server-owned Google code flow,
plus manual database guards for user creation **and Google identity enrollment**.
The optional existing Before User Created hook remains available for an early,
friendly rejection; it is not used as a fictional source of flow binding and is
not automatically registered. No grant in browser metadata or email pattern is
trusted. CORS and the public keys are not authentication.

When manually enabled:

1. The app creates its own S256 verifier/challenge. Turnstile binds `cdata` to that
   challenge, action `google_oauth`, the allowlisted hostname and a recent timestamp.
   The backend reserves a digest before calling Cloudflare Siteverify.
2. `google-broker/begin` creates a private ten-minute flow with independent Google
   state, nonce and server PKCE. The app saves the returned flow ID before leaving.
3. Google returns to the Edge Function. The server consumes state once, exchanges
   the code with the Google client secret/server verifier, and verifies Google's
   RS256 signature, issuer, audience, expiry, nonce, authorized party, verified email
   and access-token hash when present. `jose` is pinned to 6.2.17 in the Deno lockfile.
4. The callback stores encrypted credentials and returns only a random completion
   code and flow ID. **No account/session is created on this GET callback.**
5. The original app sends its verifier, code, saved flow ID and original return URL
   over HTTPS POST. SQL atomically claims that exact flow and a ninety-second,
   one-use completion. Injected callbacks from other initiated flows are rejected.
6. A private authorization identifies the verified Google subject and intended
   Supabase UUID. Existing identities take precedence. For a genuinely new account,
   a short provisioning lease coordinates concurrent requests for that same subject;
   the Admin API creates only that intended UUID, without confirming email or
   changing an existing account. Supabase's normal verified-ID-token login performs
   identity linking/confirmation and issues the ordinary session.
7. A trigger on `auth.identities` consumes the authorization at Google enrollment,
   matching subject, intended UUID and expiry. Another trigger rejects public
   new Google user creation. Thus both direct signup and email-precreation followed
   by Google linking are denied without authorization. Only established, unchanged
   Google identities bypass the enrollment check for normal login updates.

Google tokens, raw state and server verifier are AES-256-GCM encrypted with the flow
UUID as authenticated context. Completion wipes credentials; bounded subsequent
request cleanup wipes expired contexts and removes old flows/leases. State/ticket/
completion values are stored as digests. No provider token or Supabase session is
returned in a URL. Existing group data and accepted invitations are not modified.

The backend refuses to start or complete if the actual database guards/policy are
inactive. A missing configuration fails closed; it never silently falls back to
unprotected registration. Email signup, Apple and recovery keep their existing paths.

## Required owner configuration — staging first

Use an isolated Supabase staging project, Google OAuth **Web application** client,
Turnstile widget and staging return origin. Keep production settings intact until
all acceptance cases below pass. This change adds triggers to Supabase-managed Auth
tables: review/test against the hosted Auth version and repeat after Auth upgrades.
No local SQL fixture can certify the hosted provider/linking contract.

1. Review/apply `supabase/oauth-abuse.sql`, then `supabase/google-broker.sql` in the
   staging SQL Editor. These files preserve the existing policy mode and do not
   register a hook. On a fresh policy the mode is `observe`. **If your policy is
   already `block_new_google`, installing the guards enforces it immediately.**
   Set/verify `observe` explicitly in staging before installing if needed.
2. In Google Cloud → Google Auth Platform → Clients → the Web client used by the
   Supabase Google provider, add this authorized redirect URI:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-broker/callback
   ```

   Preserve the original `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   for existing clients. Copy the same Web client ID/secret into server secrets.
   Keep that client enabled in Supabase's Google provider. Native uses this Web
   client through a real browser; do not substitute an Android client ID/secret.
3. In Cloudflare, allow the exact staging hostname on the managed Turnstile widget.
   Production uses `divzplit.com` and public Site Key
   `0x4AAAAAAGIzOswUgGy61ea9`. Use separate staging keys/allowlists.
4. In Supabase → Edge Functions → Secrets, privately configure:

   | Secret | Required value |
   | --- | --- |
   | `GOOGLE_BROKER_CLIENT_ID` | Google Web OAuth client ID |
   | `GOOGLE_BROKER_CLIENT_SECRET` | The matching Google Web OAuth secret |
   | `GOOGLE_BROKER_ENCRYPTION_KEY` | 32 random bytes encoded as 43 base64url characters |
   | `TURNSTILE_SECRET_KEY` | Cloudflare widget Secret Key |
   | `TURNSTILE_ALLOWED_ORIGINS` | JSON array, e.g. `["https://divzplit.com"]` |
   | `TURNSTILE_ALLOWED_HOSTNAMES` | JSON array, e.g. `["divzplit.com"]` |
   | `TURNSTILE_REDIRECT_URLS` | JSON array, e.g. `["https://divzplit.com/"]` |
   | `GOOGLE_BROKER_ENABLED` | Initially `false`; manually `true` for acceptance |

   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Edge
   runtime. Never copy the service key, client secret, encryption key or Turnstile
   secret into browser/native config, `VITE_*`, GitHub or chat. The encryption key
   must remain stable across workers; rotating it invalidates pending flows.
   Generate it locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`
   and enter it directly into secrets. An ignored `.env.google-broker` can be copied
   from the blank example for CLI setup; never commit its filled contents.
5. Deploy manually, with the project explicitly selected:

   ```sh
   supabase secrets set --env-file .env.google-broker --project-ref YOUR_STAGING_PROJECT_REF
   supabase functions deploy google-broker --project-ref YOUR_STAGING_PROJECT_REF
   ```

   The function verifies Cloudflare directly through the shared server module;
   deploying `oauth-turnstile` separately is unnecessary for the broker. Public
   pre-login JWT verification is disabled for this function in `config.toml`;
   possession of a publishable key is not accepted as signup authorization.
6. Deploy the web assets, including `google-login/`, with
   `cloudConfig.googleBroker.enabled=true` in staging and the correct environment's
   public URL/key/Site Key. This forces Turnstile for broker login even if the older
   `oauthProtection.enabled` preflight flag is false. Do not enable project-wide
   Supabase CAPTCHA or disable all signup as part of this setup.
7. In a planned staging activation, set `GOOGLE_BROKER_ENABLED=true` and deliberately
   enable enforcement:

   ```sql
   update divzplit_security.oauth_policy set mode='block_new_google' where id;
   -- SQL Editor is privileged. The app itself cannot call this readiness RPC.
   select public.divzplit_google_broker_ready(); -- must be true
   ```

   These are instructions, not executed production actions. The enabled frontend
   and backend require both guards before proceeding, so coordinate deployment to
   avoid an unnecessary login interruption. New Google enrollment from old native
   binaries is denied after enforcement; established Google users retain access.
8. Only after successful staging acceptance, apply the reviewed equivalent setup
   to production and rebuild/release the updated native client with enabled config.
   Use the existing [Android release process](PLAY-STORE.md), preserve package/signing
   identity, and increment the version code. No AAB is issued here claiming a live
   broker works before private configuration and real-provider/device acceptance.

## Android, iPhone and existing users

Browser/iPhone/TWA use the existing consent modal and root → `/app/` return bridge.
Native first proves possession of its verifier via HTTPS `/prepare`. It receives a
short-lived ticket and saves the flow ID, then opens `/google-login/` in an explicitly
selected Custom Tabs browser to avoid self-opening its own App Link. The browser
receives only a ticket, public challenge and flow ID in the fragment, clears it,
and runs Turnstile. The ticket activates once after valid proof, expires after two
minutes, and cannot change the verifier challenge or return URL. Google returns to
the existing root App Link; native completes with its original verifier.

Existing direct Supabase Google logins remain supported for already-enrolled
identities, including released Android/TWA clients. First-time linking of a Google
identity onto an email account counts as enrollment and must use the broker. The
broker does not overwrite existing passwords, group memberships, email confirmation,
ban state or provider identities. Supabase retains normal automatic-linking policy;
nondefault provider linking domains require separate compatibility review.

## Monitoring, limits and operational scope

Logs contain fixed outcome codes and random request IDs, without emails, provider
tokens, verifiers, codes, credentials or full URLs. Alert on repeated
`broker_completion`, `broker_state`, `broker_unavailable`, direct Auth enrollment
denials and failed Turnstile outcomes. Inspect hosted Auth/Audit logs too; an Edge
HTTP 200 alone does not prove the complete registration/device path succeeded.

The inherited proof digest reservation prevents replay; the per-flow bucket permits
six verification attempts per minute. State, tickets, completion and enrollment
grants are one use and expire. These are not a global bot/cost firewall: attackers
can rotate public flows, and `/prepare` creates short-lived drafts before CAPTCHA.
Use trusted platform/gateway request limits and alerts for broader flood protection.
Do not trust arbitrary forwarded IP headers or impose low shared-NAT limits that
block legitimate mobile users. This protects Google enrollment, not every email or
recovery abuse surface. Turnstile reduces automation; it cannot guarantee no bots.

Rollback is explicit: set the private policy back to `observe`, disable the public
broker flag and set `GOOGLE_BROKER_ENABLED=false`. Existing direct login is restored;
new Google signup is then unprotected by this broker. If the optional hook is
registered, ensure it uses the same observation policy. Do not drop Auth tables,
identities, accounts or groups. Disabling only the hook does **not** disable these
database guards. Pending broker flows may need users to restart login.

## Validation and required manual acceptance

Automated checks use local fictional transport/provider data and disposable
PostgreSQL only:

```sh
npm run check
npm test
cd native && npm test
# Run from repo root, with the dedicated disposable test container:
NEXO_TEST_CONTAINER=divzplit-google-broker-tests npm run test:google-broker-database
NEXO_URL=http://127.0.0.1:3047/app/ python tests/google_broker_browser.py
deno check --config supabase/functions/deno.json supabase/functions/google-broker/index.ts
deno test --config supabase/functions/deno.json tests/google_broker_oidc.test.ts
# With existing Android SDK/JDK setup, from native/android:
./gradlew :app:compileReleaseJavaWithJavac :app:lintRelease
```

Verified locally: the shared/web npm suite, 124 native tests, 10 broker tests plus
11 preflight tests, 12 signed-JWT cases, 21 browser cases across ES/EN/RO, real
isolated PostgreSQL security/concurrency tests, Deno checking and Android release
Java compilation/lint passed. Existing Android deprecation/lint warnings remain;
no new dependency was added to native or the browser.

The focused suites cover actual signed Google JWT verification failures, issuer/
audience/nonce/expiry/email/hash checks, encryption/key/context tampering, callback
injection, wrong PKCE/return/user identity, state/ticket/completion replay, concurrent
claims/provisioning leases, deleted-user lease rotation, direct enrollment denial,
email-precreation bypass denial, existing identity updates, private permissions,
readiness/rollback and localized browser/native handoff fixtures.

**Required before production activation:**

- Real Google/Cloudflare/Supabase staging signup and session restoration; valid,
  expired, replayed and mismatched proof, blocked widget/offline, cancellation/retry.
- Existing Google accounts (direct and broker), existing email identity linking,
  banned/deleted accounts, email/signup/recovery, concurrent tabs and pending invite.
- Direct Supabase `/authorize`, ID-token and identity-link endpoints must deny new
  enrollment even with forged metadata, after precreating email, and without using
  the app. Existing Google accounts must continue to sign in directly.
- Desktop, iPhone installed web app, Android TWA and updated React Native on real
  devices. Test cold/warm App Links, browser cancellation, process death and expired
  native tickets; no session should be adopted without the original app record.
- Check hosted trigger compatibility, Google client/provider linkage and error logs;
  prove observation rollback. Backend credentials, real provider requests and device
  acceptance cannot be verified by mocks or by the public Site Key alone.

## Changed file map

- `supabase/functions/google-broker/`: bounded broker handler, signed Google proof
  verifier, authenticated encryption, Admin/normal Auth adapter and blank secrets.
- `supabase/google-broker.sql`: private one-use flows, short provisioning leases,
  real user/identity guards, readiness and service-only atomic RPC functions.
- `supabase/config.toml`, `supabase/functions/deno.lock`: inactive deployment
  declaration and pinned server JWT-verification dependency.
- `cloud.js`, `app.js`, `oauth-protection.js`, `config.js`: optional broker client,
  owned-flow callback verification, existing localized consent and disabled flag.
- `google-login/`, `index.html`, `landing-route.js`, `app/index.html`, `server.mjs`:
  minimal native browser handoff, callback routing and served module versions.
- `native/src/session.mjs`, Android `DivZplitModule.java`/`AndroidManifest.xml`:
  prepared native flow and explicit browser launch. No startup animation/UI redesign.
- `tests/google-broker.test.mjs`, `tests/google_broker_database.py`,
  `tests/google_broker_oidc.test.ts`, `tests/google_broker_browser.py`,
  `native/tests/session.test.mjs`, `package.json`: security/compatibility validation.
- This guide and `OAUTH-ANTIBOT.md`: current implementation boundary/setup.

Sources: [Before User Created](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook),
[Google OAuth with Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect),
[Google token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token),
[Auth Admin creation](https://github.com/supabase/auth/blob/master/internal/api/admin.go),
[ID-token flow](https://github.com/supabase/auth/blob/master/internal/api/token_oidc.go),
[external identity linking](https://github.com/supabase/auth/blob/master/internal/api/external.go),
[identity model](https://github.com/supabase/auth/blob/master/internal/models/identity.go).
