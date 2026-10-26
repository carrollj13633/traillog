const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../www/js/platform.js');

const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iosStandalone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
  iosFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15',
  ipadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  iosInApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
  androidWebview: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  winChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0'
};

const cases = [
  ['iOS Safari tab', { ua: UA.iosSafari, navStandalone: false, maxTouchPoints: 5 }, { os: 'ios', browser: 'safari', standalone: false, key: 'ios-safari', backgroundRisk: 'high' }],
  ['iOS home-screen standalone', { ua: UA.iosStandalone, navStandalone: true, displayStandalone: true, maxTouchPoints: 5 }, { os: 'ios', browser: 'safari', standalone: true, key: 'ios-standalone' }],
  ['iOS Chrome (WebKit)', { ua: UA.iosChrome, navStandalone: false, maxTouchPoints: 5 }, { os: 'ios', browser: 'chrome', engine: 'webkit', key: 'ios-other' }],
  ['iOS Firefox (WebKit)', { ua: UA.iosFirefox, navStandalone: false, maxTouchPoints: 5 }, { os: 'ios', browser: 'firefox', engine: 'webkit', key: 'ios-other' }],
  ['iPadOS (desktop-class UA) via feature detection', { ua: UA.ipadOS, navStandalone: false, maxTouchPoints: 5 }, { os: 'ios', device: 'iPad', browser: 'safari', key: 'ios-safari' }],
  ['iPadOS via multi-touch only (no navigator.standalone)', { ua: UA.ipadOS, maxTouchPoints: 5 }, { os: 'ios', device: 'iPad' }],
  ['iOS in-app browser', { ua: UA.iosInApp, navStandalone: false }, { os: 'ios', browser: 'webview', key: 'ios-other' }],
  ['Android Chrome (UA only)', { ua: UA.androidChrome, maxTouchPoints: 5 }, { os: 'android', browser: 'chrome', key: 'android-chrome', backgroundRisk: 'medium' }],
  ['Android Chrome (client hints)', { ua: UA.androidChrome.replace('Android 14', 'Android 10'), uaData: { platform: 'Android', mobile: true, brands: [{ brand: 'Google Chrome' }, { brand: 'Chromium' }] } }, { os: 'android', browser: 'chrome', key: 'android-chrome' }],
  ['Android Chrome installed (display-mode)', { ua: UA.androidChrome, displayStandalone: true }, { os: 'android', standalone: true, key: 'android-chrome' }],
  ['Android Firefox', { ua: UA.androidFirefox }, { os: 'android', browser: 'firefox', engine: 'gecko', key: 'android-firefox' }],
  ['Samsung Internet', { ua: UA.samsung }, { os: 'android', browser: 'samsung', key: 'android-samsung' }],
  ['Android WebView', { ua: UA.androidWebview }, { os: 'android', browser: 'webview' }],
  ['macOS Safari = desktop', { ua: UA.macSafari, maxTouchPoints: 0 }, { os: 'desktop', browser: 'safari', key: 'desktop', backgroundRisk: 'low' }],
  ['Windows Chrome', { ua: UA.winChrome, uaData: { platform: 'Windows', mobile: false, brands: [{ brand: 'Google Chrome' }] } }, { os: 'desktop', browser: 'chrome', key: 'desktop' }],
  ['Windows Edge', { ua: UA.winEdge }, { os: 'desktop', browser: 'edge' }],
  ['Linux Firefox', { ua: UA.linuxFirefox }, { os: 'desktop', browser: 'firefox' }],
  ['empty env', {}, { os: 'desktop', key: 'desktop' }]
];

cases.forEach(([name, env, expect]) => test('detectPlatform: ' + name, () => {
  const r = P.detectPlatform(env);
  Object.keys(expect).forEach((k) => assert.equal(r[k], expect[k], `${k} (label: ${r.label})`));
  assert.ok(r.label.length > 3 && r.evidence.length > 0);
}));

test('feature detection beats a misleading UA', () => {
  // navigator.standalone exists only on iOS WebKit, even if the UA claims to be a Mac.
  assert.equal(P.detectPlatform({ ua: UA.macSafari, navStandalone: false }).os, 'ios');
  // userAgentData says Windows even though UA contains "Android" (spoofed): hints win.
  assert.equal(P.detectPlatform({ ua: UA.androidChrome, uaData: { platform: 'Windows', brands: [] } }).os, 'desktop');
});

test('guides exist for every platform key and mention the required iOS/Android settings', () => {
  const keys = ['ios-safari', 'ios-standalone', 'ios-other', 'android-chrome', 'android-firefox', 'android-samsung', 'desktop'];
  keys.forEach((key) => {
    const g = P.getGuide({ key, backgroundRisk: 'low' });
    assert.ok(g.setup.length && g.denied.length && g.install.length, key);
  });
  const ios = JSON.stringify(P.getGuide({ key: 'ios-safari', backgroundRisk: 'high' }));
  assert.match(ios, /Privacy & Security > Location Services/);
  assert.match(ios, /Safari Websites/);
  assert.match(ios, /While Using the App/);
  assert.match(ios, /Add to Home Screen/);
  assert.match(ios, /unlocked/);
  const and = JSON.stringify(P.getGuide({ key: 'android-chrome', backgroundRisk: 'medium' }));
  assert.match(and, /Site settings > Location/);
  assert.match(and, /precise location/i);
  assert.match(and, /Battery Saver/);
  assert.match(and, /Unrestricted|Not optimized/);
});

test('errorHelp: tailored per error code and platform', () => {
  const ios = P.detectPlatform({ ua: UA.iosSafari, navStandalone: false });
  const and = P.detectPlatform({ ua: UA.androidChrome });
  assert.match(P.errorHelp(1, ios).steps.join(' '), /Safari Websites/);
  assert.match(P.errorHelp(1, and).steps.join(' '), /Site settings/);
  assert.match(P.errorHelp(2, ios).steps.join(' '), /Location Services/);
  assert.match(P.errorHelp(2, and).steps.join(' '), /Battery Saver/);
  assert.match(P.errorHelp(3, ios).title, /taking too long/);
  assert.match(P.errorHelp('insecure', ios).message, /HTTPS|secure/);
  assert.match(P.errorHelp('insecure', ios).steps.join(' '), /localhost/);
  assert.equal(P.errorHelp('unsupported', ios).title, 'Geolocation not supported');
  assert.ok(P.errorHelp(99, ios).steps.length);
});

test('Android app (Capacitor WebView) is detected from env.native and gets app-specific help', () => {
  const p = P.detectPlatform({ ua: UA.androidWebview, native: true });
  assert.equal(p.key, 'android-app');
  assert.equal(p.os, 'android');
  assert.equal(p.native, true);
  assert.equal(p.standalone, true);
  assert.equal(p.backgroundRisk, 'app');
  const g = P.getGuide(p);
  assert.match(g.setup.map((s) => s.steps.join(' ')).join(' '), /Allow all the time/);
  assert.match(g.background, /foreground service/);
  assert.match(P.errorHelp(1, p).steps.join(' '), /Apps > TrailLog > Permissions/);
  // The same WebView user agent without the native flag is still treated as a browser.
  assert.equal(P.detectPlatform({ ua: UA.androidWebview }).key, 'android-chrome');
});
