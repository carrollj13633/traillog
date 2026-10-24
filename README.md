# TrailLog: a GPS trail recorder for your phone

A small, AllTrails-style web app. Tap **Start**, walk, and TrailLog records your path from the phone's GPS. It draws a live line on the map, shows distance, time, speed, and elevation gain, and saves the track on your device. It is an installable PWA made of plain static files: no backend, no account, no build step.

## Features

- **Map**: Leaflet with a blue "you are here" dot and accuracy circle. A layer switcher offers **Street** (OpenStreetMap), **Satellite** (Esri World Imagery), and **Topo** (OpenTopoMap), each with the correct attribution. Your choice is remembered and used on both the live map and saved-track maps.
- **Recording**: big Start / Pause / Resume / Stop buttons, then Save or Discard. Live stats: elapsed time, distance, current and average speed, elevation gain (when the phone reports altitude), and point count. Switch between mi and km.
- **Clean tracks**: fixes with accuracy worse than 30 m (adjustable in Help), tiny jitter moves, and impossible GPS jumps are dropped.
- **Crash-safe**: every accepted point is written to IndexedDB as it arrives. If the page reloads or the browser kills the tab, you are offered **Resume**, **Review & save**, or **Discard**. A resume starts a new segment, so the gap is never counted as distance.
- **Saved tracks**: list with name, date, distance, and duration. Tap one to see it on the map (green start marker, red end marker, green-to-red gradient path, auto-fit to the track), its stats, and an elevation profile you can scrub. Rename, delete, share.
- **Export / import**: GPX 1.1 (with `time` and `ele`) per track or all at once, **KML 2.2** per track (for Google Earth and Google My Maps), and GPX import. Share uses the Web Share API where the browser has it; otherwise it downloads the file.
- **Platform help**: it detects iOS Safari, iOS home-screen app, iOS Chrome/Firefox (which are WebKit), Android Chrome, Android Firefox, Samsung Internet, and desktop. It then shows setup, install, and fix-it steps for that platform, and warns where background GPS is unreliable. The **Help** tab has a **Compatibility check** that lists the platform, HTTPS, geolocation, permission state, wake lock, IndexedDB, and service worker support.
- **Offline**: the app shell is precached by a service worker, and map tiles you have viewed are cached for later.

## Run it locally

```bash
cd gps-tracker
python3 -m http.server 8000
# open http://localhost:8000 in a desktop browser
```

`localhost` counts as a secure context, so GPS works on the same computer. To try it on a phone you need HTTPS (see below). A plain `http://192.168.x.x:8000` address will **not** give a phone location access, and the app shows a clear error if you try.

## GPS needs HTTPS

Browsers only expose geolocation, service workers, and the wake lock on **secure contexts**: `https://` pages or `localhost`. If you open the app over plain `http://` on a phone, TrailLog shows an "HTTPS required" message. Host the folder on any HTTPS static host.

All paths in the app are relative, so it works at the root of a domain or under a subpath such as `https://you.github.io/traillog/`.

### Free HTTPS hosting options

Nothing in this folder publishes itself. When you are ready, pick one:

**GitHub Pages**
1. Create a repository and add the contents of this folder at the root of the branch (`index.html` must be at the top level).
2. In the repository, open **Settings > Pages**, set the source to that branch and the `/ (root)` folder, and save.
3. Your app appears at `https://<user>.github.io/<repo>/` after a minute or two.

**Netlify**
1. Sign in at netlify.com and choose **Add new site > Deploy manually** (drag and drop this folder), or connect a Git repository.
2. No build command is needed. Set the publish directory to the folder that contains `index.html`.
3. Netlify gives you an `https://<name>.netlify.app` address.

**Cloudflare Pages**
1. In the Cloudflare dashboard, open **Workers & Pages > Create > Pages**, and either upload this folder or connect a Git repository.
2. Leave the build command empty and set the output directory to the folder that contains `index.html` (or `/` if it is at the repo root).
3. You get an `https://<name>.pages.dev` address.

If you update the app later, bump `VERSION` at the top of `sw.js` so phones pick up the new files. The app then shows a "A new version is ready" prompt with a Reload button.

## Install on your phone

**iPhone / iPad (Safari)**
1. Open the HTTPS address in **Safari** (other iOS browsers cannot add apps to the Home Screen as reliably).
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open TrailLog from the new icon. Allow location when asked, and choose **While Using the App** if iOS offers it.
4. If location is blocked: **Settings > Privacy & Security > Location Services** must be on. Then, under **Safari Websites** (or TrailLog if installed), choose **Ask** or **While Using the App**. Turn on **Precise Location**.

**Android (Chrome)**
1. Open the HTTPS address in Chrome.
2. Tap the menu (⋮), then **Install app** or **Add to Home screen**.
3. Allow location when asked, and keep **Use precise location** on.
4. If location is blocked: Chrome **Settings > Site settings > Location** (or the lock icon in the address bar > **Permissions**), and also Android **Settings > Location** must be on.
5. For long recordings, set the browser's battery use to **Unrestricted** or **Not optimized** and turn off Battery Saver.

**Samsung Internet / Firefox for Android**: the app has its own steps under **Help**. The menu has **Add page to** or **Install**.

## Limits you should know about (background GPS)

TrailLog is a web page, not a native app, so the operating system decides what happens when the page is not in front.

- **iPhone**: Safari suspends web pages when the screen locks or you switch apps, so **GPS stops** until you return. Keep the screen on and TrailLog in front while recording. Adding it to the Home Screen helps with permission handling but does **not** allow true background tracking.
- **Android**: Chrome may keep delivering location for a while with the screen off, but battery optimization can pause the page. It is not guaranteed.
- **Wake Lock**: where the browser supports it (most Android browsers, iOS 16.4+ Safari), TrailLog keeps the screen awake while recording and re-acquires the lock when you return to the tab. Not every browser or mode supports it.
- When GPS resumes after a gap (for example the screen was locked), the points on either side are joined with a straight line and the elapsed clock keeps running. Treat a long gap as missing data. If the page was fully closed and you resume, a new segment starts instead and the gap is not counted.
- Altitude from phone GPS is noisy and some browsers do not provide it. Elevation gain uses a 3 m threshold to avoid counting noise, so it will differ from other apps.
- Data lives in your browser's storage. Clearing site data deletes saved tracks, so export a GPX backup of anything important.

## Map providers and fair use

- **OpenStreetMap** tiles come from the community server `tile.openstreetmap.org`. It is fine for personal and light use. For a public or busy deployment, follow the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) or use a commercial tile provider.
- **Esri World Imagery** is used with attribution as Esri's public basemap service allows for light use. Check Esri's terms before heavy or commercial use.
- **OpenTopoMap** is a free community service. Please keep usage modest.

To use a different provider, edit the `BASES` list in `js/app.js` and the tile hosts in `sw.js`.

## Why there is no Google Maps

The Google Maps JavaScript API is **intentionally not used**: it needs an API key and a billing account. Leaflet with free tile providers needs neither. If you still want your tracks in Google's tools, use **Export KML** and import the file into [Google My Maps](https://mymaps.google.com) or open it in Google Earth. GPX files import into most other apps (AllTrails, Strava, Garmin, Komoot, and so on).

## Files

```
index.html               app shell (record, tracks, detail, help, compatibility views)
manifest.webmanifest     PWA manifest
sw.js                    service worker (precache + tile cache)
css/app.css              styles (light/dark, large touch targets)
js/geo.js                distance, fix filtering, stats, GPX/KML build + GPX parse (also runs in Node)
js/platform.js           platform detection and per-platform help text (also runs in Node)
js/db.js                 IndexedDB storage for tracks and the in-progress recording
js/app.js                UI, maps, geolocation, recording state machine, import/export
vendor/leaflet/          Leaflet 1.9.4 (BSD-2-Clause), bundled so it works offline
icons/                   app icons (SVG, PNG, maskable)
tests/                   unit tests (Node) and browser test (Playwright)
```

## Tests

```bash
# unit tests (Node 18+): distance, filtering, stats, GPX/KML, platform detection, error help
node --test tests/

# browser test with a mocked walk (Python + Playwright + an installed Chrome/Chromium)
python3 -m http.server 8765 &
pip install playwright
E2E_IP=<this machine's LAN IP> python3 tests/e2e.py http://localhost:8765/ /usr/bin/google-chrome
```

`E2E_IP` enables the insecure-context check, which loads the app through the machine's non-localhost address over plain HTTP.

## Privacy

Everything stays in your browser. Positions are never sent anywhere. The only network requests are for map tiles from the providers listed above.

## License

App code: MIT. Leaflet: BSD-2-Clause (see `vendor/leaflet/LICENSE`).
