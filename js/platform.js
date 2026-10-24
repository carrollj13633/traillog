/* TrailLog – platform detection and platform-specific help text.
   Feature detection first (navigator.standalone, userAgentData, display-mode), UA sniffing second.
   Pure functions: pass an `env` object so everything is unit-testable in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Platform = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * env: { ua, maxTouchPoints, navStandalone (boolean|undefined), displayStandalone (boolean),
   *        uaData ({platform, mobile, brands:[{brand}]}|null) }
   */
  function detectPlatform(env) {
    env = env || {};
    var ua = env.ua || '';
    var uad = env.uaData || null;
    var touch = env.maxTouchPoints || 0;
    var evidence = [];
    var os = 'desktop';

    // 1) Feature detection: navigator.standalone only exists on iOS/iPadOS WebKit.
    if (typeof env.navStandalone === 'boolean') { os = 'ios'; evidence.push('navigator.standalone present'); }
    // 2) Client hints (Chromium).
    else if (uad && uad.platform) {
      if (/android/i.test(uad.platform)) { os = 'android'; evidence.push('userAgentData.platform=Android'); }
      else { os = 'desktop'; evidence.push('userAgentData.platform=' + uad.platform); }
    }
    // 3) UA fallbacks.
    else if (/iPad|iPhone|iPod/.test(ua)) { os = 'ios'; evidence.push('UA iOS token'); }
    else if (/Macintosh/.test(ua) && touch > 1) { os = 'ios'; evidence.push('iPadOS desktop-class UA + multi-touch'); }
    else if (/Android/i.test(ua)) { os = 'android'; evidence.push('UA Android token'); }
    else evidence.push('UA desktop');

    var standalone = env.navStandalone === true || env.displayStandalone === true;
    if (standalone) evidence.push(env.navStandalone === true ? 'navigator.standalone=true' : 'display-mode standalone/fullscreen/minimal-ui');

    var browser = 'other';
    var brands = (uad && uad.brands ? uad.brands.map(function (b) { return b.brand; }).join(',') : '');
    if (os === 'ios') {
      if (/CriOS/.test(ua)) browser = 'chrome';
      else if (/FxiOS/.test(ua)) browser = 'firefox';
      else if (/EdgiOS/.test(ua)) browser = 'edge';
      else if (/OPiOS|OPT\//.test(ua)) browser = 'opera';
      else if (/DuckDuckGo/.test(ua)) browser = 'duckduckgo';
      else if (standalone) browser = 'safari';
      else if (/Safari\//.test(ua)) browser = 'safari';
      else browser = 'webview'; // in-app browsers (Instagram, etc.) omit the Safari token
    } else if (os === 'android') {
      if (/SamsungBrowser/.test(ua)) browser = 'samsung';
      else if (/Firefox\/|Fennec/.test(ua)) browser = 'firefox';
      else if (/EdgA\//.test(ua) || /Microsoft Edge/.test(brands)) browser = 'edge';
      else if (/OPR\//.test(ua)) browser = 'opera';
      else if (/; wv\)/.test(ua)) browser = 'webview';
      else if (/Chrome\//.test(ua) || /Chromium|Google Chrome/.test(brands)) browser = 'chrome';
    } else {
      if (/Edg\//.test(ua) || /Microsoft Edge/.test(brands)) browser = 'edge';
      else if (/OPR\//.test(ua)) browser = 'opera';
      else if (/Firefox\//.test(ua)) browser = 'firefox';
      else if (/Chrome\//.test(ua) || /Chromium|Google Chrome/.test(brands)) browser = 'chrome';
      else if (/Safari\//.test(ua)) browser = 'safari';
    }

    var engine = os === 'ios' ? 'webkit' : (browser === 'firefox' ? 'gecko' : (browser === 'safari' ? 'webkit' : (browser === 'other' ? 'unknown' : 'chromium')));

    var device = os === 'ios' ? ((/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) ? 'iPad' : 'iPhone')
      : os === 'android' ? 'Android phone/tablet' : 'Computer';

    var key;
    if (os === 'ios') key = standalone ? 'ios-standalone' : (browser === 'safari' ? 'ios-safari' : 'ios-other');
    else if (os === 'android') key = browser === 'firefox' ? 'android-firefox' : browser === 'samsung' ? 'android-samsung' : 'android-chrome';
    else key = 'desktop';

    var names = { safari: 'Safari', chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge', opera: 'Opera', samsung: 'Samsung Internet', duckduckgo: 'DuckDuckGo', webview: 'in-app browser', other: 'unknown browser' };
    var label = device + ' · ' + names[browser] + (os === 'ios' && browser !== 'safari' ? ' (WebKit)' : '') +
      (standalone ? ' · installed app' : ' · browser tab');

    return {
      os: os, browser: browser, device: device, engine: engine, standalone: standalone, key: key, label: label,
      backgroundRisk: os === 'ios' ? 'high' : os === 'android' ? 'medium' : 'low',
      evidence: evidence
    };
  }

  var INSTALL = {
    'ios-safari': ['In Safari, tap the Share button (square with an arrow).', 'Scroll down and tap "Add to Home Screen", then "Add".', 'Open TrailLog from your Home Screen icon.'],
    'ios-standalone': ['You are already running TrailLog from the Home Screen. Nothing more to do.'],
    'ios-other': ['Open this page in Safari for the most reliable results (iOS Chrome, Firefox, and Edge are also built on WebKit, but Safari has the best PWA support).', 'In Safari tap Share > "Add to Home Screen" > "Add".'],
    'android-chrome': ['Tap the ⋮ menu and choose "Install app" (or "Add to Home screen").', 'Confirm. TrailLog appears in your app drawer.'],
    'android-firefox': ['Tap the ⋮ menu and choose "Install" (or "Add to Home screen").', 'Confirm. TrailLog appears on your home screen.'],
    'android-samsung': ['Tap the ☰ menu, then "Add page to" > "Home screen" (or choose "Install app" if offered).', 'Confirm to add TrailLog.'],
    'desktop': ['In Chrome or Edge, click the install icon at the right end of the address bar (or menu > "Install TrailLog").', 'GPS on desktop uses Wi-Fi or IP lookups, so accuracy is usually poor. A phone is best for recording.']
  };

  var SETUP = {
    'ios-safari': [
      { h: 'Turn on Location Services', steps: ['Open Settings > Privacy & Security > Location Services and switch it On.', 'Scroll to "Safari Websites" and choose "While Using the App" (or "Ask Next Time Or When I Share").', 'Keep "Precise Location" switched on so you get GPS-level accuracy.'] },
      { h: 'Recommended: add to Home Screen', steps: INSTALL['ios-safari'] },
      { h: 'While recording', steps: ['Keep the screen unlocked and TrailLog in front. iOS suspends web pages (and their GPS) when the screen locks or you switch apps.', 'Optional: Settings > Display & Brightness > Auto-Lock > Never (change it back later).'] }
    ],
    'ios-standalone': [
      { h: 'Turn on Location Services', steps: ['Open Settings > Privacy & Security > Location Services and switch it On.', 'Find "TrailLog" in the app list (or "Safari Websites") and choose "While Using the App".', 'Keep "Precise Location" switched on.'] },
      { h: 'While recording', steps: ['Keep the screen unlocked and TrailLog in front. iOS suspends Home Screen web apps when the screen locks or you switch apps.', 'Optional: Settings > Display & Brightness > Auto-Lock > Never (change it back later).'] }
    ],
    'ios-other': [
      { h: 'Turn on Location Services', steps: ['Open Settings > Privacy & Security > Location Services and switch it On.', 'Scroll to your browser (Chrome, Firefox, or Edge) and choose "While Using the App".', 'Keep "Precise Location" on. Safari Websites settings do not apply to this browser.'] },
      { h: 'Recommended: use Safari and add to Home Screen', steps: INSTALL['ios-other'] },
      { h: 'While recording', steps: ['Keep the screen unlocked and the browser in front; iOS pauses GPS for backgrounded web pages.'] }
    ],
    'android-chrome': [
      { h: 'Allow precise location', steps: ['Make sure Location is on: swipe down and tap the Location tile (or Settings > Location).', 'When Chrome asks, tap "Allow" and choose "Precise".', 'Check later in Chrome: ⋮ > Settings > Site settings > Location, or tap the lock icon in the address bar > Permissions.', 'Also check Android Settings > Apps > Chrome > Permissions > Location: "Allow only while using the app" and "Use precise location" on.'] },
      { h: 'Install', steps: INSTALL['android-chrome'] },
      { h: 'Battery notes', steps: ['Turn off Battery Saver while recording; it can throttle GPS.', 'Settings > Apps > Chrome (or TrailLog) > Battery > "Unrestricted" or "Not optimized".', 'Keep the screen on and the app in front; Chrome can pause GPS in the background.'] }
    ],
    'android-firefox': [
      { h: 'Allow location', steps: ['Turn on Location in Android quick settings. When Firefox asks, tap "Allow".', 'Firefox: ⋮ > Settings > Site permissions > Location, or tap the lock icon in the address bar > Permissions.', 'Android Settings > Apps > Firefox > Permissions > Location > "Allow only while using the app" with "Use precise location" on.'] },
      { h: 'Install', steps: INSTALL['android-firefox'] },
      { h: 'Battery notes', steps: ['Turn off Battery Saver while recording.', 'Settings > Apps > Firefox > Battery > "Unrestricted".', 'Keep the screen on and Firefox in front.'] }
    ],
    'android-samsung': [
      { h: 'Allow location', steps: ['Turn on Location in quick settings. When asked, tap "Allow".', 'Samsung Internet: ☰ > Settings > Sites and downloads > Site permissions > Location.', 'Settings > Apps > Samsung Internet > Permissions > Location > "Allow only while using the app" with "Use precise location" on.'] },
      { h: 'Install', steps: INSTALL['android-samsung'] },
      { h: 'Battery notes', steps: ['Turn off Battery Saver / Power saving while recording.', 'Settings > Apps > Samsung Internet > Battery > "Unrestricted" (and remove it from "Sleeping apps").', 'Keep the screen on and the browser in front.'] }
    ],
    'desktop': [
      { h: 'Allow location', steps: ['Click "Allow" when the browser asks, or click the lock icon in the address bar > Site settings > Location > Allow.', 'Desktop browsers estimate position from Wi-Fi/IP, so fixes may be inaccurate and filtered out. Use a phone for real tracking.'] },
      { h: 'Install', steps: INSTALL.desktop }
    ]
  };

  var DENIED = {
    'ios-safari': ['Tap the "aA" button in Safari\'s address bar > Website Settings > Location > Allow, then reload.', 'Or open Settings > Privacy & Security > Location Services > Safari Websites and pick "While Using the App" or "Ask".', 'Make sure Location Services (top of that screen) is On.', 'Still blocked? Settings > Safari > Clear History and Website Data resets all site permissions.'],
    'ios-standalone': ['Open Settings > Privacy & Security > Location Services, switch it On, then find "TrailLog" (or "Safari Websites") and choose "While Using the App".', 'If TrailLog is not listed, delete the Home Screen icon, re-add it from Safari, and tap Start again to get a new prompt.'],
    'ios-other': ['Open Settings > Privacy & Security > Location Services, switch it On, then set your browser (Chrome, Firefox, or Edge) to "While Using the App".', 'Reload this page and tap Start again.'],
    'android-chrome': ['Tap the lock (or tune) icon in the address bar > Permissions > Location > Allow, then reload.', 'Or Chrome ⋮ > Settings > Site settings > Location, and remove this site from the Blocked list.', 'Also check Android Settings > Apps > Chrome > Permissions > Location is not "Don\'t allow", and that Location is on.'],
    'android-firefox': ['Tap the lock icon in the address bar > Permissions > Location > Allow, then reload.', 'Or ⋮ > Settings > Site permissions > Location and clear the block for this site.', 'Check Android Settings > Apps > Firefox > Permissions > Location.'],
    'android-samsung': ['Tap the lock icon in the address bar > Permissions > Location > Allow, then reload.', 'Or ☰ > Settings > Sites and downloads > Site permissions > Location.', 'Check Android Settings > Apps > Samsung Internet > Permissions > Location.'],
    'desktop': ['Click the lock icon in the address bar > Site settings > Location > Allow, then reload.', 'On macOS also check System Settings > Privacy & Security > Location Services for your browser; on Windows check Settings > Privacy & security > Location.']
  };

  var BACKGROUND = {
    high: 'iOS suspends web pages when the screen locks or you switch apps, which pauses GPS. Keep the screen on and this app in front while recording.',
    medium: 'Android browsers may pause GPS when the screen locks or you switch apps, especially with Battery Saver on. Keep the screen on and this app in front while recording.',
    low: 'Desktop browsers keep running in the background, but location is usually coarse (Wi-Fi/IP based).'
  };

  function getGuide(p) {
    return {
      setup: SETUP[p.key] || SETUP.desktop,
      denied: DENIED[p.key] || DENIED.desktop,
      install: INSTALL[p.key] || INSTALL.desktop,
      background: BACKGROUND[p.backgroundRisk]
    };
  }

  /** Tailored help for geolocation failures. code: 1 denied, 2 unavailable, 3 timeout, 'insecure', 'unsupported'. */
  function errorHelp(code, p) {
    var g = getGuide(p);
    switch (code) {
      case 1:
        return { title: 'Location is blocked', message: 'TrailLog can\'t read your location because permission was denied. Here is how to turn it back on:', steps: g.denied };
      case 2: {
        var steps = p.os === 'ios'
          ? ['Open Settings > Privacy & Security > Location Services and make sure it is On.', 'Turn off Airplane Mode and try again.', 'Move outdoors with a clear view of the sky; GPS rarely works indoors.']
          : p.os === 'android'
            ? ['Turn on Location in quick settings and set the mode to high accuracy / precise location.', 'Turn off Airplane Mode and Battery Saver.', 'Move outdoors with a clear view of the sky; GPS rarely works indoors.']
            : ['This computer could not work out its position. Check that Wi-Fi is on and system location services are enabled.', 'Desktop PCs usually have no GPS; use a phone for tracking.'];
        return { title: 'Position unavailable', message: 'Your device could not determine its position right now.', steps: steps };
      }
      case 3:
        return { title: 'GPS is taking too long', message: 'No location fix arrived in time. TrailLog keeps trying in the background.', steps: ['Move outdoors or near a window, away from tall buildings and tree cover.', p.os === 'ios' ? 'Check Settings > Privacy & Security > Location Services is On, and Low Power Mode is off.' : 'Check that Location is on with high accuracy, and Battery Saver is off.', 'Give it up to a minute for a cold start. The first fix is the slowest.'] };
      case 'insecure':
        return { title: 'HTTPS required', message: 'Browsers only allow location access on secure pages. This page is not secure (it was loaded over plain http), so GPS is blocked.', steps: ['Open the https:// version of this site. Hosts like GitHub Pages, Netlify, and Cloudflare Pages provide HTTPS for free.', 'For testing on your own computer, http://localhost is allowed; a plain http:// address on your network is not.'] };
      case 'unsupported':
        return { title: 'Geolocation not supported', message: 'This browser does not provide the Geolocation API.', steps: ['Try a current version of Safari, Chrome, Firefox, or Edge.'] };
      default:
        return { title: 'Location problem', message: 'Something went wrong while reading your location.', steps: g.denied };
    }
  }

  return { detectPlatform: detectPlatform, getGuide: getGuide, errorHelp: errorHelp, INSTALL: INSTALL, SETUP: SETUP, DENIED: DENIED, BACKGROUND: BACKGROUND };
});
