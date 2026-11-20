# DivZplit Android notification presentation and language fix

Version 1.2.0-native.21 / code 27. Package com.divzplit.app.
Source: https://github.com/adrianromantitans-spec/app/commit/f039290ce4a6bfb4282ca0068519f0d0314713f2

The standard Android header shows DivZplit once, followed by the notification body; the repeated content title is removed. New notifications follow the app language: device subscription updates are synchronized immediately on language selection, with a shared registration queue preventing older writes from overriding the latest locale. Automatic is translated in the account language picker (ES/EN/RO). Test a newly received notification after installing; notifications posted by older versions retain their previous presentation.

139 native tests including the actual language picker and registration language races, 21 localized native dispatch cases, shared/web checks, signed release build/lint, bundletool version/identity/16KB alignment and signature/certificate validation passed. The production JS contains the language registration queue; the generated native service omits the duplicate title and preserves account/session guards. No physical Android permission/FCM delivery test was performed; test after installing this update. Existing package/upload identity preserved. No Firebase/SQL/website behavior change is needed for this fix.

Upload this AAB to the existing Google Play testing track. It cannot be installed directly by opening it on a phone. No source/main merge, Play upload, account deletion or notification send was performed by this download branch.

Bytes: 34766921
SHA-256: 2f762ea9e8b128768c30b903e4d21da68ca712e83d60fd97cb418a4ff2726364
