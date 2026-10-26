# Draft entry for the web repo's docs/HANDOFF.md (NOT applied; paste it yourself if you want it)

## Android app (October 24, 2026)
- An Android wrapper (Capacitor 8) was built in a separate folder, `traillog-android/`. It copies this repo's web files into `www/` and adds `js/native.js`.
- Differences from this repo are in `traillog-android/docs/web-changes.patch` (css/app.css, index.html, js/app.js, js/platform.js, sw.js, new js/native.js). This repo was not changed.
- The web app behaves the same when `window.Capacitor` is absent (all native code is guarded by `native.js` returning `{native:false}`).
- Debug APK and signed AAB exist; nothing was uploaded or published. The app has not run on a physical device yet.
- Open decisions: final app name (Play conflict) and package ID before the first upload; host `privacy.html` at this site's root.
