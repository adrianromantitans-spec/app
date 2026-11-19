# Email account creation: required Supabase CAPTCHA

## Confirmed cause

A safe, empty signup request to the production Auth endpoint returned HTTP 400:
`error_code: captcha_failed`, `no captcha_token found`. It created no account and
sent no email. Public Auth settings still allow email/signup and CORS responds
normally. The owner confirmed the project uses the previously supplied Cloudflare
Turnstile widget. The missing CAPTCHA token was being mislabeled as a connection
failure on both platforms; this was not evidence that the phone had lost its network.

## Fix

- The shared client recognizes an explicit CAPTCHA rejection on email signup,
  password login, recovery and signup-code resend. It asks the platform for a fresh
  token, then retries that rejected operation **once** with
  `gotrue_meta_security.captcha_token` in the HTTPS JSON body.
- No challenge is requested when the server accepts the original request. Failed
  tokens, network failures, timeouts, HTTP 429 or other server failures never cause
  an automatic signup retry. A cancelled/failed challenge leaves the existing form
  and credentials in place; it cannot create a session or pending-confirmation state.
- Supabase validates the token using its own configured private Turnstile secret.
  The token must not also be submitted to the OAuth preflight Siteverify function:
  consuming it there would make the subsequent signup fail as a replay.
- CAPTCHA errors now have specific English, Spanish and Romanian copy. Raw provider
  details are not displayed; real network/timeout failures retain their existing
  messages. Projects without required CAPTCHA keep the original one-request flow.
- Desktop, Android web/TWA and iPhone web/PWA use a small accessible verification
  dialog in the existing purple/white style. Escape/Cancel cleans up the widget.
- React Native Android opens a CAPTCHA-only native WebView dialog loading the fixed
  HTTPS `/auth-challenge/` page. Email/password never enter that page. JavaScript and
  DOM storage/cookies support Cloudflare's documented mobile flow. No browser UA
  spoofing, SSL bypass, file access or JavaScript-to-Java interface is introduced.
  Only the trusted main frame is evaluated, with an initiating random nonce checked
  before returning a bounded token. Navigation is restricted, deadlines are bounded,
  and cancel/HTTP/network errors or module shutdown clean up the view.
- Tokens stay in memory until submitted. They never enter URLs, console messages,
  persistent application storage or GitHub. No new dependencies or backend function
  deployment is required for email CAPTCHA. No Supabase security setting, secret,
  database, account or restrictive Google OAuth broker setting was changed.

## Release order

1. Merge/deploy this PR using the existing website publishing process. Confirm
   `https://divzplit.com/auth-challenge/` returns the verification page, along with
   its JS/CSS, `auth-captcha-copy.js`, `oauth-protection.js` and public `config.js`.
   App entry/module/CSS versions are updated so the fixed web form is fetched.
2. Keep Supabase's CAPTCHA provider as Cloudflare Turnstile, with the **matching**
   widget Secret Key. Its public Site Key is already in `cloudConfig.oauthProtection`;
   the older OAuth preflight flag does not need enabling for email verification.
   Cloudflare must allow `divzplit.com`. Do not put a Secret Key in public config.
3. Upload the signed Android **1.2.0-native.19 / version code 25** AAB to the existing
   Play testing track, review and roll out. Existing package/signing identity stays
   intact. Older installed binaries cannot acquire this new native bridge through
   a website update; install the Play update before testing Android email signup.
4. Test a real owned email address, code delivery/confirmation and session restore
   on Android and iPhone. Cancel/retry, invalid/expired token, denied widget/network,
   login, recovery and resend should fail clearly or succeed as appropriate. Do not
   disable CAPTCHA to hide a configuration mismatch.

## Checks

`npm run check`, shared/web tests and native tests include server-required/success/
cancel/rejected proof handling, safe one-time retry, no network retry, language
copy, token submission and the native bridge without credential leakage.

```sh
node --test tests/auth-captcha.test.mjs
cd native && npm test
# Local dev server and browser/provider fixtures; no real accounts or emails:
NEXO_URL=http://127.0.0.1:3048/app/ python tests/auth_captcha_browser.py
NEXO_BROWSER=webkit NEXO_URL=http://127.0.0.1:3048/app/ python tests/auth_captcha_browser.py
```

Browser tests cover desktop, iPhone and Android profiles in ES/EN/RO, verification
cancellation/rejection and the hosted native challenge page. WebKit tests exercise
the Safari engine; physical iPhone/PWA and Android WebView/real Turnstile acceptance
still require devices. Mocked proof does not certify real provider keys or delivery.

Verified locally: shared/web checks and npm tests, 125 native tests, 7 focused
CAPTCHA tests, 30 Chromium cases (desktop/iPhone/Android profiles and hosted native
page), 12 WebKit cases (iPhone profile and hosted page), and signed Android release
compilation/lint passed.

Android release compilation/lint and bundletool validation are required for the AAB;
the uploaded download includes its source commit, version and SHA-256. Existing lint
and Gradle deprecation warnings are separate from this signup fix.

Sources: [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha),
[Cloudflare mobile/WebView support](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/).
