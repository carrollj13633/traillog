# TrailLog on Google Play: step-by-step guide

Written October 24, 2026 (America/New_York). Play Console screens and policies change, so where this guide names a rule, it gives the source link. Check the link if something looks different.

**Honest status:** the Android app was built and checked on a Linux computer with no phone and no emulator. The build, the manifest, the unit tests, and the web tests (with a mocked Capacitor bridge) all pass. **It has never run on a real Android device.** Nothing in this guide should be treated as proven on a phone until you have run the app on one (see section 1).

---

## 0. Read this first: three decisions only you can make

1. **App name.** The repo notes (`AGENTS.md`, `docs/HANDOFF.md`) say "TrailLog" is already taken on Google Play, with Trailvane as the leading replacement idea (Trailquill as backup). I did not verify that on the Play Store from here. Check the name in Play Console (the "Create app" screen) and on the Play Store before you upload anything. This build is still named TrailLog everywhere.
2. **Package ID is permanent.** The app's package ID is `com.carrollj13633.traillog`. After the first upload to Play Console it can **never** be changed for that app. If you rename the app, decide on the package ID first (see "Rename checklist" below).
3. **Background location.** The app asks for "Allow all the time" location so recording continues with the screen off. That is the main reason this app is useful, but it makes Google review the app more closely (sections 9 and 10). The alternative is explained in section 11.

---

## 1. Before anything else: try it on a real phone

The debug APK installs on any Android 7.0 (API 24) or newer phone.

1. Copy `traillog-1.0.0-debug.apk` to the phone (USB cable, Drive, or email).
2. Open it on the phone. Android will ask you to allow "Install unknown apps" for the app you opened it from (Files, Chrome, and so on). Allow it for this one install.
3. Or use a cable and `adb install -r traillog-1.0.0-debug.apk` (turn on Developer options > USB debugging first). `adb` installs are never affected by Android's new developer verification rules.
4. Walk through the checklist in section 14. Pay special attention to the items under "Things I could not test".

Android developer verification (a new Google rule for apps installed from outside the Play Store): it started September 30, 2026 in Indonesia, Singapore, and Thailand and goes global in 2027. For personal testing in the US today it should not matter, and there is an "advanced flow" to install unverified apps plus a free "limited distribution" account (up to 20 devices, no ID). Details: https://support.google.com/android-developer-console/answer/16561738 (I could not confirm the exact rollout for your country, so check before you give the debug APK to others).

---

## 2. Create the Play developer account (you do this)

Source: https://support.google.com/googleplay/android-developer/answer/6112435

1. Go to https://play.google.com/console/signup and sign in with the Google account you want to own the app permanently. A dedicated account is a good idea.
2. Choose an account type:
   - **Personal:** simplest for an individual. Subject to the closed-testing rule in section 3.
   - **Organization:** needs a D-U-N-S number (free, but can take up to 28 days) and a registered organization. Organizations are exempt from the personal-account testing rule.
3. Pay the **one-time US$25 registration fee** (credit or debit card; prepaid cards are not accepted).
4. **Verify your identity.** Google may ask for a government photo ID and a credit card, both under your legal name. If verification fails, the fee is not refunded.
5. **Verify an Android device** (personal accounts): install the **Google Play Console** app on a real Android phone and sign in to prove you have a device.
6. Your public developer name and contact details appear on the store listing, so use what you are comfortable making public.

I cannot do any of this for you: it needs your ID, payment, and phone.

---

## 3. The testing rule for personal accounts (12 testers, 14 days)

Source: https://support.google.com/googleplay/android-developer/answer/14151465

For personal accounts created after November 13, 2023, you cannot publish to production right away. You must first:

1. Run a **closed test** with **at least 12 testers who stay opted in for 14 continuous days**.
2. Then apply for production access in Play Console (a short questionnaire about your test, the feedback you got, and how you prepared the app).
3. Google reviews the application (usually seven days or less, sometimes longer). You can start a closed test only after the app setup checklist (sections 6 to 12) is complete.

Practical advice:
- Recruit about **15 to 20** testers so a few dropouts do not reset your count. Friends, family, colleagues, students' parents who agree, and so on.
- Testers need a Google account and an Android device or the Play Store on a Chromebook. You add their Google email addresses to a list (or a Google Group) in Play Console and send them the opt-in link.
- Ask them to actually use the app and send you feedback. Fix problems and upload new versions during the 14 days if needed. Each new upload needs a higher `versionCode` (see section 15).
- The clock restarts if testers drop below 12.

---

## 4. Create the app in Play Console

1. Play Console > **Create app**.
2. App name: see section 0 (max 30 characters). Default language: English (United States). App or game: **App**. Free or paid: **Free** (you cannot switch a free app to paid later). Accept the declarations.
3. Work through **Dashboard > Set up your app** (the checklist). Each section below lists what to enter.

---

## 5. Build and upload the release bundle (AAB)

File: `traillog-1.0.0-release.aab` (in the zip) or `android/app/build/outputs/bundle/release/app-release.aab` in the project.

It is signed with the **upload key** that I generated for you (kept outside the project; see section 16 for backup).

1. Play Console > **Test and release > Testing > Closed testing** > Create track (or use the default "Alpha") > **Create new release**.
2. When asked about **Play App Signing**, accept it (it is the default and required for new apps). Google keeps the real app-signing key; your keystore is only the upload key.
3. Upload the AAB. Play Console should show version 1 (1.0.0).
4. Add release notes, for example: "First test version. Record a trail, view it, export it as GPX or KML."
5. Save, and complete the app content declarations (sections 6 to 12) before you can roll out the release.

Upload key SHA-256 fingerprint (Play Console shows this too, you can compare):
`67:44:58:3C:FB:6E:7D:FA:FB:D8:65:55:B7:34:04:73:0E:40:F8:3A:57:C3:62:EB:9C:07:65:A6:96:D2:55:05`

The same bundle later goes into the **Production** track.

Requirement checks as of this writing: new apps must target API level 36 or higher (this app targets 36) and must be an Android App Bundle (it is).

---

## 6. Store listing and graphics

Copy the text from `store/listing.md`. Files are in the `store/` folder.

| Item | Requirement | Provided? |
|------|-------------|-----------|
| App name | max 30 characters | Text in listing.md |
| Short description | max 80 characters (74 used) | Yes |
| Full description | max 4,000 characters (about 2,000 used) | Yes |
| App icon | 512 x 512 px, PNG, up to 1 MB | `store/icon-512.png` |
| Feature graphic | 1024 x 500 px, PNG or JPEG | `store/feature-graphic-1024x500.png` |
| Phone screenshots | 2 to 8; JPEG or PNG; 16:9 or 9:16; each side between 320 and 3,840 px | **No: you must capture them** |
| 7-inch and 10-inch tablet screenshots | Optional (but recommended for tablet ranking) | No |
| Contact email | required, public | You |
| Privacy policy URL | required | Section 7 |

**Screenshots:** Play expects screenshots of the real app. I did not generate any because the app has never run on a device, and mock-ups would be misleading. Capture them on your phone (power + volume down) or in Android Studio's emulator. Good shots: the main map before recording, a recording in progress with live stats, a saved track with the elevation profile, and the export/share sheet.

---

## 7. Privacy policy (required, and it must be a public web page)

Files: `docs/PRIVACY_POLICY.md` (text) and `store/privacy.html` (ready-to-host page). **Nothing has been published.**

1. Open `store/privacy.html` and replace both `[YOUR CONTACT EMAIL ADDRESS]` placeholders with a real address. Also change the developer name if you want.
2. Easiest hosting: you already host the web app with GitHub Pages at https://carrollj13633.github.io/traillog/. Copy `privacy.html` into the root of that repo (next to `index.html`), commit, and push. It will appear at https://carrollj13633.github.io/traillog/privacy.html.
3. Check the URL opens in a browser **without logging in**. Play rejects policies that are PDFs, geofenced, or missing.
4. Enter that URL in **Policy and programs > App content > Privacy policy**. The same address is also the one the app uses for its in-app "Privacy policy" link (`PRIVACY_URL` in `www/js/app.js`). If you host it somewhere else, change that line and rebuild.
5. If you rename the app, update the policy text too.

---

## 8. Data safety form (App content > Data safety)

Source: https://support.google.com/googleplay/android-developer/answer/10787469

The honest facts: precise location is used by the app and stored only on the phone; there is no server, account, ad, analytics, or crash library; and map tile requests go to third-party map servers carrying the IP address and the map area being viewed.

Suggested answers (recommended, conservative):

| Question | Answer |
|----------|--------|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | Yes (all requests are HTTPS) |
| Do you provide a way for users to request that their data is deleted? | Yes: users delete tracks in the app, clear app storage, or uninstall. (There is no server copy.) |
| Data types: **Location > Precise location** | Collected: **Yes**. Shared: **No**. Processed ephemerally: **No** (it is stored on the device). Required (not optional): **Yes**. Purpose: **App functionality**. |
| Data types: **Location > Approximate location** | Collected: **Yes** (the map area requested from the tile servers). Shared: **Yes**, with the map tile providers. Required: Yes. Purpose: **App functionality**. |
| Any other category (personal info, financial, health, messages, photos, contacts, app activity, web history, device IDs) | **Not collected** |
| Does the app use ads, accounts, or analytics? | No (nothing to declare) |

Notes:
- Google's rules say data that stays only on the device is not "collected", so some developers answer "No data collected" for an app like this. That could be argued, but because the app records location in the background and map tiles leave the device with a viewed area and IP address, the safer course is to **disclose**. An over-disclosure cannot get the app rejected; an inaccurate "no data" can. It is your call. If you pick the simplest route, keep your privacy policy as written; it already tells the truth.
- Your answers must match the privacy policy and the app's behavior. If you later add analytics, ads, a login, or a server, update the form and the policy first.

---

## 9. Background location declaration (App content > Sensitive app permissions)

Source: https://support.google.com/googleplay/android-developer/answer/9799150

Because the manifest declares `ACCESS_BACKGROUND_LOCATION`, Play Console shows a **Location permissions** form. Google reviews it by hand, usually before the first production release and sometimes for closed tests.

What Google requires, and how TrailLog meets it:
- **Core, user-facing feature:** recording a trail with the screen off or while another app is in front. Without background access the recording would have gaps.
- **Prominent disclosure before the permission prompt:** the app shows "How TrailLog uses your location" with "Agree and continue" / "No thanks" **before** any Android permission prompt. Then it asks for foreground location, then explains and asks for "Allow all the time" on a separate screen ("Record with the screen off").
- **Only while the user starts a recording:** location collection runs only between Start and Pause/Stop, with a persistent "TrailLog is recording" notification.
- **No data sent anywhere:** nothing is uploaded or sold.

Suggested text for "Tell us how your app uses background location" (keep it to this one feature):

> TrailLog is a GPS trail recorder for hikers, runners, and cyclists. The one feature that needs location in the background is recording a trail: after the user taps Start, the app keeps recording their path when the screen is off or another app is in front, so that the saved track has no gaps. Before any permission prompt, the app shows a full-screen disclosure explaining that location is collected in the background while a recording is running, and the user must tap "Agree and continue". The app then requests foreground location and, on a separate screen, background ("Allow all the time") location. While a recording runs, Android shows a persistent notification, "TrailLog is recording". Location collection stops when the user taps Pause or Stop. Location is never collected in the background when no recording is running. Recorded locations are stored only on the user's device. They are not sent to the developer, to any server, or to any third party.

**Demo video (required):** record a video of **a real phone** (screen recording) and upload it as an unlisted YouTube link (or Drive link that anyone with the link can view). Keep it **30 seconds or less** and show, in order:
1. A clean install or a freshly cleared app (Settings > Apps > TrailLog > Storage > Clear data, and revoke permissions).
2. Open the app and tap Start: the disclosure screen "How TrailLog uses your location" appears; tap "Agree and continue".
3. The Android location prompt (choose "While using the app") and notification prompt.
4. The "Record with the screen off" screen and the Android settings where "Allow all the time" is chosen.
5. Recording running with the "TrailLog is recording" notification, then lock the screen, wake it, and show the track still growing.

Also paste the video link into the form. Provide English narration or captions if you like (not required).

Review can take several days to weeks and may be rejected on the first try. If rejected, read the reason, adjust the text or video, and resubmit.

---

## 10. Foreground service declaration (App content > Foreground service permissions)

Source: https://support.google.com/googleplay/android-developer/answer/13392821

The app uses a foreground service of type **location** (`FOREGROUND_SERVICE_LOCATION`). Play Console asks you to declare it.

- Foreground service type: **Location**.
- Describe the use: "A persistent, user-visible notification and a foreground service are used while the user is recording a trail, so GPS recording continues when the app is not on screen. The user starts and stops it with Start/Pause/Stop buttons."
- User impact if the service were not allowed: "The trail would stop recording when the screen turns off or the user switches apps, producing an incomplete track."
- Provide a video link: the same demo video from section 9 covers it (the notification and the recording continuing). The form may ask for a separate link; paste the same one.

---

## 11. Option: remove "Allow all the time" (Option B)

If you would like a lighter review, you can ship without the background permission:
1. Delete the line `<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />` from `android/app/src/main/AndroidManifest.xml`.
2. Rebuild (section 15). The app will detect that the permission is not declared and skip the "Allow all the time" step automatically.
3. It still records with the screen off using the foreground service (the "While using the app" permission is enough when a foreground service of type location is started while the app is visible).

**Caveat:** Google's policy treats a foreground service that behaves like background location as still subject to the same review, so you will still need the foreground service declaration and the demo video. This reduces friction but does not remove it. It is also untested on a device (it depends on Android keeping the service running with only "While using the app" permission, which should work but I could not prove).

---

## 12. Other App content forms

- **Ads:** No, the app contains no ads.
- **App access:** All functionality is available without special access (no login). Select "All functionality is available without special access".
- **Content rating:** start the IARC questionnaire (category: Utility, Productivity, or similar). Answer **No** to violence, sexual content, language, controlled substances, gambling, and user-generated content that is shared with others. TrailLog does not share user location with other users. Expect a rating of Everyone (ESRB) or equivalent. The email you enter must be real.
- **Target audience and content:** select **13 and over** (or 18 and over). **Do not** choose any age group under 13: that triggers the Families Policy requirements, and the app is not designed for children.
- **News app:** No. **COVID-19 contact tracing/status app:** No. **Government app:** No. **Financial features:** none. **Health apps:** if the form asks, choose "My app does not have any health features" (it records distance and speed but gives no health measurements or advice). Reconsider this if you add heart rate or calorie features.
- **Advertising ID:** the app does not use it. If the form asks, answer No. (The manifest does not include the `AD_ID` permission.)
- **Data safety:** section 8.
- **Government/export compliance questions:** the app uses only standard HTTPS, so answers are the usual "No".

---

## 13. Name check and rename checklist

Because the repo notes say "TrailLog" may be unavailable, decide first. Play app names do not have to be globally unique in the way package IDs do, but a name too close to an existing app can be rejected or cause confusion, and a trademark claim is possible.

If you rename (for example to Trailvane), change all of these **before the first upload** (the package ID cannot change afterward, though the visible app name can be edited later):
1. `android/app/src/main/res/values/strings.xml`: `app_name` and `title_activity_main`.
2. `capacitor.config.json`: `appName`, and the user-agent string.
3. Package ID (optional but recommended to change now): `applicationId` and `namespace` in `android/app/build.gradle`; the Java folders and `package` lines under `android/app/src/main/java/`; `appId` in `capacitor.config.json`; the `${applicationId}` authorities are automatic.
4. Web UI: the title and name strings in `www/index.html`, `www/manifest.webmanifest`, `www/js/app.js` (notification title and texts), and `www/sw.js` cache names.
5. `store/listing.md`, `store/privacy.html`, `docs/PRIVACY_POLICY.md`: replace the name. And regenerate the icon/feature graphic text (`python3 tools/generate_assets.py`, needs Pillow).
6. Rebuild (section 15), re-run the tests, upload.

---

## 14. Prelaunch checklist

Before you start the closed test:
- [ ] Install the debug APK on at least one real phone and record a 10-minute walk.
- [ ] Privacy policy hosted at a public URL and entered in Play Console (section 7).
- [ ] Contact email filled in everywhere.
- [ ] Name decision made (section 13).
- [ ] Two to eight real phone screenshots captured (section 6).
- [ ] Demo video recorded and uploaded (section 9).
- [ ] Upload keystore and password backed up in two places (section 16).
- [ ] 15 to 20 testers lined up (section 3).

Things I could not test (check on a phone):
1. The first-run flow: disclosure, location prompt, notification prompt, "Allow all the time" step, and battery tip.
2. Recording with the screen off for 10 minutes or more, and then reading the track: no gaps, sensible distance.
3. The "TrailLog is recording" notification appears while recording and disappears on Pause and Stop.
4. Swiping the app out of recents ends recording (this is expected: the service stops with the app, and the app tells users not to do it).
5. Android WebView can slow JavaScript timers when the screen is off. The location plugin delivers fixes natively, but the in-page stats and saving depend on the page staying alive; confirm that all points are saved.
6. Export GPX/KML and the share sheet (the file goes through Android's FileProvider).
7. Back button behavior and the splash screen.
8. Edge-to-edge layout: Android 15+ and targetSdk 36 draw the app behind the status and navigation bars. The CSS uses safe-area insets; confirm nothing is hidden behind them.
9. Different phones: Samsung, Pixel, Xiaomi, and so on. Some makers kill background apps aggressively (see https://dontkillmyapp.com).
10. Android 7 to 9 (older versions behave differently around permissions and notifications).

Before production:
- [ ] The 12-tester, 14-day closed test complete (section 3), and production access approved.
- [ ] Location permission and foreground service forms approved.
- [ ] Store listing, content rating, and Data safety all green in the dashboard.

---

## 15. Rebuilding the app (for updates)

All commands from the project folder `traillog-android/` (or wherever you unzipped it).

Requirements: Node.js 22 or newer, JDK 21, the Android SDK (platform 36, build-tools 36). On this box, `source /home/box/tools/env.sh` sets them up.

```
npm install
npm test                          # unit tests (41 tests)
npx cap sync android              # copies www/ into the Android project
cd android
./gradlew assembleDebug           # debug APK:   app/build/outputs/apk/debug/app-debug.apk
./gradlew bundleRelease           # release AAB: app/build/outputs/bundle/release/app-release.aab
```

- **Before every Play upload**, raise `versionCode` in `android/app/build.gradle` (1, 2, 3, ...). Play rejects an upload whose versionCode was already used. Change `versionName` to whatever you like (for example 1.0.1).
- The release build looks for `../../traillog-android-signing/keystore.properties` (a sibling folder next to the project). If your keystore is somewhere else, add `-PtraillogSigning=/full/path/keystore.properties`. If the file is missing, you get an **unsigned** AAB that Play will reject.
- Editing the web app: `www/` is a copy of the web app with a few native additions (`docs/web-changes.patch` lists every difference from the original web repo). The original `gps-tracker` folder was not changed. Keep both in sync deliberately: native-only code lives in `www/js/native.js`.
- Bump `VERSION` in `www/sw.js` if you change web files (affects the web app only; the service worker is switched off inside the Android app).

---

## 16. Keystore backup (important)

The upload keystore and password are in **`/workspace/traillog-android-signing/`** (outside the project). Read the `README.md` in that folder. In short, back up **`traillog-upload.jks`** and **`keystore-password.txt`** together in at least two safe places (a password manager plus an encrypted USB drive). Never commit, email, or post them. They are **not** in the deliverables zip. If they are lost you can ask Google to reset the upload key (Play Console > Test and release > App integrity > App signing), but that takes time.

---

## 17. Known limitations and risks (say these out loud to your testers)

- **Swiping the app away from recents stops recording.** The foreground service stops with the app. Press Home instead.
- **Battery optimization.** Some phones stop apps in the background even with a foreground service. The app shows a battery tip after recording starts, and the permissions screen links to the Android battery settings.
- **Map tiles need internet,** and there is no offline map cache beyond what the WebView keeps (tiles you viewed recently). A recording still works offline; the map area is just blank.
- **Map provider terms.** The OpenStreetMap tile servers have a usage policy (https://operations.osmfoundation.org/policies/tiles/) that discourages heavy use by apps and gives no guarantee. Esri's satellite tiles and OpenTopoMap also have terms for production use; read them before a wide release. For a closed test this is low risk. For a popular app, plan to switch to a commercial tile provider (MapTiler, Stadia Maps, Thunderforest, Mapbox, and similar) with an API key.
- **Tracks do not move to a new phone** (cloud backup and device transfer are switched off on purpose for privacy). Use Export GPX as the backup.
- **Export saves go through the share sheet** (pick Drive, Files, email, etc.). A "save to Downloads" option is a possible future improvement.
- Minification (R8) is off to keep the first release simple, so the app is about 3.5 MB (AAB) and 4.8 MB (debug APK).
- The Play Console, policies, and the Android developer verification program change often. Re-check anything marked with a source link before you rely on it.
