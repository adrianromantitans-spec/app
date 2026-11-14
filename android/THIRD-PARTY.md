# Android dependencies and provenance

- Android shell generated with **@bubblewrap/core 1.27.0** (GoogleChromeLabs/bubblewrap), Apache-2.0. The icons and web manifest were read from this repository, not replaced with sample graphics.
- **Android Browser Helper 2.7.4**, Apache-2.0, via Google Maven. Chrome (or another compatible TWA browser) renders the existing web app; this is not an embedded WebView login.
- **Android Gradle Plugin 8.9.1**; **Gradle 8.11.1**; **JDK 17**; compile/target API **36**.
- Gradle wrapper JAR comes from `gradle/gradle` tag `v8.11.1` and matches official SHA-256 `2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046`.
- Gradle distribution SHA-256 is pinned in `gradle/wrapper/gradle-wrapper.properties`. Repositories are Google Maven and Maven Central; the retired JCenter repository is not used.

Upstream: https://github.com/GoogleChromeLabs/bubblewrap and https://github.com/GoogleChrome/android-browser-helper.

Custom changes after generation: one version source (`twa-manifest.json`), explicit private environment-based release signing, release lint enabled, fail if a release has no upload signing configuration, no cleartext traffic, no shell backup/transfer, monochrome notification/themed icon derived from the existing DZ mark, official verified wrapper, Maven Central instead of JCenter. Do not run `bubblewrap update` over these files without reviewing and preserving these changes. Normal builds need Gradle/JDK/SDK/Python, not Bubblewrap or npm.
