# Social brand icon refresh — 19 November 2026

Base main ece1f4c (merged PR 27). Candidate 1.2.0-native.16 / code 22.

Replace the four approximate hand-drawn outlines with Bootstrap Icons' vector brand geometry. Original downloaded SVGs and MIT attribution are retained in assets/social/. These are library representations, not a claim that the files were supplied directly by each brand.

- invitation-share.js: exact 16×16 upstream path geometry, brand fills, Snapchat white underlay/yellow background; source references.
- native/src/GroupSheets.js and app.js: filled vectors, Instagram gradient with explicit 16×16 user-space bounds and Snapchat background/underlay. Keep existing 52px accessible buttons, labels and actions.
- app/index.html and app.js: cache versions for updated web modules.
- assets/social/{whatsapp,telegram,instagram,snapchat}.svg, LICENSE.txt, README.md: source assets and attribution; no new runtime dependency.
- native/native-config.json, package.json, package-lock.json: candidate version/code only.

No changes to messages, URLs, group names, preview metadata, sharing/clipboard fallbacks, permissions, auth, backend, other UI or animations.

Checks: 116 native tests pass; shared/web tests and syntax checks pass. Actual native-JSX and website browser fixtures pass in ES/EN/RO for four accessible icons, localized messages, unchanged token/copy and service dispatch. Inspect screenshots of filled marks and Snapchat white ghost on yellow. No Android device/emulator attached; real OS/app acceptance remains the existing device checklist. No real messages sent.

Merge via the existing website publication process to update browser/iPhone UI, and upload the new signed AAB to the same Play test track for Android. No backend/Firebase/signing configuration change. No automatic merge, website deployment or Play upload performed.

Release build/signing and bundletool validation passed with the existing upload certificate/package com.divzplit.app. Lint: 0 errors / 21 existing warnings; all 13 ARM64 libraries retain 16 KB LOAD alignment. Final signed file: divzplit-1.2.0-native.16.aab, code 22, 34,762,511 bytes. SHA-256: 036060e868401f476507fd85ee4d98c770f324cc80e7c1771e497ff282185b09.
