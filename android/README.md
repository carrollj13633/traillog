# TrailLog for Android

A Capacitor 8 wrapper around the TrailLog web app (a GPS trail recorder), packaged for Google Play.

- App name: TrailLog (see `PLAY_STORE_GUIDE.md` section 0: name may be unavailable on Play)
- Package ID: `com.carrollj13633.traillog` (permanent after the first Play upload)
- Version: 1.0.0 (versionCode 1), minSdk 24, targetSdk 36
- **Status: builds and passes unit and mocked tests. Never run on a real Android device.**

**Start here: [`PLAY_STORE_GUIDE.md`](PLAY_STORE_GUIDE.md).**

## Layout

| Path | What it is |
|------|------------|
| `www/` | The web app (copy of `gps-tracker` plus native additions). `www/js/native.js` is the Android bridge. |
| `android/` | The Android Studio / Gradle project. `TrailLogNativePlugin.java` handles permissions, settings shortcuts, and status. |
| `tests/` | Node unit tests, plus Playwright e2e scripts (`e2e.py` for the web, `e2e_native.py` with a mocked Capacitor bridge). |
| `store/` | Play listing graphics, `listing.md` (store text), `privacy.html` (ready to host, not published). |
| `docs/` | `PRIVACY_POLICY.md`, `web-changes.patch` (every change from the original web repo; apply with `patch -p1` at the web repo root). |
| `tools/generate_assets.py` | Regenerates icons, splash art, and store graphics (needs Pillow). |

## How recording works on Android

- The `@capacitor-community/background-geolocation` plugin runs a foreground service (notification "TrailLog is recording") so GPS recording continues with the screen off.
- The same filter, IndexedDB, and stats pipeline as the web app is used. In a plain browser the app uses the web Geolocation API and is unchanged.
- The service worker is disabled inside the app; assets are bundled, so the app works offline (except map tiles).
- Export uses Capacitor Filesystem plus Share (Android share sheet, FileProvider with a cache-only path).

## Build

```
source /home/box/tools/env.sh   # box only: Node 22, JDK 21, Android SDK
npm install && npm test
npx cap sync android
cd android && ./gradlew assembleDebug bundleRelease
```

The release build is signed with the upload key from the sibling folder `../traillog-android-signing/` (never in this project; see its README). Raise `versionCode` before every Play upload.

## Secrets

No keystore, password, or `local.properties` is in this folder, and `.gitignore` blocks them. Keep it that way.
