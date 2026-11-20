# DivZplit Android notification onboarding fix

Version 1.2.0-native.20 / code 26. Package com.divzplit.app.
Source: https://github.com/adrianromantitans-spec/app/commit/bb47f566972c3e56660e795be6a2b975ba638b83

The notification invitation is remembered per account/device. A new/recreated account no longer inherits a global dismissal; logout and account deletion clean push binding without marking the offer dismissed. Permission is requested only after the user presses Activate. Existing OS denial, existing opt-in, service readiness and account boundaries remain respected.

132 native tests, focused signup/empty-group/delete/recreate and actual offer-hook cases, shared/web checks, signed release build/lint, bundletool version/identity/16KB alignment and jarsigner verification passed. The production JS includes the account-scoped consent key. No physical Android permission/FCM delivery test was performed; test after installing this update. Existing package/upload identity preserved. No Firebase/SQL/website behavior change is needed for this fix.

Upload this AAB to the existing Google Play testing track. It cannot be installed directly by opening it on a phone. No source/main merge, Play upload, account deletion or notification send was performed by this download branch.

Bytes: 34766096
SHA-256: e4d7c6ba5b6e21ed93fd4a708c4fdb40d098b510aac77884d5d176a14d885b5e
