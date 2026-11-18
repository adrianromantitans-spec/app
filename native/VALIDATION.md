# Startup hotfix — 18 November 2026

Base: `903b29f` (main after PR 17). Candidate `1.2.0-native.6`, Android version code `12`.

## Reproduced defect and correction

The owner reported that code 11 closes after the opening animation. In that version, native-driven letter opacity/transforms and JavaScript-driven `fontSize`, `lineHeight` and `letterSpacing` shared the same Animated.Text style graph. Starting the assembly promotes that graph (including the flight value) to native. Starting the JavaScript font handoff then throws React Native's exception:

```
Attempting to run JS driven animation on animated node that has been moved to "native" earlier by starting an animation with `useNativeDriver: true`
```

This was reproduced with the project's pinned React Native Animated classes. The new component regression test fails with that exception when run against the shipped Opening.js and passes against the correction. No physical-device crash log was available, so this establishes a reproducible startup defect consistent with the report, not a claim that every device failure has been ruled out.

`src/Opening.js` now puts native opacity/transforms on three wrapper views and JavaScript font metrics on their nested text views. Native and JavaScript drivers no longer share a style graph. The nested static period uses ordinary Text. Original colors, typeface, transforms, assembly/keyframe durations, hold, handoff, reduced-motion and tap-to-skip behavior are retained. Website sources and app/domain/auth/backend code are unchanged.

## Passed checks

- `npm test --prefix native`: 59 passing tests. Existing financial/account/receipt/collaboration/feature coverage is retained. Three new tests reproduce the former exception, exercise the actual corrected component's style graphs through assembly and successful handoff, and check reduced-motion behavior; the component test also exercises skip. Existing design tests still compare timings/keyframe stops with the original web sources.
- The new host-free harness transpiles the pinned React Native Value, Style and Animation implementations with the existing Babel dependency. Only Android bridge/platform boundaries, default feature flags, React hooks and host views are stubbed. It is not a browser Animated substitute, and it is not an Android renderer/device test. No dependencies added.
- Final Metro/Hermes release bundle, Java/Kotlin/C++ release compilation, R8, AAB generation and `lintRelease`: 0 errors, 19 existing warnings. No new lint baseline or suppression.
- Existing upload certificate comparison and `jarsigner -verify` pass. Self-signed/no-timestamp notices are expected for the existing Android upload certificate.
- Bundletool 1.18.3 validates the signed artifact. Manifest: package `com.divzplit.app`, code `12`, version `1.2.0-native.6`, minimum API 24 / target API 36, native MainActivity launcher.
- Offline Hermes bundle and existing assets/fonts are present. All 13 ARM64 shared libraries retain at least 16 KB ELF LOAD alignment.
- Git diff/whitespace checks pass; source changes are confined to native startup, version metadata, tests and documentation. No website, Firebase/Supabase configuration, signing key or user data changes.

Final signed artifact:

```
divzplit-1.2.0-native.6.aab
bytes: 34728762
SHA-256: 101280c28e4254a412d60a3ae0a587a076eab81da0a46fcaaea08e48e05f9a50
```

## Physical acceptance and delivery

No Android phone/emulator is attached. Update from code 11 through the same Play test track with the existing signing identity; there is no need to uninstall or clear app data. Follow the code 12 section in [DEVICE-TESTS.md](DEVICE-TESTS.md): cold/warm launch, signed-in and signed-out handoff, skipping, reduced motion and background/resume, then verify the home page stays usable. If another close occurs, collect the device's fatal exception with Logcat or Android vitals.

The visual reference remains documented in [DESIGN-REFERENCE.md](DESIGN-REFERENCE.md). All broader real-device feature/auth/camera/FCM/performance gates remain. This change does not itself merge, deploy or publish a Play release.
