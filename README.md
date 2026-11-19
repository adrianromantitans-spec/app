# DivZplit Android test candidate

Version 1.2.0-native.18 / code 24. Package com.divzplit.app.
Source: https://github.com/adrianromantitans-spec/app/commit/4884c8a495a19ce7dafecca3563531ce7ddda8e7

Adds in-app signup verification by email code, then signs into the confirmed account directly. 122 native tests, shared/web tests and ES/EN/RO UI fixtures pass. Save supabase/templates/confirm-signup.html in Supabase Authentication > Email > Templates > Confirm signup before testing delivery. No live email/device test was performed. Existing upload signature preserved.
This AAB must be uploaded to the existing Google Play testing track; it cannot be installed by opening the file on a phone. Real Android design/animation/auth/notifications acceptance remains required.

Bytes: 34764911
SHA-256: 1c31558d1d998940764544cce32aa34099b5ab39f44f0270dfa88ea140b3bf9e

No source/main changes or Play upload are performed by this download branch.
